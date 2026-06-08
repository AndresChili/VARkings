# Auditoría de Seguridad — VARkings

**Fecha:** 2026-06-08  
**Alcance:** Next.js 15 + Supabase PWA, ~200 usuarios, entorno de amigos  
**Metodología:** Revisión estática de código fuente

---

## Resumen ejecutivo

La aplicación tiene una base de seguridad sólida: CSP con nonce, HSTS, headers de seguridad, validación UUID en todos los parámetros de ruta, rate limiting en la mayoría de endpoints, y verificación criptográfica de cron secrets. Los hallazgos son de bajo-medio impacto y adecuados para la escala del proyecto.

---

## 🔴 MEDIA — Requieren acción

### AUD-01 · CSP permite `unsafe-inline` en script-src (fallback legacy)
**Archivo:** `middleware.ts:9`  
**Problema:** El script-src incluye `'unsafe-inline'` como fallback para navegadores que no soporten `strict-dynamic`. En esos navegadores (IE, algunos móviles viejos) cualquier XSS inyectado podría ejecutarse sin restricción de nonce.  
**Fix:** Eliminar `'unsafe-inline'` — los usuarios de 2026 tienen navegadores modernos. Añadir un meta-comment explicando el comportamiento de strict-dynamic para no reintroducirlo.

```ts
// middleware.ts — quitar 'unsafe-inline':
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
```

---

### AUD-02 · Rate limiting en memoria no compartido entre instancias serverless
**Archivo:** `lib/rate-limit.ts:4`  
**Problema:** Sin Upstash Redis configurado, cada instancia serverless (cold start) tiene su propio contador de rate limit. Un atacante con múltiples IPs puede multiplicar el límite efectivo por el número de instancias activas (típicamente 3-10 en Vercel).  
**Fix:** Configurar Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). El código ya lo soporta, solo falta aprovisionar la instancia.

---

## 🟡 BAJA — Recomendado corregir

### AUD-03 · Varios endpoints de mutación sin rate limit
**Archivos afectados:**
- `app/api/groups/route.ts` — POST crear grupo (solo tiene límite de conteo, no de tiempo)
- `app/api/groups/[id]/route.ts` — DELETE eliminar grupo
- `app/api/groups/[id]/transfer-admin/route.ts` — POST transferir admin
- `app/api/groups/[id]/leave/route.ts` — DELETE salir de grupo
- `app/api/groups/[id]/members/[userId]/route.ts` — DELETE expulsar miembro

**Problema:** Un usuario autenticado puede llamar estos endpoints en bucle (scripts, Postman). El daño es limitado por lógica de negocio (solo puede eliminar sus propios grupos, etc.) pero genera logs y carga innecesaria.  
**Fix:** Añadir `rateLimit('operation:${user.id}', N, windowMs)` al inicio de cada handler. Ejemplo:

```ts
if (!(await rateLimit(`group-create:${user.id}`, 10, 60_000))) {
  return NextResponse.json({ error: 'Demasiados intentos' }, { status: 429 });
}
```

---

### AUD-04 · Admin check por email en variable de entorno
**Archivos:** `app/(main)/admin/sugerencias/page.tsx:9`, `app/api/suggestions/[id]/route.ts:17`  
**Problema:** El acceso de superadmin se verifica comparando `user.email` con `SUPERADMIN_EMAIL`. Si el email admin cambia en Supabase sin re-verificación, o si se compromete esa cuenta de email, el acceso admin puede perderse o robarse.  
**Fix recomendado:** Añadir columna `role` en la tabla `profiles` y verificar `profile.role === 'superadmin'` en lugar del email. El email puede cambiar; un campo de rol no.

---

### AUD-05 · Sin límite de miembros por grupo
**Archivos:** `app/api/groups/join/route.ts`, `app/api/groups/[id]/invite/route.ts`  
**Problema:** Un grupo puede acumular miembros indefinidamente. Existe límite de 20 grupos por usuario pero no de miembros por grupo. Un admin podría ser bombardeado con join requests (cada usuario puede pedir unirse si tiene el código).  
**Fix:** Añadir verificación de miembros máximos por grupo (ej. 50-100) en el endpoint de join y en accept-request:

```ts
const { count: memberCount } = await supabase
  .from('group_members')
  .select('id', { count: 'exact', head: true })
  .eq('group_id', group.id);
if ((memberCount ?? 0) >= 100) {
  return NextResponse.json({ error: 'Grupo lleno' }, { status: 400 });
}
```

---

### AUD-06 · Header `x-forwarded-for` usado como IP en entornos no-Vercel
**Archivo:** `lib/rate-limit.ts:71`  
**Problema:** El fallback usa `x-forwarded-for`, que es controlado por el cliente. Un atacante puede cambiar esta cabecera para evadir rate limits en despliegues no-Vercel (local, Railway, etc.). En Vercel el `x-real-ip` es fiable e infalsificable.  
**Fix:** Documentar que en producción **debe** estar en Vercel para que el rate limiting sea efectivo. Añadir un warning en log si `x-real-ip` no está presente:

```ts
if (!req.headers.get('x-real-ip')) {
  console.warn('[rate-limit] x-real-ip not present — rate limit may be bypassable');
}
```

---

## 🔵 INFORMACIONAL — No urgente

### AUD-07 · Sin CORS explícito — endpoints GET públicos accesibles cross-origin
**Problema:** No hay configuración CORS explícita. Endpoints GET autenticados (ej. `/api/groups/[id]/podio`) devuelven datos si el navegador del usuario visita una página maliciosa — el navegador envía las cookies de sesión automáticamente. Los endpoints POST/PATCH/DELETE están protegidos de CSRF por el origen SameSite de las cookies de Supabase.  
**Fix opcional:** Añadir cabecera `Access-Control-Allow-Origin: <tu-dominio>` en los endpoints GET sensibles, o verificar el header `Origin` antes de devolver datos.

---

### AUD-08 · Headers de aislamiento de contexto ausentes
**Archivo:** `next.config.ts`  
**Problema:** Faltan `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`. Permiten ataques de Spectre en navegadores con isolación de proceso si la app carga recursos cross-origin con credenciales.  
**Impacto real para 200 usuarios:** Muy bajo.  
**Fix:**
```ts
{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
{ key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
```

---

### AUD-09 · `console.error` puede exponer información interna en logs
**Archivos:** múltiples routes (`register/route.ts:58`, `cron/update-results/route.ts:104`, etc.)  
**Problema:** `console.error('[register] supabase error:', error.message, error.status)` puede volcar mensajes internos de Supabase en logs de Vercel. Si los logs son accesibles por terceros (colaboradores del proyecto en Vercel), podrían ver emails, errores de DB, etc.  
**Fix:** Usar un logger que enmascare PII (`email → user@***`) o asegurarse de que solo el owner tiene acceso a logs de Vercel.

---

### AUD-10 · Predicciones de torneo sin validación contra equipos reales del Mundial
**Archivo:** `app/api/predictions/tournament/route.ts:32`  
**Problema:** `champion`, `runner_up`, `third_place` aceptan cualquier string hasta 100 chars. Un usuario puede almacenar "Rick Astley" como campeón.  
**Impacto:** Integridad de datos, no seguridad. No es un vector de ataque.  
**Fix opcional:** Validar contra lista de equipos del Mundial 2026 si se quiere integridad de datos.

---

### AUD-11 · Cron `send-reminders` carga todas las subscriptions push por cada partido
**Archivo:** `app/api/cron/send-reminders/route.ts:56`  
**Problema:** Para N partidos próximos, hace N queries de `.limit(1000)` a `push_subscriptions`. No es un vector de seguridad (endpoint protegido por CRON_SECRET), pero con muchos partidos simultáneos puede ser lento.  
**Fix:** Sacar la query de subscriptions fuera del loop y reutilizarla.

---

## ✅ Bien implementado (no acción necesaria)

| Aspecto | Detalle |
|---|---|
| Validación UUID en params | Todos los `[id]` y `[userId]` validados con regex antes de queries |
| Auth check en todos los endpoints protegidos | `getUser()` + retorno 401 correcto |
| Cron secrets con `timingSafeEqual` | Evita timing attacks en comparación de tokens |
| Límites de payload con Content-Length | Groups, tournament, suggestions |
| Rate limiting en endpoints críticos | Register, login, predictions, invites, friends |
| Push endpoint allowlist | Solo acepta FCM, Mozilla, Apple, Windows push domains |
| CSP con nonce por request | Generado en middleware, pasado a layout |
| HSTS, X-Frame-Options, nosniff, Referrer-Policy | Configurados en next.config.ts |
| Entropy en invite codes | `crypto.getRandomValues` + rejection sampling, 8 chars base36 |
| Límites de negocio | Máx 10 grupos creados, máx 20 grupos por usuario |
| Password check antes de delete account | Re-autenticación requerida para usuarios email |
| Input sanitización en notificaciones push | `sanitize()` elimina control chars en nombres de equipos |

---

## Roadmap de mitigación

| Prioridad | ID | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | AUD-01 | 1 línea | Elimina vector XSS en browsers legacy |
| 2 | AUD-02 | 30 min | Rate limit real en producción |
| 3 | AUD-03 | 1h | Rate limit en 5 endpoints |
| 4 | AUD-05 | 30 min | Cap de miembros por grupo |
| 5 | AUD-04 | 2h | Role-based admin check |
| 6 | AUD-06 | 10 min | Warning log en non-Vercel |
| — | AUD-07 a 11 | Opcional | Mejoras incrementales |

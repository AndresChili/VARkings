# Auditoría de Seguridad — VARkings

> Fecha: 2026-06-08 | Scope: 200 usuarios max (amigos) | Stack: Next.js 15 + Supabase

---

## Resumen ejecutivo

La app tiene una base sólida: CSP con nonce, HSTS, headers de seguridad, validación de UUIDs en todos los endpoints, timingSafeEqual en crons, allowlist de dominios para push. Los problemas son principalmente **rate limiting inconsistente** y **un par de fallos de validación de input**.

---

## 🔴 ALTO

### A1 — `fullName` sin límite máximo de longitud
**Archivo:** `app/api/auth/register/route.ts:36`
```ts
if (!fullName || String(fullName).trim().length < 2) { ... }
```
- Solo verifica mínimo de 2 caracteres, **sin máximo**.
- Un atacante puede enviar un nombre de 1 MB que se almacena en Supabase Auth metadata y en `profiles`.
- Con 200 usuarios es improbable pero es un fallo de validación básico.

**Fix:** Añadir `|| String(fullName).trim().length > 100` a la misma condición.

---

### A2 — Rate limit ausente en `/api/predictions/match`
**Archivo:** `app/api/predictions/match/route.ts`
- POST y DELETE sin throttling.
- Un usuario autenticado puede spamear miles de peticiones por segundo.
- Cada petición hace 2-3 queries a Supabase (verificar match, buscar existing, upsert).
- Con 200 usuarios y el torneo en directo, un usuario enfadado puede saturar el plan de Supabase.

**Fix:** Añadir `rateLimit(`pred-match:${user.id}`, 30, 60_000)` al inicio del handler.

---

## 🟡 MEDIO

### M1 — IP rate limit con fallback `unknown`
**Archivo:** `lib/rate-limit.ts:68`
```ts
return req.headers.get('x-real-ip') ?? 'unknown';
```
- Si la app no corre en Vercel (o Vercel no inyecta `x-real-ip`), todos los usuarios comparten el bucket `register:unknown`.
- El primero en registrarse agota el límite para todos durante 15 minutos.
- Afecta a: registro, push subscribe, group-join, friends-send.

**Fix corto plazo:** Usar también `x-forwarded-for` como fallback de diagnóstico (no para seguridad) y loguearlo. Si la app corre siempre en Vercel, documentarlo y añadir alerta si `x-real-ip` falta.
**Fix real:** Añadir `|| req.headers.get('x-forwarded-for')?.split(',')[0].trim()` solo como fallback cuando se sabe que el proxy es de confianza.

---

### M2 — Fuga de mensajes de error internos de Supabase
**Archivo:** `app/api/auth/register/route.ts:69`
```ts
return NextResponse.json({ error: error.message ?? '...' }, { status: 400 });
```
- Si el error no matchea ningún patrón conocido, se devuelve el mensaje raw de Supabase.
- Puede filtrar información sobre la estructura interna (tablas, constraints, versiones).

**Fix:** Cambiar el fallback a un mensaje genérico:
```ts
return NextResponse.json({ error: 'Error al crear la cuenta. Inténtalo más tarde.' }, { status: 400 });
```

---

### M3 — Sin rate limit en `/api/profile/revalidate`
**Archivo:** `app/api/profile/revalidate/route.ts`
- Cualquier usuario autenticado puede llamar este endpoint en bucle.
- Cada llamada ejecuta `revalidateTag()`, que invalida caché de Next.js y provoca re-renders SSR del perfil.
- Coste bajo unitario pero acumulable.

**Fix:** `rateLimit(`revalidate:${user.id}`, 10, 60_000)`.

---

### M4 — Sin rate limit en `/api/predictions/tournament` y `/api/groups/[id]/invite`
- `predictions/tournament/route.ts`: sin throttling, hace 2 queries por petición.
- `groups/[id]/invite/route.ts`: sin throttling, un miembro puede enviar invitaciones en masa a usuarios reales y saturar la tabla `group_invites`.

**Fix:** `rateLimit(`tournament-pred:${user.id}`, 10, 60_000)` y `rateLimit(`group-invite:${user.id}`, 20, 60_000)`.

---

### M5 — Sin Content-Length guard en la mayoría de endpoints
- Solo `/api/suggestions/route.ts:14` verifica `content-length`.
- Endpoints como `/api/predictions/tournament` aceptan `group_predictions` (objeto anidado) sin límite de tamaño.
- Next.js tiene límite de 4 MB por defecto, pero es mejor ser explícito en endpoints que procesan objetos complejos.

**Fix:** Añadir validación de tamaño máximo en `predictions/tournament` y `groups` POST.

---

### M6 — TOCTOU (Time-of-Check Time-of-Use) en predicciones de partido
**Archivo:** `app/api/predictions/match/route.ts:39`
```ts
if (match.status !== 'NS' || new Date(match.match_date) <= new Date()) {
  return NextResponse.json({ error: 'El partido ya ha comenzado' }, { status: 403 });
}
// ... luego insert/update
```
- Hay una ventana de ms entre el check y el insert.
- Dos peticiones concurrentes del mismo usuario justo cuando empieza un partido podrían pasar ambas el check.
- Impacto real: muy bajo con 200 usuarios, pero teóricamente permite predecir después del pitido inicial.

**Fix real:** Añadir RLS en Supabase para `match_predictions` que verifique `match_date` y `status` en la propia DB. Esto hace la restricción atómica.

---

## 🟢 BAJO

### B1 — Inconsistencia en comparación de SUPERADMIN_EMAIL
- `app/(main)/profile/page.tsx:172`: comparación case-**sensitive** (`===`)
- `app/(main)/admin/sugerencias/page.tsx:9`: comparación case-**insensitive** (`.toLowerCase()`)
- Si el email tiene mayúsculas, el contador de sugerencias en el perfil no se muestra aunque el acceso al panel de admin sí funciona.

**Fix:** Usar `.toLowerCase()` en ambos sitios, o centralizar la función `isSuperAdmin(user)`.

---

### B2 — DELETE `/api/friends` solo permite al requester eliminar
**Archivo:** `app/api/friends/route.ts:61`
```ts
.eq('requester_id', user.id)
```
- El destinatario de una solicitud aceptada no puede eliminar la amistad por este endpoint.
- No es una vulnerabilidad de seguridad pero sí un gap funcional que podría crear UX confusa.

---

### B3 — Push subscriptions sin paginación en cron
**Archivo:** `app/api/cron/send-reminders/route.ts:53`
```ts
const { data: allSubscriptions } = await supabase.from('push_subscriptions').select(...)
```
- Carga todas las suscripciones en memoria sin `limit()`.
- Con 200 usuarios es irrelevante, pero si la app crece podría causar timeouts en el cron.

---

### B4 — `configureVapid()` muta estado global en cada push
**Archivo:** `lib/push-notifications.ts:4`
- `webpush.setVapidDetails(...)` es una mutación de estado global del módulo.
- Se llama dentro de `sendPushNotification()`, que se ejecuta una vez por usuario en bulk.
- Con llamadas concurrentes (`Promise.allSettled`) en el cron, se está sobreescribiendo el mismo config global N veces en paralelo.
- En la práctica no falla (siempre con los mismos valores), pero es código frágil.

**Fix:** Llamar `configureVapid()` una sola vez al inicializar el módulo, fuera de la función.

---

### B5 — Nombres de equipo en predicciones de torneo no validados contra lista real
**Archivo:** `app/api/predictions/tournament/route.ts:22`
- `champion`, `runner_up`, `third_place` solo se validan como string <= 100 chars.
- Un usuario puede predecir "Real Madrid" o "unicornio123" como campeón del Mundial.
- No es un problema de seguridad, pero sí de integridad de datos del juego.

---

## ✅ Lo que está bien (no tocar)

| Área | Implementación |
|---|---|
| Autenticación en APIs | `supabase.auth.getUser()` en todos los endpoints, nunca decodificando JWT manualmente |
| Validación de UUIDs | UUID_RE regex consistente en todos los endpoints con params de URL |
| Cron secret | `timingSafeEqual` correcto para evitar timing attacks |
| CSP | Nonce por petición en middleware, `strict-dynamic`, `frame-ancestors 'none'` |
| Security headers | HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy |
| Push endpoint allowlist | Dominio validado contra lista de proveedores conocidos |
| Invite code | Rejection sampling correcto para evitar modulo bias |
| Idempotencia de XP | `upsert` con `ignoreDuplicates: true` — no se puede farmear XP haciendo spam |
| Score bounds | Marcadores limitados 0-30 en predicciones de partido |
| Límites de grupos | 10 creados, 20 membresías por usuario |
| Admin client aislado | `createAdminClient()` solo se usa server-side, nunca expuesto al cliente |

---

## Prioridad de fixes para 200 usuarios

1. **A1** — fix en 5 min, muy fácil, valida fullName
2. **M2** — fix en 5 min, mensaje de error genérico
3. **B1** — fix en 2 min, centralizar isSuperAdmin
4. **B4** — fix en 5 min, mover configureVapid fuera del loop
5. **A2 + M3 + M4** — añadir rate limits a los endpoints que faltan
6. **M6** — añadir RLS en Supabase (requiere acceso al panel de Supabase)

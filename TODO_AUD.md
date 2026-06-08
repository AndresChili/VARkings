# AUDITORÍA DE CIBERSEGURIDAD — VARkings
**Fecha:** 2026-06-08  
**Alcance:** Full-stack Next.js 15 + Supabase PWA  
**Cobertura:** OWASP Top 10, autenticación, autorización, inyección, XSS, CSRF, rate limiting, enumeración, control de acceso roto, exposición de secretos, configuración insegura, lógica de negocio

---

## LEYENDA DE SEVERIDAD
- 🔴 CRÍTICO — explotable directamente, acción inmediata
- 🟠 ALTO — explotable con condiciones, parchear pronto  
- 🟡 MEDIO — riesgo real pero requiere esfuerzo o contexto extra
- 🔵 BAJO — riesgo bajo o teórico, buenas prácticas

---

## 🔴 CRÍTICO

### C-1: Bypass del flujo de aprobación de grupos via `/join/[code]`
**Archivo:** `app/join/[code]/page.tsx:31`  
**Tipo:** Broken Access Control (OWASP A01)  
**Descripción:** La página `/join/[code]` hace `insert` directo en `group_members` sin pasar por el flujo de join requests. El endpoint `/api/groups/join` implementa correctamente el mecanismo de aprobación por admin (líneas 65-80), pero esta página lo omite completamente. Cualquier usuario con el código de invitación puede entrar al grupo sin aprobación del admin.  
**Ataque:** Usuario obtiene link de invitación (compartido públicamente o filtrado), accede a `/join/CODIGO` y se une sin que el admin apruebe.  
**Fix:** Redirigir a la API `/api/groups/join` o replicar el mismo flujo de pending request en la page. Nunca hacer insert directo en page server components sin pasar por la lógica de negocio.
- [ ] Reemplazar insert directo en `app/join/[code]/page.tsx` por llamada al flujo de join request.

---

### C-2: Env vars críticas con non-null assertion — bypass de RLS si no están configuradas
**Archivo:** `lib/supabase/server.ts:34`  
**Tipo:** Misconfiguration / Insecure Defaults (OWASP A05)  
**Descripción:** `process.env.SUPABASE_SERVICE_ROLE_KEY!` usa non-null assertion TypeScript. Si la variable no está en producción, el valor es `undefined` stringificado — el admin client se crea con clave inválida. En función del comportamiento de Supabase, esto podría crear un cliente sin autenticación o con permisos inesperados. El SERVICE_ROLE_KEY bypassa RLS completamente — si cualquier endpoint usa este cliente de forma inesperada, todas las filas son accesibles.  
**Fix:** Validar explícitamente en startup que todas las env vars críticas están definidas.
- [ ] Añadir validación de env vars al inicio de `lib/supabase/server.ts`:
```ts
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing required Supabase environment variables');
}
```
- [ ] Mismo tratamiento para `FOOTBALL_DATA_API_KEY` y `RAPIDAPI_KEY` en `lib/api-football.ts` y `lib/football-data.ts`.

---

## 🟠 ALTO

### A-1: IP Spoofing en rate limiting — endpoint friends
**Archivo:** `app/api/friends/route.ts:8`  
**Tipo:** Broken Access Control / Rate Limit Bypass (OWASP A01)  
**Descripción:** La línea usa código inline `req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'` en lugar del helper `getClientIp()` de `lib/rate-limit.ts`. El helper solo usa `x-real-ip` (que en Vercel es fijado por el edge y no es falsificable). El fallback a `x-forwarded-for` es controlado por el cliente — un atacante puede poner cualquier valor y bypassar el rate limit completamente.  
**Ataque:** `curl -H "x-forwarded-for: 1.2.3.4" POST /api/friends` con IP diferente en cada petición → envía solicitudes de amistad sin límite.  
**Fix:** Reemplazar el código inline por `getClientIp(req)` del helper.
- [ ] Cambiar `app/api/friends/route.ts:8` para usar `getClientIp(req)` importado de `@/lib/rate-limit`.

---

### A-2: Sin rate limiting en creación de sugerencias
**Archivo:** `app/api/suggestions/route.ts`  
**Tipo:** Uncontrolled Resource Consumption (OWASP A04)  
**Descripción:** No hay ningún rate limit en el endpoint POST de sugerencias. Un usuario autenticado puede enviar miles de sugerencias automáticamente, llenando la tabla y causando DoS al admin.  
**Fix:** Añadir rate limit (ej: 5 sugerencias / 10 minutos por usuario o IP).
- [ ] Añadir `rateLimit()` al inicio del handler POST en `app/api/suggestions/route.ts`.

---

### A-3: Sin rate limiting en eliminación de cuenta — brute force de contraseña
**Archivo:** `app/api/account/route.ts`  
**Tipo:** Authentication Weakness (OWASP A07)  
**Descripción:** El endpoint DELETE re-verifica la contraseña antes de eliminar la cuenta (`signInWithPassword`). Sin rate limiting, un atacante puede intentar contraseñas repetidamente en este endpoint. Si el atacante tiene acceso a una sesión válida (cookie robada), puede intentar brute-force la contraseña del usuario para luego eliminar la cuenta.  
**Fix:** Añadir rate limit estricto (ej: 3 intentos / 15 minutos).
- [ ] Añadir `rateLimit()` en `app/api/account/route.ts` DELETE handler.

---

### A-4: Fuga de información — error.message interno expuesto al cliente
**Archivo:** `app/api/groups/[id]/members/[userId]/route.ts:40`  
**Tipo:** Security Misconfiguration / Information Disclosure (OWASP A05)  
**Descripción:** `return NextResponse.json({ error: error.message }, { status: 500 })` expone mensajes de error de Supabase/PostgreSQL al cliente. Estos mensajes pueden contener nombres de tablas, constraints, estructura interna de la DB, stack traces parciales.  
**Ejemplo de fuga:** `"duplicate key value violates unique constraint \"group_members_pkey\""` revela nombre de tabla y constraint.  
**Fix:** Devolver mensaje genérico `"Error interno del servidor"`.
- [ ] Cambiar `app/api/groups/[id]/members/[userId]/route.ts:40` a mensaje genérico.
- [ ] Buscar otros lugares con `error.message` expuesto al cliente: `grep -r "error.message" app/api/`.

---

### A-5: CSP con `unsafe-inline` — XSS protection debilitada
**Archivo:** `next.config.ts:28`  
**Tipo:** XSS / Security Misconfiguration (OWASP A05)  
**Descripción:** `"script-src 'self' 'unsafe-inline'"` permite ejecutar cualquier script inline. Esto anula gran parte de la protección CSP contra XSS. Si hay algún punto de inyección de contenido HTML (ej: campos de usuario mostrados sin escapar, Supabase Realtime, npm dependency comprometida), el CSP no bloqueará la ejecución del script malicioso.  
**Fix:** Usar nonces o hashes para scripts inline específicos. Next.js 13+ soporta nonce-based CSP via middleware.
- [ ] Implementar CSP con nonce en middleware para eliminar `unsafe-inline`.
- [ ] Referencia: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

---

### A-6: Enumeración de usuarios — 404 diferenciado revela existencia
**Archivo:** `app/api/friends/route.ts:33`, `app/api/groups/[id]/invite/route.ts:23`  
**Tipo:** User Enumeration (OWASP A01)  
**Descripción:** Ambos endpoints devuelven `"Usuario no encontrado"` con 404 cuando un UUID no existe en `profiles`. Esto permite a un atacante autenticado enumerar qué UUIDs corresponden a usuarios reales vs. UUIDs inválidos. Dado que los UUIDs de Supabase Auth se filtran parcialmente (a través de avatares públicos, URLs de perfil), esto puede usarse para confirmar IDs de usuario.  
**Fix:** Para `/api/friends`: no es crítico ya que el UUID debe conocerse previamente. Sin embargo, mantener consistencia. Considerar devolver 400 con "ID inválido" en ambos casos.
- [ ] Evaluar si la enumeración de UUIDs es un riesgo aceptable dado el modelo de datos público.

---

### A-7: Inconsistencia en check de admin — case sensitivity
**Archivo:** `app/(main)/admin/sugerencias/page.tsx:9` vs `app/api/suggestions/[id]/route.ts:14`  
**Tipo:** Broken Access Control (OWASP A01)  
**Descripción:** La page usa `user.email !== process.env.SUPERADMIN_EMAIL` (case-sensitive). La API usa `user.email?.toLowerCase() !== superadminEmail.toLowerCase()` (case-insensitive). Si `SUPERADMIN_EMAIL=Admin@example.com` y el usuario tiene `admin@example.com`, puede acceder a la API pero no a la UI (o viceversa). Un atacante que conozca el email admin podría crear cuenta con diferente capitalización.  
**Fix:** Normalizar siempre a lowercase en ambos sitios.
- [ ] Cambiar `app/(main)/admin/sugerencias/page.tsx:9` a `user.email?.toLowerCase() !== process.env.SUPERADMIN_EMAIL?.toLowerCase()`.

---

## 🟡 MEDIO

### M-1: Rate limiting in-memory — bypassable en despliegues multi-instancia
**Archivo:** `lib/rate-limit.ts:3`  
**Tipo:** Rate Limit Bypass (OWASP A04)  
**Descripción:** El store de rate limiting es un `Map` en memoria. En Vercel (Fluid Compute), hay múltiples instancias serverless. Un atacante puede distribuir requests entre instancias y cada una solo verá una fracción del tráfico, efectivamente multiplicando el límite por el número de instancias activas.  
**Impacto:** Los rate limits de registro (5/15min), join grupo (10/5min), amistad (20/5min) son todos bypassables.  
**Fix:** Usar Redis distribuido (Upstash, Vercel KV marketplace) para rate limiting en producción.
- [ ] Evaluar Upstash Redis via Vercel Marketplace para rate limiting distribuido.
- [ ] Como mitigación temporal, implementar rate limiting también a nivel Supabase Auth para registro.

---

### M-2: Sin validación de longitud máxima de contraseña — potencial DoS de bcrypt
**Archivo:** `app/api/auth/register/route.ts:20`  
**Tipo:** Uncontrolled Resource Consumption (OWASP A04)  
**Descripción:** Solo se verifica longitud mínima (8 chars). Sin máximo. Aunque bcrypt trunca inputs a 72 bytes, si Supabase usa scrypt u otro algoritmo sin truncado, una contraseña de 10MB podría causar consumo excesivo de CPU.  
**Fix:** Limitar a 128 caracteres máximo.
- [ ] Añadir `if (String(password).length > 128) return 400` en `app/api/auth/register/route.ts`.

---

### M-3: Registro devuelve objeto user completo — exposición de metadata
**Archivo:** `app/api/auth/register/route.ts:49`  
**Tipo:** Sensitive Data Exposure (OWASP A02)  
**Descripción:** `return NextResponse.json({ user: data.user })` devuelve el objeto user completo de Supabase Admin API, que puede incluir: `app_metadata`, `user_metadata`, timestamps de confirmación, `identities`, `factors` (MFA). Información que no necesita el cliente.  
**Fix:** Devolver solo `{ id, email }` o simplemente `{ success: true }`.
- [ ] Cambiar respuesta de registro a datos mínimos necesarios.

---

### M-4: Construcción manual de string en query SQL — send-reminders
**Archivo:** `app/api/cron/send-reminders/route.ts:56`  
**Tipo:** Potential SQL Injection (OWASP A03)  
**Descripción:** `query.not('user_id', 'in', \`(${predictedIds.map((id) => \`"${id}"\`).join(',')})\`)` construye string de filtro manualmente. Aunque los UUIDs están validados con regex, el formato usa comillas dobles (`"uuid"`) que no es el formato estándar de PostgREST para la función `.not()`. El formato correcto sería sin comillas. Esto podría causar que el filtro falle silenciosamente y envíe notificaciones a usuarios que ya hicieron predicción.  
**Fix:** Usar `.not('user_id', 'in', \`(${predictedIds.join(',')})\`)` o la API de Supabase correcta.
- [ ] Corregir formato del filtro `.not()` en `app/api/cron/send-reminders/route.ts:56`.

---

### M-5: Página pública /add/[userId] — enumeración de perfiles
**Archivo:** `app/(public)/add/[userId]/page.tsx:15`  
**Tipo:** Information Disclosure (OWASP A01)  
**Descripción:** La ruta `/add/:userId` es pública (sin auth) y expone `id, username, full_name, avatar_url` de cualquier usuario por UUID. Un atacante puede enumerar perfiles probando UUIDs. En Supabase, los UUIDs de usuarios auth coinciden con IDs de profiles.  
**Impacto:** Exposición de nombres completos y avatares sin autenticación.  
**Fix:** Considerar si la página realmente debe ser pública o requiere auth. Si debe ser pública (para QR codes de amistad), al menos no exponer `full_name`.
- [ ] Evaluar si la ruta /add/[userId] debe requerir autenticación o limitar campos expuestos.

---

### M-6: Sin límite en número de grupos por usuario
**Archivo:** `app/api/groups/route.ts`  
**Tipo:** Resource Exhaustion (OWASP A04)  
**Descripción:** Un usuario puede crear grupos ilimitados. Sin cap, un usuario malicioso puede crear miles de grupos, llenando la tabla y causando problemas de rendimiento en queries de leaderboard y listados.  
**Fix:** Limitar a un máximo razonable (ej: 10 grupos por usuario).
- [ ] Añadir check de número de grupos existentes antes de crear uno nuevo.

---

### M-7: Sin límite en número de grupos que un usuario puede unirse
**Archivo:** `app/api/groups/join/route.ts`  
**Tipo:** Resource Exhaustion (OWASP A04)  
**Descripción:** Similar al anterior. Un usuario puede estar en grupos ilimitados.
- [ ] Añadir límite de membresías por usuario (ej: máximo 20 grupos).

---

### M-8: Missing group_id UUID validation — invite route
**Archivo:** `app/api/groups/[id]/invite/route.ts:7`  
**Tipo:** Input Validation (OWASP A03)  
**Descripción:** El parámetro `id` (group_id) no es validado contra UUID_RE antes de usarse en queries. Otros routes del mismo grupo sí validan.  
**Fix:** Añadir `if (!UUID_RE.test(group_id)) return 400`.
- [ ] Añadir UUID_RE validation para `group_id` en `app/api/groups/[id]/invite/route.ts`.

---

### M-9: Error en API externa filtra respuesta completa en logs
**Archivo:** `lib/football-data.ts:24`  
**Tipo:** Information Disclosure (OWASP A09)  
**Descripción:** `throw new Error(\`football-data.org ${res.status}: ${await res.text()}\`)` incluye el body completo de la respuesta de error de la API externa en el mensaje de error. Si este error se propaga hasta un response al cliente (aunque no debería), o si los logs de Vercel son accesibles, esto podría exponer detalles de la API key, quotas, o estructura interna.  
**Fix:** Loguear por separado sin incluir response body en el mensaje que se propaga.
- [ ] Cambiar a `console.error(await res.text()); throw new Error(\`football-data.org ${res.status}\`)`.

---

### M-10: CSP no incluye dominios de push notifications en connect-src
**Archivo:** `next.config.ts:32`  
**Tipo:** Security Misconfiguration (OWASP A05)  
**Descripción:** `connect-src 'self' https://*.supabase.co wss://*.supabase.co` no incluye los dominios de push services (fcm.googleapis.com, push.services.mozilla.com, etc.). El service worker puede enviar peticiones desde el contexto de la app, y algunas implementaciones podrían verse bloqueadas por CSP.  
**Fix:** Añadir push service domains o evaluar si es necesario.
- [ ] Revisar si el service worker necesita CSP ajustado para push subscriptions.

---

### M-11: `X-DNS-Prefetch-Control: on` — privacy leak
**Archivo:** `next.config.ts:47`  
**Tipo:** Privacy / Information Disclosure (OWASP A02)  
**Descripción:** Habilitar DNS prefetching puede causar que los navegadores resuelvan DNS de URLs en el contenido de la página antes de que el usuario las visite, filtrando información de URLs visitadas a resolvers DNS. Para una app con datos sensibles de usuarios (predicciones, grupos), esto puede ser un leak de privacidad.  
**Fix:** Cambiar a `X-DNS-Prefetch-Control: off`.
- [ ] Cambiar valor en `next.config.ts` a `'off'`.

---

## 🔵 BAJO

### B-1: Modulo bias en generación de códigos de invitación
**Archivo:** `lib/utils.ts:69`  
**Tipo:** Weak Cryptography (OWASP A02)  
**Descripción:** `chars[b % chars.length]` con 36 chars y byte 0-255: `256 / 36 = 7.11` → los primeros 4 caracteres del alfabeto ('A','B','C','D') tienen probabilidad `8/256` vs `7/256` para el resto. Bias del ~14%. Para códigos de 8 chars con 36^8 ≈ 2.8T combinaciones, el impacto práctico es mínimo, pero es mala práctica criptográfica.  
**Fix:** Usar rejection sampling o un alfabeto de longitud potencia de 2 (ej: 32 chars → 256/32=8, sin bias).
- [ ] Refactorizar `generateInviteCode()` para eliminar modulo bias.

---

### B-2: Cookie flags de Supabase session no verificados
**Archivo:** `middleware.ts`, `lib/supabase/server.ts`  
**Tipo:** Session Management (OWASP A07)  
**Descripción:** Las cookies de sesión de Supabase deberían tener `HttpOnly`, `Secure`, `SameSite=Lax`. Supabase SSR las configura por defecto, pero no se puede verificar sin inspeccionar el Set-Cookie header. Confirmar que las cookies no son accesibles desde JavaScript.  
**Fix:** Verificar en browser DevTools que las cookies de sesión tienen los flags correctos.
- [ ] Inspeccionar flags de cookies de sesión en producción y documentar.

---

### B-3: Sin CSRF token explícito en rutas de estado
**Archivo:** Todos los `app/api/**` con POST/DELETE/PATCH  
**Tipo:** CSRF (OWASP A01)  
**Descripción:** No hay tokens CSRF explícitos. La protección depende de que:  
1. Supabase cookies tengan `SameSite=Lax` (bloquea cross-site POST en la mayoría de browsers modernos)  
2. Los endpoints requieran `Content-Type: application/json` (que navegadores no envían en formularios cross-origin sin CORS preflight)  
Esto es aceptable para la mayoría de casos modernos, pero un atacante con XSS puede bypassarlo.  
**Fix:** La protección actual es razonable si SameSite está configurado. Documentar la decisión.
- [ ] Confirmar `SameSite` en cookies de Supabase. Documentar postura CSRF.

---

### B-4: Admin autenticado solo por email — sin rol en base de datos
**Archivo:** `app/(main)/admin/sugerencias/page.tsx`, `app/api/suggestions/[id]/route.ts`  
**Tipo:** Broken Access Control (OWASP A01)  
**Descripción:** El admin se identifica únicamente por comparar `user.email` con `SUPERADMIN_EMAIL` env var. No hay rol de admin en la base de datos. Si el email del admin es comprometido o la env var expuesta, hay riesgo. Además, no escala: no se pueden añadir múltiples admins sin cambiar el código.  
**Fix:** Considerar tabla `admin_roles` en Supabase o `app_metadata.role = 'admin'` en Supabase Auth.
- [ ] Evaluar migración a sistema de roles en Supabase Auth app_metadata.

---

### B-5: Políticas RLS de Supabase no auditadas en este análisis
**Tipo:** Database Security (OWASP A01)  
**Descripción:** Todo el modelo de seguridad asume que RLS está correctamente configurado en Supabase. No se han auditado las políticas RLS de las tablas: `groups`, `group_members`, `friendships`, `match_predictions`, `tournament_predictions`, `push_subscriptions`, `xp_events`, `points_log`, `suggestions`, `join_requests`, `group_invites`, `group_tournament_predictions`.  
**Ataque potencial si RLS falla:** Un usuario podría leer predicciones de otros, modificar puntos, acceder a push subscriptions de otros usuarios.  
**Fix:** Auditar cada tabla RLS.
- [ ] Exportar y revisar todas las políticas RLS desde Supabase Dashboard.
- [ ] Verificar que `push_subscriptions` tenga RLS: solo el propio usuario puede leer sus suscripciones.
- [ ] Verificar que `xp_events` tenga RLS: insert solo via service role, read propio.
- [ ] Verificar que `match_predictions` tenga RLS: read propio, read de grupo solo a miembros.
- [ ] Verificar que `points_log` sea solo-lectura para usuarios normales.

---

### B-6: No hay HSTS preload verificado
**Archivo:** `next.config.ts:49`  
**Tipo:** Transport Security (OWASP A02)  
**Descripción:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` es correcto, pero solo funciona si el dominio está en la lista de preload de HSTS. Para Vercel deployments con dominio personalizado, debe enviarse al HSTS preload list manualmente.  
**Fix:** Verificar que el dominio esté en https://hstspreload.org.
- [ ] Verificar estado en hstspreload.org para el dominio de producción.

---

### B-7: Secreto CRON_SECRET potencialmente débil
**Archivo:** `.env.example:18`  
**Tipo:** Weak Credentials (OWASP A07)  
**Descripción:** El ejemplo sugiere `your-random-secret-string` sin especificar longitud mínima o entropy. Si se usa un secreto débil, los endpoints cron (`/api/cron/update-results`, `/api/cron/send-reminders`, `/api/matches/sync`) podrían ser invocados por atacantes.  
**Impacto:** Invocación arbitraria de update-results podría causar recálculo de puntos con datos manipulados si la API externa fuera comprometida. Invocación de send-reminders podría causar spam de notificaciones.  
**Fix:** Documentar requisito de al menos 32 bytes aleatorios para CRON_SECRET.
- [ ] Actualizar `.env.example` para especificar `openssl rand -base64 32` como método de generación.

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad | Temas principales |
|-----------|----------|-------------------|
| 🔴 Crítico | 2 | Bypass join request, env vars sin validar |
| 🟠 Alto | 7 | IP spoofing RL, no RL en endpoints, info disclosure, CSP unsafe-inline, admin inconsistencia |
| 🟡 Medio | 11 | RL distribuido, límites de recursos, validaciones input, privacy headers |
| 🔵 Bajo | 7 | Crypto bias, cookies, CSRF postura, RLS no auditado, HSTS, secretos |

**Prioridad inmediata (parchear esta semana):**
1. C-1: Bypass join request (`app/join/[code]/page.tsx`)
2. C-2: Env var validation (`lib/supabase/server.ts`)
3. A-1: IP spoofing en rate limit (`app/api/friends/route.ts`)
4. A-4: error.message expuesto (`app/api/groups/[id]/members/[userId]/route.ts`)
5. A-5: CSP unsafe-inline (`next.config.ts`)
6. A-7: Admin email case sensitivity (`app/(main)/admin/sugerencias/page.tsx`)

**Prioridad media (parchear este mes):**
- A-2, A-3: Rate limiting en suggestions y account delete
- M-1: Rate limiting distribuido (Redis)
- B-5: Auditoría completa de políticas RLS

---

## CHECKLIST DE FIXES

- [x] C-1: `app/join/[code]/page.tsx` — join request flow, no insert directo ✅
- [x] C-2: `lib/supabase/server.ts` — validar env vars en startup ✅
- [x] C-2b: `lib/api-football.ts` — validar RAPIDAPI_KEY en startup ✅
- [x] C-2c: `lib/football-data.ts` — validar FOOTBALL_DATA_API_KEY en startup ✅
- [x] A-1: `app/api/friends/route.ts` — usa `getClientIp(req)` del helper ✅
- [x] A-2: `app/api/suggestions/route.ts` — rateLimit 5/10min por user ✅
- [x] A-3: `app/api/account/route.ts` — rateLimit 3/15min en DELETE ✅
- [x] A-4: `app/api/groups/[id]/members/[userId]/route.ts` — mensaje error genérico ✅
- [x] A-5: `middleware.ts` + `next.config.ts` + `app/layout.tsx` — CSP nonce per-request con strict-dynamic ✅
- [ ] A-6: Evaluar política de enumeración de usuarios (decisión de diseño, bajo riesgo)
- [x] A-7: `app/(main)/admin/sugerencias/page.tsx` — toLowerCase() en comparación ✅
- [x] M-2: `app/api/auth/register/route.ts` — máximo 128 chars en password ✅
- [x] M-3: `app/api/auth/register/route.ts` — respuesta mínima `{ id }` en lugar de user completo ✅
- [x] M-4: `app/api/cron/send-reminders/route.ts` — corregir formato .not() query ✅
- [ ] M-5: `app/(public)/add/[userId]/page.tsx` — evaluar datos expuestos (decisión de diseño)
- [x] M-6: `app/api/groups/route.ts` — límite 10 grupos creados por usuario ✅
- [x] M-7: `app/api/groups/join/route.ts` — límite 20 membresías por usuario ✅
- [x] M-8: `app/api/groups/[id]/invite/route.ts` — UUID validation para group_id ✅
- [x] M-9: `lib/football-data.ts` — separar log del throw, no exponer body ✅
- [ ] M-10: connect-src push services — investigación confirma que Push API es browser-native, no sujeta a connect-src. No aplica.
- [x] M-11: `next.config.ts` — X-DNS-Prefetch-Control: off ✅
- [x] B-1: `lib/utils.ts` — rejection sampling elimina modulo bias en generateInviteCode() ✅
- [ ] B-2: Verificar flags de cookies en producción (HttpOnly, Secure, SameSite) — requiere inspección en browser
- [ ] B-3: Supabase SSR gestiona SameSite automáticamente; CSRF cubierto
- [ ] B-4: Evaluar sistema de roles en Supabase Auth (mejora futura)
- [ ] B-5: Auditar todas las políticas RLS en Supabase Dashboard ⚠️ PENDIENTE
- [ ] B-6: Verificar dominio en hstspreload.org — requiere acción externa
- [x] B-7: `.env.example` — instrucciones openssl rand para CRON_SECRET ✅

**Resumen: 19/27 fixes aplicados en código. Pendientes: 6 requieren decisión/acción externa, 2 son decisiones de diseño.**

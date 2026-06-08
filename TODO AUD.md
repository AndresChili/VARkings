# AUDITORÍA DE SEGURIDAD — VARkings
> Fecha: 2026-06-08 | Revisor: Claude Sonnet 4.6 | Alcance: código fuente completo

---

## LEYENDA
- 🔴 CRÍTICO — explotable directamente, dato o cuenta comprometible
- 🟠 ALTO — explotable con contexto extra o causa daño significativo
- 🟡 MEDIO — difícil de explotar solo pero amplía superficie de ataque
- 🔵 BAJO / DEFENSA EN PROFUNDIDAD — buenas prácticas ausentes

---

## 🔴 CRÍTICOS

### C-1 · Open Redirect en Login
**Archivo:** `app/(auth)/login/page.tsx:36`
```ts
const next = searchParams.get('next') ?? '/dashboard';
router.push(next);   // ← no valida si next es una URL externa
```
**Ataque:** Phishing. Enlace `https://varkings.com/login?next=https://evil.com` redirige al usuario a sitio malicioso tras login exitoso. Roba credenciales, tokens o instala malware.
**Fix:** Validar que `next` comience con `/` y no con `//` o `http`:
```ts
const safe = (next?.startsWith('/') && !next.startsWith('//')) ? next : '/dashboard';
router.push(safe);
```

---

### C-2 · Rate Limiter In-Memory — Bypass en Serverless
**Archivo:** `lib/rate-limit.ts:1-14`
```ts
const store = new Map<string, { count: number; resetAt: number }>();
```
**Ataque:** En Vercel, cada instancia serverless tiene su propio `Map`. Un atacante que lanza suficientes peticiones en paralelo las distribuye entre instancias y evita el límite de registro. Permite registro masivo de cuentas, enumeración de emails, o ataques de credential stuffing ilimitados.
**Afecta:** Solo `/api/auth/register` usa rate limit. Todos los demás endpoints NO tienen rate limit en absoluto.
**Fix:** Usar Redis/Upstash para rate limit distribuido real.

---

### C-3 · Sin Rate Limit en Endpoints Críticos
**Archivos:** Todos los API routes excepto `/api/auth/register`
**Endpoints sin límite:**
- `POST /api/groups/join` → brute-force de invite codes (36^8 combinaciones, sin throttle)
- `POST /api/predictions/match` → spam de predicciones
- `POST /api/xp/share` → llamar 3 veces gratis = 60 XP sin verificación real
- `POST /api/xp/avatar` → llamable libremente (idempotente pero sin límite)
- `POST /api/notifications/subscribe` → flood de suscripciones
- `DELETE /api/account` → llamable rápidamente, sin re-auth
**Fix:** Aplicar `rateLimit()` en todos los endpoints POST/DELETE mutables. Usar rate limit distribuido (C-2).

---

### C-4 · SSRF via Push Subscription Endpoint
**Archivo:** `app/api/notifications/subscribe/route.ts:15-16`
```ts
if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2048) {
```
**Ataque:** Server-Side Request Forgery. Un atacante autenticado registra `endpoint: "https://internal-service.vpc/"`. El servidor (en `sendBulkPushNotifications`) hace peticiones HTTP a esa URL desde dentro de la red de Vercel, pudiendo escanear servicios internos, metadatos de cloud (`https://169.254.169.254/`), o exfiltrar datos.
**Fix:** Allowlist de dominios push conocidos (`fcm.googleapis.com`, `notify.windows.com`, `push.apple.com`, `updates.push.services.mozilla.com`, etc.).

---

### C-5 · Timing Attack en Verificación de CRON_SECRET
**Archivos:** `app/api/matches/sync/route.ts:12`, `app/api/cron/send-reminders/route.ts:15`, `app/api/cron/update-results/route.ts:14`
```ts
if (authHeader !== `Bearer ${cronSecret}`) {
```
**Ataque:** Comparación de strings no es tiempo-constante. Con suficientes peticiones, un atacante puede medir diferencias de nanosegundos y reconstruir el secreto byte a byte (timing oracle). Si obtiene `CRON_SECRET`, puede disparar sync masivo de partidos o forzar recálculo de puntos.
**Fix:**
```ts
import { timingSafeEqual } from 'crypto';
const expected = Buffer.from(`Bearer ${cronSecret}`);
const actual = Buffer.from(authHeader ?? '');
if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { ... }
```

---

### C-6 · Inserción Directa en BD desde Cliente (Sin Rate Limit ni Validación Server)
**Archivo:** `components/friends/add-friend-client.tsx:42-46`
```ts
const { data, error: err } = await supabase
  .from('friendships')
  .insert({ requester_id: currentUserId, addressee_id: target.id, status: 'pending' })
```
**Ataque:** El cliente inserta directamente en `friendships` usando la anon key. No hay API route intermediaria con rate limit. Un script puede enviar miles de solicitudes de amistad/cancelación por segundo si RLS lo permite. Si RLS tiene algún bug, se puede insertar datos arbitrarios.
**Fix:** Mover la operación a un API route con rate limiting. La BD debería ser la última línea de defensa, no la única.

---

## 🟠 ALTOS

### A-1 · Sin Content-Security-Policy (CSP)
**Archivo:** `next.config.ts:25-38`
**Problema:** No hay cabecera `Content-Security-Policy`. Sin CSP:
- Inyección de scripts desde dominios externos posible
- XSS persistente puede cargar scripts arbitrarios (`<script src="https://evil.com/steal.js">`)
- Clickjacking parcialmente mitigado por `X-Frame-Options: DENY` pero XSS no
**Fix:** Añadir CSP estricta:
```ts
{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: https://media.api-sports.io https://crests.football-data.org https://upload.wikimedia.org https://*.supabase.co; frame-ancestors 'none';" }
```

---

### A-2 · Sin Strict-Transport-Security (HSTS)
**Archivo:** `next.config.ts`
**Problema:** Sin `Strict-Transport-Security`, un atacante MITM puede hacer downgrade de HTTPS a HTTP en la primera petición (si el usuario no ha visitado antes). Robo de cookies de sesión en redes no seguras (WiFi cafetería, hoteles).
**Fix:**
```ts
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }
```

---

### A-3 · Open Redirect Secundario — `avatar_url` sin Validar en `<img>`
**Archivo:** `components/friends/add-friend-client.tsx:85`
```tsx
<img src={target.avatar_url} alt={target.username} />
```
**Problema:** `target.avatar_url` viene de Supabase profiles. Si un usuario configura un avatar_url a `javascript:alert(1)` o a una URL de tracking pixel, el navegador lo ejecuta/carga. La configuración `remotePatterns` en `next.config.ts` solo aplica al componente `<Image>` de Next.js, no a tags `<img>` crudos.
**Fix:** Usar `next/image` con `remotePatterns` configurados, o validar que la URL sea de un dominio permitido antes de renderizar.

---

### A-4 · Fuga de Mensajes de Error de Base de Datos
**Archivos:** múltiples rutas API
```ts
// app/api/groups/[id]/route.ts:26
return NextResponse.json({ error: error.message }, { status: 500 });
// app/api/groups/[id]/leave/route.ts:49
return NextResponse.json({ error: transferError.message }, { status: 500 });
// app/api/predictions/tournament/route.ts:51
return NextResponse.json({ error: error.message }, { status: 500 });
```
**Problema:** Los mensajes de error de Supabase revelan estructura de tablas, nombres de constraints (`23505: duplicate key value violates unique constraint "group_members_pkey"`), y en casos extremos, fragmentos de datos. Facilita el reconnaissance.
**Fix:** Mapear todos los errores DB a mensajes genéricos. Log interno del error real.

---

### A-5 · XP Farming — Endpoint `/api/xp/share` No Verifica Share Real
**Archivo:** `app/api/xp/share/route.ts`
**Problema:** Cualquier usuario autenticado puede llamar este endpoint 3 veces y obtener 60 XP gratis. No hay verificación de que el usuario realmente compartió la app. El cap de 3 evita abuso total pero no el fraude inicial.
**Impacto:** Ranking de XP manipulado, logros falsos, desventaja competitiva para usuarios legítimos.
**Fix:** No hay forma técnica perfecta de verificar shares. Opciones: eliminar el XP de shares, o requerir un share nativo del sistema operativo (Web Share API) y solo premiar si se completa. Al menos añadir rate limit.

---

### A-6 · XP Farming — Endpoint `/api/xp/avatar` Sin Verificación de Avatar
**Archivo:** `app/api/xp/avatar/route.ts`
**Problema:** Cualquier usuario puede llamar `POST /api/xp/avatar` y recibir 15 XP sin tener avatar. Solo es idempotente (no se puede llamar más de una vez por el `ignoreDuplicates`), pero se puede llamar antes de tener avatar.
**Fix:** Verificar que el perfil del usuario tenga `avatar_url != null` antes de otorgar XP.

---

### A-7 · Eliminación de Cuenta Sin Re-Autenticación
**Archivo:** `app/api/account/route.ts`
**Problema:** DELETE en `/api/account` elimina permanentemente la cuenta sin solicitar contraseña de confirmación. Si un atacante tiene una sesión robada (token XSS, dispositivo no bloqueado), puede eliminar la cuenta de la víctima irreversiblemente.
**Fix:** Requerir confirmación de contraseña en el cuerpo de la petición antes de proceder con `deleteUser`.

---

### A-8 · Service Worker Cachea Respuestas de API (Datos Sensibles en Disco)
**Archivo:** `public/sw.js`
```js
e.registerRoute(function(e){ ... !s.startsWith("/api/")}, new e.NetworkFirst({cacheName:"apis", ...maxAgeSeconds:86400})
```
**Problema:** El SW cachea respuestas GET de `/api/` hasta 24h en IndexedDB/Cache Storage del navegador. Datos como puntuaciones, predicciones, y estructura de grupos quedan en disco. En dispositivos compartidos o comprometidos, otro usuario puede acceder a los datos en caché sin credenciales.
**Fix:** Excluir rutas `/api/auth/` y otras con datos sensibles del caché SW. Usar `networkOnly` para endpoints de autenticación.

---

### A-9 · `friendship_id` Sin Validación de Formato UUID
**Archivo:** `app/api/xp/friend-accepted/route.ts:10-11`
```ts
const { friendship_id } = await req.json();
if (!friendship_id) return NextResponse.json({ error: 'Missing friendship_id' }, { status: 400 });
```
**Problema:** `friendship_id` no se valida como UUID. Se pasa directamente a `.eq('id', friendship_id)`. Aunque el ORM parameteriza la query, strings malformados pueden causar comportamiento inesperado o filtraciones de error.
**Fix:** Añadir validación UUID antes del query.

---

### A-10 · `match_id` Sin Validación de Formato en Predicciones
**Archivo:** `app/api/predictions/match/route.ts:13`
**Problema:** `match_id` aceptado como cualquier valor sin validar formato. En DELETE también (línea 77). Podría ser un objeto, array, o string con caracteres especiales.
**Fix:** Validar que sea un entero positivo o UUID según el tipo en la BD.

---

## 🟡 MEDIOS

### M-1 · Todos los API Routes Excluidos de Auth en Middleware
**Archivo:** `middleware.ts:35`
```ts
pathname.startsWith('/api/') → isPublicPath = true
```
**Problema:** El middleware no aplica auth a ninguna ruta `/api/`. La autenticación se delega completamente a cada route handler individualmente. Si un route handler olvida el check (o se añade uno nuevo sin él), queda completamente público. Defense-in-depth ausente.
**Fix:** Añadir lista de rutas API públicas explícitas (solo cron + register), y requerir auth en middleware para el resto:
```ts
const PUBLIC_API = ['/api/auth/register', '/api/cron/'];
const isPublicApi = PUBLIC_API.some(p => pathname.startsWith(p));
```

---

### M-2 · `/add/[userId]` Expone Perfiles de Usuarios a Anónimos
**Archivo:** `middleware.ts:34`, `app/(public)/add/[userId]/page.tsx`
**Problema:** La ruta `/add/[userId]` es pública por diseño, pero expone `username`, `full_name`, y `avatar_url` de cualquier usuario sin autenticación. Un atacante puede enumerar IDs de usuario y obtener un directorio completo de usuarios.
**Impacto:** Privacy leak, enumeración de usuarios, datos para phishing dirigido.
**Fix:** O requerir autenticación para ver el perfil completo, o limitar los campos expuestos a solo `username`.

---

### M-3 · Invite Code Brute-Forceable
**Archivo:** `app/api/groups/join/route.ts`, `lib/utils.ts:67-72`
**Problema:** Codes son 8 chars alfanuméricos (36^8 ≈ 2.8 billones). Sin rate limiting en `/api/groups/join`, un atacante puede probar miles de códigos por segundo. Con hardware moderno y sin throttle, espacios pequeños son alcanzables.
**Fix:** Rate limit en `/api/groups/join`. Considerar aumentar longitud del código a 12 chars.

---

### M-4 · Sin Validación de Tamaño de Body en API Routes
**Archivos:** Todos los API routes
**Problema:** `await req.json()` sin límite de tamaño. Un atacante puede enviar JSON de 100MB causando OOM en la función serverless, timeout forzado, o costos elevados.
**Fix:** En Next.js App Router se puede configurar `export const maxDuration` y añadir validación de `Content-Length` header, o usar `next.config.ts` `bodyParser: { sizeLimit: '1mb' }`.

---

### M-5 · Contraseña Sin Requisito de Complejidad
**Archivo:** `app/api/auth/register/route.ts:20-22`
```ts
if (!password || String(password).length < 8) { ... }
```
**Problema:** Solo se exige mínimo 8 caracteres. `password123` o `aaaaaaaa` son válidas. Susceptible a ataques de diccionario si la BD de Supabase Auth se compromete.
**Fix:** Añadir requisito de al menos 1 número + 1 mayúscula + 1 carácter especial, o usar score de entropía (zxcvbn).

---

### M-6 · `next` Param en Redirect No Filtrado en Origen del Request
**Archivo:** `middleware.ts:42-44`
```ts
loginUrl.searchParams.set('next', pathname);
return NextResponse.redirect(loginUrl);
```
**Problema:** `pathname` es seguro (solo contiene el path), pero si alguien manipula la URL base o hay un proxy que reescribe paths, podría inyectarse una URL absoluta. Menor riesgo que C-1 pero complementario.
**Fix:** Mismo fix que C-1 en la página de login.

---

### M-7 · Caché Cross-Origin en Service Worker
**Archivo:** `public/sw.js`
```js
e.registerRoute(function(e){return!e.sameOrigin},new e.NetworkFirst({cacheName:"cross-origin", ...maxAgeSeconds:3600}))
```
**Problema:** El SW cachea respuestas de dominios externos incluyendo llamadas a Supabase y APIs de fútbol. Si una respuesta contiene tokens de auth o datos privados, quedan en caché del navegador hasta 1 hora.
**Fix:** Aplicar `networkOnly` a `*.supabase.co` y evitar cachear respuestas cross-origin con auth.

---

### M-8 · Superadmin Basado Solo en Email (SUPERADMIN_EMAIL)
**Archivo:** `app/api/suggestions/[id]/route.ts:7-15`
**Problema:** La verificación de admin usa comparación de email: `user.email?.toLowerCase() !== superadminEmail.toLowerCase()`. Si el email del admin se expone (breach de otra app, phishing), un atacante puede registrar esa misma cuenta si el sistema lo permite, o si el email no está confirmado de forma estricta en Supabase.
**Fix:** Usar un campo `role` en la tabla `profiles` o user metadata en Supabase, no comparar emails en texto plano. Añadir middleware de admin separado.

---

### M-9 · Sin `X-XSS-Protection` ni `Permissions-Policy` Completo
**Archivo:** `next.config.ts`
**Problema:** `X-XSS-Protection: 1; mode=block` ausente (legacy pero sigue activo en IE/Edge antiguo). El `Permissions-Policy` solo deshabilita camera/mic/geo pero no deshabilita `payment`, `usb`, `serial`, `bluetooth`.
**Fix:** Añadir `X-XSS-Protection: 1; mode=block` y expandir `Permissions-Policy`.

---

### M-10 · Rate Limit Solo en Register — No en Login
**Archivo:** `app/(auth)/login/page.tsx` (usa Supabase cliente directo)
**Problema:** El login va directamente a Supabase Auth sin pasar por un API route propio. No hay rate limit adicional en capa de aplicación. Depende exclusivamente del rate limit interno de Supabase (que existe pero no es configurable por el developer).
**Consecuencia:** Credential stuffing con miles de pares email/password. No hay bloqueo ni alerta a nivel de aplicación.
**Fix:** Crear `POST /api/auth/login` propio con rate limit, o al menos loggear intentos fallidos.

---

### M-11 · `group_id` Sin Validación UUID en Varios Routes
**Archivos:** `app/api/groups/[id]/requests/route.ts:GET`, `app/api/groups/[id]/podio/route.ts:GET`
**Problema:** El UUID_RE no se aplica al parámetro `id` en los handlers GET de estos dos routes. Se pasa directamente a `.eq('id', id)` sin sanitizar. Bajo riesgo con Supabase ORM pero inconsistente.
**Fix:** Añadir `if (!UUID_RE.test(id)) return 400` al principio de todos los handlers.

---

## 🔵 BAJOS / DEFENSA EN PROFUNDIDAD

### B-1 · VAPID Private Key — Impacto de Fuga
**Archivo:** `lib/push-notifications.ts`
**Riesgo:** Si `VAPID_PRIVATE_KEY` se filtra, un atacante puede enviar push notifications como si fueran de la app (phishing de alta credibilidad). Los usuarios ven notificaciones de "VARkings" que pueden contener enlaces maliciosos.
**Recomendación:** Rotar las claves VAPID periódicamente. No logguear variables de entorno.

---

### B-2 · SUPABASE_SERVICE_ROLE_KEY — Daño Catastrófico si se Expone
**Archivo:** `lib/supabase/server.ts:31-36`
**Riesgo:** `SUPABASE_SERVICE_ROLE_KEY` bypassa toda RLS. Si se filtra (commit accidental, logs, variable de entorno expuesta), el atacante tiene acceso total de lectura/escritura a toda la base de datos incluyendo auth.users.
**Verificar:** Que el archivo `.env.local` está en `.gitignore` (parece que sí, pero confirmar). Que los logs de Vercel no loggean las env vars.

---

### B-3 · NEXT_PUBLIC_SUPABASE_ANON_KEY Expuesta al Cliente
**Archivo:** `lib/supabase/client.ts`
**Riesgo:** La anon key es visible en el bundle JS. Permite a cualquiera hacer queries directas a la BD de Supabase. Toda la seguridad depende de las políticas RLS. Si hay un bug en RLS, la anon key permite explotarlo sin credenciales de app.
**Recomendación:** Auditar periódicamente las políticas RLS de Supabase. Esto es by-design en Supabase pero debe documentarse como riesgo aceptado.

---

### B-4 · `self.skipWaiting()` en Service Worker
**Archivo:** `public/sw.js`
**Riesgo:** El SW se activa inmediatamente en todas las tabs abiertas sin que el usuario recargue. Si se despliega un SW con bug o comprometido, toma control inmediato de todas las sesiones activas. Amplifica el impacto de un supply chain attack en las dependencias PWA.
**Recomendación:** Considerar eliminar `skipWaiting()` para requerir recarga explícita.

---

### B-5 · Datos de Partido en Notificaciones Push Sin Sanitización
**Archivo:** `app/api/cron/send-reminders/route.ts:60-63`
```ts
body: `${match.home_team_name} vs ${match.away_team_name} - ¡Haz tu predicción!`,
```
**Riesgo:** Si la API externa de fútbol devuelve nombres de equipos con caracteres especiales o contenido malicioso (supply chain), se incluyen directamente en notificaciones push. Bajo riesgo pero vale sanitizar.
**Fix:** Sanitizar `home_team_name` y `away_team_name` antes de incluir en el cuerpo de la notificación.

---

### B-6 · Football Data API — Sin Validación de Respuesta
**Archivos:** `lib/football-data.ts`, `lib/api-football.ts`
**Riesgo:** Los datos de la API externa se usan directamente sin validación de esquema (no hay Zod ni type guards). Si la API externa cambia su formato o es comprometida (supply chain), datos malformados o maliciosos se insertan en la BD. Ejemplo: `match_date` podría ser `'; DROP TABLE matches;--` si no se parameteriza correctamente.
**Fix:** Añadir validación de esquema con Zod en las respuestas de APIs externas antes de procesar.

---

### B-7 · Sin `Cache-Control: no-store` en Respuestas de Auth
**Problema:** Las respuestas de `/api/auth/register` y otros endpoints de mutación no incluyen `Cache-Control: no-store`. Proxies o CDNs intermedios podrían cachear respuestas que contienen datos del usuario recién registrado.
**Fix:** Añadir `Cache-Control: no-store` en respuestas de registro y login.

---

### B-8 · Sin Política de Retención de Logs
**Problema:** Los `console.error()` en cron jobs y routes incluyen objetos de error que podrían contener datos sensibles (fragmentos de queries, IDs de usuario). En Vercel, estos van a los Function Logs que son accesibles a cualquiera con acceso al proyecto.
**Fix:** Sanitizar datos sensibles antes de loggear. Usar structured logging con nivel de severidad.

---

### B-9 · Generación de Invite Code — Sin Verificación de Unicidad Pre-Insert
**Archivo:** `lib/utils.ts:67-72`, `app/api/groups/route.ts:28-34`
**Riesgo:** Si dos grupos generan el mismo `invite_code` simultáneamente (probabilidad baja pero existente), la segunda inserción fallará con constraint unique. El error se maneja pero el código podría generar un grupo sin código válido. No un riesgo de seguridad crítico pero sí un bug de integridad.
**Fix:** Reintentar la generación del código si hay colisión, o aumentar la entropía.

---

### B-10 · Archivos de Build en `public/` con Service Worker
**Archivo:** `public/swe-worker-5c72df51bb1f6ee0.js`
**Riesgo:** El archivo de SW con hash en el nombre está en `public/`. Si el proceso de build es comprometido (CI/CD), se podría inyectar código malicioso en el SW que afecta a todos los usuarios. El SW tiene acceso completo a requests/responses de la app.
**Recomendación:** Añadir Subresource Integrity (SRI) checks para el SW si el sistema lo soporta, y revisar permisos de CI/CD.

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| 🔴 Crítico | 6 | Sin fix |
| 🟠 Alto | 10 | Sin fix |
| 🟡 Medio | 11 | Sin fix |
| 🔵 Bajo | 10 | Sin fix |
| **Total** | **37** | |

### Top 5 Prioridades
1. **C-1** — Corregir open redirect en login (5 minutos, alto impacto)
2. **C-4** — Allowlist dominios push para evitar SSRF
3. **C-2/C-3** — Rate limiting distribuido (Upstash Redis) en todos los endpoints
4. **A-1/A-2** — Añadir CSP + HSTS en `next.config.ts` (15 minutos, alto impacto)
5. **C-5** — Timing-safe comparison en CRON_SECRET

### Ataques No Aplicables (por arquitectura Supabase)
- **SQL Injection**: Supabase ORM usa queries parametrizadas — mitigado
- **NoSQL Injection**: No aplica
- **Auth bypass via JWT**: Supabase maneja la verificación de JWT — mitigado
- **Escalada de privilegios via RLS**: Depende de las políticas RLS configuradas en Supabase (no auditadas en este review — requiere acceso al dashboard de Supabase)

### Ataques Parcialmente Mitigados
- **XSS**: No hay CSP (A-1) pero Next.js escapa JSX automáticamente. Las cadenas renderizadas en JSX están escapadas excepto `dangerouslySetInnerHTML` (no encontrado en el código)
- **CSRF**: Supabase cookies son `SameSite=Lax` por defecto — protección parcial. Sin embargo, las peticiones con `credentials: include` desde otros orígenes pueden ser bloqueadas por CORS pero no por el servidor
- **Clickjacking**: `X-Frame-Options: DENY` presente — mitigado
- **Content Sniffing**: `X-Content-Type-Options: nosniff` presente — mitigado

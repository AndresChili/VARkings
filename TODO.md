# VARkings — Auditoría de Seguridad
_Fecha: 2026-06-08_

---

## 🔴 CRÍTICO

### C1 — Sin headers de seguridad HTTP (`next.config.ts`)
**Archivo:** `next.config.ts`  
**Ataque:** XSS, Clickjacking, MIME sniffing, información de referrer  
**Problema:** No hay `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security` ni `Permissions-Policy`.  
**Fix:** Añadir bloque `headers()` en `next.config.ts`:
```ts
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
  ],
}]
```

---

### C2 — Todas las rutas `/api/*` sin auth en middleware (`middleware.ts:35`)
**Archivo:** `middleware.ts:35`  
**Ataque:** Si cualquier ruta olvida verificar auth, queda pública sin red de seguridad  
**Problema:** `pathname.startsWith('/api/')` está en `isPublicPath` → el middleware nunca redirige ninguna ruta API. Un fallo de auth en cualquier endpoint = acceso público total.  
**Fix:** Eliminar `/api/` de `isPublicPath`. Las rutas que necesiten ser públicas deben manejarlo internamente. Como alternativa: solo eximir las rutas que realmente son públicas (crons, etc. ya tienen su propio secret).

---

### C3 — Código de invitación generado con `Math.random()` (`lib/utils.ts:68`)
**Archivo:** `lib/utils.ts:68-69`  
**Ataque:** Brute-force / predicción de invite codes  
**Problema:** `Math.random()` no es criptográficamente seguro (CSPRNG). Un atacante puede predecir o forzar códigos. 8 chars de 36 = ~41 bits teóricos, pero mucho menos con Math.random().  
**Fix:**
```ts
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join('');
}
```

---

### C4 — Error internos filtrados en respuesta API (múltiples rutas)
**Archivos:**
- `app/api/cron/send-reminders/route.ts:71`
- `app/api/cron/update-results/route.ts:97`
- `app/api/matches/sync/route.ts:51`

**Ataque:** Information disclosure — stack traces, nombres de tablas, cadenas de conexión  
**Problema:** `return NextResponse.json({ error: String(error) }, { status: 500 })` expone el mensaje de error interno al cliente.  
**Fix:**
```ts
// En catch:
console.error('Error:', error);
return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
```

---

### C5 — Inyección de URL en endpoint de push subscriptions (`app/api/notifications/subscribe/route.ts:12`)
**Archivo:** `app/api/notifications/subscribe/route.ts:12-22`  
**Ataque:** SSRF (Server-Side Request Forgery) potencial, almacenamiento de URLs arbitrarias  
**Problema:** `subscription.endpoint` se almacena sin validar que sea una URL HTTPS válida de un servidor push conocido. Si el servidor alguna vez hace fetch a ese endpoint (ej. debug), puede ser dirigido a servicios internos.  
**Fix:**
```ts
const endpoint = subscription.endpoint;
if (!endpoint || !endpoint.startsWith('https://')) {
  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
}
// Opcionalmente: validar que sea de FCM/APNS/Mozilla push service
```

---

## 🟠 ALTO

### A1 — Rate limiter no distribuido, fácilmente bypasseable (`lib/rate-limit.ts`)
**Archivo:** `lib/rate-limit.ts:1`  
**Ataque:** Brute-force de registro, credential stuffing  
**Problema:** El rate limiter usa un `Map` en memoria. En entorno serverless (Vercel), cada instancia tiene su propia memoria — un atacante con N instancias disponibles puede hacer N×max peticiones. El límite efectivo es multiplicado por el número de instancias.  
**Fix:** Usar Redis/Upstash para rate limiting distribuido:
```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, "15 m") });
```

---

### A2 — IP spoofing en rate limit de registro (`app/api/auth/register/route.ts:9`)
**Archivo:** `app/api/auth/register/route.ts:9`  
**Ataque:** Bypass de rate limit por IP  
**Problema:** `x-forwarded-for` puede ser falsificado por el cliente (excepto si hay un proxy de confianza antes). En Vercel esto está parcialmente mitigado, pero el primer valor de la cadena puede ser inyectado por el atacante (`X-Forwarded-For: 1.2.3.4, real-ip`).  
**Fix:** Usar la última IP de la cadena (la añadida por el proxy de confianza) o `req.ip` de Next.js 15.

---

### A3 — Sin validación UUID en múltiples rutas con parámetros de ruta
**Archivos:**
- `app/api/groups/[id]/route.ts` — param `id`
- `app/api/groups/[id]/leave/route.ts` — param `id`
- `app/api/groups/[id]/members/[userId]/route.ts` — params `id`, `userId`
- `app/api/groups/[id]/invite/respond/route.ts` — params `id`, `invite_id` en body
- `app/api/groups/[id]/transfer-admin/route.ts` — param `id`, body `new_admin_id`
- `app/api/suggestions/[id]/route.ts` — param `id`

**Ataque:** Error 500 leaking DB errors, DoS por queries malformadas  
**Problema:** Supabase lanza un error 400 ("invalid input syntax for type uuid") cuando recibe un UUID inválido, que puede filtrar información o causar comportamiento inesperado.  
**Fix:** Añadir validación al inicio de cada handler:
```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
```

---

### A4 — Sin validación de datos en predicciones de torneo (mass assignment)
**Archivos:**
- `app/api/predictions/tournament/route.ts:19-43`
- `app/api/predictions/groups/route.ts:51-55`

**Ataque:** Mass assignment, inserción de datos arbitrarios en columnas JSONB  
**Problema:** `champion`, `runner_up`, `third_place` se insertan directamente sin validar que sean nombres de equipos válidos, UUIDs de equipos existentes, etc. `group_predictions` es JSONB sin esquema validado — cualquier JSON puede ser almacenado.  
**Fix:** Validar que `champion`/`runner_up`/`third_place` sean strings no vacíos de longitud razonable. Validar estructura de `group_predictions` contra un schema conocido (ej. `{ [groupId: string]: [string, string] }`).

---

### A5 — TOCTOU en límite de XP de shares (`app/api/xp/share/route.ts`)
**Archivo:** `app/api/xp/share/route.ts:14-26`  
**Ataque:** Race condition para obtener XP ilimitado  
**Problema:** Flujo: (1) leer count, (2) comprobar si ≥ 3, (3) insertar. Si se hacen múltiples peticiones concurrentes, todas leen count=0, todas pasan el check, y todas insertan → usuario obtiene más de 3 shares de XP.  
**Fix:** Usar constraint único en DB (`UNIQUE(user_id, source_type, source_id)`) + manejar el error de duplicado en la inserción. O usar una transacción con `SELECT FOR UPDATE`.

---

### A6 — Eliminación de cuenta sin CSRF ni confirmación server-side (`app/api/account/route.ts`)
**Archivo:** `app/api/account/route.ts`  
**Ataque:** CSRF — un sitio malicioso puede enviar DELETE /api/account si la víctima tiene sesión activa  
**Problema:** Next.js App Router no implementa CSRF protection automáticamente para API routes con cookies. Un sitio externo puede hacer un fetch con `credentials: 'include'` en algunos navegadores.  
**Fix:** Verificar el header `Origin` contra el dominio permitido, o requerir un token de confirmación en el body.

---

### A7 — Sin validación de longitud en nombre/descripción de grupo (`app/api/groups/route.ts:18`)
**Archivo:** `app/api/groups/route.ts:18`  
**Ataque:** DoS por strings gigantes, DB storage abuse  
**Problema:** Solo se comprueba que `name.trim()` no esté vacío. No hay límite de longitud. Un usuario puede enviar nombres de 1MB+.  
**Fix:**
```ts
if (name.trim().length > 50) return NextResponse.json({ error: 'Nombre máx 50 caracteres' }, { status: 400 });
if (description && description.trim().length > 500) return NextResponse.json({ error: 'Descripción máx 500 caracteres' }, { status: 400 });
```

---

### A8 — XP manipulation: avatar y share sin verificación real
**Archivos:**
- `app/api/xp/avatar/route.ts` — otorga XP por "subir avatar" sin verificar que el avatar exista en storage
- `app/api/xp/share/route.ts` — otorga XP por "compartir" sin verificar ninguna acción real

**Ataque:** XP farming  
**Problema:** Cualquier usuario autenticado puede llamar a `POST /api/xp/avatar` repetidamente (es idempotente, pero la llamada puede ser automatizada). Para share, la restricción de 3 es bypasseable con race condition (ver A5).  
**Fix:** Para avatar: verificar en Supabase Storage que el usuario tenga un archivo de avatar antes de otorgar XP. Para share: mover la lógica de idempotencia a la DB con constraint.

---

## 🟡 MEDIO

### M1 — `group_id` del URL no verificado contra `invite.group_id` en respond (`app/api/groups/[id]/invite/respond/route.ts`)
**Archivo:** `app/api/groups/[id]/invite/respond/route.ts:4-19`  
**Ataque:** Confusión de parámetros  
**Problema:** El handler extrae `group_id` del parámetro de ruta pero no lo usa — la lógica usa `invite.group_id` del DB. No es crítico porque el invite se valida por `invitee_id`, pero el parámetro de ruta `id` es ignorado completamente.  
**Fix:** Añadir verificación: `if (invite.group_id !== group_id) return 403`.

---

### M2 — Error de duplicado verificado por string match frágil (`app/api/groups/[id]/requests/route.ts:82`)
**Archivo:** `app/api/groups/[id]/requests/route.ts:82`  
**Ataque:** Silent failure si Supabase cambia mensaje de error  
**Problema:** `if (memberError && !memberError.message.includes('duplicate'))` — depende de que el mensaje de error de Supabase contenga la palabra "duplicate". Si el mensaje cambia, todos los inserts de miembros duplicados retornarán error 500.  
**Fix:** Verificar `memberError.code === '23505'` (PostgreSQL unique violation code).

---

### M3 — `isTournamentLocked()` usa fecha hardcodeada en código cliente (`lib/utils.ts:88`)
**Archivo:** `lib/utils.ts:88`  
**Ataque:** Bypass de lock de predicciones manipulando reloj del cliente  
**Problema:** `TOURNAMENT_LOCK_DATE` está en `lib/utils.ts` que se importa tanto en cliente como en servidor. En el servidor es fiable, pero en el cliente la fecha puede ser manipulada si se usa para ocultar UI (aunque la lógica de negocio en la API es correcta).  
**Fix:** Ya está correctamente validado en la API (server-side). Asegurarse de no usarlo como única barrera en el cliente.

---

### M4 — Invite code susceptible a enumeración por timing (`app/api/groups/join/route.ts:22`)
**Archivo:** `app/api/groups/join/route.ts:22`  
**Ataque:** Timing oracle para adivinar códigos válidos  
**Problema:** La respuesta "código inválido" vs "ya eres miembro" tiene diferente timing (una hace más queries). No es crítico, pero combinado con el weak CSPRNG de C3 facilita ataques.  
**Fix:** Corregir C3 (crypto.getRandomValues) hace este punto irrelevante en la práctica.

---

### M5 — `SUPERADMIN_EMAIL` como mecanismo de admin (`app/api/suggestions/[id]/route.ts:5`)
**Archivo:** `app/api/suggestions/[id]/route.ts:5-13`  
**Ataque:** Escalada de privilegios si email cambia o variable de entorno se filtra  
**Problema:** El admin se identifica exclusivamente por comparar `user.email` con `process.env.SUPERADMIN_EMAIL`. Si el email es cambiado en Supabase Auth, el admin pierde acceso. Si la variable se filtra, un atacante puede registrarse con ese email (si Supabase lo permite) y obtener acceso admin.  
**Fix:** Usar un campo `role` en la tabla `profiles` (ej. `role: 'admin'`) con RLS que solo el service role puede modificar. Más robusto que email matching.

---

### M6 — Push subscription sin rate limiting (`app/api/notifications/subscribe/route.ts`)
**Archivo:** `app/api/notifications/subscribe/route.ts`  
**Ataque:** Spam de suscripciones, abuso de tabla `push_subscriptions`  
**Problema:** Un usuario autenticado puede llamar al endpoint infinitas veces. Aunque hay `onConflict: 'user_id'` (upsert), puede generar carga innecesaria en DB.  
**Fix:** Añadir rate limiting básico.

---

### M7 — `require('web-push')` dinámico sin manejo de error (`lib/push-notifications.ts:6`)
**Archivo:** `lib/push-notifications.ts:6`  
**Ataque:** Silent failure si el módulo no está disponible  
**Problema:** `const webpush = require('web-push')` dentro de función — si el módulo falla al cargar, lanza excepción no controlada que burbujea como 500.  
**Fix:** Convertir a `import webpush from 'web-push'` estático en la parte superior del archivo.

---

### M8 — No se verifica que `friendship` esté en estado `accepted` antes de dar XP (`app/api/xp/friend-accepted/route.ts`)
**Archivo:** `app/api/xp/friend-accepted/route.ts:15-32`  
**Ataque:** XP farming — llamar al endpoint con cualquier friendship_id (incluso rechazados/pendientes)  
**Problema:** Solo se verifica que el usuario sea parte de la amistad, pero no que el estado sea `accepted`. Un usuario puede llamar al endpoint con una solicitud pendiente y obtener XP de amistad sin que nadie la haya aceptado.  
**Fix:**
```ts
const { data: friendship } = await admin
  .from('friendships')
  .select('requester_id, addressee_id, status')  // añadir status
  .eq('id', friendship_id)
  .eq('status', 'accepted')  // verificar estado
  .single();
```

---

## 🟢 BAJO

### B1 — `x-forwarded-for` usado sin validación en otros endpoints futuros
**Problema:** El patrón de leer `x-forwarded-for` para rate limiting solo está en register. Si se añaden más endpoints con rate limiting, heredarán el mismo problema de IP spoofing (ver A2).  
**Fix:** Centralizar la obtención de IP en una función helper que use la IP correcta según el entorno.

---

### B2 — VAPID email expuesto como variable de entorno no secreta
**Archivo:** `lib/push-notifications.ts:7`  
**Problema:** `process.env.VAPID_EMAIL` — el email de VAPID es semipúblico por diseño, pero si coincide con el email del admin, podría facilitar ataques de ingeniería social.  
**Fix:** Usar un email específico para VAPID (ej. `vapid@varkings.com`), no el email personal del admin.

---

### B3 — Sin paginación ni límite en queries de grupos/requests
**Archivos:** `app/api/groups/[id]/requests/route.ts:29-33`  
**Ataque:** DoS — si un grupo tiene miles de solicitudes pendientes, la query devuelve todas  
**Problema:** `.select(...).eq('group_id', id).eq('status', 'pending')` sin `.limit()`.  
**Fix:** Añadir `.limit(100)` o paginación.

---

### B4 — `app/api/groups/[id]/podio/route.ts` GET no verifica membresía del grupo
**Archivo:** `app/api/groups/[id]/podio/route.ts:5-18`  
**Ataque:** Information disclosure — cualquier usuario autenticado puede ver las predicciones de torneo de otro usuario en cualquier grupo  
**Problema:** Solo verifica `user.id` para la predicción del usuario en ese grupo, pero no verifica que el usuario sea miembro del grupo que está consultando. (Aunque los datos son los del propio usuario, no de otros.)  
**Nota:** Bajo impacto porque solo expone datos del propio usuario, pero es un fallo de consistencia.

---

### B5 — Tokens de Supabase en cookies sin `SameSite=Strict`
**Archivo:** `middleware.ts` / `lib/supabase/server.ts`  
**Problema:** Las cookies de sesión de Supabase SSR usan por defecto `SameSite=Lax`. Para una app de quinielas, `Strict` sería más seguro y no afectaría UX.  
**Fix:** En el `setAll` de cookies, añadir `options: { ...options, sameSite: 'strict' }`.

---

## 📋 RESUMEN EJECUTIVO

| Severidad | Cantidad | Más urgente |
|-----------|----------|-------------|
| 🔴 Crítico | 5 | C1 (sin headers HTTP), C3 (Math.random invite), C4 (error leaking) |
| 🟠 Alto    | 8 | A1 (rate limit distribuido), A5 (TOCTOU XP), A6 (CSRF delete account) |
| 🟡 Medio   | 8 | M5 (admin por email), M8 (XP sin verificar friendship accepted) |
| 🟢 Bajo    | 5 | B3 (sin paginación), B5 (SameSite cookies) |

**Prioridad inmediata:** C1 → C3 → A6 → A5 → A1

**Fortalezas detectadas:**
- Auth verificado correctamente en todas las rutas con `supabase.auth.getUser()` (no JWT decode manual)
- Cron endpoints protegidos con `CRON_SECRET`
- UUID validado en varios endpoints (invite, requests POST)
- Supabase RLS como capa extra de defensa
- Predictions verifican que el partido no haya empezado desde el servidor
- Admin transfers verifican que el nuevo admin sea miembro del grupo

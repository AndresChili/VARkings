# Auditoría de Seguridad — VARkings
Fecha: 2026-06-08 | Auditor: Claude Sonnet 4.6

---

## CRÍTICO

### [C-1] ✅ Clave de servicio de Supabase hardcodeada en el repositorio
- **Archivo:** `scripts/seed-wc2026.ts`
- **Fix aplicado:** Reemplazado con `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.SUPABASE_SERVICE_ROLE_KEY`
- **ACCIÓN MANUAL PENDIENTE:**
  1. **Rotar la clave YA** en Supabase Dashboard → Settings → API → Regenerate service_role key
  2. Verificar si está en historial git: `git log --all -S "sb_secret"` — si aparece, la clave sigue comprometida aunque el código esté limpio
  3. Si está en historial: usar `BFG Repo-Cleaner` o `git filter-repo --replace-text` para purgar

---

## ALTO

### [A-1] ✅ Rate limiter en memoria — no funciona en entornos multi-instancia
- **Archivo:** `lib/rate-limit.ts`
- **Fix aplicado:**
  - Instalado `@upstash/ratelimit` + `@upstash/redis`
  - `rateLimit()` ahora es async y usa Upstash Redis si env vars están configuradas
  - Fallback automático a in-memory si no están (desarrollo / instancia única)
  - Añadida limpieza periódica del Map para evitar memory leaks
  - Todos los callers actualizados con `await`
- **ACCIÓN MANUAL PENDIENTE (para activar Upstash en producción):**
  1. Crear cuenta en https://upstash.com (tier gratuito disponible)
  2. Crear una base de datos Redis
  3. Añadir a Vercel (o `.env.local`):
     - `UPSTASH_REDIS_REST_URL`
     - `UPSTASH_REDIS_REST_TOKEN`

### [A-2] ✅ Acceso superadmin sin rate limit
- **Archivo:** `app/api/suggestions/[id]/route.ts`
- **Fix aplicado:** Añadido rate limit de 30 peticiones / 5 minutos por IP en la función `guard()`

### [A-3] ✅ Patrón SQL inseguro en cron de recordatorios
- **Archivo:** `app/api/cron/send-reminders/route.ts`
- **Fix aplicado:** Eliminada la construcción manual de string SQL. Ahora se obtienen todas las suscripciones y se filtra en JavaScript con `.filter(s => !predictedIds.includes(s.user_id))`

---

## MEDIO

### [M-1] ✅ Sin validación de tipo MIME en upload de avatares
- **Archivo:** `components/profile/profile-client.tsx`
- **Fix aplicado:** Añadida verificación de `file.type` contra lista blanca (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) antes de procesar la imagen

### [M-2] ✅ Error de clave duplicada identificado por string frágil
- **Archivo:** `app/api/groups/[id]/invite/respond/route.ts`
- **Fix aplicado:** Reemplazado `joinError.message.includes('duplicate')` por `joinError.code !== '23505'` (código PostgreSQL exacto para `unique_violation`)

### [M-3] ✅ Desincronización de nombre de variable de entorno
- **Archivo:** `.env.example`
- **Fix aplicado:** Reemplazado `FOOTBALL_DATA_API_KEY` por `RAPIDAPI_KEY`, que es lo que el código realmente lee en `lib/api-football.ts`. Añadidas también `SUPERADMIN_EMAIL` y las vars de Upstash que faltaban.

### [M-4] Sin protección CSRF explícita
- **Estado:** Aceptado — mitigado por SameSite=Lax cookies (Supabase default). Riesgo bajo para PWA autenticada.

---

## BAJO

### [B-1] ✅ Sin límite de tamaño para payloads en sugerencias
- **Archivo:** `app/api/suggestions/route.ts`
- **Fix aplicado:** Añadida verificación de `Content-Length` header — rechaza payloads > 10 KB con HTTP 413

### [B-2] ✅ URL de Supabase hardcodeada en seed script
- **Archivo:** `scripts/seed-wc2026.ts`
- **Fix aplicado:** Resuelto junto con C-1 — usa `process.env.NEXT_PUBLIC_SUPABASE_URL`

### [B-3] Console.error expone stack traces
- **Estado:** Aceptado — logs visibles solo en Vercel dashboard. Si se añade Sentry u otro servicio externo, revisar sanitización de datos de usuario.

---

## VULNERABILIDADES DE DEPENDENCIAS

### [D-1] postcss < 8.5.10 (Moderate — XSS en CSS stringify)
- **Contexto:** Introducido por `next` (versión actual). Fix automático requeriría degradar a `next@9.3.3` (rompe la app).
- **Mitigación:** PostCSS se ejecuta en build time, no en runtime de usuario — impacto real muy bajo.
- **Acción:** Monitorear actualizaciones de Next.js que suban postcss a ≥ 8.5.10.

### [D-2] serialize-javascript ≤ 7.0.4 (High — RCE via RegExp en workbox)
- **Contexto:** Introducido por `@ducanh2912/next-pwa`. Fix automático requeriría `@ducanh2912/next-pwa@10.2.6` (breaking change según npm).
- **Acción:** Probar manualmente si `npm install @ducanh2912/next-pwa@latest` rompe algo. Si no, actualizar.

---

## Resumen

| ID | Severidad | Estado |
|----|-----------|--------|
| C-1 | CRÍTICO | ✅ Código limpio — **ROTAR CLAVE EN SUPABASE + LIMPIAR GIT HISTORY** |
| A-1 | ALTO | ✅ Código listo para Upstash — **AÑADIR ENV VARS EN VERCEL** |
| A-2 | ALTO | ✅ Resuelto |
| A-3 | ALTO | ✅ Resuelto |
| M-1 | MEDIO | ✅ Resuelto |
| M-2 | MEDIO | ✅ Resuelto |
| M-3 | MEDIO | ✅ Resuelto |
| B-1 | BAJO | ✅ Resuelto |
| B-2 | BAJO | ✅ Resuelto junto con C-1 |
| D-1 | Moderado | Pendiente — monitorear updates de Next.js |
| D-2 | Alto | Pendiente — probar update de next-pwa |

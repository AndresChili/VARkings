# Auditoría de Seguridad — VARkings
Fecha: 2026-06-08

---

## CRITICAL

### 1. ✅ Input validation ausente en registro — `app/api/auth/register/route.ts`
**Fix aplicado:** Validación de email (regex), password (mín 8 chars), username (3-20 chars alfanumérico/_), fullName (mín 2 chars). Rate limiting añadido: 5 intentos / 15 min por IP. Errores de DB internalizados.

---

## HIGH

### 2. ✅ CRON_SECRET opcional — 3 archivos
- `app/api/cron/send-reminders/route.ts`
- `app/api/cron/update-results/route.ts`
- `app/api/matches/sync/route.ts`

**Fix aplicado:** Si `CRON_SECRET` no está en env → 500 (misconfigured). Si token incorrecto → 401. Ya no hay acceso libre.

> ⚠️ **ACCIÓN REQUERIDA:** Añadir `CRON_SECRET=<valor_seguro>` a `.env.local` y a Vercel env vars. Sin esto, los crons dejarán de funcionar.

### 3. ✅ SQL injection potencial — `app/api/cron/send-reminders/route.ts`
**Fix aplicado:** UUID validation con regex `/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i` antes de interpolar IDs en query PostgREST.

### 4. ✅ Scores sin validación numérica — `app/api/predictions/match/route.ts`
**Fix aplicado:** `Number.isInteger()` + rango 0-30. Scores convertidos a Number antes de insertar. Mensajes de error generalizados.

### 5. ✅ invitee_id sin validar — `app/api/groups/[id]/invite/route.ts`
**Fix aplicado:** UUID regex validation + consulta a `profiles` para verificar que el usuario existe antes de insertar invitación.

### 6. ✅ user_id en body sin validar — `app/api/groups/[id]/requests/route.ts`
**Fix aplicado:** UUID regex validation en `user_id` del body. Mensajes de error generalizados.

### 7. ✅ friendship_id no verificado — `app/api/xp/friend-accepted/route.ts`
**Fix aplicado:** Verificación que `user.id === requester_id || user.id === addressee_id` antes de conceder XP. Si no pertenece → 403.

---

## MEDIUM

### 8. ✅ Sin rate limiting en endpoints sensibles
**Fix aplicado:** `lib/rate-limit.ts` creado (in-memory, per-instance). Aplicado en `/api/auth/register` (5 req / 15 min por IP).

> **Nota:** Rate limiter in-memory no se comparte entre instancias serverless. Para producción a escala, upgrade a Upstash Redis + `@upstash/ratelimit`. Suficiente para el volumen actual.

### 9. ℹ️ Admin client en lugar de RLS en admin page — `app/(main)/admin/sugerencias/page.tsx`
**No cambiado:** Requeriría migración RLS nueva + rediseño de query. Riesgo bajo: check de superadmin en `guard()` es el gate real. Aceptable por ahora.

### 10. ✅ Mensajes de error de BD expuestos al cliente
**Fix aplicado:** Reemplazados `error.message` → mensajes genéricos en todas las rutas user-facing:
- `app/api/predictions/match/route.ts`
- `app/api/groups/[id]/invite/route.ts`
- `app/api/groups/[id]/requests/route.ts`
- `app/api/suggestions/route.ts`
- `app/api/suggestions/[id]/route.ts`
- `app/api/groups/route.ts`

---

## LOW / DISEÑO ACEPTABLE

### 11. ℹ️ `/api/*` público en middleware
No cambiado. Diseño aceptable con RLS como segunda capa.

### 12. ℹ️ Admin client en suggestions route
Aceptable. Gate es `guard()` con verificación de email superadmin.

### 13. ✅ Superadmin check frágil si SUPERADMIN_EMAIL no está en env
**Fix aplicado:** `guard()` ahora retorna `null` y loguea error si `SUPERADMIN_EMAIL` no está definido. Falla cerrado (no acceso) en lugar de falla silenciosa.

---

## Resumen final

| # | Problema | Severidad | Estado |
|---|----------|-----------|--------|
| 1 | Input validation ausente en registro | CRITICAL | ✅ Resuelto |
| 2 | CRON_SECRET opcional (3 rutas) | HIGH | ✅ Resuelto — ⚠️ añadir a env |
| 3 | SQL injection en send-reminders | HIGH | ✅ Resuelto |
| 4 | Scores sin validación numérica | HIGH | ✅ Resuelto |
| 5 | invitee_id sin validar | HIGH | ✅ Resuelto |
| 6 | user_id en body sin validar | HIGH | ✅ Resuelto |
| 7 | friendship_id sin verificar (XP farming) | HIGH | ✅ Resuelto |
| 8 | Sin rate limiting | MEDIUM | ✅ Resuelto (in-memory) |
| 9 | Admin client en lugar de RLS en admin page | MEDIUM | ℹ️ Aceptable |
| 10 | Error messages de BD expuestos | MEDIUM | ✅ Resuelto |
| 11 | /api/* público en middleware | LOW | ℹ️ Diseño aceptable |
| 12 | Admin client en suggestions route | LOW | ℹ️ Diseño aceptable |
| 13 | Superadmin check frágil | LOW | ✅ Resuelto |

---

## Acción manual requerida

**CRÍTICO:** Añadir `CRON_SECRET=<token_aleatorio_seguro>` en:
1. `.env.local` (desarrollo local)
2. Vercel → Settings → Environment Variables (producción)

Generar token: `openssl rand -base64 32`

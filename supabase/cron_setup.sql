-- ============================================================
-- VARkings: actualización de resultados cada minuto
-- ============================================================
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (proyecto de producción).
--
-- ANTES DE EJECUTAR, sustituye:
--   1. TU-APP.vercel.app  -> el dominio real de tu app en Vercel
--   2. TU_CRON_SECRET     -> el valor de la variable CRON_SECRET en Vercel
--
-- Esto llama a /api/cron/update-results cada minuto, que:
--   - actualiza estados en vivo,
--   - guarda resultados finales (y penaltis),
--   - calcula los puntos de las predicciones al momento.
-- El cron diario de Vercel (02:00 UTC) queda como respaldo.

-- Extensiones necesarias (ya vienen disponibles en Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Elimina el job si ya existía (permite re-ejecutar este script)
SELECT cron.unschedule('varkings-update-results')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'varkings-update-results');

-- Programa la llamada cada minuto
SELECT cron.schedule(
  'varkings-update-results',
  '* * * * *',
  $$
  SELECT net.http_get(
    url     := 'https://TU-APP.vercel.app/api/cron/update-results',
    headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET'),
    timeout_milliseconds := 30000
  );
  $$
);

-- Comprobar que quedó programado:
--   SELECT * FROM cron.job;
-- Ver últimas ejecuciones:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Para desactivarlo:
--   SELECT cron.unschedule('varkings-update-results');

-- ═══════════════════════════════════════════════════════════════
-- WearAura — Planification de la veille des erreurs (quotidienne)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Déclenche l'Edge Function error-watch chaque jour à 07:00 UTC.
-- N'envoie un e-mail QUE s'il y a des erreurs actionnables.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace SERVICE_ROLE_KEY_ICI par ta vraie
--    clé service_role (Settings → API → service_role).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('error-watch')
where exists (select 1 from cron.job where jobname = 'error-watch');

select cron.schedule(
  'error-watch',
  '0 7 * * *',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/error-watch',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Vérifs ──
-- select * from cron.job where jobname = 'error-watch';
-- select id, status_code, content from net._http_response order by id desc limit 3;

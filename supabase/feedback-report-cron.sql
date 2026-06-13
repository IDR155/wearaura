-- ═══════════════════════════════════════════════════════════════
-- WearAura — Planification du digest feedback (quotidien)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Déclenche l'Edge Function feedback-report chaque jour à 07:30 UTC.
-- N'envoie un e-mail QUE s'il y a de nouveaux retours utilisateurs.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace SERVICE_ROLE_KEY_ICI par ta vraie
--    clé service_role (Settings → API → service_role).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('feedback-report')
where exists (select 1 from cron.job where jobname = 'feedback-report');

select cron.schedule(
  'feedback-report',
  '30 7 * * *',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/feedback-report',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- ── Vérifs ──
-- select * from cron.job where jobname = 'feedback-report';
-- select id, status_code, content from net._http_response order by id desc limit 3;

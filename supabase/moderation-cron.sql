-- ═══════════════════════════════════════════════════════════════
-- WearAura — Planification du digest modération (quotidien)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Déclenche l'Edge Function moderation-watch chaque jour à 07:15 UTC.
-- N'envoie un e-mail QUE s'il y a de nouveaux posts signalés.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace SERVICE_ROLE_KEY_ICI par ta vraie
--    clé service_role (Settings → API → service_role).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('moderation-watch')
where exists (select 1 from cron.job where jobname = 'moderation-watch');

select cron.schedule(
  'moderation-watch',
  '15 7 * * *',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/moderation-watch',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Vérifs ──
-- select * from cron.job where jobname = 'moderation-watch';
-- select id, status_code, content from net._http_response order by id desc limit 3;

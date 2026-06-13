-- ═══════════════════════════════════════════════════════════════
-- WearAura — Planification de l'agent de modération (Phase 2b)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Déclenche mod-scan toutes les heures. L'agent ne consomme Mistral
-- que s'il y a des signalements en attente (sinon retour immédiat).
--
-- ⚠️ AVANT D'EXÉCUTER : remplace SERVICE_ROLE_KEY_ICI par ta vraie
--    clé service_role.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('mod-scan')
where exists (select 1 from cron.job where jobname = 'mod-scan');

select cron.schedule(
  'mod-scan',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/mod-scan',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ── Vérifs ──
-- select * from cron.job where jobname = 'mod-scan';
-- select id, status_code, content from net._http_response order by id desc limit 3;

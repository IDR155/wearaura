-- ═══════════════════════════════════════════════════════════════
-- WearAura — Planification du rapport hebdomadaire par e-mail
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Déclenche l'Edge Function weekly-report chaque lundi à 06:30 UTC
-- (≈ 08:30 heure de Paris en été). pg_cron tourne en UTC.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace SERVICE_ROLE_KEY_ICI par ta vraie
--    clé service_role (Dashboard → Settings → API → service_role).
--    Elle reste dans la base, jamais dans le repo.
-- ═══════════════════════════════════════════════════════════════

-- Extensions nécessaires (déjà actives si tu utilises déjà le cron)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supprime un éventuel ancien job du même nom (ré-exécution sûre)
select cron.unschedule('weekly-report')
where exists (select 1 from cron.job where jobname = 'weekly-report');

-- Planifie : lundi 06:30 UTC
select cron.schedule(
  'weekly-report',
  '30 6 * * 1',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'),
    body    := '{}'::jsonb
  );
  $$
);

-- ── Vérifs utiles ──
-- Voir le job :        select * from cron.job where jobname = 'weekly-report';
-- Déclencher un test : (copie le bloc net.http_post ci-dessus dans une query et Run)
-- Voir le résultat :   select id, status_code, content from net._http_response order by id desc limit 3;

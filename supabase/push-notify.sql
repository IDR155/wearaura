-- ═══════════════════════════════════════════════════════════════
-- WearAura — Push temps réel sur nouvelle notification
-- À exécuter dans Supabase Dashboard → SQL Editor (une seule fois)
--
-- Déclenche l'Edge Function push-notify à chaque INSERT dans
-- public.notifications → push web au destinataire (app fermée).
-- ⚠️ Remplace SERVICE_ROLE_KEY_ICI par ta clé service_role
--    (Dashboard → Settings → API → service_role) avant d'exécuter.
-- ═══════════════════════════════════════════════════════════════

-- 1. Langue du destinataire (pour le texte du push). Écrite par l'app.
alter table public.profiles add column if not exists lang text default 'fr';

-- 2. Fonction trigger : appelle l'Edge Function avec la ligne insérée.
--    pg_net rend l'appel asynchrone → n'allonge pas l'INSERT.
create or replace function public.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'
    ),
    body    := to_jsonb(NEW)
  );
  return NEW;
end;
$$;

-- 3. Le trigger lui-même (remplace l'ancien s'il existe).
drop trigger if exists trg_notify_push on public.notifications;
create trigger trg_notify_push
  after insert on public.notifications
  for each row
  execute function public.notify_push_on_notification();

-- Pour vérifier :
--   select tgname from pg_trigger where tgrelid = 'public.notifications'::regclass;
-- Pour désactiver si besoin :
--   drop trigger if exists trg_notify_push on public.notifications;

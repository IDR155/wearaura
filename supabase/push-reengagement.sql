-- ═══════════════════════════════════════════════════════════════
-- WearAura — Push de ré-engagement hebdomadaire
-- À exécuter dans Supabase Dashboard → SQL Editor (une seule fois)
-- ═══════════════════════════════════════════════════════════════

-- 1. Horodatage de dernière visite (mis à jour par l'app à chaque ouverture)
alter table public.profiles add column if not exists last_seen timestamptz;

-- 2. Souscriptions push des navigateurs/appareils
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  last_reengage_at timestamptz
);

alter table public.push_subscriptions enable row level security;

-- Chaque utilisateur ne gère que ses propres souscriptions
-- (l'Edge Function utilise la clé service_role qui contourne la RLS)
create policy "push_subs_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push_subs_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push_subs_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id);
create policy "push_subs_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- 3. Cron hebdomadaire — lundi 18h UTC (19h/20h en France)
-- pg_cron et pg_net sont déjà actifs (utilisés par le warmup smooth-responder).
-- ⚠️ Remplace SERVICE_ROLE_KEY_ICI par ta clé service_role
--    (Dashboard → Settings → API → service_role) avant d'exécuter.
select cron.schedule(
  'wa-push-reengage',
  '0 18 * * 1',
  $$
  select net.http_post(
    url     := 'https://whaxwmztbkgnfokuqlcc.supabase.co/functions/v1/push-reengage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_ICI'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Pour vérifier que le cron est bien planifié :
-- select * from cron.job;
-- Pour le supprimer si besoin :
-- select cron.unschedule('wa-push-reengage');

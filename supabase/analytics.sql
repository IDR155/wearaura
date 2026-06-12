-- ═══════════════════════════════════════════════════════════════
-- WearAura — Analytics produit + remontée d'erreurs (first-party)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Deux tables :
--   app_events    : quels écrans/fonctionnalités sont utilisés
--   client_errors : erreurs JavaScript rencontrées par les utilisateurs
-- Les clients ne peuvent qu'INSÉRER (jamais lire) — lecture via le
-- Dashboard ou les requêtes en bas de ce fichier.
-- ═══════════════════════════════════════════════════════════════

-- ── Événements produit ──────────────────────────────────────────
create table if not exists public.app_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  event      text not null,
  props      jsonb default '{}'::jsonb,
  lang       text,
  created_at timestamptz default now()
);
create index if not exists app_events_event_idx on public.app_events (event, created_at desc);
create index if not exists app_events_created_idx on public.app_events (created_at desc);

alter table public.app_events enable row level security;
drop policy if exists "events_insert" on public.app_events;
create policy "events_insert" on public.app_events
  for insert with check (user_id is null or auth.uid() = user_id);
-- (aucune policy SELECT : illisible depuis l'app, lisible depuis le Dashboard)

-- ── Erreurs client ──────────────────────────────────────────────
create table if not exists public.client_errors (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  message    text,
  stack      text,
  url        text,
  ua         text,
  created_at timestamptz default now()
);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
drop policy if exists "errors_insert" on public.client_errors;
create policy "errors_insert" on public.client_errors
  for insert with check (true);

-- ═══════════════════════════════════════════════════════════════
-- REQUÊTES UTILES (à copier dans le SQL Editor quand tu veux voir)
-- ═══════════════════════════════════════════════════════════════

-- Usage par fonctionnalité sur 7 jours :
-- select event, count(*) as n, count(distinct user_id) as users
-- from app_events where created_at > now() - interval '7 days'
-- group by event order by n desc;

-- Onglets les plus visités sur 7 jours :
-- select props->>'tab' as tab, count(*) as n
-- from app_events where event = 'tab_view'
--   and created_at > now() - interval '7 days'
-- group by 1 order by n desc;

-- Utilisateurs actifs par jour (14 jours) :
-- select date_trunc('day', created_at) as jour, count(distinct user_id) as users
-- from app_events where created_at > now() - interval '14 days'
-- group by 1 order by 1 desc;

-- Dernières erreurs client :
-- select created_at, message, url from client_errors
-- order by created_at desc limit 50;

-- Erreurs les plus fréquentes sur 7 jours :
-- select message, count(*) as n from client_errors
-- where created_at > now() - interval '7 days'
-- group by message order by n desc limit 20;

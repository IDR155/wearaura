-- ═══════════════════════════════════════════════════════════════
-- WearAura — Table « feedback » (formulaire « Signaler un problème »)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Sépare les retours utilisateurs (bug / idée / autre) des
-- signalements de CONTENU (table `reports`, posts/comptes signalés).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  category    text not null default 'bug',
  description text not null,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Insert-only : un utilisateur connecté peut envoyer son retour,
-- mais personne ne peut lire/modifier/supprimer côté client.
-- (Toi tu lis depuis le Dashboard ou via un agent service_role.)
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

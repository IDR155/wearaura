-- ═══════════════════════════════════════════════════════════════
-- WearAura — Signalements de contenu (Phase 2a)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Table générique pour signaler commentaires et messages privés.
-- (Les posts gardent leur table `reports` existante + agent modérateur.)
--
-- ⚠️ À EXÉCUTER AVANT de déployer le frontend (sinon insert/filtre
--    sur une colonne/table inexistante = erreur).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.content_reports (
  id               uuid primary key default gen_random_uuid(),
  content_type     text not null check (content_type in ('comment','message')),
  content_id       text not null,
  content_text     text,          -- copie du texte au moment du signalement
  reported_user_id uuid,          -- auteur du contenu signalé
  reporter_id      uuid,          -- qui signale
  reason           text,
  status           text not null default 'pending',  -- pending | auto_hidden | reviewed | dismissed
  ai_verdict       text,          -- rempli par l'agent en Phase 2b (ok | review | violation)
  ai_category      text,
  ai_confidence    numeric,
  created_at       timestamptz not null default now()
);

alter table public.content_reports enable row level security;

-- Un utilisateur connecté peut signaler ; personne ne lit/modifie côté client.
drop policy if exists "content_reports_insert" on public.content_reports;
create policy "content_reports_insert"
  on public.content_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- ── Masquage réversible des messages (la colonne manquait — posts/comments
--    l'ont déjà via moderation-fields.sql) ──
alter table public.messages add column if not exists hidden        boolean not null default false;
alter table public.messages add column if not exists hidden_reason text;
alter table public.messages add column if not exists hidden_at     timestamptz;

-- ── Commandes manuelles ──
-- Masquer un commentaire : update comments set hidden=true, hidden_reason='manuel', hidden_at=now() where id='ID';
-- Masquer un message     : update messages set hidden=true, hidden_reason='manuel', hidden_at=now() where id='ID';
-- Voir les signalements   : select * from content_reports where status='pending' order by created_at desc;

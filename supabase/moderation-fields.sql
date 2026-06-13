-- ═══════════════════════════════════════════════════════════════
-- WearAura — Brique de modération réversible (Phase 1)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Ajoute un champ `hidden` (réversible) sur posts et comments.
-- Le frontend filtre déjà `hidden = false` partout où il affiche du
-- contenu, donc un contenu masqué disparaît de l'app SANS être
-- supprimé (on peut le réafficher à tout moment).
--
-- ⚠️ À EXÉCUTER AVANT de déployer le frontend qui filtre `hidden`,
--    sinon les requêtes échoueront (colonne inexistante).
-- ═══════════════════════════════════════════════════════════════

-- Posts
alter table public.posts    add column if not exists hidden        boolean not null default false;
alter table public.posts    add column if not exists hidden_reason text;
alter table public.posts    add column if not exists hidden_at     timestamptz;

-- Commentaires
alter table public.comments add column if not exists hidden        boolean not null default false;
alter table public.comments add column if not exists hidden_reason text;
alter table public.comments add column if not exists hidden_at     timestamptz;

-- Index partiels : accélère les lectures « visibles » (hidden = false)
create index if not exists idx_posts_visible    on public.posts(created_at)    where hidden = false;
create index if not exists idx_comments_visible on public.comments(post_id)    where hidden = false;

-- ═══════════════════════════════════════════════════════════════
-- COMMANDES MANUELLES (pour toi, depuis le SQL Editor)
-- ═══════════════════════════════════════════════════════════════
-- Masquer un post :
--   update posts set hidden=true, hidden_reason='manuel', hidden_at=now() where id='POST_ID';
-- Réafficher un post :
--   update posts set hidden=false, hidden_reason=null, hidden_at=null where id='POST_ID';
--
-- Masquer un commentaire :
--   update comments set hidden=true, hidden_reason='manuel', hidden_at=now() where id='COMMENT_ID';
-- Réafficher un commentaire :
--   update comments set hidden=false, hidden_reason=null, hidden_at=null where id='COMMENT_ID';
--
-- Voir ce qui est actuellement masqué :
--   select id, caption, hidden_reason, hidden_at from posts    where hidden order by hidden_at desc;
--   select id, content, hidden_reason, hidden_at from comments where hidden order by hidden_at desc;

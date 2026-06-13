-- ═══════════════════════════════════════════════════════════════
-- WearAura — Fonction « digest feedback » (retours utilisateurs)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Renvoie les retours envoyés via le formulaire « Signaler un
-- problème » (table feedback) dans les 24 dernières heures.
-- LECTURE SEULE — ne modifie jamais rien.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace REPORT_TOKEN_ICI par ton vrai jeton.
-- ═══════════════════════════════════════════════════════════════

-- Colonne e-mail (Phase 3 : pour préparer un brouillon de réponse)
alter table public.feedback add column if not exists email text;

create or replace function public.feedback_digest(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_token is null or p_token <> 'REPORT_TOKEN_ICI' then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'window', '24 dernières heures',
    'total_all_time', (select count(*) from feedback),
    'new_24h', (select count(*) from feedback where created_at > now() - interval '24 hours'),
    -- Retours des dernières 24 h, plus récent en premier
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'category',    f.category,
        'description', f.description,
        'username',    coalesce(pr.username, 'anonyme'),
        'email',       f.email,
        'created_at',  f.created_at
      ) order by f.created_at desc), '[]'::jsonb)
      from feedback f
      left join profiles pr on pr.id = f.user_id
      where f.created_at > now() - interval '24 hours'
    )
  ) into result;

  return result;
end;
$$;

-- Seul le service_role (l'Edge Function) appelle cette fonction.
revoke all on function public.feedback_digest(text) from public, anon;
grant execute on function public.feedback_digest(text) to service_role;

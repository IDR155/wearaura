-- ═══════════════════════════════════════════════════════════════
-- WearAura — Fonction « digest modération » (agent Modérateur)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Renvoie les posts signalés dans les 24 dernières heures, regroupés
-- par post : utilisateur signalé, nombre de personnes l'ayant signalé,
-- motifs, et extrait du post. LECTURE SEULE — ne modifie jamais rien.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace REPORT_TOKEN_ICI par ton vrai jeton.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.moderation_digest(p_token text)
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
    'total_pending', (
      select count(*) from reports where status = 'pending'),
    'new_24h', (
      select count(*) from reports where created_at > now() - interval '24 hours'),
    -- Posts signalés (24h), regroupés, triés par nb de signaleurs décroissant
    'reported_posts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'post_id',       post_id,
        'reported_user', ru,
        'caption',       caption,
        'reporters',     reporters,
        'reasons',       reasons
      ) order by reporters desc), '[]'::jsonb)
      from (
        select r.post_id,
               coalesce(max(pr.username), 'inconnu')        ru,
               max(po.caption)                              caption,
               count(distinct r.reporter_id)                reporters,
               jsonb_agg(distinct r.reason)                 reasons
        from reports r
        left join profiles pr on pr.id = r.reported_user_id
        left join posts    po on po.id = r.post_id
        where r.created_at > now() - interval '24 hours'
          and r.post_id is not null
        group by r.post_id
      ) g)
  ) into result;

  return result;
end;
$$;

-- Seul le service_role (l'Edge Function) appelle cette fonction.
revoke all on function public.moderation_digest(text) from public, anon;
grant execute on function public.moderation_digest(text) to service_role;

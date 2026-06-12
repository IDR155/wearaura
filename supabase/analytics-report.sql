-- ═══════════════════════════════════════════════════════════════
-- WearAura — Fonction « rapport analytics » pour l'agent Analyste
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Renvoie UNIQUEMENT des statistiques agrégées (aucune donnée
-- personnelle). SECURITY DEFINER pour lire les tables insert-only,
-- protégée par un jeton, appelable avec la clé publique (anon).
--
-- ⚠️ AVANT D'EXÉCUTER : remplace REPORT_TOKEN_ICI (2 endroits) par
--    ton vrai jeton (fourni à part, jamais commité).
-- ═══════════════════════════════════════════════════════════════

create or replace function public.analytics_summary(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Garde d'accès : jeton obligatoire
  if p_token is null or p_token <> 'REPORT_TOKEN_ICI' then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'period', '7 derniers jours',

    -- Activité globale
    'active_users', (
      select count(distinct user_id) from app_events
      where created_at > now() - interval '7 days'),
    'total_events', (
      select count(*) from app_events
      where created_at > now() - interval '7 days'),

    -- Usage par fonctionnalité (event -> nombre)
    'events', (
      select coalesce(jsonb_object_agg(event, n), '{}'::jsonb)
      from (select event, count(*) n from app_events
            where created_at > now() - interval '7 days'
            group by event order by n desc) e),

    -- Onglets les plus visités
    'top_tabs', (
      select coalesce(jsonb_object_agg(tab, n), '{}'::jsonb)
      from (select props->>'tab' tab, count(*) n from app_events
            where event = 'tab_view'
              and created_at > now() - interval '7 days'
              and props->>'tab' is not null
            group by 1 order by n desc limit 8) t),

    -- Utilisateurs actifs par jour (14 jours, pour voir la tendance)
    'daily_active_users', (
      select coalesce(jsonb_object_agg(jour, n), '{}'::jsonb)
      from (select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') jour,
                   count(distinct user_id) n
            from app_events where created_at > now() - interval '14 days'
            group by 1 order by 1) d),

    -- Santé technique
    'errors_7d', (
      select count(*) from client_errors
      where created_at > now() - interval '7 days'),
    'top_errors', (
      select coalesce(jsonb_agg(jsonb_build_object('message', message, 'n', n)), '[]'::jsonb)
      from (select message, count(*) n from client_errors
            where created_at > now() - interval '7 days'
            group by message order by n desc limit 5) er)
  ) into result;

  return result;
end;
$$;

-- La clé publique (anon) peut appeler la fonction ; le jeton fait le reste.
grant execute on function public.analytics_summary(text) to anon;

-- ── Test rapide (remplace par ton vrai jeton) ──
-- select public.analytics_summary('REPORT_TOKEN_ICI');

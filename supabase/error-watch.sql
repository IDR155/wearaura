-- ═══════════════════════════════════════════════════════════════
-- WearAura — Fonction « veille des erreurs » (agent Veilleur de bugs)
-- À exécuter dans Supabase Dashboard → SQL Editor → Run
--
-- Renvoie les erreurs client des 24 dernières heures, regroupées et
-- nettoyées du bruit connu (Script error., ResizeObserver…). Pour
-- chaque erreur : nombre d'occurrences + nombre d'utilisateurs touchés.
--
-- ⚠️ AVANT D'EXÉCUTER : remplace REPORT_TOKEN_ICI par ton vrai jeton.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.error_watch_24h(p_token text)
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
    'window', '24 dernières heures',
    'generated_at', now(),
    'total_24h', (
      select count(*) from client_errors
      where created_at > now() - interval '24 hours'),
    -- erreurs « actionnables » = hors bruit navigateur connu
    'actionable', (
      select coalesce(
        jsonb_agg(jsonb_build_object('message', message, 'n', n, 'users', users)
                  order by users desc, n desc), '[]'::jsonb)
      from (
        select message, count(*) n, count(distinct user_id) users
        from client_errors
        where created_at > now() - interval '24 hours'
          and message is not null
          and message not ilike 'Script error.%'
          and message not ilike '%ResizeObserver%'
        group by message
      ) e)
  ) into result;

  return result;
end;
$$;

-- Seul le service_role (l'Edge Function) appelle cette fonction.
revoke all on function public.error_watch_24h(text) from public, anon;
grant execute on function public.error_watch_24h(text) to service_role;

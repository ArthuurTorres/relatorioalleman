CREATE OR REPLACE FUNCTION public.get_utm_dashboard_stats(p_from timestamp with time zone, p_to timestamp with time zone, p_origem text[] DEFAULT NULL::text[], p_utm_source text[] DEFAULT NULL::text[], p_utm_campaign text[] DEFAULT NULL::text[], p_dominio text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH filtered AS (
  SELECT
    bitrix_deal_id, titulo, fase, valor, origem, utm_source, utm_campaign,
    campaign_name, ad_id, ad_name, adset_name, dominio, data_criacao,
    (data_criacao AT TIME ZONE 'America/Sao_Paulo')::date AS dia_local,
    CASE WHEN origem IN ('Google', 'Meta') THEN origem ELSE 'Outros' END AS origem_norm
  FROM public.utm_conversions
  WHERE data_criacao >= p_from
    AND data_criacao <= p_to
    AND (COALESCE(array_length(p_origem, 1), 0) = 0 OR origem = ANY(p_origem))
    AND (COALESCE(array_length(p_utm_source, 1), 0) = 0 OR utm_source = ANY(p_utm_source))
    AND (COALESCE(array_length(p_utm_campaign, 1), 0) = 0 OR utm_campaign = ANY(p_utm_campaign))
    AND (COALESCE(array_length(p_dominio, 1), 0) = 0 OR dominio = ANY(p_dominio))
), summary AS (
  SELECT
    count(*)::int AS total,
    COALESCE(sum(valor), 0) AS valor_total,
    count(*) FILTER (WHERE origem_norm = 'Google')::int AS google,
    count(*) FILTER (WHERE origem_norm = 'Meta')::int AS meta,
    count(*) FILTER (WHERE origem_norm = 'Outros')::int AS outros
  FROM filtered
), series AS (
  SELECT jsonb_agg(
    jsonb_build_object('day', day, 'Google', google, 'Meta', meta, 'Outros', outros) ORDER BY day
  ) AS data
  FROM (
    SELECT
      dia_local::text AS day,
      count(*) FILTER (WHERE origem_norm = 'Google')::int AS google,
      count(*) FILTER (WHERE origem_norm = 'Meta')::int AS meta,
      count(*) FILTER (WHERE origem_norm = 'Outros')::int AS outros
    FROM filtered
    WHERE data_criacao IS NOT NULL
    GROUP BY dia_local
  ) s
), ads AS (
  SELECT jsonb_agg(
    jsonb_build_object('key', key, 'label', label, 'count', count, 'campaign', campaign, 'adset', adset) ORDER BY count DESC
  ) AS data
  FROM (
    SELECT
      COALESCE(ad_name, ad_id) AS key,
      COALESCE(ad_name, ad_id, '—') AS label,
      count(*)::int AS count,
      max(campaign_name) AS campaign,
      max(adset_name) AS adset
    FROM filtered
    WHERE origem IN ('Google', 'Meta')
      AND COALESCE(ad_name, ad_id) IS NOT NULL
    GROUP BY COALESCE(ad_name, ad_id), COALESCE(ad_name, ad_id, '—')
    ORDER BY count(*) DESC
    LIMIT 25
  ) a
), pages AS (
  SELECT jsonb_agg(
    jsonb_build_object('dominio', dominio, 'count', count, 'origemPredominante', origem_predominante) ORDER BY count DESC
  ) AS data
  FROM (
    SELECT DISTINCT ON (dominio)
      dominio, total_count::int AS count, origem_norm AS origem_predominante
    FROM (
      SELECT dominio, origem_norm,
        count(*) OVER (PARTITION BY dominio)::int AS total_count,
        count(*) OVER (PARTITION BY dominio, origem_norm)::int AS origem_count
      FROM filtered
      WHERE dominio IS NOT NULL
    ) p
    ORDER BY dominio, origem_count DESC, origem_norm
    LIMIT 15
  ) p2
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'total', summary.total,
    'valorTotal', summary.valor_total,
    'byOrigem', jsonb_build_object('Google', summary.google, 'Meta', summary.meta, 'Outros', summary.outros),
    'totalPrev', 0,
    'variacaoPct', NULL
  ),
  'series', COALESCE(series.data, '[]'::jsonb),
  'ads', COALESCE(ads.data, '[]'::jsonb),
  'pages', COALESCE(pages.data, '[]'::jsonb)
)
FROM summary, series, ads, pages;
$function$;
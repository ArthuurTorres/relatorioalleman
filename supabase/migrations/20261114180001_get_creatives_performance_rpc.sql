-- RPC: lista todos os criativos com performance e posição no funil.
-- Usado pelo card "Criativos" no OverviewTab.
CREATE OR REPLACE FUNCTION get_creatives_performance(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  result JSONB;
BEGIN
  WITH funnel_steps AS (
    SELECT stage_id, funnel_step, step_rank, COALESCE(label, stage_id) AS stage_name
    FROM bitrix_stage_map
    ORDER BY step_rank
  ),
  deal_stages AS (
    SELECT DISTINCT ON (bsh.deal_id)
      bsh.deal_id AS bitrix_deal_id,
      sm.stage_id,
      sm.funnel_step,
      sm.step_rank,
      COALESCE(sm.label, bsh.stage_id) AS stage_name
    FROM bitrix_stage_history bsh
    LEFT JOIN bitrix_stage_map sm ON sm.stage_id = bsh.stage_id
    WHERE bsh.changed_at BETWEEN p_from AND p_to
    ORDER BY bsh.deal_id, bsh.changed_at DESC
  ),
  creative_metrics AS (
    SELECT
      ma.creative_id,
      COALESCE(SUM(COALESCE(mai.spend, 0)), 0)       AS spend,
      COALESCE(SUM(COALESCE(mai.impressions, 0)), 0) AS impressions,
      COALESCE(SUM(COALESCE(mai.clicks, 0)), 0)      AS clicks,
      COALESCE(SUM(COALESCE(mai.reach, 0)), 0)       AS reach,
      COUNT(DISTINCT lm.bitrix_deal_id)               AS leads,
      COALESCE(SUM(COALESCE(bd.valor_total, 0)), 0)  AS valor
    FROM meta_ads ma
    JOIN meta_ad_insights mai ON mai.ad_id = ma.ad_id
      AND mai.date_start >= p_from::DATE
      AND mai.date_start <= p_to::DATE
    LEFT JOIN lead_match lm ON lm.ad_id = ma.ad_id
    LEFT JOIN bitrix_deals bd ON bd.id = lm.bitrix_deal_id
    WHERE ma.creative_id IS NOT NULL
    GROUP BY ma.creative_id
  ),
  creative_funnel AS (
    SELECT
      ma.creative_id,
      fs.stage_id,
      fs.funnel_step,
      fs.step_rank,
      fs.stage_name,
      COUNT(DISTINCT lm.bitrix_deal_id) AS deal_count
    FROM meta_ads ma
    JOIN meta_ad_insights mai ON mai.ad_id = ma.ad_id
      AND mai.date_start >= p_from::DATE
      AND mai.date_start <= p_to::DATE
    JOIN lead_match lm ON lm.ad_id = ma.ad_id
    JOIN deal_stages ds ON ds.bitrix_deal_id = lm.bitrix_deal_id
    JOIN funnel_steps fs ON fs.stage_id = ds.stage_id
    WHERE ma.creative_id IS NOT NULL
    GROUP BY ma.creative_id, fs.stage_id, fs.funnel_step, fs.step_rank, fs.stage_name
  ),
  all_creatives AS (
    SELECT
      mc.creative_id,
      mc.title,
      mc.body,
      mc.image_url,
      mc.thumbnail_url,
      mc.link_url,
      mc.account_id,
      COALESCE(cm.spend, 0)       AS spend,
      COALESCE(cm.impressions, 0) AS impressions,
      COALESCE(cm.clicks, 0)      AS clicks,
      COALESCE(cm.reach, 0)       AS reach,
      COALESCE(cm.leads, 0)       AS leads,
      COALESCE(cm.valor, 0)       AS valor,
      CASE
        WHEN COALESCE(cm.spend, 0) = 0 THEN 'sem_gasto'
        WHEN NOT EXISTS (
          SELECT 1 FROM meta_ads ma2
          JOIN meta_ad_insights mai2 ON mai2.ad_id = ma2.ad_id
          WHERE ma2.creative_id = mc.creative_id
            AND mai2.date_start >= p_from::DATE
            AND mai2.date_start <= p_to::DATE
            AND ma2.status IN ('ACTIVE', 'enabled')
        ) THEN 'pausado'
        ELSE 'ativo'
      END AS status,
      CASE WHEN COALESCE(cm.leads, 0) > 0
           THEN ROUND(COALESCE(cm.spend, 0)::NUMERIC / cm.leads, 2)
           ELSE 0 END AS cpl,
      CASE WHEN COALESCE(cm.spend, 0) > 0
           THEN ROUND(COALESCE(cm.valor, 0)::NUMERIC / cm.spend, 2)
           ELSE 0 END AS roas,
      CASE WHEN COALESCE(cm.impressions, 0) > 0
           THEN ROUND(100.0 * COALESCE(cm.clicks, 0) / cm.impressions, 2)
           ELSE 0 END AS ctr
    FROM meta_creatives mc
    LEFT JOIN creative_metrics cm ON cm.creative_id = mc.creative_id
  )
  SELECT jsonb_build_object(
    'creatives', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.valor DESC), '[]'::jsonb)
      FROM (
        SELECT
          ac.creative_id,
          ac.title,
          ac.body,
          ac.image_url,
          ac.thumbnail_url,
          ac.link_url,
          ac.spend,
          ac.impressions,
          ac.clicks,
          ac.reach,
          ac.leads,
          ac.valor,
          ac.status,
          ac.cpl,
          ac.roas,
          ac.ctr,
          COALESCE(
            jsonb_object_agg(
              COALESCE(cf.funnel_step, cf.stage_name),
              jsonb_build_object(
                'count', COALESCE(cf.deal_count, 0),
                'rate',  CASE WHEN ac.leads > 0
                              THEN ROUND(100.0 * COALESCE(cf.deal_count, 0) / ac.leads, 1)
                              ELSE 0 END
              )
            ) FILTER (WHERE cf.stage_id IS NOT NULL),
            '{}'::jsonb
          ) AS funnel_rates
        FROM all_creatives ac
        LEFT JOIN creative_funnel cf ON cf.creative_id = ac.creative_id
        GROUP BY
          ac.creative_id, ac.title, ac.body,
          ac.image_url, ac.thumbnail_url, ac.link_url,
          ac.spend, ac.impressions, ac.clicks, ac.reach,
          ac.leads, ac.valor, ac.status, ac.cpl, ac.roas, ac.ctr
        ORDER BY ac.valor DESC
      ) t
    ),
    'funnel_steps', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'step',      fs.funnel_step,
        'stage',     fs.stage_name,
        'step_rank', fs.step_rank
      ) ORDER BY fs.step_rank), '[]'::jsonb)
      FROM funnel_steps fs
    ),
    'total', (
      SELECT COALESCE(jsonb_build_object(
        'spend',       SUM(spend),
        'impressions', SUM(impressions),
        'clicks',      SUM(clicks),
        'leads',       SUM(leads),
        'valor',       SUM(valor)
      ), '{"spend":0,"impressions":0,"clicks":0,"leads":0,"valor":0}'::jsonb)
      FROM creative_metrics
    )
  ) INTO result;

  RETURN COALESCE(result, '{"creatives":[],"funnel_steps":[],"total":{"spend":0,"impressions":0,"clicks":0,"leads":0,"valor":0}}'::JSONB);
END;
$fn$;

GRANT EXECUTE ON FUNCTION get_creatives_performance TO anon;
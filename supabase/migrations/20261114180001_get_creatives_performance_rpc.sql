-- RPC: lista todos os criativos com performance e posição no funil.
-- Usado pelo card "Criativos" no OverviewTab.
CREATE OR REPLACE FUNCTION get_creatives_performance(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SET from_credential TO 'meta_anon'
SET jwt_claims TO '{"role":"anon"}'
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Lista de etapas do funil (ordem crescente = topo do funil → fundo)
  WITH funnel_steps AS (
    SELECT stage_name, funnel_step, step_rank
    FROM bitrix_stage_map
    ORDER BY step_rank
  ),
  -- Estágios por deal (melhor estágio atingido no período)
  deal_stages AS (
    SELECT bsh.bitrix_deal_id,
           bsm.stage_name,
           bsm.funnel_step,
           bsm.step_rank
    FROM (
      SELECT bitrix_deal_id,
             MAX(created_time) AS latest_time,
             MAX(created_time) FILTER (
               WHERE stage_rank = (
                 SELECT MAX(created_time)
                 FROM bitrix_stage_history bh2
                 JOIN bitrix_stage_map bm2 ON bm2.stage_name = bh2.stage_name
                 WHERE bh2.bitrix_deal_id = bh.bitrix_deal_id
               )
             ) AS best_time
      FROM (
        SELECT DISTINCT bsh.bitrix_deal_id, bsh.created_time,
               ROW_NUMBER() OVER (PARTITION BY bsh.bitrix_deal_id
                                  ORDER BY bsm.step_rank DESC) AS stage_rank
        FROM bitrix_stage_history bsh
        JOIN bitrix_stage_map bsm ON bsm.stage_name = bsh.stage_name
        WHERE bsh.created_time BETWEEN p_from AND p_to
          AND bsm.step_rank IS NOT NULL
      ) bsh
      GROUP BY bitrix_deal_id
    ) best
    JOIN bitrix_stage_history bsh ON bsh.bitrix_deal_id = best.bitrix_deal_id
                                  AND bsh.created_time = best.best_time
    JOIN bitrix_stage_map bsm ON bsm.stage_name = bsh.stage_name
  ),
  -- Métricas por criativo (soma de todos os ads que usam esse criativo)
  creative_metrics AS (
    SELECT
      ma.creative_id,
      COALESCE(SUM(COALESCE(mai.spend,0)),0)          AS spend,
      COALESCE(SUM(COALESCE(mai.impressions,0)),0)    AS impressions,
      COALESCE(SUM(COALESCE(mai.clicks,0)),0)         AS clicks,
      COALESCE(SUM(COALESCE(mai.reach,0)),0)          AS reach,
      COUNT(DISTINCT lm.bitrix_deal_id)               AS leads,
      COALESCE(SUM(COALESCE(bd.valor_total,0)),0)    AS valor
    FROM meta_ads ma
    JOIN meta_ad_insights mai ON mai.ad_id = ma.ad_id
      AND mai.date BETWEEN p_from::DATE AND p_to::DATE
    LEFT JOIN lead_match lm ON lm.ad_id = ma.ad_id
      AND lm.match_source = 'meta_lead'
    LEFT JOIN bitrix_deals bd ON bd.id = lm.bitrix_deal_id
    WHERE ma.creative_id IS NOT NULL
    GROUP BY ma.creative_id
  ),
  -- Funil por criativo: quantos leads chegou a cada etapa
  creative_funnel AS (
    SELECT
      ma.creative_id,
      fs.stage_name,
      fs.funnel_step,
      fs.step_rank,
      COUNT(DISTINCT lm.bitrix_deal_id) AS deal_count
    FROM meta_ads ma
    JOIN meta_ad_insights mai ON mai.ad_id = ma.ad_id
      AND mai.date BETWEEN p_from::DATE AND p_to::DATE
    JOIN lead_match lm ON lm.ad_id = ma.ad_id
      AND lm.match_source = 'meta_lead'
    JOIN deal_stages ds ON ds.bitrix_deal_id = lm.bitrix_deal_id
    JOIN funnel_steps fs ON fs.stage_name = ds.stage_name
    WHERE ma.creative_id IS NOT NULL
    GROUP BY ma.creative_id, fs.stage_name, fs.funnel_step, fs.step_rank
  ),
  -- Tabela completa
  all_creatives AS (
    SELECT
      mc.creative_id,
      mc.title,
      mc.body,
      mc.image_url,
      mc.thumbnail_url,
      mc.link_url,
      mc.status                  AS creative_status,
      COALESCE(cm.campaign_name,
        (SELECT campaign_name FROM meta_campaigns WHERE campaign_id = (
          SELECT campaign_id FROM meta_ads WHERE creative_id = mc.creative_id LIMIT 1
        ) LIMIT 1)
      )                          AS campaign_name,
      COALESCE(cm.campaign_id,
        (SELECT campaign_id FROM meta_ads WHERE creative_id = mc.creative_id LIMIT 1)
      )                          AS campaign_id,
      COALESCE(cm.spend,0)        AS spend,
      COALESCE(cm.impressions,0)  AS impressions,
      COALESCE(cm.clicks,0)       AS clicks,
      COALESCE(cm.reach,0)        AS reach,
      COALESCE(cm.leads,0)        AS leads,
      COALESCE(cm.valor,0)        AS valor,
      -- Status do criativo: derivado dos ads que o usam
      CASE
        WHEN COALESCE(cm.spend,0) = 0       THEN 'sem_gasto'
        WHEN NOT EXISTS (
          SELECT 1 FROM meta_ads ma2
          JOIN meta_ad_insights mai2 ON mai2.ad_id = ma2.ad_id
          WHERE ma2.creative_id = mc.creative_id
            AND mai2.date BETWEEN p_from::DATE AND p_to::DATE
            AND ma2.status IN ('ACTIVE','enabled')
        )                           THEN 'pausado'
        ELSE 'ativo'
      END                          AS status,
      -- CPL
      CASE WHEN COALESCE(cm.leads,0) > 0
           THEN ROUND(COALESCE(cm.spend,0)::NUMERIC / cm.leads, 2)
           ELSE 0 END               AS cpl,
      -- ROAS
      CASE WHEN COALESCE(cm.spend,0) > 0
           THEN ROUND(COALESCE(cm.valor,0)::NUMERIC / cm.spend, 2)
           ELSE 0 END               AS roas,
      -- CTR
      CASE WHEN COALESCE(cm.impressions,0) > 0
           THEN ROUND(100.0 * COALESCE(cm.clicks,0) / cm.impressions, 2)
           ELSE 0 END               AS ctr
    FROM meta_creatives mc
    LEFT JOIN creative_metrics cm ON cm.creative_id = mc.creative_id
  )
  SELECT jsonb_build_object(
    'creatives', (
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.valor DESC)
      FROM (
        SELECT
          ac.creative_id,
          ac.title,
          ac.body,
          ac.image_url,
          ac.thumbnail_url,
          ac.link_url,
          ac.campaign_name,
          ac.campaign_id,
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
          COALESCE(cm.leads,0) AS leads_meta,
          jsonb_object_agg(
            COALESCE(cf.funnel_step, cf.stage_name),
            jsonb_build_object(
              'count',  COALESCE(cf.deal_count, 0),
              'rate',   CASE WHEN COALESCE(cm.leads,0) > 0
                             THEN ROUND(100.0 * COALESCE(cf.deal_count,0)
                                      / cm.leads, 1)
                             ELSE 0 END
            )
          ) FILTER (WHERE cf.stage_name IS NOT NULL)
            AS funnel_rates
        FROM all_creatives ac
        LEFT JOIN creative_funnel cf ON cf.creative_id = ac.creative_id
        LEFT JOIN creative_metrics cm ON cm.creative_id = ac.creative_id
        GROUP BY
          ac.creative_id, ac.title, ac.body,
          ac.image_url, ac.thumbnail_url, ac.link_url,
          ac.campaign_name, ac.campaign_id,
          ac.spend, ac.impressions, ac.clicks, ac.reach,
          ac.leads, ac.valor, ac.status, ac.cpl, ac.roas, ac.ctr,
          cm.leads
        ORDER BY ac.valor DESC
      ) t
    ),
    'funnel_steps', (
      SELECT jsonb_agg(jsonb_build_object(
        'step',      fs.funnel_step,
        'stage',     fs.stage_name,
        'step_rank', fs.step_rank
      ) ORDER BY fs.step_rank)
      FROM funnel_steps fs
    ),
    'total', (SELECT jsonb_build_object(
      'spend',       SUM(spend),
      'impressions', SUM(impressions),
      'clicks',     SUM(clicks),
      'leads',      SUM(leads),
      'valor',      SUM(valor)
    ) FROM creative_metrics)
  ) INTO result
  FROM funnel_steps fs
  GROUP BY fs.step_rank;

  RETURN COALESCE(result, '{"creatives":[],"funnel_steps":[],"total":{"spend":0,"impressions":0,"clicks":0,"leads":0,"valor":0}}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION get_creatives_performance TO anon;

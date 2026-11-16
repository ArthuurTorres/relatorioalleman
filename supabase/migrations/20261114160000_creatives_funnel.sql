-- RPC: Desempenho de criativos (ads) com aproveitamento por etapa do funil
-- Para cada ad: spend, leads, valor, e % que chegou em cada etapa do funil (Bitrix)
CREATE OR REPLACE FUNCTION get_creatives_funnel(p_from timestamptz, p_to timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  result json;
BEGIN
  WITH
    meta_ads AS (
      SELECT
        ai.ad_id,
        ai.adset_id,
        ai.campaign_id,
        ai.ad_name,
        COALESCE(SUM(ai.spend)::numeric, 0)      AS spend,
        COALESCE(SUM(ai.impressions)::bigint, 0)  AS impressions,
        COALESCE(SUM(ai.clicks)::bigint, 0)       AS clicks,
        COALESCE(SUM(ai.reach)::bigint, 0)        AS reach
      FROM meta_ad_insights ai
      WHERE ai.date_start >= p_from::date
        AND ai.date_start <= p_to::date
      GROUP BY ai.ad_id, ai.adset_id, ai.campaign_id, ai.ad_name
    ),
    ad_leads AS (
      SELECT
        lm.ad_id,
        COUNT(lm.bitrix_deal_id)                   AS leads,
        COUNT(lm.bitrix_deal_id) FILTER (WHERE uc.origem = 'Meta')    AS leads_meta,
        COUNT(lm.bitrix_deal_id) FILTER (WHERE uc.origem = 'Outros')   AS leads_outros,
        COALESCE(SUM(uc.valor) FILTER (WHERE uc.origem = 'Meta'), 0)    AS valor_meta,
        COALESCE(SUM(uc.valor) FILTER (WHERE uc.origem = 'Outros'), 0)  AS valor_outros
      FROM lead_match lm
      JOIN utm_conversions uc ON uc.bitrix_deal_id = lm.bitrix_deal_id
      WHERE lm.matched_at >= p_from
        AND lm.matched_at <= p_to
      GROUP BY lm.ad_id
    ),
    best_stage AS (
      SELECT DISTINCT ON (lm.bitrix_deal_id)
        lm.ad_id,
        lm.bitrix_deal_id,
        bsh.changed_at,
        COALESCE(sm.funnel_step, 'sem_mapeamento') AS funnel_step,
        COALESCE(sm.step_rank, 999)                  AS step_rank,
        COALESCE(sm.label, bsh.stage_id)             AS stage_name
      FROM lead_match lm
      JOIN bitrix_stage_history bsh ON bsh.deal_id = lm.bitrix_deal_id
      LEFT JOIN bitrix_stage_map sm ON sm.stage_id = bsh.stage_id
      WHERE lm.matched_at >= p_from AND lm.matched_at <= p_to
        AND EXISTS (
          SELECT 1 FROM utm_conversions uc
          WHERE uc.bitrix_deal_id = lm.bitrix_deal_id
            AND uc.origem = 'Meta'
        )
      ORDER BY lm.bitrix_deal_id, bsh.changed_at DESC
    ),
    stage_ranks AS (
      SELECT DISTINCT step_rank, funnel_step, label AS name
      FROM bitrix_stage_map
      ORDER BY step_rank
    ),
    funnel_base AS (
      SELECT
        bs.ad_id,
        bs.funnel_step,
        bs.step_rank,
        bs.stage_name,
        COUNT(DISTINCT bs.bitrix_deal_id) AS deals_in_step
      FROM best_stage bs
      GROUP BY bs.ad_id, bs.funnel_step, bs.step_rank, bs.stage_name
    ),
    funnel_rates_cte AS (
      SELECT
        fb.ad_id,
        fb.funnel_step,
        fb.step_rank,
        fb.deals_in_step,
        SUM(fb.deals_in_step) OVER (
          PARTITION BY fb.ad_id
          ORDER BY fb.step_rank
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_deals
      FROM funnel_base fb
    ),
    combined AS (
      SELECT
        ma.ad_id,
        ma.ad_name,
        ma.adset_id,
        ma.campaign_id,
        ma.spend,
        ma.impressions,
        ma.clicks,
        ma.reach,
        COALESCE(al.leads, 0)                                   AS leads,
        COALESCE(al.leads_meta, 0)                              AS leads_meta,
        COALESCE(al.leads_outros, 0)                             AS leads_outros,
        COALESCE(al.valor_meta, 0) + COALESCE(al.valor_outros, 0) AS valor_gerado,
        COALESCE(al.valor_meta, 0)                               AS valor_meta,
        COALESCE(al.valor_outros, 0)                             AS valor_outros,
        CASE WHEN COALESCE(al.leads, 0) > 0
             THEN (COALESCE(al.valor_meta, 0) + COALESCE(al.valor_outros, 0)) / al.leads
        END                                                      AS ticket_medio,
        CASE WHEN ma.spend > 0
             THEN (COALESCE(al.valor_meta, 0) + COALESCE(al.valor_outros, 0)) / ma.spend
        END                                                      AS roas,
        CASE WHEN COALESCE(al.leads, 0) > 0
             THEN ma.spend / al.leads
        END                                                      AS cpl,
        CASE WHEN ma.impressions > 0
             THEN (ma.clicks::numeric / ma.impressions) * 100
        END                                                      AS ctr,
        CASE WHEN ma.impressions > 0
             THEN (ma.spend / NULLIF(ma.impressions, 0)) * 1000
        END                                                      AS cpm
      FROM meta_ads ma
      LEFT JOIN ad_leads al USING (ad_id)
    ),
    with_funnel AS (
      SELECT
        c.*,
        jsonb_object_agg(
          COALESCE(fc.funnel_step, 'sem_mapeamento'),
          jsonb_build_object(
            'total', COALESCE(fc.cumulative_deals, 0),
            'pct', CASE WHEN c.leads > 0 AND fc.cumulative_deals IS NOT NULL
                         THEN ROUND((fc.cumulative_deals::numeric / c.leads) * 100, 2)
                    END,
            'step_rank', COALESCE(fc.step_rank, 999)
          )
        ) FILTER (WHERE fc.ad_id IS NOT NULL) AS funnel_rates
      FROM combined c
      LEFT JOIN funnel_rates_cte fc USING (ad_id)
      GROUP BY
        c.ad_id, c.ad_name, c.adset_id, c.campaign_id,
        c.spend, c.impressions, c.clicks, c.reach,
        c.leads, c.leads_meta, c.leads_outros,
        c.valor_gerado, c.valor_meta, c.valor_outros,
        c.ticket_medio, c.roas, c.cpl, c.ctr, c.cpm
    )
  SELECT jsonb_build_object(
    'stages',  (SELECT COALESCE(json_agg(jsonb_build_object('rank', step_rank, 'step', COALESCE(funnel_step, 'sem_mapeamento')) ORDER BY step_rank), '[]'::jsonb) FROM stage_ranks),
    'ads',     (SELECT COALESCE(json_agg(
      jsonb_build_object(
        'ad_id',        ad_id,
        'ad_name',      COALESCE(ad_name, ad_id),
        'adset_id',     adset_id,
        'campaign_id',  campaign_id,
        'campaign_name', NULL,
        'spend',        spend,
        'impressions',  impressions,
        'clicks',       clicks,
        'reach',        reach,
        'leads',        leads,
        'leads_meta',   leads_meta,
        'leads_outros', leads_outros,
        'valor_gerado', valor_gerado,
        'valor_meta',   valor_meta,
        'valor_outros', valor_outros,
        'ticket_medio', ticket_medio,
        'roas',         roas,
        'cpl',          cpl,
        'ctr',          ctr,
        'cpm',          cpm,
        'funnel_rates', funnel_rates
      ) ORDER BY valor_gerado DESC NULLS LAST
    ), '[]'::jsonb) FROM with_funnel WHERE spend > 0 OR leads > 0)
  ) INTO result;

  RETURN result;
END;
$fn$;
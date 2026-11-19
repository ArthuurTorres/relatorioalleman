-- Migration: Cria/normaliza public.meta_creatives (com RLS + GRANTs + índices)
-- e corrige public.get_creatives_performance e public.get_creatives_funnel
-- eliminando a dependência quebrada de bitrix_deals (42P01) e o fan-out cartesiano.
-- Idempotente: segura para rodar em qualquer estado do banco.

-- ---------------------------------------------------------------------------
-- 1) Tabela public.meta_creatives + RLS + GRANTs + Índices de JOIN
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_creatives (
  creative_id     text PRIMARY KEY,
  account_id      text NOT NULL,
  title           text,
  body            text,
  image_url       text,
  thumbnail_url   text,
  link_url        text,
  object_type     text,
  object_story_id text,
  status          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  synced_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_creatives
  ADD COLUMN IF NOT EXISTS account_id text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS object_type text,
  ADD COLUMN IF NOT EXISTS object_story_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_creatives_creative_id
  ON public.meta_creatives (creative_id);
CREATE INDEX IF NOT EXISTS idx_meta_creatives_account
  ON public.meta_creatives (account_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_creative_id
  ON public.meta_ads (creative_id);
CREATE INDEX IF NOT EXISTS idx_lead_match_ad_id
  ON public.lead_match (ad_id);
CREATE INDEX IF NOT EXISTS idx_utm_conversions_ad_id
  ON public.utm_conversions (ad_id);

ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.meta_creatives TO anon, authenticated;
GRANT ALL ON public.meta_creatives TO service_role;

DROP POLICY IF EXISTS "read meta_creatives" ON public.meta_creatives;
CREATE POLICY "read meta_creatives"
  ON public.meta_creatives
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.meta_creatives IS 'Assets de criativos (imagem, miniatura 600x600, título, copy e URL) sincronizados da Meta Graph API.';

-- ---------------------------------------------------------------------------
-- 2) RPC public.get_creatives_performance (sem bitrix_deals e sem fan-out)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_creatives_performance(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_creatives_performance(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH
  date_bounds AS (
    SELECT
      (p_from AT TIME ZONE 'America/Sao_Paulo')::date AS start_day,
      (p_to   AT TIME ZONE 'America/Sao_Paulo')::date AS end_day
  ),
  -- Mídia agregada estritamente por ad_id (zero fan-out com leads)
  ins_by_ad AS (
    SELECT
      i.ad_id,
      COALESCE(SUM(COALESCE(i.spend, 0)), 0)::numeric               AS spend,
      COALESCE(SUM(COALESCE(i.impressions, 0)), 0)::bigint          AS impressions,
      COALESCE(SUM(COALESCE(i.reach, 0)), 0)::bigint                AS reach,
      COALESCE(SUM(COALESCE(i.clicks, 0)), 0)::bigint               AS clicks,
      COALESCE(SUM(COALESCE(i.inline_link_clicks, 0)), 0)::bigint   AS link_clicks,
      COALESCE(SUM(
        COALESCE((
          SELECT (a->>'value')::numeric
          FROM jsonb_array_elements(COALESCE(i.actions, '[]'::jsonb)) a
          WHERE a->>'action_type' IN (
            'lead',
            'onsite_conversion.lead_grouped',
            'offsite_conversion.fb_pixel_lead'
          )
          ORDER BY CASE a->>'action_type'
            WHEN 'lead' THEN 1
            WHEN 'onsite_conversion.lead_grouped' THEN 2
            ELSE 3
          END
          LIMIT 1
        ), 0)
      ), 0)::int AS leads_meta
    FROM public.meta_ad_insights i
    CROSS JOIN date_bounds db
    WHERE i.date_start >= db.start_day
      AND i.date_start <= db.end_day
    GROUP BY i.ad_id
  ),
  -- Vínculo mais recente por negócio do Bitrix
  matched_lead AS (
    SELECT DISTINCT ON (lm.bitrix_deal_id)
      lm.bitrix_deal_id,
      NULLIF(lm.ad_id, '') AS ad_id
    FROM public.lead_match lm
    WHERE lm.ad_id IS NOT NULL AND lm.ad_id <> ''
    ORDER BY lm.bitrix_deal_id, lm.matched_at DESC
  ),
  -- Negócios atribuídos no período via lead_match ou fallback utm_conversions
  attributed_deals AS (
    SELECT DISTINCT ON (uc.bitrix_deal_id)
      uc.bitrix_deal_id,
      COALESCE(ml.ad_id, NULLIF(uc.ad_id_meta, ''), NULLIF(uc.ad_id, '')) AS ad_id,
      COALESCE(uc.valor, 0)::numeric AS valor,
      uc.fase,
      COALESCE(uc.origem, 'Meta') AS origem
    FROM public.utm_conversions uc
    LEFT JOIN matched_lead ml ON ml.bitrix_deal_id = uc.bitrix_deal_id
    WHERE uc.data_criacao >= p_from
      AND uc.data_criacao <= p_to
      AND COALESCE(ml.ad_id, NULLIF(uc.ad_id_meta, ''), NULLIF(uc.ad_id, '')) IS NOT NULL
    ORDER BY uc.bitrix_deal_id, uc.data_criacao ASC
  ),
  crm_by_ad AS (
    SELECT
      ad.ad_id,
      COUNT(DISTINCT ad.bitrix_deal_id)::int AS leads_crm,
      COALESCE(SUM(ad.valor), 0)::numeric    AS valor_gerado
    FROM attributed_deals ad
    GROUP BY ad.ad_id
  ),
  -- Etapas válidas do funil comercial (pipeline 0 + fechamento/venda em C3/C5)
  commercial_stages AS (
    SELECT
      sm.stage_id,
      sm.funnel_step,
      sm.step_rank,
      CASE sm.funnel_step
        WHEN 'novo' THEN 'Novo'
        WHEN 'qualificado' THEN 'Qualificado'
        WHEN 'tentativa' THEN 'Tentativa'
        WHEN 'contatado' THEN 'Contatado'
        WHEN 'negociacao' THEN 'Negociação'
        WHEN 'venda' THEN 'Venda'
        ELSE COALESCE(sm.label, sm.funnel_step)
      END AS step_label
    FROM public.bitrix_stage_map sm
    WHERE sm.funnel_step IS NOT NULL
      AND COALESCE(sm.step_rank, 0) >= 1
      AND (
        sm.stage_id !~ '^C\d+:'
        OR (sm.stage_id ~ '^C(3|5):' AND sm.step_rank = 6)
      )
  ),
  canonical_steps AS (
    SELECT DISTINCT ON (cs.step_rank)
      cs.step_rank,
      cs.funnel_step AS step_name,
      cs.step_label  AS label
    FROM commercial_stages cs
    ORDER BY cs.step_rank ASC
  ),
  deal_best_rank AS (
    SELECT
      ad.bitrix_deal_id,
      ad.ad_id,
      GREATEST(
        COALESCE(cs_cur.step_rank, 0),
        COALESCE(MAX(cs_hist.step_rank), 0)
      ) AS max_rank
    FROM attributed_deals ad
    LEFT JOIN commercial_stages cs_cur ON cs_cur.stage_id = ad.fase
    LEFT JOIN public.bitrix_stage_history bsh ON bsh.deal_id = ad.bitrix_deal_id
    LEFT JOIN commercial_stages cs_hist ON cs_hist.stage_id = bsh.stage_id
    GROUP BY ad.bitrix_deal_id, ad.ad_id, cs_cur.step_rank
  ),
  ad_step_counts AS (
    SELECT
      dbr.ad_id,
      st.step_name,
      st.step_rank,
      COUNT(DISTINCT dbr.bitrix_deal_id) FILTER (WHERE dbr.max_rank >= st.step_rank)::int AS deal_count,
      COUNT(DISTINCT dbr.bitrix_deal_id)::int AS total_deals
    FROM deal_best_rank dbr
    CROSS JOIN canonical_steps st
    GROUP BY dbr.ad_id, st.step_name, st.step_rank
  ),
  ad_funnel_json AS (
    SELECT
      asc_row.ad_id,
      jsonb_object_agg(asc_row.step_name, asc_row.deal_count ORDER BY asc_row.step_rank) AS funnel_counts,
      jsonb_object_agg(
        asc_row.step_name,
        CASE
          WHEN asc_row.total_deals > 0
            THEN ROUND((asc_row.deal_count::numeric / asc_row.total_deals) * 100, 1)
          ELSE 0
        END
        ORDER BY asc_row.step_rank
      ) AS funnel_rates
    FROM ad_step_counts asc_row
    GROUP BY asc_row.ad_id
  ),
  assembled AS (
    SELECT
      ma.id AS ad_id,
      COALESCE(ma.name, ma.id) AS ad_name,
      COALESCE(ma.creative_id, ma.id) AS creative_id,
      ma.account_id,
      ma.adset_id,
      COALESCE(mas.name, ma.adset_id, '—') AS adset_name,
      ma.campaign_id,
      COALESCE(mc.name, ma.campaign_id, '—') AS campaign_name,
      mc.objective,
      COALESCE(ma.effective_status, ma.status) AS ad_status,
      COALESCE(mas.effective_status, mas.status) AS adset_status,
      COALESCE(mc.effective_status, mc.status) AS campaign_status,
      (
        COALESCE(ma.effective_status, '') = 'ACTIVE'
        AND COALESCE(mas.effective_status, '') = 'ACTIVE'
        AND COALESCE(mc.effective_status, '') = 'ACTIVE'
      ) AS is_serving_now,
      COALESCE(mcr.thumbnail_url, mcr.image_url) AS thumbnail_url,
      COALESCE(mcr.image_url, mcr.thumbnail_url) AS image_url,
      mcr.title,
      mcr.body,
      mcr.link_url,
      COALESCE(ins.spend, 0)::numeric       AS spend,
      COALESCE(ins.impressions, 0)::bigint  AS impressions,
      COALESCE(ins.reach, 0)::bigint        AS reach,
      COALESCE(ins.clicks, 0)::bigint       AS clicks,
      COALESCE(ins.link_clicks, 0)::bigint  AS link_clicks,
      COALESCE(ins.leads_meta, 0)::int      AS leads_meta,
      COALESCE(crm.leads_crm, 0)::int       AS leads_crm,
      CASE
        WHEN COALESCE(crm.leads_crm, 0) > 0 THEN crm.leads_crm
        ELSE COALESCE(ins.leads_meta, 0)
      END::int AS leads,
      COALESCE(crm.valor_gerado, 0)::numeric AS valor_gerado,
      afj.funnel_counts,
      afj.funnel_rates
    FROM public.meta_ads ma
    LEFT JOIN public.meta_adsets mas ON mas.id = ma.adset_id
    LEFT JOIN public.meta_campaigns mc ON mc.id = ma.campaign_id
    LEFT JOIN public.meta_creatives mcr ON mcr.creative_id = ma.creative_id
    LEFT JOIN ins_by_ad ins ON ins.ad_id = ma.id
    LEFT JOIN crm_by_ad crm ON crm.ad_id = ma.id
    LEFT JOIN ad_funnel_json afj ON afj.ad_id = ma.id
    WHERE (
      (
        COALESCE(ma.effective_status, '') = 'ACTIVE'
        AND COALESCE(mas.effective_status, '') = 'ACTIVE'
        AND COALESCE(mc.effective_status, '') = 'ACTIVE'
      )
      OR COALESCE(ins.spend, 0) > 0
      OR COALESCE(ins.impressions, 0) > 0
      OR COALESCE(crm.leads_crm, 0) > 0
      OR COALESCE(ins.leads_meta, 0) > 0
    )
  ),
  enriched AS (
    SELECT
      a.*,
      CASE WHEN a.leads > 0 AND a.valor_gerado > 0 THEN ROUND(a.valor_gerado / a.leads, 2) ELSE NULL END AS ticket_medio,
      CASE WHEN a.spend > 0 THEN ROUND(a.valor_gerado / a.spend, 4) ELSE NULL END AS roas,
      CASE WHEN a.leads > 0 THEN ROUND(a.spend / a.leads, 2) ELSE NULL END AS cpl,
      CASE WHEN a.impressions > 0 THEN ROUND((a.clicks::numeric / a.impressions) * 100, 4) ELSE 0 END AS ctr,
      CASE WHEN a.clicks > 0 THEN ROUND(a.spend / a.clicks, 4) ELSE 0 END AS cpc,
      CASE WHEN a.impressions > 0 THEN ROUND((a.spend / a.impressions) * 1000, 4) ELSE 0 END AS cpm,
      COALESCE(a.funnel_counts, '{}'::jsonb) AS funnel
    FROM assembled a
  )
SELECT jsonb_build_object(
  'ads', COALESCE((SELECT jsonb_agg(row_to_json(e) ORDER BY e.spend DESC, e.leads DESC, e.valor_gerado DESC) FROM enriched e), '[]'::jsonb),
  'creatives', COALESCE((SELECT jsonb_agg(row_to_json(e) ORDER BY e.spend DESC, e.leads DESC, e.valor_gerado DESC) FROM enriched e), '[]'::jsonb),
  'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object('step_name', cs.step_name, 'label', cs.label, 'step_rank', cs.step_rank) ORDER BY cs.step_rank) FROM canonical_steps cs), '[]'::jsonb),
  'funnel_steps', COALESCE((SELECT jsonb_agg(jsonb_build_object('step', cs.step_name, 'stage', cs.label, 'step_rank', cs.step_rank) ORDER BY cs.step_rank) FROM canonical_steps cs), '[]'::jsonb),
  'total', (
    SELECT jsonb_build_object(
      'active_now_count', COUNT(*) FILTER (WHERE is_serving_now),
      'with_spend_count', COUNT(*) FILTER (WHERE spend > 0),
      'spend', COALESCE(SUM(spend), 0),
      'impressions', COALESCE(SUM(impressions), 0),
      'clicks', COALESCE(SUM(clicks), 0),
      'leads', COALESCE(SUM(leads), 0),
      'valor', COALESCE(SUM(valor_gerado), 0)
    )
    FROM enriched
  )
);
$fn$;

GRANT EXECUTE ON FUNCTION public.get_creatives_performance(timestamptz, timestamptz)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) RPC public.get_creatives_funnel alinhada ao CreativesFunnelCard (sem fan-out)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_creatives_funnel(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_creatives_funnel(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH
  date_bounds AS (
    SELECT
      (p_from AT TIME ZONE 'America/Sao_Paulo')::date AS start_day,
      (p_to   AT TIME ZONE 'America/Sao_Paulo')::date AS end_day
  ),
  ins_by_ad AS (
    SELECT
      i.ad_id,
      COALESCE(SUM(COALESCE(i.spend, 0)), 0)::numeric      AS spend,
      COALESCE(SUM(COALESCE(i.impressions, 0)), 0)::bigint AS impressions,
      COALESCE(SUM(COALESCE(i.clicks, 0)), 0)::bigint      AS clicks,
      COALESCE(SUM(COALESCE(i.reach, 0)), 0)::bigint       AS reach
    FROM public.meta_ad_insights i
    CROSS JOIN date_bounds db
    WHERE i.date_start >= db.start_day
      AND i.date_start <= db.end_day
    GROUP BY i.ad_id
  ),
  matched_lead AS (
    SELECT DISTINCT ON (lm.bitrix_deal_id)
      lm.bitrix_deal_id,
      NULLIF(lm.ad_id, '') AS ad_id
    FROM public.lead_match lm
    WHERE lm.ad_id IS NOT NULL AND lm.ad_id <> ''
    ORDER BY lm.bitrix_deal_id, lm.matched_at DESC
  ),
  attributed_deals AS (
    SELECT DISTINCT ON (uc.bitrix_deal_id)
      uc.bitrix_deal_id,
      COALESCE(ml.ad_id, NULLIF(uc.ad_id_meta, ''), NULLIF(uc.ad_id, '')) AS ad_id,
      COALESCE(uc.valor, 0)::numeric AS valor,
      uc.fase,
      COALESCE(uc.origem, 'Meta') AS origem
    FROM public.utm_conversions uc
    LEFT JOIN matched_lead ml ON ml.bitrix_deal_id = uc.bitrix_deal_id
    WHERE uc.data_criacao >= p_from
      AND uc.data_criacao <= p_to
      AND COALESCE(ml.ad_id, NULLIF(uc.ad_id_meta, ''), NULLIF(uc.ad_id, '')) IS NOT NULL
    ORDER BY uc.bitrix_deal_id, uc.data_criacao ASC
  ),
  crm_by_ad AS (
    SELECT
      ad.ad_id,
      COUNT(DISTINCT ad.bitrix_deal_id)::int AS leads,
      COUNT(DISTINCT ad.bitrix_deal_id) FILTER (WHERE ad.origem = 'Meta')::int AS leads_meta,
      COUNT(DISTINCT ad.bitrix_deal_id) FILTER (WHERE ad.origem <> 'Meta')::int AS leads_outros,
      COALESCE(SUM(ad.valor) FILTER (WHERE ad.origem = 'Meta'), 0)::numeric AS valor_meta,
      COALESCE(SUM(ad.valor) FILTER (WHERE ad.origem <> 'Meta'), 0)::numeric AS valor_outros
    FROM attributed_deals ad
    GROUP BY ad.ad_id
  ),
  commercial_stages AS (
    SELECT
      sm.stage_id,
      sm.funnel_step,
      sm.step_rank
    FROM public.bitrix_stage_map sm
    WHERE sm.funnel_step IS NOT NULL
      AND COALESCE(sm.step_rank, 0) >= 1
      AND (
        sm.stage_id !~ '^C\d+:'
        OR (sm.stage_id ~ '^C(3|5):' AND sm.step_rank = 6)
      )
  ),
  canonical_steps AS (
    SELECT DISTINCT ON (cs.step_rank)
      cs.step_rank AS rank,
      cs.funnel_step AS step
    FROM commercial_stages cs
    ORDER BY cs.step_rank ASC
  ),
  deal_best_rank AS (
    SELECT
      ad.bitrix_deal_id,
      ad.ad_id,
      GREATEST(
        COALESCE(cs_cur.step_rank, 0),
        COALESCE(MAX(cs_hist.step_rank), 0)
      ) AS max_rank
    FROM attributed_deals ad
    LEFT JOIN commercial_stages cs_cur ON cs_cur.stage_id = ad.fase
    LEFT JOIN public.bitrix_stage_history bsh ON bsh.deal_id = ad.bitrix_deal_id
    LEFT JOIN commercial_stages cs_hist ON cs_hist.stage_id = bsh.stage_id
    GROUP BY ad.bitrix_deal_id, ad.ad_id, cs_cur.step_rank
  ),
  ad_funnel AS (
    SELECT
      s.ad_id,
      jsonb_object_agg(
        s.step,
        jsonb_build_object(
          'total', s.deal_count,
          'pct', CASE WHEN s.total_deals > 0 THEN ROUND((s.deal_count::numeric / s.total_deals) * 100, 1) ELSE NULL END,
          'step_rank', s.rank
        )
        ORDER BY s.rank
      ) AS funnel_rates
    FROM (
      SELECT
        dbr.ad_id,
        cs.step,
        cs.rank,
        COUNT(DISTINCT dbr.bitrix_deal_id) FILTER (WHERE dbr.max_rank >= cs.rank)::int AS deal_count,
        COUNT(DISTINCT dbr.bitrix_deal_id)::int AS total_deals
      FROM deal_best_rank dbr
      CROSS JOIN canonical_steps cs
      GROUP BY dbr.ad_id, cs.step, cs.rank
    ) s
    GROUP BY s.ad_id
  ),
  combined AS (
    SELECT
      ma.id AS ad_id,
      COALESCE(ma.name, ma.id) AS ad_name,
      ma.adset_id,
      ma.campaign_id,
      mc.name AS campaign_name,
      COALESCE(ins.spend, 0)::numeric AS spend,
      COALESCE(ins.impressions, 0)::bigint AS impressions,
      COALESCE(ins.clicks, 0)::bigint AS clicks,
      COALESCE(ins.reach, 0)::bigint AS reach,
      COALESCE(crm.leads, 0)::int AS leads,
      COALESCE(crm.leads_meta, 0)::int AS leads_meta,
      COALESCE(crm.leads_outros, 0)::int AS leads_outros,
      (COALESCE(crm.valor_meta, 0) + COALESCE(crm.valor_outros, 0))::numeric AS valor_gerado,
      COALESCE(crm.valor_meta, 0)::numeric AS valor_meta,
      COALESCE(crm.valor_outros, 0)::numeric AS valor_outros,
      af.funnel_rates
    FROM public.meta_ads ma
    LEFT JOIN public.meta_campaigns mc ON mc.id = ma.campaign_id
    LEFT JOIN ins_by_ad ins ON ins.ad_id = ma.id
    LEFT JOIN crm_by_ad crm ON crm.ad_id = ma.id
    LEFT JOIN ad_funnel af ON af.ad_id = ma.id
    WHERE COALESCE(ins.spend, 0) > 0 OR COALESCE(crm.leads, 0) > 0
  )
SELECT jsonb_build_object(
  'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object('rank', cs.rank, 'step', cs.step) ORDER BY cs.rank) FROM canonical_steps cs), '[]'::jsonb),
  'ads', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'ad_id', c.ad_id,
        'ad_name', c.ad_name,
        'adset_id', c.adset_id,
        'campaign_id', c.campaign_id,
        'campaign_name', c.campaign_name,
        'spend', c.spend,
        'impressions', c.impressions,
        'clicks', c.clicks,
        'reach', c.reach,
        'leads', c.leads,
        'leads_meta', c.leads_meta,
        'leads_outros', c.leads_outros,
        'valor_gerado', c.valor_gerado,
        'valor_meta', c.valor_meta,
        'valor_outros', c.valor_outros,
        'ticket_medio', CASE WHEN c.leads > 0 AND c.valor_gerado > 0 THEN ROUND(c.valor_gerado / c.leads, 2) ELSE NULL END,
        'roas', CASE WHEN c.spend > 0 THEN ROUND(c.valor_gerado / c.spend, 4) ELSE NULL END,
        'cpl', CASE WHEN c.leads > 0 THEN ROUND(c.spend / c.leads, 2) ELSE NULL END,
        'ctr', CASE WHEN c.impressions > 0 THEN ROUND((c.clicks::numeric / c.impressions) * 100, 4) ELSE NULL END,
        'cpm', CASE WHEN c.impressions > 0 THEN ROUND((c.spend / c.impressions) * 1000, 4) ELSE NULL END,
        'funnel_rates', c.funnel_rates
      )
      ORDER BY c.valor_gerado DESC, c.spend DESC
    )
    FROM combined c
  ), '[]'::jsonb)
)::json;
$fn$;

GRANT EXECUTE ON FUNCTION public.get_creatives_funnel(timestamptz, timestamptz)
  TO anon, authenticated, service_role;

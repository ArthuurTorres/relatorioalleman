-- Restaura o schema que existia apenas no banco antigo (Lovable Cloud):
-- tabelas de Meta Ads, Google Ads, metas de leads, estado de sync e as RPCs
-- get_meta_performance / get_meta_detail / get_google_detail / list_unmapped_form_labels.
-- Idempotente: pode rodar mais de uma vez.

-- ---------------------------------------------------------------- tabelas

CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  name text,
  objective text,
  status text,
  effective_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  created_time timestamptz,
  updated_time timestamptz,
  start_time timestamptz,
  stop_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account ON public.meta_campaigns (account_id);

CREATE TABLE IF NOT EXISTS public.meta_adsets (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  campaign_id text NOT NULL,
  name text,
  status text,
  effective_status text,
  optimization_goal text,
  billing_event text,
  daily_budget numeric,
  lifetime_budget numeric,
  created_time timestamptz,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets (campaign_id);

CREATE TABLE IF NOT EXISTS public.meta_ads (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  name text,
  status text,
  effective_status text,
  creative_id text,
  created_time timestamptz,
  updated_time timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads (adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads (campaign_id);

CREATE TABLE IF NOT EXISTS public.meta_ad_insights (
  ad_id text NOT NULL,
  date_start date NOT NULL,
  account_id text NOT NULL,
  adset_id text,
  campaign_id text,
  spend numeric,
  impressions bigint,
  reach bigint,
  clicks bigint,
  inline_link_clicks bigint,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  frequency numeric,
  actions jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, date_start)
);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_date ON public.meta_ad_insights (date_start);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_campaign ON public.meta_ad_insights (campaign_id);

CREATE TABLE IF NOT EXISTS public.meta_sync_state (
  key text PRIMARY KEY,
  last_run timestamptz,
  last_status text,
  meta jsonb
);

CREATE TABLE IF NOT EXISTS public.sync_state (
  key text PRIMARY KEY,
  last_run timestamptz,
  last_status text,
  start_cursor integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_ads_campaign_daily (
  campaign_id text NOT NULL,
  date date NOT NULL,
  campaign_name text,
  status text,
  cost numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, date)
);
CREATE INDEX IF NOT EXISTS idx_google_ads_daily_date ON public.google_ads_campaign_daily (date);

CREATE TABLE IF NOT EXISTS public.lead_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  operadora text NOT NULL,
  meta_leads integer NOT NULL DEFAULT 0,
  match_terms text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, operadora)
);

CREATE TABLE IF NOT EXISTS public.meta_lead_form_map (
  form_label text PRIMARY KEY,
  campaign_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.private_settings (
  k text PRIMARY KEY,
  v text
);

GRANT SELECT ON public.meta_campaigns, public.meta_adsets, public.meta_ads,
  public.meta_ad_insights, public.meta_sync_state, public.sync_state,
  public.google_ads_campaign_daily, public.lead_goals,
  public.meta_lead_form_map TO anon, authenticated;
GRANT ALL ON public.meta_campaigns, public.meta_adsets, public.meta_ads,
  public.meta_ad_insights, public.meta_sync_state, public.sync_state,
  public.google_ads_campaign_daily, public.lead_goals,
  public.meta_lead_form_map, public.private_settings TO service_role;

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_campaign_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_form_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read meta_campaigns" ON public.meta_campaigns;
CREATE POLICY "read meta_campaigns" ON public.meta_campaigns FOR SELECT USING (true);
DROP POLICY IF EXISTS "read meta_adsets" ON public.meta_adsets;
CREATE POLICY "read meta_adsets" ON public.meta_adsets FOR SELECT USING (true);
DROP POLICY IF EXISTS "read meta_ads" ON public.meta_ads;
CREATE POLICY "read meta_ads" ON public.meta_ads FOR SELECT USING (true);
DROP POLICY IF EXISTS "read meta_ad_insights" ON public.meta_ad_insights;
CREATE POLICY "read meta_ad_insights" ON public.meta_ad_insights FOR SELECT USING (true);
DROP POLICY IF EXISTS "read meta_sync_state" ON public.meta_sync_state;
CREATE POLICY "read meta_sync_state" ON public.meta_sync_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "read sync_state" ON public.sync_state;
CREATE POLICY "read sync_state" ON public.sync_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "read google_ads_campaign_daily" ON public.google_ads_campaign_daily;
CREATE POLICY "read google_ads_campaign_daily" ON public.google_ads_campaign_daily FOR SELECT USING (true);
DROP POLICY IF EXISTS "read lead_goals" ON public.lead_goals;
CREATE POLICY "read lead_goals" ON public.lead_goals FOR SELECT USING (true);
DROP POLICY IF EXISTS "read meta_lead_form_map" ON public.meta_lead_form_map;
CREATE POLICY "read meta_lead_form_map" ON public.meta_lead_form_map FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_lead_goals_updated_at ON public.lead_goals;
CREATE TRIGGER trg_lead_goals_updated_at BEFORE UPDATE ON public.lead_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extensão usada nas funções de match de leads (lower(unaccent(...))).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Garante as colunas que as migrations antigas já previam em utm_conversions.
ALTER TABLE public.utm_conversions
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS adset_id_meta text,
  ADD COLUMN IF NOT EXISTS ad_id_meta text,
  ADD COLUMN IF NOT EXISTS campaign_name_meta text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS site_source_name text,
  ADD COLUMN IF NOT EXISTS url_pagina text,
  ADD COLUMN IF NOT EXISTS id_formulario text,
  ADD COLUMN IF NOT EXISTS nome_formulario text,
  ADD COLUMN IF NOT EXISTS contato_nome text,
  ADD COLUMN IF NOT EXISTS contato_telefone text,
  ADD COLUMN IF NOT EXISTS contato_telefone_norm text,
  ADD COLUMN IF NOT EXISTS contato_email text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

-- O sync do Bitrix faz upsert por bitrix_deal_id: precisa da constraint única.
CREATE UNIQUE INDEX IF NOT EXISTS utm_conversions_bitrix_deal_id_key
  ON public.utm_conversions (bitrix_deal_id);

-- ---------------------------------------------------------------- funções

DROP FUNCTION IF EXISTS public.list_unmapped_form_labels();
CREATE OR REPLACE FUNCTION public.list_unmapped_form_labels()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.leads DESC), '[]'::jsonb)
  FROM (
    SELECT
      c.nome_formulario AS form_label,
      count(DISTINCT c.bitrix_deal_id)::int AS leads,
      max(c.data_criacao)::text AS ultimo,
      k.id AS suggested_campaign_id,
      k.name AS suggested_campaign_name,
      CASE
        WHEN k.id IS NOT NULL THEN 'auto'
        ELSE NULL
      END AS match_source
    FROM public.utm_conversions c
    LEFT JOIN public.meta_lead_form_map m ON m.form_label = c.nome_formulario
    LEFT JOIN LATERAL (
      SELECT mc.id, mc.name
      FROM public.meta_campaigns mc
      WHERE mc.name = c.utm_campaign
      LIMIT 1
    ) k ON true
    WHERE COALESCE(c.nome_formulario, '') <> ''
      AND m.form_label IS NULL
    GROUP BY c.nome_formulario, k.id, k.name
  ) t;
$$;

DROP FUNCTION IF EXISTS public.get_meta_performance(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.get_meta_performance(
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH ins AS (
  SELECT
    i.ad_id, i.adset_id, i.campaign_id, i.date_start::date AS dia,
    COALESCE(i.spend, 0)::numeric AS spend,
    COALESCE(i.impressions, 0)::bigint AS impressions,
    COALESCE(i.clicks, 0)::bigint AS clicks,
    COALESCE(i.inline_link_clicks, 0)::bigint AS link_clicks,
    COALESCE(i.reach, 0)::bigint AS reach
  FROM public.meta_ad_insights i
  WHERE i.date_start >= (p_from AT TIME ZONE 'America/Sao_Paulo')::date
    AND i.date_start <= (p_to AT TIME ZONE 'America/Sao_Paulo')::date
    AND EXISTS (
      SELECT 1 FROM public.meta_campaigns mc WHERE mc.id = i.campaign_id
    )
),
tot AS (
  SELECT
    COALESCE(SUM(spend), 0) AS spend,
    COALESCE(SUM(impressions), 0) AS impressions,
    COALESCE(SUM(clicks), 0) AS clicks,
    COALESCE(SUM(reach), 0) AS reach
  FROM ins
),
-- leads do CRM casados com o anúncio (origem Meta)
-- o Bitrix não traz campaign_id/adset_id/ad_id; a atribuição vem do lead_match
-- (casamento por telefone com o formulário da Meta)
matched AS (
  SELECT DISTINCT ON (lm.bitrix_deal_id)
    lm.bitrix_deal_id, lm.campaign_id, lm.adset_id, lm.ad_id
  FROM public.lead_match lm
  ORDER BY lm.bitrix_deal_id, lm.matched_at DESC
),
deals AS (
  SELECT
    c.bitrix_deal_id,
    COALESCE(NULLIF(c.campaign_id, ''), m.campaign_id) AS campaign_id,
    COALESCE(NULLIF(c.adset_id, ''), m.adset_id) AS adset_id,
    COALESCE(NULLIF(c.ad_id, ''), m.ad_id) AS ad_id,
    COALESCE(c.valor, 0) AS valor
  FROM public.utm_conversions c
  LEFT JOIN matched m ON m.bitrix_deal_id = c.bitrix_deal_id
  WHERE c.data_criacao >= p_from
    AND c.data_criacao <= p_to
    AND c.origem IN ('Meta')
),
crm_campaign AS (
  SELECT campaign_id, count(DISTINCT bitrix_deal_id)::int AS leads, COALESCE(SUM(valor), 0) AS valor
  FROM deals WHERE campaign_id IS NOT NULL GROUP BY 1
),
crm_adset AS (
  SELECT adset_id, count(DISTINCT bitrix_deal_id)::int AS leads, COALESCE(SUM(valor), 0) AS valor
  FROM deals WHERE adset_id IS NOT NULL GROUP BY 1
),
crm_ad AS (
  SELECT ad_id, count(DISTINCT bitrix_deal_id)::int AS leads, COALESCE(SUM(valor), 0) AS valor
  FROM deals WHERE ad_id IS NOT NULL GROUP BY 1
),
-- leads que a própria Meta reporta (via insights actions lead)
meta_leads AS (
  SELECT
    i.ad_id,
    COALESCE(SUM(
      CASE WHEN a->>'action_type' IN ('lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped')
      THEN COALESCE((a->>'value')::numeric, 0) ELSE 0 END
    ), 0)::int AS leads
  FROM public.meta_ad_insights i
  LEFT JOIN LATERAL jsonb_array_elements(COALESCE(i.actions, '[]'::jsonb)) a ON true
  WHERE i.date_start >= (p_from AT TIME ZONE 'America/Sao_Paulo')::date
    AND i.date_start <= (p_to AT TIME ZONE 'America/Sao_Paulo')::date
  GROUP BY i.ad_id
),
daily AS (
  SELECT jsonb_agg(jsonb_build_object(
    'day', dia, 'spend', spend, 'impressions', impressions, 'clicks', clicks
  ) ORDER BY dia) AS data
  FROM (
    SELECT dia, SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks
    FROM ins GROUP BY dia
  ) d
),
-- agregados dos insights por nível (evita repetir leads/gasto no join)
ad_map AS (
  SELECT DISTINCT ad_id, adset_id, campaign_id FROM ins
),
camp_ins AS (
  SELECT campaign_id,
    SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks,
    SUM(link_clicks)::bigint AS link_clicks, SUM(reach)::bigint AS reach, SUM(spend) AS spend
  FROM ins GROUP BY 1
),
adset_ins AS (
  SELECT adset_id, campaign_id,
    SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks,
    SUM(link_clicks)::bigint AS link_clicks, SUM(reach)::bigint AS reach, SUM(spend) AS spend
  FROM ins GROUP BY 1, 2
),
ad_ins AS (
  SELECT ad_id, adset_id, campaign_id,
    SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks,
    SUM(link_clicks)::bigint AS link_clicks, SUM(reach)::bigint AS reach, SUM(spend) AS spend
  FROM ins GROUP BY 1, 2, 3
),
ml_campaign AS (
  SELECT m.campaign_id, SUM(ml.leads)::int AS leads
  FROM ad_map m JOIN meta_leads ml ON ml.ad_id = m.ad_id GROUP BY 1
),
ml_adset AS (
  SELECT m.adset_id, SUM(ml.leads)::int AS leads
  FROM ad_map m JOIN meta_leads ml ON ml.ad_id = m.ad_id GROUP BY 1
),
by_campaign AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.spend DESC) AS data
  FROM (
    SELECT
      i.campaign_id,
      COALESCE(mc.name, i.campaign_id) AS campaign_name,
      mc.effective_status AS status,
      mc.objective,
      i.impressions, i.clicks, i.spend,
      CASE WHEN i.impressions > 0 THEN i.clicks::numeric / i.impressions * 100 ELSE 0 END AS ctr,
      CASE WHEN i.clicks > 0 THEN i.spend / i.clicks ELSE 0 END AS cpc,
      COALESCE(c.leads, 0)::int AS leads,
      COALESCE(c.leads, 0)::int AS leads_crm,
      COALESCE(ml.leads, 0)::int AS leads_meta,
      COALESCE(c.valor, 0) AS valor_gerado,
      CASE WHEN COALESCE(c.leads, 0) > 0 THEN i.spend / c.leads ELSE NULL END AS cpl,
      CASE WHEN i.spend > 0 THEN COALESCE(c.valor, 0) / i.spend ELSE NULL END AS roas
    FROM camp_ins i
    LEFT JOIN public.meta_campaigns mc ON mc.id = i.campaign_id
    LEFT JOIN crm_campaign c ON c.campaign_id = i.campaign_id
    LEFT JOIN ml_campaign ml ON ml.campaign_id = i.campaign_id
  ) t
),
by_adset AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.spend DESC) AS data
  FROM (
    SELECT
      i.adset_id,
      COALESCE(a.name, i.adset_id) AS adset_name,
      COALESCE(mc.name, i.campaign_id) AS campaign_name,
      i.impressions, i.clicks, i.spend,
      CASE WHEN i.impressions > 0 THEN i.clicks::numeric / i.impressions * 100 ELSE 0 END AS ctr,
      COALESCE(c.leads, 0)::int AS leads,
      COALESCE(c.leads, 0)::int AS leads_crm,
      COALESCE(ml.leads, 0)::int AS leads_meta,
      COALESCE(c.valor, 0) AS valor_gerado,
      CASE WHEN COALESCE(c.leads, 0) > 0 THEN i.spend / c.leads ELSE NULL END AS cpl,
      CASE WHEN i.spend > 0 THEN COALESCE(c.valor, 0) / i.spend ELSE NULL END AS roas
    FROM adset_ins i
    LEFT JOIN public.meta_adsets a ON a.id = i.adset_id
    LEFT JOIN public.meta_campaigns mc ON mc.id = i.campaign_id
    LEFT JOIN crm_adset c ON c.adset_id = i.adset_id
    LEFT JOIN ml_adset ml ON ml.adset_id = i.adset_id
  ) t
),
by_ad AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.spend DESC) AS data
  FROM (
    SELECT
      i.ad_id,
      COALESCE(ad.name, i.ad_id) AS ad_name,
      COALESCE(a.name, '—') AS adset_name,
      COALESCE(mc.name, i.campaign_id) AS campaign_name,
      mc.effective_status AS campaign_status,
      i.impressions, i.clicks, i.link_clicks, i.reach, i.spend,
      CASE WHEN i.impressions > 0 THEN i.clicks::numeric / i.impressions * 100 ELSE 0 END AS ctr,
      CASE WHEN i.clicks > 0 THEN i.spend / i.clicks ELSE 0 END AS cpc,
      CASE WHEN i.impressions > 0 THEN i.spend / i.impressions * 1000 ELSE 0 END AS cpm,
      COALESCE(c.leads, 0)::int AS leads,
      COALESCE(c.leads, 0)::int AS leads_crm,
      COALESCE(ml.leads, 0)::int AS leads_meta,
      COALESCE(c.valor, 0) AS valor_gerado,
      CASE WHEN COALESCE(c.leads, 0) > 0 THEN i.spend / c.leads ELSE NULL END AS cpl,
      CASE WHEN i.spend > 0 THEN COALESCE(c.valor, 0) / i.spend ELSE NULL END AS roas
    FROM ad_ins i
    LEFT JOIN public.meta_ads ad ON ad.id = i.ad_id
    LEFT JOIN public.meta_adsets a ON a.id = i.adset_id
    LEFT JOIN public.meta_campaigns mc ON mc.id = i.campaign_id
    LEFT JOIN crm_ad c ON c.ad_id = i.ad_id
    LEFT JOIN meta_leads ml ON ml.ad_id = i.ad_id
  ) t
),
tot_leads AS (
  SELECT
    COALESCE((SELECT SUM(leads) FROM crm_campaign), 0)::int AS leads_total,
    COALESCE((SELECT SUM(leads) FROM meta_leads), 0)::int AS leads_meta_reported,
    COALESCE((SELECT SUM(valor) FROM crm_campaign), 0) AS valor_total
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'spend', tot.spend,
    'impressions', tot.impressions,
    'clicks', tot.clicks,
    'reach', tot.reach,
    'ctr', CASE WHEN tot.impressions > 0 THEN tot.clicks::numeric / tot.impressions * 100 ELSE 0 END,
    'cpc', CASE WHEN tot.clicks > 0 THEN tot.spend / tot.clicks ELSE 0 END,
    'cpm', CASE WHEN tot.impressions > 0 THEN tot.spend / tot.impressions * 1000 ELSE 0 END,
    'leads_total', tot_leads.leads_total,
    'leads_matched', tot_leads.leads_total,
    'leads_meta_reported', tot_leads.leads_meta_reported,
    'valor_total', tot_leads.valor_total,
    'cpl', CASE WHEN tot_leads.leads_total > 0 THEN tot.spend / tot_leads.leads_total ELSE NULL END,
    'cpl_meta', CASE WHEN tot_leads.leads_meta_reported > 0 THEN tot.spend / tot_leads.leads_meta_reported ELSE NULL END,
    'roas', CASE WHEN tot.spend > 0 THEN tot_leads.valor_total / tot.spend ELSE NULL END
  ),
  'daily', COALESCE(daily.data, '[]'::jsonb),
  'byCampaign', COALESCE(by_campaign.data, '[]'::jsonb),
  'byAdset', COALESCE(by_adset.data, '[]'::jsonb),
  'byAd', COALESCE(by_ad.data, '[]'::jsonb)
)
FROM tot, tot_leads, daily, by_campaign, by_adset, by_ad;
$function$;

DROP FUNCTION IF EXISTS public.get_meta_detail(timestamptz, timestamptz, text[], text[], text[]);
CREATE OR REPLACE FUNCTION public.get_meta_detail(
  p_from timestamptz,
  p_to timestamptz,
  p_utm_source text[] DEFAULT NULL::text[],
  p_utm_campaign text[] DEFAULT NULL::text[],
  p_dominio text[] DEFAULT NULL::text[]
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH matched AS (
  SELECT DISTINCT ON (lm.bitrix_deal_id)
    lm.bitrix_deal_id, lm.campaign_id, lm.adset_id, lm.ad_id,
    lm.campaign_name AS matched_campaign_name
  FROM public.lead_match lm
  ORDER BY lm.bitrix_deal_id, lm.matched_at DESC
),
-- o Bitrix não envia campaign_id/adset_id/ad_id; a atribuição vem do lead_match
f AS (
  SELECT
    c.data_criacao, c.valor, c.utm_source, c.utm_medium, c.utm_campaign,
    c.utm_content, c.utm_term, c.dominio, c.url_pagina, c.placement, c.site_source_name,
    COALESCE(NULLIF(c.campaign_id, ''), m.campaign_id) AS campaign_id,
    COALESCE(NULLIF(c.campaign_name, ''), mc.name, m.matched_campaign_name,
             NULLIF(c.campaign_name_meta, ''), NULLIF(c.utm_campaign, '')) AS campaign_name,
    COALESCE(NULLIF(c.adset_id, ''), m.adset_id) AS adset_id,
    COALESCE(mas.name, NULLIF(c.adset_name, '')) AS adset_name,
    COALESCE(NULLIF(c.ad_id, ''), m.ad_id) AS ad_id,
    COALESCE(mad.name, NULLIF(c.ad_name, '')) AS ad_name
  FROM public.utm_conversions c
  LEFT JOIN matched m ON m.bitrix_deal_id = c.bitrix_deal_id
  LEFT JOIN public.meta_campaigns mc ON mc.id = COALESCE(NULLIF(c.campaign_id, ''), m.campaign_id)
  LEFT JOIN public.meta_adsets mas ON mas.id = COALESCE(NULLIF(c.adset_id, ''), m.adset_id)
  LEFT JOIN public.meta_ads mad ON mad.id = COALESCE(NULLIF(c.ad_id, ''), m.ad_id)
  WHERE c.data_criacao >= p_from
    AND c.data_criacao <= p_to
    AND c.origem = 'Meta'
    AND (COALESCE(array_length(p_utm_source, 1), 0) = 0 OR c.utm_source = ANY(p_utm_source))
    AND (COALESCE(array_length(p_utm_campaign, 1), 0) = 0 OR c.utm_campaign = ANY(p_utm_campaign))
    AND (COALESCE(array_length(p_dominio, 1), 0) = 0 OR c.dominio = ANY(p_dominio))
),
summary AS (
  SELECT
    count(*)::int AS total,
    COALESCE(sum(valor), 0) AS valor_total,
    count(DISTINCT COALESCE(campaign_id, campaign_name))::int AS campanhas,
    count(DISTINCT COALESCE(ad_id, ad_name))::int AS anuncios
  FROM f
),
daily AS (
  SELECT jsonb_agg(jsonb_build_object('day', day, 'total', total, 'valor', valor) ORDER BY day) AS data
  FROM (
    SELECT (data_criacao AT TIME ZONE 'America/Sao_Paulo')::date::text AS day,
           count(*)::int AS total,
           COALESCE(sum(valor), 0) AS valor
    FROM f WHERE data_criacao IS NOT NULL
    GROUP BY 1
  ) d
),
by_campaign AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(campaign_name, campaign_id, '—') AS campaign,
      utm_source, utm_medium, utm_campaign,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, utm_source, utm_medium, utm_campaign
  ) t
),
by_adset AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(adset_name, adset_id, '—') AS adset,
      COALESCE(campaign_name, campaign_id, '—') AS campaign,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, 2
  ) t
),
by_ad AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(ad_name, ad_id, '—') AS ad,
      COALESCE(adset_name, '—') AS adset,
      COALESCE(campaign_name, campaign_id, '—') AS campaign,
      placement, site_source_name,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, 2, 3, placement, site_source_name
  ) t
),
by_utm AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT utm_source, utm_medium, utm_campaign, utm_content, utm_term,
           count(*)::int AS count, COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, 2, 3, 4, 5
  ) t
),
by_page AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT dominio, url_pagina, count(*)::int AS count
    FROM f
    WHERE dominio IS NOT NULL OR url_pagina IS NOT NULL
    GROUP BY 1, 2
  ) t
),
by_placement AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(NULLIF(placement, ''), '—') AS placement,
      COALESCE(NULLIF(site_source_name, ''), '—') AS site,
      count(*)::int AS count
    FROM f
    GROUP BY 1, 2
  ) t
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'total', summary.total,
    'valorTotal', summary.valor_total,
    'campanhas', summary.campanhas,
    'anuncios', summary.anuncios
  ),
  'daily', COALESCE(daily.data, '[]'::jsonb),
  'byCampaign', COALESCE(by_campaign.data, '[]'::jsonb),
  'byAdset', COALESCE(by_adset.data, '[]'::jsonb),
  'byAd', COALESCE(by_ad.data, '[]'::jsonb),
  'byUtm', COALESCE(by_utm.data, '[]'::jsonb),
  'byPage', COALESCE(by_page.data, '[]'::jsonb),
  'byPlacement', COALESCE(by_placement.data, '[]'::jsonb)
)
FROM summary, daily, by_campaign, by_adset, by_ad, by_utm, by_page, by_placement;
$function$;

DROP FUNCTION IF EXISTS public.get_google_detail(timestamptz, timestamptz, text[], text[], text[]);
CREATE OR REPLACE FUNCTION public.get_google_detail(
  p_from timestamptz,
  p_to timestamptz,
  p_utm_source text[] DEFAULT NULL::text[],
  p_utm_campaign text[] DEFAULT NULL::text[],
  p_dominio text[] DEFAULT NULL::text[]
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH f AS (
  SELECT c.*
  FROM public.utm_conversions c
  WHERE c.data_criacao >= p_from
    AND c.data_criacao <= p_to
    AND c.origem = 'Google'
    AND (COALESCE(array_length(p_utm_source, 1), 0) = 0 OR c.utm_source = ANY(p_utm_source))
    AND (COALESCE(array_length(p_utm_campaign, 1), 0) = 0 OR c.utm_campaign = ANY(p_utm_campaign))
    AND (COALESCE(array_length(p_dominio, 1), 0) = 0 OR c.dominio = ANY(p_dominio))
),
summary AS (
  SELECT
    count(*)::int AS total,
    COALESCE(sum(valor), 0) AS valor_total,
    count(DISTINCT COALESCE(campaign_name, utm_campaign))::int AS campanhas,
    count(DISTINCT COALESCE(utm_term, utm_content))::int AS termos,
    count(DISTINCT NULLIF(dominio, ''))::int AS dominios
  FROM f
),
daily AS (
  SELECT jsonb_agg(jsonb_build_object('day', day, 'total', total, 'valor', valor) ORDER BY day) AS data
  FROM (
    SELECT (data_criacao AT TIME ZONE 'America/Sao_Paulo')::date::text AS day,
           count(*)::int AS total,
           COALESCE(sum(valor), 0) AS valor
    FROM f WHERE data_criacao IS NOT NULL
    GROUP BY 1
  ) d
),
by_domain AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(NULLIF(dominio, ''), '—') AS dominio,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor,
      count(DISTINCT COALESCE(campaign_name, utm_campaign))::int AS campanhas,
      count(DISTINCT COALESCE(utm_term, utm_content))::int AS termos,
      max(data_criacao)::text AS ultimo
    FROM f
    GROUP BY 1
  ) t
),
by_domain_campaign AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(NULLIF(dominio, ''), '—') AS dominio,
      COALESCE(campaign_name, utm_campaign, '—') AS campaign,
      utm_source, utm_medium,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, 2, 3, 4
  ) t
),
by_term AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(NULLIF(dominio, ''), '—') AS dominio,
      COALESCE(NULLIF(utm_term, ''), NULLIF(utm_content, ''), '—') AS termo,
      COALESCE(campaign_name, utm_campaign, '—') AS campaign,
      count(*)::int AS count
    FROM f
    GROUP BY 1, 2, 3
  ) t
),
by_page AS (
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.count DESC) AS data
  FROM (
    SELECT
      COALESCE(NULLIF(dominio, ''), '—') AS dominio,
      COALESCE(url_pagina, '—') AS pagina,
      count(*)::int AS count,
      COALESCE(sum(valor), 0) AS valor
    FROM f
    GROUP BY 1, 2
  ) t
)
SELECT jsonb_build_object(
  'summary', jsonb_build_object(
    'total', summary.total,
    'valorTotal', summary.valor_total,
    'dominios', summary.dominios,
    'campanhas', summary.campanhas,
    'termos', summary.termos
  ),
  'daily', COALESCE(daily.data, '[]'::jsonb),
  'byDomain', COALESCE(by_domain.data, '[]'::jsonb),
  'byDomainCampaign', COALESCE(by_domain_campaign.data, '[]'::jsonb),
  'byTerm', COALESCE(by_term.data, '[]'::jsonb),
  'byPage', COALESCE(by_page.data, '[]'::jsonb)
)
FROM summary, daily, by_domain, by_domain_campaign, by_term, by_page;
$function$;

-- Base tables required by later migrations (functions reference these).
-- This migration must run BEFORE 20260918201001 which creates get_utm_dashboard_stats.
-- All CREATE TABLE use IF NOT EXISTS; policies are created only if they don't already exist.
-- Schemas match 20261110000000_restore_missing_schema.sql to prevent column-missing errors.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'utm_conversions') THEN
    CREATE TABLE public.utm_conversions (
      bitrix_deal_id text PRIMARY KEY,
      titulo text, fase text, valor numeric, origem text,
      utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
      dominio text, url_pagina text, id_formulario text, nome_formulario text,
      adset_id text, ad_id text, ad_name text, adset_name text, campaign_name text,
      placement text, site_source_name text,
      campaign_id text, adset_id_meta text, ad_id_meta text, campaign_name_meta text,
      contato_nome text, contato_telefone text, contato_telefone_norm text, contato_email text,
      fbclid text, data_criacao timestamptz, synced_at timestamptz DEFAULT now()
    );
  END IF;
END $$;
GRANT SELECT ON public.utm_conversions TO anon, authenticated;
GRANT ALL ON public.utm_conversions TO service_role;
ALTER TABLE public.utm_conversions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='utm_conversions' AND policyname='read utm_conversions') THEN CREATE POLICY "read utm_conversions" ON public.utm_conversions FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bitrix_deals') THEN
    CREATE TABLE public.bitrix_deals (
      id text PRIMARY KEY, title text, stage_id text, valor_total numeric,
      created_at timestamptz, updated_at timestamptz DEFAULT now(), raw jsonb
    );
  END IF;
END $$;
GRANT SELECT ON public.bitrix_deals TO anon, authenticated;
GRANT ALL ON public.bitrix_deals TO service_role;
ALTER TABLE public.bitrix_deals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bitrix_deals' AND policyname='read bitrix_deals') THEN CREATE POLICY "read bitrix_deals" ON public.bitrix_deals FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_campaigns') THEN
    CREATE TABLE public.meta_campaigns (
      id text PRIMARY KEY, account_id text NOT NULL, name text, objective text, status text, effective_status text,
      daily_budget numeric, lifetime_budget numeric, created_time timestamptz, updated_time timestamptz,
      start_time timestamptz, stop_time timestamptz, synced_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_account ON public.meta_campaigns (account_id);
GRANT SELECT ON public.meta_campaigns TO anon, authenticated;
GRANT ALL ON public.meta_campaigns TO service_role;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_campaigns' AND policyname='read meta_campaigns') THEN CREATE POLICY "read meta_campaigns" ON public.meta_campaigns FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_adsets') THEN
    CREATE TABLE public.meta_adsets (
      id text PRIMARY KEY, account_id text NOT NULL, campaign_id text NOT NULL, name text, status text, effective_status text,
      optimization_goal text, billing_event text, daily_budget numeric, lifetime_budget numeric,
      created_time timestamptz, updated_time timestamptz, synced_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets (campaign_id);
GRANT SELECT ON public.meta_adsets TO anon, authenticated;
GRANT ALL ON public.meta_adsets TO service_role;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_adsets' AND policyname='read meta_adsets') THEN CREATE POLICY "read meta_adsets" ON public.meta_adsets FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_ads') THEN
    CREATE TABLE public.meta_ads (
      id text PRIMARY KEY, account_id text NOT NULL, adset_id text NOT NULL, campaign_id text NOT NULL,
      name text, status text, effective_status text, creative_id text,
      created_time timestamptz, updated_time timestamptz, synced_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads (adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads (campaign_id);
GRANT SELECT ON public.meta_ads TO anon, authenticated;
GRANT ALL ON public.meta_ads TO service_role;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_ads' AND policyname='read meta_ads') THEN CREATE POLICY "read meta_ads" ON public.meta_ads FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_ad_insights') THEN
    CREATE TABLE public.meta_ad_insights (
      ad_id text NOT NULL, date_start date NOT NULL, account_id text NOT NULL, campaign_id text, adset_id text,
      impressions bigint, clicks bigint, spend numeric, reach bigint, frequency numeric,
      actions jsonb, action_values jsonb, cost_per_action_type jsonb,
      inline_link_clicks bigint, outbound_clicks bigint, ctr numeric, cpc numeric, cpm numeric,
      synced_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ad_id, date_start)
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_date ON public.meta_ad_insights (date_start);
GRANT SELECT ON public.meta_ad_insights TO anon, authenticated;
GRANT ALL ON public.meta_ad_insights TO service_role;
ALTER TABLE public.meta_ad_insights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_ad_insights' AND policyname='read meta_ad_insights') THEN CREATE POLICY "read meta_ad_insights" ON public.meta_ad_insights FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_leads') THEN
    CREATE TABLE public.meta_leads (
      lead_id text PRIMARY KEY,
      form_id text, form_name text,
      campaign_id text, campaign_name text,
      adset_id text, adset_name text,
      ad_id text, ad_name text,
      created_time timestamptz,
      nome text, telefone_raw text, telefone_norm text,
      email text, cidade text, respostas jsonb,
      synced_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meta_leads_phone ON public.meta_leads (telefone_norm);
CREATE INDEX IF NOT EXISTS idx_meta_leads_created ON public.meta_leads (created_time);
GRANT SELECT ON public.meta_leads TO anon, authenticated;
GRANT ALL ON public.meta_leads TO service_role;
ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_leads' AND policyname='read meta_leads') THEN CREATE POLICY "read meta_leads" ON public.meta_leads FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'lead_match') THEN
    CREATE TABLE public.lead_match (
      bitrix_deal_id text PRIMARY KEY REFERENCES public.bitrix_deals(id),
      meta_lead_id text REFERENCES public.meta_leads(lead_id),
      campaign_id text, campaign_name text, adset_id text, ad_id text,
      match_source text, matched_at timestamptz DEFAULT now()
    );
  END IF;
END $$;
GRANT SELECT ON public.lead_match TO anon, authenticated;
GRANT ALL ON public.lead_match TO service_role;
ALTER TABLE public.lead_match ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_match' AND policyname='read lead_match') THEN CREATE POLICY "read lead_match" ON public.lead_match FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_lead_forms') THEN
    CREATE TABLE public.meta_lead_forms (form_id text PRIMARY KEY, name text, created_time timestamptz, synced_at timestamptz DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.meta_lead_forms TO anon, authenticated;
GRANT ALL ON public.meta_lead_forms TO service_role;
ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_lead_forms' AND policyname='read meta_lead_forms') THEN CREATE POLICY "read meta_lead_forms" ON public.meta_lead_forms FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bitrix_stage_map') THEN
    CREATE TABLE public.bitrix_stage_map (stage_id text PRIMARY KEY, funnel_step text, step_rank integer, label text, updated_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.bitrix_stage_map TO anon, authenticated;
GRANT ALL ON public.bitrix_stage_map TO service_role;
ALTER TABLE public.bitrix_stage_map ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bitrix_stage_map' AND policyname='read bitrix_stage_map') THEN CREATE POLICY "read bitrix_stage_map" ON public.bitrix_stage_map FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'campaign_lead_map') THEN
    CREATE TABLE public.campaign_lead_map (campaign_id text PRIMARY KEY, source text, label text, priority integer DEFAULT 0);
  END IF;
END $$;
GRANT SELECT ON public.campaign_lead_map TO anon, authenticated;
GRANT ALL ON public.campaign_lead_map TO service_role;
ALTER TABLE public.campaign_lead_map ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaign_lead_map' AND policyname='read campaign_lead_map') THEN CREATE POLICY "read campaign_lead_map" ON public.campaign_lead_map FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bitrix_pipelines') THEN
    CREATE TABLE public.bitrix_pipelines (id text PRIMARY KEY, name text NOT NULL, sort integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.bitrix_pipelines TO anon, authenticated;
GRANT ALL ON public.bitrix_pipelines TO service_role;
ALTER TABLE public.bitrix_pipelines ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bitrix_pipelines' AND policyname='read bitrix_pipelines') THEN CREATE POLICY "read bitrix_pipelines" ON public.bitrix_pipelines FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bitrix_stages') THEN
    CREATE TABLE public.bitrix_stages (stage_id text PRIMARY KEY, pipeline_id text NOT NULL, name text NOT NULL, sort integer NOT NULL DEFAULT 0, semantics text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.bitrix_stages TO anon, authenticated;
GRANT ALL ON public.bitrix_stages TO service_role;
ALTER TABLE public.bitrix_stages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bitrix_stages' AND policyname='read bitrix_stages') THEN CREATE POLICY "read bitrix_stages" ON public.bitrix_stages FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bitrix_stage_history') THEN
    CREATE TABLE public.bitrix_stage_history (
      id bigint PRIMARY KEY,
      deal_id text NOT NULL,
      category_id integer,
      stage_id text NOT NULL,
      semantics text,
      changed_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bsh_deal ON public.bitrix_stage_history (deal_id);
CREATE INDEX IF NOT EXISTS idx_bsh_changed ON public.bitrix_stage_history (changed_at);
CREATE INDEX IF NOT EXISTS idx_bsh_stage ON public.bitrix_stage_history (stage_id);
GRANT SELECT ON public.bitrix_stage_history TO anon, authenticated;
GRANT ALL ON public.bitrix_stage_history TO service_role;
ALTER TABLE public.bitrix_stage_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bitrix_stage_history' AND policyname='leitura publica bitrix_stage_history') THEN CREATE POLICY "leitura publica bitrix_stage_history" ON public.bitrix_stage_history FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_sync_state') THEN
    CREATE TABLE public.meta_sync_state (key text PRIMARY KEY DEFAULT 'default', last_sync timestamptz, synced_count integer DEFAULT 0);
  END IF;
END $$;
GRANT SELECT ON public.meta_sync_state TO anon, authenticated;
GRANT ALL ON public.meta_sync_state TO service_role;
ALTER TABLE public.meta_sync_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_sync_state' AND policyname='read meta_sync_state') THEN CREATE POLICY "read meta_sync_state" ON public.meta_sync_state FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'sync_state') THEN
    CREATE TABLE public.sync_state (key text PRIMARY KEY DEFAULT 'default', last_sync timestamptz, synced_count integer DEFAULT 0);
  END IF;
END $$;
GRANT SELECT ON public.sync_state TO anon, authenticated;
GRANT ALL ON public.sync_state TO service_role;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_state' AND policyname='read sync_state') THEN CREATE POLICY "read sync_state" ON public.sync_state FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'google_ads_campaign_daily') THEN
    CREATE TABLE public.google_ads_campaign_daily (
      campaign_id text NOT NULL, campaign_name text, date date NOT NULL,
      impressions bigint, clicks bigint, conversions numeric, spend numeric,
      synced_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (campaign_id, date)
    );
  END IF;
END $$;
GRANT SELECT ON public.google_ads_campaign_daily TO anon, authenticated;
GRANT ALL ON public.google_ads_campaign_daily TO service_role;
ALTER TABLE public.google_ads_campaign_daily ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='google_ads_campaign_daily' AND policyname='read google_ads_campaign_daily') THEN CREATE POLICY "read google_ads_campaign_daily" ON public.google_ads_campaign_daily FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'lead_goals') THEN
    CREATE TABLE public.lead_goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), month text NOT NULL, goal integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.lead_goals TO anon, authenticated;
GRANT ALL ON public.lead_goals TO service_role;
ALTER TABLE public.lead_goals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='lead_goals' AND policyname='read lead_goals') THEN CREATE POLICY "read lead_goals" ON public.lead_goals FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_lead_form_map') THEN
    CREATE TABLE public.meta_lead_form_map (form_label text PRIMARY KEY, campaign_id text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  END IF;
END $$;
GRANT SELECT ON public.meta_lead_form_map TO anon, authenticated;
GRANT ALL ON public.meta_lead_form_map TO service_role;
ALTER TABLE public.meta_lead_form_map ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_lead_form_map' AND policyname='read meta_lead_form_map') THEN CREATE POLICY "read meta_lead_form_map" ON public.meta_lead_form_map FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'private_settings') THEN
    CREATE TABLE public.private_settings (k text PRIMARY KEY, v text);
  END IF;
END $$;
GRANT SELECT ON public.private_settings TO anon, authenticated;
GRANT ALL ON public.private_settings TO service_role;
ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='private_settings' AND policyname='read private_settings') THEN CREATE POLICY "read private_settings" ON public.private_settings FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'sync_meta_state') THEN
    CREATE TABLE public.sync_meta_state (key text PRIMARY KEY DEFAULT 'default', last_sync timestamptz, meta_leads integer DEFAULT 0, sync_finished boolean DEFAULT false);
  END IF;
END $$;
GRANT SELECT ON public.sync_meta_state TO anon, authenticated;
GRANT ALL ON public.sync_meta_state TO service_role;
ALTER TABLE public.sync_meta_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_meta_state' AND policyname='read sync_meta_state') THEN CREATE POLICY "read sync_meta_state" ON public.sync_meta_state FOR SELECT USING (true); END IF; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'meta_creatives') THEN
    CREATE TABLE public.meta_creatives (
      creative_id text PRIMARY KEY,
      account_id text,
      image_url text, thumbnail_url text, body text, title text, link_url text,
      object_type text, created_at timestamptz DEFAULT now()
    );
  END IF;
END $$;
GRANT SELECT ON public.meta_creatives TO anon, authenticated;
GRANT ALL ON public.meta_creatives TO service_role;
ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meta_creatives' AND policyname='read meta_creatives') THEN CREATE POLICY "read meta_creatives" ON public.meta_creatives FOR SELECT USING (true); END IF; END $$;
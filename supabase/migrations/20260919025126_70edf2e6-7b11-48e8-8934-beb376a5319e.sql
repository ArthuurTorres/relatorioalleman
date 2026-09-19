CREATE OR REPLACE FUNCTION public.norm_phone(_v text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(COALESCE(_v,''), '\D', '', 'g');
  IF length(d) >= 12 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) < 10 THEN RETURN NULL; END IF;
  RETURN left(d, length(d) - 8) || right(d, 8);
END; $$;

CREATE TABLE IF NOT EXISTS public.meta_lead_forms (
  id text PRIMARY KEY,
  name text,
  page_id text,
  leads_count bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_lead_forms TO anon, authenticated;
GRANT ALL ON public.meta_lead_forms TO service_role;
ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read meta_lead_forms" ON public.meta_lead_forms FOR SELECT USING (true);
CREATE TRIGGER touch_meta_lead_forms BEFORE UPDATE ON public.meta_lead_forms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.meta_leads (
  lead_id text PRIMARY KEY,
  form_id text,
  form_name text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  created_time timestamptz,
  nome text,
  telefone_raw text,
  telefone_norm text,
  email text,
  cidade text,
  respostas jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_leads TO anon, authenticated;
GRANT ALL ON public.meta_leads TO service_role;
ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read meta_leads" ON public.meta_leads FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_meta_leads_phone ON public.meta_leads (telefone_norm);
CREATE INDEX IF NOT EXISTS idx_meta_leads_email ON public.meta_leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_meta_leads_campaign ON public.meta_leads (campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_created ON public.meta_leads (created_time);
CREATE INDEX IF NOT EXISTS idx_meta_leads_nome ON public.meta_leads (lower(nome));

ALTER TABLE public.utm_conversions
  ADD COLUMN IF NOT EXISTS contato_nome text,
  ADD COLUMN IF NOT EXISTS contato_telefone text,
  ADD COLUMN IF NOT EXISTS contato_telefone_norm text,
  ADD COLUMN IF NOT EXISTS contato_email text;
CREATE INDEX IF NOT EXISTS idx_utm_contato_phone ON public.utm_conversions (contato_telefone_norm);
CREATE INDEX IF NOT EXISTS idx_utm_contato_email ON public.utm_conversions (lower(contato_email));

CREATE TABLE IF NOT EXISTS public.lead_match (
  bitrix_deal_id text PRIMARY KEY,
  meta_lead_id text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  ad_id text,
  match_source text NOT NULL,
  matched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_match TO anon, authenticated;
GRANT ALL ON public.lead_match TO service_role;
ALTER TABLE public.lead_match ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read lead_match" ON public.lead_match FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_lead_match_campaign ON public.lead_match (campaign_id);

CREATE OR REPLACE FUNCTION public.rebuild_lead_match()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  DELETE FROM public.lead_match;
  INSERT INTO public.lead_match (bitrix_deal_id, meta_lead_id, campaign_id, campaign_name, adset_id, ad_id, match_source)
  SELECT DISTINCT ON (c.bitrix_deal_id)
    c.bitrix_deal_id, m.lead_id, m.campaign_id, m.campaign_name, m.adset_id, m.ad_id, m.src
  FROM public.utm_conversions c
  JOIN LATERAL (
    SELECT l.lead_id, l.campaign_id, l.campaign_name, l.adset_id, l.ad_id, x.src, x.pri, l.created_time
    FROM (
      SELECT 1 AS pri, 'telefone'::text AS src
      UNION ALL SELECT 2, 'email'
      UNION ALL SELECT 3, 'nome'
    ) x
    JOIN public.meta_leads l ON (
      (x.pri = 1 AND c.contato_telefone_norm IS NOT NULL AND l.telefone_norm = c.contato_telefone_norm)
      OR (x.pri = 2 AND c.contato_email IS NOT NULL AND lower(l.email) = lower(c.contato_email))
      OR (x.pri = 3 AND c.contato_nome IS NOT NULL AND lower(unaccent(l.nome)) = lower(unaccent(c.contato_nome))
          AND l.created_time IS NOT NULL AND c.data_criacao IS NOT NULL
          AND c.data_criacao >= l.created_time - interval '1 day'
          AND c.data_criacao <= l.created_time + interval '7 days')
    )
    WHERE l.campaign_id IS NOT NULL
    ORDER BY x.pri, abs(extract(epoch from (c.data_criacao - l.created_time)))
    LIMIT 1
  ) m ON true
  ORDER BY c.bitrix_deal_id, m.pri;

  SELECT jsonb_build_object(
    'total', count(*),
    'telefone', count(*) FILTER (WHERE match_source = 'telefone'),
    'email', count(*) FILTER (WHERE match_source = 'email'),
    'nome', count(*) FILTER (WHERE match_source = 'nome')
  ) INTO res FROM public.lead_match;
  RETURN res;
END; $$;
GRANT EXECUTE ON FUNCTION public.rebuild_lead_match() TO service_role;

CREATE OR REPLACE FUNCTION public.resolved_campaign_leads(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(bitrix_deal_id text, titulo text, data_criacao timestamp with time zone, fase text, campaign_id text, campaign_name text, match_source text, funnel_step text, step_rank integer, stage_label text, valor numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.bitrix_deal_id,
         COALESCE(NULLIF(c.contato_nome,''), c.titulo) AS titulo,
         c.data_criacao, c.fase,
         r.campaign_id,
         COALESCE(mc.name, r.campaign_name, c.campaign_name_meta, c.campaign_name) AS campaign_name,
         r.match_source,
         COALESCE(s.funnel_step, 'sem_etapa') AS funnel_step,
         COALESCE(s.step_rank, -1) AS step_rank,
         COALESCE(s.label, c.fase) AS stage_label,
         c.valor
  FROM public.utm_conversions c
  LEFT JOIN LATERAL (
    SELECT x.campaign_id, x.campaign_name, x.match_source FROM (
      SELECT lm.campaign_id, lm.campaign_name, lm.match_source, 0 AS pri
        FROM public.lead_match lm WHERE lm.bitrix_deal_id = c.bitrix_deal_id
      UNION ALL
      SELECT NULLIF(c.campaign_id,''), NULL::text, 'id'::text, 1
      UNION ALL
      SELECT m.campaign_id, NULL, 'manual', 2 FROM public.campaign_lead_map m
        WHERE m.label IN (COALESCE(c.campaign_name_meta,''), COALESCE(c.utm_campaign,''), COALESCE(c.utm_source,''))
      UNION ALL
      SELECT k.id, k.name, 'nome_exato', 3 FROM public.meta_campaigns k
        WHERE k.name = COALESCE(NULLIF(c.campaign_name_meta,''), NULLIF(c.utm_campaign,''))
    ) x
    WHERE x.campaign_id IS NOT NULL
    ORDER BY x.pri
    LIMIT 1
  ) r ON true
  LEFT JOIN public.meta_campaigns mc ON mc.id = r.campaign_id
  LEFT JOIN public.bitrix_stage_map s ON s.stage_id = c.fase
  WHERE c.data_criacao >= p_from AND c.data_criacao <= p_to;
$$;

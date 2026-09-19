DROP FUNCTION IF EXISTS public.resolved_campaign_leads(timestamptz, timestamptz);
CREATE OR REPLACE FUNCTION public.resolved_campaign_leads(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(bitrix_deal_id text, titulo text, data_criacao timestamp with time zone, fase text, campaign_id text, campaign_name text, match_source text, funnel_step text, step_rank integer, stage_label text, valor numeric, telefone text, cidade text)
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
         c.valor,
         COALESCE(c.contato_telefone, ml.telefone_raw) AS telefone,
         ml.cidade
  FROM public.utm_conversions c
  LEFT JOIN public.lead_match lm ON lm.bitrix_deal_id = c.bitrix_deal_id
  LEFT JOIN public.meta_leads ml ON ml.lead_id = lm.meta_lead_id
  LEFT JOIN LATERAL (
    SELECT x.campaign_id, x.campaign_name, x.match_source FROM (
      SELECT lm.campaign_id, lm.campaign_name, lm.match_source, 0 AS pri
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

CREATE OR REPLACE FUNCTION public.get_campaign_crm_leads(p_campaign_id text, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.data_criacao DESC), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (bitrix_deal_id)
      bitrix_deal_id, titulo, data_criacao, fase, campaign_id, campaign_name,
      match_source, funnel_step, stage_label, valor, telefone, cidade
    FROM public.resolved_campaign_leads(p_from, p_to)
    WHERE (p_campaign_id = '__none__' AND campaign_id IS NULL)
       OR (p_campaign_id <> '__none__' AND campaign_id = p_campaign_id)
    ORDER BY bitrix_deal_id, data_criacao DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_crm_funnel(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH l AS (SELECT * FROM public.resolved_campaign_leads(p_from, p_to)),
  agg AS (
    SELECT COALESCE(campaign_id, '__none__') AS campaign_id,
      MAX(COALESCE(campaign_name, 'Campanha não identificada')) AS campaign_name,
      COUNT(DISTINCT bitrix_deal_id)::int AS leads_bitrix,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE funnel_step = 'novo')::int AS novo,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE step_rank >= 2)::int AS qualificados,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE step_rank >= 3)::int AS tentativa,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE step_rank >= 4)::int AS contatados,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE step_rank >= 5)::int AS negociacao,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE step_rank >= 6)::int AS vendas,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE funnel_step = 'perdido')::int AS perdidos,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE funnel_step = 'sem_etapa')::int AS sem_etapa,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'manual')::int AS por_manual,
      COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'nome_exato')::int AS por_nome,
      COALESCE(SUM(valor) FILTER (WHERE step_rank >= 6), 0) AS receita
    FROM l GROUP BY COALESCE(campaign_id, '__none__')
  )
  SELECT jsonb_build_object(
    'byCampaign', COALESCE((SELECT jsonb_agg(row_to_json(a) ORDER BY a.leads_bitrix DESC) FROM agg a), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'leads_bitrix', COUNT(DISTINCT bitrix_deal_id)::int,
        'leads_identificados', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE campaign_id IS NOT NULL)::int,
        'leads_nao_identificados', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE campaign_id IS NULL)::int,
        'por_telefone', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'telefone')::int,
        'por_email', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'email')::int,
        'por_nome', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'nome')::int
      ) FROM l)
  );
$$;

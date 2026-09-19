CREATE OR REPLACE FUNCTION public.get_campaign_crm_funnel(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH l AS (SELECT * FROM public.resolved_campaign_leads(p_from, p_to)),
  st AS (
    SELECT s.stage_id, s.name, s.sort
    FROM public.bitrix_stages s
    WHERE s.pipeline_id = '0' AND coalesce(s.name,'') <> 'não usar'
  ),
  sc AS (
    SELECT COALESCE(campaign_id, '__none__') AS cid, fase, COUNT(DISTINCT bitrix_deal_id)::int AS n
    FROM l WHERE fase IS NOT NULL GROUP BY 1, 2
  ),
  bys AS (
    SELECT cid,
      jsonb_object_agg(fase, n) FILTER (WHERE fase IN (SELECT stage_id FROM st)) AS by_stage,
      COALESCE(SUM(n) FILTER (WHERE fase NOT IN (SELECT stage_id FROM st)), 0)::int AS fora_funil
    FROM sc GROUP BY cid
  ),
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
  ),
  rows AS (
    SELECT a.*, COALESCE(b.by_stage, '{}'::jsonb) AS by_stage, COALESCE(b.fora_funil, 0) AS fora_funil
    FROM agg a LEFT JOIN bys b ON b.cid = a.campaign_id
  )
  SELECT jsonb_build_object(
    'stages', COALESCE((SELECT jsonb_agg(jsonb_build_object('stage_id', stage_id, 'name', name) ORDER BY sort) FROM st), '[]'::jsonb),
    'byCampaign', COALESCE((SELECT jsonb_agg(row_to_json(r) ORDER BY r.leads_bitrix DESC) FROM rows r), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'leads_bitrix', COUNT(DISTINCT bitrix_deal_id)::int,
        'leads_identificados', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE campaign_id IS NOT NULL)::int,
        'leads_nao_identificados', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE campaign_id IS NULL)::int,
        'por_telefone', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'telefone')::int,
        'por_email', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'email')::int,
        'por_nome', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE match_source = 'nome')::int
      ) FROM l)
  );
$function$;
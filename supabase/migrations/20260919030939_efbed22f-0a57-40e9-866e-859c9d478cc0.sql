CREATE OR REPLACE FUNCTION public.get_stage_mapping(p_from timestamp with time zone, p_to timestamp with time zone, p_origem text[] DEFAULT NULL::text[])
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH leads AS (
  SELECT DISTINCT c.bitrix_deal_id, c.fase
  FROM public.utm_conversions c
  WHERE c.data_criacao >= p_from AND c.data_criacao <= p_to
    AND (COALESCE(array_length(p_origem,1),0) = 0 OR c.origem = ANY(p_origem))
), counted AS (
  SELECT fase, count(*)::int AS n FROM leads GROUP BY 1
), rows AS (
  SELECT s.stage_id, s.name AS stage_name, s.sort, p.id AS pipeline_id, p.name AS pipeline_name,
         m.funnel_step, COALESCE(m.step_rank, -1) AS step_rank, COALESCE(c.n, 0) AS leads
  FROM public.bitrix_stages s
  JOIN public.bitrix_pipelines p ON p.id = s.pipeline_id
  LEFT JOIN public.bitrix_stage_map m ON m.stage_id = s.stage_id
  LEFT JOIN counted c ON c.fase = s.stage_id
)
SELECT jsonb_build_object(
  'total', (SELECT count(*)::int FROM leads),
  'stages', COALESCE((SELECT jsonb_agg(row_to_json(r) ORDER BY r.step_rank DESC, r.leads DESC, r.pipeline_name, r.sort) FROM rows r), '[]'::jsonb),
  'orphans', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('fase', c.fase, 'leads', c.n) ORDER BY c.n DESC)
    FROM counted c WHERE NOT EXISTS (SELECT 1 FROM public.bitrix_stages s WHERE s.stage_id = c.fase)
  ), '[]'::jsonb)
);
$$;

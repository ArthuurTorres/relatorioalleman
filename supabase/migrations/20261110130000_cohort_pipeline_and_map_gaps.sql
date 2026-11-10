-- Corrige duas distorções do funil:
--
-- 1) Etapas de follow-up (D 1 / D 3 / D 5 / D 7) do pipeline Comercial não tinham
--    classificação em bitrix_stage_map. Ficavam fora da coorte e o lead "sumia"
--    entre a Cotação Enviada e o Aguardando Doc./Projeção.
-- 2) get_funnel_cohort contava a passagem em QUALQUER pipeline do CRM. Um lead de
--    mídia que ia para Declínios (7) ou Carteira (23) somava nas etapas do funil
--    comercial, inflando "contatado"/"negociação" com etapas de remarketing.

-- 1) Follow-up: mesma etapa comercial da Cotação Enviada e do Aguardando Doc./Projeção.
INSERT INTO public.bitrix_stage_map (stage_id, funnel_step, step_rank, label)
VALUES
  ('UC_6CK5P7', 'negociacao', 5, 'D 1'),
  ('UC_P9982J', 'negociacao', 5, 'D 3'),
  ('UC_1WP9SF', 'negociacao', 5, 'D 5'),
  ('UC_629DGI', 'negociacao', 5, 'D 7')
ON CONFLICT (stage_id) DO UPDATE
  SET funnel_step = EXCLUDED.funnel_step,
      step_rank = EXCLUDED.step_rank,
      label = COALESCE(public.bitrix_stage_map.label, EXCLUDED.label),
      updated_at = now();

-- 2) Coorte restrita a um pipeline (padrão: 0 = Comercial, o funil de entrada da mídia).
DROP FUNCTION IF EXISTS public.get_funnel_cohort(timestamptz, timestamptz, text[]);

CREATE OR REPLACE FUNCTION public.get_funnel_cohort(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_origem text[] DEFAULT NULL::text[],
  p_pipeline integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH coorte AS (
  SELECT DISTINCT ON (c.bitrix_deal_id)
         c.bitrix_deal_id AS deal_id,
         c.origem,
         c.data_criacao
  FROM public.utm_conversions c
  WHERE c.data_criacao >= p_from
    AND c.data_criacao <= p_to
    AND c.bitrix_deal_id IS NOT NULL
    AND (COALESCE(array_length(p_origem, 1), 0) = 0 OR c.origem = ANY (p_origem))
  ORDER BY c.bitrix_deal_id, c.data_criacao
),
chegou AS (
  SELECT DISTINCT co.deal_id, co.origem, h.stage_id
  FROM coorte co
  JOIN public.bitrix_stage_history h ON h.deal_id = co.deal_id
  WHERE h.category_id = p_pipeline
),
por_etapa AS (
  SELECT m.step_rank,
         m.funnel_step,
         ch.origem,
         COUNT(DISTINCT ch.deal_id) AS leads
  FROM chegou ch
  JOIN public.bitrix_stage_map m ON m.stage_id = ch.stage_id
  GROUP BY m.step_rank, m.funnel_step, ch.origem
),
total_coorte AS (
  SELECT origem, COUNT(*) AS leads FROM coorte GROUP BY origem
)
SELECT jsonb_build_object(
  'coorte', (SELECT COALESCE(jsonb_agg(jsonb_build_object('origem', origem, 'leads', leads)), '[]'::jsonb) FROM total_coorte),
  'etapas', (
    SELECT COALESCE(jsonb_agg(linha ORDER BY step_rank), '[]'::jsonb)
    FROM (
      SELECT p.step_rank,
             jsonb_build_object(
               'rank', p.step_rank,
               'etapa', p.funnel_step,
               'por_origem', jsonb_object_agg(p.origem, p.leads),
               'total', SUM(p.leads)
             ) AS linha
      FROM por_etapa p
      GROUP BY p.step_rank, p.funnel_step
    ) t
  )
);
$$;

GRANT EXECUTE ON FUNCTION public.get_funnel_cohort(timestamptz, timestamptz, text[], integer) TO anon, authenticated, service_role;

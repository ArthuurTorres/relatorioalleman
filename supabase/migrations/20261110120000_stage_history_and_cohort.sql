-- Histórico de etapas do CRM (crm.stagehistory) + aproveitamento por coorte.
-- Permite medir por quantas etapas um lead REALMENTE passou, em vez de comparar
-- a foto atual de uma etapa com a foto atual da etapa vizinha.

CREATE TABLE IF NOT EXISTS public.bitrix_stage_history (
  id bigint PRIMARY KEY,              -- ID do registro em crm.stagehistory
  deal_id text NOT NULL,
  category_id integer,
  stage_id text NOT NULL,
  semantics text,                     -- P = em andamento, S = sucesso, F = falha
  changed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bsh_deal ON public.bitrix_stage_history (deal_id);
CREATE INDEX IF NOT EXISTS idx_bsh_changed ON public.bitrix_stage_history (changed_at);
CREATE INDEX IF NOT EXISTS idx_bsh_stage ON public.bitrix_stage_history (stage_id);

GRANT SELECT ON public.bitrix_stage_history TO anon, authenticated;
GRANT ALL ON public.bitrix_stage_history TO service_role;
ALTER TABLE public.bitrix_stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leitura publica bitrix_stage_history" ON public.bitrix_stage_history;
CREATE POLICY "leitura publica bitrix_stage_history" ON public.bitrix_stage_history
  FOR SELECT USING (true);

-- Garante que o mapa de etapas aceite etapa sem classificação (o funil ignora essas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bitrix_stage_map_stage ON public.bitrix_stage_map (stage_id);

/* ---------------------------------------------------------------------------
   Aproveitamento por COORTE:
   para os leads criados no período, qual % da coorte chegou a cada etapa
   (passagem registrada no histórico), quebrado por origem (Meta/Google/Outros).
   --------------------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION public.get_funnel_cohort(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_origem text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
GRANT EXECUTE ON FUNCTION public.get_funnel_cohort(timestamptz, timestamptz, text[]) TO anon, authenticated, service_role;

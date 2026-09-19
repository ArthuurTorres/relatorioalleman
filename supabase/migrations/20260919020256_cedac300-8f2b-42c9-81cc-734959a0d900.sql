CREATE TABLE public.bitrix_pipelines (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitrix_pipelines TO anon, authenticated;
GRANT ALL ON public.bitrix_pipelines TO service_role;
ALTER TABLE public.bitrix_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read bitrix_pipelines" ON public.bitrix_pipelines FOR SELECT USING (true);

CREATE TABLE public.bitrix_stages (
  stage_id text PRIMARY KEY,
  pipeline_id text NOT NULL,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  semantics text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitrix_stages_pipeline ON public.bitrix_stages (pipeline_id, sort);
GRANT SELECT ON public.bitrix_stages TO anon, authenticated;
GRANT ALL ON public.bitrix_stages TO service_role;
ALTER TABLE public.bitrix_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read bitrix_stages" ON public.bitrix_stages FOR SELECT USING (true);

CREATE TRIGGER touch_bitrix_pipelines BEFORE UPDATE ON public.bitrix_pipelines FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_bitrix_stages BEFORE UPDATE ON public.bitrix_stages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_bitrix_pipeline_funnel(
  p_from timestamptz,
  p_to timestamptz,
  p_origem text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH leads AS (
  SELECT DISTINCT u.bitrix_deal_id, u.fase
  FROM utm_conversions u
  WHERE u.data_criacao >= p_from AND u.data_criacao < p_to
    AND (p_origem IS NULL OR u.origem = ANY(p_origem))
), counted AS (
  SELECT fase, count(*)::bigint AS n FROM leads GROUP BY 1
), per_pipeline AS (
  SELECT pl.id, pl.name, pl.sort,
    COALESCE(sum(c.n), 0)::bigint AS total,
    jsonb_agg(jsonb_build_object(
      'stage_id', s.stage_id,
      'name', s.name,
      'sort', s.sort,
      'semantics', s.semantics,
      'funnel_step', m.funnel_step,
      'leads', COALESCE(c.n, 0)
    ) ORDER BY s.sort) AS stages
  FROM bitrix_pipelines pl
  JOIN bitrix_stages s ON s.pipeline_id = pl.id
  LEFT JOIN counted c ON c.fase = s.stage_id
  LEFT JOIN bitrix_stage_map m ON m.stage_id = s.stage_id
  GROUP BY pl.id, pl.name, pl.sort
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM leads),
  'sem_etapa', (SELECT COALESCE(sum(c.n), 0) FROM counted c
                WHERE NOT EXISTS (SELECT 1 FROM bitrix_stages s WHERE s.stage_id = c.fase)),
  'pipelines', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'total', total, 'stages', stages) ORDER BY sort)
    FROM per_pipeline
  ), '[]'::jsonb)
);
$$;

GRANT EXECUTE ON FUNCTION public.get_bitrix_pipeline_funnel(timestamptz, timestamptz, text[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_bitrix_stage_leads(
  p_stage_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_origem text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT COALESCE(jsonb_agg(x ORDER BY x->>'data_criacao' DESC), '[]'::jsonb) FROM (
  SELECT DISTINCT ON (u.bitrix_deal_id) jsonb_build_object(
    'bitrix_deal_id', u.bitrix_deal_id,
    'titulo', u.titulo,
    'data_criacao', u.data_criacao,
    'fase', u.fase,
    'origem', u.origem,
    'campaign_name', COALESCE(u.campaign_name_meta, u.campaign_name, u.utm_campaign),
    'valor', u.valor
  ) AS x
  FROM utm_conversions u
  WHERE u.fase = p_stage_id
    AND u.data_criacao >= p_from AND u.data_criacao < p_to
    AND (p_origem IS NULL OR u.origem = ANY(p_origem))
  ORDER BY u.bitrix_deal_id, u.data_criacao DESC
) s;
$$;

GRANT EXECUTE ON FUNCTION public.get_bitrix_stage_leads(text, timestamptz, timestamptz, text[]) TO anon, authenticated, service_role;
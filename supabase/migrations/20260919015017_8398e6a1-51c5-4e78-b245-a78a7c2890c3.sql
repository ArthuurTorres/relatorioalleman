ALTER TABLE public.utm_conversions
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS adset_id_meta text,
  ADD COLUMN IF NOT EXISTS ad_id_meta text,
  ADD COLUMN IF NOT EXISTS campaign_name_meta text;

CREATE INDEX IF NOT EXISTS utm_conversions_campaign_id_idx ON public.utm_conversions (campaign_id);
CREATE INDEX IF NOT EXISTS utm_conversions_fase_idx ON public.utm_conversions (fase);

CREATE TABLE IF NOT EXISTS public.bitrix_stage_map (
  stage_id text PRIMARY KEY,
  funnel_step text NOT NULL,
  step_rank integer NOT NULL DEFAULT 0,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bitrix_stage_map TO anon, authenticated;
GRANT ALL ON public.bitrix_stage_map TO service_role;
ALTER TABLE public.bitrix_stage_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read bitrix_stage_map" ON public.bitrix_stage_map FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.campaign_lead_map (
  label text PRIMARY KEY,
  campaign_id text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.campaign_lead_map TO anon, authenticated;
GRANT ALL ON public.campaign_lead_map TO service_role;
ALTER TABLE public.campaign_lead_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read campaign_lead_map" ON public.campaign_lead_map FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bitrix_stage_map_updated_at ON public.bitrix_stage_map;
CREATE TRIGGER trg_bitrix_stage_map_updated_at BEFORE UPDATE ON public.bitrix_stage_map
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_campaign_lead_map_updated_at ON public.campaign_lead_map;
CREATE TRIGGER trg_campaign_lead_map_updated_at BEFORE UPDATE ON public.campaign_lead_map
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.bitrix_stage_map (stage_id, funnel_step, step_rank, label) VALUES
  ('NEW','novo',1,'Lead Novo'),
  ('C19:NEW','novo',1,'Lead Novo'),
  ('C23:NEW','novo',1,'Carteira Alleman'),
  ('C23:PREPARATION','novo',1,'Carteira Própria'),
  ('C23:UC_GXE5CM','novo',1,'Carteira Desligados'),
  ('C5:UC_WQWD8R','novo',1,'Novo'),
  ('UC_2HKZPL','novo',1,'Monitoria e Qualidade'),
  ('UC_6WUDSU','qualificado',2,'1 a 5 vidas'),
  ('UC_UHZGTJ','qualificado',2,'+5 vidas'),
  ('C19:UC_D0QGZM','qualificado',2,'Qualificado'),
  ('UC_T1E4M9','tentativa',3,'Não atendeu - Mensagem no Whatsapp'),
  ('UC_5VTA1I','tentativa',3,'Iniciou Tentativa 1º Dia'),
  ('UC_YRE87Y','tentativa',3,'Tentativa 2º Dia'),
  ('UC_C8HMWR','tentativa',3,'Tentativa 3º Dia'),
  ('UC_EALS7X','contatado',4,'Aguardando Informações'),
  ('UC_OH3DQ3','contatado',4,'Aguardando Envio Estudo'),
  ('UC_WOY1UL','contatado',4,'Contato Futuro'),
  ('UC_15833V','contatado',4,'Remarketing'),
  ('C19:PREPARATION','contatado',4,'Aguardando Informações'),
  ('C19:UC_X8WY7Z','contatado',4,'Contato Futuro'),
  ('C7:NEW','contatado',4,'Remarketing - 10 Meses'),
  ('C7:PREPAYMENT_INVOICE','contatado',4,'Remarketing'),
  ('C7:UC_M1AH3V','contatado',4,'10 meses (Cliente respondeu)'),
  ('C5:PREPARATION','contatado',4,'Relacionamento (OK)'),
  ('C5:UC_PY6WLC','contatado',4,'Contatos'),
  ('C5:UC_XXQH0R','contatado',4,'Grupo de Whatsapp'),
  ('C23:UC_M83UIC','contatado',4,'Lembrete Vencimento'),
  ('UC_ES69ON','negociacao',5,'Cotação Enviada'),
  ('UC_3AIJ1A','negociacao',5,'Aguardando Doc./Projeção'),
  ('C7:UC_R6EFDG','negociacao',5,'Voltar Para Negociação'),
  ('C3:UC_YHJQW5','negociacao',5,'Novo'),
  ('C3:NEW','negociacao',5,'Stand By'),
  ('C3:UC_OYD2JV','negociacao',5,'Pré venda'),
  ('C3:UC_8KUUBV','negociacao',5,'Pendência'),
  ('UC_YR3OD5','venda',6,'Enviado para Emissão'),
  ('C23:PREPAYMENT_INVOIC','venda',6,'Enviado para Emissão'),
  ('C3:PREPARATION','venda',6,'Emissão'),
  ('C3:PREPAYMENT_INVOICE','venda',6,'Assinatura DS'),
  ('C3:EXECUTING','venda',6,'Análise'),
  ('C3:UC_YB8RNA','venda',6,'Cliente Respondeu'),
  ('C3:UC_LUXW22','venda',6,'Assinatura de Contrato'),
  ('C3:FINAL_INVOICE','venda',6,'Implantada'),
  ('C3:UC_OMJOJH','venda',6,'Aguardando Pagamento'),
  ('C3:UC_R7RC2O','venda',6,'Pedidos de Boleto'),
  ('C3:UC_CSD4Y1','venda',6,'Implantado Pago'),
  ('LOSE','perdido',0,'Perdido'),
  ('C3:LOSE','perdido',0,'Perdido'),
  ('C5:LOSE','perdido',0,'Cancelamento'),
  ('C7:LOSE','perdido',0,'Declínio'),
  ('C19:LOSE','perdido',0,'Perdido'),
  ('C23:LOSE','perdido',0,'Perdido'),
  ('C31:LOSE','perdido',0,'Perdido'),
  ('UC_K2RGNK','perdido',0,'Declinado'),
  ('UC_KM6V8Y','perdido',0,'Sem Qualificação e Retorno'),
  ('C3:UC_G5LRBG','perdido',0,'Declinado'),
  ('C3:UC_3N056X','perdido',0,'Bloqueado'),
  ('C23:FINAL_INVOICE','perdido',0,'Declinado'),
  ('C5:UC_LQ7IFD','perdido',0,'Não Satisfeitos < 4')
ON CONFLICT (stage_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.resolved_campaign_leads(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(
  bitrix_deal_id text, titulo text, data_criacao timestamptz, fase text,
  campaign_id text, campaign_name text, match_source text,
  funnel_step text, step_rank integer, stage_label text, valor numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.bitrix_deal_id, c.titulo, c.data_criacao, c.fase,
         r.campaign_id,
         COALESCE(mc.name, c.campaign_name_meta, c.campaign_name) AS campaign_name,
         r.match_source,
         COALESCE(s.funnel_step, 'sem_etapa') AS funnel_step,
         COALESCE(s.step_rank, -1) AS step_rank,
         COALESCE(s.label, c.fase) AS stage_label,
         c.valor
  FROM public.utm_conversions c
  LEFT JOIN LATERAL (
    SELECT x.campaign_id, x.match_source FROM (
      SELECT NULLIF(c.campaign_id,'') AS campaign_id, 'id'::text AS match_source, 1 AS pri
      UNION ALL
      SELECT m.campaign_id, 'manual', 2 FROM public.campaign_lead_map m
        WHERE m.label IN (COALESCE(c.campaign_name_meta,''), COALESCE(c.utm_campaign,''), COALESCE(c.utm_source,''))
      UNION ALL
      SELECT k.id, 'nome_exato', 3 FROM public.meta_campaigns k
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

CREATE OR REPLACE FUNCTION public.get_campaign_crm_funnel(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
        'leads_nao_identificados', COUNT(DISTINCT bitrix_deal_id) FILTER (WHERE campaign_id IS NULL)::int
      ) FROM l)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_campaign_crm_leads(p_campaign_id text, p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.data_criacao DESC), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (bitrix_deal_id)
      bitrix_deal_id, titulo, data_criacao, fase, campaign_id, campaign_name,
      match_source, funnel_step, stage_label, valor
    FROM public.resolved_campaign_leads(p_from, p_to)
    WHERE (p_campaign_id = '__none__' AND campaign_id IS NULL)
       OR (p_campaign_id <> '__none__' AND campaign_id = p_campaign_id)
    ORDER BY bitrix_deal_id, data_criacao DESC
  ) t;
$$;
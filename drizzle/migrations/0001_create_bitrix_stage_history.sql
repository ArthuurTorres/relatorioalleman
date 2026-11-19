CREATE TABLE IF NOT EXISTS public.bitrix_stage_history (
  id bigint PRIMARY KEY,
  deal_id text NOT NULL,
  category_id integer,
  stage_id text NOT NULL,
  semantics text,
  changed_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bitrix_stage_history TO service_role;
ALTER TABLE public.bitrix_stage_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS bitrix_stage_history_deal_idx ON public.bitrix_stage_history(deal_id);
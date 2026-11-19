-- Histórico de alterações de campanhas detectadas durante o sync do Meta.
CREATE TABLE IF NOT EXISTS public.campaign_activity (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id   text NOT NULL,
  campaign_name text,
  field         text NOT NULL,
  old_value     text,
  new_value     text,
  source        text NOT NULL DEFAULT 'sync',
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_activity_campaign
  ON public.campaign_activity (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_occurred
  ON public.campaign_activity (occurred_at DESC);

ALTER TABLE public.campaign_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'campaign_activity'
      AND policyname = 'read campaign_activity'
  ) THEN
    CREATE POLICY "read campaign_activity" ON public.campaign_activity
      FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.campaign_activity IS 'Diff de campos das campanhas Meta (status, orçamento) registrado a cada sync.';

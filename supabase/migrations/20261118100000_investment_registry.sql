-- Registro de investimento mensal lançado manualmente pelo time.
-- Canal 'geral' = total da conta; canais específicos (meta, google, etc.) opcionais.
CREATE TABLE IF NOT EXISTS public.investment_registry (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year       integer NOT NULL,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount     numeric(12,2) NOT NULL DEFAULT 0,
  note       text,
  channel    text NOT NULL DEFAULT 'geral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, channel)
);

ALTER TABLE public.investment_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'investment_registry'
      AND policyname = 'read investment_registry'
  ) THEN
    CREATE POLICY "read investment_registry" ON public.investment_registry
      FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.investment_registry IS 'Investimento mensal lançado manualmente (por canal; canal geral = total da conta).';

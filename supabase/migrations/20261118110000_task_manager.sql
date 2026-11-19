-- Task manager do time de marketing.
CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  detail     text,
  priority   text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta')),
  status     text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fazendo','feita')),
  due_date   date,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status ON public.marketing_tasks (status, updated_at DESC);

ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_tasks'
      AND policyname = 'read marketing_tasks'
  ) THEN
    CREATE POLICY "read marketing_tasks" ON public.marketing_tasks
      FOR SELECT USING (true);
  END IF;
END $$;

COMMENT ON TABLE public.marketing_tasks IS 'Tarefas do time de marketing (status aberta/fazendo/feita, prioridade, prazo).';

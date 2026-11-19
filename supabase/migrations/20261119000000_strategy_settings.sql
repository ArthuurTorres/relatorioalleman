-- Configurações de planejamento de mídia: regiões, público-alvo e estratégias
-- com histórico de alterações para auditoria.
CREATE TABLE IF NOT EXISTS public.strategy_settings (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  section         text NOT NULL,          -- 'regioes' | 'publico_alvo' | 'estrategias'
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array de strings
  updated_by      text,                    -- email/nome de quem alterou (quando houver auth)
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_settings_section
  ON public.strategy_settings (section);

ALTER TABLE public.strategy_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_settings'
      AND policyname = 'read strategy_settings'
  ) THEN
    CREATE POLICY "read strategy_settings" ON public.strategy_settings
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_settings'
      AND policyname = 'write strategy_settings'
  ) THEN
    CREATE POLICY "write strategy_settings" ON public.strategy_settings
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Histórico de alterações das configurações de estratégia
CREATE TABLE IF NOT EXISTS public.strategy_settings_history (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  strategy_id     bigint NOT NULL REFERENCES public.strategy_settings(id) ON DELETE CASCADE,
  section         text NOT NULL,
  old_items       jsonb,
  new_items       jsonb NOT NULL,
  changed_by      text,
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_history_strategy
  ON public.strategy_settings_history (strategy_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_history_section
  ON public.strategy_settings_history (section, changed_at DESC);

ALTER TABLE public.strategy_settings_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_settings_history'
      AND policyname = 'read strategy_settings_history'
  ) THEN
    CREATE POLICY "read strategy_settings_history" ON public.strategy_settings_history
      FOR SELECT USING (true);
  END IF;
END $$;

-- Trigger para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION public.log_strategy_settings_change()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.items IS DISTINCT FROM NEW.items THEN
      INSERT INTO public.strategy_settings_history (strategy_id, section, old_items, new_items, changed_by)
      VALUES (NEW.id, NEW.section, OLD.items, NEW.items, NEW.updated_by);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.strategy_settings_history (strategy_id, section, old_items, new_items, changed_by)
    VALUES (NEW.id, NEW.section, '[]'::jsonb, NEW.items, NEW.updated_by);
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_strategy_settings_change ON public.strategy_settings;
CREATE TRIGGER trigger_log_strategy_settings_change
AFTER INSERT OR UPDATE ON public.strategy_settings
FOR EACH ROW EXECUTE FUNCTION public.log_strategy_settings_change();

-- Seed inicial com os valores atuais do StrategiesCard
INSERT INTO public.strategy_settings (section, items, updated_by)
VALUES (
  'regioes',
  '[ "São Paulo (SP) — foco principal", "Rio de Janeiro (RJ)", "Minas Gerais (MG)", "Paraná (PR)", "Rio Grande do Sul (RS)" ]'::jsonb,
  'seed'
),
(
  'publico_alvo',
  '[ "Corretores de seguros independentes", "Pequenas e médias corretoras", "Empresas com planos de benefícios coletivos", "Profissionais liberais (SMEs)" ]'::jsonb,
  'seed'
),
(
  'estrategias',
  '[ "Leads de mídia paga (Meta Ads)", "Funil: Leads → Qualificação → Venda" ]'::jsonb,
  'seed'
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.strategy_settings IS 'Configurações editáveis de planejamento de mídia (regiões, público-alvo, estratégias).';
COMMENT ON TABLE public.strategy_settings_history IS 'Histórico de alterações das configurações de estratégia.';
COMMENT ON COLUMN public.strategy_settings.section IS 'Seção: regioes | publico_alvo | estrategias';
COMMENT ON COLUMN public.strategy_settings.items IS 'Array JSON de strings (cada item = uma linha da lista).';
COMMENT ON COLUMN public.strategy_settings_history.changed_by IS 'Identificador de quem fez a alteração (email, nome ou "sistema").';
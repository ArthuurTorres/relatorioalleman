-- Corrige utm_conversions.valor a partir de bitrix_deals.valor_total
-- Causa: o sync de Bitrix populou utm_conversions.valor com OPPORTUNITY do Bitrix,
-- que estava 0; bitrix_deals.valor_total tem o valor correto do deal.

-- 1. Corrige valor dos registros existentes (patch retroativo)
UPDATE public.utm_conversions c
SET valor = bd.valor_total
FROM public.bitrix_deals bd
WHERE c.bitrix_deal_id = bd.id
  AND c.valor IS DISTINCT FROM bd.valor_total;

-- 2. Cria trigger para manter utm_conversions.valor sincronizado com bitrix_deals
-- quando novos deals são sincronizados
CREATE OR REPLACE FUNCTION sync_utm_conversions_valor()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.utm_conversions
    SET valor = NEW.valor_total
    WHERE bitrix_deal_id = NEW.id
      AND (valor IS DISTINCT FROM NEW.valor_total OR valor IS NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.utm_conversions
    SET valor = NEW.valor_total
    WHERE bitrix_deal_id = NEW.id
      AND valor IS DISTINCT FROM NEW.valor_total;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_utm_conversions_valor ON public.bitrix_deals;
CREATE TRIGGER trg_sync_utm_conversions_valor
  AFTER INSERT OR UPDATE OF valor_total ON public.bitrix_deals
  FOR EACH ROW EXECUTE FUNCTION sync_utm_conversions_valor();

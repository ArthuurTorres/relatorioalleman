CREATE OR REPLACE FUNCTION public.rebuild_lead_match()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  DELETE FROM public.lead_match WHERE true;

  -- 1) telefone normalizado
  INSERT INTO public.lead_match (bitrix_deal_id, meta_lead_id, campaign_id, campaign_name, adset_id, ad_id, match_source)
  SELECT DISTINCT ON (c.bitrix_deal_id)
    c.bitrix_deal_id, l.lead_id, l.campaign_id, l.campaign_name, l.adset_id, l.ad_id, 'telefone'
  FROM public.utm_conversions c
  JOIN public.meta_leads l ON l.telefone_norm = c.contato_telefone_norm
  WHERE c.contato_telefone_norm IS NOT NULL AND l.campaign_id IS NOT NULL
  ORDER BY c.bitrix_deal_id, abs(extract(epoch from (c.data_criacao - l.created_time)))
  ON CONFLICT (bitrix_deal_id) DO NOTHING;

  -- 2) e-mail
  INSERT INTO public.lead_match (bitrix_deal_id, meta_lead_id, campaign_id, campaign_name, adset_id, ad_id, match_source)
  SELECT DISTINCT ON (c.bitrix_deal_id)
    c.bitrix_deal_id, l.lead_id, l.campaign_id, l.campaign_name, l.adset_id, l.ad_id, 'email'
  FROM public.utm_conversions c
  JOIN public.meta_leads l ON lower(l.email) = lower(c.contato_email)
  WHERE c.contato_email IS NOT NULL AND l.campaign_id IS NOT NULL
  ORDER BY c.bitrix_deal_id, abs(extract(epoch from (c.data_criacao - l.created_time)))
  ON CONFLICT (bitrix_deal_id) DO NOTHING;

  -- 3) nome idêntico com entrada no CRM próxima ao lead
  INSERT INTO public.lead_match (bitrix_deal_id, meta_lead_id, campaign_id, campaign_name, adset_id, ad_id, match_source)
  SELECT DISTINCT ON (c.bitrix_deal_id)
    c.bitrix_deal_id, l.lead_id, l.campaign_id, l.campaign_name, l.adset_id, l.ad_id, 'nome'
  FROM public.utm_conversions c
  JOIN public.meta_leads l ON lower(unaccent(l.nome)) = lower(unaccent(c.contato_nome))
  WHERE c.contato_nome IS NOT NULL AND l.campaign_id IS NOT NULL
    AND l.created_time IS NOT NULL AND c.data_criacao IS NOT NULL
    AND c.data_criacao >= l.created_time - interval '1 day'
    AND c.data_criacao <= l.created_time + interval '7 days'
  ORDER BY c.bitrix_deal_id, abs(extract(epoch from (c.data_criacao - l.created_time)))
  ON CONFLICT (bitrix_deal_id) DO NOTHING;

  SELECT jsonb_build_object(
    'total', count(*),
    'telefone', count(*) FILTER (WHERE match_source = 'telefone'),
    'email', count(*) FILTER (WHERE match_source = 'email'),
    'nome', count(*) FILTER (WHERE match_source = 'nome')
  ) INTO res FROM public.lead_match;
  RETURN res;
END; $$;

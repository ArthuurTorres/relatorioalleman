CREATE OR REPLACE FUNCTION public.rebuild_lead_match()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  DELETE FROM public.lead_match WHERE true;
  INSERT INTO public.lead_match (bitrix_deal_id, meta_lead_id, campaign_id, campaign_name, adset_id, ad_id, match_source)
  SELECT DISTINCT ON (c.bitrix_deal_id)
    c.bitrix_deal_id, m.lead_id, m.campaign_id, m.campaign_name, m.adset_id, m.ad_id, m.src
  FROM public.utm_conversions c
  JOIN LATERAL (
    SELECT l.lead_id, l.campaign_id, l.campaign_name, l.adset_id, l.ad_id, x.src, x.pri, l.created_time
    FROM (
      SELECT 1 AS pri, 'telefone'::text AS src
      UNION ALL SELECT 2, 'email'
      UNION ALL SELECT 3, 'nome'
    ) x
    JOIN public.meta_leads l ON (
      (x.pri = 1 AND c.contato_telefone_norm IS NOT NULL AND l.telefone_norm = c.contato_telefone_norm)
      OR (x.pri = 2 AND c.contato_email IS NOT NULL AND lower(l.email) = lower(c.contato_email))
      OR (x.pri = 3 AND c.contato_nome IS NOT NULL AND lower(unaccent(l.nome)) = lower(unaccent(c.contato_nome))
          AND l.created_time IS NOT NULL AND c.data_criacao IS NOT NULL
          AND c.data_criacao >= l.created_time - interval '1 day'
          AND c.data_criacao <= l.created_time + interval '7 days')
    )
    WHERE l.campaign_id IS NOT NULL
    ORDER BY x.pri, abs(extract(epoch from (c.data_criacao - l.created_time)))
    LIMIT 1
  ) m ON true
  ORDER BY c.bitrix_deal_id, m.pri;

  SELECT jsonb_build_object(
    'total', count(*),
    'telefone', count(*) FILTER (WHERE match_source = 'telefone'),
    'email', count(*) FILTER (WHERE match_source = 'email'),
    'nome', count(*) FILTER (WHERE match_source = 'nome')
  ) INTO res FROM public.lead_match;
  RETURN res;
END; $$;

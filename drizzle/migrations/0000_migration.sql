DROP POLICY IF EXISTS "read meta_leads" ON public.meta_leads;
DROP POLICY IF EXISTS "read meta_lead_forms" ON public.meta_lead_forms;
DROP POLICY IF EXISTS "read campaign_lead_map" ON public.campaign_lead_map;
DROP POLICY IF EXISTS "Authenticated users can read utm_conversions" ON public.utm_conversions;
DROP POLICY IF EXISTS "read lead_match" ON public.lead_match;
DROP POLICY IF EXISTS "read lead_goals" ON public.lead_goals;
REVOKE ALL ON public.meta_leads, public.meta_lead_forms, public.campaign_lead_map, public.utm_conversions, public.lead_match, public.lead_goals FROM anon, authenticated;
GRANT ALL ON public.meta_leads, public.meta_lead_forms, public.campaign_lead_map, public.utm_conversions, public.lead_match, public.lead_goals TO service_role;
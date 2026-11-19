CREATE TABLE IF NOT EXISTS public.campaign_activity (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 campaign_id text NOT NULL,
 campaign_name text,
 field text NOT NULL,
 old_value text,
 new_value text,
 source text NOT NULL DEFAULT 'sync',
 occurred_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON TABLE public.campaign_activity TO service_role;
REVOKE ALL ON TABLE public.campaign_activity FROM anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.campaign_activity_id_seq TO service_role;
ALTER TABLE public.campaign_activity ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_campaign_activity_campaign ON public.campaign_activity (campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_activity_occurred ON public.campaign_activity (occurred_at DESC);
COMMENT ON TABLE public.campaign_activity IS 'Observed Meta campaign status and budget changes; server-only access behind the report password gate.';
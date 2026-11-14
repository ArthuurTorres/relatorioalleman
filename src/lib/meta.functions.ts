import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { getClient } from "@/lib/utm.server";

const Schema = z.object({ from: z.string(), to: z.string() });

export type MetaPerformance = {
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    ctr: number;
    cpc: number;
    cpm: number;
    leads_total: number;
    leads_matched: number;
    leads_meta_reported: number;
    valor_total: number;
    cpl: number | null;
    cpl_meta: number | null;
    roas: number | null;

  };
  daily: Array<{ day: string; spend: number; impressions: number; clicks: number }>;
  byCampaign: Array<{
    campaign_id: string;
    campaign_name: string;
    status: string | null;
    objective: string | null;
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    cpc: number;
    leads: number;
    leads_crm: number;
    leads_meta: number;
    valor_gerado: number;
    cpl: number | null;
    roas: number | null;
  }>;
  byAdset: Array<{
    adset_id: string;
    adset_name: string;
    campaign_name: string;
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    leads: number;
    leads_crm: number;
    leads_meta: number;
    valor_gerado: number;
    cpl: number | null;
    roas: number | null;
  }>;
  byAd: Array<{
    ad_id: string;
    ad_name: string;
    adset_name: string;
    campaign_name: string;
    campaign_status: string | null;
    impressions: number;
    clicks: number;
    link_clicks: number;
    reach: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
    leads: number;
    leads_crm: number;
    leads_meta: number;
    valor_gerado: number;
    cpl: number | null;
    roas: number | null;
  }>;
};

export const getMetaPerformance = createServerFn({ method: "POST" })
  .validator((d) => Schema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_meta_performance", {
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(error.message);
    return result as MetaPerformance;
  });

export type MetaCreative = {
  creative_id: string;
  thumbnail_url: string | null;
  body: string | null;
  title: string | null;
  link_url: string | null;
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_status: string | null;
  ad_status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  leads_meta: number;
  valor_gerado: number;
  ticket_medio: number | null;
  roas: number | null;
  cpl: number | null;
  ctr: number | null;
  cpm: number | null;
  funnel_rates: Record<string, number> | null;
  funnel: Record<string, number> | null;
};

export type MetaCreativesData = {
  ads: MetaCreative[];
  stages: { step_name: string; step_rank: number }[];
};

export const getMetaSyncState = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("sync_meta_state")
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[getMetaSyncState]", error);
      return { lastSync: null as string | null, metaLeads: 0 };
    }
    return {
      lastSync: (data as any)?.last_sync ?? null,
      metaLeads: (data as any)?.meta_leads ?? 0,
    };
  });

function spRange(days: number) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => {
    const local = new Date(d.getTime() + (-3) * 3600000);
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T00:00:00.000-03:00`;
  };
  const to = fmt(now);
  const from = fmt(new Date(now.getTime() - days * 86400000));
  return { from, to };
}

export const getMetaCreatives = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { from, to } = spRange(30);
// RPC ainda não existe no banco — será criada pela migration no próximo deploy
    const { data, error } = await (supabaseAdmin as any).rpc("get_creatives_performance", {
      p_from: from,
      p_to: to,
      p_limit: 50,
    }).single();
    if (error) {
      console.error("[getMetaCreatives]", error);
      return { ads: [] as MetaCreative[], stages: [] as { step_name: string; step_rank: number }[] };
    }
    const rpc = (data ?? {}) as { ads?: MetaCreative[]; stages?: { step_name: string; step_rank: number }[] };
    return {
      ads: (rpc.ads ?? []) as MetaCreative[],
      stages: (rpc.stages ?? []) as { step_name: string; step_rank: number }[],
    };
  });

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

export const getMetaSyncState = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("meta_sync_state")
      .select("last_run,last_status,meta")
      .eq("key", "meta_ads")
      .maybeSingle();
    return data ?? null;
  } catch (error) {
    console.error("[getMetaSyncState]", error);
    return null;
  }
});

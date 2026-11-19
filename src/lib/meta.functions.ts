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

const OptionalCreativesSchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .optional();

function spRange(days: number) {
  const fmtDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const now = new Date();
  const toDay = fmtDay(now);
  const fromDay = fmtDay(new Date(now.getTime() - (days - 1) * 86_400_000));
  return {
    from: `${fromDay}T00:00:00.000-03:00`,
    to: `${toDay}T23:59:59.999-03:00`,
  };
}

export const getMetaCreatives = createServerFn({ method: "POST" })
  .validator((d?: { from?: string; to?: string }) =>
    OptionalCreativesSchema.parse(d),
  )
  .handler(async ({ data }): Promise<MetaCreativesData> => {
    await requireUnlocked();
    const [{ supabaseAdmin }, { computeCreativesPerformance }] =
      await Promise.all([
        import("@/integrations/supabase/client.server"),
        import("@/lib/creatives.functions"),
      ]);

    const defaults = spRange(30);
    const from = data?.from?.trim() || defaults.from;
    const to = data?.to?.trim() || defaults.to;

    const payload = await computeCreativesPerformance(supabaseAdmin, {
      from,
      to,
    });

    const seenKeys = new Set<string>();
    const ads: MetaCreative[] = payload.items.map((item) => {
      const baseCid = item.creative_id || item.ad_id;
      const uniqueCid = seenKeys.has(baseCid)
        ? `${baseCid}:${item.ad_id}`
        : baseCid;
      seenKeys.add(uniqueCid);

      const resolvedStatus = item.is_serving_now
        ? "ACTIVE"
        : item.delivery_state === "campaign_paused"
          ? "CAMPAIGN_PAUSED"
          : item.delivery_state === "adset_paused"
            ? "ADSET_PAUSED"
            : item.delivery_state === "archived"
              ? "ARCHIVED"
              : item.ad_status ?? "PAUSED";

      return {
        creative_id: uniqueCid,
        thumbnail_url: item.thumbnail_url,
        body: item.body,
        title: item.title,
        link_url: item.link_url,
        ad_id: item.ad_id,
        ad_name: item.ad_name,
        campaign_id: item.campaign_id,
        campaign_name: item.campaign_name,
        campaign_status: item.campaign_status,
        ad_status: resolvedStatus,
        spend: item.spend,
        impressions: item.impressions,
        clicks: item.clicks,
        reach: item.reach,
        leads: item.leads,
        leads_meta: item.leads_meta,
        valor_gerado: item.valor_gerado,
        ticket_medio: item.ticket_medio,
        roas: item.roas,
        cpl: item.cpl,
        ctr: item.ctr,
        cpm: item.cpm,
        funnel_rates:
          Object.keys(item.funnel_rates).length > 0 ? item.funnel_rates : null,
        funnel:
          Object.keys(item.funnel_counts).length > 0
            ? item.funnel_counts
            : null,
      };
    });

    return {
      ads,
      stages: payload.stages.map((s) => ({
        step_name: s.step_name,
        step_rank: s.step_rank,
      })),
    };
  });

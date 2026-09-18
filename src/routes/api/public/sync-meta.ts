import { createFileRoute } from "@tanstack/react-router";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

type AnyRec = Record<string, unknown>;

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(`${GRAPH_BASE}${path}`);
  u.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Meta ${r.status}: ${txt.slice(0, 500)}`);
  }
  return r.json();
}

async function graphAll(initialUrl: string, token: string, params: Record<string, string>): Promise<AnyRec[]> {
  const out: AnyRec[] = [];
  let next: string | null = null;
  let first = true;
  while (first || next) {
    let data: any;
    if (first) {
      data = await graphGet(initialUrl, token, params);
      first = false;
    } else {
      const r = await fetch(next!);
      if (!r.ok) throw new Error(`Meta pag ${r.status}`);
      data = await r.json();
    }
    if (Array.isArray(data.data)) out.push(...data.data);
    next = data.paging?.next ?? null;
  }
  return out;
}

async function handler(request: Request): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url);
  const provided = (
    request.headers.get("x-cron-secret") ||
    url.searchParams.get("secret") ||
    request.headers.get("apikey") ||
    ""
  ).trim();
  const expectedCron = (process.env.CRON_SECRET || "").trim();
  const expectedAnon = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  // Comparação em bytes (UTF-8) para funcionar também com acentos no segredo.
  const enc = new TextEncoder();
  const eq = (a: string, b: string) => {
    if (!a || !b) return false;
    const x = enc.encode(a);
    const y = enc.encode(b);
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
  };
  if (!eq(provided, expectedCron) && !eq(provided, expectedAnon)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !accountId) {
    return Response.json({ ok: false, error: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID não configurado" }, { status: 500 });
  }
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  // Janela: default últimos 30 dias (permite backfill via ?days=90)
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 30), 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];
  const stats: Record<string, number> = {};

  try {
    // 1) CAMPAIGNS
    const campaigns = await graphAll(`/${act}/campaigns`, token, {
      fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
      limit: "200",
    });
    // Somente campanhas da conta TRIVE
    const isTrive = (n: unknown) => String(n ?? "").toLowerCase().includes("[trive]");
    const triveCampaigns = campaigns.filter((c: any) => isTrive(c.name));
    const triveIds = new Set(triveCampaigns.map((c: any) => String(c.id)));
    if (triveCampaigns.length) {
      const rows = triveCampaigns.map((c: any) => ({
        id: String(c.id),
        account_id: act,
        name: c.name ?? null,
        objective: c.objective ?? null,
        status: c.status ?? null,
        effective_status: c.effective_status ?? null,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        start_time: c.start_time ?? null,
        stop_time: c.stop_time ?? null,
        created_time: c.created_time ?? null,
        updated_time: c.updated_time ?? null,
        synced_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin.from("meta_campaigns").upsert(rows.slice(i, i + 200), { onConflict: "id" });
        if (error) errors.push(`campaigns: ${error.message}`);
      }
    }
    stats.campaigns = triveCampaigns.length;
    stats.campaigns_ignoradas = campaigns.length - triveCampaigns.length;

    // 2) ADSETS
    const adsets = await graphAll(`/${act}/adsets`, token, {
      fields: "id,campaign_id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,created_time,updated_time",
      limit: "200",
    });
    const triveAdsets = adsets.filter((a: any) => triveIds.has(String(a.campaign_id)));
    const triveAdsetIds = new Set(triveAdsets.map((a: any) => String(a.id)));
    if (triveAdsets.length) {
      const rows = triveAdsets.map((a: any) => ({
        id: String(a.id),
        campaign_id: String(a.campaign_id),
        account_id: act,
        name: a.name ?? null,
        status: a.status ?? null,
        effective_status: a.effective_status ?? null,
        daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
        lifetime_budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
        optimization_goal: a.optimization_goal ?? null,
        billing_event: a.billing_event ?? null,
        created_time: a.created_time ?? null,
        updated_time: a.updated_time ?? null,
        synced_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin.from("meta_adsets").upsert(rows.slice(i, i + 200), { onConflict: "id" });
        if (error) errors.push(`adsets: ${error.message}`);
      }
    }
    stats.adsets = triveAdsets.length;

    // 3) ADS
    const ads = await graphAll(`/${act}/ads`, token, {
      fields: "id,adset_id,campaign_id,name,status,effective_status,creative{id},created_time,updated_time",
      limit: "500",
    });
    const triveAds = ads.filter((a: any) => triveIds.has(String(a.campaign_id)));
    if (triveAds.length) {
      const rows = triveAds.map((a: any) => ({
        id: String(a.id),
        adset_id: String(a.adset_id),
        campaign_id: String(a.campaign_id),
        account_id: act,
        name: a.name ?? null,
        status: a.status ?? null,
        effective_status: a.effective_status ?? null,
        creative_id: a.creative?.id ?? null,
        created_time: a.created_time ?? null,
        updated_time: a.updated_time ?? null,
        synced_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin.from("meta_ads").upsert(rows.slice(i, i + 200), { onConflict: "id" });
        if (error) errors.push(`ads: ${error.message}`);
      }
    }
    stats.ads = triveAds.length;

    // 4) INSIGHTS por dia por ad
    const insights = await graphAll(`/${act}/insights`, token, {
      level: "ad",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      fields: "ad_id,adset_id,campaign_id,impressions,reach,clicks,inline_link_clicks,spend,cpc,cpm,ctr,frequency,actions,date_start",
      limit: "500",
    });
    const triveInsights = insights.filter(
      (i: any) => triveIds.has(String(i.campaign_id)) || triveAdsetIds.has(String(i.adset_id)),
    );
    if (triveInsights.length) {
      const rows = triveInsights.map((i: any) => ({
        ad_id: String(i.ad_id),
        date_start: i.date_start,
        adset_id: i.adset_id ? String(i.adset_id) : null,
        campaign_id: i.campaign_id ? String(i.campaign_id) : null,
        account_id: act,
        impressions: i.impressions ? Number(i.impressions) : 0,
        reach: i.reach ? Number(i.reach) : 0,
        clicks: i.clicks ? Number(i.clicks) : 0,
        inline_link_clicks: i.inline_link_clicks ? Number(i.inline_link_clicks) : 0,
        spend: i.spend ? Number(i.spend) : 0,
        cpc: i.cpc ? Number(i.cpc) : null,
        cpm: i.cpm ? Number(i.cpm) : null,
        ctr: i.ctr ? Number(i.ctr) : null,
        frequency: i.frequency ? Number(i.frequency) : null,
        actions: i.actions ?? null,
        synced_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("meta_ad_insights")
          .upsert(rows.slice(i, i + 200), { onConflict: "ad_id,date_start" });
        if (error) errors.push(`insights: ${error.message}`);
      }
    }
    stats.insights = triveInsights.length;
  } catch (e: any) {
    errors.push(String(e?.message || e));
  }

  await supabaseAdmin.from("meta_sync_state").upsert(
    {
      key: "meta_ads",
      last_run: new Date().toISOString(),
      last_status: errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : `ok`,
      meta: { ...stats, window: { since, until } },
    },
    { onConflict: "key" },
  );

  return Response.json({
    ok: errors.length === 0,
    ...stats,
    window: { since, until },
    errors,
    took_ms: Date.now() - started,
  });
}

export const Route = createFileRoute("/api/public/sync-meta")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
          },
        }),
    },
  },
});

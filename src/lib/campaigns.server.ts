/**
 * SOMENTE LEITURA. Catálogo e detalhe individual por campanha.
 * Meta: meta_campaigns + meta_ads + meta_ad_insights (dados sincronizados).
 * Google: google_ads_campaign_daily (dados sincronizados).
 * Leads: utm_conversions, vinculados pelo ID do anúncio (ad_id) → campanha.
 * Nada é inventado: quando a base não permite atribuir leads à campanha,
 * o campo volta como null e a interface mostra "Sem dados para o período".
 */

export type Canal = "meta" | "google";

export type CampaignOption = {
  id: string;
  name: string;
  canal: Canal;
  status: string | null;
  spend: number;
};

export type CampaignDetail = {
  id: string;
  name: string;
  canal: Canal;
  status: string | null;
  summary: {
    spend: number;
    impressions: number;
    reach: number | null;
    clicks: number;
    ctr: number | null;
    cpc: number | null;
    leads: number | null;
    cpl: number | null;
    conversions: number | null;
    costPerConversion: number | null;
  };
  daily: Array<{
    day: string;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number | null;
    conversions: number | null;
  }>;
  /** Observação sobre atribuição de leads (ex.: base sem ad_id no período). */
  leadsNote: string | null;
};

function localDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("Período inválido");
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Soma as ações de lead reportadas pelo Meta Ads nos insights. */
function metaLeadActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions as any[]) {
    const t = String(a?.action_type ?? "");
    if (t === "lead" || t === "onsite_conversion.lead_grouped" || t === "offsite_conversion.fb_pixel_lead") {
      total += num(a?.value);
      break;
    }
  }
  return total;
}

async function metaAdsIndex(supabase: any) {
  const map = new Map<string, string>(); // ad_id -> campaign_id
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("meta_ads").select("id,campaign_id").range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) map.set(String(r.id), String(r.campaign_id));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return map;
}

async function metaInsights(supabase: any, start: string, end: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("meta_ad_insights")
      .select("ad_id,date_start,impressions,reach,clicks,spend,actions")
      .gte("date_start", start)
      .lte("date_start", end)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return rows;
}

export async function listCampaigns(from: string, to: string): Promise<CampaignOption[]> {
  const start = localDate(from);
  const end = localDate(to);
  const supabase = await admin();

  const [ads, insights, googleRes, metaCampaignsRes] = await Promise.all([
    metaAdsIndex(supabase),
    metaInsights(supabase, start, end),
    supabase
      .from("google_ads_campaign_daily")
      .select("campaign_id,campaign_name,status,cost")
      .gte("date", start)
      .lte("date", end),
    supabase.from("meta_campaigns").select("id,name,status"),
  ]);

  const metaSpend = new Map<string, number>();
  for (const r of insights) {
    const campaignId = ads.get(String(r.ad_id));
    if (!campaignId) continue;
    metaSpend.set(campaignId, (metaSpend.get(campaignId) ?? 0) + num(r.spend));
  }

  const out: CampaignOption[] = [];
  for (const c of (metaCampaignsRes.data ?? []) as any[]) {
    if (!metaSpend.has(String(c.id))) continue;
    out.push({
      id: String(c.id),
      name: c.name ?? "Campanha sem nome",
      canal: "meta",
      status: c.status ?? null,
      spend: metaSpend.get(String(c.id)) ?? 0,
    });
  }

  const google = new Map<string, CampaignOption>();
  for (const r of (googleRes.data ?? []) as any[]) {
    const id = String(r.campaign_id);
    const item = google.get(id) ?? {
      id,
      name: r.campaign_name ?? "Campanha sem nome",
      canal: "google" as const,
      status: r.status ?? null,
      spend: 0,
    };
    item.spend += num(r.cost);
    google.set(id, item);
  }

  return [...out, ...google.values()].sort((a, b) => b.spend - a.spend);
}

export async function getCampaignDetail(
  canal: Canal,
  campaignId: string,
  from: string,
  to: string,
): Promise<CampaignDetail | null> {
  const start = localDate(from);
  const end = localDate(to);
  const supabase = await admin();

  if (canal === "google") {
    const { data, error } = await supabase
      .from("google_ads_campaign_daily")
      .select("campaign_id,campaign_name,status,date,cost,impressions,clicks,conversions")
      .eq("campaign_id", campaignId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    if (rows.length === 0) return null;

    const daily = rows.map((r) => ({
      day: r.date as string,
      spend: num(r.cost),
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      leads: null,
      conversions: num(r.conversions),
    }));
    const spend = daily.reduce((s, d) => s + d.spend, 0);
    const impressions = daily.reduce((s, d) => s + d.impressions, 0);
    const clicks = daily.reduce((s, d) => s + d.clicks, 0);
    const conversions = daily.reduce((s, d) => s + (d.conversions ?? 0), 0);

    return {
      id: campaignId,
      name: rows[0].campaign_name ?? "Campanha sem nome",
      canal,
      status: rows[0].status ?? null,
      summary: {
        spend,
        impressions,
        reach: null,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        leads: null,
        cpl: null,
        conversions,
        costPerConversion: conversions > 0 ? spend / conversions : null,
      },
      daily,
      leadsNote:
        "Leads do Bitrix não trazem o ID da campanha do Google; use as conversões atribuídas pela plataforma.",
    };
  }

  const [campaignRes, ads, insights] = await Promise.all([
    supabase.from("meta_campaigns").select("id,name,status").eq("id", campaignId).maybeSingle(),
    metaAdsIndex(supabase),
    metaInsights(supabase, start, end),
  ]);

  const adIds = [...ads.entries()].filter(([, c]) => c === campaignId).map(([adId]) => adId);
  const mine = insights.filter((r) => adIds.includes(String(r.ad_id)));
  if (!campaignRes.data && mine.length === 0) return null;

  const dailyMap = new Map<string, { day: string; spend: number; impressions: number; clicks: number; reach: number; leads: number; leadsMeta: number }>();
  for (const r of mine) {
    const day = String(r.date_start);
    const item = dailyMap.get(day) ?? { day, spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0, leadsMeta: 0 };
    item.spend += num(r.spend);
    item.impressions += num(r.impressions);
    item.clicks += num(r.clicks);
    item.reach += num(r.reach);
    item.leadsMeta += metaLeadActions(r.actions);
    dailyMap.set(day, item);
  }

  // Leads atribuíveis: apenas quando o lead do Bitrix carrega o ad_id da campanha.
  let leadsTotal: number | null = null;
  let leadsNote: string | null = null;
  if (adIds.length > 0) {
    const fromIso = new Date(`${start}T00:00:00-03:00`).toISOString();
    const toIso = new Date(`${end}T23:59:59.999-03:00`).toISOString();
    const chunkSize = 200;
    let counted = 0;
    for (let i = 0; i < adIds.length; i += chunkSize) {
      const chunk = adIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from("utm_conversions")
        .select("ad_id,data_criacao")
        .in("ad_id", chunk)
        .gte("data_criacao", fromIso)
        .lte("data_criacao", toIso);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as any[]) {
        counted += 1;
        const day = new Date(row.data_criacao).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const item = dailyMap.get(day);
        if (item) item.leads += 1;
      }
    }
    leadsTotal = counted > 0 ? counted : null;
  }

  // Fallback: leads reportados pelo próprio Meta Ads (ação "lead" nos insights),
  // usado quando o Bitrix não traz o ad_id nos leads do período.
  const leadsMetaTotal = [...dailyMap.values()].reduce((s, d) => s + d.leadsMeta, 0);
  let usingMetaLeads = false;
  if (leadsTotal == null && leadsMetaTotal > 0) {
    leadsTotal = leadsMetaTotal;
    usingMetaLeads = true;
    for (const item of dailyMap.values()) item.leads = item.leadsMeta;
    leadsNote = "Leads contabilizados pelo próprio Meta Ads: os leads do Bitrix deste período não trazem o ID do anúncio.";
  } else if (leadsTotal == null) {
    leadsNote =
      "Nenhum lead do período traz o ID do anúncio (ad_id) desta campanha no Bitrix, então não há atribuição individual disponível.";
  }
  void usingMetaLeads;

  const daily = [...dailyMap.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: d.day,
      spend: d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      leads: leadsTotal == null ? null : d.leads,
      conversions: null,
    }));

  const spend = daily.reduce((s, d) => s + d.spend, 0);
  const impressions = daily.reduce((s, d) => s + d.impressions, 0);
  const clicks = daily.reduce((s, d) => s + d.clicks, 0);
  const reach = [...dailyMap.values()].reduce((s, d) => s + d.reach, 0);

  return {
    id: campaignId,
    name: (campaignRes.data as any)?.name ?? "Campanha sem nome",
    canal: "meta",
    status: (campaignRes.data as any)?.status ?? null,
    summary: {
      spend,
      impressions,
      reach: reach > 0 ? reach : null,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      leads: leadsTotal,
      cpl: leadsTotal && leadsTotal > 0 ? spend / leadsTotal : null,
      conversions: null,
      costPerConversion: null,
    },
    daily,
    leadsNote,
  };
}

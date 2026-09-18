export type GoogleAdsPerformance = {
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    costPerConversion: number | null;
  };
  daily: Array<{
    day: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    status: string | null;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    costPerConversion: number | null;
  }>;
  retrievedAt: string;
};

type GoogleAdsRow = {
  campaign?: { id?: string | number; name?: string; status?: string };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
  };
};

function asNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("Período inválido para o Google Ads");
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function collectRows(payload: unknown): GoogleAdsRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((chunk) => {
    if (chunk && typeof chunk === "object" && "results" in chunk && Array.isArray(chunk.results)) {
      return chunk.results as GoogleAdsRow[];
    }
    return [];
  });
}

// SOMENTE LEITURA: os dados vêm da tabela sincronizada 1–2x por dia
// (rota /api/public/sync-google-ads). O painel nunca chama o Google diretamente
// e nunca cria, altera, pausa ou exclui campanhas/anúncios/conversões.
export async function fetchGoogleAdsPerformance(from: string, to: string): Promise<GoogleAdsPerformance> {
  const start = localDate(from);
  const end = localDate(to);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("google_ads_campaign_daily")
    .select("campaign_id,campaign_name,status,date,cost,impressions,clicks,conversions")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  if (error) {
    console.error("[Google Ads] Falha ao ler dados sincronizados:", error.message);
    throw new Error("Não foi possível ler os dados sincronizados do Google Ads");
  }

  const rows: GoogleAdsRow[] = (data ?? []).map((r: any) => ({
    campaign: { id: r.campaign_id, name: r.campaign_name ?? undefined, status: r.status ?? undefined },
    segments: { date: r.date },
    metrics: {
      costMicros: Number(r.cost ?? 0) * 1_000_000,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
    },
  }));
  const daily = new Map<string, GoogleAdsPerformance["daily"][number]>();
  const campaigns = new Map<string, GoogleAdsPerformance["campaigns"][number]>();

  for (const row of rows) {
    const day = row.segments?.date;
    const campaignId = String(row.campaign?.id ?? "");
    const spend = asNumber(row.metrics?.costMicros) / 1_000_000;
    const impressions = asNumber(row.metrics?.impressions);
    const clicks = asNumber(row.metrics?.clicks);
    const conversions = asNumber(row.metrics?.conversions);

    if (day) {
      const item = daily.get(day) ?? { day, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      item.spend += spend;
      item.impressions += impressions;
      item.clicks += clicks;
      item.conversions += conversions;
      daily.set(day, item);
    }

    if (campaignId) {
      const item = campaigns.get(campaignId) ?? {
        campaignId,
        campaignName: row.campaign?.name ?? "Campanha sem nome",
        status: row.campaign?.status ?? null,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        costPerConversion: null,
      };
      item.spend += spend;
      item.impressions += impressions;
      item.clicks += clicks;
      item.conversions += conversions;
      campaigns.set(campaignId, item);
    }
  }

  const campaignList = Array.from(campaigns.values())
    .map((item) => ({
      ...item,
      costPerConversion: item.conversions > 0 ? item.spend / item.conversions : null,
    }))
    .sort((a, b) => b.spend - a.spend);
  const dailyList = Array.from(daily.values()).sort((a, b) => a.day.localeCompare(b.day));
  const summary = campaignList.reduce(
    (total, item) => ({
      spend: total.spend + item.spend,
      impressions: total.impressions + item.impressions,
      clicks: total.clicks + item.clicks,
      conversions: total.conversions + item.conversions,
      costPerConversion: null as number | null,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, costPerConversion: null as number | null },
  );
  summary.costPerConversion = summary.conversions > 0 ? summary.spend / summary.conversions : null;

  const state = await supabaseAdmin
    .from("sync_state")
    .select("last_run")
    .eq("key", "google_ads")
    .maybeSingle();

  return {
    summary,
    daily: dailyList,
    campaigns: campaignList,
    retrievedAt: (state.data as any)?.last_run ?? new Date().toISOString(),
  };
}
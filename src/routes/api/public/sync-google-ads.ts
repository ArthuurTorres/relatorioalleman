import { createFileRoute } from "@tanstack/react-router";

type Row = {
  campaign?: { id?: string | number; name?: string; status?: string };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
  };
};

function num(v: string | number | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function collect(payload: unknown): Row[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((chunk) =>
    chunk && typeof chunk === "object" && "results" in chunk && Array.isArray((chunk as any).results)
      ? ((chunk as any).results as Row[])
      : [],
  );
}

async function handler(request: Request): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url);
  const provided =
    request.headers.get("x-cron-secret") || url.searchParams.get("secret") || request.headers.get("apikey") || "";
  const expectedCron = process.env.CRON_SECRET || "";
  const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const eq = (a: string, b: string) => {
    if (!a || !b || a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };
  if (!eq(provided, expectedCron) && !eq(provided, expectedAnon)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const connectionApiKey = process.env.GOOGLE_ADS_API_KEY;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 90), 1), 365);
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const since = fmt(new Date(Date.now() - days * 86400000));
  const until = fmt(new Date());

  const errors: string[] = [];
  let saved = 0;

  try {
    if (!lovableApiKey || !connectionApiKey || !customerId) {
      throw new Error("Conexão do Google Ads não configurada");
    }
    // SOMENTE LEITURA: apenas relatório (searchStream). Nunca cria/altera nada na conta.
    const query = `
      SELECT segments.date, campaign.id, campaign.name, campaign.status,
             metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${since}' AND '${until}'
        AND campaign.status != 'REMOVED'
    `;
    const response = await fetch(
      `https://connector-gateway.lovable.dev/google_ads/v22/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": connectionApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      },
    );
    if (!response.ok) {
      throw new Error(`Google Ads ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const rows = collect(await response.json());
    const map = new Map<string, any>();
    for (const row of rows) {
      const date = row.segments?.date;
      const campaignId = String(row.campaign?.id ?? "");
      if (!date || !campaignId) continue;
      const key = `${campaignId}|${date}`;
      const item = map.get(key) ?? {
        campaign_id: campaignId,
        date,
        campaign_name: row.campaign?.name ?? null,
        status: row.campaign?.status ?? null,
        cost: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        synced_at: new Date().toISOString(),
      };
      item.cost += num(row.metrics?.costMicros) / 1_000_000;
      item.impressions += num(row.metrics?.impressions);
      item.clicks += num(row.metrics?.clicks);
      item.conversions += num(row.metrics?.conversions);
      map.set(key, item);
    }

    const all = Array.from(map.values());
    for (let i = 0; i < all.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("google_ads_campaign_daily")
        .upsert(all.slice(i, i + 500), { onConflict: "campaign_id,date" });
      if (error) errors.push(error.message);
      else saved += Math.min(500, all.length - i);
    }
  } catch (e: any) {
    errors.push(String(e?.message || e));
  }

  await supabaseAdmin.from("sync_state").upsert(
    {
      key: "google_ads",
      last_run: new Date().toISOString(),
      last_status: errors.length ? `errors: ${errors.slice(0, 2).join(" | ")}` : "ok",
    },
    { onConflict: "key" },
  );

  return Response.json({ ok: errors.length === 0, saved, window: { since, until }, errors, took_ms: Date.now() - started });
}

export const Route = createFileRoute("/api/public/sync-google-ads")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
    },
  },
});

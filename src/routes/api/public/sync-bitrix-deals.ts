import { createFileRoute } from "@tanstack/react-router";

type BitrixDeal = Record<string, unknown>;

function parseExtraParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const q = url.includes("?") ? url.split("?")[1] : "";
    for (const [k, v] of new URLSearchParams(q)) params[k] = v;
  } catch {
    /* ignore */
  }
  return params;
}

function derivarOrigem(utmSource: string | null, fbclid: string | null): string {
  const s = (utmSource || "").toLowerCase();
  if (s.includes("google") || s.includes("gads") || s.includes("adwords")) return "Google";
  if (s.includes("facebook") || s.includes("meta") || s.includes("instagram") || s.includes("fb") || fbclid) return "Meta";
  return "Outros";
}

// Um fbclid real do Facebook começa com "IwA" ou "IwY" e tem mais de ~30 chars.
// Se o Bitrix mandar texto legível (ex: "Meta - FB TRIVE - Leads Santa Casa"),
// isso é na verdade um nome de campanha/rótulo, não um click ID.
function isRealFbclid(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^Iw[A-Z0-9]/.test(v) && v.length >= 20;
}


function extrairDominio(url: string): string | null {
  try {
    if (!url) return null;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function handler(request: Request): Promise<Response> {
  const started = Date.now();

  const url = new URL(request.url);
  const secretFromQuery = url.searchParams.get("secret");
  const secretFromHeader = request.headers.get("x-cron-secret");
  const apikeyHeader = request.headers.get("apikey");
  const provided = secretFromHeader || secretFromQuery || apikeyHeader || "";
  const expectedCron = process.env.CRON_SECRET || "";
  const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY || "";

  const matches = (a: string, b: string) => {
    if (!a || !b || a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  };
  if (!matches(provided, expectedCron) && !matches(provided, expectedAnon)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK_URL;
  if (!BITRIX_WEBHOOK) {
    return Response.json({ ok: false, error: "BITRIX_WEBHOOK_URL não configurado" }, { status: 500 });
  }
  const webhookBase = BITRIX_WEBHOOK.endsWith("/") ? BITRIX_WEBHOOK : `${BITRIX_WEBHOOK}/`;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const resetCursor = url.searchParams.get("reset") === "1";
  const startParam = url.searchParams.get("start");
  let start = 0;
  if (resetCursor) {
    start = 0;
  } else if (startParam !== null && Number.isFinite(Number(startParam)) && Number(startParam) >= 0) {
    start = Number(startParam);
  } else {
    const { data: cur } = await supabaseAdmin
      .from("sync_state")
      .select("start_cursor")
      .eq("key", "bitrix_deals")
      .maybeSingle();
    start = Number(cur?.start_cursor || 0);
  }
  let totalSynced = 0;
  let pages = 0;
  let hasMore = true;
  const MAX_PAGES = 30; // ~1500 registros por execução (cabe em ~30s)

  while (hasMore && pages < MAX_PAGES) {
    const resp = await fetch(`${webhookBase}crm.deal.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order: { DATE_CREATE: "DESC" },
        filter: {},
        select: [
          "ID", "TITLE", "CONTACT_ID", "STAGE_ID", "OPPORTUNITY",
          "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM",
          "UF_CRM_1773253579129", "UF_CRM_1773253633405",
          "UF_CRM_1773253674766", "UF_CRM_1773253691932", "UF_CRM_1773253705599",
          "DATE_CREATE",
        ],
        start,
      }),
    });

    if (!resp.ok) {
      return Response.json({ ok: false, error: `Bitrix status ${resp.status}` }, { status: 502 });
    }

    const data = await resp.json();
    const deals: BitrixDeal[] = data.result || [];
    pages++;

    const rows = deals.map((deal) => {
      const urlPagina = (deal.UF_CRM_1773253633405 as string) || "";
      const extra = parseExtraParams(urlPagina);
      const rawFbclid = extra.fbclid || (deal.UF_CRM_1773253705599 as string) || null;
      const fbclidReal = isRealFbclid(rawFbclid) ? rawFbclid : null;
      // Quando o "fbclid" do Bitrix não é um click ID real, é um rótulo
      // (nome de campanha ou nome do formulário) — usar como campaign_name fallback.
      const fbclidLabel = !isRealFbclid(rawFbclid) ? rawFbclid : null;
      const utmSource = (deal.UTM_SOURCE as string) || extra.utm_source || null;
      // Origem Meta = utm indica Meta, OU tem fbclid real, OU tem rótulo Meta-like
      const origem = derivarOrigem(utmSource, fbclidReal || (fbclidLabel && /meta|fb\b|facebook|instagram/i.test(fbclidLabel) ? "1" : null));
      const dominio = (deal.UF_CRM_1773253579129 as string) || extrairDominio(urlPagina);

      return {
        bitrix_deal_id: String(deal.ID),
        titulo: (deal.TITLE as string) || null,
        fase: (deal.STAGE_ID as string) || null,
        valor: deal.OPPORTUNITY != null ? Number(deal.OPPORTUNITY) : null,
        origem,
        utm_source: utmSource,
        utm_medium: (deal.UTM_MEDIUM as string) || extra.utm_medium || null,
        utm_campaign: (deal.UTM_CAMPAIGN as string) || extra.utm_campaign || null,
        utm_content: (deal.UTM_CONTENT as string) || extra.utm_content || null,
        utm_term: (deal.UTM_TERM as string) || extra.utm_term || null,
        dominio,
        url_pagina: urlPagina || null,
        id_formulario: (deal.UF_CRM_1773253674766 as string) || extra.form_id || null,
        nome_formulario: (deal.UF_CRM_1773253691932 as string) || extra.form_name || null,
        adset_id: extra.adset_id || extra.adsetid || null,
        ad_id: extra.ad_id || extra.adid || null,
        ad_name: extra.ad_name || extra.adname || null,
        adset_name: extra.adset_name || extra.adsetname || null,
        campaign_name: extra.campaign_name || extra.campaignname || fbclidLabel || null,
        placement: extra.placement || null,
        site_source_name: extra.site_source_name || null,
        fbclid: fbclidReal,
        data_criacao: (deal.DATE_CREATE as string) || null,
        synced_at: new Date().toISOString(),
      };
    });


    if (rows.length > 0) {
      // upsert em lotes de 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabaseAdmin
          .from("utm_conversions")
          .upsert(chunk, { onConflict: "bitrix_deal_id" });
        if (error) {
          return Response.json({ ok: false, error: error.message, totalSynced }, { status: 500 });
        }
      }
      totalSynced += rows.length;
    }

    if (typeof data.next === "number") {
      start = data.next;
      hasMore = true;
    } else {
      hasMore = false;
    }
  }

  const nextCursor = hasMore ? start : 0; // se acabou, reinicia do topo na próxima
  await supabaseAdmin
    .from("sync_state")
    .upsert({
      key: "bitrix_deals",
      start_cursor: nextCursor,
      last_run: new Date().toISOString(),
      last_status: hasMore ? `pages=${pages} synced=${totalSynced}` : `completed synced=${totalSynced}`,
    }, { onConflict: "key" });

  return Response.json({
    ok: true,
    total_synced: totalSynced,
    pages,
    took_ms: Date.now() - started,
    done: !hasMore,
    next_start: nextCursor,
  });
}

export const Route = createFileRoute("/api/public/sync-bitrix-deals")({
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

// touch 1784826780

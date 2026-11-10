import { createFileRoute } from "@tanstack/react-router";

type BitrixDeal = Record<string, unknown>;

/**
 * Único lugar para configurar os campos do negócio no Bitrix que trazem a campanha.
 * Assim que o CRM criar os campos (integração do formulário de Lead do Meta/Adveronix),
 * basta informar aqui o ID de cada campo (ex.: "UF_CRM_1790000000001").
 * Campaign ID é sempre tratado como texto. Vazio = campo ainda não existe no CRM.
 */
const BITRIX_CAMPAIGN_FIELDS = {
  campaign_id: "UF_CRM_1785865455270",
  adset_id: "UF_CRM_1785865504137",
  ad_id: "UF_CRM_1785865767228",
  campaign_name: "UF_CRM_1789998928139",
  adset_name: "UF_CRM_1785865485937",
  ad_name: "UF_CRM_1785865737598",
} as const;

function readField(deal: BitrixDeal, field: string, extra: Record<string, string>, extraKeys: string[]): string | null {
  if (field) {
    const v = deal[field];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  for (const k of extraKeys) {
    const v = extra[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

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

/** Classifica o canal a partir do texto (UTM ou nome da origem no CRM). */
function derivarOrigem(utmSource: string | null, fbclid: string | null): string {
  const s = (utmSource || "").toLowerCase();
  if (s.includes("insta") || s.includes("face")) return "Meta";
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


/** Mesma regra da função norm_phone no banco: DDD + os 8 últimos dígitos. */
function normPhone(v: string | null | undefined): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

type Contato = { nome: string | null; telefone: string | null; email: string | null };

/** Busca em lote os contatos ligados aos negócios (nome, telefone e e-mail). */
async function fetchContatos(webhookBase: string, ids: string[]): Promise<Map<string, Contato>> {
  const map = new Map<string, Contato>();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const r = await fetch(`${webhookBase}crm.contact.list.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { ID: chunk }, select: ["ID", "NAME", "LAST_NAME", "PHONE", "EMAIL"] }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      for (const c of (j.result || []) as Array<Record<string, any>>) {
        const nome = [c.NAME, c.LAST_NAME]
          .map((x) => String(x ?? "").replace(/\u00a0/g, "").trim())
          .filter(Boolean)
          .join(" ");
        map.set(String(c.ID), {
          nome: nome || null,
          telefone: c.PHONE?.[0]?.VALUE ? String(c.PHONE[0].VALUE) : null,
          email: c.EMAIL?.[0]?.VALUE ? String(c.EMAIL[0].VALUE) : null,
        });
      }
    } catch {
      /* segue sem os contatos deste lote */
    }
  }
  return map;
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
  // Mapa de origens do CRM (SOURCE_ID -> nome legível), usado quando o negócio
  // não traz UTMs (caso comum em CRMs alimentados por WhatsApp/telefonia).
  const sourceNames = new Map<string, string>();
  try {
    const sres = await fetch(`${webhookBase}crm.status.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: { ENTITY_ID: "SOURCE" } }),
    });
    if (sres.ok) {
      const sjson = await sres.json();
      for (const st of (sjson.result || []) as Array<Record<string, unknown>>) {
        sourceNames.set(String(st.STATUS_ID), String(st.NAME ?? ""));
      }
    }
  } catch {
    /* segue sem os nomes de origem */
  }

  // Espelho dos funis do Bitrix (nomes e ordem oficiais das etapas), usado na aba "Funil Bitrix".
  try {
    const cres = await fetch(`${webhookBase}crm.category.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityTypeId: 2 }),
    });
    if (cres.ok) {
      const cjson = await cres.json();
      const cats = (cjson.result?.categories || []) as Array<Record<string, unknown>>;
      if (cats.length) {
        await supabaseAdmin.from("bitrix_pipelines").upsert(
          cats.map((c) => ({
            id: String(c.id),
            name: String(c.name ?? `Funil ${c.id}`),
            sort: Number(c.sort ?? 0),
          })),
          { onConflict: "id" },
        );
      }
    }
    const stres = await fetch(`${webhookBase}crm.status.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: -1 }),
    });
    if (stres.ok) {
      const stjson = await stres.json();
      const rows = ((stjson.result || []) as Array<Record<string, unknown>>)
        .filter((r) => String(r.ENTITY_ID ?? "").startsWith("DEAL_STAGE"))
        .map((r) => {
          const entity = String(r.ENTITY_ID);
          const pipelineId = entity === "DEAL_STAGE" ? "0" : entity.split("_").pop()!;
          return {
            stage_id: String(r.STATUS_ID),
            pipeline_id: pipelineId,
            name: String(r.NAME ?? r.STATUS_ID),
            sort: Number(r.SORT ?? 0),
            semantics: (r.SEMANTICS as string | null) ?? null,
          };
        });
      if (rows.length) {
        await supabaseAdmin.from("bitrix_stages").upsert(rows, { onConflict: "stage_id" });
      }
    }
  } catch {
    /* segue sem atualizar o espelho dos funis */
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
          "ID", "TITLE", "CONTACT_ID", "STAGE_ID", "OPPORTUNITY", "SOURCE_ID",
          "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "UTM_TERM",
          "UF_CRM_1773253579129", "UF_CRM_1773253633405",
          "UF_CRM_1773253674766", "UF_CRM_1773253691932", "UF_CRM_1773253705599",
          "DATE_CREATE",
          ...Object.values(BITRIX_CAMPAIGN_FIELDS).filter(Boolean),
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

    const contatos = await fetchContatos(
      webhookBase,
      Array.from(new Set(deals.map((d) => String(d.CONTACT_ID ?? "")).filter((x) => x && x !== "0"))),
    );

    const rows = deals.map((deal) => {
      const contato = contatos.get(String(deal.CONTACT_ID ?? "")) ?? null;
      const urlPagina = (deal.UF_CRM_1773253633405 as string) || "";
      const extra = parseExtraParams(urlPagina);
      const rawFbclid = extra.fbclid || (deal.UF_CRM_1773253705599 as string) || null;
      const fbclidReal = isRealFbclid(rawFbclid) ? rawFbclid : null;
      // Quando o "fbclid" do Bitrix não é um click ID real, é um rótulo
      // (nome de campanha ou nome do formulário) — usar como campaign_name fallback.
      const fbclidLabel = !isRealFbclid(rawFbclid) ? rawFbclid : null;
      const sourceName = sourceNames.get(String(deal.SOURCE_ID ?? "")) || null;
      const utmSource = (deal.UTM_SOURCE as string) || extra.utm_source || sourceName || null;
      const dominio = (deal.UF_CRM_1773253579129 as string) || extrairDominio(urlPagina);

      // No Bitrix o campo "ID da campanha" às vezes recebe o NOME da campanha.
      // Só aceita como ID o que for numérico; o resto vira nome (resolvido depois por meta_campaigns).
      const campaignRef = readField(deal, BITRIX_CAMPAIGN_FIELDS.campaign_id, extra, ["campaign_id", "campaignid"]);
      const campaignIsId = !!campaignRef && /^\d{6,}$/.test(campaignRef);
      const campaignId = campaignIsId ? campaignRef : null;
      // Quando o campo traz texto em vez do número, ele é o nome da campanha.
      const campaignNameMeta =
        readField(deal, BITRIX_CAMPAIGN_FIELDS.campaign_name, extra, ["campaign_name", "campaignname"]) ||
        (campaignRef && !campaignIsId ? campaignRef : null);
      const adsetRef = readField(deal, BITRIX_CAMPAIGN_FIELDS.adset_id, extra, ["adset_id", "adsetid"]);
      const adsetId = adsetRef && /^\d{6,}$/.test(adsetRef) ? adsetRef : null;
      const adRef = readField(deal, BITRIX_CAMPAIGN_FIELDS.ad_id, extra, ["ad_id", "adid"]);
      const adId = adRef && /^\d{6,}$/.test(adRef) ? adRef : null;
      const campaignNameResolved =
        campaignNameMeta || extra.campaign_name || extra.campaignname || fbclidLabel || null;
      // Origem Meta = utm indica Meta, OU fbclid real, OU rótulo Meta-like, OU o CRM
      // trouxe campanha/anúncio (só a mídia paga preenche esses campos).
      const origem = derivarOrigem(
        utmSource,
        fbclidReal ||
          (fbclidLabel && /meta|fb\b|facebook|instagram/i.test(fbclidLabel) ? "1" : null) ||
          (campaignId || campaignNameResolved || adId ? "1" : null),
      );

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
        adset_id: adsetId,
        ad_id: adId,
        ad_name: readField(deal, BITRIX_CAMPAIGN_FIELDS.ad_name, extra, ["ad_name", "adname"]),
        adset_name: readField(deal, BITRIX_CAMPAIGN_FIELDS.adset_name, extra, ["adset_name", "adsetname"]),
        campaign_name: campaignNameResolved,
        placement: extra.placement || null,
        site_source_name: extra.site_source_name || null,
        campaign_id: campaignId,
        adset_id_meta: adsetId,
        ad_id_meta: adId,
        campaign_name_meta: campaignNameMeta,
        contato_nome: contato?.nome ?? null,
        contato_telefone: contato?.telefone ?? null,
        contato_telefone_norm: normPhone(contato?.telefone),
        contato_email: contato?.email ?? null,
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

  // Reconstrói o cruzamento entre os leads do Meta e os negócios do CRM.
  let match: Record<string, number> | null = null;
  try {
    const { data: m } = await (supabaseAdmin as any).rpc("rebuild_lead_match");
    match = (m ?? null) as Record<string, number> | null;
  } catch {
    /* segue sem recalcular o cruzamento */
  }

  return Response.json({
    ok: true,
    total_synced: totalSynced,
    match,
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

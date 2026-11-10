import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Sincroniza o histórico de etapas do CRM (crm.stagehistory).
 *
 * Sem esse histórico só é possível medir a foto atual do funil. Com ele, cada
 * etapa passa a ter a passagem real do lead, o que permite calcular a taxa de
 * aproveitamento por coorte (quem entrou no período e até onde chegou).
 *
 * Parâmetros de query:
 *  - since: data mínima da mudança (YYYY-MM-DD). Padrão: 60 dias atrás.
 *  - start: cursor de paginação (vem em `next_start` da resposta anterior).
 */

type StageHistoryItem = {
  ID: number;
  OWNER_ID: number;
  CATEGORY_ID?: number;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID?: string;
  CREATED_TIME: string;
};

function mesmoSegredo(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let d = 0;
  for (let i = 0; i < provided.length; i++) d |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return d === 0;
}

function isoDiasAtras(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function handler(request: Request): Promise<Response> {
  const started = Date.now();
  const url = new URL(request.url);

  const expectedCron = process.env.CRON_SECRET || "";
  const expectedAnon = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  const provided =
    url.searchParams.get("secret") ||
    request.headers.get("x-cron-secret") ||
    request.headers.get("apikey") ||
    "";

  if (!mesmoSegredo(provided, expectedCron) && !mesmoSegredo(provided, expectedAnon)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const webhook = process.env.BITRIX_WEBHOOK_URL;
  if (!webhook) {
    return Response.json({ ok: false, error: "missing BITRIX_WEBHOOK_URL" }, { status: 400 });
  }
  const base = webhook.endsWith("/") ? webhook : `${webhook}/`;

  const since = url.searchParams.get("since") || isoDiasAtras(60);
  let start = Number(url.searchParams.get("start") || 0);
  const maxPages = Number(url.searchParams.get("pages") || 40);

  let total = 0;
  let pages = 0;
  let hasMore = false;

  while (pages < maxPages) {
    const resp = await fetch(`${base}crm.stagehistory.list.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityTypeId: 2, // negócio
        filter: { ">=CREATED_TIME": `${since}T00:00:00-03:00` },
        order: { ID: "ASC" },
        start,
      }),
    });

    if (!resp.ok) {
      return Response.json(
        { ok: false, error: `Bitrix status ${resp.status}`, total_synced: total },
        { status: 502 },
      );
    }

    const data = await resp.json();
    if (data.error) {
      return Response.json(
        { ok: false, error: String(data.error_description || data.error), total_synced: total },
        { status: 502 },
      );
    }

    // O Bitrix devolve { result: { items, next } } aqui; aceita array por retrocompatibilidade.
    const bloco = data.result;
    const items = (Array.isArray(bloco) ? bloco : (bloco?.items ?? [])) as StageHistoryItem[];
    const next = bloco?.next ?? data.next;
    pages++;

    if (items.length === 0) {
      hasMore = false;
      break;
    }

    const rows = items.map((h) => ({
      id: Number(h.ID),
      deal_id: String(h.OWNER_ID),
      category_id: h.CATEGORY_ID ?? null,
      stage_id: String(h.STAGE_ID),
      semantics: h.STAGE_SEMANTIC_ID ?? null,
      changed_at: h.CREATED_TIME,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabaseAdmin
        .from("bitrix_stage_history")
        .upsert(rows.slice(i, i + 100), { onConflict: "id" });
      if (error) {
        return Response.json({ ok: false, error: error.message, total_synced: total }, { status: 500 });
      }
    }

    total += rows.length;

    if (typeof next === "number") {
      start = next;
      hasMore = true;
    } else {
      hasMore = false;
      break;
    }
  }

  return Response.json({
    ok: true,
    since,
    total_synced: total,
    pages,
    took_ms: Date.now() - started,
    done: !hasMore,
    next_start: hasMore ? start : 0,
  });
}

export const Route = createFileRoute("/api/public/sync-bitrix-stage-history")({
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

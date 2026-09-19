import { createFileRoute } from "@tanstack/react-router";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Página do Facebook cujos formulários de lead alimentam o CRM. */
const PAGE_NAME_MATCH = "alleman";

type AnyRec = Record<string, any>;

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(`${GRAPH_BASE}${path}`);
  u.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Meta ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r.json();
}

async function graphAll(path: string, token: string, params: Record<string, string>, maxPages = 40) {
  const out: AnyRec[] = [];
  let data = await graphGet(path, token, params);
  let pages = 0;
  while (true) {
    if (Array.isArray(data.data)) out.push(...data.data);
    const next = data.paging?.next as string | undefined;
    if (!next || ++pages >= maxPages) break;
    const r = await fetch(next);
    if (!r.ok) break;
    data = await r.json();
  }
  return out;
}

/** Mesma regra da função norm_phone no banco: DDD + os 8 últimos dígitos. */
export function normPhone(v: string | null | undefined): string | null {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

function pickField(fields: AnyRec[], names: string[]): string | null {
  for (const n of names) {
    const f = fields.find((x) => String(x.name ?? "").toLowerCase().includes(n));
    const v = f?.values?.[0];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
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
  const enc = new TextEncoder();
  const eq = (a: string, b: string) => {
    if (!a || !b) return false;
    const x = enc.encode(a);
    const y = enc.encode(b);
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i]! ^ y[i]!;
    return d === 0;
  };
  const expectedCron = (process.env.CRON_SECRET || "").trim();
  const expectedAnon = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  if (!eq(provided, expectedCron) && !eq(provided, expectedAnon)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.META_ACCESS_TOKEN;
  if (!token) return Response.json({ ok: false, error: "META_ACCESS_TOKEN não configurado" }, { status: 500 });

  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 90), 1), 730);
  const sinceMs = Date.now() - days * 86400000;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const errors: string[] = [];
  const stats: Record<string, number> = { forms: 0, leads: 0 };

  try {
    const pages = await graphAll("/me/accounts", token, { fields: "id,name,access_token", limit: "100" });
    const page = pages.find((p) => String(p.name ?? "").toLowerCase().includes(PAGE_NAME_MATCH));
    if (!page) throw new Error(`Página com "${PAGE_NAME_MATCH}" não encontrada no token`);
    const pageToken: string = page.access_token || token;

    const forms = await graphAll(`/${page.id}/leadgen_forms`, pageToken, {
      fields: "id,name,leads_count",
      limit: "100",
    });
    stats.forms = forms.length;
    if (forms.length) {
      await supabaseAdmin.from("meta_lead_forms").upsert(
        forms.map((f) => ({
          id: String(f.id),
          name: f.name ?? null,
          page_id: String(page.id),
          leads_count: Number(f.leads_count ?? 0),
        })),
        { onConflict: "id" },
      );
    }

    for (const form of forms) {
      if (!Number(form.leads_count ?? 0)) continue;
      let leads: AnyRec[] = [];
      try {
        leads = await graphAll(`/${form.id}/leads`, pageToken, {
          fields: "id,created_time,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,form_id,field_data",
          limit: "200",
        });
      } catch (e: any) {
        errors.push(`form ${form.id}: ${String(e?.message || e).slice(0, 200)}`);
        continue;
      }

      const rows = leads
        .filter((l) => Date.parse(l.created_time ?? "") >= sinceMs)
        .map((l) => {
          const fd: AnyRec[] = Array.isArray(l.field_data) ? l.field_data : [];
          const phone = pickField(fd, ["phone", "telefone"]);
          return {
            lead_id: String(l.id),
            form_id: String(l.form_id ?? form.id),
            form_name: form.name ?? null,
            campaign_id: l.campaign_id ? String(l.campaign_id) : null,
            campaign_name: l.campaign_name ?? null,
            adset_id: l.adset_id ? String(l.adset_id) : null,
            adset_name: l.adset_name ?? null,
            ad_id: l.ad_id ? String(l.ad_id) : null,
            ad_name: l.ad_name ?? null,
            created_time: l.created_time ?? null,
            nome: pickField(fd, ["full_name", "nome", "name"]),
            telefone_raw: phone,
            telefone_norm: normPhone(phone),
            email: pickField(fd, ["email", "e-mail"]),
            cidade: pickField(fd, ["cidade", "city"]),
            respostas: Object.fromEntries(
              fd.map((f) => [String(f.name), (f.values ?? []).join(" | ")]),
            ),
            synced_at: new Date().toISOString(),
          };
        });

      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("meta_leads")
          .upsert(rows.slice(i, i + 200), { onConflict: "lead_id" });
        if (error) errors.push(`upsert ${form.id}: ${error.message}`);
      }
      stats.leads += rows.length;
    }
  } catch (e: any) {
    errors.push(String(e?.message || e));
  }

  let match: Record<string, number> | null = null;
  try {
    const { data, error } = await (supabaseAdmin as any).rpc("rebuild_lead_match");
    if (error) errors.push(`match: ${error.message}`);
    match = (data ?? null) as Record<string, number> | null;
  } catch (e: any) {
    errors.push(`match: ${String(e?.message || e)}`);
  }

  await supabaseAdmin.from("meta_sync_state").upsert(
    {
      key: "meta_leads",
      last_run: new Date().toISOString(),
      last_status: errors.length ? `errors: ${errors.slice(0, 3).join(" | ")}` : "ok",
      meta: { ...stats, match, days },
    },
    { onConflict: "key" },
  );

  return Response.json({
    ok: errors.length === 0,
    ...stats,
    match,
    errors,
    took_ms: Date.now() - started,
  });
}

export const Route = createFileRoute("/api/public/sync-meta-leads")({
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

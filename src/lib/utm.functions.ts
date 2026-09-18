import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { applyFilters, fetchAll, getClient } from "@/lib/utm.server";

const FiltersSchema = z.object({
  from: z.string(),
  to: z.string(),
  origem: z.array(z.string()).optional(),
  utm_source: z.array(z.string()).optional(),
  utm_campaign: z.array(z.string()).optional(),
  dominio: z.array(z.string()).optional(),
});
export type Filters = z.infer<typeof FiltersSchema>;

export const getUtmDataBounds = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const supabase = await getClient();
  const { data: oldest, error: oldestError } = await supabase
    .from("utm_conversions")
    .select("data_criacao")
    .not("data_criacao", "is", null)
    .order("data_criacao", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldestError) throw new Error(oldestError.message);

  const { data: newest, error: newestError } = await supabase
    .from("utm_conversions")
    .select("data_criacao")
    .not("data_criacao", "is", null)
    .order("data_criacao", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newestError) throw new Error(newestError.message);

  return {
    from: oldest?.data_criacao ?? null,
    to: newest?.data_criacao ?? null,
  };
});

export const getUtmSummary = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const rows = await fetchAll(supabase, data);
    const from = new Date(data.from).getTime();
    const to = new Date(data.to).getTime();
    const durMs = to - from;
    const prevFrom = new Date(from - durMs).toISOString();
    const prevTo = new Date(to - durMs).toISOString();
    const prevRows = await fetchAll(supabase, { ...data, from: prevFrom, to: prevTo });

    const total = rows.length;
    const totalPrev = prevRows.length;
    const byOrigem = { Google: 0, Meta: 0, Outros: 0 } as Record<string, number>;
    let valorTotal = 0;
    for (const r of rows) {
      const key = r.origem === "Google" || r.origem === "Meta" ? r.origem : "Outros";
      byOrigem[key] = (byOrigem[key] || 0) + 1;
      if (r.valor) valorTotal += Number(r.valor);
    }
    const variacaoPct = totalPrev === 0 ? null : ((total - totalPrev) / totalPrev) * 100;
    return { total, valorTotal, byOrigem, totalPrev, variacaoPct };
  });

export const getUtmDashboard = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: stats, error } = await (supabase as any).rpc("get_utm_dashboard_stats", {
      p_from: data.from,
      p_to: data.to,
      p_origem: data.origem ?? [],
      p_utm_source: data.utm_source ?? [],
      p_utm_campaign: data.utm_campaign ?? [],
      p_dominio: data.dominio ?? [],
    });
    if (error) throw new Error(error.message);
    return stats as {
      summary: { total: number; valorTotal: number; byOrigem: Record<string, number>; totalPrev: number; variacaoPct: number | null };
      series: Array<{ day: string; Google: number; Meta: number; Outros: number }>;
      ads: Array<{ key: string; label: string; count: number; campaign?: string; adset?: string }>;
      pages: Array<{ dominio: string; count: number; origemPredominante: string }>;
    };
  });

export const getMetaDetail = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: stats, error } = await (supabase as any).rpc("get_meta_detail", {
      p_from: data.from,
      p_to: data.to,
      p_utm_source: data.utm_source ?? [],
      p_utm_campaign: data.utm_campaign ?? [],
      p_dominio: data.dominio ?? [],
    });
    if (error) throw new Error(error.message);
    return stats as {
      summary: { total: number; valorTotal: number; campanhas: number; anuncios: number };
      daily: Array<{ day: string; total: number; valor: number }>;
      byCampaign: Array<{ campaign: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; count: number; valor: number }>;
      byAdset: Array<{ adset: string; campaign: string; count: number; valor: number }>;
      byAd: Array<{ ad: string; adset: string; campaign: string; placement: string | null; site_source_name: string | null; count: number; valor: number }>;
      byUtm: Array<{ utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null; count: number; valor: number }>;
      byPage: Array<{ dominio: string | null; url_pagina: string | null; count: number }>;
      byPlacement: Array<{ placement: string; site: string; count: number }>;
    };
  });

export const getGoogleDetail = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: stats, error } = await (supabase as any).rpc("get_google_detail", {
      p_from: data.from,
      p_to: data.to,
      p_utm_source: data.utm_source ?? [],
      p_utm_campaign: data.utm_campaign ?? [],
      p_dominio: data.dominio ?? [],
    });
    if (error) throw new Error(error.message);
    return stats as {
      summary: { total: number; valorTotal: number; dominios: number; campanhas: number; termos: number };
      daily: Array<{ day: string; total: number; valor: number }>;
      byDomain: Array<{ dominio: string; count: number; valor: number; campanhas: number; termos: number; ultimo: string | null }>;
      byDomainCampaign: Array<{ dominio: string; campaign: string; utm_source: string | null; utm_medium: string | null; count: number; valor: number }>;
      byTerm: Array<{ dominio: string; termo: string; campaign: string; count: number }>;
      byPage: Array<{ dominio: string; pagina: string; count: number; valor: number }>;
    };
  });

export const getDomainComparison = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const rows = await fetchAll(supabase, data);
    const map = new Map<
      string,
      { dominio: string; Google: number; Meta: number; Outros: number; total: number; valor: number }
    >();
    for (const r of rows) {
      const dom = r.dominio || "—";
      const key = r.origem === "Google" || r.origem === "Meta" ? r.origem : "Outros";
      const e = map.get(dom) ?? { dominio: dom, Google: 0, Meta: 0, Outros: 0, total: 0, valor: 0 };
      e[key] += 1;
      e.total += 1;
      if (r.valor) e.valor += Number(r.valor);
      map.set(dom, e);
    }
    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const totals = list.reduce(
      (acc, r) => {
        acc.Google += r.Google;
        acc.Meta += r.Meta;
        acc.Outros += r.Outros;
        acc.total += r.total;
        return acc;
      },
      { Google: 0, Meta: 0, Outros: 0, total: 0 },
    );
    return {
      totals,
      dominios: list.length,
      rows: list.slice(0, 100),
    };
  });

export const getUtmTimeseries = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const rows = await fetchAll(supabase, data);
    const bucket = new Map<string, { day: string; Google: number; Meta: number; Outros: number }>();
    for (const r of rows) {
      if (!r.data_criacao) continue;
      // agrupa pelo dia no fuso de Brasília (não em UTC)
      const day = new Date(r.data_criacao).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const key = r.origem === "Google" || r.origem === "Meta" ? r.origem : "Outros";
      const existing = bucket.get(day) ?? { day, Google: 0, Meta: 0, Outros: 0 };
      existing[key] += 1;
      bucket.set(day, existing);
    }
    return Array.from(bucket.values()).sort((a, b) => a.day.localeCompare(b.day));
  });

export const getTopAds = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const rows = await fetchAll(supabase, data);
    const map = new Map<string, { key: string; label: string; count: number; campaign?: string; adset?: string }>();
    for (const r of rows) {
      if (r.origem !== "Google" && r.origem !== "Meta") continue;
      const key = r.ad_name || r.ad_id;
      if (!key) continue;
      const existing = map.get(key) ?? {
        key,
        label: r.ad_name || r.ad_id || "—",
        count: 0,
        campaign: r.campaign_name || undefined,
        adset: r.adset_name || undefined,
      };
      existing.count++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  });

export const getTopPages = createServerFn({ method: "POST" })
  .inputValidator((d) => FiltersSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const rows = await fetchAll(supabase, data);
    const map = new Map<string, { dominio: string; count: number; origens: Record<string, number> }>();
    for (const r of rows) {
      if (!r.dominio) continue;
      const existing = map.get(r.dominio) ?? { dominio: r.dominio, count: 0, origens: {} };
      existing.count++;
      const o = r.origem || "Outros";
      existing.origens[o] = (existing.origens[o] || 0) + 1;
      map.set(r.dominio, existing);
    }
    return Array.from(map.values())
      .map((p) => ({
        dominio: p.dominio,
        count: p.count,
        origemPredominante: Object.entries(p.origens).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Outros",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  });

export const getConversionsTable = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    FiltersSchema.extend({
      search: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    let query = supabase
      .from("utm_conversions")
      .select("bitrix_deal_id,titulo,fase,valor,origem,campaign_name,ad_name,dominio,data_criacao", { count: "exact" });
    query = applyFilters(query, data);
    if (data.search) {
      const s = `%${data.search}%`;
      query = query.or(`titulo.ilike.${s},ad_name.ilike.${s},campaign_name.ilike.${s}`);
    }
    query = query.order("data_criacao", { ascending: false });
    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows || [], total: count ?? 0 };
  });

export const getFilterOptions = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("utm_conversions")
    .select("utm_source,utm_campaign,dominio,origem")
    .limit(10000);
  if (error) throw new Error(error.message);
  const sources = new Set<string>();
  const campaigns = new Set<string>();
  const dominios = new Set<string>();
  const origens = new Set<string>();
  for (const r of (data || []) as any[]) {
    if (r.utm_source) sources.add(r.utm_source);
    if (r.utm_campaign) campaigns.add(r.utm_campaign);
    if (r.dominio) dominios.add(r.dominio);
    if (r.origem) origens.add(r.origem);
  }
  return {
    utm_source: Array.from(sources).sort(),
    utm_campaign: Array.from(campaigns).sort(),
    dominio: Array.from(dominios).sort(),
    origem: Array.from(origens).sort(),
  };
});

const TermSchema = FiltersSchema.extend({ term: z.string().min(1) });

export type TermSearchResult = {
  total: number;
  valor: number;
  byOrigem: Record<string, number>;
  byCampaign: Array<{ label: string; count: number }>;
  byAd: Array<{ label: string; count: number }>;
  byForm: Array<{ label: string; count: number }>;
  daily: Array<{ day: string; count: number }>;
  semAtribuicao: number;
};

export const searchLeadsByTerm = createServerFn({ method: "POST" })
  .inputValidator((d) => TermSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const s = `%${data.term.replace(/[,%]/g, " ").trim()}%`;
    let query = supabase
      .from("utm_conversions")
      .select(
        "origem,valor,campaign_name,ad_name,adset_name,nome_formulario,utm_campaign,utm_content,titulo,dominio,ad_id,data_criacao",
      )
      .gte("data_criacao", data.from)
      .lte("data_criacao", data.to)
      .or(
        [
          `campaign_name.ilike.${s}`,
          `ad_name.ilike.${s}`,
          `adset_name.ilike.${s}`,
          `nome_formulario.ilike.${s}`,
          `utm_campaign.ilike.${s}`,
          `utm_content.ilike.${s}`,
          `dominio.ilike.${s}`,
          `titulo.ilike.${s}`,
        ].join(","),
      )
      .limit(20000);
    if (data.origem?.length) query = query.in("origem", data.origem);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const list = (rows || []) as any[];
    const byOrigem: Record<string, number> = {};
    const camp = new Map<string, number>();
    const ad = new Map<string, number>();
    const form = new Map<string, number>();
    const day = new Map<string, number>();
    let valor = 0;
    let semAtribuicao = 0;

    for (const r of list) {
      const o = r.origem || "Outros";
      byOrigem[o] = (byOrigem[o] || 0) + 1;
      valor += Number(r.valor || 0);
      if (!r.ad_id && !r.campaign_name) semAtribuicao++;
      const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
      bump(camp, (r.campaign_name || r.utm_campaign || "— sem campanha").trim());
      bump(ad, (r.ad_name || "— sem anúncio").trim());
      bump(form, (r.nome_formulario || "— sem formulário").trim());
      if (r.data_criacao) {
        const d = new Date(r.data_criacao).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        bump(day, d);
      }
    }
    const top = (m: Map<string, number>, n = 25) =>
      Array.from(m.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);

    return {
      total: list.length,
      valor,
      byOrigem,
      byCampaign: top(camp),
      byAd: top(ad),
      byForm: top(form),
      daily: Array.from(day.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      semAtribuicao,
    } as TermSearchResult;
  });

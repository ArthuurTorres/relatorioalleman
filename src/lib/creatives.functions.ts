import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

export const CreativesQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type CreativesQueryInput = z.infer<typeof CreativesQuerySchema>;

export type DeliveryState =
  | "active"
  | "ad_paused"
  | "adset_paused"
  | "campaign_paused"
  | "issues"
  | "archived";

export type CreativeDeliveryState = DeliveryState;

export type PerformanceTag =
  | "champion"
  | "scalable"
  | "attention"
  | "testing"
  | "idle_active";

export type CreativePerformanceTag = PerformanceTag;

export type CreativeFunnelStage = {
  step_name: string;
  label: string;
  step_rank: number;
};

export type CreativeItem = {
  ad_id: string;
  ad_name: string;
  creative_id: string;
  account_id: string | null;
  adset_id: string | null;
  adset_name: string;
  campaign_id: string | null;
  campaign_name: string;
  objective: string | null;
  ad_status: string | null;
  adset_status: string | null;
  campaign_status: string | null;
  is_serving_now: boolean;
  delivery_state: DeliveryState;
  performance_tag: PerformanceTag;

  // Assets from meta_creatives (null when meta_creatives has not been synced yet)
  thumbnail_url: string | null;
  image_url: string | null;
  title: string | null;
  body: string | null;
  link_url: string | null;
  created_time: string | null;
  updated_time: string | null;

  // Media metrics in [from, to]
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  leads_meta: number;
  ctr: number;
  cpc: number;
  cpm: number;

  // Previous equivalent period [prevFrom, prevTo] & variations
  prev_spend: number;
  prev_impressions: number;
  prev_clicks: number;
  prev_leads: number;
  prev_leads_crm: number;
  prev_leads_meta: number;
  prev_cpl: number | null;
  prev_ctr: number;
  spend_delta_pct: number | null;
  leads_delta_pct: number | null;
  cpl_delta_pct: number | null;
  ctr_delta_pct: number | null;

  // Bitrix CRM attribution in [from, to]
  leads_crm: number;
  leads_crm_meta: number;
  leads_crm_outros: number;
  leads: number;
  valor_gerado: number;
  valor_meta: number;
  valor_outros: number;
  ticket_medio: number | null;
  cpl: number | null;
  cpl_meta: number | null;
  roas: number | null;

  // Bitrix commercial funnel cohort (cumulative 0..100%)
  funnel_counts: Record<string, number>;
  funnel_rates: Record<string, number>;
  funnel: Record<string, number>;
};

export type CreativesSummary = {
  active_now_count: number;
  with_spend_count: number;
  total_count: number;
  total_spend: number;
  total_impressions: number;
  total_reach: number;
  total_clicks: number;
  total_link_clicks: number;
  total_leads: number;
  total_leads_crm: number;
  total_leads_meta: number;
  total_valor: number;
  avg_cpl: number | null;
  avg_cpl_meta: number | null;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpm: number;
  avg_roas: number | null;
  prev_total_spend: number;
  prev_total_leads: number;
  prev_avg_cpl: number | null;
  prev_avg_ctr: number;
  spend_delta_pct: number | null;
  leads_delta_pct: number | null;
  cpl_delta_pct: number | null;
  ctr_delta_pct: number | null;
};

export type CreativesPayload = {
  items: CreativeItem[];
  creatives: CreativeItem[];
  ads: CreativeItem[];
  stages: CreativeFunnelStage[];
  summary: CreativesSummary;
  benchmarks: CreativesSummary;
  period: {
    from: string;
    to: string;
    prev_from: string;
    prev_to: string;
    days: number;
  };
  has_creative_assets: boolean;
};

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 200;

const CANONICAL_STEP_LABELS: Record<string, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  tentativa: "Tentativa",
  contatado: "Contatado",
  negociacao: "Negociação",
  venda: "Venda",
  perdido: "Perdido",
};

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nonEmpty(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function pctDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

/**
 * Converte uma data ISO ou YYYY-MM-DD para YYYY-MM-DD em America/Sao_Paulo,
 * preservando os limites sintéticos de dia do dashboard (`T00:00:00.000Z` / `T23:59:59.999Z`).
 */
export function toSaoPauloDay(raw: string): string {
  const trimmed = raw.trim();
  const plainDay = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (plainDay) return plainDay[1]!;

  const syntheticDay = /^(\d{4}-\d{2}-\d{2})T(?:00:00:00(?:\.000)?|23:59:59(?:\.999)?)Z$/.exec(
    trimmed,
  );
  if (syntheticDay) return syntheticDay[1]!;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Data inválida: ${raw}`);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function shiftIsoDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function inclusiveDaysBetween(startDay: string, endDay: string): number {
  const [sy, sm, sd] = startDay.split("-").map(Number);
  const [ey, em, ed] = endDay.split("-").map(Number);
  const startUtc = Date.UTC(sy ?? 1970, (sm ?? 1) - 1, sd ?? 1);
  const endUtc = Date.UTC(ey ?? 1970, (em ?? 1) - 1, ed ?? 1);
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

function buildNormalizedWindows(from: string, to: string) {
  let startDay = toSaoPauloDay(from);
  let endDay = toSaoPauloDay(to);
  if (startDay > endDay) {
    const tmp = startDay;
    startDay = endDay;
    endDay = tmp;
  }
  const days = inclusiveDaysBetween(startDay, endDay);
  const prevEndDay = shiftIsoDay(startDay, -1);
  const prevStartDay = shiftIsoDay(startDay, -days);

  return {
    startDay,
    endDay,
    prevStartDay,
    prevEndDay,
    days,
    fromIso: `${startDay}T00:00:00.000-03:00`,
    toIso: `${endDay}T23:59:59.999-03:00`,
    prevFromIso: `${prevStartDay}T00:00:00.000-03:00`,
    prevToIso: `${prevEndDay}T23:59:59.999-03:00`,
  };
}

/**
 * Extrai leads reportados pela Meta no array JSON `actions` de `meta_ad_insights`
 * sem duplicar `lead` com `onsite_conversion.lead_grouped` na mesma linha diária.
 */
function extractMetaLeadsFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  const priority = [
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
  ];
  for (const target of priority) {
    const found = (actions as Array<Record<string, unknown>>).find(
      (a) => String(a?.action_type ?? "") === target,
    );
    if (found) return Math.round(num(found.value));
  }
  return 0;
}

function resolveDeliveryState(
  adStatusRaw: string | null,
  adsetStatusRaw: string | null,
  campaignStatusRaw: string | null,
): { isServingNow: boolean; deliveryState: DeliveryState } {
  const adEff = (adStatusRaw ?? "").toUpperCase();
  const adsetEff = (adsetStatusRaw ?? "").toUpperCase();
  const campEff = (campaignStatusRaw ?? "").toUpperCase();

  if (adEff === "ACTIVE" && adsetEff === "ACTIVE" && campEff === "ACTIVE") {
    return { isServingNow: true, deliveryState: "active" };
  }

  const all = [adEff, adsetEff, campEff];
  if (all.some((s) => s === "ARCHIVED" || s === "DELETED")) {
    return { isServingNow: false, deliveryState: "archived" };
  }
  if (
    all.some(
      (s) =>
        s === "WITH_ISSUES" ||
        s === "DISAPPROVED" ||
        s === "PENDING_BILLING_INFO" ||
        s === "ADSET_ISSUES" ||
        s === "CAMPAIGN_ISSUES",
    )
  ) {
    return { isServingNow: false, deliveryState: "issues" };
  }
  if (
    campEff === "PAUSED" ||
    adEff === "CAMPAIGN_PAUSED" ||
    adsetEff === "CAMPAIGN_PAUSED"
  ) {
    return { isServingNow: false, deliveryState: "campaign_paused" };
  }
  if (adsetEff === "PAUSED" || adEff === "ADSET_PAUSED") {
    return { isServingNow: false, deliveryState: "adset_paused" };
  }
  if (adEff === "PAUSED") {
    return { isServingNow: false, deliveryState: "ad_paused" };
  }

  if (campEff && campEff !== "ACTIVE") {
    return { isServingNow: false, deliveryState: "campaign_paused" };
  }
  if (adsetEff && adsetEff !== "ACTIVE") {
    return { isServingNow: false, deliveryState: "adset_paused" };
  }
  return { isServingNow: false, deliveryState: "ad_paused" };
}

function classifyPerformanceTag(params: {
  isServingNow: boolean;
  deliveryState: DeliveryState;
  spend: number;
  impressions: number;
  leads: number;
  cpl: number | null;
  ctr: number;
  roas: number | null;
  valorGerado: number;
  avgCpl: number | null;
  avgCtr: number;
}): PerformanceTag {
  const {
    isServingNow,
    deliveryState,
    spend,
    impressions,
    leads,
    cpl,
    ctr,
    roas,
    valorGerado,
    avgCpl,
    avgCtr,
  } = params;

  if (isServingNow && spend === 0 && leads === 0 && impressions < 50) {
    return "idle_active";
  }

  const refCpl = avgCpl && avgCpl > 0 ? avgCpl : 50;

  if (
    leads >= 3 &&
    cpl != null &&
    cpl <= refCpl * 1.15 &&
    ((roas != null && roas >= 3 && valorGerado > 0) ||
      (leads >= 4 &&
        cpl <= refCpl * 0.85 &&
        (avgCtr <= 0 || ctr >= avgCtr * 0.8 || valorGerado > 0)))
  ) {
    return "champion";
  }

  if (
    (leads >= 2 && cpl != null && cpl <= refCpl * 1.1) ||
    (valorGerado > 0 && leads >= 1 && (cpl == null || cpl <= refCpl * 1.25))
  ) {
    return "scalable";
  }

  if (
    deliveryState === "issues" ||
    (spend >= refCpl * 1.35 && leads === 0) ||
    (cpl != null && cpl > refCpl * 1.35 && spend >= refCpl)
  ) {
    return "attention";
  }

  return "testing";
}

function pipelineIdFromStageId(stageId: string): number {
  const match = /^C(\d+):/.exec(stageId);
  return match ? Number(match[1]) : 0;
}

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? String(error));
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

type InsightAccumulator = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  leads_meta: number;
};

function emptyInsightAcc(): InsightAccumulator {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    link_clicks: 0,
    leads_meta: 0,
  };
}

type CrmAccumulator = {
  dealIds: Set<string>;
  metaDealIds: Set<string>;
  outrosDealIds: Set<string>;
  valor_meta: number;
  valor_outros: number;
};

function emptyCrmAcc(): CrmAccumulator {
  return {
    dealIds: new Set<string>(),
    metaDealIds: new Set<string>(),
    outrosDealIds: new Set<string>(),
    valor_meta: 0,
    valor_outros: 0,
  };
}

type CreativeAssetRow = {
  creative_id: string;
  thumbnail_url: string | null;
  image_url: string | null;
  title: string | null;
  body: string | null;
  link_url: string | null;
};

async function fetchCreativeAssetsTolerant(
  supabase: any,
): Promise<{ map: Map<string, CreativeAssetRow>; exists: boolean }> {
  const map = new Map<string, CreativeAssetRow>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meta_creatives")
      .select("creative_id,thumbnail_url,image_url,title,body,link_url")
      .order("creative_id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      const code = String(error.code ?? "");
      const msg = String(error.message ?? "");
      if (
        code === "PGRST205" ||
        code === "42P01" ||
        msg.includes("meta_creatives")
      ) {
        return { map, exists: false };
      }
      console.warn("[creatives] falha ao ler meta_creatives:", code, msg);
      return { map, exists: false };
    }

    const batch = (data ?? []) as Array<Record<string, unknown>>;
    for (const row of batch) {
      const cid = nonEmpty(row.creative_id);
      if (!cid) continue;
      map.set(cid, {
        creative_id: cid,
        thumbnail_url: nonEmpty(row.thumbnail_url) ?? nonEmpty(row.image_url),
        image_url: nonEmpty(row.image_url) ?? nonEmpty(row.thumbnail_url),
        title: nonEmpty(row.title),
        body: nonEmpty(row.body),
        link_url: nonEmpty(row.link_url),
      });
    }
    if (batch.length < PAGE_SIZE) break;
  }
  return { map, exists: map.size > 0 };
}

/**
 * Agregação server-side direta via supabaseAdmin, livre de fan-out cartesiano
 * e tolerante à ausência de `public.meta_creatives` (PGRST205).
 */
export async function computeCreativesPerformance(
  supabase: any,
  input: CreativesQueryInput,
): Promise<CreativesPayload> {
  const win = buildNormalizedWindows(input.from, input.to);
  const fromMs = Date.parse(win.fromIso);
  const toMs = Date.parse(win.toIso);
  const prevFromMs = Date.parse(win.prevFromIso);
  const prevToMs = Date.parse(win.prevToIso);

  const [
    campaignsRows,
    adsetsRows,
    adsRows,
    creativeAssetsResult,
    insightsRows,
    leadMatchRows,
    utmRows,
    stageMapRes,
  ] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("meta_campaigns")
        .select("id,account_id,name,objective,status,effective_status")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("meta_adsets")
        .select("id,account_id,campaign_id,name,status,effective_status")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("meta_ads")
        .select(
          "id,account_id,adset_id,campaign_id,name,status,effective_status,creative_id,created_time,updated_time",
        )
        .order("id")
        .range(from, to),
    ),
    fetchCreativeAssetsTolerant(supabase),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("meta_ad_insights")
        .select(
          "ad_id,adset_id,campaign_id,date_start,spend,impressions,reach,clicks,inline_link_clicks,actions",
        )
        .gte("date_start", win.prevStartDay)
        .lte("date_start", win.endDay)
        .order("date_start", { ascending: true })
        .order("ad_id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("lead_match")
        .select("bitrix_deal_id,ad_id,adset_id,campaign_id,matched_at")
        .order("bitrix_deal_id")
        .range(from, to),
    ),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("utm_conversions")
        .select(
          "bitrix_deal_id,valor,fase,origem,ad_id,ad_id_meta,adset_id,ad_name,campaign_id,campaign_name,data_criacao",
        )
        .gte("data_criacao", win.prevFromIso)
        .lte("data_criacao", win.toIso)
        .order("data_criacao", { ascending: true })
        .order("bitrix_deal_id", { ascending: true })
        .range(from, to),
    ),
    supabase
      .from("bitrix_stage_map")
      .select("stage_id,funnel_step,step_rank,label")
      .order("step_rank", { ascending: true }),
  ]);

  if (stageMapRes.error) {
    throw new Error(stageMapRes.error.message);
  }

  // 1) Índices de hierarquia Meta (campanha / conjunto / anúncio)
  const campaignsMap = new Map<string, Record<string, unknown>>();
  for (const c of campaignsRows) {
    const id = nonEmpty(c.id);
    if (id) campaignsMap.set(id, c);
  }

  const adsetsMap = new Map<string, Record<string, unknown>>();
  for (const a of adsetsRows) {
    const id = nonEmpty(a.id);
    if (id) adsetsMap.set(id, a);
  }

  const adsMap = new Map<string, Record<string, unknown>>();
  for (const ad of adsRows) {
    const id = nonEmpty(ad.id);
    if (id) adsMap.set(id, ad);
  }

  // 2) Agregação de mídia por ad_id em [from, to] e [prevFrom, prevTo] (sem fan-out)
  const currInsights = new Map<string, InsightAccumulator>();
  const prevInsights = new Map<string, InsightAccumulator>();

  for (const row of insightsRows) {
    const adId = nonEmpty(row.ad_id);
    const day = nonEmpty(row.date_start)?.slice(0, 10);
    if (!adId || !day) continue;

    const targetMap =
      day >= win.startDay && day <= win.endDay
        ? currInsights
        : day >= win.prevStartDay && day <= win.prevEndDay
          ? prevInsights
          : null;
    if (!targetMap) continue;

    const acc = targetMap.get(adId) ?? emptyInsightAcc();
    acc.spend += num(row.spend);
    acc.impressions += Math.round(num(row.impressions));
    acc.reach += Math.round(num(row.reach));
    acc.clicks += Math.round(num(row.clicks));
    acc.link_clicks += Math.round(num(row.inline_link_clicks));
    acc.leads_meta += extractMetaLeadsFromActions(row.actions);
    targetMap.set(adId, acc);

    if (!adsMap.has(adId)) {
      adsMap.set(adId, {
        id: adId,
        account_id: null,
        adset_id: nonEmpty(row.adset_id),
        campaign_id: nonEmpty(row.campaign_id),
        name: adId,
        status: "ARCHIVED",
        effective_status: "ARCHIVED",
        creative_id: adId,
        created_time: null,
        updated_time: null,
      });
    }
  }

  // 3) Índice deduplicado de lead_match (bitrix_deal_id -> mais recente ad_id)
  const leadMatchByDeal = new Map<
    string,
    { ad_id: string | null; adset_id: string | null; campaign_id: string | null; matched_at: string }
  >();
  for (const row of leadMatchRows) {
    const dealId = nonEmpty(row.bitrix_deal_id);
    if (!dealId) continue;
    const matchedAt = String(row.matched_at ?? "");
    const existing = leadMatchByDeal.get(dealId);
    if (!existing || matchedAt >= existing.matched_at) {
      leadMatchByDeal.set(dealId, {
        ad_id: nonEmpty(row.ad_id),
        adset_id: nonEmpty(row.adset_id),
        campaign_id: nonEmpty(row.campaign_id),
        matched_at: matchedAt,
      });
    }
  }

  // 4) Atribuição CRM Bitrix em [from, to] e [prevFrom, prevTo] sem fan-out
  const currCrm = new Map<string, CrmAccumulator>();
  const prevCrm = new Map<string, CrmAccumulator>();
  const currentDealFase = new Map<string, string>();
  const seenUtmCurrent = new Set<string>();
  const seenUtmPrev = new Set<string>();

  for (const row of utmRows) {
    const dealId = nonEmpty(row.bitrix_deal_id);
    const createdStr = nonEmpty(row.data_criacao);
    if (!dealId || !createdStr) continue;
    const createdMs = Date.parse(createdStr);
    if (Number.isNaN(createdMs)) continue;

    const matched = leadMatchByDeal.get(dealId);
    const adId =
      matched?.ad_id ?? nonEmpty(row.ad_id_meta) ?? nonEmpty(row.ad_id);
    if (!adId) continue;

    const valor = num(row.valor);
    const isMetaOrigem = String(row.origem ?? "Meta") === "Meta";

    if (createdMs >= fromMs && createdMs <= toMs) {
      if (seenUtmCurrent.has(dealId)) continue;
      seenUtmCurrent.add(dealId);

      const fase = nonEmpty(row.fase);
      if (fase) currentDealFase.set(dealId, fase);

      const acc = currCrm.get(adId) ?? emptyCrmAcc();
      acc.dealIds.add(dealId);
      if (isMetaOrigem) {
        acc.metaDealIds.add(dealId);
        acc.valor_meta += valor;
      } else {
        acc.outrosDealIds.add(dealId);
        acc.valor_outros += valor;
      }
      currCrm.set(adId, acc);

      if (!adsMap.has(adId)) {
        adsMap.set(adId, {
          id: adId,
          account_id: null,
          adset_id: matched?.adset_id ?? nonEmpty(row.adset_id),
          campaign_id: matched?.campaign_id ?? nonEmpty(row.campaign_id),
          name: nonEmpty(row.ad_name) ?? adId,
          status: "ARCHIVED",
          effective_status: "ARCHIVED",
          creative_id: adId,
          created_time: null,
          updated_time: null,
        });
      }
    } else if (createdMs >= prevFromMs && createdMs <= prevToMs) {
      if (seenUtmPrev.has(dealId)) continue;
      seenUtmPrev.add(dealId);

      const acc = prevCrm.get(adId) ?? emptyCrmAcc();
      acc.dealIds.add(dealId);
      if (isMetaOrigem) {
        acc.metaDealIds.add(dealId);
        acc.valor_meta += valor;
      } else {
        acc.outrosDealIds.add(dealId);
        acc.valor_outros += valor;
      }
      prevCrm.set(adId, acc);
    }
  }

  // 5) Mapa de etapas do Funil Comercial Bitrix + Coorte por anúncio
  // Inclui pipeline 0 (Comercial, rank >= 1) e etapas de fechamento/emissão (rank 6 em C3/C5),
  // excluindo Declínios (C7) e Carteira antiga (C23) para não distorcer taxas de contato.
  const validStageRank = new Map<string, { rank: number; step: string }>();
  const stepsByRank = new Map<number, CreativeFunnelStage>();

  for (const raw of (stageMapRes.data ?? []) as Array<Record<string, unknown>>) {
    const stageId = nonEmpty(raw.stage_id);
    const stepName = nonEmpty(raw.funnel_step);
    const rank = Math.round(num(raw.step_rank));
    if (!stageId || !stepName || rank < 1) continue;

    const pid = pipelineIdFromStageId(stageId);
    const isCommercialStage =
      pid === 0 || ((pid === 3 || pid === 5) && rank === 6);
    if (!isCommercialStage) continue;

    const prev = validStageRank.get(stageId);
    if (!prev || rank > prev.rank) {
      validStageRank.set(stageId, { rank, step: stepName });
    }

    if (!stepsByRank.has(rank)) {
      stepsByRank.set(rank, {
        step_name: stepName,
        label: CANONICAL_STEP_LABELS[stepName] ?? nonEmpty(raw.label) ?? stepName,
        step_rank: rank,
      });
    }
  }

  const stages: CreativeFunnelStage[] = [...stepsByRank.values()].sort(
    (a, b) => a.step_rank - b.step_rank,
  );

  // Coleta todos os bitrix_deal_id atribuídos a criativos no período atual
  const allAttributedDeals = new Set<string>();
  for (const crm of currCrm.values()) {
    for (const dealId of crm.dealIds) allAttributedDeals.add(dealId);
  }

  const bestDealRank = new Map<string, number>();
  for (const dealId of allAttributedDeals) {
    const currentFase = currentDealFase.get(dealId);
    if (currentFase) {
      const mapped = validStageRank.get(currentFase);
      if (mapped) bestDealRank.set(dealId, mapped.rank);
    }
  }

  const dealIdList = [...allAttributedDeals];
  for (let i = 0; i < dealIdList.length; i += ID_CHUNK_SIZE) {
    const chunk = dealIdList.slice(i, i + ID_CHUNK_SIZE);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: historyBatch, error: historyErr } = await supabase
        .from("bitrix_stage_history")
        .select("deal_id,stage_id")
        .in("deal_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (historyErr) throw new Error(historyErr.message);
      const rows = (historyBatch ?? []) as Array<{
        deal_id: string;
        stage_id: string | null;
      }>;
      for (const h of rows) {
        if (!h.stage_id) continue;
        const mapped = validStageRank.get(h.stage_id);
        if (!mapped) continue;
        const prev = bestDealRank.get(h.deal_id) ?? 0;
        if (mapped.rank > prev) bestDealRank.set(h.deal_id, mapped.rank);
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }

  // 6) Monta lista preliminar filtrada (is_serving_now || spend > 0 || impressions > 0 || leads > 0)
  const draftItems: CreativeItem[] = [];

  for (const [adId, adRow] of adsMap.entries()) {
    const adsetId = nonEmpty(adRow.adset_id);
    const campaignId = nonEmpty(adRow.campaign_id);
    const adsetRow = adsetId ? adsetsMap.get(adsetId) : undefined;
    const campaignRow = campaignId ? campaignsMap.get(campaignId) : undefined;

    const adStatus = nonEmpty(adRow.effective_status) ?? nonEmpty(adRow.status);
    const adsetStatus =
      nonEmpty(adsetRow?.effective_status) ?? nonEmpty(adsetRow?.status) ?? null;
    const campaignStatus =
      nonEmpty(campaignRow?.effective_status) ??
      nonEmpty(campaignRow?.status) ??
      null;

    const { isServingNow, deliveryState } = resolveDeliveryState(
      adStatus,
      adsetStatus,
      campaignStatus,
    );

    const ins = currInsights.get(adId) ?? emptyInsightAcc();
    const prevIns = prevInsights.get(adId) ?? emptyInsightAcc();
    const crm = currCrm.get(adId);
    const prevCrmAcc = prevCrm.get(adId);

    const leadsCrm = crm ? crm.dealIds.size : 0;
    const leadsCrmMeta = crm ? crm.metaDealIds.size : 0;
    const leadsCrmOutros = crm ? crm.outrosDealIds.size : 0;
    const leadsMeta = ins.leads_meta;
    const leads = leadsCrm > 0 ? leadsCrm : leadsMeta;

    // Critério estrito de inclusão do contrato (1a)
    if (
      !isServingNow &&
      ins.spend <= 0 &&
      ins.impressions <= 0 &&
      leads <= 0
    ) {
      continue;
    }

    const valorMeta = crm ? crm.valor_meta : 0;
    const valorOutros = crm ? crm.valor_outros : 0;
    const valorGerado = valorMeta + valorOutros;

    const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0;
    const cpc = ins.clicks > 0 ? ins.spend / ins.clicks : 0;
    const cpm = ins.impressions > 0 ? (ins.spend / ins.impressions) * 1000 : 0;
    const cpl = leads > 0 ? ins.spend / leads : null;
    const cplMeta = leadsMeta > 0 ? ins.spend / leadsMeta : null;
    const roas = ins.spend > 0 ? valorGerado / ins.spend : null;
    const ticketMedio =
      leads > 0 && valorGerado > 0 ? valorGerado / leads : null;

    const prevLeadsCrm = prevCrmAcc ? prevCrmAcc.dealIds.size : 0;
    const prevLeadsMeta = prevIns.leads_meta;
    const prevLeads = prevLeadsCrm > 0 ? prevLeadsCrm : prevLeadsMeta;
    const prevCtr =
      prevIns.impressions > 0
        ? (prevIns.clicks / prevIns.impressions) * 100
        : 0;
    const prevCpl =
      prevIns.spend > 0 && prevLeads > 0 ? prevIns.spend / prevLeads : null;

    const funnelCounts: Record<string, number> = {};
    const funnelRates: Record<string, number> = {};
    if (leadsCrm > 0 && crm) {
      const dealList = [...crm.dealIds];
      for (const stage of stages) {
        let count = 0;
        for (const dId of dealList) {
          if ((bestDealRank.get(dId) ?? 0) >= stage.step_rank) count += 1;
        }
        funnelCounts[stage.step_name] = count;
        funnelRates[stage.step_name] = Math.min(
          100,
          Number(((count / leadsCrm) * 100).toFixed(1)),
        );
      }
    }

    const creativeId = nonEmpty(adRow.creative_id) ?? adId;
    const asset = creativeAssetsResult.map.get(creativeId);

    draftItems.push({
      ad_id: adId,
      ad_name: nonEmpty(adRow.name) ?? adId,
      creative_id: creativeId,
      account_id:
        nonEmpty(adRow.account_id) ??
        nonEmpty(campaignRow?.account_id) ??
        null,
      adset_id: adsetId,
      adset_name: nonEmpty(adsetRow?.name) ?? adsetId ?? "—",
      campaign_id: campaignId,
      campaign_name: nonEmpty(campaignRow?.name) ?? campaignId ?? "—",
      objective: nonEmpty(campaignRow?.objective),
      ad_status: adStatus,
      adset_status: adsetStatus,
      campaign_status: campaignStatus,
      is_serving_now: isServingNow,
      delivery_state: deliveryState,
      performance_tag: "testing", // classificado no passo 7 após benchmarks

      thumbnail_url: asset?.thumbnail_url ?? null,
      image_url: asset?.image_url ?? null,
      title: asset?.title ?? null,
      body: asset?.body ?? null,
      link_url: asset?.link_url ?? null,
      created_time: nonEmpty(adRow.created_time),
      updated_time: nonEmpty(adRow.updated_time),

      spend: Number(ins.spend.toFixed(2)),
      impressions: ins.impressions,
      reach: ins.reach,
      clicks: ins.clicks,
      link_clicks: ins.link_clicks,
      leads_meta: leadsMeta,
      ctr: Number(ctr.toFixed(4)),
      cpc: Number(cpc.toFixed(4)),
      cpm: Number(cpm.toFixed(4)),

      prev_spend: Number(prevIns.spend.toFixed(2)),
      prev_impressions: prevIns.impressions,
      prev_clicks: prevIns.clicks,
      prev_leads: prevLeads,
      prev_leads_crm: prevLeadsCrm,
      prev_leads_meta: prevLeadsMeta,
      prev_cpl: prevCpl != null ? Number(prevCpl.toFixed(2)) : null,
      prev_ctr: Number(prevCtr.toFixed(4)),
      spend_delta_pct: pctDelta(ins.spend, prevIns.spend),
      leads_delta_pct: pctDelta(leads, prevLeads),
      cpl_delta_pct: pctDelta(cpl, prevCpl),
      ctr_delta_pct: pctDelta(ctr, prevCtr),

      leads_crm: leadsCrm,
      leads_crm_meta: leadsCrmMeta,
      leads_crm_outros: leadsCrmOutros,
      leads,
      valor_gerado: Number(valorGerado.toFixed(2)),
      valor_meta: Number(valorMeta.toFixed(2)),
      valor_outros: Number(valorOutros.toFixed(2)),
      ticket_medio:
        ticketMedio != null ? Number(ticketMedio.toFixed(2)) : null,
      cpl: cpl != null ? Number(cpl.toFixed(2)) : null,
      cpl_meta: cplMeta != null ? Number(cplMeta.toFixed(2)) : null,
      roas: roas != null ? Number(roas.toFixed(4)) : null,

      funnel_counts: funnelCounts,
      funnel_rates: funnelRates,
      funnel: funnelCounts,
    });
  }

  // 7) Summary / Benchmarks gerais do conjunto retornado + classificação performance_tag
  let activeNowCount = 0;
  let withSpendCount = 0;
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalReach = 0;
  let totalClicks = 0;
  let totalLinkClicks = 0;
  let totalLeads = 0;
  let totalLeadsCrm = 0;
  let totalLeadsMeta = 0;
  let totalValor = 0;
  let prevTotalSpend = 0;
  let prevTotalImpressions = 0;
  let prevTotalClicks = 0;
  let prevTotalLeads = 0;

  for (const item of draftItems) {
    if (item.is_serving_now) activeNowCount += 1;
    if (item.spend > 0) withSpendCount += 1;
    totalSpend += item.spend;
    totalImpressions += item.impressions;
    totalReach += item.reach;
    totalClicks += item.clicks;
    totalLinkClicks += item.link_clicks;
    totalLeads += item.leads;
    totalLeadsCrm += item.leads_crm;
    totalLeadsMeta += item.leads_meta;
    totalValor += item.valor_gerado;

    prevTotalSpend += item.prev_spend;
    prevTotalImpressions += item.prev_impressions;
    prevTotalClicks += item.prev_clicks;
    prevTotalLeads += item.prev_leads;
  }

  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
  const avgCplMeta = totalLeadsMeta > 0 ? totalSpend / totalLeadsMeta : null;
  const avgCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgCpm =
    totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const avgRoas = totalSpend > 0 ? totalValor / totalSpend : null;

  const prevAvgCpl =
    prevTotalSpend > 0 && prevTotalLeads > 0
      ? prevTotalSpend / prevTotalLeads
      : null;
  const prevAvgCtr =
    prevTotalImpressions > 0
      ? (prevTotalClicks / prevTotalImpressions) * 100
      : 0;

  for (const item of draftItems) {
    item.performance_tag = classifyPerformanceTag({
      isServingNow: item.is_serving_now,
      deliveryState: item.delivery_state,
      spend: item.spend,
      impressions: item.impressions,
      leads: item.leads,
      cpl: item.cpl,
      ctr: item.ctr,
      roas: item.roas,
      valorGerado: item.valor_gerado,
      avgCpl,
      avgCtr,
    });
  }

  draftItems.sort((a, b) => {
    if (b.spend !== a.spend) return b.spend - a.spend;
    if (b.leads !== a.leads) return b.leads - a.leads;
    if (b.valor_gerado !== a.valor_gerado) return b.valor_gerado - a.valor_gerado;
    if (a.is_serving_now !== b.is_serving_now) return a.is_serving_now ? -1 : 1;
    if (b.impressions !== a.impressions) return b.impressions - a.impressions;
    return a.ad_name.localeCompare(b.ad_name, "pt-BR");
  });

  const summary: CreativesSummary = {
    active_now_count: activeNowCount,
    with_spend_count: withSpendCount,
    total_count: draftItems.length,
    total_spend: Number(totalSpend.toFixed(2)),
    total_impressions: totalImpressions,
    total_reach: totalReach,
    total_clicks: totalClicks,
    total_link_clicks: totalLinkClicks,
    total_leads: totalLeads,
    total_leads_crm: totalLeadsCrm,
    total_leads_meta: totalLeadsMeta,
    total_valor: Number(totalValor.toFixed(2)),
    avg_cpl: avgCpl != null ? Number(avgCpl.toFixed(2)) : null,
    avg_cpl_meta: avgCplMeta != null ? Number(avgCplMeta.toFixed(2)) : null,
    avg_ctr: Number(avgCtr.toFixed(4)),
    avg_cpc: Number(avgCpc.toFixed(4)),
    avg_cpm: Number(avgCpm.toFixed(4)),
    avg_roas: avgRoas != null ? Number(avgRoas.toFixed(4)) : null,
    prev_total_spend: Number(prevTotalSpend.toFixed(2)),
    prev_total_leads: prevTotalLeads,
    prev_avg_cpl: prevAvgCpl != null ? Number(prevAvgCpl.toFixed(2)) : null,
    prev_avg_ctr: Number(prevAvgCtr.toFixed(4)),
    spend_delta_pct: pctDelta(totalSpend, prevTotalSpend),
    leads_delta_pct: pctDelta(totalLeads, prevTotalLeads),
    cpl_delta_pct: pctDelta(avgCpl, prevAvgCpl),
    ctr_delta_pct: pctDelta(avgCtr, prevAvgCtr),
  };

  return {
    items: draftItems,
    creatives: draftItems,
    ads: draftItems,
    stages,
    summary,
    benchmarks: summary,
    period: {
      from: win.fromIso,
      to: win.toIso,
      prev_from: win.prevFromIso,
      prev_to: win.prevToIso,
      days: win.days,
    },
    has_creative_assets: creativeAssetsResult.exists,
  };
}

export const getCreativesPerformance = createServerFn({ method: "POST" })
  .validator((d) => CreativesQuerySchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    return computeCreativesPerformance(supabaseAdmin, data);
  });

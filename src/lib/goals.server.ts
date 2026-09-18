import { fetchAll, getClient } from "@/lib/utm.server";

export type GoalRecord = {
  id: string;
  year: number;
  month: number;
  operadora: string;
  meta_leads: number;
  match_terms: string[];
  sort_order: number;
};

export function norm(v: string | null | undefined) {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Início/fim do mês em ISO (fuso America/Sao_Paulo => UTC-3). */
export function monthRange(year: number, month: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${p(month)}-01T00:00:00-03:00`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const to = `${nextY}-${p(nextM)}-01T00:00:00-03:00`;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

export function monthDays(year: number, month: number) {
  return new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 0)).getUTCDate();
}

/** Dias decorridos do mês, considerando o "hoje" em Brasília. */
export function elapsedDays(year: number, month: number) {
  const total = monthDays(year, month);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = today.split("-").map(Number);
  if ((y ?? 0) > year || ((y ?? 0) === year && (m ?? 0) > month)) return total;
  if ((y ?? 0) < year || ((y ?? 0) === year && (m ?? 0) < month)) return 0;
  return Math.min(total, d ?? 1);
}

export async function listGoals(year: number, month: number): Promise<GoalRecord[]> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("lead_goals")
    .select("id,year,month,operadora,meta_leads,match_terms,sort_order")
    .eq("year", year)
    .eq("month", month)
    .order("sort_order", { ascending: true })
    .order("operadora", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GoalRecord[];
}

export type GoalProgressRow = GoalRecord & { google: number; meta: number };

export async function computeProgress(year: number, month: number) {
  const goals = await listGoals(year, month);
  const supabase = await getClient();
  const { from, to } = monthRange(year, month);
  const rows = await fetchAll(supabase, { from, to });

  const buckets = new Map<string, { google: number; meta: number }>();
  for (const g of goals) buckets.set(g.id, { google: 0, meta: 0 });
  let unmatchedGoogle = 0;
  let unmatchedMeta = 0;

  const prepared = goals.map((g) => ({
    id: g.id,
    terms: (g.match_terms ?? []).map(norm).filter(Boolean),
  }));

  for (const r of rows) {
    const canal = r.origem === "Google" ? "google" : r.origem === "Meta" ? "meta" : null;
    if (!canal) continue;
    const hay = norm([r.campaign_name, r.utm_campaign, r.dominio, r.ad_name, r.adset_name, r.titulo].join(" | "));
    const hit = prepared.find((g) => g.terms.some((t) => hay.includes(t)));
    if (!hit) {
      if (canal === "google") unmatchedGoogle++;
      else unmatchedMeta++;
      continue;
    }
    const b = buckets.get(hit.id)!;
    b[canal] += 1;
  }

  const list: GoalProgressRow[] = goals.map((g) => ({
    ...g,
    google: buckets.get(g.id)?.google ?? 0,
    meta: buckets.get(g.id)?.meta ?? 0,
  }));

  return {
    year,
    month,
    monthDays: monthDays(year, month),
    elapsedDays: elapsedDays(year, month),
    unmatched: { google: unmatchedGoogle, meta: unmatchedMeta },
    rows: list,
  };
}

export async function upsertGoals(
  year: number,
  month: number,
  items: Array<{ operadora: string; meta_leads: number; match_terms: string[]; sort_order?: number }>,
) {
  const supabase = await getClient();
  const payload = items.map((it, i) => ({
    year,
    month,
    operadora: it.operadora.trim(),
    meta_leads: Math.max(0, Math.round(it.meta_leads || 0)),
    match_terms: it.match_terms.map((t) => t.trim()).filter(Boolean),
    sort_order: it.sort_order ?? i + 1,
  }));
  const { error } = await (supabase as any)
    .from("lead_goals")
    .upsert(payload, { onConflict: "year,month,operadora" });
  if (error) throw new Error(error.message);
  return { saved: payload.length };
}

export async function deleteGoal(id: string) {
  const supabase = await getClient();
  const { error } = await (supabase as any).from("lead_goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function duplicatePreviousMonth(year: number, month: number) {
  const prevY = month === 1 ? year - 1 : year;
  const prevM = month === 1 ? 12 : month - 1;
  const prev = await listGoals(prevY, prevM);
  if (prev.length === 0) return { copied: 0 };
  await upsertGoals(
    year,
    month,
    prev.map((g) => ({
      operadora: g.operadora,
      meta_leads: g.meta_leads,
      match_terms: g.match_terms ?? [],
      sort_order: g.sort_order,
    })),
  );
  return { copied: prev.length };
}

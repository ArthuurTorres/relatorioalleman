export const currency = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const nfmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");

export const pctfmt = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : `${n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const AWAITING = "Aguardando integração";

/** Deriva a operadora a partir do nome da campanha (ex.: "[TRIVE] [LEAD] HFC Saúde" -> "HFC Saúde"). */
export function operadoraFromCampaign(name?: string | null): string {
  if (!name) return "—";
  let s = name.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  s = s.split(/[|–—\-]/)[0]?.trim() || s;
  s = s.replace(/^(leads?|conversão|conversao|cadastro|remarketing|tráfego|trafego)\s+/i, "").trim();
  return s || "—";
}

export function canalFromOrigem(origem?: string | null): "Meta Ads" | "Google Ads" | "Outros" {
  if (origem === "Meta") return "Meta Ads";
  if (origem === "Google") return "Google Ads";
  return "Outros";
}

type DayRow = { day: string } & Record<string, unknown>;

/** Agrupa séries diárias em semanas (ISO, segunda) ou meses. */
export function bucketSeries<T extends DayRow>(
  rows: T[],
  mode: "day" | "week" | "month",
  numericKeys: string[],
): Array<Record<string, number | string>> {
  if (mode === "day") {
    return rows.map((r) => {
      const out: Record<string, number | string> = { day: r.day, label: labelDay(r.day) };
      for (const k of numericKeys) out[k] = Number((r as any)[k] ?? 0);
      return out;
    });
  }
  const map = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const key = mode === "week" ? weekStart(r.day) : r.day.slice(0, 7);
    const label = mode === "week" ? labelDay(key) : labelMonth(r.day);
    const e = map.get(key) ?? { day: key, label };
    for (const k of numericKeys) e[k] = Number(e[k] ?? 0) + Number((r as any)[k] ?? 0);
    map.set(key, e);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function weekStart(day: string) {
  const d = parseDay(day);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function labelDay(day: string) {
  const [, m, d] = day.split("-");
  return d ? `${d}/${m}` : day;
}

function labelMonth(day: string) {
  const d = parseDay(day);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function variation(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const CHART = {
  cyan: "var(--chart-2)",
  purple: "var(--chart-1)",
  grey: "var(--chart-5)",
  green: "var(--chart-3)",
  amber: "var(--chart-4)",
  red: "var(--destructive)",
};

export const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -6px oklch(0 0 0 / 0.16), 0 2px 6px -1px oklch(0 0 0 / 0.08)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

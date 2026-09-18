import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART, bucketSeries, currency, nfmt } from "@/lib/dashboard-utils";

type Row = { day: string; spend: number; leads: number };

const MODES = [
  { key: "day", label: "Diário" },
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensal" },
] as const;

export function InvestLeadsChart({ rows, loading }: { rows: Row[]; loading?: boolean }) {
  const [mode, setMode] = useState<"day" | "week" | "month">("day");
  const data = useMemo(() => bucketSeries(rows, mode, ["spend", "leads"]), [rows, mode]);

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold">Investimento e leads</h3>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: CHART.cyan }} /> Investimento (R$)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[2px] w-4" style={{ background: CHART.purple }} /> Leads válidos
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-card/40 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={
                mode === m.key
                  ? "rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary"
                  : "rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 min-h-[220px] flex-1">
        {loading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : data.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Sem dados no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
              <XAxis dataKey="label" fontSize={10} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis yAxisId="l" fontSize={10} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} width={54}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
              <YAxis yAxisId="r" orientation="right" fontSize={10} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 0.03)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p: any = payload[0]?.payload ?? {};
                  const cpl = p.leads > 0 ? p.spend / p.leads : null;
                  return (
                    <div className="rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-2xl">
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 text-[oklch(0.78_0.14_230)]">Investimento: {currency(p.spend)}</p>
                      <p className="text-[oklch(0.7_0.19_305)]">Leads: {nfmt(p.leads)}</p>
                      <p className="text-muted-foreground">CPL: {cpl == null ? "—" : currency(cpl)}</p>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="l" dataKey="spend" fill={CHART.cyan} radius={[4, 4, 0, 0]} maxBarSize={46} />
              <Line yAxisId="r" type="monotone" dataKey="leads" stroke={CHART.purple} strokeWidth={2.5} dot={{ r: 2.5, strokeWidth: 0, fill: CHART.purple }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

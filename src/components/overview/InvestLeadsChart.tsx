import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Série Temporal</p>
          <h3 className="mt-0.5 font-display text-base font-semibold tracking-tight text-foreground">
            Investimento e leads
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs" style={{ background: CHART.cyan }} /> Investimento (R$)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[2px] w-4 rounded-full" style={{ background: CHART.purple }} /> Leads válidos
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={
                mode === m.key
                  ? "cursor-pointer rounded-md bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-2xs ring-1 ring-border"
                  : "cursor-pointer rounded-md px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                fontSize={10}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="l"
                fontSize={10}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))}
              />
              <YAxis
                yAxisId="r"
                orientation="right"
                fontSize={10}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p: any = payload[0]?.payload ?? {};
                  const cpl = p.leads > 0 ? p.spend / p.leads : null;
                  return (
                    <div className="space-y-1 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                      <p className="font-semibold">{label}</p>
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <span className="h-2 w-2 rounded-xs" style={{ background: CHART.cyan }} />
                        <span>Investimento:</span>
                        <span className="font-semibold">{currency(p.spend)}</span>
                      </p>
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <span className="h-2 w-2 rounded-full" style={{ background: CHART.purple }} />
                        <span>Leads:</span>
                        <span className="font-semibold">{nfmt(p.leads)}</span>
                      </p>
                      <p className="text-muted-foreground tabular-nums">
                        CPL: <span className="font-medium text-foreground">{cpl == null ? "—" : currency(cpl)}</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="l" dataKey="spend" fill={CHART.cyan} radius={[4, 4, 0, 0]} maxBarSize={42} />
              <Line
                yAxisId="r"
                type="monotone"
                dataKey="leads"
                stroke={CHART.purple}
                strokeWidth={2.5}
                dot={{ r: 2.5, strokeWidth: 0, fill: CHART.purple }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

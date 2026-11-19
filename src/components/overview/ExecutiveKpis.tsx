import { ResponsiveContainer, LineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { AWAITING, CHART } from "@/lib/dashboard-utils";

export type Kpi = {
  key: string;
  label: string;
  value: string | null;
  variation: number | null;
  variationSuffix?: string;
  trend?: Array<{ v: number }>;
  color?: string;
  hint?: string;
};

function VarChip({ v, suffix }: { v: number | null; suffix?: string }) {
  if (v == null)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sem período anterior
      </span>
    );
  const up = v >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
        up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {`${v.toFixed(1)}${suffix ?? "%"}`}
      <span className="font-normal text-muted-foreground">vs anterior</span>
    </span>
  );
}

export function ExecutiveKpis({ kpis, loading }: { kpis: Kpi[]; loading?: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${kpis.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
      {kpis.map((k) => (
        <div
          key={k.key}
          className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-2xs transition hover:border-primary/30"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {k.label}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-7 w-24" />
              ) : k.value == null ? (
                <p className="mt-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-300">{AWAITING}</p>
              ) : (
                <p className="mt-1 truncate font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground tabular-nums">
                  {k.value}
                </p>
              )}
              <div className="mt-1.5">
                {k.value == null ? (
                  <span className="text-[11px] text-muted-foreground">{k.hint ?? "sem fonte de dados"}</span>
                ) : (
                  <VarChip v={k.variation} suffix={k.variationSuffix} />
                )}
              </div>
            </div>
            {k.trend && k.trend.length > 1 && (
              <div className="h-11 w-20 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={k.trend} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={k.color ?? CHART.cyan}
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

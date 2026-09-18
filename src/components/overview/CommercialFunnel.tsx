import { AWAITING } from "@/lib/dashboard-utils";

export type FunnelStage = {
  label: string;
  value: number | null;
  /** % de passagem em relação à etapa anterior */
  pass?: number | null;
};

export function CommercialFunnel({ stages, loading }: { stages: FunnelStage[]; loading?: boolean }) {
  const max = Math.max(1, ...stages.map((s) => s.value ?? 0));
  return (
    <div className="space-y-2.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1]?.value ?? null : null;
        const pct = s.value == null ? 0 : (s.value / max) * 100;
        const pass = s.value != null && prev ? (s.value / prev) * 100 : null;
        const drop = pass == null ? null : 100 - pass;
        return (
          <div key={s.label} className="grid grid-cols-[minmax(88px,0.9fr)_minmax(0,2.4fr)_auto] items-center gap-3">
            <span className="truncate text-[12px] text-muted-foreground">{s.label}</span>
            <div className="h-6 min-w-0 rounded-md bg-white/[0.04]">
              {s.value == null ? (
                <div className="flex h-full items-center px-2 text-[10px] text-amber-300/80">{AWAITING}</div>
              ) : (
                <div
                  className="h-full rounded-md transition-all"
                  style={{
                    width: `${loading ? 0 : Math.max(pct, 2)}%`,
                    background: "linear-gradient(90deg, oklch(0.7 0.19 305 / 0.9), oklch(0.7 0.19 305 / 0.55))",
                  }}
                />
              )}
            </div>
            <div className="flex shrink-0 items-baseline gap-2 text-right">
              <span className="text-[12px] font-medium tabular-nums">
                {s.value == null ? "—" : s.value.toLocaleString("pt-BR")}
              </span>
              {pass != null && (
                <span className="w-[92px] text-[11px] tabular-nums text-[oklch(0.7_0.19_305)]">
                  {pass.toFixed(1)}%
                  <span className="ml-1 text-muted-foreground/60">-{(drop ?? 0).toFixed(1)}%</span>
                </span>
              )}
              {pass == null && i > 0 && <span className="w-[92px]" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

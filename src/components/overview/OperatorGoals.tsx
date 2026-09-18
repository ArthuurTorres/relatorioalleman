import { useState } from "react";
import { AWAITING, currency, nfmt } from "@/lib/dashboard-utils";

export type OperatorRow = {
  operadora: string;
  leads: number;
  spend: number | null;
  contratos: number | null;
  vidas: number | null;
  receita: number | null;
  /** meta definida no sistema comercial — ainda sem fonte */
  goal: number | null;
};

type GoalType = "leads" | "contratos" | "vidas" | "receita";

const TYPES: Array<{ key: GoalType; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "contratos", label: "Contratos" },
  { key: "vidas", label: "Vidas" },
  { key: "receita", label: "Receita" },
];

export function OperatorGoals({ rows }: { rows: OperatorRow[] }) {
  const [type, setType] = useState<GoalType>("leads");

  const value = (r: OperatorRow): number | null =>
    type === "leads" ? r.leads : type === "contratos" ? r.contratos : type === "vidas" ? r.vidas : r.receita;

  const fmt = (v: number | null) => (v == null ? "—" : type === "receita" ? currency(v) : nfmt(v));

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h3 className="min-w-0 truncate font-display text-[15px] font-semibold">Metas por operadora</h3>
        <div className="flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-card/40 p-0.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={
                type === t.key
                  ? "rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary"
                  : "rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem operadoras no período selecionado</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((r) => {
            const achieved = value(r);
            const goal = r.goal;
            const pct = goal && achieved != null ? (achieved / goal) * 100 : null;
            const tone =
              pct == null ? "text-muted-foreground" : pct >= 100 ? "text-emerald-300" : pct >= 70 ? "text-amber-300" : "text-red-300";
            return (
              <div key={r.operadora} className="rounded-xl border border-white/[0.06] bg-card/60 p-4">
                <p className="truncate text-[13px] font-semibold">{r.operadora}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Meta</p>
                    <p className="mt-0.5 truncate text-amber-300/90">{goal == null ? AWAITING : fmt(goal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Alcançado</p>
                    <p className="mt-0.5 tabular-nums text-foreground">
                      {achieved == null ? AWAITING : fmt(achieved)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct ?? 0)}%`,
                      background: "var(--grad-accent)",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={tone}>{pct == null ? "Atingimento indisponível" : `${pct.toFixed(1)}%`}</span>
                  <span className="text-muted-foreground/70">
                    {r.spend == null ? "" : `Investido ${currency(r.spend)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Operadoras derivadas dos nomes das campanhas. Metas, contratos, vidas e receita aguardam integração com o
        sistema comercial.
      </p>
    </div>
  );
}

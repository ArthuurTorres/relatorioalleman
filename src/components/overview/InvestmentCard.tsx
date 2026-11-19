import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getInvestment,
  saveInvestment,
  type InvestmentRecord,
} from "@/lib/investment.functions";
import { getMetaPerformance } from "@/lib/meta.functions";
import { currency } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, Pencil, Wallet, X } from "lucide-react";

function parseBrCurrency(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!cleaned || Number.isNaN(Number(cleaned))) return null;
  return Number(cleaned);
}

function currentMonthKey(): { year: number; month: number } {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m] = todayStr.split("-").map(Number);
  return { year: y ?? 2026, month: m ?? 1 };
}

/** Janela do mês inteiro (1º dia → hoje/fim do mês) em ISO, fuso Brasília. */
function fullMonthRange(year: number, month: number): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const fromIso = `${year}-${p(month)}-01T00:00:00-03:00`;
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const today = new Date(`${todayStr}T12:00:00Z`);
  const lastDay = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 0)).getUTCDate();
  const end = year === today.getUTCFullYear() && month === today.getUTCMonth() + 1
    ? new Date()
    : new Date(`${year}-${p(month)}-${p(lastDay)}T23:59:59-03:00`);
  return { from: new Date(fromIso).toISOString(), to: end.toISOString() };
}

const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function InvestmentCard() {
  const investFn = useServerFn(getInvestment);
  const saveFn = useServerFn(saveInvestment);
  const metaFn = useServerFn(getMetaPerformance);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // O valor lançado é sempre MENSAL e ancorado no MÊS ATUAL (hoje, fuso Brasília) —
  // independe do filtro de período do painel.
  const { year, month } = currentMonthKey();
  const monthRange = useMemo(() => fullMonthRange(year, month), [year, month]);

  const inv = useQuery({
    queryKey: ["investment", year, month],
    queryFn: () => investFn({ data: { year, month } }),
    staleTime: 30_000,
    retry: false,
  });

  // Gasto Meta do MÊS INTEIRO (não do filtro) para o % consumido
  const metaMonth = useQuery({
    queryKey: ["meta-performance", monthRange.from, monthRange.to],
    queryFn: () => metaFn({ data: monthRange }),
    staleTime: 60_000,
    retry: false,
  });
  const monthSpend = metaMonth.data?.summary.spend ?? 0;

  const records: InvestmentRecord[] = inv.data ?? [];
  const geral = records.find((r) => r.channel === "geral") ?? null;
  const budget = geral?.amount ?? 0;
  const spentPct = budget > 0 ? (monthSpend / budget) * 100 : null;
  const remaining = budget > 0 ? budget - monthSpend : null;
  const pctLabel = spentPct == null ? null : new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(spentPct);
  const progressWidth = spentPct == null ? 0 : Math.min(100, Math.max(0, spentPct));
  const progressColor = spentPct == null
    ? "bg-muted-foreground"
    : spentPct >= 100
      ? "bg-red-500"
      : spentPct >= 80
        ? "bg-amber-500"
        : "bg-emerald-500";

  const save = useMutation({
    mutationFn: async (amount: number) =>
      saveFn({ data: { year, month, amount, channel: "geral" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investment", year, month] });
      setEditing(false);
      setError(null);
    },
    onError: () => setError("Não foi possível salvar — tente novamente."),
  });

  useEffect(() => {
    if (editing) {
      setDraft(geral ? geral.amount.toFixed(2).replace(".", ",") : "");
      setError(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    const parsed = parseBrCurrency(draft);
    if (parsed == null) {
      setError("Valor inválido — use números, ex: 1500 ou 1.500,00");
      return;
    }
    save.mutate(parsed);
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-2xs transition hover:border-primary/30">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Investimento lançado · {MONTH_LABELS[month - 1] ?? month}/{year}
          </p>

          {inv.isLoading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : editing ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="0,00"
                aria-label="Valor do investimento no mês em reais"
                className="h-8 w-32 rounded-md border border-primary/50 bg-background px-2 font-display text-[17px] font-semibold text-foreground tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={commit}
                disabled={save.isPending}
                aria-label="Salvar investimento"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait"
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Cancelar edição"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Clique para lançar o investimento do mês"
              className="group mt-1 flex cursor-pointer items-baseline gap-2 rounded-md text-left"
            >
              <span className="truncate font-display text-[22px] font-semibold leading-tight tracking-tight text-foreground tabular-nums group-hover:text-primary">
                {geral ? currency(geral.amount) : "—"}
              </span>
              <Pencil
                className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                aria-hidden="true"
              />
            </button>
          )}

          <div className="mt-1.5">
            {error ? (
              <span className="text-[11px] font-medium text-red-700 dark:text-red-400">{error}</span>
            ) : inv.isError ? (
              <span className="text-[11px] text-amber-700 dark:text-amber-300">
                Tabela ainda não aplicada — rode a migration no Supabase.
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {geral
                  ? "Clique no valor para ajustar"
                  : "Nenhum valor lançado — clique para registrar"}
              </span>
            )}
          </div>

          {/* Consumo do investimento do mês: gasto Meta do mês inteiro vs valor lançado */}
          {geral != null && (
            <div className="mt-3 border-t border-border/70 pt-2.5">
              {metaMonth.isLoading ? (
                <Skeleton className="h-4 w-full rounded-full" />
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="text-muted-foreground">
                      Gasto no mês: <strong className="font-semibold text-foreground">{currency(monthSpend)}</strong>
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        spentPct == null
                          ? "text-muted-foreground"
                          : spentPct >= 100
                            ? "text-red-700 dark:text-red-300"
                            : spentPct >= 80
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      {pctLabel == null ? "—" : `${pctLabel}% do investimento`}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={spentPct == null ? undefined : Math.round(spentPct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Percentual do investimento mensal consumido"
                  >
                    <div
                      className={cn("h-full rounded-full transition-all duration-300", progressColor)}
                      style={{ width: `${Math.max(progressWidth, progressWidth > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                    {remaining == null
                      ? "—"
                      : remaining >= 0
                        ? `Restam ${currency(remaining)} do orçamento de ${MONTH_LABELS[month - 1] ?? month}`
                        : `Excedeu ${currency(Math.abs(remaining))} do orçamento de ${MONTH_LABELS[month - 1] ?? month}`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

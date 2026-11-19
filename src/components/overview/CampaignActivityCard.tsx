import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCampaignActivity,
  type CampaignActivityRow,
} from "@/lib/campaign-activity.functions";
import { currency } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentMonthRange } from "@/lib/report-period";

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  effective_status: "Status efetivo",
  daily_budget: "Orçamento diário",
  lifetime_budget: "Orçamento total",
};

const RANGES: Array<{ key: string; days?: number; label: string }> = [
  { key: "mes", label: "Este mês" },
  { key: "7", days: 7, label: "7 dias" },
  { key: "30", days: 30, label: "30 dias" },
  { key: "90", days: 90, label: "90 dias" },
];

function formatValue(field: string, value: string | null): string {
  if (value == null) return "—";
  if (field === "daily_budget" || field === "lifetime_budget") {
    const n = Number(value);
    if (!Number.isNaN(n)) return currency(n);
  }
  return value;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FIELD_COLORS: Record<string, string> = {
  status: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25",
  effective_status:
    "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25",
  daily_budget:
    "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/25",
  lifetime_budget:
    "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/25",
};

export function CampaignActivityCard({ className }: { className?: string }) {
  const activityFn = useServerFn(getCampaignActivity);
  const [rangeKey, setRangeKey] = useState("mes");

  const range = (() => {
    if (rangeKey === "mes") return currentMonthRange();
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30;
    const to = new Date();
    const from = new Date(Date.now() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  })();

  const activity = useQuery({
    queryKey: ["campaign-activity", rangeKey, range.from, range.to],
    queryFn: () => activityFn({ data: range }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const rows: CampaignActivityRow[] = activity.data ?? [];

  // Agrupa por campanha para exibir blocos legíveis
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; events: CampaignActivityRow[] }>();
    for (const row of rows) {
      const entry = map.get(row.campaign_id) ?? {
        name: row.campaign_name ?? row.campaign_id,
        events: [],
      };
      entry.events.push(row);
      map.set(row.campaign_id, entry);
    }
    return [...map.values()];
  }, [rows]);

  return (
    <section className={cn("bento-card p-5 sm:p-6", className)}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Mídia Paga · Meta
          </p>
          <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-semibold tracking-tight text-foreground">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            Histórico de alterações das campanhas
          </h3>
        </div>
        <div
          role="group"
          aria-label="Período do histórico"
          className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/55 p-1"
        >
          {RANGES.map((r) => (
            <Button
              key={r.key}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "filter-chip h-7 px-2.5 text-xs",
                rangeKey === r.key
                  ? "filter-chip-active"
                  : "hover:bg-card hover:text-foreground",
              )}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {activity.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando histórico…
        </div>
      ) : activity.isError ? (
        <p className="py-8 text-center text-xs text-amber-700 dark:text-amber-300">
          Não foi possível consultar as alterações. Tente novamente em instantes.
        </p>
      ) : grouped.length === 0 ? (
        <p className="rounded-xl border border-border/70 bg-muted/25 px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhuma alteração de status ou orçamento registrada neste período.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.name}>
              <p className="mb-2 truncate text-xs font-semibold text-foreground" title={group.name}>
                {group.name}
              </p>
              <ol className="space-y-2 border-l border-border/70 pl-4">
                {group.events.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="text-muted-foreground tabular-nums">
                        {fmtDateTime(event.occurred_at)}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10.5px] font-medium",
                          FIELD_COLORS[event.field] ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {FIELD_LABELS[event.field] ?? event.field}
                      </span>
                      <span className="text-foreground tabular-nums">
                        {formatValue(event.field, event.old_value)}
                        <span className="mx-1 text-muted-foreground">→</span>
                        <strong className="font-semibold">{formatValue(event.field, event.new_value)}</strong>
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {rows.length >= 200 && (
            <p className="text-[11px] text-muted-foreground">
              Exibindo as 200 alterações mais recentes do período.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

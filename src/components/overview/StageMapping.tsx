import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStageMapping, type StageMapRow } from "@/lib/bitrix-funnel.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { nfmt, pctfmt } from "@/lib/dashboard-utils";

type Props = { filters: { from: string; to: string }; origem?: string[] | null };

/** Ordem do funil comercial e a coluna correspondente em "Desempenho das campanhas". */
const STEPS: { step: string; label: string; column: string; tone: string }[] = [
  { step: "novo", label: "Identificados (lead novo)", column: "No Bitrix", tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/25" },
  { step: "qualificado", label: "Qualificados / MQL", column: "Qualificados", tone: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25" },
  { step: "tentativa", label: "Tentativa de contato", column: "Qualificados (acumulado)", tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-amber-500/25" },
  { step: "contatado", label: "Contatados", column: "Contatados", tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/25" },
  { step: "negociacao", label: "Oportunidades (negociação/cotação)", column: "Negociação", tone: "bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/25" },
  { step: "venda", label: "Vendas", column: "Vendas", tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25" },
  { step: "perdido", label: "Perdidos", column: "Perdidos", tone: "bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25" },
];

export function StageMapping({ filters, origem = null }: Props) {
  const fetchMap = useServerFn(getStageMapping);
  const q = useQuery({
    queryKey: ["stage-mapping", filters.from, filters.to, origem],
    queryFn: () => fetchMap({ data: { from: filters.from, to: filters.to, origem } }),
  });

  const stages = q.data?.stages ?? [];
  const total = q.data?.total ?? 0;

  const grouped = useMemo(() => {
    const map = new Map<string, StageMapRow[]>();
    for (const s of stages) {
      const key = s.funnel_step ?? "__sem__";
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [stages]);

  const unmapped = grouped.get("__sem__") ?? [];
  const orphans = q.data?.orphans ?? [];

  return (
    <Card className="bento-card border-0">
      <CardHeader>
        <CardTitle className="font-display text-base">Etapas do Bitrix × funil comercial</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada etapa real do seu CRM e a coluna que ela alimenta em “Desempenho das campanhas”. Use este mapa para conferir
          onde cada lead está sendo contado.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            {STEPS.map((s) => {
              const rows = (grouped.get(s.step) ?? []).slice().sort((a, b) => b.leads - a.leads);
              const leads = rows.reduce((acc, r) => acc + r.leads, 0);
              return (
                <div key={s.step} className="rounded-xl border border-border bg-muted/20 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${s.tone}`}>{s.step}</span>
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                    </div>
                    <div className="text-right text-xs tabular-nums">
                      <span className="font-semibold text-foreground">{nfmt(leads)}</span>
                      <span className="text-muted-foreground"> leads · {pctfmt(total ? (leads / total) * 100 : 0, 1)}</span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        coluna: {s.column}
                      </span>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">Nenhuma etapa do CRM nesta fase.</p>
                  ) : (
                    <div className="mt-2.5 overflow-x-auto rounded-lg border border-border bg-card">
                      <table className="w-full min-w-[540px] text-[12px]">
                        <thead>
                          <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2.5 py-1.5 text-left font-medium">Etapa no Bitrix</th>
                            <th className="px-2.5 py-1.5 text-left font-medium">Funil</th>
                            <th className="px-2.5 py-1.5 text-left font-medium">ID da etapa</th>
                            <th className="px-2.5 py-1.5 text-right font-medium">Leads</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={`${r.pipeline_id}-${r.stage_id}`} className="zebra-row border-t border-border">
                              <td className="px-2.5 py-1.5 font-medium">{r.stage_name}</td>
                              <td className="px-2.5 py-1.5 text-muted-foreground">{r.pipeline_name}</td>
                              <td className="px-2.5 py-1.5 font-mono text-[10.5px] text-muted-foreground">{r.stage_id}</td>
                              <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{nfmt(r.leads)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {(unmapped.some((u) => u.leads > 0) || orphans.length > 0) && (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3.5">
                <p className="text-sm font-medium text-foreground">Sem etapa do funil definida</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Estas etapas não entram em nenhuma coluna do funil comercial. Se alguma delas deve contar, ajuste o
                  mapeamento correspondente.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {unmapped
                    .filter((u) => u.leads > 0)
                    .map((u) => (
                      <span
                        key={`${u.pipeline_id}-${u.stage_id}`}
                        className="rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                      >
                        {u.stage_name}{" "}
                        <span className="text-muted-foreground tabular-nums">
                          ({u.pipeline_name}) · {nfmt(u.leads)}
                        </span>
                      </span>
                    ))}
                  {orphans.map((o) => (
                    <span
                      key={o.fase ?? "null"}
                      className="rounded-md border border-border bg-card px-2 py-1 text-[11px]"
                    >
                      {o.fase ?? "sem etapa"}{" "}
                      <span className="text-muted-foreground tabular-nums">· {nfmt(o.leads)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

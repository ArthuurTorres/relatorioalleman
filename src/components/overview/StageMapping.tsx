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
  { step: "novo", label: "Identificados (lead novo)", column: "No Bitrix", tone: "bg-sky-500/15 text-sky-300 ring-sky-500/20" },
  { step: "qualificado", label: "Qualificados / MQL", column: "Qualificados", tone: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/20" },
  { step: "tentativa", label: "Tentativa de contato", column: "Qualificados (acumulado)", tone: "bg-amber-500/15 text-amber-300 ring-amber-500/20" },
  { step: "contatado", label: "Contatados", column: "Contatados", tone: "bg-violet-500/15 text-violet-300 ring-violet-500/20" },
  { step: "negociacao", label: "Oportunidades (negociação/cotação)", column: "Negociação", tone: "bg-orange-500/15 text-orange-300 ring-orange-500/20" },
  { step: "venda", label: "Vendas", column: "Vendas", tone: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20" },
  { step: "perdido", label: "Perdidos", column: "Perdidos", tone: "bg-red-500/15 text-red-300 ring-red-500/20" },
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
    <Card className="border-white/[0.06] bg-card/40">
      <CardHeader>
        <CardTitle className="text-base">Etapas do Bitrix × funil comercial</CardTitle>
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
                <div key={s.step} className="rounded-lg border border-white/[0.06] bg-card/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${s.tone}`}>{s.step}</span>
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-semibold">{nfmt(leads)}</span>
                      <span className="text-muted-foreground"> leads · {pctfmt(total ? (leads / total) * 100 : 0, 1)}</span>
                      <span className="block text-[10.5px] text-muted-foreground/80">
                        coluna: {s.column}
                      </span>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">Nenhuma etapa do CRM nesta fase.</p>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[540px] text-[12px]">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-1 text-left font-medium">Etapa no Bitrix</th>
                            <th className="px-2 py-1 text-left font-medium">Funil</th>
                            <th className="px-2 py-1 text-left font-medium">ID da etapa</th>
                            <th className="px-2 py-1 text-right font-medium">Leads</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={`${r.pipeline_id}-${r.stage_id}`} className="border-t border-white/[0.04]">
                              <td className="px-2 py-1.5">{r.stage_name}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{r.pipeline_name}</td>
                              <td className="px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground/80">{r.stage_id}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">{nfmt(r.leads)}</td>
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
              <div className="rounded-lg border border-dashed border-white/[0.12] bg-card/20 p-3">
                <p className="text-sm font-medium">Sem etapa do funil definida</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Estas etapas não entram em nenhuma coluna do funil comercial. Se alguma delas deve contar, me diga em qual
                  fase encaixar.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unmapped
                    .filter((u) => u.leads > 0)
                    .map((u) => (
                      <span key={`${u.pipeline_id}-${u.stage_id}`} className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px]">
                        {u.stage_name} <span className="text-muted-foreground">({u.pipeline_name}) · {nfmt(u.leads)}</span>
                      </span>
                    ))}
                  {orphans.map((o) => (
                    <span key={o.fase ?? "null"} className="rounded-md border border-white/[0.06] px-2 py-1 text-[11px]">
                      {o.fase ?? "sem etapa"} <span className="text-muted-foreground">· {nfmt(o.leads)}</span>
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

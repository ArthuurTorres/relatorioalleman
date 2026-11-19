import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCreativesFunnel } from "@/lib/bitrix-funnel.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currency, nfmt, pctfmt } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

type Props = { filters: { from: string; to: string } };

const STEP_COLOR_MAP: Record<string, string> = {
  novo: "text-sky-700 dark:text-sky-300",
  qualificado: "text-indigo-700 dark:text-indigo-300",
  tentativa: "text-amber-700 dark:text-amber-300",
  contatado: "text-violet-700 dark:text-violet-300",
  negociacao: "text-orange-700 dark:text-orange-300",
  venda: "text-emerald-700 dark:text-emerald-300",
  perdido: "text-red-700 dark:text-red-300",
};

const STEP_LABEL_MAP: Record<string, string> = {
  novo: "Novo",
  qualificado: "Qualif.",
  tentativa: "Tentativa",
  contatado: "Contatado",
  negociacao: "Negociação",
  venda: "Venda",
};

/** Etapas do funil que sempre aparecem como colunas fixas */
const FIXED_COLS = [
  { key: "novo", label: "Novo", color: STEP_COLOR_MAP.novo! },
  { key: "qualificado", label: "Qualif.", color: STEP_COLOR_MAP.qualificado! },
  { key: "tentativa", label: "Tentativa", color: STEP_COLOR_MAP.tentativa! },
  { key: "contatado", label: "Contatado", color: STEP_COLOR_MAP.contatado! },
  { key: "negociacao", label: "Negociação", color: STEP_COLOR_MAP.negociacao! },
  { key: "venda", label: "Venda", color: STEP_COLOR_MAP.venda! },
];

export function CreativesFunnelCard({ filters }: Props) {
  const fetchFn = useServerFn(getCreativesFunnel);
  const [topN, setTopN] = useState(10);

  const query = useQuery({
    queryKey: ["creatives-funnel", filters.from, filters.to],
    queryFn: () => fetchFn({ data: { from: filters.from, to: filters.to } }),
  });

  const data = query.data;

  // Estágios dinâmicos (do RPC / serverFn)
  const dynamicStages = useMemo(() => {
    if (!data?.stages?.length) return FIXED_COLS;
    return data.stages
      .filter((s) => s.step !== "perdido")
      .map((s) => ({
        key: s.step,
        label: STEP_LABEL_MAP[s.step] ?? s.step.replace(/_/g, " "),
        color: STEP_COLOR_MAP[s.step] ?? "text-foreground",
        rank: s.rank,
      }));
  }, [data?.stages]);

  // Colunas que realmente têm dados (pelo menos um ad com valor > 0)
  const colsWithData = useMemo(() => {
    if (!data?.ads?.length) return dynamicStages;
    const hasData = new Set<string>();
    for (const ad of data.ads) {
      if ((ad.spend ?? 0) > 0 || ad.leads > 0) {
        for (const key of dynamicStages) {
          const fr = ad.funnel_rates?.[key.key];
          if (fr && typeof fr === "object" && (fr as { total?: number }).total! > 0) {
            hasData.add(key.key);
          }
        }
      }
    }
    return dynamicStages.filter(
      (c) =>
        hasData.has(c.key) || ["novo", "qualificado", "venda"].includes(c.key),
    );
  }, [data, dynamicStages]);

  // Top N por valor / investimento / leads
  const topAds = useMemo(() => {
    const ads = data?.ads ?? [];
    return [...ads]
      .filter((a) => (a.spend ?? 0) > 0 || a.leads > 0)
      .sort(
        (a, b) =>
          (b.valor_gerado ?? 0) - (a.valor_gerado ?? 0) ||
          b.leads - a.leads ||
          (b.spend ?? 0) - (a.spend ?? 0),
      )
      .slice(0, topN);
  }, [data?.ads, topN]);

  // Totais da tabela
  const totals = useMemo(() => {
    const tLeads = topAds.reduce((s, a) => s + a.leads, 0);
    const tValor = topAds.reduce((s, a) => s + (a.valor_gerado ?? 0), 0);
    const tSpend = topAds.reduce((s, a) => s + (a.spend ?? 0), 0);
    return { tLeads, tValor, tSpend };
  }, [topAds]);

  return (
    <Card className="bento-card border-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Atribuição por Criativo
          </p>
          <CardTitle className="mt-0.5 font-display text-base">
            Criativos &amp; Funil
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Desempenho de cada criativo com % de aproveitamento cumulativo por etapa do funil Bitrix
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground tabular-nums">
            {topAds.length} criativos
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1">
            {[5, 10, 20].map((n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  "filter-chip h-7 px-2.5 text-xs",
                  topN === n
                    ? "filter-chip-active"
                    : "hover:bg-card hover:text-foreground",
                )}
                onClick={() => setTopN(n)}
              >
                Top {n}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : !topAds.length ? (
          <div className="rounded-xl border border-border bg-muted/25 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum criativo com dados no período. Verifique se o sync de anúncios está ativo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table className="min-w-[860px] text-xs">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="sticky left-0 z-10 min-w-[220px] border-r border-border/70 bg-card">
                    Criativo
                  </TableHead>
                  <TableHead className="min-w-[80px] text-right">Invest.</TableHead>
                  <TableHead className="min-w-[68px] text-right">Imp.</TableHead>
                  <TableHead className="min-w-[56px] text-right">CTR</TableHead>
                  <TableHead className="min-w-[60px] text-right">Leads</TableHead>
                  <TableHead className="min-w-[72px] text-right">CPL</TableHead>
                  <TableHead className="min-w-[80px] text-right">Valor</TableHead>
                  <TableHead className="min-w-[56px] text-right">ROAS</TableHead>
                  {colsWithData.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn("min-w-[64px] text-right font-semibold", col.color)}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody className="tabular-nums">
                {topAds.map((ad) => (
                  <TableRow
                    key={ad.ad_id}
                    className="zebra-row border-b border-border/70"
                  >
                    {/* Nome do criativo */}
                    <TableCell className="sticky left-0 z-10 min-w-[220px] border-r border-border/70 bg-card">
                      <div className="flex flex-col">
                        <span
                          className="max-w-[210px] truncate text-xs font-semibold text-foreground"
                          title={ad.ad_name ?? ad.ad_id}
                        >
                          {ad.ad_name ?? ad.ad_id}
                        </span>
                        {ad.adset_id && (
                          <span className="truncate font-mono text-[10px] text-muted-foreground">
                            ID conjunto: {ad.adset_id}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Métricas fixas */}
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {currency(ad.spend ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {nfmt(ad.impressions ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {ad.ctr != null ? pctfmt(ad.ctr, 1) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {nfmt(ad.leads)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {ad.cpl != null && ad.cpl > 0 ? currency(ad.cpl) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-semibold",
                        (ad.valor_gerado ?? 0) > 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-muted-foreground",
                      )}
                    >
                      {currency(ad.valor_gerado ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ad.roas != null && ad.roas > 0 ? (
                        <span
                          className={
                            ad.roas >= 1
                              ? "font-semibold text-emerald-700 dark:text-emerald-300"
                              : ad.roas >= 0.5
                                ? "font-semibold text-amber-700 dark:text-amber-300"
                                : "font-semibold text-red-700 dark:text-red-300"
                          }
                        >
                          {ad.roas.toFixed(1)}×
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Funil: % cumulativo (sem %% duplicado!) */}
                    {colsWithData.map((col) => {
                      const fr = ad.funnel_rates?.[col.key];
                      const total =
                        fr && typeof fr === "object"
                          ? ((fr as { total?: number }).total ?? 0)
                          : 0;
                      const pct =
                        fr && typeof fr === "object"
                          ? ((fr as { pct?: number | null }).pct ?? null)
                          : null;

                      return (
                        <TableCell key={col.key} className="text-right">
                          {pct != null ? (
                            <div className="flex flex-col items-end">
                              <span className={cn("text-xs font-semibold", col.color)}>
                                {pctfmt(pct, 1)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {total > 0
                                  ? `${nfmt(total)} deal${total === 1 ? "" : "s"}`
                                  : "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}

                {/* Linha de totais */}
                {topAds.length > 1 && (
                  <TableRow className="border-t border-border bg-muted/45 font-semibold hover:bg-muted/45">
                    <TableCell className="sticky left-0 z-10 border-r border-border/70 bg-card font-semibold text-foreground">
                      Total ({topAds.length} criativos)
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-foreground">
                      {currency(totals.tSpend)}
                    </TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-semibold text-foreground">
                      {nfmt(totals.tLeads)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {totals.tLeads > 0
                        ? currency(totals.tSpend / totals.tLeads)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                      {currency(totals.tValor)}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {totals.tSpend > 0 && totals.tValor > 0
                        ? `${(totals.tValor / totals.tSpend).toFixed(1)}×`
                        : "—"}
                    </TableCell>
                    <TableCell colSpan={colsWithData.length} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {topAds.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            % por etapa = quantos dos leads atribuídos a cada criativo chegaram naquela etapa ou além (cumulativo pelo histórico do CRM).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

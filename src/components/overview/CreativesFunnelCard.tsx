import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCreativesFunnel, type CreativesFunnelData } from "@/lib/bitrix-funnel.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nfmt, pctfmt, currency } from "@/lib/dashboard-utils";
import { ArrowUpDown, ChevronDown, ChevronRight, Download, ExternalLink } from "lucide-react";

type Props = { filters: { from: string; to: string } };

/** Etapas do funil que sempre aparecem como colunas fixas */
const FIXED_COLS = [
  { key: "novo",         label: "Novo",        color: "text-sky-300" },
  { key: "qualificado",  label: "Qualif.",     color: "text-indigo-300" },
  { key: "tentativa",    label: "Tentativa",   color: "text-amber-300" },
  { key: "contatado",   label: "Contatado",   color: "text-violet-300" },
  { key: "negociacao",   label: "Negociação",  color: "text-orange-300" },
  { key: "venda",        label: "Venda",       color: "text-emerald-300" },
];

export function CreativesFunnelCard({ filters }: Props) {
  const fetchFn = useServerFn(getCreativesFunnel);
  const [topN, setTopN] = useState(10);

  const query = useQuery({
    queryKey: ["creatives-funnel", filters.from, filters.to],
    queryFn: () => fetchFn({ data: { from: filters.from, to: filters.to } }),
  });

  const data = query.data;

  // Estágios dinâmicos (do RPC)
  const dynamicStages = useMemo(() => {
    if (!data?.stages?.length) return FIXED_COLS;
    return data.stages.map((s) => ({
      key: s.step,
      label: s.step.replace(/_/g, " "),
      color: "text-white/80",
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
          if (fr && typeof fr === "object" && (fr as any).total > 0) {
            hasData.add(key.key);
          }
        }
      }
    }
    return dynamicStages.filter((c) => hasData.has(c.key) || ["novo", "qualificado", "venda"].includes(c.key));
  }, [data, dynamicStages]);

  // Top N por valor
  const topAds = useMemo(() => {
    const ads = data?.ads ?? [];
    return [...ads]
      .filter((a) => (a.spend ?? 0) > 0 || a.leads > 0)
      .sort((a, b) => (b.valor_gerado ?? 0) - (a.valor_gerado ?? 0))
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
    <Card className="border-white/[0.06] bg-card/40">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Criativos &amp; Funil</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Desempenho de cada criativo com % de aproveitamento por etapa do funil Bitrix
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{topAds.length} criativos</span>
          <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-card/50 p-1">
            {[5, 10, 20].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={topN === n ? "secondary" : "ghost"}
                className="h-7 px-2 text-xs"
                onClick={() => setTopN(n)}
              >
                Top {n}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !topAds.length ? (
          <div className="rounded-lg border border-white/[0.06] py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum criativo com dados no período. Verifique se o sync de anúncios está ativo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.04]">
                  {/* Colunas fixas */}
                  <TableHead className="sticky left-0 z-10 min-w-[220px] bg-card">
                  </TableHead>
                  <TableHead className="text-right min-w-[72px]">Invest.</TableHead>
                  <TableHead className="text-right min-w-[60px]">Imp.</TableHead>
                  <TableHead className="text-right min-w-[48px]">CTR</TableHead>
                  <TableHead className="text-right min-w-[60px]">Leads</TableHead>
                  <TableHead className="text-right min-w-[64px]">CPL</TableHead>
                  <TableHead className="text-right min-w-[72px]">Valor</TableHead>
                  <TableHead className="text-right min-w-[48px]">ROAS</TableHead>
                  {/* Colunas do funil */}
                  {colsWithData.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`text-right min-w-[54px] ${col.color}`}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAds.map((ad) => (
                  <TableRow
                    key={ad.ad_id}
                    className="border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    {/* Nome do criativo */}
                    <TableCell className="sticky left-0 z-10 min-w-[220px] bg-card/80">
                      <div className="flex flex-col">
                        <span className="truncate text-sm font-medium">
                          {ad.ad_name ?? ad.ad_id}
                        </span>
                        {ad.adset_id && (
                          <span className="text-[10px] text-muted-foreground">
                            {ad.adset_id}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Métricas fixas */}
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {currency(ad.spend ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {nfmt(ad.impressions ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {ad.ctr != null ? `${pctfmt(ad.ctr, 1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {nfmt(ad.leads)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {ad.cpl != null ? currency(ad.cpl) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-300">
                      {currency(ad.valor_gerado ?? 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ad.roas != null ? (
                        <span className={ad.roas >= 1 ? "text-emerald-300" : ad.roas >= 0.5 ? "text-amber-300" : "text-red-400"}>
                          {ad.roas.toFixed(1)}×
                        </span>
                      ) : "—"}
                    </TableCell>

                    {/* Funil: % cumulativo */}
                    {colsWithData.map((col) => {
                      const fr = ad.funnel_rates?.[col.key];
                      const total = fr && typeof fr === "object" ? (fr as any).total : 0;
                      const pct = fr && typeof fr === "object" ? (fr as any).pct : null;
                      return (
                        <TableCell
                          key={col.key}
                          className="text-right tabular-nums"
                        >
                          {pct != null ? (
                            <div className="flex flex-col items-end">
                              <span className={`text-xs font-medium ${col.color}`}>
                                {pctfmt(pct, 1)}%
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {total > 0 ? `${nfmt(total)} deals` : "—"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}

                {/* Linha de totais */}
                {topAds.length > 1 && (
                  <TableRow className="border-white/[0.04] bg-white/[0.03]">
                    <TableCell className="sticky left-0 z-10 bg-card font-semibold">
                      Total ({topAds.length} criativos)
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {currency(totals.tSpend)}
                    </TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-semibold tabular-nums">
                      {nfmt(totals.tLeads)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {totals.tLeads > 0 ? currency(totals.tSpend / totals.tLeads) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-300">
                      {currency(totals.tValor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {totals.tSpend > 0 ? (
                        <span className="font-semibold">
                          {totals.tValor > 0 ? `${(totals.tValor / totals.tSpend).toFixed(1)}×` : "—"}
                        </span>
                      ) : "—"}
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
            % por etapa = quantos dos leads deste criativo chegaram naquela etapa ou além (cumulativo pelo
            histórico do CRM). Etapas sem mapeamento no Bitrix aparecem como "sem_mapeamento".
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CreativeFunnelStage,
  CreativeItem,
  CreativesSummary,
} from "@/lib/creatives.functions";
import {
  CHART,
  currency,
  nfmt,
  operadoraFromCampaign,
  pctfmt,
  tooltipStyle,
} from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CplVsBenchmarkChip,
  DeliveryBadge,
  DeltaBadge,
  PerformanceTagBadge,
  STAGE_BAR_FILL,
  inferCreativeFormat,
} from "./CreativeCard";
import {
  AlertTriangle,
  ArrowUp,
  Award,
  BarChart3,
  Building2,
  Crown,
  GitCompareArrows,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

const SERIES_COLORS = [CHART.purple, CHART.cyan, CHART.green, CHART.amber] as const;

type ChartMetricKey = "cpl" | "leads" | "spend" | "ctr" | "roas";

const CHART_METRICS: Array<{
  key: ChartMetricKey;
  label: string;
  format: (v: number) => string;
}> = [
  { key: "cpl", label: "CPL (R$)", format: (v) => currency(v) },
  { key: "leads", label: "Leads", format: (v) => nfmt(v) },
  { key: "spend", label: "Investimento (R$)", format: (v) => currency(v) },
  { key: "ctr", label: "CTR (%)", format: (v) => pctfmt(v, 2) },
  { key: "roas", label: "ROAS", format: (v) => `${v.toFixed(2)}×` },
];

function shortCreativeName(name: string, max = 24): string {
  const clean = name.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export type CreativesSelectionDockProps = {
  selectedItems: CreativeItem[];
  onRemove: (adId: string) => void;
  onClear: () => void;
  onViewComparison: () => void;
};

export function CreativesSelectionDock({
  selectedItems,
  onRemove,
  onClear,
  onViewComparison,
}: CreativesSelectionDockProps) {
  if (selectedItems.length === 0) return null;

  const canCompare = selectedItems.length >= 2;

  return (
    <div
      role="region"
      aria-label="Seleção de criativos para comparação"
      className="sticky bottom-3 z-30 mt-4 rounded-2xl border border-primary/35 bg-card/95 p-3 shadow-lg backdrop-blur-md sm:px-4 sm:py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/12 px-2.5 py-1 font-mono text-xs font-semibold text-primary tabular-nums">
            <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {selectedItems.length}/4
          </span>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {selectedItems.map((item, idx) => (
              <span
                key={item.ad_id}
                className="inline-flex max-w-[210px] items-center gap-1.5 rounded-lg border border-border bg-muted/55 py-1 pl-2.5 pr-1.5 text-xs font-medium text-foreground"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                  aria-hidden="true"
                />
                <span className="truncate" title={item.ad_name}>
                  {shortCreativeName(item.ad_name, 22)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(item.ad_id)}
                  aria-label={`Remover ${item.ad_name} da comparação`}
                  className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>

          {!canCompare && (
            <span className="text-xs text-muted-foreground">
              Selecione mais <strong className="font-semibold text-foreground">1 criativo</strong>{" "}
              para habilitar o comparativo lado a lado.
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 cursor-pointer gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!canCompare}
            onClick={onViewComparison}
            className="h-9 cursor-pointer gap-1.5 text-xs font-semibold"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
            Ver comparativo ({selectedItems.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

export type CreativesComparatorProps = {
  items: CreativeItem[];
  stages: CreativeFunnelStage[];
  summary: CreativesSummary;
  onRemove: (adId: string) => void;
  onClear: () => void;
  ref?: React.Ref<HTMLElement>;
};

export function CreativesComparator({
  items,
  stages,
  summary,
  onRemove,
  onClear,
  ref,
}: CreativesComparatorProps) {
  const [metric, setMetric] = useState<ChartMetricKey>("cpl");

  const winners = useMemo(() => {
    const withValidCpl = items.filter(
      (i) => i.leads > 0 && i.cpl != null && i.cpl > 0,
    );
    const bestCplItem =
      withValidCpl.length > 0
        ? withValidCpl.reduce((best, curr) =>
            (curr.cpl ?? Infinity) < (best.cpl ?? Infinity) ? curr : best,
          )
        : null;

    const worstCplItem =
      withValidCpl.length > 1
        ? withValidCpl.reduce((worst, curr) =>
            (curr.cpl ?? 0) > (worst.cpl ?? 0) ? curr : worst,
          )
        : null;

    const bestLeadsItem =
      items.some((i) => i.leads > 0)
        ? items.reduce((best, curr) => (curr.leads > best.leads ? curr : best))
        : null;

    const bestValorItem =
      items.some((i) => i.valor_gerado > 0)
        ? items.reduce((best, curr) =>
            curr.valor_gerado > best.valor_gerado ? curr : best,
          )
        : null;

    const withValidRoas = items.filter((i) => i.roas != null && i.roas > 0);
    const bestRoasItem =
      withValidRoas.length > 0
        ? withValidRoas.reduce((best, curr) =>
            (curr.roas ?? 0) > (best.roas ?? 0) ? curr : best,
          )
        : null;

    const bestCtrItem =
      items.some((i) => i.impressions > 0 && i.ctr > 0)
        ? items.reduce((best, curr) => (curr.ctr > best.ctr ? curr : best))
        : null;

    // Identify funnel or media bottlenecks among compared items
    const bottlenecks: string[] = [];

    const zeroLeadSpenders = items.filter((i) => i.spend > 0 && i.leads === 0);
    if (zeroLeadSpenders.length > 0) {
      bottlenecks.push(
        `${zeroLeadSpenders.map((z) => shortCreativeName(z.ad_name, 26)).join(", ")} consumiu ${currency(
          zeroLeadSpenders.reduce((acc, z) => acc + z.spend, 0),
        )} sem gerar leads no período.`,
      );
    }

    const lowCtrItems = items.filter(
      (i) =>
        i.impressions >= 300 &&
        summary.avg_ctr > 0 &&
        i.ctr < summary.avg_ctr * 0.75,
    );
    if (lowCtrItems.length > 0) {
      bottlenecks.push(
        `CTR abaixo do patamar da conta (${pctfmt(summary.avg_ctr, 2)}) em ${lowCtrItems
          .map((l) => `${shortCreativeName(l.ad_name, 22)} (${pctfmt(l.ctr, 2)})`)
          .join(", ")} — indício de fadiga de gancho visual.`,
      );
    }

    const crmStalled = items.filter((i) => {
      if (i.leads_crm < 3) return false;
      const contacted =
        (i.funnel_counts?.contatado ?? 0) +
        (i.funnel_counts?.negociacao ?? 0) +
        (i.funnel_counts?.venda ?? 0);
      return contacted === 0;
    });
    if (crmStalled.length > 0) {
      bottlenecks.push(
        `Gargalo de progressão comercial no Bitrix: ${crmStalled
          .map((c) => `${shortCreativeName(c.ad_name, 22)} (${nfmt(c.leads_crm)} leads CRM)`)
          .join(", ")} ainda sem avanço para Contatado/Negociação.`,
      );
    }

    if (
      bottlenecks.length === 0 &&
      bestCplItem &&
      worstCplItem &&
      bestCplItem.ad_id !== worstCplItem.ad_id &&
      bestCplItem.cpl &&
      worstCplItem.cpl
    ) {
      const gapPct = ((worstCplItem.cpl - bestCplItem.cpl) / bestCplItem.cpl) * 100;
      if (gapPct >= 20) {
        bottlenecks.push(
          `Dispersão de custo: ${shortCreativeName(worstCplItem.ad_name, 24)} opera com CPL ${Math.round(
            gapPct,
          )}% mais caro que ${shortCreativeName(bestCplItem.ad_name, 24)}.`,
        );
      }
    }

    return {
      bestCplId: bestCplItem?.ad_id ?? null,
      bestCplItem,
      worstCplItem,
      bestLeadsId: bestLeadsItem?.ad_id ?? null,
      bestLeadsItem,
      bestValorItem,
      bestRoasId: bestRoasItem?.ad_id ?? null,
      bestRoasItem,
      bestCtrId: bestCtrItem?.ad_id ?? null,
      bottlenecks,
    };
  }, [items, summary.avg_ctr]);

  const activeMetricMeta =
    CHART_METRICS.find((m) => m.key === metric) ?? CHART_METRICS[0]!;

  const chartData = useMemo(() => {
    return items.map((item, idx) => {
      const rawValue =
        metric === "cpl"
          ? (item.cpl ?? 0)
          : metric === "leads"
            ? item.leads
            : metric === "spend"
              ? item.spend
              : metric === "ctr"
                ? item.ctr
                : (item.roas ?? 0);

      return {
        ad_id: item.ad_id,
        fullName: item.ad_name,
        shortLabel: `#${idx + 1} ${shortCreativeName(item.ad_name, 18)}`,
        value: Number(rawValue.toFixed(2)),
        color: SERIES_COLORS[idx % SERIES_COLORS.length]!,
        campaign: item.campaign_name,
      };
    });
  }, [items, metric]);

  const commercialStages = useMemo(
    () => stages.filter((s) => s.step_name !== "perdido"),
    [stages],
  );

  if (items.length < 2) return null;

  return (
    <section
      ref={ref}
      aria-label="Comparador executivo lado a lado de criativos"
      className="bento-card bento-card-glow scroll-mt-6 space-y-6 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
            <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" />
            Comparador Executivo Lado a Lado
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Análise comparativa · {items.length} criativos selecionados
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Comparação direta de eficiência de mídia (Meta Ads), custo relativo à conta e conversão na coorte comercial (Bitrix CRM).
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          className="h-9 shrink-0 cursor-pointer gap-1.5 border-border bg-card text-xs hover:bg-muted/60"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          Fechar / Limpar seleção
        </Button>
      </div>

      {/* a) Automatic Executive Diagnosis */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {/* Efficiency Winner */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Trophy className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              Vencedor em Eficiência (CPL)
            </p>
          </div>
          {winners.bestCplItem ? (
            <div className="mt-2.5 space-y-1">
              <p
                className="truncate font-display text-sm font-semibold text-foreground"
                title={winners.bestCplItem.ad_name}
              >
                {winners.bestCplItem.ad_name}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                CPL de{" "}
                <strong className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {currency(winners.bestCplItem.cpl)}
                </strong>{" "}
                com {nfmt(winners.bestCplItem.leads)} lead
                {winners.bestCplItem.leads === 1 ? "" : "s"} (investimento de{" "}
                {currency(winners.bestCplItem.spend)}).
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-xs text-muted-foreground">
              Nenhum dos criativos selecionados registrou CPL calculável (leads &gt; 0 com gasto) no período.
            </p>
          )}
        </div>

        {/* Volume & Revenue Leader */}
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
              Líder em Volume &amp; Receita
            </p>
          </div>
          {winners.bestLeadsItem ? (
            <div className="mt-2.5 space-y-1">
              <p
                className="truncate font-display text-sm font-semibold text-foreground"
                title={winners.bestLeadsItem.ad_name}
              >
                {winners.bestLeadsItem.ad_name}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Tracionou{" "}
                <strong className="font-semibold text-foreground">
                  {nfmt(winners.bestLeadsItem.leads)} leads
                </strong>{" "}
                (CRM {nfmt(winners.bestLeadsItem.leads_crm)} · Meta{" "}
                {nfmt(winners.bestLeadsItem.leads_meta)})
                {winners.bestValorItem && winners.bestValorItem.valor_gerado > 0 ? (
                  <>
                    {" "}
                    · Maior receita:{" "}
                    <strong className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {currency(winners.bestValorItem.valor_gerado)}
                    </strong>
                  </>
                ) : (
                  "."
                )}
              </p>
            </div>
          ) : (
            <p className="mt-2.5 text-xs text-muted-foreground">
              Sem volume de leads registrado entre os criativos selecionados neste recorte temporal.
            </p>
          )}
        </div>

        {/* Bottlenecks / Executive Attention */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {winners.bottlenecks.length > 0 ? (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
              Diagnóstico de Gargalos
            </p>
          </div>
          {winners.bottlenecks.length > 0 ? (
            <ul className="mt-2.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
              {winners.bottlenecks.slice(0, 2).map((b, i) => (
                <li key={i} className="line-clamp-2">
                  • {b}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
              Entrega equilibrada entre os selecionados — sem anomalias severas de CTR ou retenção inicial no funil.
            </p>
          )}
        </div>
      </div>

      {/* b) Recharts Comparative BarChart with Metric Switcher */}
      <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <h4 className="font-display text-sm font-semibold text-foreground">
                Gráfico Comparativo · {activeMetricMeta.label}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Alterne o indicador para inspecionar a diferença visual entre os {items.length} criativos
              </p>
            </div>
          </div>

          <div
            role="group"
            aria-label="Selecionar métrica do gráfico comparativo"
            className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
          >
            {CHART_METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={
                  metric === m.key
                    ? "filter-chip filter-chip-active h-7 px-2.5 text-xs"
                    : "filter-chip h-7 px-2.5 text-xs hover:bg-muted/70 hover:text-foreground"
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="shortLabel"
                fontSize={11}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="var(--muted-foreground)"
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v) =>
                  metric === "cpl" || metric === "spend"
                    ? `R$${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                    : metric === "ctr"
                      ? `${Number(v).toFixed(1)}%`
                      : metric === "roas"
                        ? `${Number(v).toFixed(1)}×`
                        : nfmt(Number(v))
                }
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                contentStyle={tooltipStyle}
                formatter={(value: unknown) => [
                  activeMetricMeta.format(Number(value ?? 0)),
                  activeMetricMeta.label,
                ]}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as
                    | { fullName?: string; campaign?: string }
                    | undefined;
                  return row?.fullName
                    ? `${row.fullName} (${row.campaign ?? "—"})`
                    : String(_label);
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={68}>
                {chartData.map((entry) => (
                  <Cell key={entry.ad_id} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* c) Side-by-Side Matrix Table (2 to 4 responsive columns) */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[680px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 w-[190px] min-w-[175px] border-r border-border bg-muted/90 px-4 py-3.5 text-left text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-xs">
                Indicador / Dimensão
              </th>
              {items.map((item, idx) => {
                const fmt = inferCreativeFormat(item);
                const FmtIcon = fmt.Icon;
                const operadora = operadoraFromCampaign(item.campaign_name);
                return (
                  <th
                    key={item.ad_id}
                    className="min-w-[205px] px-4 py-3.5 text-left align-top"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[10.5px] font-bold text-white tabular-nums"
                          style={{
                            backgroundColor:
                              SERIES_COLORS[idx % SERIES_COLORS.length],
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            fmt.badgeClass,
                          )}
                        >
                          <FmtIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {fmt.label}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemove(item.ad_id)}
                        aria-label={`Remover ${item.ad_name} do comparativo`}
                        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <p
                      className="mt-2 line-clamp-2 font-display text-[13.5px] font-semibold leading-snug text-foreground"
                      title={item.ad_name}
                    >
                      {item.ad_name}
                    </p>

                    {operadora !== "—" && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                        <Building2 className="h-3 w-3 text-primary" aria-hidden="true" />
                        {operadora}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border/70 tabular-nums">
            {/* 1. Status atual */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Status &amp; Classificação
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DeliveryBadge item={item} compact />
                    <PerformanceTagBadge tag={item.performance_tag} compact />
                  </div>
                </td>
              ))}
            </tr>

            {/* 2. Campanha / Conjunto */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Campanha / Conjunto
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  <p
                    className="line-clamp-1 font-medium text-foreground"
                    title={item.campaign_name}
                  >
                    {item.campaign_name}
                  </p>
                  <p
                    className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground"
                    title={item.adset_name}
                  >
                    {item.adset_name}
                  </p>
                </td>
              ))}
            </tr>

            {/* 3. Investimento (+ delta anterior) */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Investimento
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {currency(item.spend)}
                    </span>
                    <DeltaBadge pct={item.spend_delta_pct} showLabel />
                  </div>
                </td>
              ))}
            </tr>

            {/* 4. Impressões & Alcance */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Impressões &amp; Alcance
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  <span className="font-semibold text-foreground">
                    {nfmt(item.impressions)}
                  </span>{" "}
                  <span className="text-[11px] text-muted-foreground">
                    imp. · {nfmt(item.reach)} alcance
                  </span>
                </td>
              ))}
            </tr>

            {/* 5. Cliques & CTR */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Cliques &amp; CTR
              </td>
              {items.map((item) => {
                const isBestCtr =
                  winners.bestCtrId === item.ad_id && item.ctr > 0;
                return (
                  <td key={item.ad_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">
                        {pctfmt(item.ctr, 2)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({nfmt(item.clicks)} cliques)
                      </span>
                      {isBestCtr && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/12 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-sky-500/25">
                          Maior CTR
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* 6. CPC & CPM */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                CPC &amp; CPM
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3 text-foreground">
                  <span>{item.clicks > 0 ? currency(item.cpc) : "—"}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    CPM {item.impressions > 0 ? currency(item.cpm) : "—"}
                  </span>
                </td>
              ))}
            </tr>

            {/* 7. Leads (CRM Bitrix / Meta Ads) */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Leads (CRM / Meta)
              </td>
              {items.map((item) => {
                const isBestLeads =
                  winners.bestLeadsId === item.ad_id && item.leads > 0;
                return (
                  <td key={item.ad_id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-sm font-bold text-foreground">
                        {nfmt(item.leads)}
                      </span>
                      <DeltaBadge pct={item.leads_delta_pct} />
                      {isBestLeads && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/25">
                          Líder volume
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      CRM Bitrix: <strong className="text-foreground">{nfmt(item.leads_crm)}</strong> · Meta Ads:{" "}
                      {nfmt(item.leads_meta)}
                    </p>
                  </td>
                );
              })}
            </tr>

            {/* 8. CPL (winner highlighted!) */}
            <tr className="bg-primary/[0.03]">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3.5 font-semibold text-foreground">
                CPL (Custo por Lead)
              </td>
              {items.map((item) => {
                const isWinner =
                  winners.bestCplId === item.ad_id &&
                  item.cpl != null &&
                  item.cpl > 0;
                return (
                  <td
                    key={item.ad_id}
                    className={cn(
                      "px-4 py-3.5",
                      isWinner && "bg-emerald-500/[0.08]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-display text-base font-bold",
                          isWinner
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-foreground",
                        )}
                      >
                        {item.cpl != null && item.cpl > 0
                          ? currency(item.cpl)
                          : "—"}
                      </span>
                      {isWinner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-emerald-500/30">
                          <Trophy className="h-3 w-3 shrink-0" aria-hidden="true" />
                          Melhor CPL
                        </span>
                      )}
                    </div>
                    {item.cpl_delta_pct != null && (
                      <div className="mt-0.5">
                        <DeltaBadge
                          pct={item.cpl_delta_pct}
                          invertGood
                          showLabel
                        />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 9. Diferença vs Média da Conta */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Dif. vs Média da Conta
                {summary.avg_cpl != null && (
                  <span className="block text-[10px] font-normal text-muted-foreground">
                    Média: {currency(summary.avg_cpl)}
                  </span>
                )}
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  {item.cpl != null && item.cpl > 0 && summary.avg_cpl ? (
                    <CplVsBenchmarkChip
                      cpl={item.cpl}
                      avgCpl={summary.avg_cpl}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* 10. Etapas do Funil Comercial Bitrix */}
            {commercialStages.map((stage) => {
              const maxStageRate = Math.max(
                0,
                ...items.map((i) => i.funnel_rates?.[stage.step_name] ?? 0),
              );
              const barFill = STAGE_BAR_FILL[stage.step_name] ?? "bg-primary";

              return (
                <tr key={stage.step_name} className="zebra-row">
                  <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-2.5 font-medium text-muted-foreground">
                    Funil ·{" "}
                    <span className="font-semibold text-foreground">
                      {stage.label}
                    </span>
                  </td>
                  {items.map((item) => {
                    const count = item.funnel_counts?.[stage.step_name] ?? 0;
                    const rate = item.funnel_rates?.[stage.step_name] ?? 0;
                    const isBestStage =
                      maxStageRate > 0 &&
                      rate === maxStageRate &&
                      count > 0 &&
                      items.filter(
                        (x) => (x.funnel_rates?.[stage.step_name] ?? 0) === maxStageRate,
                      ).length === 1;

                    return (
                      <td key={item.ad_id} className="px-4 py-2.5">
                        {item.leads_crm > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {nfmt(count)}{" "}
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  ({pctfmt(rate, 1)})
                                </span>
                              </span>
                              {isBestStage && (
                                <Award
                                  className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                                  aria-label="Maior taxa nesta etapa"
                                />
                              )}
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", barFill)}
                                style={{ width: `${Math.min(100, rate)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* 11. Valor Gerado */}
            <tr className="zebra-row">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3 font-medium text-muted-foreground">
                Valor Gerado (CRM)
              </td>
              {items.map((item) => (
                <td key={item.ad_id} className="px-4 py-3">
                  <span
                    className={cn(
                      "font-mono text-sm font-semibold",
                      item.valor_gerado > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.valor_gerado > 0 ? currency(item.valor_gerado) : "—"}
                  </span>
                </td>
              ))}
            </tr>

            {/* 12. ROAS (winner highlighted!) */}
            <tr className="bg-primary/[0.03]">
              <td className="sticky left-0 z-10 border-r border-border/70 bg-card px-4 py-3.5 font-semibold text-foreground">
                ROAS
              </td>
              {items.map((item) => {
                const isBestRoas =
                  winners.bestRoasId === item.ad_id &&
                  item.roas != null &&
                  item.roas > 0;
                return (
                  <td
                    key={item.ad_id}
                    className={cn(
                      "px-4 py-3.5",
                      isBestRoas && "bg-emerald-500/[0.08]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "font-display text-base font-bold",
                          isBestRoas
                            ? "text-emerald-700 dark:text-emerald-300"
                            : item.roas != null && item.roas > 0
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {item.roas != null && item.roas > 0
                          ? `${item.roas.toFixed(2)}×`
                          : "—"}
                      </span>
                      {isBestRoas && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-emerald-500/30">
                          <Crown className="h-3 w-3 shrink-0" aria-hidden="true" />
                          Maior ROAS
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

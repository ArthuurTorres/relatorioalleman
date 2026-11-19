import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCreativesPerformance,
  type CreativeItem,
} from "@/lib/creatives.functions";
import type { Filters } from "@/lib/utm.functions";
import {
  currency,
  downloadCsv,
  nfmt,
  operadoraFromCampaign,
  pctfmt,
  toCsv,
} from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreativeCard,
  CplVsBenchmarkChip,
  DeliveryBadge,
  DeltaBadge,
  PerformanceTagBadge,
  STAGE_STEP_TONE,
  inferCreativeFormat,
} from "./CreativeCard";
import {
  CreativesComparator,
  CreativesSelectionDock,
} from "./CreativesComparator";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Download,
  GitCompareArrows,
  Info,
  LayoutGrid,
  Radio,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";

type StatusFilterKey = "serving" | "with_spend" | "champions" | "all";
type SortOptionKey = "spend" | "leads" | "cpl" | "ctr" | "valor_roas";
type ViewMode = "gallery" | "table";

const SORT_OPTIONS: Array<{ key: SortOptionKey; label: string }> = [
  { key: "spend", label: "Maior investimento" },
  { key: "leads", label: "Mais leads" },
  { key: "cpl", label: "Menor CPL (c/ leads)" },
  { key: "ctr", label: "Maior CTR" },
  { key: "valor_roas", label: "Maior valor / ROAS" },
];

function sortCreativeItems(
  list: CreativeItem[],
  sortBy: SortOptionKey,
): CreativeItem[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sortBy === "spend") {
      if (b.spend !== a.spend) return b.spend - a.spend;
      if (b.leads !== a.leads) return b.leads - a.leads;
      if (b.impressions !== a.impressions) return b.impressions - a.impressions;
      return a.ad_name.localeCompare(b.ad_name, "pt-BR");
    }

    if (sortBy === "leads") {
      if (b.leads !== a.leads) return b.leads - a.leads;
      if ((a.cpl ?? Infinity) !== (b.cpl ?? Infinity)) {
        return (a.cpl ?? Infinity) - (b.cpl ?? Infinity);
      }
      return b.spend - a.spend;
    }

    if (sortBy === "cpl") {
      const aValid = a.leads > 0 && a.cpl != null && a.cpl > 0;
      const bValid = b.leads > 0 && b.cpl != null && b.cpl > 0;
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && bValid && a.cpl !== b.cpl) {
        return (a.cpl ?? Infinity) - (b.cpl ?? Infinity);
      }
      if (b.leads !== a.leads) return b.leads - a.leads;
      return b.spend - a.spend;
    }

    if (sortBy === "ctr") {
      const aImp = a.impressions > 0;
      const bImp = b.impressions > 0;
      if (aImp !== bImp) return aImp ? -1 : 1;
      if (b.ctr !== a.ctr) return b.ctr - a.ctr;
      return b.clicks - a.clicks;
    }

    // valor_roas
    if (b.valor_gerado !== a.valor_gerado) {
      return b.valor_gerado - a.valor_gerado;
    }
    if ((b.roas ?? 0) !== (a.roas ?? 0)) {
      return (b.roas ?? 0) - (a.roas ?? 0);
    }
    if (b.leads !== a.leads) return b.leads - a.leads;
    return b.spend - a.spend;
  });
  return copy;
}

export function CreativesTab({ filters }: { filters: Filters }) {
  const creativesFn = useServerFn(getCreativesPerformance);
  const comparatorRef = useRef<HTMLElement | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("serving");
  const [campaignFilter, setCampaignFilter] = useState<string>("__all__");
  const [search, setSearch] = useState<string>("");
  // Debounce da busca: filtra após 250ms sem digitar (galeria grande filtra a cada tecla = jank)
  const [searchInput, setSearchInput] = useState<string>("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortBy, setSortBy] = useState<SortOptionKey>("spend");
  const [viewMode, setViewMode] = useState<ViewMode>("gallery");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ["creatives-performance", filters.from, filters.to],
    queryFn: () =>
      creativesFn({
        data: { from: filters.from, to: filters.to },
      }),
    staleTime: 60_000,
  });

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  function handleSearchInput(value: string) {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearch(value), 250);
  }

  const payload = query.data;
  const allItems = useMemo(() => payload?.items ?? [], [payload?.items]);
  const stages = useMemo(
    () => (payload?.stages ?? []).filter((s) => s.step_name !== "perdido"),
    [payload?.stages],
  );
  const summary = payload?.summary;

  // Real counts per status tab
  const counts = useMemo(() => {
    let serving = 0;
    let servingWithSpend = 0;
    let servingIdle = 0;
    let withSpend = 0;
    let champions = 0;

    for (const item of allItems) {
      if (item.is_serving_now) {
        serving += 1;
        if (item.spend > 0) servingWithSpend += 1;
        else servingIdle += 1;
      }
      if (item.spend > 0) withSpend += 1;
      if (
        item.performance_tag === "champion" ||
        item.performance_tag === "scalable"
      ) {
        champions += 1;
      }
    }

    return {
      serving,
      servingWithSpend,
      servingIdle,
      withSpend,
      pausedWithSpend: Math.max(0, withSpend - servingWithSpend),
      champions,
      all: allItems.length,
    };
  }, [allItems]);

  // Unique campaigns for dropdown filter
  const campaignOptions = useMemo(() => {
    const map = new Map<string, { name: string; count: number; spend: number }>();
    for (const item of allItems) {
      const name = item.campaign_name || "Sem campanha";
      const curr = map.get(name) ?? { name, count: 0, spend: 0 };
      curr.count += 1;
      curr.spend += item.spend;
      map.set(name, curr);
    }
    return [...map.values()].sort(
      (a, b) => b.spend - a.spend || a.name.localeCompare(b.name, "pt-BR"),
    );
  }, [allItems]);

  // Quick Executive Highlights
  const highlights = useMemo(() => {
    const withCpl = allItems.filter(
      (i) => i.leads >= 2 && i.cpl != null && i.cpl > 0,
    );
    const bestEfficiency =
      withCpl.length > 0
        ? withCpl.reduce((best, curr) =>
            (curr.cpl ?? Infinity) < (best.cpl ?? Infinity) ? curr : best,
          )
        : null;

    const topVolume =
      allItems.some((i) => i.leads > 0)
        ? allItems.reduce((best, curr) =>
            curr.leads > best.leads ? curr : best,
          )
        : null;

    const attentionCount = allItems.filter(
      (i) => i.performance_tag === "attention",
    ).length;

    return { bestEfficiency, topVolume, attentionCount };
  }, [allItems]);

  // Filtered & sorted list
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = allItems.filter((item) => {
      if (statusFilter === "serving" && !item.is_serving_now) return false;
      if (statusFilter === "with_spend" && item.spend <= 0) return false;
      if (
        statusFilter === "champions" &&
        item.performance_tag !== "champion" &&
        item.performance_tag !== "scalable"
      ) {
        return false;
      }

      if (
        campaignFilter !== "__all__" &&
        item.campaign_name !== campaignFilter
      ) {
        return false;
      }

      if (q) {
        const match =
          item.ad_name.toLowerCase().includes(q) ||
          item.campaign_name.toLowerCase().includes(q) ||
          item.adset_name.toLowerCase().includes(q) ||
          (item.title?.toLowerCase().includes(q) ?? false) ||
          (item.body?.toLowerCase().includes(q) ?? false) ||
          operadoraFromCampaign(item.campaign_name).toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });

    return sortCreativeItems(base, sortBy);
  }, [allItems, statusFilter, campaignFilter, search, sortBy]);

  // Selected items resolved in selection order
  const selectedItems = useMemo(() => {
    const byId = new Map(allItems.map((i) => [i.ad_id, i]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((x): x is CreativeItem => Boolean(x));
  }, [allItems, selectedIds]);

  function scrollToComparator() {
    requestAnimationFrame(() => {
      setTimeout(() => {
        comparatorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);
    });
  }

  function handleToggleSelect(adId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(adId)) {
        return prev.filter((id) => id !== adId);
      }
      if (prev.length >= 4) return prev;
      return [...prev, adId];
    });
  }

  function handleCompareTopCreatives() {
    if (allItems.length < 2) return;

    // Prioritize serving creatives with real spend/leads, then top spend/leads overall
    const servingActive = sortCreativeItems(
      allItems.filter((i) => i.is_serving_now && (i.spend > 0 || i.leads > 0)),
      "spend",
    );
    const fallbackWithActivity = sortCreativeItems(
      allItems.filter((i) => !i.is_serving_now && (i.spend > 0 || i.leads > 0)),
      "spend",
    );
    const remaining = sortCreativeItems(allItems, "spend");

    const picked: string[] = [];
    for (const candidate of [
      ...servingActive,
      ...fallbackWithActivity,
      ...remaining,
    ]) {
      if (picked.length >= 3) break;
      if (!picked.includes(candidate.ad_id)) {
        picked.push(candidate.ad_id);
      }
    }

    setSelectedIds(picked);
    scrollToComparator();
  }

  function handleExportCsv() {
    if (!filteredItems.length) return;
    const headers = [
      "Criativo",
      "ID Anúncio",
      "Status Entrega",
      "Tag Performance",
      "Operadora",
      "Campanha",
      "Conjunto",
      "Investimento",
      "Impressões",
      "Cliques",
      "CTR (%)",
      "CPC",
      "Leads Total",
      "Leads CRM",
      "Leads Meta",
      "CPL",
      "Valor Gerado",
      "ROAS",
      ...stages.map((s) => `Funil ${s.label} (%)`),
    ];

    const rows = filteredItems.map((i) => [
      i.ad_name,
      i.ad_id,
      i.is_serving_now ? "Em veiculação" : i.delivery_state,
      i.performance_tag,
      operadoraFromCampaign(i.campaign_name),
      i.campaign_name,
      i.adset_name,
      i.spend,
      i.impressions,
      i.clicks,
      Number(i.ctr.toFixed(2)),
      Number(i.cpc.toFixed(2)),
      i.leads,
      i.leads_crm,
      i.leads_meta,
      i.cpl ?? "",
      i.valor_gerado,
      i.roas != null ? Number(i.roas.toFixed(2)) : "",
      ...stages.map((s) => i.funnel_rates?.[s.step_name] ?? 0),
    ]);

    downloadCsv("criativos-alleman.csv", toCsv(headers, rows));
  }

  return (
    <div className="space-y-6">
      {/* 1. Top Strip: 6 Executive KPIs */}
      <section aria-label="Indicadores consolidados de criativos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* KPI 1: Em veiculação agora */}
          <div className="bento-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                Em veiculação agora
              </p>
              <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-65" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              </span>
            </div>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-20" />
            ) : (
              <>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {nfmt(summary?.active_now_count ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    {nfmt(counts.servingWithSpend)} c/ gasto
                  </span>{" "}
                  · {nfmt(summary?.with_spend_count ?? 0)} no período
                </p>
              </>
            )}
          </div>

          {/* KPI 2: Investimento */}
          <div className="bento-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Investimento
            </p>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-28" />
            ) : (
              <>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {currency(summary?.total_spend ?? 0)}
                </p>
                <div className="mt-1">
                  <DeltaBadge pct={summary?.spend_delta_pct ?? null} showLabel />
                </div>
              </>
            )}
          </div>

          {/* KPI 3: Leads gerados */}
          <div className="bento-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Leads gerados
            </p>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-20" />
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {nfmt(summary?.total_leads ?? 0)}
                  </p>
                  <DeltaBadge pct={summary?.leads_delta_pct ?? null} />
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground tabular-nums">
                  CRM <strong className="text-foreground">{nfmt(summary?.total_leads_crm ?? 0)}</strong> · Meta{" "}
                  {nfmt(summary?.total_leads_meta ?? 0)}
                </p>
              </>
            )}
          </div>

          {/* KPI 4: CPL médio */}
          <div className="bento-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              CPL médio
            </p>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-24" />
            ) : (
              <>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {summary?.avg_cpl != null ? currency(summary.avg_cpl) : "—"}
                </p>
                <div className="mt-1">
                  <DeltaBadge
                    pct={summary?.cpl_delta_pct ?? null}
                    invertGood
                    showLabel
                  />
                </div>
              </>
            )}
          </div>

          {/* KPI 5: CTR médio */}
          <div className="bento-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              CTR médio
            </p>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-20" />
            ) : (
              <>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {pctfmt(summary?.avg_ctr ?? 0, 2)}
                  </p>
                  <DeltaBadge pct={summary?.ctr_delta_pct ?? null} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  CPC médio {currency(summary?.avg_cpc ?? 0)}
                </p>
              </>
            )}
          </div>

          {/* KPI 6: Valor / ROAS */}
          <div className="bento-card p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Valor / ROAS
            </p>
            {query.isLoading ? (
              <Skeleton className="mt-2.5 h-8 w-28" />
            ) : (
              <>
                <p
                  className={cn(
                    "mt-2 truncate font-display text-2xl font-bold tracking-tight tabular-nums",
                    (summary?.total_valor ?? 0) > 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-foreground",
                  )}
                >
                  {currency(summary?.total_valor ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                  ROAS:{" "}
                  <strong className="font-semibold text-foreground">
                    {summary?.avg_roas != null && summary.avg_roas > 0
                      ? `${summary.avg_roas.toFixed(2)}×`
                      : "—"}
                  </strong>
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 2. Quick Executive Highlights + 1-Click "Comparar Top Criativos" */}
      {!query.isLoading && allItems.length >= 2 && (
        <section className="bento-card flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Melhor Eficiência (CPL)
                </p>
                {highlights.bestEfficiency ? (
                  <>
                    <p
                      className="truncate text-xs font-semibold text-foreground"
                      title={highlights.bestEfficiency.ad_name}
                    >
                      {highlights.bestEfficiency.ad_name}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {currency(highlights.bestEfficiency.cpl)} ·{" "}
                      {nfmt(highlights.bestEfficiency.leads)} leads
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Aguardando volume mínimo (2+ leads)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Líder de Tração
                </p>
                {highlights.topVolume ? (
                  <>
                    <p
                      className="truncate text-xs font-semibold text-foreground"
                      title={highlights.topVolume.ad_name}
                    >
                      {highlights.topVolume.ad_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      <strong className="text-foreground">
                        {nfmt(highlights.topVolume.leads)} leads
                      </strong>{" "}
                      · {currency(highlights.topVolume.spend)} investidos
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sem leads atribuídos no período
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Radar de Revisão
                </p>
                <p className="text-xs font-semibold text-foreground tabular-nums">
                  {nfmt(highlights.attentionCount)} criativo
                  {highlights.attentionCount === 1 ? "" : "s"} em atenção
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {highlights.attentionCount > 0
                    ? "Gasto acima do CPL alvo ou pendência"
                    : "Nenhum criativo fora da tolerância de custo"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end border-t border-border/70 pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
            <Button
              type="button"
              onClick={handleCompareTopCreatives}
              className="h-10 w-full cursor-pointer gap-2 px-4 text-xs font-semibold shadow-xs sm:w-auto"
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
              Comparar Top Criativos
            </Button>
          </div>
        </section>
      )}

      {/* 3. Side-by-Side Comparator Panel (renders when 2..4 creatives are selected) */}
      {selectedItems.length >= 2 && summary && (
        <CreativesComparator
          ref={comparatorRef}
          items={selectedItems}
          stages={payload?.stages ?? []}
          summary={summary}
          onRemove={handleToggleSelect}
          onClear={() => setSelectedIds([])}
        />
      )}

      {/* 4. Discreet Executive Note when Meta Creative Thumbnails Are Not Synced Yet */}
      {!query.isLoading && payload && !payload.has_creative_assets && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 sm:items-center">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300 sm:mt-0"
              aria-hidden="true"
            />
            <p className="leading-relaxed">
              <strong className="font-semibold text-foreground">
                Dados de veiculação, mídia e funil Bitrix 100% reais:
              </strong>{" "}
              exibindo Previews Estruturados Executivos enquanto as miniaturas de mídia da Meta são sincronizadas automaticamente quando{" "}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono text-[11px] text-foreground ring-1 ring-border">
                META_ACCESS_TOKEN
              </code>{" "}
              estiver configurado.
            </p>
          </div>
        </div>
      )}

      {/* 5. Filter & Control Deck */}
      <section className="bento-card space-y-3.5 p-4 sm:p-5">
        {/* Status Filter Pills with Live Counters */}
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div
            role="group"
            aria-label="Filtrar criativos por status de entrega e performance"
            className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/55 p-1"
          >
            <button
              type="button"
              onClick={() => setStatusFilter("serving")}
              className={cn(
                "filter-chip h-8 gap-1.5 px-3 text-xs",
                statusFilter === "serving"
                  ? "filter-chip-active"
                  : "hover:bg-card hover:text-foreground",
              )}
            >
              <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Em veiculação agora
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums",
                  statusFilter === "serving"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-card text-foreground",
                )}
              >
                {counts.serving}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("with_spend")}
              className={cn(
                "filter-chip h-8 gap-1.5 px-3 text-xs",
                statusFilter === "with_spend"
                  ? "filter-chip-active"
                  : "hover:bg-card hover:text-foreground",
              )}
            >
              Com investimento no período
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums",
                  statusFilter === "with_spend"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-card text-foreground",
                )}
              >
                {counts.withSpend}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("champions")}
              className={cn(
                "filter-chip h-8 gap-1.5 px-3 text-xs",
                statusFilter === "champions"
                  ? "filter-chip-active"
                  : "hover:bg-card hover:text-foreground",
              )}
            >
              Campeões &amp; Escaláveis
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums",
                  statusFilter === "champions"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-card text-foreground",
                )}
              >
                {counts.champions}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "filter-chip h-8 gap-1.5 px-3 text-xs",
                statusFilter === "all"
                  ? "filter-chip-active"
                  : "hover:bg-card hover:text-foreground",
              )}
            >
              Todos
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums",
                  statusFilter === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-card text-foreground",
                )}
              >
                {counts.all}
              </span>
            </button>
          </div>

          {/* View Mode Toggle + CSV Export */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div
              role="group"
              aria-label="Alternar modo de visualização"
              className="inline-flex rounded-lg border border-border bg-muted/55 p-1"
            >
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={cn(
                  "filter-chip h-7 gap-1.5 px-2.5 text-xs",
                  viewMode === "gallery"
                    ? "filter-chip-active"
                    : "hover:bg-card hover:text-foreground",
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                Galeria
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "filter-chip h-7 gap-1.5 px-2.5 text-xs",
                  viewMode === "table"
                    ? "filter-chip-active"
                    : "hover:bg-card hover:text-foreground",
                )}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                Tabela Analítica Completa
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filteredItems.length === 0}
              onClick={handleExportCsv}
              className="h-9 cursor-pointer gap-1.5 border-border bg-background text-xs hover:bg-muted/60"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              CSV
            </Button>
          </div>
        </div>

        {/* Search + Campaign Select + Sort Select */}
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Buscar criativo por nome, campanha, conjunto ou copy"
              placeholder="Buscar por campanha, conjunto ou anúncio…"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="h-9 border-border bg-background pl-8 pr-8 text-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  if (searchDebounceRef.current)
                    clearTimeout(searchDebounceRef.current);
                  setSearchInput("");
                  setSearch("");
                }}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger
                aria-label="Filtrar por campanha"
                className="h-9 border-border bg-background text-xs"
              >
                <SelectValue placeholder="Todas as campanhas" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                <SelectItem value="__all__" className="text-xs">
                  Todas as campanhas ({campaignOptions.length})
                </SelectItem>
                {campaignOptions.map((c) => (
                  <SelectItem key={c.name} value={c.name} className="text-xs">
                    {c.name} ({c.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOptionKey)}
            >
              <SelectTrigger
                aria-label="Ordenar criativos"
                className="h-9 border-border bg-background text-xs"
              >
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Contextual Notice for "Em veiculação agora" when active ads have R$ 0 spend in filtered range or paused ads also spent */}
        {!query.isLoading &&
          statusFilter === "serving" &&
          (counts.servingIdle > 0 || counts.pausedWithSpend > 0) && (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground tabular-nums">
                Exibindo{" "}
                <strong className="font-semibold text-foreground">
                  {nfmt(counts.serving)} criativos em veiculação ativa
                </strong>{" "}
                ({nfmt(counts.servingWithSpend)} com investimento no período
                {counts.servingIdle > 0
                  ? ` · ${nfmt(counts.servingIdle)} ativos sem gasto nesta janela`
                  : ""}
                ).
                {counts.pausedWithSpend > 0 && (
                  <>
                    {" "}
                    Outros{" "}
                    <strong className="font-semibold text-foreground">
                      {nfmt(counts.pausedWithSpend)} criativos pausados
                    </strong>{" "}
                    também tiveram investimento neste período.
                  </>
                )}
              </p>

              {counts.withSpend > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusFilter("with_spend")}
                  className="h-8 shrink-0 cursor-pointer gap-1.5 border-amber-500/30 bg-card text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-muted/60"
                >
                  Ver todos com gasto ({counts.withSpend})
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
      </section>

      {/* 6. Content Area: Gallery vs Analytical Table */}
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[420px] w-full rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="bento-card p-8 text-center">
          <p className="font-display text-base font-semibold text-red-700 dark:text-red-300">
            Não foi possível carregar os dados de criativos.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique a conexão com o Supabase e tente atualizar novamente.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            className="mt-4 cursor-pointer"
          >
            Tentar novamente
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bento-card p-10 text-center">
          <p className="font-display text-base font-semibold text-foreground">
            Nenhum criativo corresponde aos filtros aplicados
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Experimente limpar a busca ou alternar para &ldquo;Todos&rdquo; ({counts.all} criativos no período).
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCampaignFilter("__all__");
                setStatusFilter("all");
              }}
              className="cursor-pointer text-xs"
            >
              Mostrar todos os criativos ({counts.all})
            </Button>
          </div>
        </div>
      ) : viewMode === "gallery" ? (
        <section aria-label="Galeria de criativos">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              Mostrando{" "}
              <strong className="font-semibold text-foreground">
                {nfmt(filteredItems.length)}
              </strong>{" "}
              de {nfmt(counts.all)} criativos
            </span>
            <span>
              Selecione de <strong className="text-foreground">2 a 4 criativos</strong> para comparar lado a lado
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const selIdx = selectedIds.indexOf(item.ad_id);
              const isSelected = selIdx !== -1;
              return (
                <CreativeCard
                  key={item.ad_id}
                  item={item}
                  stages={payload?.stages ?? []}
                  avgCpl={summary?.avg_cpl ?? null}
                  totalSpend={summary?.total_spend ?? 0}
                  isSelected={isSelected}
                  selectionIndex={isSelected ? selIdx : undefined}
                  selectionDisabled={selectedIds.length >= 4}
                  onToggleSelect={handleToggleSelect}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-label="Tabela analítica completa de criativos" className="bento-card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground tabular-nums">
            <span>
              Tabela Analítica Completa ·{" "}
              <strong className="font-semibold text-foreground">
                {nfmt(filteredItems.length)} criativos
              </strong>
            </span>
            <span>
              Marque a caixa na 1ª coluna para comparar até 4 criativos
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[1120px] text-xs">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="sticky left-0 z-20 min-w-[280px] border-r border-border bg-card px-4 py-3 text-left">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <GitCompareArrows className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Comparar · Criativo
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[170px] px-3 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status &amp; Tag
                  </TableHead>
                  <TableHead className="min-w-[160px] px-3 py-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Campanha / Operadora
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Investimento
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Imp.
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CTR
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CPC
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Leads (CRM/Meta)
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CPL vs Média
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor
                  </TableHead>
                  <TableHead className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    ROAS
                  </TableHead>
                  {stages.map((stage) => (
                    <TableHead
                      key={stage.step_name}
                      className="px-3 py-3 text-right text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {stage.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody className="tabular-nums">
                {filteredItems.map((item) => {
                  const isSelected = selectedIds.includes(item.ad_id);
                  const disableCheck = !isSelected && selectedIds.length >= 4;
                  const fmt = inferCreativeFormat(item);
                  const FmtIcon = fmt.Icon;
                  const operadora = operadoraFromCampaign(item.campaign_name);

                  return (
                    <TableRow
                      key={item.ad_id}
                      className={cn(
                        "zebra-row border-b border-border/70",
                        isSelected && "bg-primary/[0.06]",
                      )}
                    >
                      {/* Sticky 1st Column with Compare Checkbox + Structured Creative Info */}
                      <TableCell className="sticky left-0 z-10 min-w-[280px] border-r border-border/70 bg-card px-4 py-2.5">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            disabled={disableCheck}
                            onCheckedChange={() => handleToggleSelect(item.ad_id)}
                            aria-label={`Selecionar ${item.ad_name} para comparação`}
                            className="mt-1 cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium",
                                  fmt.badgeClass,
                                )}
                              >
                                <FmtIcon className="h-2.5 w-2.5" aria-hidden="true" />
                                {fmt.label}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{item.ad_id.slice(-6)}
                              </span>
                            </div>
                            <p
                              className="mt-1 truncate font-medium text-foreground"
                              title={item.ad_name}
                            >
                              {item.ad_name}
                            </p>
                            <p
                              className="truncate text-[10.5px] text-muted-foreground"
                              title={item.adset_name}
                            >
                              {item.adset_name}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Status & Tag */}
                      <TableCell className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <DeliveryBadge item={item} compact />
                          <PerformanceTagBadge
                            tag={item.performance_tag}
                            compact
                          />
                        </div>
                      </TableCell>

                      {/* Campanha / Operadora */}
                      <TableCell className="max-w-[190px] px-3 py-2.5">
                        {operadora !== "—" && (
                          <span className="mb-0.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary">
                            <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {operadora}
                          </span>
                        )}
                        <p
                          className="truncate text-xs text-muted-foreground"
                          title={item.campaign_name}
                        >
                          {item.campaign_name}
                        </p>
                      </TableCell>

                      {/* Investimento */}
                      <TableCell className="px-3 py-2.5 text-right">
                        <span className="font-mono font-semibold text-foreground">
                          {currency(item.spend)}
                        </span>
                        <div className="mt-0.5 flex justify-end">
                          <DeltaBadge pct={item.spend_delta_pct} />
                        </div>
                      </TableCell>

                      {/* Impressões */}
                      <TableCell className="px-3 py-2.5 text-right text-muted-foreground">
                        {nfmt(item.impressions)}
                      </TableCell>

                      {/* CTR */}
                      <TableCell className="px-3 py-2.5 text-right font-medium text-foreground">
                        {item.impressions > 0 ? pctfmt(item.ctr, 2) : "—"}
                      </TableCell>

                      {/* CPC */}
                      <TableCell className="px-3 py-2.5 text-right text-muted-foreground">
                        {item.clicks > 0 ? currency(item.cpc) : "—"}
                      </TableCell>

                      {/* Leads */}
                      <TableCell className="px-3 py-2.5 text-right">
                        <span className="font-semibold text-foreground">
                          {nfmt(item.leads)}
                        </span>
                        <span className="block text-[10.5px] text-muted-foreground">
                          {nfmt(item.leads_crm)} CRM · {nfmt(item.leads_meta)} Meta
                        </span>
                      </TableCell>

                      {/* CPL vs Média */}
                      <TableCell className="px-3 py-2.5 text-right">
                        <span className="font-mono font-semibold text-foreground">
                          {item.cpl != null && item.cpl > 0
                            ? currency(item.cpl)
                            : "—"}
                        </span>
                        <div className="mt-0.5 flex justify-end">
                          <CplVsBenchmarkChip
                            cpl={item.cpl}
                            avgCpl={summary?.avg_cpl ?? null}
                            compact
                          />
                        </div>
                      </TableCell>

                      {/* Valor */}
                      <TableCell className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            "font-mono font-semibold",
                            item.valor_gerado > 0
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.valor_gerado > 0
                            ? currency(item.valor_gerado)
                            : "—"}
                        </span>
                      </TableCell>

                      {/* ROAS */}
                      <TableCell className="px-3 py-2.5 text-right">
                        {item.roas != null && item.roas > 0 ? (
                          <span
                            className={cn(
                              "font-semibold",
                              item.roas >= 1
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-300",
                            )}
                          >
                            {item.roas.toFixed(2)}×
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Bitrix Funnel Stages */}
                      {stages.map((stage) => {
                        const count = item.funnel_counts?.[stage.step_name] ?? 0;
                        const rate = item.funnel_rates?.[stage.step_name];
                        const tone =
                          STAGE_STEP_TONE[stage.step_name] ??
                          "bg-muted text-foreground";
                        return (
                          <TableCell
                            key={stage.step_name}
                            className="px-3 py-2.5 text-right"
                          >
                            {item.leads_crm > 0 && rate != null ? (
                              <div className="inline-flex flex-col items-end">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                                    tone,
                                  )}
                                >
                                  {pctfmt(rate, 1)}
                                </span>
                                <span className="mt-0.5 text-[10px] text-muted-foreground">
                                  {nfmt(count)} deal{count === 1 ? "" : "s"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* 7. Sticky Selection Dock when 1..4 Creatives are Selected */}
      <CreativesSelectionDock
        selectedItems={selectedItems}
        onRemove={handleToggleSelect}
        onClear={() => setSelectedIds([])}
        onViewComparison={scrollToComparator}
      />
    </div>
  );
}

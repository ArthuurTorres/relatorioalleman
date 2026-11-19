"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCreativesPerformance,
  type CreativeItem,
} from "@/lib/creatives.functions";
import {
  currency,
  nfmt,
  operadoraFromCampaign,
  pctfmt,
} from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CplVsBenchmarkChip,
  DeliveryBadge,
  PerformanceTagBadge,
  inferCreativeFormat,
} from "@/components/creatives/CreativeCard";
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  GitCompareArrows,
  Search,
  Sparkles,
} from "lucide-react";

export type CreativesCardProps = {
  filters: { from: string; to: string };
  onOpenCreativesTab?: () => void;
};

type QuickScope = "serving_or_top" | "serving_only";

export function CreativesCard({
  filters,
  onOpenCreativesTab,
}: CreativesCardProps) {
  const creativesFn = useServerFn(getCreativesPerformance);
  const creativesQuery = useQuery({
    queryKey: ["creatives-performance", filters.from, filters.to],
    queryFn: () =>
      creativesFn({
        data: { from: filters.from, to: filters.to },
      }),
    staleTime: 60_000,
  });

  const payload = creativesQuery.data;
  const items = useMemo(() => payload?.items ?? [], [payload?.items]);
  const summary = payload?.summary;
  const stages = useMemo(
    () => (payload?.stages ?? []).filter((s) => s.step_name !== "perdido"),
    [payload?.stages],
  );

  const [scope, setScope] = useState<QuickScope>("serving_or_top");
  const [sortKey, setSortKey] = useState<string>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    let list: CreativeItem[] = [...items];

    if (scope === "serving_only") {
      list = list.filter((a) => a.is_serving_now);
    } else {
      list = list.filter(
        (a) => a.is_serving_now || a.spend > 0 || a.leads > 0,
      );
    }

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.ad_name.toLowerCase().includes(q) ||
          a.campaign_name.toLowerCase().includes(q) ||
          a.adset_name.toLowerCase().includes(q) ||
          operadoraFromCampaign(a.campaign_name).toLowerCase().includes(q) ||
          (a.title?.toLowerCase().includes(q) ?? false) ||
          (a.body?.toLowerCase().includes(q) ?? false),
      );
    }

    list.sort((a, b) => {
      if (sortKey.startsWith("funnel_")) {
        const step = sortKey.replace("funnel_", "");
        const av = a.funnel_rates?.[step] ?? -1;
        const bv = b.funnel_rates?.[step] ?? -1;
        return sortDir === "desc" ? bv - av : av - bv;
      }

      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      const an = typeof av === "number" ? av : av == null ? -1 : Number(av);
      const bn = typeof bv === "number" ? bv : bv == null ? -1 : Number(bv);

      if (!Number.isNaN(an) && !Number.isNaN(bn) && (typeof av === "number" || typeof bv === "number")) {
        return sortDir === "desc" ? bn - an : an - bn;
      }

      return sortDir === "desc"
        ? String(bv ?? "").localeCompare(String(av ?? ""), "pt-BR")
        : String(av ?? "").localeCompare(String(bv ?? ""), "pt-BR");
    });

    return list;
  }, [items, scope, sortKey, sortDir, filterText]);

  const displayed = useMemo(() => filtered.slice(0, 10), [filtered]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) {
      return (
        <ArrowUpDown
          className="ml-1 inline h-3 w-3 text-muted-foreground/50"
          aria-hidden="true"
        />
      );
    }
    return (
      <ArrowUpDown
        className={cn(
          "ml-1 inline h-3 w-3 text-primary transition-transform",
          sortDir === "asc" && "rotate-180",
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <section className="bento-card p-5 sm:p-6">
      {/* Header + Executive Summary Pills + CTA */}
      <div className="flex flex-col gap-4 border-b border-border/70 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Mídia Criativa &amp; Atribuição CRM
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              Top Criativos em Veiculação &amp; Melhor Desempenho
            </h3>
            {!creativesQuery.isLoading && summary && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-emerald-500/25 tabular-nums">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                {nfmt(summary.active_now_count)} em veiculação
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Síntese dos anúncios ativos e campeões no período selecionado com eficiência de CPL e avanço no Funil Bitrix.
          </p>
        </div>

        {onOpenCreativesTab && (
          <Button
            type="button"
            onClick={onOpenCreativesTab}
            className="h-9 shrink-0 cursor-pointer gap-2 text-xs font-semibold shadow-xs"
          >
            <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Abrir Central &amp; Comparador de Criativos
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Sub-toolbar: Quick Filter + Search */}
      <div className="mt-4 mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg border border-border bg-muted/55 p-1">
          <button
            type="button"
            onClick={() => setScope("serving_or_top")}
            className={cn(
              "filter-chip h-7 px-2.5 text-xs",
              scope === "serving_or_top"
                ? "filter-chip-active"
                : "hover:bg-card hover:text-foreground",
            )}
          >
            Top desempenho ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setScope("serving_only")}
            className={cn(
              "filter-chip h-7 px-2.5 text-xs",
              scope === "serving_only"
                ? "filter-chip-active"
                : "hover:bg-card hover:text-foreground",
            )}
          >
            Em veiculação ({summary?.active_now_count ?? 0})
          </button>
        </div>

        <div className="relative w-full sm:max-w-[260px]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Filtrar criativos na visão geral"
            placeholder="Buscar criativo ou campanha…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="h-8 border-border bg-background pl-8 text-xs"
          />
        </div>
      </div>

      {/* Table Content */}
      {creativesQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : displayed.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/25 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Nenhum criativo encontrado para este filtro no período.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ajuste o período no topo do painel ou abra a Central de Criativos para ver todo o inventário.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table className="min-w-[920px] text-xs">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                <TableHead
                  className="sticky left-0 z-10 min-w-[240px] cursor-pointer border-r border-border/70 bg-card select-none hover:text-primary"
                  onClick={() => toggleSort("ad_name")}
                >
                  Criativo <SortIcon col="ad_name" />
                </TableHead>
                <TableHead
                  className="min-w-[150px] cursor-pointer select-none hover:text-primary"
                  onClick={() => toggleSort("campaign_name")}
                >
                  Campanha / Operadora <SortIcon col="campaign_name" />
                </TableHead>
                <TableHead className="min-w-[155px]">Status &amp; Tag</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("spend")}
                >
                  Invest. <SortIcon col="spend" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("ctr")}
                >
                  CTR <SortIcon col="ctr" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("leads")}
                >
                  Leads <SortIcon col="leads" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("cpl")}
                >
                  CPL <SortIcon col="cpl" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("valor_gerado")}
                >
                  Valor <SortIcon col="valor_gerado" />
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right hover:text-primary"
                  onClick={() => toggleSort("roas")}
                >
                  ROAS <SortIcon col="roas" />
                </TableHead>
                {stages.slice(0, 4).map((s) => (
                  <TableHead
                    key={s.step_name}
                    className="cursor-pointer select-none text-right hover:text-primary"
                    onClick={() => toggleSort(`funnel_${s.step_name}`)}
                  >
                    {s.label} <SortIcon col={`funnel_${s.step_name}`} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody className="tabular-nums">
              {displayed.map((ad) => {
                const fmt = inferCreativeFormat(ad);
                const FmtIcon = fmt.Icon;
                const operadora = operadoraFromCampaign(ad.campaign_name);

                return (
                  <TableRow
                    key={ad.ad_id}
                    className="zebra-row border-b border-border/70"
                  >
                    {/* Criativo */}
                    <TableCell className="sticky left-0 z-10 min-w-[240px] border-r border-border/70 bg-card py-2.5">
                      <div className="flex items-center gap-2.5">
                        {ad.thumbnail_url ? (
                          <img
                            src={ad.thumbnail_url}
                            alt={ad.ad_name}
                            className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <span
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              fmt.badgeClass,
                            )}
                            title={fmt.label}
                          >
                            <FmtIcon className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 max-w-[185px]">
                          <p
                            className="truncate text-xs font-semibold text-foreground"
                            title={ad.ad_name}
                          >
                            {ad.ad_name}
                          </p>
                          <p
                            className="mt-0.5 truncate text-[10.5px] text-muted-foreground"
                            title={ad.adset_name}
                          >
                            {fmt.label} · {ad.adset_name}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Campanha / Operadora */}
                    <TableCell className="max-w-[170px] py-2.5">
                      {operadora !== "—" && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary">
                          <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {operadora}
                        </span>
                      )}
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={ad.campaign_name}
                      >
                        {ad.campaign_name || "—"}
                      </span>
                    </TableCell>

                    {/* Status & Performance Tag */}
                    <TableCell className="py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        <DeliveryBadge item={ad} compact />
                        <PerformanceTagBadge tag={ad.performance_tag} compact />
                      </div>
                    </TableCell>

                    {/* Spend */}
                    <TableCell className="py-2.5 text-right font-mono text-xs font-semibold text-foreground">
                      {currency(ad.spend)}
                    </TableCell>

                    {/* CTR */}
                    <TableCell className="py-2.5 text-right text-xs text-muted-foreground">
                      {ad.impressions > 0 ? pctfmt(ad.ctr, 2) : "—"}
                    </TableCell>

                    {/* Leads */}
                    <TableCell className="py-2.5 text-right">
                      <span className="font-semibold text-foreground">
                        {nfmt(ad.leads)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        CRM {nfmt(ad.leads_crm)}
                      </span>
                    </TableCell>

                    {/* CPL */}
                    <TableCell className="py-2.5 text-right">
                      <span className="font-mono font-medium text-foreground">
                        {ad.cpl != null && ad.cpl > 0 ? currency(ad.cpl) : "—"}
                      </span>
                      <div className="mt-0.5 flex justify-end">
                        <CplVsBenchmarkChip
                          cpl={ad.cpl}
                          avgCpl={summary?.avg_cpl ?? null}
                          compact
                        />
                      </div>
                    </TableCell>

                    {/* Valor */}
                    <TableCell className="py-2.5 text-right">
                      <span
                        className={cn(
                          "font-mono font-semibold",
                          ad.valor_gerado > 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {ad.valor_gerado > 0 ? currency(ad.valor_gerado) : "—"}
                      </span>
                    </TableCell>

                    {/* ROAS */}
                    <TableCell className="py-2.5 text-right">
                      {ad.roas != null && ad.roas > 0 ? (
                        <span
                          className={cn(
                            "font-semibold",
                            ad.roas >= 1
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {ad.roas.toFixed(2)}×
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Funnel rates */}
                    {stages.slice(0, 4).map((s) => {
                      const rate = ad.funnel_rates?.[s.step_name];
                      if (ad.leads_crm <= 0 || rate == null) {
                        return (
                          <TableCell
                            key={s.step_name}
                            className="py-2.5 text-right text-xs text-muted-foreground/50"
                          >
                            —
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={s.step_name}
                          className="py-2.5 text-right"
                        >
                          <span
                            className={cn(
                              "text-xs font-medium",
                              rate >= 50
                                ? "text-emerald-700 dark:text-emerald-300"
                                : rate >= 20
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-muted-foreground",
                            )}
                          >
                            {pctfmt(rate, 1)}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {displayed.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
          <p>
            Exibindo top <strong className="text-foreground">{displayed.length}</strong> de{" "}
            {nfmt(filtered.length)} criativos filtrados ({nfmt(items.length)} no inventário do período)
          </p>
          {onOpenCreativesTab && (
            <button
              type="button"
              onClick={onOpenCreativesTab}
              className="inline-flex cursor-pointer items-center gap-1 font-semibold text-primary hover:underline"
            >
              Ver galeria completa e comparar lado a lado (2 a 4 criativos)
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isUnlocked, lockSite } from "@/lib/gate.functions";
import {
  getUtmDashboard,
  getConversionsTable,
  getFilterOptions,
  getUtmDataBounds,
  type Filters,
} from "@/lib/utm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LogOut,
  ChevronDown,
  ListChecks,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Calendar as CalendarIcon,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { CHART, tooltipStyle } from "@/lib/dashboard-utils";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { MetaUnified } from "@/components/MetaUnified";
import { GoogleDomains } from "@/components/GoogleDomains";
import { GoogleAdsPerformance } from "@/components/GoogleAdsPerformance";
import { DomainComparison } from "@/components/DomainComparison";
import { SyncStatus } from "@/components/SyncStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/overview/OverviewTab";
import { CampaignPicker, type CampaignSelection } from "@/components/CampaignPicker";
import { CampaignDetailView } from "@/components/CampaignDetailView";
import { CampaignComparison } from "@/components/CampaignComparison";
import { GoalsTab } from "@/components/overview/GoalsTab";
import { IntegrationsTab } from "@/components/overview/IntegrationsTab";
import { BitrixFunnelTab } from "@/components/overview/BitrixFunnelTab";
import { CreativesTab } from "@/components/creatives/CreativesTab";
import { TasksTab } from "@/components/tasks/TasksTab";
import { getCreativesPerformance } from "@/lib/creatives.functions";

import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";
import { currentMonthRange } from "@/lib/report-period";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { unlocked } = await isUnlocked();
    if (!unlocked) throw redirect({ to: "/unlock" });
  },
  pendingComponent: () => (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
      <RefreshCcw className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span>Carregando painel…</span>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Alleman Corretora · Painel de Performance" },
      { name: "description", content: "Painel executivo de performance por origem, campanha, anúncio e página." },
      { property: "og:title", content: "Alleman Corretora · Painel de Performance" },
      { property: "og:description", content: "Painel executivo de performance por origem, campanha, anúncio e página." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const COLORS = {
  Google: CHART.cyan,
  Meta: CHART.purple,
  Outros: CHART.grey,
};

/** Fuso de referência do negócio: America/Sao_Paulo (UTC-3, sem horário de verão). */
const TZ_OFFSET = "Z";

/** yyyy-mm-dd do instante informado no fuso de São Paulo */
function spDay(value: string | Date) {
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return value.trim();
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function shiftDay(day: string, deltaDays: number) {
  const [y, m, d] = day.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function toLocalDate(value: string | Date) {
  const day = spDay(value);
  if (day) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(value);
}

function startOfDayIso(value: string | Date) {
  return `${spDay(value)}T00:00:00.000${TZ_OFFSET}`;
}

function endOfDayIso(value: string | Date) {
  return `${spDay(value)}T23:59:59.999${TZ_OFFSET}`;
}

/** yyyy-mm-dd no fuso de São Paulo (evita o deslocamento de 1 dia) */
function localDay(iso: string | Date) {
  return spDay(iso);
}

function fmtDay(iso: string) {
  const s = localDay(iso);
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function todayMinus(days: number) {
  return startOfDayIso(shiftDay(spDay(new Date()), -days));
}
function endOfToday() {
  return endOfDayIso(spDay(new Date()));
}

type RangePreset = {
  key: string;
  label: string;
  compute: () => { from: string; to: string };
};

const RANGE_PRESETS: RangePreset[] = [
  { key: "3d", label: "3d", compute: () => ({ from: todayMinus(3), to: endOfToday() }) },
  { key: "ontem", label: "Ontem", compute: () => ({ from: todayMinus(3), to: endOfDayIso(todayMinus(1)) }) },
  { key: "7d", label: "7d", compute: () => ({ from: todayMinus(6), to: endOfToday() }) },
  { key: "14d", label: "14d", compute: () => ({ from: todayMinus(13), to: endOfToday() }) },
  { key: "30d", label: "30d", compute: () => ({ from: todayMinus(29), to: endOfToday() }) },
  { key: "90d", label: "90d", compute: () => ({ from: todayMinus(89), to: endOfToday() }) },
  {
    key: "mes",
    label: "Este mês",
    compute: () => currentMonthRange(),
  },
  {
    key: "mesPassado",
    label: "Mês passado",
    compute: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDayIso(first), to: endOfDayIso(last) };
    },
  },
];

function useFilters() {
  const initial = currentMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [origem, setOrigem] = useState<string[]>([]);
  const [utm_source, setUtmSource] = useState<string[]>([]);
  const [utm_campaign, setUtmCampaign] = useState<string[]>([]);
  const [dominio, setDominio] = useState<string[]>([]);
  const filters: Filters = { from, to, origem, utm_source, utm_campaign, dominio };
  return {
    filters,
    setFrom,
    setTo,
    origem,
    setOrigem,
    utm_source,
    setUtmSource,
    utm_campaign,
    setUtmCampaign,
    dominio,
    setDominio,
  };
}

function MultiSelect({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 cursor-pointer justify-between gap-2 border-border bg-background hover:border-primary/40 hover:bg-muted/50"
        >
          <span>{label}</span>
          {values.length > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[11px]">{values.length}</Badge>}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-80 overflow-auto border-border bg-popover p-3">
        <div className="space-y-2">
          {options.length === 0 && <p className="text-sm text-muted-foreground">Sem opções</p>}
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/60">
              <Checkbox
                checked={values.includes(opt)}
                onCheckedChange={(c) => {
                  if (c) onChange([...values, opt]);
                  else onChange(values.filter((v) => v !== opt));
                }}
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
          {values.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full cursor-pointer" onClick={() => onChange([])}>
              Limpar seleção
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const f = useFilters();
  const lockFn = useServerFn(lockSite);

  const dashboardFn = useServerFn(getUtmDashboard);
  const tableFn = useServerFn(getConversionsTable);
  const filterOptsFn = useServerFn(getFilterOptions);
  const boundsFn = useServerFn(getUtmDataBounds);
  const creativesFn = useServerFn(getCreativesPerformance);

  const filterKey = useMemo(() => JSON.stringify(f.filters), [f.filters]);

  const bounds = useQuery({ queryKey: ["utm-data-bounds"], queryFn: () => boundsFn() });
  const hasBounds = Boolean(bounds.data?.from && bounds.data?.to);

  const dashboard = useQuery({
    queryKey: ["utm-dashboard", filterKey],
    queryFn: () => dashboardFn({ data: f.filters }),
  });
  const options = useQuery({ queryKey: ["options"], queryFn: () => filterOptsFn() });
  const creativesPreview = useQuery({
    queryKey: ["creatives-performance", f.filters.from, f.filters.to],
    queryFn: () => creativesFn({ data: { from: f.filters.from, to: f.filters.to } }),
    staleTime: 60_000,
  });

  const [activeTab, setActiveTab] = useState("visao");
  const [search, setSearch] = useState("");
  const [singleDay, setSingleDay] = useState(false);
  const [canalSel, setCanalSel] = useState<"todos" | "meta" | "google">("todos");
  const [campaign, setCampaign] = useState<CampaignSelection>([]);

  const tableQuery = useQuery({
    queryKey: ["table", filterKey, search],
    queryFn: () => tableFn({ data: { ...f.filters, search } }),
  });

  const summary = dashboard.data?.summary;
  const total = summary?.total ?? 0;
  const byOrigem = summary?.byOrigem ?? { Google: 0, Meta: 0, Outros: 0 };

  async function lock() {
    await lockFn();
    navigate({ to: "/unlock" });
  }

  function applyPreset(preset: RangePreset) {
    const { from, to } = preset.compute();
    setSingleDay(false);
    f.setFrom(from);
    f.setTo(to);
  }

  function applyAll() {
    setSingleDay(false);
    if (bounds.data?.from) f.setFrom(startOfDayIso(bounds.data.from));
    if (bounds.data?.to) f.setTo(endOfDayIso(bounds.data.to));
  }

  function setDay(value: string) {
    if (!value) return;
    f.setFrom(startOfDayIso(value));
    f.setTo(endOfDayIso(value));
  }

  const activePreset = useMemo(() => {
    return RANGE_PRESETS.find((r) => {
      const { from, to } = r.compute();
      return from.slice(0, 10) === f.filters.from.slice(0, 10) && to.slice(0, 10) === f.filters.to.slice(0, 10);
    })?.key;
  }, [f.filters.from, f.filters.to]);

  const nfmt = (n: number) => n.toLocaleString("pt-BR");
  const activeFilterCount =
    f.origem.length + f.utm_source.length + f.utm_campaign.length + f.dominio.length;
  const periodLabel = singleDay
    ? fmtDay(f.filters.from)
    : `${fmtDay(f.filters.from)} — ${fmtDay(f.filters.to)}`;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ backgroundImage: "var(--grad-hero)" }}>
      {/* Executive Header */}
      <header className="border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 py-3.5 sm:px-6 sm:py-4">
          {/* Top bar: Co-branding + Title + Actions (collision-free at 375px) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <img
                  src="/trive-logo.png"
                  alt="Trive"
                  className="h-7 w-auto shrink-0 object-contain sm:h-9"
                />
                <span className="h-6 w-px bg-border sm:h-7" aria-hidden />
                <img
                  src="/alleman-logo.jpg"
                  alt="Alleman Corretora"
                  className="h-8 w-auto shrink-0 rounded-lg border border-border/80 bg-white p-0.5 object-contain shadow-2xs sm:h-10 sm:p-1"
                />
              </div>
              <div className="hidden h-8 w-px bg-border md:block" aria-hidden />
              <div className="hidden min-w-0 flex-col justify-center md:flex">
                <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground lg:text-lg">
                  Alleman Corretora · Painel Executivo de Performance
                </h1>
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  Período ativo: <span className="font-medium text-foreground/85">{periodLabel}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <SyncStatus />
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
                title="Atualizar dados"
                aria-label="Atualizar dados"
                onClick={() => {
                  bounds.refetch();
                  dashboard.refetch();
                  tableQuery.refetch();
                  creativesPreview.refetch();
                }}
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 cursor-pointer px-2 text-muted-foreground hover:text-foreground sm:px-2.5"
                title="Sair do painel"
                aria-label="Sair do painel"
                onClick={lock}
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden text-xs font-medium sm:inline">Sair</span>
              </Button>
            </div>
          </div>

          {/* Mobile Title + Period Subtitle */}
          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border/60 pt-2.5 md:hidden">
            <h1 className="font-display text-sm font-semibold tracking-tight text-foreground">
              Painel Executivo de Performance
            </h1>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {periodLabel}
            </p>
          </div>

          {/* Unified Filter Deck */}
          <div className="mt-3.5 rounded-xl border border-border bg-card p-2.5 shadow-2xs sm:mt-4 sm:p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-0.5 rounded-lg border border-border/80 bg-muted/60 p-1">
                {RANGE_PRESETS.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => applyPreset(r)}
                    className={
                      activePreset === r.key
                        ? "filter-chip filter-chip-active"
                        : "filter-chip hover:bg-card hover:text-foreground"
                    }
                  >
                    {r.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={applyAll}
                  disabled={!hasBounds}
                  className="filter-chip hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Tudo
                </button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="tabular-nums">
                      {singleDay
                        ? fmtDay(f.filters.from)
                        : `${fmtDay(f.filters.from)} → ${fmtDay(f.filters.to)}`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto border-border bg-popover p-0 shadow-lg"
                >
                  <div className="flex gap-1 border-b border-border bg-muted/35 p-2">
                    <button
                      type="button"
                      onClick={() => setSingleDay(false)}
                      className={!singleDay ? "filter-chip filter-chip-active" : "filter-chip hover:bg-card hover:text-foreground"}
                    >
                      Período
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSingleDay(true);
                        setDay(localDay(f.filters.to));
                      }}
                      className={singleDay ? "filter-chip filter-chip-active" : "filter-chip hover:bg-card hover:text-foreground"}
                    >
                      Dia único
                    </button>
                  </div>
                  {singleDay ? (
                    <Calendar
                      mode="single"
                      locale={ptBR}
                      defaultMonth={toLocalDate(localDay(f.filters.from))}
                      selected={toLocalDate(localDay(f.filters.from))}
                      onSelect={(d) => d && setDay(localDay(d))}
                      className="p-3 pointer-events-auto"
                    />
                  ) : (
                    <Calendar
                      mode="range"
                      numberOfMonths={isMobile ? 1 : 2}
                      locale={ptBR}
                      defaultMonth={toLocalDate(localDay(f.filters.from))}
                      selected={{
                        from: toLocalDate(localDay(f.filters.from)),
                        to: toLocalDate(localDay(f.filters.to)),
                      }}
                      onSelect={(range) => {
                        if (range?.from) f.setFrom(startOfDayIso(range.from));
                        if (range?.to) f.setTo(endOfDayIso(range.to));
                        else if (range?.from) f.setTo(endOfDayIso(range.from));
                      }}
                      className="p-3 pointer-events-auto"
                    />
                  )}
                </PopoverContent>
              </Popover>

              {/* Desktop: inline dimension filters */}
              <div className="hidden flex-wrap items-center gap-1.5 md:flex">
                <MultiSelect label="Canal" values={f.origem} onChange={f.setOrigem} options={options.data?.origem ?? []} />
                <MultiSelect label="UTM Source" values={f.utm_source} onChange={f.setUtmSource} options={options.data?.utm_source ?? []} />
                <MultiSelect label="Campanha" values={f.utm_campaign} onChange={f.setUtmCampaign} options={options.data?.utm_campaign ?? []} />
                <MultiSelect label="Domínio" values={f.dominio} onChange={f.setDominio} options={options.data?.dominio ?? []} />
              </div>

              {/* Mobile: compact filter popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 cursor-pointer border-border bg-background md:hidden">
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    Filtros
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[11px]">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 space-y-2 border-border bg-popover p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Dimensões de aquisição
                  </p>
                  <div className="flex flex-col gap-2">
                    <MultiSelect label="Canal" values={f.origem} onChange={f.setOrigem} options={options.data?.origem ?? []} />
                    <MultiSelect label="UTM Source" values={f.utm_source} onChange={f.setUtmSource} options={options.data?.utm_source ?? []} />
                    <MultiSelect label="Campanha" values={f.utm_campaign} onChange={f.setUtmCampaign} options={options.data?.utm_campaign ?? []} />
                    <MultiSelect label="Domínio" values={f.dominio} onChange={f.setDominio} options={options.data?.dominio ?? []} />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Individual / Comparative Campaign Selector */}
            <div className="mt-2.5 border-t border-border/70 pt-2.5">
              <CampaignPicker
                from={f.filters.from}
                to={f.filters.to}
                canal={canalSel}
                onCanalChange={setCanalSel}
                selected={campaign}
                onSelect={setCampaign}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 md:py-7">
        {campaign.length === 1 ? (
          <CampaignDetailView selection={campaign[0]!} from={f.filters.from} to={f.filters.to} />
        ) : campaign.length > 1 ? (
          <CampaignComparison selection={campaign} from={f.filters.from} to={f.filters.to} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="overflow-x-auto pb-0.5">
              <TabsList className="h-auto w-max min-w-full justify-start gap-1 sm:w-auto">
                <TabsTrigger value="visao">Visão geral</TabsTrigger>
                <TabsTrigger value="criativos">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Criativos</span>
                  {creativesPreview.data?.summary.active_now_count != null && (
                    <span className="rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ring-1 ring-emerald-500/25 tabular-nums">
                      {creativesPreview.data.summary.active_now_count}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="funil-bitrix">Funil Bitrix</TabsTrigger>
                <TabsTrigger value="metas">Metas</TabsTrigger>
                <TabsTrigger value="tarefas">
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Tarefas</span>
                </TabsTrigger>
                <TabsTrigger value="integracoes">Integrações</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="visao">
              <OverviewTab
                filters={f.filters}
                dashboard={dashboard.data}
                dashboardLoading={dashboard.isLoading}
                onOpenCreativesTab={() => {
                  setActiveTab("criativos");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </TabsContent>

            <TabsContent value="criativos">
              <CreativesTab filters={f.filters} />
            </TabsContent>

            <TabsContent value="comercial" className="space-y-6">
              {/* Executive KPI Grid: Hero Total + Channel Breakdown */}
              <section className="grid grid-cols-12 gap-4 sm:gap-5">
                <div className="bento-card bento-card-glow col-span-12 flex flex-col justify-between p-6 lg:col-span-6">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                        Total de entradas · Bitrix CRM
                      </p>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{periodLabel}</span>
                    </div>
                    {dashboard.isLoading ? (
                      <Skeleton className="mt-4 h-12 w-40" />
                    ) : (
                      <div className="mt-3 flex flex-wrap items-baseline gap-3">
                        <p className="font-display text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
                          {nfmt(total)}
                        </p>
                        {summary?.variacaoPct != null && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ring-1 ${
                              summary.variacaoPct >= 0
                                ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                                : "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300"
                            }`}
                          >
                            {summary.variacaoPct >= 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" />
                            )}
                            {summary.variacaoPct.toFixed(1)}% vs período anterior
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!dashboard.isLoading && total > 0 && (
                    <div className="mt-5 space-y-2 border-t border-border pt-4">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                        {(["Meta", "Google", "Outros"] as const).map((k) => {
                          const share = ((byOrigem[k] || 0) / total) * 100;
                          if (share <= 0) return null;
                          return (
                            <div
                              key={k}
                              style={{ width: `${share}%`, backgroundColor: COLORS[k] }}
                              title={`${k}: ${nfmt(byOrigem[k] || 0)} (${share.toFixed(1)}%)`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                        {(["Meta", "Google", "Outros"] as const).map((k) => {
                          const share = total > 0 ? ((byOrigem[k] || 0) / total) * 100 : 0;
                          return (
                            <span key={k} className="inline-flex items-center gap-1.5 tabular-nums">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[k] }} />
                              <span className="font-medium text-foreground">{k}</span> {share.toFixed(1)}%
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {(["Meta", "Outros"] as const).map((k) => {
                  const value = byOrigem[k] || 0;
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div
                      key={k}
                      className="bento-card col-span-12 flex flex-col justify-between p-5 sm:col-span-4 lg:col-span-2"
                    >
                      <div className="flex items-center gap-2">
                        {k === "Meta" ? (
                          <MetaIcon className="h-4 w-4 shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[k] }} />
                        )}
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{k}</p>
                      </div>
                      {dashboard.isLoading ? (
                        <Skeleton className="mt-4 h-9 w-20" />
                      ) : (
                        <>
                          <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight text-foreground tabular-nums">
                            {nfmt(value)}
                          </p>
                          <div className="mt-3 h-10 -mx-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dashboard.data?.series ?? []} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                                <Line
                                  type="monotone"
                                  dataKey={k}
                                  stroke={COLORS[k]}
                                  strokeWidth={1.75}
                                  dot={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
                            <span className="font-medium text-foreground tabular-nums">{pct.toFixed(1)}%</span>
                            <span className="text-muted-foreground">participação</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </section>

              {/* Trend over time */}
              <section>
                <Card className="bento-card border-0">
                  <CardHeader className="px-6 pt-6 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tendência</p>
                    <CardTitle className="mt-1 font-display text-lg">Evolução no tempo</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6" style={{ height: 320 }}>
                    {dashboard.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboard.data?.series ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="day" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                          <YAxis fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} width={36} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                          <Line type="monotone" dataKey="Google" stroke={COLORS.Google} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                          <Line type="monotone" dataKey="Meta" stroke={COLORS.Meta} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                          <Line type="monotone" dataKey="Outros" stroke={COLORS.Outros} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid grid-cols-12 gap-5">
                <Card className="bento-card col-span-12 border-0 lg:col-span-6">
                  <CardHeader className="px-6 pt-6 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ranking</p>
                    <CardTitle className="mt-1 font-display text-lg">Melhores anúncios</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6" style={{ height: 400 }}>
                    {dashboard.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (dashboard.data?.ads.length ?? 0) === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de campanha para esta origem</p>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart data={(dashboard.data?.ads ?? []).slice(0, 10)} layout="vertical" margin={{ left: 100, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="label" fontSize={11} width={100} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: "var(--chart-cursor)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p: any = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                                  <p className="text-sm font-semibold">{p.label}</p>
                                  <p className="mt-1 font-medium tabular-nums">{p.count} entradas</p>
                                  {p.campaign && <p className="text-muted-foreground">Campanha: {p.campaign}</p>}
                                  {p.adset && <p className="text-muted-foreground">Adset: {p.adset}</p>}
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="count" fill={CHART.purple} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="bento-card col-span-12 border-0 lg:col-span-6">
                  <CardHeader className="px-6 pt-6 pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ranking</p>
                    <CardTitle className="mt-1 font-display text-lg">Melhores páginas</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6" style={{ height: 400 }}>
                    {dashboard.isLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : (dashboard.data?.pages.length ?? 0) === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">Sem dados</p>
                    ) : (
                      <ResponsiveContainer>
                        <BarChart data={dashboard.data?.pages ?? []} layout="vertical" margin={{ left: 120, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="dominio" fontSize={11} width={120} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                          <Tooltip
                            cursor={{ fill: "var(--chart-cursor)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p: any = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                                  <p className="text-sm font-semibold">{p.dominio}</p>
                                  <p className="mt-1 font-medium tabular-nums">{p.count} entradas</p>
                                  <p className="text-muted-foreground">Origem predominante: {p.origemPredominante}</p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="count" fill={CHART.cyan} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </section>

              <Card className="bento-card border-0">
                <Collapsible defaultOpen>
                  <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tabela detalhada</p>
                      <CardTitle className="mt-1 font-display text-lg">Detalhes por conversão</CardTitle>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="cursor-pointer" aria-label="Alternar detalhes por conversão">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="px-6 pb-6">
                      <Input
                        placeholder="Buscar por título, anúncio ou campanha…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mb-4 h-9 max-w-sm border-border bg-background"
                      />

                      {tableQuery.isLoading ? (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-xl" />
                          ))}
                        </div>
                      ) : (tableQuery.data?.rows.length ?? 0) === 0 ? (
                        <p className="py-12 text-center text-muted-foreground">Nenhuma conversão encontrada</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                          {(["Meta", "Outros"] as const).map((origem) => {
                            const rows = tableQuery.data!.rows.filter((r: any) => {
                              const o = r.origem === "Meta" ? r.origem : "Outros";
                              return o === origem;
                            });
                            return (
                              <div key={origem} className="overflow-hidden rounded-xl border border-border bg-muted/25">
                                <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3.5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    {origem === "Meta" ? (
                                      <MetaIcon className="h-4 w-4 shrink-0" />
                                    ) : (
                                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[origem] }} />
                                    )}
                                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                                      {origem}
                                    </span>
                                  </div>
                                  <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">
                                    {rows.length}
                                  </Badge>
                                </div>
                                <div className="max-h-[420px] space-y-2 overflow-y-auto p-2.5">
                                  {rows.length === 0 ? (
                                    <div className="rounded-lg border border-border/70 bg-card p-4 text-center">
                                      <p className="text-[11px] text-muted-foreground">Sem conversões no período</p>
                                    </div>
                                  ) : (
                                    rows.map((r: any) => (
                                      <div
                                        key={r.bitrix_deal_id}
                                        className="rounded-lg border border-border/80 bg-card p-2.5 transition-colors hover:border-primary/30 hover:bg-muted/30"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                                            {r.titulo || "—"}
                                          </p>
                                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
                                            {r.data_criacao ? new Date(r.data_criacao).toLocaleDateString("pt-BR") : "—"}
                                          </span>
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                          {r.campaign_name && <span className="max-w-full truncate">{r.campaign_name}</span>}
                                          {r.ad_name && <span className="max-w-full truncate">· {r.ad_name}</span>}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p className="mt-4 text-xs text-muted-foreground">
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {tableQuery.data?.total ?? 0}
                        </span>{" "}
                        resultado(s)
                      </p>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </TabsContent>

            <TabsContent value="meta" className="space-y-6">
              {hasBounds ? <MetaUnified filters={f.filters} /> : <p className="text-sm text-muted-foreground">Sem dados sincronizados.</p>}
            </TabsContent>

            <TabsContent value="google" className="space-y-6">
              {hasBounds ? (
                <>
                  <GoogleAdsPerformance filters={f.filters} />
                  <GoogleDomains filters={f.filters} />
                  <DomainComparison filters={f.filters} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados sincronizados.</p>
              )}
            </TabsContent>

            <TabsContent value="funil-bitrix">
              <BitrixFunnelTab filters={f.filters} />
            </TabsContent>

            <TabsContent value="metas">
              <GoalsTab />
            </TabsContent>

            <TabsContent value="tarefas">
              <TasksTab />
            </TabsContent>

            <TabsContent value="integracoes">
              <IntegrationsTab />
            </TabsContent>
          </Tabs>
        )}

        <footer className="pt-6 pb-8 text-center text-[11px] tracking-wider text-muted-foreground uppercase">
          Trive × Alleman Corretora · dados sincronizados em tempo real
        </footer>
      </main>
    </div>
  );
}

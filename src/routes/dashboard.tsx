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
import { LogOut, ChevronDown, RefreshCcw, TrendingDown, TrendingUp, Sparkle, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
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

import allemanLogo from "@/assets/alleman-logo.jpg.asset.json";
import lancersLogo from "@/assets/lancers-logo.png.asset.json";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    const { unlocked } = await isUnlocked();
    if (!unlocked) throw redirect({ to: "/unlock" });
  },
  head: () => ({
    meta: [
      { title: "Alleman Corretora · Painel de Performance" },
      { name: "description", content: "Painel de performance por origem, campanha, anúncio e página." },
      { property: "og:title", content: "Alleman Corretora · Painel de Performance" },
      { property: "og:description", content: "Painel de performance por origem, campanha, anúncio e página." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const COLORS = {
  Google: "oklch(0.78 0.14 230)",
  Meta: "oklch(0.62 0.2 305)",
  Outros: "oklch(0.72 0.03 240)",
};

/** Fuso de referência do negócio: America/Sao_Paulo (UTC-3, sem horário de verão). */
const TZ_OFFSET = "-03:00";

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
  { key: "3d", label: "3d", compute: () => ({ from: todayMinus(2), to: endOfToday() }) },
  { key: "ontem", label: "Ontem", compute: () => ({ from: todayMinus(1), to: endOfDayIso(todayMinus(1)) }) },
  { key: "7d", label: "7d", compute: () => ({ from: todayMinus(6), to: endOfToday() }) },
  { key: "14d", label: "14d", compute: () => ({ from: todayMinus(13), to: endOfToday() }) },
  { key: "30d", label: "30d", compute: () => ({ from: todayMinus(29), to: endOfToday() }) },
  { key: "90d", label: "90d", compute: () => ({ from: todayMinus(89), to: endOfToday() }) },
  {
    key: "mes",
    label: "Este mês",
    compute: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDayIso(first), to: endOfToday() };
    },
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
  const initial = RANGE_PRESETS.find((r) => r.key === "3d")!.compute();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [origem, setOrigem] = useState<string[]>([]);
  const [utm_source, setUtmSource] = useState<string[]>([]);
  const [utm_campaign, setUtmCampaign] = useState<string[]>([]);
  const [dominio, setDominio] = useState<string[]>([]);
  const filters: Filters = { from, to, origem, utm_source, utm_campaign, dominio };
  return {
    filters,
    setFrom, setTo,
    origem, setOrigem,
    utm_source, setUtmSource,
    utm_campaign, setUtmCampaign,
    dominio, setDominio,
  };
}

function MultiSelect({
  label, values, onChange, options,
}: { label: string; values: string[]; onChange: (v: string[]) => void; options: string[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2 bg-card/50 border-white/10 hover:bg-card hover:border-primary/40">
          {label} {values.length > 0 && <Badge variant="secondary">{values.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-80 overflow-auto">
        <div className="space-y-2">
          {options.length === 0 && <p className="text-sm text-muted-foreground">Sem opções</p>}
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
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
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}


function Dashboard() {
  const navigate = useNavigate();
  const f = useFilters();
  const lockFn = useServerFn(lockSite);

  const dashboardFn = useServerFn(getUtmDashboard);
  const tableFn = useServerFn(getConversionsTable);
  const filterOptsFn = useServerFn(getFilterOptions);
  const boundsFn = useServerFn(getUtmDataBounds);

  const filterKey = useMemo(() => JSON.stringify(f.filters), [f.filters]);

  const bounds = useQuery({ queryKey: ["utm-data-bounds"], queryFn: () => boundsFn() });
  const hasBounds = Boolean(bounds.data?.from && bounds.data?.to);

  const dashboard = useQuery({ queryKey: ["utm-dashboard", filterKey], queryFn: () => dashboardFn({ data: f.filters }) });
  const options = useQuery({ queryKey: ["options"], queryFn: () => filterOptsFn() });

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

  const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const nfmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div>
      <div className="min-h-screen bg-background text-foreground" style={{ backgroundImage: "var(--grad-hero)" }}>
        {/* Header */}
        <header className="relative border-b border-white/5 backdrop-blur-md">
          <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {/* Logos side by side */}
                <div className="flex items-center gap-3.5">
                  <img src={allemanLogo.url} alt="Alleman Corretora" className="h-11 md:h-14 w-auto shrink-0 rounded-md bg-white p-0.5" />
                  <span className="h-9 w-px bg-white/15" aria-hidden />
                  <img src={lancersLogo.url} alt="Lancers" className="h-11 md:h-14 w-auto shrink-0" />
                </div>
                <div className="hidden md:block h-8 w-px bg-white/10" aria-hidden />
                <div className="hidden md:flex min-w-0 flex-col justify-center">
                  <h1 className="font-display text-lg font-semibold tracking-tight text-foreground truncate">
                    Painel de tráfego pago
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SyncStatus />
                <ThemeToggle />
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { bounds.refetch(); dashboard.refetch(); tableQuery.refetch(); }}>

                  <RefreshCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={lock}>
                  <LogOut className="h-4 w-4 mr-1" /> Sair
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <div className="flex flex-wrap gap-0.5 rounded-xl border border-white/10 bg-card/40 p-1 backdrop-blur">
                {RANGE_PRESETS.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => applyPreset(r)}
                    className={
                      activePreset === r.key
                        ? "filter-chip filter-chip-active"
                        : "filter-chip hover:text-foreground hover:bg-white/5"
                    }
                  >
                    {r.label}
                  </button>
                ))}
                <button
                  onClick={applyAll}
                  disabled={!hasBounds}
                  className="filter-chip hover:text-foreground hover:bg-white/5 disabled:opacity-40"
                >
                  Tudo
                </button>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-card/40 px-3 text-sm text-foreground backdrop-blur transition hover:border-primary/40 hover:bg-white/5">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span className="tabular-nums">
                      {singleDay
                        ? fmtDay(f.filters.from)
                        : `${fmtDay(f.filters.from)} → ${fmtDay(f.filters.to)}`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border-white/10 bg-popover/95 backdrop-blur-xl">
                  <div className="flex gap-0.5 border-b border-white/10 p-2">
                    <button
                      onClick={() => setSingleDay(false)}
                      className={!singleDay ? "filter-chip filter-chip-active" : "filter-chip hover:text-foreground hover:bg-white/5"}
                    >
                      Período
                    </button>
                    <button
                      onClick={() => {
                        setSingleDay(true);
                        setDay(localDay(f.filters.to));
                      }}
                      className={singleDay ? "filter-chip filter-chip-active" : "filter-chip hover:text-foreground hover:bg-white/5"}
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
                      numberOfMonths={2}
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



              {/* Desktop: filtros inline */}
              <div className="hidden flex-wrap gap-1.5 md:flex">
                <MultiSelect label="Canal" values={f.origem} onChange={f.setOrigem} options={options.data?.origem ?? []} />
                <MultiSelect label="UTM Source" values={f.utm_source} onChange={f.setUtmSource} options={options.data?.utm_source ?? []} />
                <MultiSelect label="Campanha" values={f.utm_campaign} onChange={f.setUtmCampaign} options={options.data?.utm_campaign ?? []} />
                <MultiSelect label="Domínio" values={f.dominio} onChange={f.setDominio} options={options.data?.dominio ?? []} />
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Operadora e Região aguardam integração com o sistema comercial"
                  className="border-white/10 bg-card/40 text-muted-foreground"
                >
                  Operadora / Região
                </Button>
              </div>

              {/* Mobile: filtros dentro de um botão */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-white/10 bg-card/50 md:hidden">
                    Filtros
                    {(f.origem.length + f.utm_source.length + f.utm_campaign.length + f.dominio.length) > 0 && (
                      <Badge variant="secondary" className="ml-1.5">
                        {f.origem.length + f.utm_source.length + f.utm_campaign.length + f.dominio.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 space-y-2">
                  <MultiSelect label="Canal" values={f.origem} onChange={f.setOrigem} options={options.data?.origem ?? []} />
                  <MultiSelect label="UTM Source" values={f.utm_source} onChange={f.setUtmSource} options={options.data?.utm_source ?? []} />
                  <MultiSelect label="Campanha" values={f.utm_campaign} onChange={f.setUtmCampaign} options={options.data?.utm_campaign ?? []} />
                  <MultiSelect label="Domínio" values={f.dominio} onChange={f.setDominio} options={options.data?.dominio ?? []} />
                  <p className="text-[11px] text-muted-foreground/70">Operadora e Região aguardam integração.</p>
                </PopoverContent>
              </Popover>
            </div>

            {/* Seleção de campanha individual */}
            <div className="mt-3">
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
          <div className="pointer-events-none absolute inset-0 grid-noise opacity-20" aria-hidden />
        </header>

        <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 md:py-8">
          {campaign.length === 1 ? (
            <CampaignDetailView selection={campaign[0]!} from={f.filters.from} to={f.filters.to} />
          ) : campaign.length > 1 ? (
            <CampaignComparison selection={campaign} from={f.filters.from} to={f.filters.to} />
          ) : (
          <Tabs defaultValue="visao" className="space-y-6">
            <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-card/40 p-1">
<TabsTrigger value="visao">Visão geral</TabsTrigger>
              <TabsTrigger value="meta">
                <MetaIcon className="h-5 w-5" /> Meta Ads
              </TabsTrigger>
              <TabsTrigger value="google">
                <GoogleAdsIcon className="h-5 w-5" /> Google Ads
              </TabsTrigger>
              <TabsTrigger value="comercial">Comercial</TabsTrigger>
              <TabsTrigger value="metas">Metas</TabsTrigger>
              <TabsTrigger value="integracoes">Integrações</TabsTrigger>
            </TabsList>

            <TabsContent value="visao">
              <OverviewTab filters={f.filters} dashboard={dashboard.data} dashboardLoading={dashboard.isLoading} />
            </TabsContent>

            <TabsContent value="comercial" className="space-y-6">
          {/* Bento grid: hero KPI + secondary metrics */}
          <section className="grid grid-cols-12 gap-5">
            {/* Hero total */}
            <div className="bento-card bento-card-glow col-span-12 md:col-span-6 lg:col-span-5 p-8 relative">
              <div className="absolute inset-0 grid-noise opacity-15 pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="flex items-center gap-2 text-primary/80">
                  <Sparkle className="h-3.5 w-3.5" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em]">Total de entradas</p>
                </div>
                {dashboard.isLoading ? (
                  <Skeleton className="h-20 w-48 mt-4" />
                ) : (
                  <p className="font-display text-7xl md:text-[5.5rem] font-bold tracking-[-0.04em] leading-none mt-4 bg-clip-text text-transparent" style={{ backgroundImage: "var(--grad-accent)" }}>
                    {nfmt(total)}
                  </p>
                )}
                {summary?.variacaoPct != null && (
                  <div className={`inline-flex items-center gap-1.5 mt-5 px-2.5 py-1 rounded-full text-xs font-medium ${summary.variacaoPct >= 0 ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20" : "bg-red-500/10 text-red-300 ring-1 ring-red-500/20"}`}>
                    {summary.variacaoPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {summary.variacaoPct.toFixed(1)}% vs período anterior
                  </div>
                )}
              </div>
            </div>

            {/* Origins */}
            {(["Google", "Meta", "Outros"] as const).map((k) => {
              const value = byOrigem[k] || 0;
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={k} className="bento-card col-span-6 md:col-span-2 lg:col-span-2 p-6 group hover:-translate-y-0.5 hover:border-primary/25">
<div className="flex items-center gap-2">
                    {k === "Google" ? (
                      <GoogleAdsIcon className="h-4.5 w-4.5 shrink-0" />
                    ) : k === "Meta" ? (
                      <MetaIcon className="h-4.5 w-4.5 shrink-0" />
                    ) : (
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[k], boxShadow: `0 0 12px ${COLORS[k]}` }} />
                    )}
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{k}</p>
                  </div>
                  {dashboard.isLoading ? (
                    <Skeleton className="h-9 w-20 mt-4" />
                  ) : (
                    <>
                      <p className="font-display text-4xl font-bold mt-3 tracking-[-0.03em] leading-none tabular-nums">{nfmt(value)}</p>
                      <div className="mt-4 h-10 -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dashboard.data?.series ?? []} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <defs>
                              <linearGradient id={`spark-${k}`} x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={COLORS[k]} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={COLORS[k]} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Line type="monotone" dataKey={k} stroke={COLORS[k]} strokeWidth={1.75} dot={false} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground font-medium tabular-nums">{pct.toFixed(1)}%</span>
                        <span className="text-muted-foreground/60">do total</span>
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
              <CardHeader className="pb-2 pt-6 px-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tendência</p>
                <CardTitle className="font-display text-lg mt-1">Evolução no tempo</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6" style={{ height: 320 }}>
                {dashboard.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboard.data?.series ?? []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="glow-google" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.Google} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={COLORS.Google} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                      <XAxis dataKey="day" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} width={36} />
                      <Tooltip contentStyle={{ background: "oklch(0.19 0.035 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 10, color: "oklch(0.97 0.005 240)", fontSize: 12, padding: "8px 12px" }} cursor={{ stroke: "oklch(1 0 0 / 0.1)", strokeWidth: 1 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                      <Line type="monotone" dataKey="Google" stroke={COLORS.Google} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="Meta" stroke={COLORS.Meta} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="Outros" stroke={COLORS.Outros} strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-12 gap-5">
            <Card className="col-span-12 lg:col-span-6 bento-card border-0">
              <CardHeader className="pt-6 px-6 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ranking</p>
                <CardTitle className="font-display text-lg mt-1">Melhores anúncios</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6" style={{ height: 400 }}>
                {dashboard.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (dashboard.data?.ads.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de campanha para esta origem</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={(dashboard.data?.ads ?? []).slice(0, 10)} layout="vertical" margin={{ left: 100, right: 12 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.04)" horizontal={false} />
                      <XAxis type="number" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" fontSize={11} width={100} stroke="oklch(0.72 0.03 240)" tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: "oklch(1 0 0 / 0.03)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p: any = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-2xl">
                              <p className="font-semibold text-sm">{p.label}</p>
                              <p className="mt-1">{p.count} entradas</p>
                              {p.campaign && <p className="text-muted-foreground">Campanha: {p.campaign}</p>}
                              {p.adset && <p className="text-muted-foreground">Adset: {p.adset}</p>}
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" fill="oklch(0.62 0.2 305)" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-12 lg:col-span-6 bento-card border-0">
              <CardHeader className="pt-6 px-6 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Ranking</p>
                <CardTitle className="font-display text-lg mt-1">Melhores páginas</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6" style={{ height: 400 }}>
                {dashboard.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (dashboard.data?.pages.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={dashboard.data?.pages ?? []} layout="vertical" margin={{ left: 120, right: 12 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.04)" horizontal={false} />
                      <XAxis type="number" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="dominio" fontSize={11} width={120} stroke="oklch(0.72 0.03 240)" tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: "oklch(1 0 0 / 0.03)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p: any = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-white/10 bg-popover p-3 text-xs shadow-2xl">
                              <p className="font-semibold text-sm">{p.dominio}</p>
                              <p className="mt-1">{p.count} entradas</p>
                              <p className="text-muted-foreground">Origem predominante: {p.origemPredominante}</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" fill="oklch(0.7 0.19 305)" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </section>


          <Card className="bento-card border-0">
            <Collapsible defaultOpen>
              <CardHeader className="flex flex-row items-center justify-between pt-6 px-6 pb-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tabela detalhada</p>
                  <CardTitle className="font-display text-lg mt-1">Detalhes por conversão</CardTitle>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-white/5">
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
                    className="mb-4 max-w-sm h-9 bg-card/40 border-white/10 focus-visible:ring-primary/30"
                  />

                  {tableQuery.isLoading ? (
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (tableQuery.data?.rows.length ?? 0) === 0 ? (
                    <p className="text-center text-muted-foreground py-12">Nenhuma conversão encontrada</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {(["Google", "Meta", "Outros"] as const).map((origem) => {
                        const rows = tableQuery.data!.rows.filter((r: any) => {
                          const o = r.origem === "Google" || r.origem === "Meta" ? r.origem : "Outros";
                          return o === origem;
                        });
                        return (
                          <div key={origem} className="rounded-xl border border-white/5 bg-card/30 overflow-hidden">
                            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between" style={{ backgroundColor: `${COLORS[origem]}15` }}>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[origem], boxShadow: `0 0 10px ${COLORS[origem]}` }} />
                                <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: COLORS[origem] }}>{origem}</span>
                              </div>
                              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{rows.length}</span>
                            </div>
                            <div className="max-h-[420px] overflow-y-auto p-2 space-y-2">
                              {rows.length === 0 ? (
                                <div className="rounded-lg border border-white/5 bg-card/40 p-4 text-center">
                                  <p className="text-[11px] text-muted-foreground">Sem conversões no período</p>
                                </div>
                              ) : (
                                rows.map((r: any) => (
                                  <div key={r.bitrix_deal_id} className="rounded-lg border border-white/5 bg-card/40 p-2.5 hover:bg-white/5 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-medium text-foreground/90 leading-tight line-clamp-2">{r.titulo || "—"}</p>
                                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">{r.data_criacao ? new Date(r.data_criacao).toLocaleDateString("pt-BR") : "—"}</span>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                                      {r.campaign_name && <span className="truncate max-w-full">{r.campaign_name}</span>}
                                      {r.ad_name && <span className="truncate max-w-full">{r.ad_name}</span>}
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

                  <p className="mt-4 text-muted-foreground text-xs">
                    <span className="font-mono tabular-nums text-foreground/80">{tableQuery.data?.total ?? 0}</span> resultado(s)
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

            <TabsContent value="metas">
              <GoalsTab />
            </TabsContent>

            <TabsContent value="integracoes">
              <IntegrationsTab />
            </TabsContent>
          </Tabs>
          )}


          <footer className="pt-4 pb-8 text-center text-[11px] text-muted-foreground/60 tracking-wider uppercase">
            Alleman Corretora × Lancers · dados sincronizados em tempo real
          </footer>
        </main>
      </div>
    </div>
  );
}

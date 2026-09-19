import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaPerformance } from "@/lib/meta.functions";
import { getGoogleAdsPerformance } from "@/lib/google-ads.functions";
import { getSyncStatus } from "@/lib/sync-status.functions";
import type { Filters } from "@/lib/utm.functions";
import { ExecutiveKpis, type Kpi } from "./ExecutiveKpis";
import { InvestLeadsChart } from "./InvestLeadsChart";
import { CommercialFunnel } from "./CommercialFunnel";
import { LeadGoals } from "./LeadGoals";
import { ChannelComparison, type ChannelRow } from "./ChannelComparison";
import { IntegrationsHealth, type IntegrationRow } from "./IntegrationsHealth";
import { CampaignsPerformance, type CampaignRow } from "./CampaignsPerformance";
import { CHART, currency, nfmt, operadoraFromCampaign, variation } from "@/lib/dashboard-utils";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

type DashboardData = {
  summary: { total: number; valorTotal: number; byOrigem: Record<string, number>; totalPrev: number; variacaoPct: number | null };
  series: Array<{ day: string; Google: number; Meta: number; Outros: number }>;
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bento-card p-5 ${className}`}>{children}</div>;
}

function prevRange(from: string, to: string) {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  const dur = Math.max(t - f, 1);
  return { from: new Date(f - dur).toISOString(), to: new Date(t - dur).toISOString() };
}

function fmtDateTime(v: string | null | undefined) {
  return v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "—";
}

function hoursSince(v: string | null | undefined) {
  if (!v) return null;
  return (Date.now() - new Date(v).getTime()) / 3_600_000;
}

export function OverviewTab({
  filters,
  dashboard,
  dashboardLoading,
}: {
  filters: Filters;
  dashboard?: DashboardData;
  dashboardLoading?: boolean;
}) {
  const perfFn = useServerFn(getMetaPerformance);
  const googleFn = useServerFn(getGoogleAdsPerformance);
  const syncFn = useServerFn(getSyncStatus);
  const metaEnabled = !filters.origem?.length || filters.origem.includes("Meta");
  const googleEnabled = !filters.origem?.length || filters.origem.includes("Google");

  const perf = useQuery({
    queryKey: ["meta-performance", filters.from, filters.to],
    queryFn: () => perfFn({ data: { from: filters.from, to: filters.to } }),
  });

  const prev = useMemo(() => prevRange(filters.from, filters.to), [filters.from, filters.to]);
  const perfPrev = useQuery({
    queryKey: ["meta-performance", prev.from, prev.to],
    queryFn: () => perfFn({ data: prev }),
  });

  const google = useQuery({
    queryKey: ["google-ads-performance", filters.from, filters.to],
    queryFn: () => googleFn({ data: { from: filters.from, to: filters.to } }),
    enabled: googleEnabled,
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });
  const googlePrev = useQuery({
    queryKey: ["google-ads-performance", prev.from, prev.to],
    queryFn: () => googleFn({ data: prev }),
    enabled: googleEnabled,
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const sync = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      try {
        return await syncFn();
      } catch {
        return null;
      }
    },
    retry: false,
    refetchInterval: 120_000,
  });

  const leadsTotal = dashboard?.summary.total ?? 0;
  const byOrigemK = dashboard?.summary.byOrigem ?? {};
  const metaLeads = byOrigemK["Meta"] ?? 0;
  const googleLeads = byOrigemK["Google"] ?? 0;
  const otherLeads = byOrigemK["Outros"] ?? 0;
  const googleHasData = Boolean(
    google.data &&
      (google.data.summary.spend > 0 ||
        google.data.summary.impressions > 0 ||
        google.data.summary.clicks > 0 ||
        google.data.summary.conversions > 0),
  );
  const paidLeads = metaLeads + (googleHasData ? googleLeads : 0);
  const metaSpend = metaEnabled ? perf.data?.summary.spend ?? 0 : 0;
  const metaSpendPrev = metaEnabled ? perfPrev.data?.summary.spend ?? 0 : 0;
  const googleSpend = googleEnabled && googleHasData ? google.data?.summary.spend ?? 0 : 0;
  const googleSpendPrev = googleEnabled && googleHasData ? googlePrev.data?.summary.spend ?? 0 : 0;
  const spend = metaSpend + googleSpend;
  const spendPrev = metaSpendPrev + googleSpendPrev;
  const cpl = paidLeads > 0 && spend > 0 ? spend / paidLeads : null;

  const series = dashboard?.series ?? [];
  const leadsByDay = useMemo(
    () => series.map((s) => ({ day: s.day, leads: (s.Meta || 0) + (googleHasData ? s.Google || 0 : 0) })),
    [series, googleHasData],
  );

  const investLeads = useMemo(() => {
    const map = new Map<string, { day: string; spend: number; leads: number }>();
    for (const r of perf.data?.daily ?? []) map.set(r.day, { day: r.day, spend: Number(r.spend || 0), leads: 0 });
    if (googleHasData) {
      for (const r of google.data?.daily ?? []) {
        const e = map.get(r.day) ?? { day: r.day, spend: 0, leads: 0 };
        e.spend += Number(r.spend || 0);
        map.set(r.day, e);
      }
    }
    for (const r of leadsByDay) {
      const e = map.get(r.day) ?? { day: r.day, spend: 0, leads: 0 };
      e.leads = r.leads;
      map.set(r.day, e);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [perf.data?.daily, google.data?.daily, googleHasData, leadsByDay]);

  const metaCpl = metaLeads > 0 && metaSpend > 0 ? metaSpend / metaLeads : null;
  const googleCpl = googleLeads > 0 && googleSpend > 0 ? googleSpend / googleLeads : null;
  const googleLoading = google.isLoading;
  const googleRetrievedAt = google.data?.retrievedAt;

  const kpisGeral: Kpi[] = [
    {
      key: "invest",
      label: "Investimento geral",
      value: perf.isLoading || googleLoading ? "…" : currency(spend),
      variation: variation(spend, spendPrev),
      trend: investLeads.map((d) => ({ v: d.spend })),
      color: CHART.cyan,
      hint: googleHasData ? "Meta Ads + Google Ads" : "Meta Ads · Google aguardando conexão",
    },
    {
      key: "leads",
      label: "Leads de mídia paga",
      value: nfmt(paidLeads),
      variation: null,
      trend: leadsByDay.map((d) => ({ v: d.leads })),
      color: CHART.purple,
    },
    {
      key: "cpl",
      label: "CPL geral",
      value: cpl == null ? null : currency(cpl),
      variation: null,
      trend: investLeads.map((d) => ({ v: d.leads > 0 ? d.spend / d.leads : 0 })),
      color: CHART.cyan,
      hint: googleHasData ? "investimento Meta + Google ÷ leads Meta + Google" : "investimento Meta ÷ leads Meta",
    },
  ];

  const kpisMeta: Kpi[] = [
    {
      key: "meta-invest",
      label: "Meta · Investimento",
      value: perf.isLoading ? "…" : currency(metaSpend),
      variation: variation(metaSpend, metaSpendPrev),
      trend: (perf.data?.daily ?? []).map((d) => ({ v: Number(d.spend || 0) })),
      color: CHART.purple,
    },
    {
      key: "meta-leads",
      label: "Meta · Leads gerados",
      value: nfmt(metaLeads),
      variation: null,
      trend: [],
      color: CHART.purple,
    },
    {
      key: "meta-cpl",
      label: "Meta · CPL",
      value: metaCpl == null ? null : currency(metaCpl),
      variation: null,
      color: CHART.purple,
      hint: "precisa de investimento e leads Meta no período",
    },
  ];

  const kpisGoogle: Kpi[] = [
    {
      key: "google-invest",
      label: "Google · Investimento",
      value: googleLoading ? "…" : googleHasData ? currency(googleSpend) : null,
      variation: googleHasData ? variation(googleSpend, googleSpendPrev) : null,
      trend: (google.data?.daily ?? []).map((d) => ({ v: Number(d.spend || 0) })),
      color: CHART.cyan,
      hint: google.isError ? "falha ao consultar a conta conectada" : "dados da conta Google Ads",
    },
    {
      key: "google-leads",
      label: "Google · Leads gerados",
      value: nfmt(googleLeads),
      variation: null,
      color: CHART.cyan,
      hint: "leads classificados como Google no CRM",
    },
    {
      key: "google-cpl",
      label: "Google · CPL",
      value: googleCpl == null ? null : currency(googleCpl),
      variation: null,
      color: CHART.cyan,
      hint: google.isError ? "investimento do Google indisponível" : "investimento ÷ leads Google no CRM",
    },
  ];

  const kpisOutros: Kpi[] = [
    {
      key: "other-leads",
      label: "Outros · Leads gerados",
      value: nfmt(otherLeads),
      variation: null,
      trend: series.map((d) => ({ v: d.Outros || 0 })),
      color: CHART.grey,
    },
  ];


  const funnel = [
    { label: "Leads", value: leadsTotal },
    { label: "Leads válidos", value: leadsTotal },
    { label: "Contatados", value: null },
    { label: "Cotações", value: null },
    { label: "Contratos", value: null },
    { label: "Vidas", value: null },
  ];


  const byOrigem = dashboard?.summary.byOrigem ?? {};
  const channels: ChannelRow[] = [
    {
      canal: "Meta Ads",
      color: CHART.purple,
      spend: metaSpend,
      leads: byOrigem["Meta"] ?? 0,
      cpl: (byOrigem["Meta"] ?? 0) > 0 && metaSpend > 0 ? metaSpend / (byOrigem["Meta"] ?? 1) : null,
      contratos: null, conversao: null, roas: null,
    },
    {
      canal: "Google Ads",
      color: CHART.cyan,
      spend: googleHasData ? googleSpend : null,
      leads: byOrigem["Google"] ?? 0,
      cpl: googleHasData ? googleCpl : null,
      contratos: null, conversao: null, roas: null,
    },
  ].filter((row) => row.canal !== "Google Ads" || googleHasData);

  const bitrixHours = hoursSince(sync.data?.bitrix_last_run);
  const metaHours = hoursSince(sync.data?.meta_last_run);
  const integrations: IntegrationRow[] = [
    {
      name: "Meta Ads",
      status: sync.data?.meta_last_run == null ? "unknown" : sync.data.meta_last_status === "ok" && (metaHours ?? 99) < 24 ? "ok" : "warn",
      statusLabel:
        sync.data?.meta_last_run == null
          ? "Status indisponível"
          : sync.data.meta_last_status === "ok" && (metaHours ?? 99) < 24
            ? "Conectado"
            : "Atenção",
      lastSync: fmtDateTime(sync.data?.meta_last_run),
      note: sync.data?.meta_last_status && sync.data.meta_last_status !== "ok" ? sync.data.meta_last_status : "—",
    },
    {
      name: "Bitrix",
      status: sync.data?.bitrix_last_run == null ? "unknown" : sync.data.bitrix_last_status === "ok" && (bitrixHours ?? 99) < 24 ? "ok" : "error",
      statusLabel:
        sync.data?.bitrix_last_run == null
          ? "Status indisponível"
          : sync.data.bitrix_last_status === "ok" && (bitrixHours ?? 99) < 24
            ? "Conectado"
            : "Atenção",
      lastSync: fmtDateTime(sync.data?.bitrix_last_run),
      note: sync.data?.last_lead_created_at ? `Último lead: ${fmtDateTime(sync.data.last_lead_created_at)}` : "—",
    },
    {
      name: "Google Ads",
      status: google.isError ? "error" : googleHasData ? "ok" : "unknown",
      statusLabel: google.isError ? "Atenção" : googleHasData ? "Conectado" : "Aguardando conexão",
      lastSync: googleHasData && googleRetrievedAt ? fmtDateTime(googleRetrievedAt) : "—",
      note: google.isError ? "Falha na leitura da conta" : googleHasData ? "Leitura direta da conta" : "Sem dados disponíveis",
    },
    { name: "Sistema comercial (AGSI)", status: "unknown", statusLabel: "Status indisponível", lastSync: "—", note: "Integração não configurada" },
  ];

  const crmByCampaign = useMemo(() => {
    const map = new Map<string, CampaignCrmRow>();
    for (const r of crm.data?.byCampaign ?? []) map.set(r.campaign_id, r);
    return map;
  }, [crm.data?.byCampaign]);

  const campaigns: CampaignRow[] = useMemo(() => {
    const metaRows: CampaignRow[] = (perf.data?.byCampaign ?? []).map((c) => ({
        campanha: c.campaign_name,
        operadora: operadoraFromCampaign(c.campaign_name),
        canal: "Meta Ads",
        spend: Number(c.spend || 0),
        leads: Number(c.leads || 0),
        cpl: c.cpl ?? null,
        contratos: null, vidas: null, conversao: null, receita: null, roas: null,
        status: c.status ?? null,
        campaignId: c.campaign_id,
        crm: crmByCampaign.get(c.campaign_id) ?? null,
      }));
    const googleRows: CampaignRow[] = (google.data?.campaigns ?? []).map((c) => ({
      campanha: c.campaignName,
      operadora: operadoraFromCampaign(c.campaignName),
      canal: "Google Ads (atribuído)",
      spend: c.spend,
      leads: c.conversions,
      cpl: c.costPerConversion,
      contratos: null, vidas: null, conversao: null, receita: null, roas: null,
      status: c.status,
      campaignId: null,
      crm: null,
    }));
    const naoIdent = crmByCampaign.get("__none__");
    const unmatched: CampaignRow[] = naoIdent
      ? [{
          campanha: "Campanha não identificada",
          operadora: "—",
          canal: "Sem campanha",
          spend: null,
          leads: 0,
          cpl: null,
          contratos: null, vidas: null, conversao: null, receita: null, roas: null,
          status: null,
          campaignId: "__none__",
          crm: naoIdent,
        }]
      : [];
    return [...metaRows, ...googleRows, ...unmatched];
  }, [perf.data?.byCampaign, google.data?.campaigns, crmByCampaign]);


  return (
    <div className="space-y-5">
      <Panel>
        <h3 className="mb-4 font-display text-[15px] font-semibold">Visão executiva</h3>
        <div className="space-y-4">
<div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3 sm:p-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" /> Geral · cenário
            </p>
            <ExecutiveKpis kpis={kpisGeral} loading={dashboardLoading || perf.isLoading || googleLoading} />
          </div>
<div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              <MetaIcon className="h-4.5 w-4.5" /> Meta Ads
            </p>
            <ExecutiveKpis kpis={kpisMeta} loading={dashboardLoading || perf.isLoading} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              <GoogleAdsIcon className="h-4.5 w-4.5" /> Google Ads
            </p>
            {dashboardLoading || googleLoading ? (
              <ExecutiveKpis kpis={kpisGoogle} loading />
            ) : googleHasData ? (
              <ExecutiveKpis kpis={kpisGoogle} />
            ) : (
              <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">Aguardando conexão</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Os indicadores aparecerão quando houver dados do Google Ads.</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Sem dados
                </span>
              </div>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
              Outros
            </p>
            <ExecutiveKpis kpis={kpisOutros} loading={dashboardLoading} />
          </div>
        </div>
      </Panel>


      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel>
          <InvestLeadsChart rows={investLeads} loading={dashboardLoading || perf.isLoading || googleLoading} />
        </Panel>
        <Panel>
          <h3 className="mb-4 font-display text-[15px] font-semibold">Funil comercial</h3>
          <CommercialFunnel stages={funnel} loading={dashboardLoading} />
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Etapas comerciais (contatados, cotações, contratos, vidas) aguardam integração.
          </p>
        </Panel>
      </div>

      <LeadGoals />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-3 font-display text-[15px] font-semibold">Comparativo por canal</h3>
          <ChannelComparison rows={channels} />
        </Panel>
        <Panel>
          <h3 className="mb-3 font-display text-[15px] font-semibold">Saúde das integrações</h3>
          <IntegrationsHealth rows={integrations} />
        </Panel>
      </div>

      <Panel>
        <CampaignsPerformance rows={campaigns} loading={perf.isLoading || googleLoading} error={perf.isError && google.isError} />
      </Panel>
    </div>
  );
}

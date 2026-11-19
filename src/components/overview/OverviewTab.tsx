import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaPerformance } from "@/lib/meta.functions";
import { getSyncStatus } from "@/lib/sync-status.functions";
import { getCampaignCrmFunnel, type CampaignCrmRow } from "@/lib/crm-funnel.functions";
import { getFunnelCohort, type FunnelCohort } from "@/lib/bitrix-funnel.functions";
import type { Filters } from "@/lib/utm.functions";
import { ExecutiveKpis, type Kpi } from "./ExecutiveKpis";
import { InvestLeadsChart } from "./InvestLeadsChart";
import { CommercialFunnel, type FunnelStage } from "./CommercialFunnel";
import { LeadGoals } from "./LeadGoals";
import { ChannelComparison, type ChannelRow } from "./ChannelComparison";
import { IntegrationsHealth, type IntegrationRow } from "./IntegrationsHealth";
import { CampaignsPerformance, type CampaignRow } from "./CampaignsPerformance";
import { CreativesCard } from "./CreativesCard";
import { InvestmentCard } from "./InvestmentCard";
import { CampaignActivityCard } from "./CampaignActivityCard";
import { CampaignLeadsDrawer } from "./CampaignLeadsDrawer";
import { StrategiesCard } from "./StrategiesCard";
import { CHART, currency, nfmt, operadoraFromCampaign, variation } from "@/lib/dashboard-utils";
import { MetaIcon } from "@/components/brand-icons";

type DashboardData = {
  summary: {
    total: number;
    valorTotal: number;
    byOrigem: Record<string, number>;
    totalPrev: number;
    variacaoPct: number | null;
  };
  series: Array<{ day: string; Google: number; Meta: number; Outros: number }>;
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`bento-card p-5 sm:p-6 ${className}`}>{children}</section>;
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
      <h3 className="mt-0.5 font-display text-base font-semibold tracking-tight text-foreground">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
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
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
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
  onOpenCreativesTab,
}: {
  filters: Filters;
  dashboard?: DashboardData;
  dashboardLoading?: boolean;
  onOpenCreativesTab?: () => void;
}) {
  const perfFn = useServerFn(getMetaPerformance);
  const syncFn = useServerFn(getSyncStatus);
  const crmFn = useServerFn(getCampaignCrmFunnel);
  const [selected, setSelected] = useState<CampaignRow | null>(null);
  const metaEnabled = !filters.origem?.length || filters.origem.includes("Meta");

  const perf = useQuery({
    queryKey: ["meta-performance", filters.from, filters.to],
    queryFn: () => perfFn({ data: { from: filters.from, to: filters.to } }),
  });

  const prev = useMemo(() => prevRange(filters.from, filters.to), [filters.from, filters.to]);
  const perfPrev = useQuery({
    queryKey: ["meta-performance", prev.from, prev.to],
    queryFn: () => perfFn({ data: prev }),
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

  const crm = useQuery({
    queryKey: ["campaign-crm-funnel", filters.from, filters.to],
    queryFn: () => crmFn({ data: { from: filters.from, to: filters.to } }),
    retry: false,
  });

  // Funil comercial real: coorte dos leads criados no período, cumulativa por etapa
  const cohortFn = useServerFn(getFunnelCohort);
  const cohort = useQuery({
    queryKey: ["overview-funnel-cohort", filters.from, filters.to],
    queryFn: () => cohortFn({ data: { from: filters.from, to: filters.to } }),
    staleTime: 60_000,
    retry: false,
  });

  const leadsTotal = dashboard?.summary.total ?? 0;
  const byOrigemK = dashboard?.summary.byOrigem ?? {};
  const metaLeads = leadsTotal; // todo lead da base é de origem Meta (alleman insta)
  const metaSpend = metaEnabled ? perf.data?.summary.spend ?? 0 : 0;
  const metaSpendPrev = metaEnabled ? perfPrev.data?.summary.spend ?? 0 : 0;

  const series = dashboard?.series ?? [];
  const leadsByDay = useMemo(
    () => series.map((s) => ({ day: s.day, leads: s.Meta || 0 })),
    [series],
  );

  const investLeads = useMemo(() => {
    const map = new Map<string, { day: string; spend: number; leads: number }>();
    for (const r of perf.data?.daily ?? []) map.set(r.day, { day: r.day, spend: Number(r.spend || 0), leads: 0 });
    for (const r of leadsByDay) {
      const e = map.get(r.day) ?? { day: r.day, spend: 0, leads: 0 };
      e.leads = r.leads;
      map.set(r.day, e);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [perf.data?.daily, leadsByDay]);

  const metaCpl = metaLeads > 0 && metaSpend > 0 ? metaSpend / metaLeads : null;

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

  // Funil comercial com números reais do Bitrix (coorte cumulativa):
  // novo → qualificado → tentativa → contatado → negociação → venda.
  const funnel = useMemo<FunnelStage[]>(() => {
    const etapas = cohort.data?.etapas ?? [];
    const byRank = new Map(etapas.map((e) => [e.etapa, e.total]));
    const coorte = cohort.data?.coorte.reduce((acc, c) => acc + c.leads, 0) ?? null;
    return [
      { label: "Leads", value: coorte },
      { label: "Qualificados", value: coorte == null ? null : byRank.get("qualificado") ?? 0 },
      { label: "Tentativa de contato", value: coorte == null ? null : byRank.get("tentativa") ?? 0 },
      { label: "Contatados", value: coorte == null ? null : byRank.get("contatado") ?? 0 },
      { label: "Negociação", value: coorte == null ? null : byRank.get("negociacao") ?? 0 },
      { label: "Vendas", value: coorte == null ? null : byRank.get("venda") ?? 0 },
    ];
  }, [cohort.data]);

  const byOrigem = dashboard?.summary.byOrigem ?? {};
  const channels: ChannelRow[] = [
    {
      canal: "Meta Ads",
      color: CHART.purple,
      spend: metaSpend,
      leads: byOrigem["Meta"] ?? 0,
      cpl: (byOrigem["Meta"] ?? 0) > 0 && metaSpend > 0 ? metaSpend / (byOrigem["Meta"] ?? 1) : null,
      contratos: null,
      conversao: null,
      roas: null,
    },
  ];

  const bitrixHours = hoursSince(sync.data?.bitrix_last_run);
  const metaHours = hoursSince(sync.data?.meta_last_run);
  const integrations: IntegrationRow[] = [
    {
      name: "Meta Ads",
      status:
        sync.data?.meta_last_run == null
          ? "unknown"
          : sync.data.meta_last_status === "ok" && (metaHours ?? 99) < 24
            ? "ok"
            : "warn",
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
      status:
        sync.data?.bitrix_last_run == null
          ? "unknown"
          : sync.data.bitrix_last_status === "ok" && (bitrixHours ?? 99) < 24
            ? "ok"
            : "error",
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
      name: "Sistema comercial (AGSI)",
      status: "unknown",
      statusLabel: "Status indisponível",
      lastSync: "—",
      note: "Integração não configurada",
    },
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
      contratos: null,
      vidas: null,
      conversao: null,
      receita: null,
      roas: null,
      status: c.status ?? null,
      campaignId: c.campaign_id,
      crm: crmByCampaign.get(c.campaign_id) ?? null,
    }));
    const naoIdent = crmByCampaign.get("__none__");
    const unmatched: CampaignRow[] = naoIdent
      ? [
          {
            campanha: "Campanha não identificada",
            operadora: "—",
            canal: "Sem campanha",
            spend: null,
            leads: 0,
            cpl: null,
            contratos: null,
            vidas: null,
            conversao: null,
            receita: null,
            roas: null,
            status: null,
            campaignId: "__none__",
            crm: naoIdent,
          },
        ]
      : [];
    return [...metaRows, ...unmatched];
  }, [perf.data?.byCampaign, crmByCampaign]);

  const loading = dashboardLoading || perf.isLoading || crm.isLoading;

  return (
    <div className="space-y-6">
      {/* 1. Síntese Executiva */}
      <Panel>
        <SectionHeading
          eyebrow="Síntese Executiva"
          title="Indicadores consolidados de aquisição"
          description="Eficiência global de investimento em mídia paga cruzada com leads registrados no Bitrix CRM."
        />
        <div className="space-y-4">
          <CampaignActivityCard className="border-l-3 border-primary/40 bg-muted/30 mt-3" />

          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5 sm:p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" /> Meta Ads · Investimento & Leads
            </p>
            <ExecutiveKpis kpis={kpisMeta} loading={loading} />
            <div className="mt-3">
              <InvestmentCard />
            </div>
          </div>
        </div>
      </Panel>

      {/* 2. Ritmo Temporal & Funil Comercial */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel>
          <InvestLeadsChart rows={investLeads} loading={loading} />
        </Panel>
        <Panel className="flex flex-col justify-between">
          <div>
            <SectionHeading
              eyebrow="Conversão Comercial"
              title="Funil comercial"
              description="Coorte dos leads criados no período — até onde cada um chegou no Bitrix."
            />
            <CommercialFunnel stages={funnel} loading={dashboardLoading || cohort.isLoading} />
          </div>
          <p className="mt-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
            Medição cumulativa do funil Comercial do Bitrix: o cartão pode pular etapas, então
            "chegou" conta a etapa e todas as anteriores.{cohort.data?.sem_historico
              ? ` ${cohort.data.sem_historico} leads sem histórico de etapas ficam fora da taxa.`
              : ""}
          </p>
        </Panel>
      </div>

      {/* 3. Criativos & Metas Operacionais */}
      <CreativesCard
        filters={{ from: filters.from, to: filters.to }}
        onOpenCreativesTab={onOpenCreativesTab}
      />
      <LeadGoals />
      <StrategiesCard />

      {/* 4. Canais & Telemetria */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel>
          <SectionHeading eyebrow="Mídia Paga" title="Comparativo por canal" />
          <ChannelComparison rows={channels} />
        </Panel>
        <Panel>
          <SectionHeading eyebrow="Telemetria" title="Saúde das integrações" />
          <IntegrationsHealth rows={integrations} />
        </Panel>
      </div>

      {/* 5. Auditoria por Campanha */}
      <Panel>
        <CampaignsPerformance
          rows={campaigns}
          loading={perf.isLoading}
          error={perf.isError}
          onSelect={(r) => r.campaignId && setSelected(r)}
          stages={crm.data?.stages ?? []}
        />
        {crm.data && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {nfmt(crm.data.totals.leads_identificados)} de {nfmt(crm.data.totals.leads_bitrix)} leads do período têm campanha identificada (
            {nfmt(crm.data.totals.leads_nao_identificados)} sem identificação).
          </p>
        )}
      </Panel>

      <CampaignLeadsDrawer
        open={Boolean(selected)}
        onOpenChange={(v) => !v && setSelected(null)}
        campaignId={selected?.campaignId ?? null}
        campaignName={selected?.campanha ?? ""}
        leadsMeta={selected?.leads ?? null}
        crm={selected?.crm ?? null}
        from={filters.from}
        to={filters.to}
      />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getCampaignDetailFn, type CampaignDetail } from "@/lib/campaigns.functions";
import { CHART, currency, labelDay, nfmt, pctfmt, tooltipStyle } from "@/lib/dashboard-utils";
import { GoogleAdsIcon, MetaIcon } from "@/components/brand-icons";
import type { CampaignRef } from "@/components/CampaignPicker";

const EMPTY = "Sem dados para o período";

function Kpi({ label, value }: { label: string; value: string }) {
  const empty = value === EMPTY || value === "—";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display font-semibold tabular-nums ${empty ? "text-[13px] text-muted-foreground" : "text-2xl"}`}>
        {empty ? EMPTY : value}
      </p>
    </div>
  );
}

export function CampaignDetailView({ selection, from, to }: { selection: CampaignRef; from: string; to: string }) {
  const detailFn = useServerFn(getCampaignDetailFn);
  const query = useQuery({
    queryKey: ["campaign-detail", selection.canal, selection.id, from, to],
    queryFn: () => detailFn({ data: { canal: selection.canal, id: selection.id, from, to } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) return <Skeleton className="h-[520px] w-full" />;
  if (query.isError) {
    return <div className="bento-card p-6 text-sm text-destructive">Não foi possível carregar os dados desta campanha.</div>;
  }

  const data = query.data as CampaignDetail | null;
  if (!data) {
    return (
      <div className="bento-card p-8 text-center">
        <h3 className="font-display text-lg font-semibold">{selection.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{EMPTY}</p>
      </div>
    );
  }

  const s = data.summary;
  const chartData = data.daily.map((d) => ({ ...d, label: labelDay(d.day) }));
  const hasLeads = data.daily.some((d) => d.leads != null);
  const hasConv = data.daily.some((d) => d.conversions != null);

  return (
    <div className="space-y-5">
      <div className="bento-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Campanha individual</p>
            <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
              {data.canal === "meta" ? <MetaIcon className="h-6 w-6 shrink-0" /> : <GoogleAdsIcon className="h-6 w-6 shrink-0" />}
              <span className="truncate">{data.name}</span>
            </h3>
          </div>
          {data.status && <Badge variant={data.status === "ACTIVE" || data.status === "ENABLED" ? "default" : "secondary"}>{data.status}</Badge>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Investimento" value={s.spend > 0 ? currency(s.spend) : EMPTY} />
          <Kpi label="Impressões" value={s.impressions > 0 ? nfmt(s.impressions) : EMPTY} />
          <Kpi label="Alcance" value={s.reach == null ? EMPTY : nfmt(s.reach)} />
          <Kpi label="Cliques" value={s.clicks > 0 ? nfmt(s.clicks) : EMPTY} />
          <Kpi label="CTR" value={s.ctr == null ? EMPTY : pctfmt(s.ctr)} />
          <Kpi label="CPC" value={s.cpc == null ? EMPTY : currency(s.cpc)} />
          {data.canal === "meta" ? (
            <>
              <Kpi label="Leads" value={s.leads == null ? EMPTY : nfmt(s.leads)} />
              <Kpi label="CPL" value={s.cpl == null ? EMPTY : currency(s.cpl)} />
            </>
          ) : (
            <>
              <Kpi label="Conversões" value={s.conversions == null || s.conversions === 0 ? EMPTY : s.conversions.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} />
              <Kpi label="Custo/conversão" value={s.costPerConversion == null ? EMPTY : currency(s.costPerConversion)} />
            </>
          )}
        </div>

        {data.leadsNote && <p className="mt-3 text-[11px] text-muted-foreground/80">{data.leadsNote}</p>}
      </div>

      <div className="bento-card p-5">
        <h4 className="font-display text-[15px] font-semibold">Evolução diária</h4>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{EMPTY}</p>
        ) : (
          <div className="mt-3" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => (n === "Investimento" ? currency(Number(v)) : nfmt(Number(v)))} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar yAxisId="left" dataKey="spend" name="Investimento" fill={CHART.cyan} radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke={CHART.purple} strokeWidth={2.5} dot={false} />
                {hasLeads && <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke={CHART.green} strokeWidth={2.5} dot={false} />}
                {hasConv && <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversões" stroke={CHART.amber} strokeWidth={2.5} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bento-card p-5">
        <h4 className="font-display text-[15px] font-semibold">Impressões por dia</h4>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{EMPTY}</p>
        ) : (
          <div className="mt-3" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => nfmt(Number(v))} />
                <Bar dataKey="impressions" name="Impressões" fill={CHART.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bento-card p-5">
        <h4 className="font-display text-[15px] font-semibold">Tabela diária</h4>
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{EMPTY}</p>
        ) : (
          <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  {["Dia", "Investimento", "Impressões", "Cliques", "CTR", "CPC", data.canal === "google" ? "Conversões" : "Leads"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((d) => {
                  const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : null;
                  const cpc = d.clicks > 0 ? d.spend / d.clicks : null;
                  const last = data.canal === "google" ? d.conversions : d.leads;
                  return (
                    <tr key={d.day} className="zebra-row border-t border-white/5">
                      <td className="px-3 py-2">{d.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{currency(d.spend)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{nfmt(d.impressions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{nfmt(d.clicks)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{pctfmt(ctr)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{cpc == null ? "—" : currency(cpc)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{last == null ? "—" : nfmt(last)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getCampaignDetailFn, type CampaignDetail } from "@/lib/campaigns.functions";
import { CHART, currency, labelDay, nfmt, pctfmt, tooltipStyle } from "@/lib/dashboard-utils";
import { GoogleAdsIcon, MetaIcon } from "@/components/brand-icons";
import type { CampaignRef } from "@/components/CampaignPicker";

const SERIES = [CHART.cyan, CHART.purple, CHART.green, CHART.amber, "#f472b6", "#38bdf8"];

const shortName = (n: string) => (n.length > 26 ? `${n.slice(0, 24)}…` : n);

export function CampaignComparison({
  selection,
  from,
  to,
}: {
  selection: CampaignRef[];
  from: string;
  to: string;
}) {
  const detailFn = useServerFn(getCampaignDetailFn);

  const results = useQueries({
    queries: selection.map((s) => ({
      queryKey: ["campaign-detail", s.canal, s.id, from, to],
      queryFn: () => detailFn({ data: { canal: s.canal, id: s.id, from, to } }),
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    })),
  });

  const loading = results.some((r) => r.isLoading);

  const rows = useMemo(() => {
    return selection.map((s, i) => {
      const d = results[i]?.data as CampaignDetail | null | undefined;
      const leads = d ? (d.canal === "google" ? d.summary.conversions : d.summary.leads) : null;
      const spend = d?.summary.spend ?? 0;
      return {
        ref: s,
        color: SERIES[i % SERIES.length]!,
        detail: d ?? null,
        spend,
        impressions: d?.summary.impressions ?? 0,
        clicks: d?.summary.clicks ?? 0,
        ctr: d?.summary.ctr ?? null,
        cpc: d?.summary.cpc ?? null,
        leads,
        cpl: leads && leads > 0 ? spend / leads : null,
      };
    });
  }, [selection, results]);

  const dailySpend = useMemo(() => {
    const days = new Set<string>();
    rows.forEach((r) => r.detail?.daily.forEach((d) => days.add(d.day)));
    return Array.from(days)
      .sort()
      .map((day) => {
        const point: Record<string, string | number> = { day, label: labelDay(day) };
        rows.forEach((r, i) => {
          const hit = r.detail?.daily.find((d) => d.day === day);
          point[`c${i}`] = hit?.spend ?? 0;
        });
        return point;
      });
  }, [rows]);

  const totals = useMemo(() => {
    const spend = rows.reduce((a, r) => a + r.spend, 0);
    const leads = rows.reduce((a, r) => a + (r.leads ?? 0), 0);
    return { spend, leads, cpl: leads > 0 ? spend / leads : null };
  }, [rows]);

  if (loading) return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-5">
      <div className="bento-card p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Comparação de campanhas
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold">{selection.length} campanhas selecionadas</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Investimento somado</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{currency(totals.spend)}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Leads / conversões</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{nfmt(totals.leads)}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-card/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">CPL médio</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
              {totals.cpl == null ? "—" : currency(totals.cpl)}
            </p>
          </div>
        </div>
      </div>

      <div className="bento-card p-5">
        <h4 className="font-display text-[15px] font-semibold">Comparativo lado a lado</h4>
        <div className="mt-3 overflow-auto rounded-lg border border-white/5">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="bg-card">
              <tr>
                {["Campanha", "Investimento", "Impressões", "Cliques", "CTR", "CPC", "Leads/Conv.", "CPL"].map((h, i) => (
                  <th
                    key={h}
                    className={`whitespace-nowrap px-3 py-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground ${i === 0 ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.ref.canal}-${r.ref.id}`} className="zebra-row border-t border-white/5">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                      {r.ref.canal === "meta" ? <MetaIcon className="h-4 w-4 shrink-0" /> : <GoogleAdsIcon className="h-4 w-4 shrink-0" />}
                      <span className="max-w-[280px] truncate" title={r.ref.name}>{r.ref.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{currency(r.spend)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nfmt(r.impressions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nfmt(r.clicks)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pctfmt(r.ctr)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cpc == null ? "—" : currency(r.cpc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.leads == null ? "—" : nfmt(r.leads)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cpl == null ? "—" : currency(r.cpl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="bento-card p-5">
          <h4 className="font-display text-[15px] font-semibold">Investimento por dia</h4>
          {dailySpend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Sem dados para o período</p>
          ) : (
            <div className="mt-3" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySpend} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => currency(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                  {rows.map((r, i) => (
                    <Line
                      key={`${r.ref.canal}-${r.ref.id}`}
                      type="monotone"
                      dataKey={`c${i}`}
                      name={shortName(r.ref.name)}
                      stroke={r.color}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bento-card p-5">
          <h4 className="font-display text-[15px] font-semibold">Leads e CPL por campanha</h4>
          <div className="mt-3" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows.map((r) => ({ name: shortName(r.ref.name), leads: r.leads ?? 0, cpl: r.cpl ?? 0 }))}
                margin={{ top: 8, right: 8, left: -14, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
                <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" interval={0} height={50} angle={-15} textAnchor="end" />
                <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={false} stroke="oklch(0.6 0.03 240)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => (n === "CPL" ? currency(Number(v)) : nfmt(Number(v)))} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar yAxisId="left" dataKey="leads" name="Leads/Conv." fill={CHART.green} radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="cpl" name="CPL" fill={CHART.amber} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

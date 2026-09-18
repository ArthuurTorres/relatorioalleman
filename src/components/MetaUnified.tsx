import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaPerformance, getMetaSyncState } from "@/lib/meta.functions";
import { getMetaDetail, type Filters } from "@/lib/utm.functions";
import { TermSearch } from "@/components/TermSearch";
import { MetaIcon } from "@/components/brand-icons";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

const META = "oklch(0.7 0.19 305)";
const META_ACCENT = "oklch(0.72 0.15 165)";
const currency = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR");
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(2)}%`;
const roas = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(2)}x`;

function statusBadge(status: string | null) {
  if (!status) return null;
  const active = status === "ACTIVE";
  return (
    <Badge variant={active ? "default" : "secondary"} className="text-xs">
      {status}
    </Badge>
  );
}

export function MetaUnified({ filters }: { filters: Filters }) {
  const perfFn = useServerFn(getMetaPerformance);
  const syncFn = useServerFn(getMetaSyncState);
  const detailFn = useServerFn(getMetaDetail);

  const perf = useQuery({
    queryKey: ["meta-performance", filters.from, filters.to],
    queryFn: () => perfFn({ data: { from: filters.from, to: filters.to } }),
  });
  const sync = useQuery({
    queryKey: ["meta-sync-state"],
    queryFn: async () => {
      try {
        return await syncFn();
      } catch {
        return null;
      }
    },
    retry: false,
    refetchInterval: 60_000,
  });
  const detail = useQuery({
    queryKey: ["meta-detail", JSON.stringify(filters)],
    queryFn: () => detailFn({ data: filters }),
  });

  const p = perf.data;
  const d = detail.data;
  const loading = perf.isLoading || detail.isLoading;

  return (
    <Card className="bento-card border-0 relative overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: `linear-gradient(180deg, ${META}, ${META_ACCENT})` }}
        aria-hidden
      />
      <CardHeader className="pt-6 px-6 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Performance de mídia paga</p>
<CardTitle className="font-display text-xl mt-1 flex items-center gap-2.5">
          <MetaIcon className="h-6 w-6 shrink-0" />
          Meta Ads · Investimento, CPL e Leads
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2">
          Cruzamento entre gasto do Meta e conversões do Bitrix, com detalhamento de UTMs, placements e páginas
          {sync.data?.last_run && (
            <> · última sync: <span className="tabular-nums text-foreground/70">{new Date(sync.data.last_run).toLocaleString("pt-BR")}</span></>
          )}
        </p>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-8">
        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : perf.isError ? (
          <p className="text-sm text-destructive py-8 text-center">
            Erro ao carregar: {(perf.error as Error).message}
          </p>
        ) : (
          <>
            {/* KPI Cards — investimento & CPL primeiro */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Kpi label="Investido" value={currency(p?.summary.spend ?? 0)} highlight />
              <Kpi
                label="CPL real (Meta)"
                value={currency(p?.summary.cpl_meta ?? null)}
                sub={p?.summary.leads_meta_reported ? `${p.summary.leads_meta_reported} leads Meta Ads` : undefined}
                highlight
              />
              <Kpi
                label="Leads (Meta Ads)"
                value={num(p?.summary.leads_meta_reported ?? 0)}
                sub={p?.summary.cpl_meta ? `CPL ${currency(p.summary.cpl_meta)}` : undefined}
              />
              <Kpi label="Leads Meta (Bitrix)" value={num(d?.summary.total ?? 0)} />
              <Kpi label="Valor gerado" value={currency(d?.summary.valorTotal ?? 0)} />

              <Kpi label="ROAS" value={roas(p?.summary.roas ?? null)} />
              <Kpi label="Impressões" value={num(p?.summary.impressions ?? 0)} />
              <Kpi label="Cliques" value={num(p?.summary.clicks ?? 0)} />
              <Kpi label="CTR" value={pct(p?.summary.ctr ?? 0)} />
              <Kpi label="CPC" value={currency(p?.summary.cpc ?? 0)} />
              <Kpi label="CPM" value={currency(p?.summary.cpm ?? 0)} />
              <Kpi label="Campanhas (Bitrix)" value={num(d?.summary.campanhas ?? 0)} />
              <Kpi label="Anúncios (Bitrix)" value={num(d?.summary.anuncios ?? 0)} />
            </div>

            <TermSearch filters={filters} />




            {/* Daily chart: spend vs leads */}
            {p && p.daily.length > 0 && (
              <div className="rounded-xl border border-white/5 bg-black/10 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Diário</p>
                <p className="font-display text-base mt-1 mb-4">Gasto vs leads</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={mergeDaily(p.daily, d?.daily ?? [])}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                      <XAxis dataKey="day" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} width={52} />
                      <YAxis yAxisId="right" orientation="right" fontSize={11} stroke="oklch(0.6 0.03 240)" tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        contentStyle={{ background: "oklch(0.19 0.035 250)", border: "1px solid oklch(1 0 0 / 0.08)", borderRadius: 10, color: "oklch(0.97 0.005 240)", fontSize: 12, padding: "8px 12px" }}
                        cursor={{ stroke: "oklch(1 0 0 / 0.1)", strokeWidth: 1 }}
                        formatter={(v: any, name: string) => name === "Gasto" ? currency(Number(v)) : v}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                      <Line yAxisId="left" type="monotone" dataKey="spend" name="Gasto" stroke={META} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke={META_ACCENT} strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Line yAxisId="right" type="monotone" dataKey="clicks" name="Cliques" stroke="oklch(0.78 0.14 230)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <Tabs defaultValue="campaign">
              <TabsList className="flex-wrap h-auto bg-card/40 border border-white/10 backdrop-blur p-1">
                <TabsTrigger value="campaign" className="text-xs data-[state=active]:bg-white/5">Campanhas</TabsTrigger>
                <TabsTrigger value="adset" className="text-xs data-[state=active]:bg-white/5">Adsets</TabsTrigger>
                <TabsTrigger value="ad" className="text-xs data-[state=active]:bg-white/5">Anúncios</TabsTrigger>
                <TabsTrigger value="utm" className="text-xs data-[state=active]:bg-white/5">UTMs (Bitrix)</TabsTrigger>
                <TabsTrigger value="placement" className="text-xs data-[state=active]:bg-white/5">Placements (Bitrix)</TabsTrigger>
                <TabsTrigger value="page" className="text-xs data-[state=active]:bg-white/5">Páginas (Bitrix)</TabsTrigger>
              </TabsList>


              <TabsContent value="campaign">
                {p && p.byCampaign.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campanha</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impr.</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">CPC</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">CPL</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.byCampaign.map((r) => (
                          <TableRow key={r.campaign_id}>
                            <TableCell className="font-medium max-w-xs truncate">{r.campaign_name}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-right">{currency(r.spend)}</TableCell>
                            <TableCell className="text-right">{num(r.impressions)}</TableCell>
                            <TableCell className="text-right">{num(r.clicks)}</TableCell>
                            <TableCell className="text-right">{pct(r.ctr)}</TableCell>
                            <TableCell className="text-right">{currency(r.cpc)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={r.leads > 0 ? "default" : "secondary"} title={r.leads_crm > 0 ? `${r.leads_crm} leads atribuídos no CRM` : `${r.leads_meta} leads informados pelo Meta Ads`}>{r.leads}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{currency(r.cpl)}</TableCell>
                            <TableCell className="text-right">{currency(r.valor_gerado)}</TableCell>
                            <TableCell className="text-right">{roas(r.roas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

              <TabsContent value="adset">
                {p && p.byAdset.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Adset</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impr.</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">CPL</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.byAdset.map((r) => (
                          <TableRow key={r.adset_id}>
                            <TableCell className="font-medium max-w-xs truncate">{r.adset_name}</TableCell>
                            <TableCell className="text-muted-foreground max-w-xs truncate">{r.campaign_name}</TableCell>
                            <TableCell className="text-right">{currency(r.spend)}</TableCell>
                            <TableCell className="text-right">{num(r.impressions)}</TableCell>
                            <TableCell className="text-right">{num(r.clicks)}</TableCell>
                            <TableCell className="text-right">{pct(r.ctr)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={r.leads > 0 ? "default" : "secondary"} title={r.leads_crm > 0 ? `${r.leads_crm} leads atribuídos no CRM` : `${r.leads_meta} leads informados pelo Meta Ads`}>{r.leads}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{currency(r.cpl)}</TableCell>
                            <TableCell className="text-right">{roas(r.roas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

              <TabsContent value="ad">
                {p && p.byAd.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anúncio</TableHead>
                          <TableHead>Adset</TableHead>
                          <TableHead>Campanha</TableHead>
                          <TableHead className="text-right">Gasto</TableHead>
                          <TableHead className="text-right">Impr.</TableHead>
                          <TableHead className="text-right">Cliques</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">CPL</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.byAd.map((r) => (
                          <TableRow key={r.ad_id}>
                            <TableCell className="font-medium max-w-[220px] truncate">{r.ad_name}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[160px] truncate">{r.adset_name}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[160px] truncate">{r.campaign_name}</TableCell>
                            <TableCell className="text-right">{currency(r.spend)}</TableCell>
                            <TableCell className="text-right">{num(r.impressions)}</TableCell>
                            <TableCell className="text-right">{num(r.clicks)}</TableCell>
                            <TableCell className="text-right">{pct(r.ctr)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={r.leads > 0 ? "default" : "secondary"} title={r.leads_crm > 0 ? `${r.leads_crm} leads atribuídos no CRM` : `${r.leads_meta} leads informados pelo Meta Ads`}>{r.leads}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{currency(r.cpl)}</TableCell>
                            <TableCell className="text-right">{roas(r.roas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

              <TabsContent value="utm">
                {d && d.byUtm.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>utm_source</TableHead>
                          <TableHead>utm_medium</TableHead>
                          <TableHead>utm_campaign</TableHead>
                          <TableHead>utm_content</TableHead>
                          <TableHead>utm_term</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.byUtm.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell><code className="text-xs">{r.utm_source ?? "—"}</code></TableCell>
                            <TableCell><code className="text-xs">{r.utm_medium ?? "—"}</code></TableCell>
                            <TableCell><code className="text-xs max-w-[200px] truncate inline-block">{r.utm_campaign ?? "—"}</code></TableCell>
                            <TableCell><code className="text-xs max-w-[160px] truncate inline-block">{r.utm_content ?? "—"}</code></TableCell>
                            <TableCell><code className="text-xs max-w-[140px] truncate inline-block">{r.utm_term ?? "—"}</code></TableCell>
                            <TableCell className="text-right"><Badge variant="secondary">{r.count}</Badge></TableCell>
                            <TableCell className="text-right">{currency(r.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

              <TabsContent value="placement">
                {d && d.byPlacement.length > 0 ? (
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={d.byPlacement.slice(0, 15).map((pl) => ({
                          label: `${pl.placement}${pl.site !== "—" ? ` · ${pl.site}` : ""}`,
                          count: pl.count,
                        }))}
                        layout="vertical"
                        margin={{ left: 150 }}
                      >
                        <XAxis type="number" fontSize={11} />
                        <YAxis type="category" dataKey="label" fontSize={11} width={150} />
                        <Tooltip />
                        <Bar dataKey="count" fill={META} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

              <TabsContent value="page">
                {d && d.byPage.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domínio</TableHead>
                          <TableHead>URL</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.byPage.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.dominio ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-md truncate">{r.url_pagina ?? "—"}</TableCell>
                            <TableCell className="text-right"><Badge variant="secondary">{r.count}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : <EmptyState />}
              </TabsContent>

            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <p className="text-sm text-muted-foreground py-8 text-center">
      Sem dados no período selecionado
    </p>
  );
}

function mergeDaily(
  perfDaily: Array<{ day: string; spend: number; impressions: number; clicks: number }>,
  detailDaily: Array<{ day: string; total: number; valor: number }>,
) {
  const map = new Map<string, { day: string; spend: number; clicks: number; impressions: number; leads: number }>();
  for (const p of perfDaily) {
    map.set(p.day, { day: p.day, spend: p.spend, clicks: p.clicks, impressions: p.impressions, leads: 0 });
  }
  for (const d of detailDaily) {
    const existing = map.get(d.day);
    if (existing) existing.leads = d.total;
    else map.set(d.day, { day: d.day, spend: 0, clicks: 0, impressions: 0, leads: d.total });
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-colors ${
        highlight
          ? "border-primary/25 bg-primary/[0.06]"
          : "border-white/8 bg-card/40 hover:border-white/15"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`font-display text-xl font-bold mt-2 tracking-[-0.02em] tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}


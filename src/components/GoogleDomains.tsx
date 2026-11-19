import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGoogleDetail, type Filters } from "@/lib/utm.functions";
import { GoogleAdsIcon } from "@/components/brand-icons";
import { CHART, tooltipStyle } from "@/lib/dashboard-utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const GOOGLE = CHART.cyan;
const GOOGLE_ACCENT = CHART.green;

const num = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR");
const currency = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function GoogleDomains({ filters }: { filters: Filters }) {
  const detailFn = useServerFn(getGoogleDetail);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["google-detail", JSON.stringify(filters)],
    queryFn: () => detailFn({ data: filters }),
  });

  const d = detail.data;

  const domains = useMemo(() => {
    const list = d?.byDomain ?? [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((r) => r.dominio.toLowerCase().includes(s));
  }, [d, q]);

  const filterByDomain = <T extends { dominio: string }>(rows: T[] | undefined) =>
    (rows ?? []).filter((r) => (selected ? r.dominio === selected : true));

  return (
    <Card className="bento-card relative overflow-hidden border-0">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: `linear-gradient(180deg, ${GOOGLE}, ${GOOGLE_ACCENT})` }}
        aria-hidden
      />
      <CardHeader className="px-6 pt-6 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Origem Google</p>
        <CardTitle className="mt-1 flex items-center gap-2.5 font-display text-xl">
          <GoogleAdsIcon className="h-6 w-6 shrink-0" />
          Google · Detalhamento por domínio
        </CardTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          Cruzamento dos leads do Bitrix com origem Google, agrupados pelo domínio da página de captura,
          campanha, palavra-chave e URL.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        {detail.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : detail.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Erro ao carregar: {(detail.error as Error).message}
          </p>
        ) : (d?.summary.total ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem leads do Google no período</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Leads Google" value={num(d!.summary.total)} />
              <Kpi label="Domínios" value={num(d!.summary.dominios)} hint="páginas de captura" />
              <Kpi label="Campanhas" value={num(d!.summary.campanhas)} />
              <Kpi label="Palavras-chave" value={num(d!.summary.termos)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/25 p-4" style={{ height: 300 }}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Leads por domínio
                </p>
                <ResponsiveContainer width="100%" height="88%">
                  <BarChart data={(d!.byDomain ?? []).slice(0, 10)} layout="vertical" margin={{ left: 140, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="dominio"
                      width={140}
                      fontSize={10}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--chart-cursor)" }}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="count" name="Leads" fill={GOOGLE} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-xl border border-border bg-muted/25 p-4" style={{ height: 300 }}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Evolução diária
                </p>
                <ResponsiveContainer width="100%" height="88%">
                  <LineChart data={d!.daily ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" fontSize={10} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                    <YAxis fontSize={10} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      contentStyle={tooltipStyle}
                    />
                    <Line type="monotone" dataKey="total" name="Leads" stroke={GOOGLE} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Filtrar domínio…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 max-w-xs border-border bg-background"
              />
              {selected && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => setSelected(null)}
                >
                  {selected} · limpar ✕
                </Badge>
              )}
            </div>

            <Tabs defaultValue="dominios">
              <div className="overflow-x-auto pb-0.5">
                <TabsList className="w-max">
                  <TabsTrigger value="dominios">Domínios</TabsTrigger>
                  <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
                  <TabsTrigger value="termos">Palavras-chave</TabsTrigger>
                  <TabsTrigger value="paginas">URLs</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="dominios" className="mt-4">
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Campanhas</TableHead>
                        <TableHead className="text-right">Palavras-chave</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Último lead</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domains.map((r) => (
                        <TableRow
                          key={r.dominio}
                          className="cursor-pointer"
                          data-state={selected === r.dominio ? "selected" : undefined}
                          onClick={() => setSelected(selected === r.dominio ? null : r.dominio)}
                        >
                          <TableCell className="font-medium">{r.dominio}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.campanhas)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.termos)}</TableCell>
                          <TableCell className="text-right tabular-nums">{currency(r.valor)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {r.ultimo ? new Date(r.ultimo).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Clique em um domínio para filtrar as demais abas.
                </p>
              </TabsContent>

              <TabsContent value="campanhas" className="mt-4">
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Source / Medium</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterByDomain(d!.byDomainCampaign).map((r, i) => (
                        <TableRow key={`${r.dominio}-${r.campaign}-${i}`}>
                          <TableCell className="text-xs">{r.dominio}</TableCell>
                          <TableCell className="font-medium">{r.campaign}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.utm_source || "—"} / {r.utm_medium || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{currency(r.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="termos" className="mt-4">
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead>Palavra-chave</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterByDomain(d!.byTerm).map((r, i) => (
                        <TableRow key={`${r.dominio}-${r.termo}-${i}`}>
                          <TableCell className="text-xs">{r.dominio}</TableCell>
                          <TableCell className="font-medium">{r.termo}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.campaign}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.count)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="paginas" className="mt-4">
                <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead>URL da página</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filterByDomain(d!.byPage).map((r, i) => (
                        <TableRow key={`${r.dominio}-${r.pagina}-${i}`}>
                          <TableCell className="text-xs">{r.dominio}</TableCell>
                          <TableCell className="max-w-[420px] truncate text-xs" title={r.pagina}>
                            {r.pagina || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{currency(r.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDomainComparison, type Filters } from "@/lib/utm.functions";
import { GoogleAdsIcon, MetaIcon } from "@/components/brand-icons";
import { CHART, tooltipStyle } from "@/lib/dashboard-utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const META = CHART.purple;
const GOOGLE = CHART.cyan;
const OUTROS = CHART.grey;

const num = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR");

function Kpi({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/25 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DomainComparison({ filters }: { filters: Filters }) {
  const fn = useServerFn(getDomainComparison);
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["domain-comparison", JSON.stringify(filters)],
    queryFn: () => fn({ data: filters }),
  });

  const d = query.data;

  const rows = useMemo(() => {
    const list = d?.rows ?? [];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((r) => r.dominio.toLowerCase().includes(s));
  }, [d, q]);

  const chartData = useMemo(() => rows.slice(0, 12), [rows]);

  return (
    <Card className="bento-card relative overflow-hidden border-0">
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: `linear-gradient(180deg, ${META}, ${GOOGLE})` }}
        aria-hidden
      />
      <CardHeader className="px-6 pt-6 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Comparativo de origens
        </p>
        <CardTitle className="mt-1 flex items-center gap-2 font-display text-xl">
          <MetaIcon className="h-6 w-6 shrink-0" />
          <span className="text-muted-foreground">vs</span>
          <GoogleAdsIcon className="h-6 w-6 shrink-0" />
          <span>por domínio</span>
        </CardTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          Leads do Bitrix agrupados pelo domínio da página de captura, separando o que entrou por Meta e por Google.
        </p>
      </CardHeader>

      <CardContent className="space-y-6 px-6 pb-6">
        {query.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : query.isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Erro ao carregar: {(query.error as Error).message}
          </p>
        ) : (d?.totals.total ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem leads no período</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Meta"
                value={num(d!.totals.Meta)}
                color={META}
                hint={`${((d!.totals.Meta / Math.max(d!.totals.total, 1)) * 100).toFixed(1)}% do total`}
              />
              <Kpi
                label="Google"
                value={num(d!.totals.Google)}
                color={GOOGLE}
                hint={`${((d!.totals.Google / Math.max(d!.totals.total, 1)) * 100).toFixed(1)}% do total`}
              />
              <Kpi label="Outros" value={num(d!.totals.Outros)} color={OUTROS} />
              <Kpi label="Domínios" value={num(d!.dominios)} hint="páginas de captura" />
            </div>

            <div className="h-[380px] rounded-xl border border-border bg-muted/25 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 12, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="dominio"
                    width={170}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => (v.length > 26 ? `${v.slice(0, 26)}…` : v)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--chart-cursor)" }}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Meta" stackId="a" fill={META} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Google" stackId="a" fill={GOOGLE} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Outros" stackId="a" fill={OUTROS} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="Buscar domínio…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 max-w-xs border-border bg-background"
              />
              <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domínio</TableHead>
                      <TableHead className="text-right">Meta</TableHead>
                      <TableHead className="text-right">Google</TableHead>
                      <TableHead className="text-right">Outros</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[140px]">Split</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const t = Math.max(r.total, 1);
                      return (
                        <TableRow key={r.dominio}>
                          <TableCell className="max-w-[280px] truncate font-medium">{r.dominio}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.Meta)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.Google)}</TableCell>
                          <TableCell className="text-right tabular-nums">{num(r.Outros)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{num(r.total)}</TableCell>
                          <TableCell>
                            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div style={{ width: `${(r.Meta / t) * 100}%`, backgroundColor: META }} />
                              <div style={{ width: `${(r.Google / t) * 100}%`, backgroundColor: GOOGLE }} />
                              <div style={{ width: `${(r.Outros / t) * 100}%`, backgroundColor: OUTROS }} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

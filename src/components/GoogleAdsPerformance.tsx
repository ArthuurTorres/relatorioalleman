import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CircleDollarSign, MousePointerClick, Target } from "lucide-react";
import { getGoogleAdsPerformance } from "@/lib/google-ads.functions";
import type { Filters } from "@/lib/utm.functions";
import { currency, nfmt } from "@/lib/dashboard-utils";
import { GoogleAdsIcon } from "@/components/brand-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const KPIS = [
  { key: "spend", label: "Investimento", icon: CircleDollarSign },
  { key: "conversions", label: "Conversões atribuídas", icon: Target },
  { key: "costPerConversion", label: "Custo por conversão", icon: BarChart3 },
  { key: "clicks", label: "Cliques", icon: MousePointerClick },
] as const;

export function GoogleAdsPerformance({ filters }: { filters: Filters }) {
  const performanceFn = useServerFn(getGoogleAdsPerformance);
  const query = useQuery({
    queryKey: ["google-ads-performance", filters.from, filters.to],
    queryFn: () => performanceFn({ data: { from: filters.from, to: filters.to } }),
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    const msg = String((query.error as Error)?.message ?? "");
    const quota = msg.includes("429") || /RESOURCE_EXHAUSTED/i.test(msg);
    return (
      <div className="bento-card p-6">
        <h3 className="font-display text-lg font-semibold">Google Ads · Mídia</h3>
        <p className="mt-2 text-sm text-destructive">
          {quota
            ? "Limite diário de consultas do Google Ads atingido. Os dados voltam automaticamente assim que a cota é liberada (algumas horas)."
            : "Não foi possível consultar a conta de anúncios neste momento."}
        </p>
      </div>
    );
  }

  const data = query.data;
  if (!data) return null;
  const values = {
    spend: currency(data.summary.spend),
    conversions: data.summary.conversions.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
    costPerConversion: data.summary.costPerConversion == null ? "—" : currency(data.summary.costPerConversion),
    clicks: nfmt(data.summary.clicks),
  };

  return (
    <div className="bento-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dados da conta conectada</p>
          <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
            <GoogleAdsIcon className="h-6 w-6 shrink-0" /> Google Ads · Mídia
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground">Conversões atribuídas pelo Google Ads</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="rounded-lg border border-white/[0.06] bg-card/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{values[key]}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 max-h-[460px] overflow-auto rounded-lg border border-white/5">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Investimento</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
              <TableHead className="text-right">Custo/conversão</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Impressões</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.campaigns.map((campaign) => (
              <TableRow key={campaign.campaignId}>
                <TableCell className="min-w-72 font-medium">{campaign.campaignName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{campaign.status ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{currency(campaign.spend)}</TableCell>
                <TableCell className="text-right tabular-nums">{campaign.conversions.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right tabular-nums">{campaign.costPerConversion == null ? "—" : currency(campaign.costPerConversion)}</TableCell>
                <TableCell className="text-right tabular-nums">{nfmt(campaign.clicks)}</TableCell>
                <TableCell className="text-right tabular-nums">{nfmt(campaign.impressions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download } from "lucide-react";
import { getCampaignCrmLeads, type CampaignCrmRow } from "@/lib/crm-funnel.functions";
import { CommercialFunnel } from "./CommercialFunnel";
import { currency, downloadCsv, nfmt, toCsv } from "@/lib/dashboard-utils";

const STEP_LABEL: Record<string, string> = {
  novo: "Lead novo",
  qualificado: "Qualificado",
  tentativa: "Tentativa de contato",
  contatado: "Contatado",
  negociacao: "Negociação/Cotação",
  venda: "Venda",
  perdido: "Perdido",
  sem_etapa: "Sem etapa identificada",
};

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

export function CampaignLeadsDrawer({
  open,
  onOpenChange,
  campaignId,
  campaignName,
  leadsMeta,
  crm,
  from,
  to,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string | null;
  campaignName: string;
  leadsMeta: number | null;
  crm: CampaignCrmRow | null;
  from: string;
  to: string;
}) {
  const leadsFn = useServerFn(getCampaignCrmLeads);
  const q = useQuery({
    queryKey: ["campaign-crm-leads", campaignId, from, to],
    queryFn: () => leadsFn({ data: { campaignId: campaignId!, from, to } }),
    enabled: open && Boolean(campaignId),
  });

  const identificados = crm?.leads_bitrix ?? 0;
  const stages = [
    { label: "Identificados", value: identificados },
    { label: "Qualificados", value: crm?.qualificados ?? 0 },
    { label: "Contatados", value: crm?.contatados ?? 0 },
    { label: "Oportunidades", value: crm?.negociacao ?? 0 },
    { label: "Vendas", value: crm?.vendas ?? 0 },
  ];

  const leads = q.data ?? [];

  function exportCsv() {
    downloadCsv(
      `leads-${campaignName.slice(0, 40).replace(/[^\w-]+/g, "-")}.csv`,
      toCsv(
        ["Nome", "Deal ID", "Data de entrada", "Campaign ID", "Campaign Name", "Etapa atual", "Qualificação", "Status", "Valor"],
        leads.map((l) => [
          l.titulo ?? "", l.bitrix_deal_id, fmtDate(l.data_criacao),
          l.campaign_id ?? "", l.campaign_name ?? "", l.stage_label ?? l.fase ?? "",
          STEP_LABEL[l.funnel_step] ?? l.funnel_step,
          l.funnel_step === "venda" ? "Ganho" : l.funnel_step === "perdido" ? "Perdido" : "Em andamento",
          l.valor ?? "",
        ]),
      ),
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left text-[15px] leading-snug">{campaignName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Leads Meta" value={leadsMeta == null ? "—" : nfmt(leadsMeta)} />
          <Metric label="No Bitrix" value={nfmt(identificados)} />
          <Metric label="Taxa de identificação" value={leadsMeta ? pct(identificados, leadsMeta) : "—"} />
          <Metric label="Aproveitamento" value={pct(crm?.qualificados ?? 0, identificados)} />
        </div>

        <div className="mt-5">
          <h4 className="mb-3 font-display text-[13px] font-semibold">Funil da campanha</h4>
          <CommercialFunnel stages={stages} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-3">
            <span>Contato: {pct(crm?.contatados ?? 0, identificados)}</span>
            <span>Oportunidade: {pct(crm?.negociacao ?? 0, identificados)}</span>
            <span>Venda: {pct(crm?.vendas ?? 0, identificados)}</span>
            <span>Perdidos: {nfmt(crm?.perdidos ?? 0)}</span>
            <span>Sem etapa: {nfmt(crm?.sem_etapa ?? 0)}</span>
            <span>Receita: {currency(crm?.receita ?? 0)}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-[13px] font-semibold">Leads desta campanha</h4>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={exportCsv} disabled={leads.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
            </Button>
          </div>
          {q.isLoading ? (
            <div className="mt-3 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : leads.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">Nenhum lead relacionado a esta campanha no período.</p>
          ) : (
            <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-white/5">
              <table className="w-full min-w-[640px] text-[12px]">
                <thead className="sticky top-0 bg-card">
                  <tr>
                    {["Nome", "Deal ID", "Entrada", "Etapa atual", "Situação"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.bitrix_deal_id} className="border-t border-white/5">
                      <td className="max-w-[220px] truncate px-3 py-2" title={l.titulo ?? ""}>{l.titulo ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.bitrix_deal_id}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(l.data_criacao)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.stage_label ?? l.fase ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={l.funnel_step === "venda" ? "default" : l.funnel_step === "perdido" ? "destructive" : "secondary"} className="text-[10px]">
                          {STEP_LABEL[l.funnel_step] ?? l.funnel_step}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

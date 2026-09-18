import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currency, nfmt } from "@/lib/dashboard-utils";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

export type ChannelRow = {
  canal: string;
  color: string;
  spend: number | null;
  leads: number;
  cpl: number | null;
  contratos: number | null;
  conversao: number | null;
  roas: number | null;
};

const cell = (v: string | null) => <span className="tabular-nums">{v ?? "—"}</span>;

function CanalIcon({ canal }: { canal: string }) {
  if (canal.startsWith("Meta")) return <MetaIcon className="h-4.5 w-4.5 shrink-0" />;
  if (canal.startsWith("Google")) return <GoogleAdsIcon className="h-4.5 w-4.5 shrink-0" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />;
}

export function ChannelComparison({ rows }: { rows: ChannelRow[] }) {
  const totalSpend = rows.reduce((a, r) => a + (r.spend ?? 0), 0);
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const anySpend = rows.some((r) => r.spend != null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="text-[11px] uppercase tracking-wider">Canal</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">Investimento</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">Leads válidos</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">CPL válido</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">Contratos</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">Conversão</TableHead>
            <TableHead className="text-right text-[11px] uppercase tracking-wider">ROAS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.canal} className="border-white/5 zebra-row">
<TableCell className="text-[13px] font-medium">
                <span className="inline-flex items-center gap-2">
                  <CanalIcon canal={r.canal} />
                  {r.canal}
                </span>
              </TableCell>
              <TableCell className="text-right text-[13px]">{cell(r.spend == null ? null : currency(r.spend))}</TableCell>
              <TableCell className="text-right text-[13px]">{cell(nfmt(r.leads))}</TableCell>
              <TableCell className="text-right text-[13px]">{cell(r.cpl == null ? null : currency(r.cpl))}</TableCell>
              <TableCell className="text-right text-[13px]">{cell(r.contratos == null ? null : nfmt(r.contratos))}</TableCell>
              <TableCell className="text-right text-[13px]">{cell(r.conversao == null ? null : `${r.conversao.toFixed(2)}%`)}</TableCell>
              <TableCell className="text-right text-[13px]">{cell(r.roas == null ? null : `${r.roas.toFixed(2)}x`)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="border-white/10 bg-white/[0.03] hover:bg-white/[0.03]">
            <TableCell className="text-[13px] font-semibold">Total mídia paga</TableCell>
            <TableCell className="text-right text-[13px] font-semibold">{cell(anySpend ? currency(totalSpend) : null)}</TableCell>
            <TableCell className="text-right text-[13px] font-semibold">{cell(nfmt(totalLeads))}</TableCell>
            <TableCell className="text-right text-[13px] font-semibold">
              {cell(anySpend && totalLeads > 0 ? currency(totalSpend / totalLeads) : null)}
            </TableCell>
            <TableCell className="text-right text-[13px] font-semibold">{cell(null)}</TableCell>
            <TableCell className="text-right text-[13px] font-semibold">{cell(null)}</TableCell>
            <TableCell className="text-right text-[13px] font-semibold">{cell(null)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Investimento vem das plataformas; leads válidos vêm do Bitrix. Contratos, conversão e ROAS aguardam a integração comercial.
      </p>
    </div>
  );
}

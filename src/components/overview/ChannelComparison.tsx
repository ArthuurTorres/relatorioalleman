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
  if (canal.startsWith("Meta")) return <MetaIcon className="h-4 w-4 shrink-0" />;
  if (canal.startsWith("Google")) return <GoogleAdsIcon className="h-4 w-4 shrink-0" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" />;
}

export function ChannelComparison({ rows }: { rows: ChannelRow[] }) {
  const totalSpend = rows.reduce((a, r) => a + (r.spend ?? 0), 0);
  const totalLeads = rows.reduce((a, r) => a + r.leads, 0);
  const anySpend = rows.some((r) => r.spend != null);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
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
              <TableRow key={r.canal} className="zebra-row border-border">
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
                <TableCell className="text-right text-[13px]">
                  {cell(r.conversao == null ? null : `${r.conversao.toFixed(2)}%`)}
                </TableCell>
                <TableCell className="text-right text-[13px]">{cell(r.roas == null ? null : `${r.roas.toFixed(2)}x`)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-border bg-muted/45 hover:bg-muted/45">
              <TableCell className="text-[13px] font-semibold">Total mídia paga</TableCell>
              <TableCell className="text-right text-[13px] font-semibold">
                {cell(anySpend ? currency(totalSpend) : null)}
              </TableCell>
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
      </div>
      <p className="mt-2.5 text-[11px] text-muted-foreground">
        Investimento vem das plataformas; leads válidos vêm do Bitrix. Contratos, conversão e ROAS aguardam a integração comercial.
      </p>
    </div>
  );
}

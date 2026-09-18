import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

export type IntegrationRow = {
  name: string;
  status: "ok" | "warn" | "error" | "unknown";
  statusLabel: string;
  lastSync: string;
  note: string;
};

const DOT: Record<IntegrationRow["status"], string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  error: "bg-red-400",
  unknown: "bg-muted-foreground/50",
};

const TEXT: Record<IntegrationRow["status"], string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  error: "text-red-300",
  unknown: "text-muted-foreground",
};

function IntegrationIcon({ name }: { name: string }) {
  if (name.startsWith("Meta")) return <MetaIcon className="h-4.5 w-4.5 shrink-0" />;
  if (name.startsWith("Google")) return <GoogleAdsIcon className="h-4.5 w-4.5 shrink-0" />;
  return null;
}

export function IntegrationsHealth({ rows }: { rows: IntegrationRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="text-[11px] uppercase tracking-wider">Integração</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Última sincronização</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wider">Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} className="border-white/5">
<TableCell className="text-[13px] font-medium">
                <span className="inline-flex items-center gap-2">
                  <IntegrationIcon name={r.name} />
                  {r.name}
                </span>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center gap-2 text-[12px] ${TEXT[r.status]}`}>
                  <span className={`h-2 w-2 rounded-full ${DOT[r.status]}`} />
                  {r.statusLabel}
                </span>
              </TableCell>
              <TableCell className="text-[12px] tabular-nums text-muted-foreground">{r.lastSync}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{r.note}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

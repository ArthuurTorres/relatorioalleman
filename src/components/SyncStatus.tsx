import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSyncStatus } from "@/lib/sync-status.functions";
import { Clock } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

const fmt = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function SyncStatus() {
  const fn = useServerFn(getSyncStatus);
  const { data } = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      try {
        return await fn();
      } catch {
        return null;
      }
    },
    retry: false,
    refetchInterval: 120_000,
  });

  const latest = [data?.bitrix_last_run, data?.meta_last_run, data?.last_lead_synced_at]
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-card/40 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur cursor-default">
            <Clock className="h-3.5 w-3.5 text-primary/80" />
            <span className="hidden sm:inline">Atualizado</span>
            <span className="tabular-nums text-foreground/80">{fmt(latest ?? null)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] leading-relaxed">
          <p>Leads (Bitrix): <span className="tabular-nums">{fmt(data?.bitrix_last_run ?? null)}</span>{data?.bitrix_last_status ? ` · ${data.bitrix_last_status}` : ""}</p>
          <p>Meta Ads: <span className="tabular-nums">{fmt(data?.meta_last_run ?? null)}</span>{data?.meta_last_status ? ` · ${data.meta_last_status}` : ""}</p>
          <p>Último lead recebido: <span className="tabular-nums">{fmt(data?.last_lead_created_at ?? null)}</span></p>
          <p className="text-muted-foreground mt-1">Horários em Brasília (BRT)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

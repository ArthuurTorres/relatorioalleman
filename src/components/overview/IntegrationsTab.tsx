import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSyncStatus } from "@/lib/sync-status.functions";
import { getGoogleAdsPerformance } from "@/lib/google-ads.functions";
import { IntegrationsHealth, type IntegrationRow } from "./IntegrationsHealth";

function fmt(v: string | null | undefined) {
  return v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : "—";
}

function hours(v: string | null | undefined) {
  return v ? (Date.now() - new Date(v).getTime()) / 3_600_000 : null;
}

export function IntegrationsTab() {
  const syncFn = useServerFn(getSyncStatus);
  const googleFn = useServerFn(getGoogleAdsPerformance);
  const sync = useQuery({
    queryKey: ["sync-status"],
    queryFn: async () => {
      try {
        return await syncFn();
      } catch {
        return null;
      }
    },
    retry: false,
    refetchInterval: 120_000,
  });
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const google = useQuery({
    queryKey: ["google-ads-health"],
    queryFn: () => googleFn({ data: { from, to: now.toISOString() } }),
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  const d = sync.data;
  const rows: IntegrationRow[] = [
    {
      name: "Meta Ads",
      status: d?.meta_last_run == null ? "unknown" : d.meta_last_status === "ok" && (hours(d.meta_last_run) ?? 99) < 24 ? "ok" : "warn",
      statusLabel: d?.meta_last_run == null ? "Status indisponível" : d.meta_last_status === "ok" && (hours(d.meta_last_run) ?? 99) < 24 ? "Conectado" : "Atenção",
      lastSync: fmt(d?.meta_last_run),
      note: d?.meta_last_status && d.meta_last_status !== "ok" ? d.meta_last_status : "—",
    },
    {
      name: "Bitrix",
      status: d?.bitrix_last_run == null ? "unknown" : d.bitrix_last_status === "ok" && (hours(d.bitrix_last_run) ?? 99) < 24 ? "ok" : "error",
      statusLabel: d?.bitrix_last_run == null ? "Status indisponível" : d.bitrix_last_status === "ok" && (hours(d.bitrix_last_run) ?? 99) < 24 ? "Conectado" : "Atenção",
      lastSync: fmt(d?.bitrix_last_run),
      note: d?.last_lead_created_at ? `Último lead: ${fmt(d.last_lead_created_at)}` : "—",
    },
    {
      name: "Google Ads",
      status: google.isError ? "error" : google.data ? "ok" : "unknown",
      statusLabel: google.isError ? "Atenção" : google.data ? "Conectado" : "Status indisponível",
      lastSync: fmt(google.data?.retrievedAt),
      note: google.isError ? "Falha na leitura da conta" : google.data ? "Leitura direta da conta" : "—",
    },
    { name: "Sistema comercial (AGSI)", status: "unknown", statusLabel: "Status indisponível", lastSync: "—", note: "Integração não configurada" },
  ];

  return (
    <div className="bento-card p-5">
      <h3 className="mb-3 font-display text-[15px] font-semibold">Saúde das integrações</h3>
      <IntegrationsHealth rows={rows} />
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Os status refletem os registros de sincronização disponíveis. Quando não há registro, exibimos “Status
        indisponível”.
      </p>
    </div>
  );
}

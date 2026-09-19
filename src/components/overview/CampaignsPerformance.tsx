import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { currency, downloadCsv, nfmt, toCsv } from "@/lib/dashboard-utils";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

export type CampaignRow = {
  campanha: string;
  operadora: string;
  canal: string;
  spend: number | null;
  leads: number;
  cpl: number | null;
  contratos: number | null;
  vidas: number | null;
  conversao: number | null;
  receita: number | null;
  roas: number | null;
  status: string | null;
  /** ID da campanha (texto) — chave do cruzamento com os leads do CRM */
  campaignId?: string | null;
  /** Dados comerciais cruzados (leads do Bitrix por etapa) */
  crm?: {
    leads_bitrix: number;
    qualificados: number;
    contatados: number;
    negociacao: number;
    vendas: number;
    perdidos: number;
    sem_etapa: number;
    receita: number;
    by_stage?: Record<string, number> | null;
    fora_funil?: number;
  } | null;
};

export type StageCol = { stage_id: string; name: string };

type SortKey = "campanha" | "operadora" | "canal" | "spend" | "leads" | "cpl" | "status";

const PAGE_SIZE = 10;

const HEAD_COLS: Array<{ key: SortKey | null; label: string; align?: "right" }> = [
  { key: "campanha", label: "Campanha" },
  { key: "operadora", label: "Operadora" },
  { key: "canal", label: "Canal" },
  { key: "spend", label: "Investimento", align: "right" },
  { key: "leads", label: "Leads válidos", align: "right" },
  { key: "cpl", label: "CPL", align: "right" },
  { key: null, label: "No Bitrix", align: "right" },
];

const TAIL_COLS: Array<{ key: SortKey | null; label: string; align?: "right" }> = [
  { key: null, label: "Outros funis", align: "right" },
  { key: null, label: "Sem etapa", align: "right" },
  { key: null, label: "Identificação", align: "right" },
  { key: null, label: "Receita", align: "right" },
  { key: null, label: "ROAS", align: "right" },
  { key: "status", label: "Status" },
];

function CanalIcon({ canal }: { canal: string }) {
  if (canal.startsWith("Meta")) return <MetaIcon className="h-4.5 w-4.5 shrink-0" />;
  if (canal.startsWith("Google")) return <GoogleAdsIcon className="h-4.5 w-4.5 shrink-0" />;
  return null;
}

function ratio(n: number | null | undefined, d: number | null | undefined) {
  if (!d || n == null) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function num(v: number | null | undefined) {
  return v == null ? "—" : nfmt(v);
}

export function CampaignsPerformance({
  rows,
  loading,
  error,
  onSelect,
  stages = [],
}: {
  rows: CampaignRow[];
  loading?: boolean;
  error?: boolean;
  onSelect?: (row: CampaignRow) => void;
  /** Etapas reais do funil Comercial do Bitrix, na ordem do quadro */
  stages?: StageCol[];
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [page, setPage] = useState(0);
  const stageCount = (r: CampaignRow, id: string) => r.crm?.by_stage?.[id] ?? (r.crm ? 0 : null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? rows.filter(
          (r) =>
            r.campanha.toLowerCase().includes(term) ||
            r.operadora.toLowerCase().includes(term) ||
            r.canal.toLowerCase().includes(term),
        )
      : rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" || typeof bv === "number") return ((av as number) ?? 0) > ((bv as number) ?? 0) ? dir : -dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [rows, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function exportCsv() {
    downloadCsv(
      "desempenho-campanhas.csv",
      toCsv(
        [
          "Campanha", "Operadora", "Canal", "Investimento", "Leads válidos", "CPL", "No Bitrix",
          ...stages.map((s) => s.name),
          "Outros funis", "Sem etapa", "Identificação", "Receita", "ROAS", "Status",
        ],
        filtered.map((r) => [
          r.campanha, r.operadora, r.canal,
          r.spend ?? "", r.leads, r.cpl?.toFixed(2) ?? "",
          r.crm?.leads_bitrix ?? "",
          ...stages.map((s) => stageCount(r, s.stage_id) ?? ""),
          r.crm?.fora_funil ?? "", r.crm?.sem_etapa ?? "",
          ratio(r.crm?.leads_bitrix, r.leads),
          r.crm?.receita ?? "", r.crm?.receita && r.spend ? (r.crm.receita / r.spend).toFixed(2) : "",
          r.status ?? "",
        ]),
      ),
    );
  }


  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
    setPage(0);
  }

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h3 className="min-w-0 truncate font-display text-[15px] font-semibold">Desempenho das campanhas</h3>
        <Button variant="outline" size="sm" className="shrink-0 border-white/10 bg-card/50" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
        </Button>
      </div>

      <div className="relative mt-3 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Buscar campanha"
          className="h-9 border-white/10 bg-card/40 pl-8 text-[13px]"
        />
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-300">Não foi possível carregar o desempenho das campanhas.</p>
      ) : loading ? (
        <div className="mt-4 space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma campanha encontrada no período</p>
      ) : (
        <>
          <div className="mt-3 max-h-[460px] overflow-auto rounded-lg border border-white/5">
            <table className="w-full min-w-[2200px] text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  {[
                    ...HEAD_COLS,
                    ...stages.map((s) => ({ key: null as SortKey | null, label: s.name, align: "right" as const })),
                    ...TAIL_COLS,
                  ].map((c, i) => (
                    <th
                      key={`${c.label}-${i}`}
                      className={`whitespace-nowrap px-3 py-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground ${c.align === "right" ? "text-right" : "text-left"} ${c.key ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                      onClick={() => c.key && toggleSort(c.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {c.key && sort.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr
                    key={`${r.canal}-${r.campanha}`}
                    className={`zebra-row border-t border-white/5 ${onSelect ? "cursor-pointer hover:bg-white/[0.04]" : ""}`}
                    onClick={() => onSelect?.(r)}
                  >
                    <td className="max-w-[280px] truncate px-3 py-2" title={r.campanha}>{r.campanha}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.operadora}</td>
<td className="px-3 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CanalIcon canal={r.canal} />
                        {r.canal}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.spend == null ? "—" : currency(r.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nfmt(r.leads)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.cpl == null ? "—" : currency(r.cpl)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(r.crm?.leads_bitrix)}</td>
                    {stages.map((s) => {
                      const v = stageCount(r, s.stage_id);
                      return (
                        <td
                          key={s.stage_id}
                          className={`px-3 py-2 text-right tabular-nums ${v ? "" : "text-muted-foreground/50"}`}
                          title={s.name}
                        >
                          {num(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{num(r.crm?.fora_funil)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{num(r.crm?.sem_etapa)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{ratio(r.crm?.leads_bitrix, r.leads)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.crm?.receita ? currency(r.crm.receita) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.crm?.receita && r.spend ? (r.crm.receita / r.spend).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2">
                      {r.status ? (
                        <Badge variant={r.status === "ACTIVE" || r.status === "ENABLED" ? "default" : "secondary"} className="text-[10px]">
                          {r.status === "ACTIVE" || r.status === "ENABLED" ? "Ativa" : r.status === "PAUSED" ? "Pausada" : r.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>
              {filtered.length} campanha(s) · página {current + 1} de {pages}
            </span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 border-white/10 bg-card/50 text-[11px]" disabled={current === 0} onClick={() => setPage(current - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" className="h-7 border-white/10 bg-card/50 text-[11px]" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Clique em uma campanha para ver o funil e os leads nominalmente. As colunas comerciais vêm do cruzamento pelo ID da campanha registrado no lead;
        leads sem esse ID aparecem na linha “Campanha não identificada”.
      </p>
    </div>
  );
}

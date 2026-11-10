import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBitrixPipelineFunnel,
  getBitrixStageLeads,
  getFunnelCohort,
  type BitrixPipelineRow,
  type BitrixStageRow,
  type FunnelCohort,
} from "@/lib/bitrix-funnel.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nfmt, pctfmt, currency, downloadCsv, toCsv } from "@/lib/dashboard-utils";
import { StageMapping } from "./StageMapping";
import { Download } from "lucide-react";

type Props = { filters: { from: string; to: string } };

const ORIGEM_TABS: { label: string; value: string[] | null }[] = [
  { label: "Meta", value: ["Meta"] },
  { label: "Google", value: ["Google"] },
  { label: "Outros", value: ["Outros"] },
  { label: "Todos", value: null },
];

const STEP_TONE: Record<string, string> = {
  novo: "bg-sky-500/15 text-sky-300 ring-sky-500/20",
  qualificado: "bg-indigo-500/15 text-indigo-300 ring-indigo-500/20",
  tentativa: "bg-amber-500/15 text-amber-300 ring-amber-500/20",
  contatado: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
  negociacao: "bg-orange-500/15 text-orange-300 ring-orange-500/20",
  venda: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
  perdido: "bg-red-500/15 text-red-300 ring-red-500/20",
};

export function BitrixFunnelTab({ filters }: Props) {
  const [origemIdx, setOrigemIdx] = useState(0);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stage, setStage] = useState<BitrixStageRow | null>(null);

  const origem = ORIGEM_TABS[origemIdx]!.value;
  const fetchFunnel = useServerFn(getBitrixPipelineFunnel);

  const funnel = useQuery({
    queryKey: ["bitrix-pipeline-funnel", filters.from, filters.to, origem],
    queryFn: () => fetchFunnel({ data: { from: filters.from, to: filters.to, origem } }),
  });

  const fetchCohort = useServerFn(getFunnelCohort);
  const cohort = useQuery({
    queryKey: ["bitrix-funnel-cohort", filters.from, filters.to, origem],
    queryFn: () => fetchCohort({ data: { from: filters.from, to: filters.to, origem } }),
  });

  const pipelines = useMemo(
    () => (funnel.data?.pipelines ?? []).filter((p) => p.total > 0),
    [funnel.data],
  );

  const active: BitrixPipelineRow | null = useMemo(() => {
    if (!pipelines.length) return null;
    return pipelines.find((p) => p.id === pipelineId) ?? pipelines[0]!;
  }, [pipelines, pipelineId]);

  const stages = useMemo(() => {
    const list = (active?.stages ?? []).slice().sort((a, b) => a.sort - b.sort);
    return list;
  }, [active]);

  const maxLeads = Math.max(1, ...stages.map((s) => s.leads));

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.06] bg-card/40">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Funis do Bitrix</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Espelho das etapas reais do seu CRM. Clique em uma etapa para ver os leads nominalmente.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.06] bg-card/50 p-1">
            {ORIGEM_TABS.map((t, i) => (
              <Button
                key={t.label}
                size="sm"
                variant={i === origemIdx ? "secondary" : "ghost"}
                onClick={() => setOrigemIdx(i)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {funnel.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !pipelines.length ? (
            <p className="text-sm text-muted-foreground">
              Nenhum lead deste canal no período selecionado.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {pipelines.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPipelineId(p.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                      active?.id === p.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/[0.06] bg-card/40 hover:bg-card/70"
                    }`}
                  >
                    <span className="block font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{nfmt(p.total)} leads</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Leads no período" value={nfmt(funnel.data?.total ?? 0)} />
                <Metric label={`Leads em ${active?.name ?? "-"}`} value={nfmt(active?.total ?? 0)} />
                <Metric label="Sem etapa reconhecida" value={nfmt(funnel.data?.sem_etapa ?? 0)} />
              </div>

              <div className="space-y-1.5">
                {stages.map((s, i) => {
                  const prev = stages[i - 1];
                  const total = active?.total || 0;
                  const share = total ? (s.leads / total) * 100 : 0;
                  const conv = prev && prev.leads > 0 ? (s.leads / prev.leads) * 100 : null;
                  const tone = s.funnel_step ? STEP_TONE[s.funnel_step] : undefined;
                  return (
                    <button
                      key={s.stage_id}
                      onClick={() => s.leads > 0 && setStage(s)}
                      className={`group grid w-full grid-cols-12 items-center gap-3 rounded-lg border border-white/[0.04] px-3 py-2.5 text-left transition ${
                        s.leads > 0 ? "cursor-pointer hover:bg-card/70" : "opacity-50"
                      }`}
                    >
                      <div className="col-span-12 flex items-center gap-2 sm:col-span-5">
                        <span className="text-sm font-medium">{s.name}</span>
                        {tone && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${tone}`}>
                            {s.funnel_step}
                          </span>
                        )}
                        {s.semantics === "S" && <Badge variant="secondary">ganho</Badge>}
                        {s.semantics === "F" && <Badge variant="outline">perda</Badge>}
                      </div>
                      <div className="col-span-7 sm:col-span-4">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${(s.leads / maxLeads) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="col-span-5 text-right text-xs sm:col-span-3">
                        <span className="font-semibold">{nfmt(s.leads)}</span>
                        <span className="text-muted-foreground"> · {pctfmt(share, 1)}</span>
                        {conv != null && (
                          <span className="block text-[11px] text-muted-foreground/80">
                            {pctfmt(conv, 1)} da etapa anterior
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CohortCard
        cohort={cohort.data}
        isLoading={cohort.isLoading}
        origem={ORIGEM_TABS[origemIdx]!.label}
      />

      <StageMapping filters={filters} origem={origem} />

      <StageLeadsSheet
        stage={stage}
        pipelineName={active?.name ?? ""}
        filters={filters}
        origem={origem}
        onClose={() => setStage(null)}
      />
    </div>
  );
}

function CohortCard({
  cohort,
  isLoading,
  origem,
}: {
  cohort: FunnelCohort | undefined;
  isLoading: boolean;
  origem: string;
}) {
  const etapas = useMemo(
    () =>
      (cohort?.etapas ?? [])
        .filter((e) => e.etapa !== "perdido")
        .slice()
        .sort((a, b) => a.rank - b.rank),
    [cohort],
  );
  const total = (cohort?.coorte ?? []).reduce((s, c) => s + c.leads, 0);
  const semHistorico = cohort?.sem_historico ?? 0;
  const noPeriodo = total + semHistorico;
  const primeiro = etapas[0];
  const base = primeiro?.total ?? 0;

  return (
    <Card className="border-white/[0.06] bg-card/40">
      <CardHeader>
        <CardTitle className="text-base">Aproveitamento por coorte · {origem}</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Dos {nfmt(noPeriodo)} leads criados no período, quantos chegaram a cada etapa — contagem
          cumulativa (chegou aqui ou além) pelo histórico de etapas do CRM. Quem o time moveu de
          Qualificado direto para Tentativa continua contando nas duas: por isso a coluna "da etapa
          anterior" nunca passa de 100%.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !etapas.length ? (
          <p className="text-sm text-muted-foreground">
            Sem histórico de etapas para os leads deste período. Rode a sincronização do histórico
            do CRM para habilitar esta leitura.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Chegaram ou passaram</TableHead>
                  <TableHead className="text-right">Da coorte medida</TableHead>
                  <TableHead className="text-right">Avanço da etapa anterior</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etapas.map((e) => {
                  const anterior = etapas[etapas.indexOf(e) - 1];
                  const daCoorte = base ? (e.total / base) * 100 : 0;
                  const conv = anterior && anterior.total > 0 ? (e.total / anterior.total) * 100 : null;
                  const tone = STEP_TONE[e.etapa];
                  return (
                    <TableRow key={`${e.rank}-${e.etapa}`}>
                      <TableCell>
                        <span className="flex items-center gap-2 text-sm">
                          {e.etapa}
                          {tone && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ring-1 ${tone}`}>
                              {e.rank}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{nfmt(e.total)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {pctfmt(daCoorte, 1)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {conv != null ? `${pctfmt(conv, 1)} de ${nfmt(anterior!.total)}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Base da coorte: {nfmt(total)} leads com histórico no CRM, de {nfmt(noPeriodo)} no
              período
              {semHistorico > 0 && ` · ${nfmt(semHistorico)} ainda sem histórico sincronizado`}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-card/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StageLeadsSheet({
  stage,
  pipelineName,
  filters,
  origem,
  onClose,
}: {
  stage: BitrixStageRow | null;
  pipelineName: string;
  filters: { from: string; to: string };
  origem: string[] | null;
  onClose: () => void;
}) {
  const fetchLeads = useServerFn(getBitrixStageLeads);
  const leads = useQuery({
    queryKey: ["bitrix-stage-leads", stage?.stage_id, filters.from, filters.to, origem],
    queryFn: () =>
      fetchLeads({
        data: { stageId: stage!.stage_id, from: filters.from, to: filters.to, origem },
      }),
    enabled: Boolean(stage),
  });

  const rows = leads.data ?? [];

  return (
    <Sheet open={Boolean(stage)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {stage?.name}
            <span className="block text-xs font-normal text-muted-foreground">
              {pipelineName} · {nfmt(rows.length)} leads
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                `leads-${stage?.stage_id ?? "etapa"}.csv`,
                toCsv(
                  ["Nome", "Deal ID", "Entrada", "Canal", "Campanha", "Valor"],
                  rows.map((r) => [
                    r.titulo ?? "",
                    r.bitrix_deal_id,
                    r.data_criacao ?? "",
                    r.origem ?? "",
                    r.campaign_name ?? "",
                    r.valor ?? 0,
                  ]),
                ),
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        {leads.isLoading ? (
          <Skeleton className="mt-4 h-48 w-full" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Deal ID</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.bitrix_deal_id}>
                    <TableCell className="max-w-[220px] truncate">{r.titulo ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.bitrix_deal_id}</TableCell>
                    <TableCell className="text-xs">
                      {r.data_criacao
                        ? new Date(r.data_criacao).toLocaleDateString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.origem ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{currency(r.valor ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum lead nesta etapa no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

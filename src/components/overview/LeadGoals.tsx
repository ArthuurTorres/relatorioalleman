import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { copyPreviousMonthGoals, getLeadGoalsProgress, saveLeadGoals } from "@/lib/goals.functions";
import { nfmt } from "@/lib/dashboard-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MetaIcon, GoogleAdsIcon } from "@/components/brand-icons";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Status = "sem-meta" | "atingida" | "ritmo" | "atencao" | "risco";

const STATUS_LABEL: Record<Status, string> = {
  "sem-meta": "Sem meta definida",
  atingida: "Meta atingida",
  ritmo: "No ritmo",
  atencao: "Atenção",
  risco: "Em risco",
};

const STATUS_TONE: Record<Status, string> = {
  "sem-meta": "text-muted-foreground bg-white/[0.05]",
  atingida: "text-emerald-300 bg-emerald-400/10",
  ritmo: "text-emerald-300 bg-emerald-400/10",
  atencao: "text-amber-300 bg-amber-400/10",
  risco: "text-red-300 bg-red-400/10",
};

const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function nowSaoPaulo() {
  const [y, m] = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-").map(Number);
  return { year: y ?? 2026, month: m ?? 1 };
}

export function LeadGoals() {
  const initial = nowSaoPaulo();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [view, setView] = useState<"cards" | "tabela">("cards");

  const progressFn = useServerFn(getLeadGoalsProgress);
  const q = useQuery({
    queryKey: ["lead-goals-progress", year, month],
    queryFn: () => progressFn({ data: { year, month } }),
  });

  const d = q.data;
  const elapsed = Math.max(1, d?.elapsedDays ?? 1);
  const days = d?.monthDays ?? 30;
  const remainingDays = Math.max(0, days - (d?.elapsedDays ?? 0));

  const rows = useMemo(() => {
    return (d?.rows ?? []).map((r) => {
      const entregue = r.google + r.meta;
      const goal = r.meta_leads;
      const pct = goal > 0 ? (entregue / goal) * 100 : null;
      const restantes = goal > 0 ? Math.max(0, goal - entregue) : 0;
      const mediaDia = entregue / elapsed;
      const necessarioDia = goal > 0 && restantes > 0 ? (remainingDays > 0 ? restantes / remainingDays : restantes) : 0;
      const projecao = mediaDia * days;
      const esperado = goal > 0 ? (goal * (d?.elapsedDays ?? 0)) / days : 0;
      const ritmo = esperado > 0 ? (entregue / esperado) * 100 : null;
      let status: Status = "sem-meta";
      if (goal > 0) {
        if (entregue >= goal) status = "atingida";
        else if ((ritmo ?? 0) >= 95) status = "ritmo";
        else if ((ritmo ?? 0) >= 75) status = "atencao";
        else status = "risco";
      }
      const excedente = goal > 0 ? Math.max(0, entregue - goal) : 0;
      return { ...r, entregue, pct, restantes, mediaDia, necessarioDia, projecao, status, excedente };
    });
  }, [d, elapsed, days, remainingDays]);

  const totals = useMemo(() => {
    const valid = rows.filter((r) => r.meta_leads > 0);
    const metaTotal = valid.reduce((a, r) => a + r.meta_leads, 0);
    const entregue = valid.reduce((a, r) => a + r.entregue, 0);
    const google = rows.reduce((a, r) => a + r.google, 0);
    const meta = rows.reduce((a, r) => a + r.meta, 0);
    const pct = metaTotal > 0 ? (entregue / metaTotal) * 100 : null;
    const restantes = Math.max(0, metaTotal - entregue);
    const projecao = (entregue / elapsed) * days;
    return { metaTotal, entregue, google, meta, pct, restantes, projecao, excedente: Math.max(0, entregue - metaTotal) };
  }, [rows, elapsed, days]);

  return (
    <div className="space-y-4">
      <div className="bento-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold">Metas de leads por operadora</h3>
            <p className="text-[11px] text-muted-foreground">
              Dia {d?.elapsedDays ?? 0} de {days} · {remainingDays} dia(s) restante(s)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-card/60 px-2.5 py-1.5 text-[12px]"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-card/60 px-2.5 py-1.5 text-[12px]"
            >
              {[initial.year - 1, initial.year, initial.year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-card/40 p-0.5">
              {(["cards", "tabela"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={
                    view === v
                      ? "rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-medium capitalize text-primary"
                      : "rounded-md px-2.5 py-1 text-[11px] capitalize text-muted-foreground hover:text-foreground"
                  }
                >
                  {v}
                </button>
              ))}
            </div>
            <ManageGoals year={year} month={month} rows={d?.rows ?? []} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card label="Meta total" value={nfmt(totals.metaTotal)} hint="Somente operadoras com meta" />
          <Card
            label="Total entregue"
            value={nfmt(totals.entregue)}
            hint={`Google ${nfmt(totals.google)} · Meta ${nfmt(totals.meta)}`}
          />
          <Card
            label="% atingido"
            value={totals.pct == null ? "—" : `${dec(totals.pct)}%`}
            hint={totals.excedente > 0 ? `Excedente ${nfmt(totals.excedente)}` : "—"}
            tone={totals.pct == null ? undefined : totals.pct >= 100 ? "text-emerald-300" : totals.pct >= 75 ? "text-amber-300" : "text-red-300"}
          />
          <Card label="Leads restantes" value={nfmt(totals.restantes)} hint={remainingDays > 0 ? `${dec(totals.restantes / remainingDays)}/dia` : "—"} />
          <Card label="Projeção de fechamento" value={nfmt(Math.round(totals.projecao))} hint={`Média ${dec(totals.entregue / elapsed)}/dia`} />
        </div>
      </div>

      <div className="bento-card p-0">
        {q.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando metas…</p>
        ) : q.isError ? (
          <p className="p-8 text-center text-sm text-red-300">Não foi possível carregar as metas.</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma meta cadastrada para {MONTHS[month - 1]}/{year}. Use “Gerenciar metas”.
          </p>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/[0.06] bg-card/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-semibold">{r.operadora}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] ${STATUS_TONE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="font-display text-2xl font-semibold tabular-nums">{nfmt(r.entregue)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    meta <span className="tabular-nums text-foreground">{r.meta_leads > 0 ? nfmt(r.meta_leads) : "—"}</span>
                  </p>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, r.pct ?? 0)}%`, background: "var(--grad-accent)" }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span
                    className={
                      r.pct == null
                        ? "text-muted-foreground"
                        : r.pct >= 100
                          ? "text-emerald-300"
                          : r.pct >= 75
                            ? "text-amber-300"
                            : "text-red-300"
                    }
                  >
                    {r.pct == null ? "Sem meta" : `${dec(r.pct)}%`}
                  </span>
                  <span className="text-muted-foreground/70">
                    {r.excedente > 0 ? `+${nfmt(r.excedente)} excedente` : r.meta_leads > 0 ? `faltam ${nfmt(r.restantes)}` : ""}
                  </span>
                </div>

<div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <GoogleAdsIcon className="h-4 w-4" /> Google Ads
                    </p>
                    <p className="mt-0.5 tabular-nums text-[oklch(0.78_0.14_230)]">{nfmt(r.google)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MetaIcon className="h-4 w-4" /> Meta Ads
                    </p>
                    <p className="mt-0.5 tabular-nums text-[oklch(0.7_0.19_305)]">{nfmt(r.meta)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Média/dia</p>
                    <p className="mt-0.5 tabular-nums">{dec(r.mediaDia)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nec./dia</p>
                    <p className="mt-0.5 tabular-nums">{r.meta_leads > 0 ? dec(r.necessarioDia) : "—"}</p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  Projeção {nfmt(Math.round(r.projecao))} leads no mês
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1000px] text-[12px]">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="border-b border-white/[0.06] text-left text-[11px] text-muted-foreground">
                  <th className="px-3 py-2.5">Operadora</th>
<th className="px-3 py-2.5 text-right">Meta</th>
                  <th className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1"><GoogleAdsIcon className="h-4 w-4" /> Google Ads</span>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1"><MetaIcon className="h-4 w-4" /> Meta Ads</span>
                  </th>
                  <th className="px-3 py-2.5 text-right">Entregue</th>
                  <th className="px-3 py-2.5 w-[160px]">Progresso</th>
                  <th className="px-3 py-2.5 text-right">%</th>
                  <th className="px-3 py-2.5 text-right">Média/dia</th>
                  <th className="px-3 py-2.5 text-right">Nec./dia</th>
                  <th className="px-3 py-2.5 text-right">Projeção</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium">{r.operadora}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.meta_leads > 0 ? nfmt(r.meta_leads) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[oklch(0.78_0.14_230)]">{nfmt(r.google)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[oklch(0.7_0.19_305)]">{nfmt(r.meta)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{nfmt(r.entregue)}</td>
                    <td className="px-3 py-2.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, r.pct ?? 0)}%`, background: "var(--grad-accent)" }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.pct == null ? "—" : `${dec(r.pct)}%`}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{dec(r.mediaDia)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.meta_leads > 0 ? dec(r.necessarioDia) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{nfmt(Math.round(r.projecao))}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-md px-2 py-1 text-[11px] ${STATUS_TONE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                        {r.excedente > 0 ? ` · +${nfmt(r.excedente)}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {d ? (
          <p className="px-3 py-3 text-[11px] text-muted-foreground/70">
            Leads reais das integrações (Bitrix/Meta/Google). Sem correspondência de operadora neste mês: Google{" "}
            {nfmt(d.unmatched.google)} · Meta {nfmt(d.unmatched.meta)} — ajuste os termos em “Gerenciar metas”.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Card({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

type EditRow = { operadora: string; meta_leads: string; match_terms: string };

function ManageGoals({
  year,
  month,
  rows,
}: {
  year: number;
  month: number;
  rows: Array<{ operadora: string; meta_leads: number; match_terms: string[] }>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<EditRow[]>([]);
  const qc = useQueryClient();
  const saveFn = useServerFn(saveLeadGoals);
  const copyFn = useServerFn(copyPreviousMonthGoals);

  const openDialog = (o: boolean) => {
    if (o) {
      setItems(
        rows.map((r) => ({
          operadora: r.operadora,
          meta_leads: String(r.meta_leads),
          match_terms: (r.match_terms ?? []).join(", "),
        })),
      );
    }
    setOpen(o);
  };

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          year,
          month,
          items: items
            .filter((i) => i.operadora.trim())
            .map((i, idx) => ({
              operadora: i.operadora,
              meta_leads: Number(i.meta_leads) || 0,
              match_terms: i.match_terms.split(",").map((t) => t.trim()).filter(Boolean),
              sort_order: idx + 1,
            })),
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lead-goals-progress"] });
      setOpen(false);
    },
  });

  const copy = useMutation({
    mutationFn: () => copyFn({ data: { year, month } }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["lead-goals-progress"] });
      if (res?.copied) setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-[12px]">
          Gerenciar metas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[15px]">
            Metas de leads — {MONTHS[month - 1]}/{year}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => copy.mutate()} disabled={copy.isPending}>
            {copy.isPending ? "Duplicando…" : "Duplicar metas do mês anterior"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-[12px]"
            onClick={() => setItems((p) => [...p, { operadora: "", meta_leads: "0", match_terms: "" }])}
          >
            + Adicionar operadora
          </Button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_90px_1.4fr_32px] gap-2 text-[11px] text-muted-foreground">
            <span>Operadora</span>
            <span>Meta</span>
            <span>Termos de correspondência (separados por vírgula)</span>
            <span />
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_90px_1.4fr_32px] gap-2">
              <Input
                value={it.operadora}
                onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, operadora: e.target.value } : x)))}
                className="h-8 text-[12px]"
              />
              <Input
                inputMode="numeric"
                value={it.meta_leads}
                onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, meta_leads: e.target.value } : x)))}
                className="h-8 text-[12px]"
              />
              <Input
                value={it.match_terms}
                onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, match_terms: e.target.value } : x)))}
                className="h-8 text-[12px]"
                placeholder="ex.: bensaude, ben saude"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[12px] text-red-300"
                onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
              >
                ×
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" className="h-8 text-[12px]" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar metas"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          Os termos são usados para associar cada lead (campanha, anúncio, domínio ou título) à operadora. Metas iguais a
          zero aparecem como “Sem meta definida” e não entram no percentual geral.
        </p>
      </DialogContent>
    </Dialog>
  );
}

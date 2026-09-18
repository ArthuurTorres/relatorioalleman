import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { searchLeadsByTerm, type Filters } from "@/lib/utm.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

const num = (n: number) => Number(n).toLocaleString("pt-BR");
const currency = (n: number) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SUGGESTIONS = ["Meta - FB TRIVE", "Santa Casa", "São Camilo", "Bensaúde", "Oeste Saúde"];

export function TermSearch({ filters }: { filters: Filters }) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const fn = useServerFn(searchLeadsByTerm);

  const q = useQuery({
    queryKey: ["term-search", term, filters.from, filters.to],
    queryFn: () => fn({ data: { ...filters, term } }),
    enabled: term.length > 1,
  });

  const r = q.data;

  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-5 space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Rastreio por termo
        </p>
        <p className="font-display text-base mt-1">
          Busque por nome de formulário, campanha, anúncio, UTM ou domínio
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(input.trim());
        }}
      >
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='ex.: Meta - FB TRIVE'
            className="pl-9 h-9 bg-card/40 border-white/10"
          />
        </div>
        <Button type="submit" size="sm" className="h-9">Buscar</Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setInput(s);
              setTerm(s);
            }}
            className="text-[11px] rounded-full border border-white/10 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            {s}
          </button>
        ))}
      </div>

      {term.length > 1 && (
        q.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : r ? (
          r.total === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum lead encontrado para “{term}” no período selecionado.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Leads encontrados" value={num(r.total)} highlight />
                <Stat label="Valor" value={currency(r.valor)} />
                <Stat
                  label="Por origem"
                  value={Object.entries(r.byOrigem)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(" · ")}
                />
                <Stat label="Sem atribuição de anúncio" value={num(r.semAtribuicao)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <TopList title="Campanhas" items={r.byCampaign} />
                <TopList title="Anúncios" items={r.byAd} />
                <TopList title="Formulários" items={r.byForm} />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Dia a dia (horário de Brasília)
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {r.daily.map((d) => (
                    <Badge key={d.day} variant="secondary" className="text-[11px] tabular-nums">
                      {d.day.slice(5).split("-").reverse().join("/")} · {d.count}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : null
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-white/5 bg-card/30"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-1 tabular-nums break-words">{value}</p>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-white/5 bg-card/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-foreground/80" title={i.label}>{i.label}</span>
            <span className="tabular-nums font-semibold shrink-0">{i.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

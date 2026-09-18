import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Filter, LayoutGrid, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCampaignOptions, type Canal } from "@/lib/campaigns.functions";
import { GoogleAdsIcon, MetaIcon } from "@/components/brand-icons";
import { currency } from "@/lib/dashboard-utils";

export type CampaignRef = { canal: Canal; id: string; name: string };
/** Seleção do filtro: vazio = todas as campanhas; 2+ = modo comparação. */
export type CampaignSelection = CampaignRef[];

const CANAIS: Array<{ key: "todos" | Canal; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "meta", label: "Meta Ads" },
  { key: "google", label: "Google Ads" },
];

const sameRef = (a: CampaignRef, b: CampaignRef) => a.canal === b.canal && a.id === b.id;

export function CampaignPicker({
  from,
  to,
  canal,
  onCanalChange,
  selected,
  onSelect,
}: {
  from: string;
  to: string;
  canal: "todos" | Canal;
  onCanalChange: (c: "todos" | Canal) => void;
  selected: CampaignSelection;
  onSelect: (s: CampaignSelection) => void;
}) {
  const optionsFn = useServerFn(getCampaignOptions);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["campaign-options", from, to],
    queryFn: () => optionsFn({ data: { from, to } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const list = useMemo(() => {
    const all = query.data ?? [];
    const byCanal = canal === "todos" ? all : all.filter((c) => c.canal === canal);
    const term = q.trim().toLowerCase();
    return term ? byCanal.filter((c) => c.name.toLowerCase().includes(term)) : byCanal;
  }, [query.data, canal, q]);

  const toggle = (ref: CampaignRef) => {
    const exists = selected.some((s) => sameRef(s, ref));
    onSelect(exists ? selected.filter((s) => !sameRef(s, ref)) : [...selected, ref]);
  };

  const triggerLabel =
    selected.length === 0
      ? "Todas as campanhas"
      : selected.length === 1
        ? selected[0]!.name
        : `${selected.length} campanhas comparadas`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="h-3.5 w-3.5 text-primary" />
        Filtro por campanha
      </span>
      <div className="flex gap-0.5 rounded-xl border border-white/10 bg-card/40 p-1 backdrop-blur">
        {CANAIS.map((c) => (
          <button
            key={c.key}
            onClick={() => {
              onCanalChange(c.key);
              if (c.key !== "todos") onSelect(selected.filter((s) => s.canal === c.key));
            }}
            className={canal === c.key ? "filter-chip filter-chip-active" : "filter-chip hover:bg-white/5 hover:text-foreground"}
          >
            {c.key === "meta" && <MetaIcon className="mr-1 inline h-4 w-4 align-[-2px]" />}
            {c.key === "google" && <GoogleAdsIcon className="mr-1 inline h-4 w-4 align-[-2px]" />}
            {c.label}
          </button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 max-w-[320px] justify-between gap-2 border-white/10 bg-card/40">
            <span className="flex min-w-0 items-center gap-1.5">
              {selected.length === 1 && selected[0]!.canal === "meta" && <MetaIcon className="h-4 w-4 shrink-0" />}
              {selected.length === 1 && selected[0]!.canal === "google" && <GoogleAdsIcon className="h-4 w-4 shrink-0" />}
              {selected.length !== 1 && <LayoutGrid className="h-4 w-4 shrink-0 text-primary" />}
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,420px)] p-0">
          <div className="border-b border-white/10 p-2">
            <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filtrar relatório por campanha
            </p>
            <p className="px-1 pb-2 text-[11px] text-muted-foreground/80">
              Selecione duas ou mais para comparar lado a lado.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campanha" className="h-9 pl-8 text-[13px]" />
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto p-1.5">
            <button
              onClick={() => { onSelect([]); setOpen(false); }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5"
            >
              <span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-primary" /> Todas as campanhas</span>
              {selected.length === 0 && <Check className="h-4 w-4 text-primary" />}
            </button>
            {query.isLoading && <p className="px-2.5 py-3 text-sm text-muted-foreground">Carregando campanhas…</p>}
            {!query.isLoading && list.length === 0 && (
              <p className="px-2.5 py-3 text-sm text-muted-foreground">Sem dados para o período</p>
            )}
            {list.map((c) => {
              const checked = selected.some((s) => sameRef(s, { canal: c.canal, id: c.id, name: c.name }));
              return (
                <button
                  key={`${c.canal}-${c.id}`}
                  onClick={() => toggle({ canal: c.canal, id: c.id, name: c.name })}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary/20" : "border-white/20"}`}
                    >
                      {checked && <Check className="h-3 w-3 text-primary" />}
                    </span>
                    {c.canal === "meta" ? <MetaIcon className="h-4 w-4 shrink-0" /> : <GoogleAdsIcon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{currency(c.spend)}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <Badge variant="secondary" className="gap-1.5">
          {selected.length === 1 ? "Campanha individual" : `Comparando ${selected.length} campanhas`}
          <button className="underline underline-offset-2" onClick={() => onSelect([])}>limpar</button>
        </Badge>
      )}
    </div>
  );
}

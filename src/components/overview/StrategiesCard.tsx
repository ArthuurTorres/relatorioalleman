import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStrategySettingsFn, updateStrategySettingsFn, type StrategySetting } from "@/lib/strategy-settings.functions";

const SECTION_LABELS: Record<string, string> = {
  regioes: "Regiões",
  publico_alvo: "Público-alvo",
  estrategias: "Estratégias",
};

export function StrategiesCard() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [newItems, setNewItems] = useState<string[]>([]);
  const [updateBy, setUpdateBy] = useState("");
  const [msg, setMsg] = useState<string>("");

  const { data: settingsData } = useQuery({
    queryKey: ["strategy-settings"],
    queryFn: () => getStrategySettingsFn(),
  });

  const settings = settingsData?.reduce((acc: Record<string, string[]>, r: StrategySetting) => {
    acc[r.section] = r.items;
    return acc;
  }, {}) ?? {};

  const saveMutation = useMutation({
    mutationFn: ({ section, items, updated_by }: { section: string; items: string[]; updated_by: string }) =>
      updateStrategySettingsFn({ data: { section, items, updated_by } }),
    onSuccess: (_, { section }) => {
      qc.invalidateQueries({ queryKey: ["strategy-settings"] });
      setMsg(`✅ ${SECTION_LABELS[section] || section} atualizado por ${updateBy}`);
      setEditing(null);
      setNewItems([]);
      setUpdateBy("");
    },
    onError: (e: any) => setMsg(`❌ Erro: ${e.message?.substring(0, 80) ?? "falha ao salvar"}`),
  });

  function startEdit(section: string) {
    setEditing(section);
    setNewItems(settings[section] ?? []);
    setUpdateBy("");
    setMsg("");
  }

  function addItem() {
    const v = prompt("Novo item:")?.trim();
    if (v) setNewItems((prev) => [...prev, v]);
  }

  function removeItem(i: number) {
    setNewItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function editItem(i: number) {
    const v = prompt("Editar item:", newItems[i])?.trim();
    if (v) setNewItems((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }

  function commit() {
    if (!updateBy.trim()) return setMsg("Quem está alterando é obrigatório");
    saveMutation.mutate({ section: editing!, items: newItems, updated_by: updateBy.trim() });
  }

  return (
    <section className="bento-card p-5 sm:p-6">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Planejamento de Mídia
        </p>
        <h3 className="mt-0.5 font-display text-base font-semibold tracking-tight text-foreground">
          Estratégias, regiões e público-alvo
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Diretrizes alinhadas na reunião com a equipe de Trive e Alleman Corretora.
        </p>
      </div>

      {msg && (
        <p className="mb-3 text-sm text-center"
           style={{ color: msg.startsWith("✅") ? "var(--emerald)" : "var(--red)" }}>
          {msg}
        </p>
      )}

      {/* Exibir listas atuais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {(["regioes", "publico_alvo", "estrategias"] as const).map((section) => (
          <div key={section} className="space-y-2 p-3 rounded-lg border border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {SECTION_LABELS[section]}
              </p>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => startEdit(section)}
              >
                {editing === section ? "Cancelar" : "Editar"}
              </button>
            </div>

            {editing === section ? (
              <div className="space-y-2">
                {newItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => setNewItems((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                      className="flex-1 text-sm px-2 py-1 border border-input rounded bg-background"
                    />
                    <button
                      type="button"
                      className="text-red-500 hover:underline text-xs"
                      onClick={() => removeItem(i)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={addItem}
                >
                  + Adicionar item
                </button>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Seu nome ou e-mail"
                    value={updateBy}
                    onChange={(e) => setUpdateBy(e.target.value)}
                    className="flex-1 text-sm px-2 py-1 border border-input rounded bg-background"
                  />
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded hover:bg-primary/90"
                    onClick={commit}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <ul className="text-sm text-foreground/90 space-y-1">
                {settings[section]?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {!(settings[section]?.length) && (
                  <li className="text-muted-foreground">(nenhum registrado)</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
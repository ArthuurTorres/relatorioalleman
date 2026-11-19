import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
  type MarketingTask,
} from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CircleDot,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

type StatusKey = "todas" | "aberta" | "fazendo" | "feita";

const PRIORITY_META: Record<
  MarketingTask["priority"],
  { label: string; dot: string; text: string }
> = {
  alta: {
    label: "Alta",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-300",
  },
  media: {
    label: "Média",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  baixa: {
    label: "Baixa",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
};

function dueLabel(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA");
  const overdue = due < todayStr;
  const d = new Date(`${due}T12:00:00`);
  const text = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return { text, overdue };
}

export function TasksTab() {
  const getFn = useServerFn(getTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const deleteFn = useServerFn(deleteTask);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<StatusKey>("todas");
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<MarketingTask["priority"]>("media");
  const [newDue, setNewDue] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["marketing-tasks"],
    queryFn: () => getFn({ data: { includeDone: true } }),
    staleTime: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["marketing-tasks"] });

  const create = useMutation({
    mutationFn: (input: { title: string }) =>
      createFn({
        data: {
          title: input.title,
          priority: newPriority,
          due_date: newDue || null,
        },
      }),
    onSuccess: () => {
      invalidate();
      setNewTitle("");
      setNewDue("");
      setNewPriority("media");
      toast.success("Tarefa criada");
    },
    onError: () => toast.error("Não foi possível criar a tarefa"),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status?: MarketingTask["status"]; priority?: MarketingTask["priority"] }) =>
      updateFn({ data: input }),
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível atualizar a tarefa"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setConfirmingId(null);
      toast.success("Tarefa removida");
    },
    onError: () => toast.error("Não foi possível remover a tarefa"),
  });

  const all: MarketingTask[] = tasks.data ?? [];

  const counts = useMemo(
    () => ({
      todas: all.length,
      aberta: all.filter((t) => t.status === "aberta").length,
      fazendo: all.filter((t) => t.status === "fazendo").length,
      feita: all.filter((t) => t.status === "feita").length,
    }),
    [all],
  );

  const visible = useMemo(() => {
    if (filter === "todas") return all;
    return all.filter((t) => t.status === filter);
  }, [all, filter]);

  function submitNew() {
    const title = newTitle.trim();
    if (!title) return;
    create.mutate({ title });
  }

  return (
    <div className="space-y-4">
      {/* Nova tarefa */}
      <div className="bento-card p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Plus
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNew();
              }}
              placeholder="Nova tarefa… (Enter para criar)"
              aria-label="Título da nova tarefa"
              className="h-10 border-border bg-background pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={newPriority}
              onValueChange={(v) => setNewPriority(v as MarketingTask["priority"])}
            >
              <SelectTrigger aria-label="Prioridade da nova tarefa" className="h-10 w-[130px] border-border bg-background text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover text-popover-foreground">
                <SelectItem value="alta" className="text-xs">Prioridade alta</SelectItem>
                <SelectItem value="media" className="text-xs">Prioridade média</SelectItem>
                <SelectItem value="baixa" className="text-xs">Prioridade baixa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              aria-label="Prazo da nova tarefa (opcional)"
              className="h-10 w-[150px] border-border bg-background text-xs"
            />
            <Button
              type="button"
              onClick={submitNew}
              disabled={!newTitle.trim() || create.isPending}
              className="h-10 cursor-pointer gap-1.5 px-4 text-xs font-semibold"
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros com contadores */}
      <div
        role="group"
        aria-label="Filtrar tarefas por status"
        className="flex flex-wrap items-center gap-1.5"
      >
        {(
          [
            ["todas", "Todas"],
            ["aberta", "Abertas"],
            ["fazendo", "Fazendo"],
            ["feita", "Feitas"],
          ] as Array<[StatusKey, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "filter-chip h-8 gap-1.5 px-3 text-xs",
              filter === key
                ? "filter-chip-active"
                : "hover:bg-card hover:text-foreground",
            )}
          >
            {label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums",
                filter === key
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-card text-foreground",
              )}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {tasks.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : tasks.isError ? (
        <div className="bento-card p-8 text-center">
          <p className="font-display text-sm font-semibold text-red-700 dark:text-red-300">
            Não foi possível carregar as tarefas.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A tabela ainda pode não ter sido aplicada no Supabase (migration task_manager).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => tasks.refetch()}
            className="mt-4 cursor-pointer"
          >
            Tentar novamente
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="bento-card p-10 text-center">
          <CircleDot className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 font-display text-sm font-semibold text-foreground">
            {filter === "todas"
              ? "Nenhuma tarefa ainda"
              : `Nenhuma tarefa ${filter === "aberta" ? "aberta" : filter === "fazendo" ? "em andamento" : "concluída"}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie a primeira no campo acima — Enter cria na hora.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => {
            const prio = PRIORITY_META[task.priority];
            const due = dueLabel(task.due_date);
            const isDone = task.status === "feita";
            return (
              <li
                key={task.id}
                className={cn(
                  "bento-card flex flex-col gap-2 px-4 py-3 transition sm:flex-row sm:items-center sm:gap-3",
                  isDone && "opacity-70",
                )}
              >
                <Checkbox
                  checked={isDone}
                  onCheckedChange={(checked) =>
                    update.mutate({ id: task.id, status: checked ? "feita" : "aberta" })
                  }
                  aria-label={isDone ? `Reabrir tarefa ${task.title}` : `Concluir tarefa ${task.title}`}
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium text-foreground",
                      isDone && "line-through decoration-muted-foreground/50",
                    )}
                    title={task.detail ?? task.title}
                  >
                    {task.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className={cn("inline-flex items-center gap-1 font-medium", prio.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", prio.dot)} aria-hidden="true" />
                      {prio.label}
                    </span>
                    {due && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 tabular-nums",
                          due.overdue && !isDone
                            ? "font-semibold text-red-700 dark:text-red-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {due.overdue && !isDone ? (
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <CalendarClock className="h-3 w-3" aria-hidden="true" />
                        )}
                        {due.text}
                        {due.overdue && !isDone ? " · vencida" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Select
                    value={task.status}
                    onValueChange={(v) =>
                      update.mutate({ id: task.id, status: v as MarketingTask["status"] })
                    }
                  >
                    <SelectTrigger
                      aria-label={`Status da tarefa ${task.title}`}
                      className="h-8 w-[110px] border-border bg-background text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      <SelectItem value="aberta" className="text-xs">Aberta</SelectItem>
                      <SelectItem value="fazendo" className="text-xs">Fazendo</SelectItem>
                      <SelectItem value="feita" className="text-xs">Feita</SelectItem>
                    </SelectContent>
                  </Select>

                  {confirmingId === task.id ? (
                    <span className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove.mutate(task.id)}
                        disabled={remove.isPending}
                        className="h-8 cursor-pointer px-2 text-xs"
                      >
                        {remove.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" /> Confirmar
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingId(null)}
                        className="h-8 cursor-pointer px-2 text-xs text-muted-foreground"
                      >
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingId(task.id)}
                      aria-label={`Remover tarefa ${task.title}`}
                      className="h-8 w-8 cursor-pointer p-0 text-muted-foreground hover:text-red-700 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

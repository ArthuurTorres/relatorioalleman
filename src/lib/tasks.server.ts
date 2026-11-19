import { getClient } from "@/lib/utm.server";
import type { MarketingTask } from "@/lib/tasks.functions";

export async function listTasks(): Promise<MarketingTask[]> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("marketing_tasks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingTask[];
}

export async function insertTask(input: {
  title: string;
  detail?: string | null;
  priority: "baixa" | "media" | "alta";
  due_date?: string | null;
  created_by?: string | null;
}): Promise<MarketingTask> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("marketing_tasks")
    .insert({
      title: input.title.trim(),
      detail: input.detail ?? null,
      priority: input.priority,
      due_date: input.due_date ?? null,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MarketingTask;
}

export async function patchTask(
  id: string,
  patch: { status?: "aberta" | "fazendo" | "feita"; priority?: "baixa" | "media" | "alta" },
): Promise<MarketingTask> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("marketing_tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as MarketingTask;
}

export async function removeTask(id: string) {
  const supabase = await getClient();
  const { error } = await (supabase as any)
    .from("marketing_tasks")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

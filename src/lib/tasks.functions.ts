import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

const GetSchema = z.object({ includeDone: z.boolean().default(true) });

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().max(2000).optional().nullable(),
  priority: z.enum(["baixa", "media", "alta"]).default("media"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  created_by: z.string().max(80).optional().nullable(),
});

const UpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["aberta", "fazendo", "feita"]).optional(),
  priority: z.enum(["baixa", "media", "alta"]).optional(),
});

const DeleteSchema = z.object({ id: z.string().uuid() });

export type MarketingTask = {
  id: string;
  title: string;
  detail: string | null;
  priority: "baixa" | "media" | "alta";
  status: "aberta" | "fazendo" | "feita";
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const getTasks = createServerFn({ method: "POST" })
  .validator((d) => GetSchema.parse(d ?? {}))
  .handler(async () => {
    await requireUnlocked();
    const { listTasks } = await import("@/lib/tasks.server");
    return listTasks();
  });

export const createTask = createServerFn({ method: "POST" })
  .validator((d) => CreateSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { insertTask } = await import("@/lib/tasks.server");
    return insertTask(data);
  });

export const updateTask = createServerFn({ method: "POST" })
  .validator((d) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { patchTask } = await import("@/lib/tasks.server");
    return patchTask(data.id, { status: data.status, priority: data.priority });
  });

export const deleteTask = createServerFn({ method: "POST" })
  .validator((d) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { removeTask } = await import("@/lib/tasks.server");
    return removeTask(data.id);
  });

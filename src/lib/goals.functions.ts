import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

const Period = z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) });

const UpsertSchema = Period.extend({
  items: z.array(
    z.object({
      operadora: z.string().min(1),
      meta_leads: z.number(),
      match_terms: z.array(z.string()),
      sort_order: z.number().optional(),
    }),
  ),
});

export const getLeadGoals = createServerFn({ method: "POST" })
  .inputValidator((d) => Period.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { listGoals } = await import("@/lib/goals.server");
    return listGoals(data.year, data.month);
  });

export const getLeadGoalsProgress = createServerFn({ method: "POST" })
  .inputValidator((d) => Period.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { computeProgress } = await import("@/lib/goals.server");
    return computeProgress(data.year, data.month);
  });

export const saveLeadGoals = createServerFn({ method: "POST" })
  .inputValidator((d) => UpsertSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { upsertGoals } = await import("@/lib/goals.server");
    return upsertGoals(data.year, data.month, data.items);
  });

export const removeLeadGoal = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { deleteGoal } = await import("@/lib/goals.server");
    return deleteGoal(data.id);
  });

export const copyPreviousMonthGoals = createServerFn({ method: "POST" })
  .inputValidator((d) => Period.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { duplicatePreviousMonth } = await import("@/lib/goals.server");
    return duplicatePreviousMonth(data.year, data.month);
  });

export type LeadGoalsProgress = Awaited<ReturnType<typeof computeProgressType>>;
declare function computeProgressType(): Promise<{
  year: number;
  month: number;
  monthDays: number;
  elapsedDays: number;
  unmatched: { google: number; meta: number };
  rows: Array<{
    id: string;
    year: number;
    month: number;
    operadora: string;
    meta_leads: number;
    match_terms: string[];
    sort_order: number;
    google: number;
    meta: number;
  }>;
}>;

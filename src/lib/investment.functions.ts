import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

const Period = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

const SaveSchema = Period.extend({
  amount: z.number().min(0),
  note: z.string().max(500).optional().nullable(),
  channel: z.string().min(1).max(40).default("geral"),
});

export type InvestmentRecord = {
  id: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
  channel: string;
};

export const getInvestment = createServerFn({ method: "POST" })
  .validator((d) => Period.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { listInvestment } = await import("@/lib/investment.server");
    return listInvestment(data.year, data.month);
  });

export const saveInvestment = createServerFn({ method: "POST" })
  .validator((d) => SaveSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { upsertInvestment } = await import("@/lib/investment.server");
    return upsertInvestment(
      data.year,
      data.month,
      data.amount,
      data.note ?? null,
      data.channel,
    );
  });

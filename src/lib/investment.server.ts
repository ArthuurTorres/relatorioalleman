import { getClient } from "@/lib/utm.server";

export type InvestmentRow = {
  id: string;
  year: number;
  month: number;
  amount: number;
  note: string | null;
  channel: string;
};

export async function listInvestment(
  year: number,
  month: number,
): Promise<InvestmentRow[]> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("investment_registry")
    .select("id,year,month,amount,note,channel")
    .eq("year", year)
    .eq("month", month)
    .order("channel", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvestmentRow[];
}

export async function upsertInvestment(
  year: number,
  month: number,
  amount: number,
  note: string | null,
  channel: string,
) {
  const supabase = await getClient();
  const payload = {
    year,
    month,
    amount: Math.max(0, Math.round(amount * 100) / 100),
    note: note ?? null,
    channel: channel.trim() || "geral",
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase as any)
    .from("investment_registry")
    .upsert(payload, { onConflict: "year,month,channel" });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

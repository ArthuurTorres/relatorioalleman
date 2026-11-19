import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getClient } from "@/lib/utm.server";

export type StrategySetting = {
  id: number;
  section: string;
  items: string[];
  updated_by: string | null;
  updated_at: string;
};

export async function getStrategySettings(): Promise<StrategySetting[]> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("strategy_settings")
    .select("id, section, items, updated_by, updated_at")
    .order("section");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    ...r,
    items: Array.isArray(r.items) ? r.items : (r.items ? [r.items] : []),
  }));
}

export async function updateStrategySettings(
  section: string,
  items: string[],
  updated_by: string,
): Promise<void> {
  const supabase = await getClient();
  const { error } = await (supabase as any)
    .from("strategy_settings")
    .upsert(
      { section, items, updated_by, updated_at: new Date().toISOString() },
      { onConflict: "section" }
    );
  if (error) throw new Error(error.message);
}
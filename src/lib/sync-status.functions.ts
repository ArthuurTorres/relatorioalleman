import { createServerFn } from "@tanstack/react-start";
import { requireUnlocked } from "@/lib/gate.server";

export type SyncStatus = {
  bitrix_last_run: string | null;
  bitrix_last_status: string | null;
  meta_last_run: string | null;
  meta_last_status: string | null;
  last_lead_synced_at: string | null;
  last_lead_created_at: string | null;
};

export const getSyncStatus = createServerFn({ method: "GET" }).handler(async (): Promise<SyncStatus> => {
  await requireUnlocked();
  const empty: SyncStatus = {
    bitrix_last_run: null,
    bitrix_last_status: null,
    meta_last_run: null,
    meta_last_status: null,
    last_lead_synced_at: null,
    last_lead_created_at: null,
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [bitrix, meta, lead, created] = await Promise.all([
      supabaseAdmin.from("sync_state").select("last_run,last_status").eq("key", "bitrix_deals").maybeSingle(),
      supabaseAdmin.from("meta_sync_state").select("last_run,last_status").eq("key", "meta_ads").maybeSingle(),
      supabaseAdmin.from("utm_conversions").select("synced_at").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("utm_conversions").select("data_criacao").order("data_criacao", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return {
      bitrix_last_run: (bitrix.data as any)?.last_run ?? null,
      bitrix_last_status: (bitrix.data as any)?.last_status ?? null,
      meta_last_run: (meta.data as any)?.last_run ?? null,
      meta_last_status: (meta.data as any)?.last_status ?? null,
      last_lead_synced_at: (lead.data as any)?.synced_at ?? null,
      last_lead_created_at: (created.data as any)?.data_criacao ?? null,
    };
  } catch (error) {
    console.error("[getSyncStatus]", error);
    return empty;
  }
});

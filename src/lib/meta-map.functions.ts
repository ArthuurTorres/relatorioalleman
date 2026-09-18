import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

export type FormMapping = {
  form_label: string;
  campaign_id: string;
  campaign_name?: string | null;
  note: string | null;
  updated_at: string;
};

export type UnmappedLabel = {
  form_label: string;
  leads: number;
  ultimo: string;
  suggested_campaign_id: string | null;
  suggested_campaign_name: string | null;
  match_source: "manual" | "auto" | null;
};

export type CampaignOption = {
  id: string;
  name: string | null;
  status: string | null;
};

export const listFormMappings = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: maps, error } = await supabaseAdmin
    .from("meta_lead_form_map")
    .select("form_label,campaign_id,note,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set((maps || []).map((m) => m.campaign_id)));
  let names: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: camps } = await supabaseAdmin
      .from("meta_campaigns")
      .select("id,name")
      .in("id", ids);
    for (const c of camps || []) names[c.id] = c.name ?? null;
  }
  return (maps || []).map((m) => ({
    ...m,
    campaign_name: names[m.campaign_id] ?? null,
  })) as FormMapping[];
});

export const listUnmappedFormLabels = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("list_unmapped_form_labels");
  if (error) throw new Error(error.message);
  return (data || []) as UnmappedLabel[];
});

export const listMetaCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meta_campaigns")
    .select("id,name,effective_status")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.effective_status,
  })) as CampaignOption[];
});

const UpsertSchema = z.object({
  form_label: z.string().min(1),
  campaign_id: z.string().min(1),
  note: z.string().optional().nullable(),
});

export const upsertFormMapping = createServerFn({ method: "POST" })
  .inputValidator((d) => UpsertSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("meta_lead_form_map")
      .upsert(
        {
          form_label: data.form_label,
          campaign_id: data.campaign_id,
          note: data.note ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "form_label" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteSchema = z.object({ form_label: z.string().min(1) });

export const deleteFormMapping = createServerFn({ method: "POST" })
  .inputValidator((d) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("meta_lead_form_map")
      .delete()
      .eq("form_label", data.form_label);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

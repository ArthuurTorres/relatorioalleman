import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { getClient } from "@/lib/utm.server";

const FunnelSchema = z.object({
  from: z.string(),
  to: z.string(),
  origem: z.array(z.string()).nullable().optional(),
});

const StageLeadsSchema = z.object({
  stageId: z.string(),
  from: z.string(),
  to: z.string(),
  origem: z.array(z.string()).nullable().optional(),
});

export type BitrixStageRow = {
  stage_id: string;
  name: string;
  sort: number;
  semantics: string | null;
  funnel_step: string | null;
  leads: number;
};

export type BitrixPipelineRow = {
  id: string;
  name: string;
  total: number;
  stages: BitrixStageRow[];
};

export type BitrixPipelineFunnel = {
  total: number;
  sem_etapa: number;
  pipelines: BitrixPipelineRow[];
};

export type BitrixStageLead = {
  bitrix_deal_id: string;
  titulo: string | null;
  data_criacao: string | null;
  fase: string | null;
  origem: string | null;
  campaign_name: string | null;
  valor: number | null;
};

/** Espelho dos funis do Bitrix: leads por etapa, por funil. */
export const getBitrixPipelineFunnel = createServerFn({ method: "POST" })
  .inputValidator((d) => FunnelSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_bitrix_pipeline_funnel", {
      p_from: data.from,
      p_to: data.to,
      p_origem: data.origem ?? null,
    });
    if (error) throw new Error(error.message);
    return result as BitrixPipelineFunnel;
  });

/** Leads nominais de uma etapa específica do Bitrix. */
export const getBitrixStageLeads = createServerFn({ method: "POST" })
  .inputValidator((d) => StageLeadsSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_bitrix_stage_leads", {
      p_stage_id: data.stageId,
      p_from: data.from,
      p_to: data.to,
      p_origem: data.origem ?? null,
    });
    if (error) throw new Error(error.message);
    return (result ?? []) as BitrixStageLead[];
  });

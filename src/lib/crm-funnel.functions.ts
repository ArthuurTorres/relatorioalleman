import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { getClient } from "@/lib/utm.server";

const RangeSchema = z.object({ from: z.string(), to: z.string() });
const LeadsSchema = z.object({ campaignId: z.string(), from: z.string(), to: z.string() });

export type CampaignCrmRow = {
  campaign_id: string;
  campaign_name: string;
  leads_bitrix: number;
  novo: number;
  qualificados: number;
  tentativa: number;
  contatados: number;
  negociacao: number;
  vendas: number;
  perdidos: number;
  sem_etapa: number;
  por_manual: number;
  por_nome: number;
  receita: number;
};

export type CampaignCrmFunnel = {
  byCampaign: CampaignCrmRow[];
  totals: {
    leads_bitrix: number;
    leads_identificados: number;
    leads_nao_identificados: number;
    por_telefone?: number;
    por_email?: number;
    por_nome?: number;
  };
};

export type CampaignCrmLead = {
  bitrix_deal_id: string;
  titulo: string | null;
  data_criacao: string | null;
  fase: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  match_source: string | null;
  funnel_step: string;
  stage_label: string | null;
  valor: number | null;
};

/** Cruzamento agregado: campanhas do Meta × leads do Bitrix (por Campaign ID). */
export const getCampaignCrmFunnel = createServerFn({ method: "POST" })
  .inputValidator((d) => RangeSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_campaign_crm_funnel", {
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(error.message);
    return result as CampaignCrmFunnel;
  });

/** Lista nominal dos leads de uma campanha (use "__none__" para não identificados). */
export const getCampaignCrmLeads = createServerFn({ method: "POST" })
  .inputValidator((d) => LeadsSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_campaign_crm_leads", {
      p_campaign_id: data.campaignId,
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(error.message);
    return (result ?? []) as CampaignCrmLead[];
  });

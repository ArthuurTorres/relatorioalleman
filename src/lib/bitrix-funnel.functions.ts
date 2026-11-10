import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { getClient, fetchAll } from "@/lib/utm.server";

const FunnelSchema = z.object({
  from: z.string(),
  to: z.string(),
  origem: z.array(z.string()).nullable().optional(),
  pipeline: z.number().int().optional(),
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
  .validator((d) => FunnelSchema.parse(d))
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

export type StageMapRow = {
  stage_id: string;
  stage_name: string;
  sort: number;
  pipeline_id: string;
  pipeline_name: string;
  funnel_step: string | null;
  step_rank: number;
  leads: number;
};

export type StageMapping = {
  total: number;
  stages: StageMapRow[];
  orphans: { fase: string | null; leads: number }[];
};

/** Mapa de/para: etapas reais do Bitrix → etapa do funil comercial, com leads no período. */
export const getStageMapping = createServerFn({ method: "POST" })
  .validator((d) => FunnelSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();
    const { data: result, error } = await (supabase as any).rpc("get_stage_mapping", {
      p_from: data.from,
      p_to: data.to,
      p_origem: data.origem ?? null,
    });
    if (error) throw new Error(error.message);
    return result as StageMapping;
  });

/** Chegou a alguma etapa do funil, por origem (coorte dos leads criados no período). */
export type CohortStage = {
  rank: number;
  etapa: string;
  total: number;
  por_origem: Record<string, number>;
};

export type FunnelCohort = {
  coorte: { origem: string; leads: number }[];
  etapas: CohortStage[];
  /** Leads da coorte sem nenhuma etapa reconhecida no histórico (fora da medição). */
  sem_historico: number;
};

/** Funil comercial: onde o lead de mídia nasce e percorre o relacionamento. */
const PIPELINE_COMERCIAL = 0;

const PAGE = 1000;
const ID_CHUNK = 200;

/** Pipeline dono da etapa: as de outro funil vêm prefixadas como "C<id>:<etapa>". */
function pipelineOf(stageId: string): number {
  const match = /^C(\d+):/.exec(stageId);
  return match ? Number(match[1]) : 0;
}

/**
 * Aproveitamento por coorte: dos leads criados no período, quantos chegaram a
 * cada etapa do funil. A leitura é cumulativa ("chegou nesta etapa ou além")
 * porque no Bitrix o cartão nasce já numa etapa e é movido adiante: medir
 * etapa-a-etapa dava mais de 100% de aproveitamento.
 *
 * Só o funil comercial entra na conta. Passar por Declínios (7), Emissão (3) ou
 * Carteira (23) não é avanço de relacionamento e misturá-los distorcia a taxa.
 */
export const getFunnelCohort = createServerFn({ method: "POST" })
  .validator((d) => FunnelSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const supabase = await getClient();

    const { data: mapRows, error: mapError } = await supabase
      .from("bitrix_stage_map")
      .select("stage_id,funnel_step,step_rank");
    if (mapError) throw new Error(mapError.message);

    // De/para oficial (etapa real do CRM → etapa do funil). Quando a mesma etapa
    // aparece em mais de um passo, vale o mais avançado.
    const stageRank = new Map<string, { rank: number; etapa: string }>();
    for (const row of (mapRows ?? []) as {
      stage_id: string | null;
      funnel_step: string | null;
      step_rank: number | null;
    }[]) {
      if (!row.stage_id || !row.funnel_step) continue;
      if (pipelineOf(row.stage_id) !== PIPELINE_COMERCIAL) continue;
      const rank = Number(row.step_rank ?? 0);
      // Rank 0 é a etapa terminal negativa (perdido / sem qualificação): não é
      // degrau de relacionamento e não pode servir de numerador nem de base.
      if (rank < 1) continue;
      const current = stageRank.get(row.stage_id);
      if (!current || rank > current.rank) stageRank.set(row.stage_id, { rank, etapa: row.funnel_step });
    }

    const rankName = new Map<number, string>();
    for (const { rank, etapa } of stageRank.values()) {
      if (!rankName.has(rank)) rankName.set(rank, etapa);
    }
    const ranks = [...rankName.keys()].sort((a, b) => a - b);

    // Coorte = leads criados no período (o denominador do aproveitamento).
    const rows = await fetchAll(supabase, {
      from: data.from,
      to: data.to,
      origem: data.origem ?? undefined,
    });
    const deals = new Map<string, string>();
    for (const row of rows) {
      if (row.bitrix_deal_id) deals.set(row.bitrix_deal_id, row.origem ?? "Outros");
    }

    // Até onde cada lead da coorte realmente chegou (passagem registrada no histórico).
    const best = new Map<string, { rank: number; stage: string }>();
    const dealIds = [...deals.keys()];
    for (let i = 0; i < dealIds.length; i += ID_CHUNK) {
      const chunk = dealIds.slice(i, i + ID_CHUNK);
      for (let page = 0; ; page += PAGE) {
        const { data: history, error } = await supabase
          .from("bitrix_stage_history")
          .select("deal_id,stage_id")
          .in("deal_id", chunk)
          .order("deal_id")
          .range(page, page + PAGE - 1);
        if (error) throw new Error(error.message);
        const batch = (history ?? []) as { deal_id: string; stage_id: string | null }[];
        for (const hit of batch) {
          const mapped = hit.stage_id ? stageRank.get(hit.stage_id) : undefined;
          if (!mapped) continue;
          const previous = best.get(hit.deal_id);
          if (!previous || mapped.rank > previous.rank) {
            best.set(hit.deal_id, { rank: mapped.rank, stage: hit.stage_id! });
          }
        }
        if (batch.length < PAGE) break;
      }
    }

    const alcancou = new Map<number, { total: number; por_origem: Record<string, number> }>();
    for (const rank of ranks) alcancou.set(rank, { total: 0, por_origem: {} });
    for (const [dealId, reach] of best) {
      const origem = deals.get(dealId);
      if (!origem) continue;
      for (const rank of ranks) {
        if (rank > reach.rank) break;
        const acc = alcancou.get(rank)!;
        acc.total += 1;
        acc.por_origem[origem] = (acc.por_origem[origem] ?? 0) + 1;
      }
    }

    // O denominador é a coorte que entrou na medição: lead de mídia criado no
    // período e com alguma etapa registrada no funil comercial. O resto sai em
    // sem_historico para a taxa não ser distorcida por lead sem histórico.
    const porOrigem = new Map<string, number>();
    for (const [dealId] of best) {
      const origem = deals.get(dealId);
      if (origem) porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1);
    }

    return {
      coorte: [...porOrigem.entries()]
        .map(([origem, leads]) => ({ origem, leads }))
        .sort((a, b) => b.leads - a.leads),
      etapas: ranks.map((rank) => ({
        rank,
        etapa: rankName.get(rank)!,
        total: alcancou.get(rank)!.total,
        por_origem: alcancou.get(rank)!.por_origem,
      })),
      sem_historico: deals.size - best.size,
    } satisfies FunnelCohort;
  });

/** Leads nominais de uma etapa específica do Bitrix. */
export const getBitrixStageLeads = createServerFn({ method: "POST" })
  .validator((d) => StageLeadsSchema.parse(d))
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

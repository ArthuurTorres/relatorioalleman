type Filters = {
  from: string;
  to: string;
  origem?: string[];
  utm_source?: string[];
  utm_campaign?: string[];
  dominio?: string[];
};

type Row = {
  bitrix_deal_id: string;
  titulo: string | null;
  fase: string | null;
  valor: number | null;
  origem: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  campaign_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  adset_name: string | null;
  dominio: string | null;
  data_criacao: string | null;
};

export function applyFilters(query: any, f: Filters) {
  query = query.gte("data_criacao", f.from).lte("data_criacao", f.to);
  if (f.origem?.length) query = query.in("origem", f.origem);
  if (f.utm_source?.length) query = query.in("utm_source", f.utm_source);
  if (f.utm_campaign?.length) query = query.in("utm_campaign", f.utm_campaign);
  if (f.dominio?.length) query = query.in("dominio", f.dominio);
  return query;
}

export async function getClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function fetchAll(supabase: any, f: Filters): Promise<Row[]> {
  const cols = "bitrix_deal_id,titulo,fase,valor,origem,utm_source,utm_campaign,campaign_name,ad_id,ad_name,adset_name,dominio,data_criacao";
  const pageSize = 1000;
  let countQuery = supabase.from("utm_conversions").select("bitrix_deal_id", { count: "exact", head: true });
  countQuery = applyFilters(countQuery, f);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  const total = count ?? 0;
  if (total === 0) return [];

  const pages = Array.from({ length: Math.ceil(total / pageSize) }, (_, index) => index * pageSize);
  const results = await Promise.all(pages.map(async (from) => {
    let query = supabase.from("utm_conversions").select(cols);
    query = applyFilters(query, f);
    const { data, error } = await query
      .order("data_criacao", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    return (data || []) as Row[];
  }));

  return results.flat();
}
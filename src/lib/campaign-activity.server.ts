import { getClient } from "@/lib/utm.server";
import type { CampaignActivityRow } from "@/lib/campaign-activity.functions";

export async function fetchCampaignActivity(input: {
  from: string;
  to: string;
  campaignId?: string;
}): Promise<CampaignActivityRow[]> {
  const supabase = await getClient();
  let query = (supabase as any)
    .from("campaign_activity")
    .select(
      "id,campaign_id,campaign_name,field,old_value,new_value,source,occurred_at",
    )
    .gte("occurred_at", input.from)
    .lte("occurred_at", input.to)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (input.campaignId) query = query.eq("campaign_id", input.campaignId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CampaignActivityRow[];
}

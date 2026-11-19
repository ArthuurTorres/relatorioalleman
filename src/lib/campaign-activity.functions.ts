import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";

const QuerySchema = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  campaignId: z.string().optional(),
});

export type CampaignActivityRow = {
  id: number;
  campaign_id: string;
  campaign_name: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  source: string;
  occurred_at: string;
};

export const getCampaignActivity = createServerFn({ method: "POST" })
  .validator((d) => QuerySchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { fetchCampaignActivity } = await import("@/lib/campaign-activity.server");
    return fetchCampaignActivity(data);
  });

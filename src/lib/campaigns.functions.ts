import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { getCampaignDetail, listCampaigns } from "@/lib/campaigns.server";

export type { CampaignDetail, CampaignOption, Canal } from "@/lib/campaigns.server";

export const getCampaignOptions = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    return listCampaigns(data.from, data.to);
  });

export const getCampaignDetailFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ canal: z.enum(["meta", "google"]), id: z.string(), from: z.string(), to: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    return getCampaignDetail(data.canal, data.id, data.from, data.to);
  });

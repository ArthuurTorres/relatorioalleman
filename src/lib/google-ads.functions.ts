import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUnlocked } from "@/lib/gate.server";
import { fetchGoogleAdsPerformance } from "@/lib/google-ads.server";

export const getGoogleAdsPerformance = createServerFn({ method: "POST" })
  .validator((data) => z.object({ from: z.string(), to: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await requireUnlocked();
    return fetchGoogleAdsPerformance(data.from, data.to);
  });
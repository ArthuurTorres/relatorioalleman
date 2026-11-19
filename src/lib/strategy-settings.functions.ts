import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getStrategySettings, updateStrategySettings, type StrategySetting } from "@/lib/strategy-settings.server";
import { getClient } from "@/lib/utm.server";

export const getStrategySettingsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    return getStrategySettings();
  });

const UpdateStrategySchema = z.object({
  section: z.enum(["regioes", "publico_alvo", "estrategias"]),
  items: z.array(z.string()).min(1),
  updated_by: z.string().min(1),
});

export const updateStrategySettingsFn = createServerFn({ method: "POST" })
  .validator((d) => UpdateStrategySchema.parse(d))
  .handler(async ({ data }) => {
    await updateStrategySettings(data.section, data.items, data.updated_by);
    return { ok: true };
  });

// Re-export type for consumers
export type { StrategySetting };
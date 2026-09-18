import { createServerFn } from "@tanstack/react-start";
import {
  clearGateSession,
  getUnlockedState,
  markUnlocked,
  passwordMatches,
} from "@/lib/gate.server";

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.SITE_PASSWORD?.trim();
    if (!expected) throw new Error("SITE_PASSWORD não configurado");
    const input = (data.password ?? "").trim();
    if (!passwordMatches(input, expected)) return { ok: false as const };
    await markUnlocked();
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  await clearGateSession();
  return { ok: true as const };
});

export const isUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  return getUnlockedState();
});

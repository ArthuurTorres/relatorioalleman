import { redirect } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function getSessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET não configurado");

  return {
    password,
    name: "utm-dashboard-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function requireUnlocked() {
  const session = await useSession<GateSession>(getSessionConfig());
  if (!session.data.unlocked) throw redirect({ to: "/unlock" });
}

export async function markUnlocked() {
  const session = await useSession<GateSession>(getSessionConfig());
  await session.update({ unlocked: true });
}

export async function clearGateSession() {
  const session = await useSession<GateSession>(getSessionConfig());
  await session.clear();
}

export async function getUnlockedState() {
  const session = await useSession<GateSession>(getSessionConfig());
  return { unlocked: Boolean(session.data.unlocked) };
}
import { redirect } from "@tanstack/react-router";
import { getCookie, setCookie } from "@tanstack/start-server-core";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
}

function sessionHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

const SESSION_COOKIE = "utm-dashboard-gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Lê o estado de desbloqueio do cookie de sessão. */
function readUnlocked(): boolean {
  try {
    const raw = getCookie(SESSION_COOKIE);
    if (!raw) return false;
    const parsed = JSON.parse(decodeURIComponent(raw)) as GateSession;
    return Boolean(parsed.unlocked);
  } catch {
    return false;
  }
}

/** Grava o estado desbloqueado no cookie. */
function writeUnlocked(value: boolean) {
  const payload = encodeURIComponent(JSON.stringify({ unlocked: value }));
  setCookie(SESSION_COOKIE, payload, {
    maxAge: MAX_AGE,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

export async function requireUnlocked() {
  if (!readUnlocked()) throw redirect({ to: "/unlock" });
}

export async function markUnlocked() {
  writeUnlocked(true);
}

export async function clearGateSession() {
  setCookie(SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}

export async function getUnlockedState() {
  return { unlocked: readUnlocked() };
}

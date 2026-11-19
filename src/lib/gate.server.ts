import { redirect } from "@tanstack/react-router";
import {
  getCookie,
  getRequestHeader,
  getRequestProtocol,
  getRequestUrl,
  setCookie,
} from "@tanstack/start-server-core";
import { Buffer } from "node:buffer";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function getSessionSecret(): string | undefined {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.SITE_PASSWORD?.trim() ||
    process.env.GATE_PASSWORD?.trim() ||
    undefined
  );
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("hex");
}

const SESSION_COOKIE = "utm-dashboard-gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Lê e valida o estado de desbloqueio assinado com HMAC-SHA256 no cookie de sessão. */
function readUnlocked(): boolean {
  try {
    const raw = getCookie(SESSION_COOKIE);
    if (!raw) return false;

    const secret = getSessionSecret();
    if (!secret) return false;

    const dotIndex = raw.indexOf(".");
    if (dotIndex <= 0 || dotIndex !== raw.lastIndexOf(".")) {
      return false;
    }

    const encodedPayload = raw.slice(0, dotIndex);
    const providedSig = raw.slice(dotIndex + 1);
    if (!/^[0-9a-f]{64}$/i.test(providedSig)) {
      return false;
    }

    const expectedSig = signPayload(encodedPayload, secret);
    const a = Buffer.from(providedSig.toLowerCase(), "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return false;
    }

    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as GateSession;
    return parsed.unlocked === true;
  } catch {
    return false;
  }
}

function isHttpsRequest(): boolean {
  try {
    if (getRequestUrl({ xForwardedProto: false }).protocol === "https:") {
      return true;
    }
    const forwardedProto = getRequestHeader("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto) {
      return forwardedProto === "https";
    }
    const protocol = getRequestProtocol({ xForwardedProto: true }).toLowerCase();
    return protocol === "https" || protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function getGateCookieSecurityOptions(): {
  secure: boolean;
  sameSite: "none" | "lax";
} {
  if (isHttpsRequest()) {
    return { secure: true, sameSite: "none" };
  }
  return { secure: false, sameSite: "lax" };
}

/** Grava o estado desbloqueado assinado com HMAC-SHA256 no cookie. */
function writeUnlocked(value: boolean) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET ou SITE_PASSWORD não configurado");
  }
  const encodedPayload = Buffer.from(
    JSON.stringify({ unlocked: value }),
    "utf8",
  ).toString("base64url");
  const signature = signPayload(encodedPayload, secret);
  const token = `${encodedPayload}.${signature}`;
  const { secure, sameSite } = getGateCookieSecurityOptions();
  setCookie(SESSION_COOKIE, token, {
    maxAge: MAX_AGE,
    httpOnly: true,
    secure,
    sameSite,
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
  const { secure, sameSite } = getGateCookieSecurityOptions();
  setCookie(SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  });
}

export async function getUnlockedState() {
  return { unlocked: readUnlocked() };
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { AgentLoginToken } from "@/lib/db/schema";
import { cookieDomain, hostnameFromHost } from "@/lib/platform";

const COOKIE = "sf_agent";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const tokenId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 28);

function secret() {
  return process.env.AUTH_SESSION_SECRET ?? "dev-auth-secret-change-me";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function sessionSecure() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return process.env.NODE_ENV === "production" && !siteUrl.startsWith("http://");
}

async function cookieOptions() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? null;
  const domain = cookieDomain(hostnameFromHost(host));
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: sessionSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

export type AgentSession = {
  tenantId: string;
  email: string;
};

export async function getAgentSession(): Promise<AgentSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const [tenantId, email, exp] = payload.split("|");
  if (!tenantId || !email || !exp) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return { tenantId, email: email.toLowerCase() };
}

export async function attachAgentSession(
  response: NextResponse,
  session: AgentSession,
) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${session.tenantId}|${session.email.toLowerCase()}|${exp}`;
  const options = await cookieOptions();
  response.cookies.set(COOKIE, `${payload}.${sign(payload)}`, options);
  return response;
}

export async function clearAgentSession(response: NextResponse) {
  const options = await cookieOptions();
  response.cookies.set(COOKIE, "", { ...options, maxAge: 0 });
  return response;
}

export async function createAgentLoginToken(tenantId: string, email: string) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const token = tokenId();
  await qRun(
    db.insert(schema.agentLoginTokens).values({
      id: `alt_${tokenId()}`,
      tenantId,
      email: email.trim().toLowerCase(),
      token,
      expiresAt,
      consumedAt: null,
      createdAt,
    }),
  );
  return token;
}

export async function consumeAgentLoginToken(token: string) {
  const db = getDb();
  const row =
    (await qGet<AgentLoginToken>(
      db
        .select()
        .from(schema.agentLoginTokens)
        .where(eq(schema.agentLoginTokens.token, token)),
    )) ?? null;
  if (!row || row.consumedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  await qRun(
    db
      .update(schema.agentLoginTokens)
      .set({ consumedAt: new Date().toISOString() })
      .where(and(eq(schema.agentLoginTokens.id, row.id))),
  );
  return { tenantId: row.tenantId, email: row.email };
}

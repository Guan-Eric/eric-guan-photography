import { eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { decryptSecret, encryptSecret, signPayload, verifySignedPayload } from "@/lib/calendar-crypto";
import { getDb, qGet, qRun, schema } from "@/lib/db";
import type { CalendarConnection, Order } from "@/lib/db/schema";
import {
  deleteGoogleEvent,
  exchangeGoogleCode,
  externalBusyFromGoogleEvents,
  googleCalendarConfigured,
  googleOAuthUrl,
  googleUserEmail,
  listGoogleCalendars,
  listGoogleEvents,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  upsertGoogleEvent,
  type GoogleCalendarListItem,
} from "@/lib/google-calendar";
import { getTenantRow } from "@/lib/tenant-store";
import { getTenant } from "@/lib/tenants";

const id = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

function nowIso() {
  return new Date().toISOString();
}

export type CalendarPublicState = {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  calendarId: string | null;
  calendarName: string | null;
  blockExternalEvents: boolean;
  calendars: GoogleCalendarListItem[];
};

export function calendarOAuthStartUrl(state: string) {
  return googleOAuthUrl(state);
}

export function calendarSyncEnabled() {
  return googleCalendarConfigured();
}

export type CalendarOAuthState = {
  tenantId: string;
  userId: string;
  returnTo: string;
};

export function createCalendarOAuthState(payload: CalendarOAuthState) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 15 * 60 * 1000 }),
    "utf8",
  ).toString("base64url");
  return `${body}.${signPayload(body)}`;
}

export function parseCalendarOAuthState(state: string | null): CalendarOAuthState | null {
  if (!state) return null;
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  if (!verifySignedPayload(body, signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CalendarOAuthState & {
      exp?: number;
    };
    if (!parsed.tenantId || !parsed.userId || !parsed.returnTo) return null;
    if (typeof parsed.exp === "number" && parsed.exp < Date.now()) return null;
    return {
      tenantId: parsed.tenantId,
      userId: parsed.userId,
      returnTo: parsed.returnTo,
    };
  } catch {
    return null;
  }
}

export function safeCalendarReturnTo(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.pathname.startsWith("/admin")) return null;
    url.hash = "";
    url.search = "";
    url.pathname = "/admin/schedule";
    return url.toString();
  } catch {
    return null;
  }
}

export async function getCalendarConnection(tenantId: string) {
  const db = getDb();
  return (
    (await qGet<CalendarConnection>(
      db
        .select()
        .from(schema.calendarConnections)
        .where(eq(schema.calendarConnections.tenantId, tenantId)),
    )) ?? null
  );
}

export async function getCalendarPublicState(
  tenantId: string,
): Promise<CalendarPublicState> {
  const configured = calendarSyncEnabled();
  const connection = await getCalendarConnection(tenantId);
  if (!configured || !connection) {
    return {
      configured,
      connected: false,
      accountEmail: null,
      calendarId: null,
      calendarName: null,
      blockExternalEvents: false,
      calendars: [],
    };
  }

  let calendars: GoogleCalendarListItem[] = [];
  const access = await accessTokenFor(connection);
  if (access.ok) {
    const listed = await listGoogleCalendars(access.accessToken);
    if (listed.ok) calendars = listed.calendars;
  }

  return {
    configured,
    connected: true,
    accountEmail: connection.accountEmail,
    calendarId: connection.calendarId,
    calendarName: connection.calendarName,
    blockExternalEvents: connection.blockExternalEvents === 1,
    calendars,
  };
}

async function accessTokenFor(connection: CalendarConnection) {
  const refreshToken = decryptSecret(connection.refreshTokenEnc);
  if (!refreshToken) {
    return { ok: false as const, error: "Calendar reconnect required." };
  }

  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : 0;
  const accessToken = decryptSecret(connection.accessTokenEnc);
  if (accessToken && expiresAt - Date.now() > 60_000) {
    return { ok: true as const, accessToken, connection };
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  if (!refreshed.ok) {
    return { ok: false as const, error: refreshed.error };
  }

  const updated = await saveTokens(connection.tenantId, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? refreshToken,
    expiresIn: refreshed.expiresIn,
  });
  return {
    ok: true as const,
    accessToken: refreshed.accessToken,
    connection: updated ?? connection,
  };
}

async function saveTokens(
  tenantId: string,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();
  await qRun(
    db
      .update(schema.calendarConnections)
      .set({
        accessTokenEnc: encryptSecret(tokens.accessToken),
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: expiresAt,
        updatedAt: nowIso(),
      })
      .where(eq(schema.calendarConnections.tenantId, tenantId)),
  );
  return getCalendarConnection(tenantId);
}

export async function connectGoogleCalendar(options: {
  tenantId: string;
  code: string;
}) {
  if (!calendarSyncEnabled()) {
    return { ok: false as const, error: "Google Calendar is not configured." };
  }

  const tokens = await exchangeGoogleCode(options.code);
  if (!tokens.ok) return tokens;
  if (!tokens.refreshToken) {
    return {
      ok: false as const,
      error: "Google did not return a refresh token. Disconnect and connect again.",
    };
  }

  const email =
    tokens.email ?? (await googleUserEmail(tokens.accessToken)) ?? null;
  const listed = await listGoogleCalendars(tokens.accessToken);
  const primary =
    listed.ok
      ? listed.calendars.find((item) => item.primary) ?? listed.calendars[0]
      : null;

  const existing = await getCalendarConnection(options.tenantId);
  const db = getDb();
  const stamp = nowIso();
  const row = {
    accountEmail: email,
    calendarId: existing?.calendarId || primary?.id || "primary",
    calendarName: existing?.calendarName || primary?.summary || "Primary",
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: encryptSecret(tokens.refreshToken),
    tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    updatedAt: stamp,
  };

  if (existing) {
    await qRun(
      db
        .update(schema.calendarConnections)
        .set(row)
        .where(eq(schema.calendarConnections.id, existing.id)),
    );
  } else {
    await qRun(
      db.insert(schema.calendarConnections).values({
        id: `gcal_${id()}`,
        tenantId: options.tenantId,
        provider: "google",
        blockExternalEvents: 0,
        connectedAt: stamp,
        ...row,
      }),
    );
  }

  return { ok: true as const };
}

export async function disconnectGoogleCalendar(tenantId: string) {
  const connection = await getCalendarConnection(tenantId);
  if (connection) {
    const refresh = decryptSecret(connection.refreshTokenEnc);
    const access = decryptSecret(connection.accessTokenEnc);
    if (refresh) await revokeGoogleToken(refresh);
    else if (access) await revokeGoogleToken(access);
  }
  const db = getDb();
  await qRun(
    db
      .delete(schema.calendarConnections)
      .where(eq(schema.calendarConnections.tenantId, tenantId)),
  );
  return { ok: true as const };
}

export async function updateCalendarSettings(
  tenantId: string,
  patch: { blockExternalEvents?: boolean; calendarId?: string },
) {
  const connection = await getCalendarConnection(tenantId);
  if (!connection) {
    return { ok: false as const, error: "Connect Google Calendar first." };
  }

  let calendarName = connection.calendarName;
  if (patch.calendarId && patch.calendarId !== connection.calendarId) {
    const access = await accessTokenFor(connection);
    if (access.ok) {
      const listed = await listGoogleCalendars(access.accessToken);
      if (listed.ok) {
        const match = listed.calendars.find((item) => item.id === patch.calendarId);
        calendarName = match?.summary ?? patch.calendarId;
      }
    } else {
      calendarName = patch.calendarId;
    }
  }

  const db = getDb();
  await qRun(
    db
      .update(schema.calendarConnections)
      .set({
        blockExternalEvents:
          patch.blockExternalEvents == null
            ? connection.blockExternalEvents
            : patch.blockExternalEvents
              ? 1
              : 0,
        calendarId: patch.calendarId ?? connection.calendarId,
        calendarName,
        updatedAt: nowIso(),
      })
      .where(eq(schema.calendarConnections.id, connection.id)),
  );
  return { ok: true as const };
}

type BusyInterval = {
  startsAt: Date;
  endsAt: Date;
  source: "google";
};

const busyCache = new Map<string, { expiresAt: number; busy: BusyInterval[] }>();

export async function getExternalBusyIntervals(
  tenantId: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const connection = await getCalendarConnection(tenantId);
  if (!connection || connection.blockExternalEvents !== 1) return [];

  const cacheKey = `${tenantId}:${connection.calendarId}:${from.toISOString()}:${to.toISOString()}`;
  const cached = busyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.busy;

  const access = await accessTokenFor(connection);
  if (!access.ok) {
    console.warn("[calendar] could not refresh Google token:", access.error);
    return [];
  }

  const listed = await listGoogleEvents({
    accessToken: access.accessToken,
    calendarId: connection.calendarId,
    from,
    to,
  });
  if (!listed.ok) {
    console.warn("[calendar] Google events list failed:", listed.error);
    return [];
  }

  const busy = externalBusyFromGoogleEvents(listed.events);
  busyCache.set(cacheKey, { expiresAt: Date.now() + 45_000, busy });
  return busy;
}

function eventStatusForOrder(order: Order): "tentative" | "confirmed" {
  if (order.status === "requested") return "tentative";
  return "confirmed";
}

export async function syncOrderToCalendar(order: Order) {
  if (order.status === "cancelled") {
    await deleteOrderCalendarEvent(order);
    return;
  }

  const connection = await getCalendarConnection(order.tenantId);
  if (!connection) return;

  const access = await accessTokenFor(connection);
  if (!access.ok) {
    console.warn("[calendar] skip sync; token error:", access.error);
    return;
  }

  const tenant = await getTenant(order.tenantId);
  const row = await getTenantRow(order.tenantId);
  const siteBase = tenant.siteUrl.replace(/\/$/, "");
  const upserted = await upsertGoogleEvent({
    accessToken: access.accessToken,
    calendarId: connection.calendarId,
    eventId: order.calendarEventId,
    input: {
      summary: `${eventStatusForOrder(order) === "tentative" ? "Hold" : "Shoot"} — ${order.propertyAddress}`,
      description: [
        `Studiofront ${order.status} shoot.`,
        `Agent: ${order.agentName} (${order.agentEmail})`,
        order.packageName,
        `${siteBase}/admin`,
      ]
        .filter(Boolean)
        .join("\n"),
      startsAt: order.preferredStart,
      endsAt: order.preferredEnd,
      timeZone: row?.timezone || "America/Toronto",
      status: eventStatusForOrder(order),
      orderId: order.id,
      sourceUrl: `${siteBase}/admin`,
    },
  });

  if (!upserted.ok) {
    console.warn("[calendar] upsert failed:", upserted.error);
    return;
  }

  if (upserted.eventId !== order.calendarEventId) {
    const db = getDb();
    await qRun(
      db
        .update(schema.orders)
        .set({ calendarEventId: upserted.eventId, updatedAt: nowIso() })
        .where(eq(schema.orders.id, order.id)),
    );
  }
}

export async function deleteOrderCalendarEvent(order: Order) {
  if (!order.calendarEventId) return;
  const connection = await getCalendarConnection(order.tenantId);
  if (connection) {
    const access = await accessTokenFor(connection);
    if (access.ok) {
      await deleteGoogleEvent({
        accessToken: access.accessToken,
        calendarId: connection.calendarId,
        eventId: order.calendarEventId,
      });
    }
  }
  const db = getDb();
  await qRun(
    db
      .update(schema.orders)
      .set({ calendarEventId: null, updatedAt: nowIso() })
      .where(eq(schema.orders.id, order.id)),
  );
}

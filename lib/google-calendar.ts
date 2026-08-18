import { platformPublicUrl } from "@/lib/platform";

export const STUDIOFRONT_EVENT_FLAG = "studiofront";
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
] as const;

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
};

export type GoogleCalendarEventInput = {
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  status: "tentative" | "confirmed";
  orderId: string;
  sourceUrl: string;
};

type GoogleDate = {
  dateTime?: string;
  date?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  transparency?: string;
  start?: GoogleDate;
  end?: GoogleDate;
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

export function googleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim(),
  );
}

export function googleCalendarRedirectUri() {
  const explicit = process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${platformPublicUrl().replace(/\/$/, "")}/api/admin/calendar/callback`;
}

export function googleOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    redirect_uri: googleCalendarRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error =
      typeof json?.error_description === "string"
        ? json.error_description
        : typeof json?.error === "string"
          ? json.error
          : "Google token request failed.";
    return { ok: false as const, error };
  }
  return {
    ok: true as const,
    accessToken: String(json?.access_token ?? ""),
    refreshToken:
      typeof json?.refresh_token === "string" ? json.refresh_token : null,
    expiresIn: Number(json?.expires_in ?? 3600),
    email: typeof json?.email === "string" ? json.email : null,
  };
}

export async function exchangeGoogleCode(code: string) {
  return tokenRequest({
    code,
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    redirect_uri: googleCalendarRedirectUri(),
    grant_type: "authorization_code",
  });
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });
}

export async function revokeGoogleToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => null);
}

export async function googleUserEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const json = (await response.json().catch(() => null)) as { email?: string } | null;
  return json?.email ?? null;
}

export async function listGoogleCalendars(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    return { ok: false as const, error: "Could not list calendars." };
  }
  const json = (await response.json()) as {
    items?: Array<{ id?: string; summary?: string; primary?: boolean }>;
  };
  const calendars: GoogleCalendarListItem[] = (json.items ?? [])
    .filter((item) => Boolean(item.id))
    .map((item) => ({
      id: item.id!,
      summary: item.summary || item.id!,
      primary: Boolean(item.primary),
    }));
  return { ok: true as const, calendars };
}

function calendarPath(calendarId: string) {
  return encodeURIComponent(calendarId || "primary");
}

export function studiofrontEventBody(input: GoogleCalendarEventInput) {
  return {
    summary: input.summary,
    description: input.description,
    status: input.status,
    start: { dateTime: input.startsAt, timeZone: input.timeZone },
    end: { dateTime: input.endsAt, timeZone: input.timeZone },
    source: { title: "Studiofront", url: input.sourceUrl },
    extendedProperties: {
      private: {
        [STUDIOFRONT_EVENT_FLAG]: "1",
        orderId: input.orderId,
      },
    },
  };
}

export function isStudiofrontCalendarEvent(event: GoogleCalendarEvent) {
  return event.extendedProperties?.private?.[STUDIOFRONT_EVENT_FLAG] === "1";
}

function addDaysYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function googleEventInterval(event: GoogleCalendarEvent): {
  startsAt: Date;
  endsAt: Date;
} | null {
  if (event.status === "cancelled") return null;
  if (event.transparency === "transparent") return null;

  const start = event.start;
  const end = event.end;
  if (!start) return null;

  if (start.dateTime) {
    const startsAt = new Date(start.dateTime);
    const endsAt = end?.dateTime ? new Date(end.dateTime) : startsAt;
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }
    return { startsAt, endsAt };
  }

  if (start.date) {
    const startsAt = new Date(`${start.date}T00:00:00Z`);
    const endDate = end?.date ?? addDaysYmd(start.date, 1);
    const endsAt = new Date(`${endDate}T00:00:00Z`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }
    return { startsAt, endsAt };
  }

  return null;
}

export function externalBusyFromGoogleEvents(events: GoogleCalendarEvent[]) {
  const busy: Array<{ startsAt: Date; endsAt: Date; source: "google" }> = [];
  for (const event of events) {
    if (isStudiofrontCalendarEvent(event)) continue;
    const interval = googleEventInterval(event);
    if (!interval) continue;
    busy.push({ ...interval, source: "google" });
  }
  return busy;
}

async function calendarJson<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `Google Calendar ${response.status}`,
    };
  }
  return { ok: true, data: data as T };
}

export async function listGoogleEvents(options: {
  accessToken: string;
  calendarId: string;
  from: Date;
  to: Date;
}) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({
      timeMin: options.from.toISOString(),
      timeMax: options.to.toISOString(),
      singleEvents: "true",
      showDeleted: "false",
      maxResults: "250",
      orderBy: "startTime",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const result = await calendarJson<{
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
    }>(
      options.accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(options.calendarId)}/events?${params}`,
    );
    if (!result.ok) return result;
    events.push(...(result.data.items ?? []));
    pageToken = result.data.nextPageToken;
    if (!pageToken) break;
  }
  return { ok: true as const, events };
}

export async function upsertGoogleEvent(options: {
  accessToken: string;
  calendarId: string;
  eventId?: string | null;
  input: GoogleCalendarEventInput;
}) {
  const body = JSON.stringify(studiofrontEventBody(options.input));
  if (options.eventId) {
    const patched = await calendarJson<{ id?: string }>(
      options.accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(options.calendarId)}/events/${encodeURIComponent(options.eventId)}`,
      { method: "PATCH", body },
    );
    if (patched.ok && patched.data.id) {
      return { ok: true as const, eventId: patched.data.id };
    }
    if (patched.ok === false && patched.status !== 404 && patched.status !== 410) {
      return patched;
    }
  }

  const created = await calendarJson<{ id?: string }>(
    options.accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(options.calendarId)}/events`,
    { method: "POST", body },
  );
  if (!created.ok) return created;
  if (!created.data.id) {
    return { ok: false as const, status: 500, error: "Google did not return an event id." };
  }
  return { ok: true as const, eventId: created.data.id };
}

export async function deleteGoogleEvent(options: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarPath(options.calendarId)}/events/${encodeURIComponent(options.eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${options.accessToken}` },
    },
  );
  if (response.ok || response.status === 404 || response.status === 410) {
    return { ok: true as const };
  }
  return { ok: false as const, error: `Google Calendar ${response.status}` };
}

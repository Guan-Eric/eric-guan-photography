import { z } from "zod";

/**
 * Editable listing-page content. Sections and open houses are stored as JSON
 * on `listing_pages`, so parsing must never throw on legacy rows.
 */
export const listingSectionSchema = z.object({
  heading: z.string().trim().max(80),
  body: z.string().trim().max(1200),
});

export const openHouseSchema = z.object({
  /** ISO date (YYYY-MM-DD) so it renders in the studio timezone. */
  date: z.string().trim().min(4).max(10),
  start: z.string().trim().max(8).optional().default(""),
  end: z.string().trim().max(8).optional().default(""),
  note: z.string().trim().max(140).optional().default(""),
});

export type ListingSection = z.infer<typeof listingSectionSchema>;
export type OpenHouse = z.infer<typeof openHouseSchema>;

export function parseSections(json: string | null | undefined): ListingSection[] {
  if (!json) return [];
  try {
    const parsed = z.array(listingSectionSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function parseOpenHouses(json: string | null | undefined): OpenHouse[] {
  if (!json) return [];
  try {
    const parsed = z.array(openHouseSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function formatOpenHouse(entry: OpenHouse, timeZone = "America/Toronto") {
  const date = new Date(`${entry.date}T12:00:00`);
  const day = Number.isNaN(date.getTime())
    ? entry.date
    : new Intl.DateTimeFormat("en-CA", {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date);
  const window = [entry.start, entry.end].filter(Boolean).join("–");
  return [day, window, entry.note].filter(Boolean).join(" · ");
}

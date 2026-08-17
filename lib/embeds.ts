/**
 * Pure embed parsing — safe to import from client components.
 * Known providers get a real iframe; anything else stays a plain outbound link.
 */
export type EmbedProvider =
  | "youtube"
  | "vimeo"
  | "matterport"
  | "iguide"
  | "cubicasa"
  | "link";

export type MediaLinkKind = "video" | "tour" | "floorplan" | "doc";

export type ParsedEmbed = {
  provider: EmbedProvider;
  /** iframe src, or null when the provider must open in a new tab. */
  embedUrl: string | null;
  /** Canonical page URL for "open in new tab". */
  canonicalUrl: string;
  kind: MediaLinkKind;
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
]);

function normalizeHost(host: string) {
  return host.toLowerCase();
}

function youtubeId(url: URL) {
  const host = normalizeHost(url.hostname);
  if (host === "youtu.be") return url.pathname.slice(1).split("/")[0] ?? "";
  const v = url.searchParams.get("v");
  if (v) return v;
  const parts = url.pathname.split("/").filter(Boolean);
  const marker = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
  if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  return "";
}

function vimeoId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const afterVideo = parts.indexOf("video");
  const candidate = afterVideo >= 0 ? parts[afterVideo + 1] : parts[0];
  return candidate && /^\d+$/.test(candidate) ? candidate : "";
}

export function parseEmbed(
  raw: string,
  fallbackKind: MediaLinkKind = "video",
): { ok: true; embed: ParsedEmbed } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste a link first." };

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That does not look like a URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only http(s) links are allowed." };
  }
  url.protocol = "https:";

  const host = normalizeHost(url.hostname);

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(url);
    if (!id) return { ok: false, error: "Could not find a YouTube video id." };
    return {
      ok: true,
      embed: {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
        kind: "video",
      },
    };
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const id = vimeoId(url);
    if (!id) return { ok: false, error: "Could not find a Vimeo video id." };
    return {
      ok: true,
      embed: {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}`,
        canonicalUrl: `https://vimeo.com/${id}`,
        kind: "video",
      },
    };
  }

  if (host.endsWith("matterport.com")) {
    const model = url.searchParams.get("m");
    const embed = new URL("https://my.matterport.com/show/");
    if (model) embed.searchParams.set("m", model);
    else return { ok: false, error: "Matterport links need the ?m= model id." };
    return {
      ok: true,
      embed: {
        provider: "matterport",
        embedUrl: embed.toString(),
        canonicalUrl: embed.toString(),
        kind: "tour",
      },
    };
  }

  if (host.endsWith("youriguide.com") || host.endsWith("iguide.io")) {
    return {
      ok: true,
      embed: {
        provider: "iguide",
        embedUrl: url.toString(),
        canonicalUrl: url.toString(),
        kind: "tour",
      },
    };
  }

  if (host.endsWith("cubi.casa") || host.endsWith("cubicasa.com")) {
    return {
      ok: true,
      embed: {
        provider: "cubicasa",
        embedUrl: url.toString(),
        canonicalUrl: url.toString(),
        kind: "floorplan",
      },
    };
  }

  // Unknown host: link out instead of framing a stranger's page.
  return {
    ok: true,
    embed: {
      provider: "link",
      embedUrl: null,
      canonicalUrl: url.toString(),
      kind: fallbackKind,
    },
  };
}

export function providerLabel(provider: EmbedProvider) {
  return (
    {
      youtube: "YouTube",
      vimeo: "Vimeo",
      matterport: "Matterport",
      iguide: "iGuide",
      cubicasa: "CubiCasa",
      link: "Link",
    }[provider] ?? "Link"
  );
}

export function kindLabel(kind: MediaLinkKind) {
  return (
    {
      video: "Video",
      tour: "3D tour",
      floorplan: "Floor plan",
      doc: "Document",
    }[kind] ?? "Media"
  );
}

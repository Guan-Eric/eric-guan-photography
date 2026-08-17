import {
  type EmbedProvider,
  type MediaLinkKind,
  kindLabel,
  parseEmbed,
  providerLabel,
} from "@/lib/embeds";

export type EmbedItem = {
  id: string;
  kind: MediaLinkKind;
  provider: EmbedProvider | string;
  url: string | null;
  title: string | null;
  /** Set for uploaded PDFs served through the gallery doc route. */
  docHref: string | null;
};

function frameTitle(item: EmbedItem) {
  return item.title ?? `${kindLabel(item.kind)} — ${providerLabel(item.provider as EmbedProvider)}`;
}

/**
 * Renders video / 3D tour / floor-plan media. Known providers get a real
 * iframe; unknown hosts and uploads become plain links.
 */
export function MediaEmbeds({ items }: { items: EmbedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="media-embeds" aria-label="Video, tours and floor plans">
      {items.map((item) => {
        const parsed = item.url ? parseEmbed(item.url, item.kind) : null;
        const embedUrl = parsed?.ok ? parsed.embed.embedUrl : null;

        return (
          <figure key={item.id} className="media-embed">
            <figcaption>
              <span className="eyebrow">{kindLabel(item.kind)}</span>
              <strong>{item.title ?? kindLabel(item.kind)}</strong>
            </figcaption>

            {embedUrl ? (
              <div className="media-embed-frame">
                <iframe
                  src={embedUrl}
                  title={frameTitle(item)}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; xr-spatial-tracking"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : item.docHref ? (
              <a className="btn btn-outline" href={item.docHref} target="_blank" rel="noreferrer">
                Open {kindLabel(item.kind).toLowerCase()} (PDF)
              </a>
            ) : item.url ? (
              <a className="btn btn-outline" href={item.url} target="_blank" rel="noreferrer">
                Open {kindLabel(item.kind).toLowerCase()}
              </a>
            ) : null}
          </figure>
        );
      })}
    </section>
  );
}

import Link from "next/link";

export function GalleryLinkExpired() {
  return (
    <main className="delivery-shell" id="main">
      <div className="delivery-main">
        <header className="delivery-intro">
          <p className="eyebrow">Link expired</p>
          <h1>This gallery link is no longer active</h1>
          <p className="lede">
            Ask your photographer for a fresh link. Preview and download links expire after 14
            days, and the preview link stops working after payment unlocks a new download URL.
          </p>
          <p>
            <Link className="btn btn-outline" href="/portal">
              Agent portal
            </Link>
          </p>
        </header>
      </div>
    </main>
  );
}

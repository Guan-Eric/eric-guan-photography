/** Dev/E2E only — never allow client stub unlock in production. */
export function galleryStubUnlockAllowed() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_GALLERY_STUB_UNLOCK === "1"
  );
}

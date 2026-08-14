/** Client-safe platform name (inlined at build from NEXT_PUBLIC_ / fallback). */
export function platformName() {
  return process.env.NEXT_PUBLIC_PLATFORM_NAME ?? process.env.PLATFORM_NAME ?? "Studiofront";
}

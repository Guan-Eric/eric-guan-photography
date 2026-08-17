import type { ImageLoaderProps } from "next/image";

/**
 * Production loader: pass remote URLs through unchanged.
 * `/cdn-cgi/image/...` requires Cloudflare Image Resizing + allowed origins,
 * which this zone does not have configured — that was breaking Unsplash heroes.
 */
export default function cloudflareLoader({ src }: ImageLoaderProps) {
  return src;
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sharp", "@neondatabase/serverless"],
  experimental: {
    // Middleware/proxy buffers request bodies (default 10MB). Gallery uploads
    // are often larger — raise so multipart isn't truncated mid-boundary.
    proxyClientMaxBodySize: "100mb",
  },
  images: {
    // Placeholder portfolio imagery. Remove this entry once every stock photo
    // has been replaced with the tenant's own work.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Only for `next dev` — skip during `next build` / OpenNext compile.
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare").then((mod) => {
    mod.initOpenNextCloudflareForDev();
  });
}

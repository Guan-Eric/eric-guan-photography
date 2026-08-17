import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const cloudflareBuild = process.env.OPEN_NEXT_CLOUDFLARE === "1";
const sharpStubRelative = "./lib/sharp-stub.ts";
const sharpStubAbsolute = path.join(rootDir, "lib", "sharp-stub.ts");

const nextConfig: NextConfig = {
  // better-sqlite3 is Node-only (local/dev). Do not externalize `sharp` —
  // Workers cannot load it; Cloudflare builds alias it to a stub.
  serverExternalPackages: cloudflareBuild
    ? ["better-sqlite3", "@neondatabase/serverless"]
    : ["better-sqlite3", "sharp", "@neondatabase/serverless"],
  experimental: {
    // Middleware/proxy buffers request bodies (default 10MB). Gallery uploads
    // are often larger — raise so multipart isn't truncated mid-boundary.
    proxyClientMaxBodySize: "100mb",
  },
  images: {
    loader: "custom",
    loaderFile: "./image-loader.ts",
    // Placeholder portfolio imagery. Remove this entry once every stock photo
    // has been replaced with the tenant's own work.
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"],
  },
  // Next 16 defaults to Turbopack for `next dev`. A webpack() hook without a
  // turbopack block hard-fails; keep both so OpenNext/webpack and local
  // Turbopack stay happy.
  turbopack: {
    root: rootDir,
    ...(cloudflareBuild
      ? {
          resolveAlias: {
            sharp: sharpStubRelative,
          },
        }
      : {}),
  },
  webpack: (config) => {
    if (cloudflareBuild) {
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, string>),
        sharp: sharpStubAbsolute,
      };
    }
    return config;
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better dev-time warnings
  reactStrictMode: true,

  // Run these packages in Node.js runtime (not bundled by webpack/turbopack)
  serverExternalPackages: ["bcryptjs", "@libsql/client"],

  // Next.js Image: allow only same-origin images (logo is served from /public)
  // ► CHANGE: add external domains here if you use remote images in future
  images: {
    remotePatterns: [],
    // Allow SVG logos from /public (needed if you swap to an SVG logo)
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options",           value: "DENY" },
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options",    value: "nosniff" },
          // Referrer policy
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          // Basic permissions policy
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

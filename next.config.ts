import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for better dev-time warnings
  reactStrictMode: true,

  // bcryptjs uses native Node.js crypto — keep it server-external.
  // @neondatabase/serverless is edge-compatible and does NOT need to be listed here.
  serverExternalPackages: ["bcryptjs"],

  // Next.js Image: allow only same-origin images (logo is served from /public)
  images: {
    remotePatterns: [],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: frontendRoot,
  },

  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    const scriptSrc = isProduction
      ? "script-src 'self' 'unsafe-inline' https://accounts.google.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com";

    const connectSources = [
      "'self'",
      "https://accounts.google.com",
      process.env.NEXT_PUBLIC_API_BASE_URL,
      process.env.NEXT_PUBLIC_API_URL,
      ...(!isProduction
        ? ["http://127.0.0.1:8000", "http://localhost:8000"]
        : []),
    ]
      .filter(Boolean)
      .join(" ");

    const contentSecurityPolicy = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      `connect-src ${connectSources}`,
      "frame-src 'self' https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: contentSecurityPolicy,
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin-allow-popups",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      ...(isProduction
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
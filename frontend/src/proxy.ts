import { NextRequest, NextResponse } from "next/server";

function getConnectSources() {
  const sources = new Set<string>([
    "'self'",
    "https://accounts.google.com",
  ]);

  for (const value of [
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ]) {
    if (value) sources.add(value);
  }

  if (process.env.NODE_ENV !== "production") {
    sources.add("http://127.0.0.1:8000");
    sources.add("http://localhost:8000");
  }

  return Array.from(sources).join(" ");
}

function buildContentSecurityPolicy(nonce: string) {
  const isProduction = process.env.NODE_ENV === "production";

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${
      isProduction ? "" : " 'unsafe-eval'"
    } https://accounts.google.com`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    `connect-src ${getConnectSources()}`,
    "frame-src 'self' https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

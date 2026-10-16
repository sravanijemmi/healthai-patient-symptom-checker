import { NextRequest, NextResponse } from "next/server";

/**
 * Restrict API CORS to same-origin / local demo hosts.
 * Same-origin browser calls don't need CORS; this blocks casual cross-site POSTs.
 */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (!isApi) {
    return NextResponse.next();
  }

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    applyCors(response, origin);
    return response;
  }

  const response = NextResponse.next();
  applyCors(response, origin);
  return response;
}

function applyCors(response: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  // No origin (same-origin navigation / server) → no ACAO header needed
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("X-Content-Type-Options", "nosniff");
}

export const config = {
  matcher: ["/api/:path*"],
};

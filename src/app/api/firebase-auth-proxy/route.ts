/**
 * Firebase Auth proxy - forwards requests from Electron's renderer (which can't reach
 * googleapis.com due to WPAD proxy issues) to Google's Identity Toolkit or Secure Token API.
 * The Next.js server (Node.js) has full internet access, so it acts as a middleman.
 *
 * Supported hosts:
 *  - identitytoolkit.googleapis.com  (signIn, signUp, lookupAccount)
 *  - securetoken.googleapis.com      (token refresh)
 */
import { NextResponse } from "next/server";

const ALLOWED_HOSTS: Record<string, string> = {
  identitytoolkit: "https://identitytoolkit.googleapis.com",
  securetoken: "https://securetoken.googleapis.com",
};

async function handleProxy(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const targetPath = url.searchParams.get("path") || "";
    // Determine which Google host to use based on path prefix
    let baseUrl = ALLOWED_HOSTS.identitytoolkit;
    if (targetPath.startsWith("/v1/token") || targetPath.includes("securetoken")) {
      baseUrl = ALLOWED_HOSTS.securetoken;
    }
    const targetUrl = `${baseUrl}${targetPath}`;
    console.log(`[firebase-auth-proxy] ${request.method} → ${targetUrl}`);

    // Forward headers except host-specific ones
    const forwardHeaders: Record<string, string> = {
      "Content-Type": request.headers.get("Content-Type") || "application/json",
    };
    const auth = request.headers.get("Authorization");
    if (auth) forwardHeaders["Authorization"] = auth;

    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

    const googleRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
    });

    const responseBody = await googleRes.text();
    console.log(`[firebase-auth-proxy] Response: ${googleRes.status}`);

    return new NextResponse(responseBody, {
      status: googleRes.status,
      headers: {
        "Content-Type": googleRes.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e: any) {
    console.error("[firebase-auth-proxy] Error:", e);
    return NextResponse.json({ error: e?.message || "Proxy error" }, { status: 500 });
  }
}

export async function POST(request: Request) { return handleProxy(request); }
export async function GET(request: Request) { return handleProxy(request); }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

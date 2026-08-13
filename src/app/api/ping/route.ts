import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, server: "local" });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

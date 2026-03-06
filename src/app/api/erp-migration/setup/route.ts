import { NextResponse } from "next/server";
import { setupCompanyStructureServer } from "@/lib/erp-migration";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, subCompanyName, seasonName } = body;
    if (!companyName?.trim() || !subCompanyName?.trim() || !seasonName?.trim()) {
      return NextResponse.json(
        { error: "companyName, subCompanyName and seasonName are required" },
        { status: 400 }
      );
    }
    const result = await setupCompanyStructureServer({
      companyName: String(companyName).trim(),
      subCompanyName: String(subCompanyName).trim(),
      seasonName: String(seasonName).trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] erp-migration/setup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}

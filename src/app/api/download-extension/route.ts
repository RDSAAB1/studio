import { NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("type") || "emandi"; // 'emandi' or 'gst'

    const folderName = target === "gst" ? "gst-extension" : "emandi-extension";
    const zipName = target === "gst" ? "gst-extension.zip" : "emandi-extension.zip";

    const rootDir = process.cwd();
    const extensionDir = path.join(rootDir, folderName);
    const zipPath = path.join(rootDir, "PUBLIC", zipName);

    if (!fs.existsSync(extensionDir)) {
      return NextResponse.json(
        { error: `Folder ${folderName} does not exist.` },
        { status: 404 }
      );
    }

    // Dynamic generation of zip file using PowerShell on Windows
    if (process.platform === "win32") {
      console.log(`[Extension Downloader] Generating ZIP for ${folderName} on Windows...`);
      execSync(
        `powershell.exe -Command "Compress-Archive -Path '${extensionDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: "ignore" }
      );
    } else {
      // Fallback for macOS/Linux
      console.log(`[Extension Downloader] Generating ZIP for ${folderName} on Unix...`);
      execSync(`zip -r '${zipPath}' '${extensionDir}'`, { stdio: "ignore" });
    }

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Failed to create ${zipName} archive.`);
    }

    const fileBuffer = fs.readFileSync(zipPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=${zipName}`,
      },
    });
  } catch (error: any) {
    console.error("[Extension Downloader] Error:", error);
    return NextResponse.json(
      { error: "Failed to package extension: " + error.message },
      { status: 500 }
    );
  }
}

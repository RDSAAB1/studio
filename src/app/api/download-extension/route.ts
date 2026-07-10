import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

async function addFolderToZip(zip: JSZip, folderPath: string, rootPath: string) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    // Relative path with forward slashes for zip file format compatibility
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      await addFolderToZip(zip, fullPath, rootPath);
    } else {
      const fileData = fs.readFileSync(fullPath);
      zip.file(relativePath, fileData);
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get("type") || "emandi"; // 'emandi' or 'gst'

    const folderName = target === "gst" ? "gst-extension" : "emandi-extension";
    const zipName = target === "gst" ? "gst-extension.zip" : "emandi-extension.zip";

    const rootDir = process.cwd();
    const extensionDir = path.join(rootDir, folderName);

    if (!fs.existsSync(extensionDir)) {
      return NextResponse.json(
        { error: `Folder ${folderName} does not exist.` },
        { status: 404 }
      );
    }

    console.log(`[Extension Downloader] Generating ZIP for ${folderName} in-memory using JSZip...`);
    const zip = new JSZip();
    await addFolderToZip(zip, extensionDir, extensionDir);

    const zipContent = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    });

    return new NextResponse(zipContent, {
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


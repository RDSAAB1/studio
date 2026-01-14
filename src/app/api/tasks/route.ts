import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    // Read TASKS.md from root directory
    const filePath = join(process.cwd(), 'TASKS.md');
    const fileContent = await readFile(filePath, 'utf-8');
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read TASKS.md file' },
      { status: 404 }
    );
  }
}


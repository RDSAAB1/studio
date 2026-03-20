import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-static';

export async function GET(request: Request) {
  try {
    // Rate limiting: 60 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const isAllowed = rateLimit(ip, { max: 60, windowMs: 60000 });
    
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }

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


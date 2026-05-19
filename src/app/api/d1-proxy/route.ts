import { NextResponse } from 'next/server';

/**
 * D1 PROXY ROUTE
 * Forwards requests from the browser to the Cloudflare Worker to bypass CORS blocks.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { url, method, headers, body } = payload;

    if (!url) {
      return NextResponse.json({ error: 'Missing destination URL' }, { status: 400 });
    }

    console.log(`[D1 Proxy] Forwarding ${method || 'POST'} to: ${url}`);

    // Safety: Next.js/Node fetch can fail if a body is provided for GET/HEAD
    const safeBody = (method === 'GET' || method === 'HEAD') ? undefined : (body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined);

    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: safeBody,
      // @ts-ignore - Next.js fetch supports signal/timeout in newer versions or via standard AbortController
      signal: AbortSignal.timeout(15000) 
    });

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout');
    const isFetchFailed = error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED');

    console.error('[D1 Proxy] Forwarding Error:', {
        url: error.url,
        message: error.message,
        type: error.name
    });

    return NextResponse.json({ 
        error: isTimeout ? 'Gateway Timeout (Worker unreachable)' : (isFetchFailed ? 'Cloud Sync Worker Unreachable (Offline/DNS)' : error.message),
        code: isTimeout ? 'TIMEOUT' : 'FETCH_ERROR',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: isTimeout ? 504 : 502 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Proxy is active. Use POST to forward requests.' });
}

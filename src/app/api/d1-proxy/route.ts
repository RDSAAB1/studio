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
    console.error('[D1 Proxy] Critical Error:', error);
    return NextResponse.json({ 
        error: error.message || 'Internal Proxy Error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Proxy is active. Use POST to forward requests.' });
}

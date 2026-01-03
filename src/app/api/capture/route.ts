import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function POST(request: Request) {
  try {
    const data = await request.text(); // Assuming the data is sent as raw text
    
    // For now, we'll just log it to the server console.
    // In a real implementation, you would save this to a database
    // or use a real-time service like Firestore to push it to the client.



    return NextResponse.json({ message: 'Data captured successfully' }, { status: 200 });
  } catch (error) {

    return NextResponse.json({ message: 'Error capturing data' }, { status: 500 });
  }
}

// Optional: Add a GET handler for basic testing
export async function GET() {
  return NextResponse.json({ message: 'Data capture endpoint is active. Use POST to send data.' });
}

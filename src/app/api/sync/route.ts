
import { NextResponse } from 'next/server';
import { doc, setDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export async function POST(request: Request) {
  try {
    const actionItem = await request.json();
    const { action, payload } = actionItem;
    const { collection: collectionName, id, data, changes } = payload;

    if (!collectionName) {
        return NextResponse.json({ message: 'Collection name is missing.' }, { status: 400 });
    }
    
    switch (action) {
      case 'create':
        if (!data || !data.id) return NextResponse.json({ message: 'Missing data or ID for create operation.' }, { status: 400 });
        await setDoc(doc(firestoreDB, collectionName, data.id), data);
        break;
      case 'update':
        if (!id || !changes) return NextResponse.json({ message: 'Missing ID or changes for update operation.' }, { status: 400 });
        await updateDoc(doc(firestoreDB, collectionName, id), changes);
        break;
      case 'delete':
        if (!id) return NextResponse.json({ message: 'Missing ID for delete operation.' }, { status: 400 });
        await deleteDoc(doc(firestoreDB, collectionName, id));
        break;
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Sync successful' }, { status: 200 });
  } catch (error: any) {
    console.error('Sync API Error:', error);
    return NextResponse.json({ message: 'Sync failed', error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Sync endpoint is active. Use POST to send data.' });
}

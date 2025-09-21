
import { NextResponse } from 'next/server';
import { doc, setDoc, updateDoc, deleteDoc, collection, writeBatch, getDocs, where, query } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

async function handleSpecialDelete(payload: any) {
  const { collection: collectionName, id, changes } = payload;
  const batch = writeBatch(firestoreDB);

  if (changes.all) {
    // Delete all documents in the collection
    const querySnapshot = await getDocs(collection(firestoreDB, collectionName));
    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return NextResponse.json({ message: `All documents in ${collectionName} deleted successfully` }, { status: 200 });
  } else if (changes.bySrNo) {
    // Delete payments by SR No. This is specific logic.
    const q = query(collection(firestoreDB, collectionName), where("paidFor", "array-contains", { srNo: id }));
    const paymentsSnapshot = await getDocs(q);
    paymentsSnapshot.forEach(paymentDoc => {
      batch.delete(paymentDoc.ref);
    });
    await batch.commit();
    return NextResponse.json({ message: `Payments for SR No. ${id} deleted` }, { status: 200 });
  }

  return NextResponse.json({ message: 'Invalid special delete operation' }, { status: 400 });
}

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
        
        if (changes) {
            return await handleSpecialDelete(payload);
        }

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

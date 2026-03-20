import { NextResponse } from 'next/server';
import { doc, setDoc, updateDoc, deleteDoc, collection, writeBatch, getDocs, where, query } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';

export const dynamic = 'force-static';

type TenantHint = { id?: string; storageMode?: 'root' | 'tenant' } | undefined;
type ErpSelectionHint = { companyId: string; subCompanyId: string; seasonKey: string } | undefined;
type FirestorePath = [string, ...string[]];

function getCollectionPath(collectionName: string, tenant: TenantHint, erpSelection: ErpSelectionHint): FirestorePath {
  if (erpSelection?.companyId && erpSelection?.subCompanyId && erpSelection?.seasonKey) {
    return ['companies', erpSelection.companyId, erpSelection.subCompanyId, erpSelection.seasonKey, collectionName] as FirestorePath;
  }
  if (tenant?.storageMode === 'tenant' && tenant.id) {
    return ['tenants', tenant.id, collectionName] as FirestorePath;
  }
  return [collectionName] as FirestorePath;
}

function getDocPath(collectionName: string, docId: string, tenant: TenantHint, erpSelection: ErpSelectionHint): FirestorePath {
  return [...getCollectionPath(collectionName, tenant, erpSelection), docId] as FirestorePath;
}

async function handleSpecialDelete(payload: any) {
  const { collection: collectionName, id, changes, tenant, erpSelection } = payload;
  const batch = writeBatch(firestoreDB);
  const path = getCollectionPath(collectionName, tenant, erpSelection);

  if (changes.all) {
    // Delete all documents in the collection
    const querySnapshot = await getDocs(collection(firestoreDB, ...path));
    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    return NextResponse.json({ message: `All documents in ${collectionName} deleted successfully` }, { status: 200 });
  } else if (changes.bySrNo) {
    // Delete payments by SR No. This is specific logic.
    const q = query(collection(firestoreDB, ...path), where("paidFor", "array-contains", { srNo: id }));
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
    const { collection: collectionName, id, data, changes, tenant, erpSelection } = payload;

    if (!collectionName) {
        return NextResponse.json({ message: 'Collection name is missing.' }, { status: 400 });
    }

    const getPath = (docId?: string) =>
      docId ? getDocPath(collectionName, docId, tenant, erpSelection) : getCollectionPath(collectionName, tenant, erpSelection);

    switch (action) {
      case 'create':
        if (!data || !data.id) return NextResponse.json({ message: 'Missing data or ID for create operation.' }, { status: 400 });
        await setDoc(doc(firestoreDB, ...getPath(data.id)), data);
        break;
      case 'update':
        if (!id || !changes) return NextResponse.json({ message: 'Missing ID or changes for update operation.' }, { status: 400 });
        await updateDoc(doc(firestoreDB, ...getPath(id)), changes);
        break;
      case 'delete':
        if (!id) return NextResponse.json({ message: 'Missing ID for delete operation.' }, { status: 400 });
        
        if (changes) {
            return await handleSpecialDelete(payload);
        }

        await deleteDoc(doc(firestoreDB, ...getPath(id)));
        break;
      default:
        return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Sync successful' }, { status: 200 });
  } catch (error: any) {

    return NextResponse.json({ message: 'Sync failed', error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Sync endpoint is active. Use POST to send data.' });
}

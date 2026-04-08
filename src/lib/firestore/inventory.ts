import { doc, getDoc, getDocs, writeBatch, addDoc } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantCollectionPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { 
  inventoryItemsCollection, 
  manufacturingCostingCollection,
  expenseTemplatesCollection,
  createLocalSubscription 
} from "./core";
import { InventoryItem, ManufacturingCostingData } from "@/lib/definitions";

// --- Inventory Item Functions ---
export async function addInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection);
  const dataWithTimestamp = withCreateMetadata({ ...item, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.set(docRef, dataWithTimestamp);
  const { notifySyncRegistry } = await import('../sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
  logActivity({ type: "create", collection: "inventoryItems", docId: docRef.id, docPath: getTenantCollectionPath("inventoryItems").join("/"), summary: `Created inventory item ${(item as any).name || docRef.id}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
  return { id: docRef.id, ...dataWithTimestamp } as InventoryItem;
}

export async function updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<void> {
  const batch = writeBatch(firestoreDB);
  const docRef = doc(inventoryItemsCollection, id);
  const data = withEditMetadata({ ...item, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.update(docRef, data);
  const { notifySyncRegistry } = await import('../sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
  logActivity({ type: "edit", collection: "inventoryItems", docId: id, docPath: getTenantCollectionPath("inventoryItems").join("/"), summary: `Updated inventory item ${id}`, afterData: data }).catch(() => {});
}

export async function deleteInventoryItem(id: string) {
  const docRef = doc(inventoryItemsCollection, id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await moveToRecycleBin({ collection: "inventoryItems", docId: id, docPath: getTenantCollectionPath("inventoryItems").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted inventory item ${id}` });
  }
  const batch = writeBatch(firestoreDB);
  batch.delete(docRef);
  const { notifySyncRegistry } = await import('../sync-registry');
  await notifySyncRegistry('inventoryItems', { batch });
  await batch.commit();
}

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  if (isSqliteMode() && db) {
    return db.inventoryItems.toArray();
  }
  const snapshot = await getDocs(inventoryItemsCollection);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as InventoryItem));
}

export function getInventoryItemsRealtime(callback: (data: InventoryItem[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<InventoryItem>("inventoryItems", callback);
}

// --- Manufacturing Costing Functions ---
export async function addManufacturingCosting(costing: Omit<ManufacturingCostingData, 'id'>): Promise<ManufacturingCostingData> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(manufacturingCostingCollection);
    const data = withCreateMetadata({ ...costing, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.set(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('manufacturingCosting', { batch });
    await batch.commit();
    logActivity({ type: "create", collection: "manufacturingCosting", docId: docRef.id, docPath: getTenantCollectionPath("manufacturingCosting").join("/"), summary: `Created manufacturing costing ${docRef.id}`, afterData: data as Record<string, unknown> }).catch(() => {});
    return { id: docRef.id, ...data } as ManufacturingCostingData;
}

export async function getAllManufacturingCosting(): Promise<ManufacturingCostingData[]> {
    if (isSqliteMode() && db) {
        return db.manufacturingCosting.toArray();
    }
    const snapshot = await getDocs(manufacturingCostingCollection);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ManufacturingCostingData));
}
export function getManufacturingCostingRealtime(callback: (data: ManufacturingCostingData[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<ManufacturingCostingData>("manufacturingCosting", callback);
}

export async function updateManufacturingCosting(id: string, costingByProject: Partial<ManufacturingCostingData>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(manufacturingCostingCollection, id);
    const data = withEditMetadata({ ...costingByProject, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('manufacturingCosting', { batch });
    await batch.commit();
    logActivity({ type: "edit", collection: "manufacturingCosting", docId: id, docPath: getTenantCollectionPath("manufacturingCosting").join("/"), summary: `Updated manufacturing costing ${id}`, afterData: data }).catch(() => {});
}

export async function deleteManufacturingCosting(id: string) {
    const docRef = doc(manufacturingCostingCollection, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "manufacturingCosting", docId: id, docPath: getTenantCollectionPath("manufacturingCosting").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted manufacturing costing ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('manufacturingCosting', { batch });
    await batch.commit();
}

// --- Expense Template Functions ---

export function getExpenseTemplatesRealtime(callback: (data: any[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<any>("expenseTemplates", callback);
}

export async function deleteExpenseTemplate(id: string): Promise<void> {
    const docRef = doc(expenseTemplatesCollection, id);
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('expenseTemplates', { batch });
    await batch.commit();
    if (db) await db.expenseTemplates.delete(id);
}

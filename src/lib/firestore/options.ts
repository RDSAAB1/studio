import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../database";
import { retryFirestoreOperation } from "../retry-utils";
import { logError } from "../error-logger";
import { getEditMetadata, logActivity } from "../audit";
import { getTenantCollectionPath } from "../tenancy";
import { createLocalSubscription, optionsCollection, isSqliteMode } from "./core";
import { OptionItem } from "@/lib/definitions";

export function getOptionsRealtime(
  collectionName: string,
  callback: (options: OptionItem[]) => void,
  onError: (error: Error) => void
): () => void {
  return createLocalSubscription<OptionItem>(
    "options",
    callback,
    (options) => {
        const filtered = options.filter((o: any) => o.type === collectionName);
        return filtered;
    }
  );
}

export function getExpenseCategories(
  callback: (options: any[]) => void,
  onError: (error: Error) => void
): () => void {
  return getOptionsRealtime("ExpenseCategory", callback, onError);
}

export function getIncomeCategories(
  callback: (options: any[]) => void,
  onError: (error: Error) => void
): () => void {
  return getOptionsRealtime("IncomeCategory", callback, onError);
}

export async function addOption(collectionName: string, optionData: Partial<OptionItem>): Promise<void> {
    if (!optionData || !optionData.name || !optionData.name.trim()) {
        throw new Error('Option name cannot be empty');
    }
    
    try {
        const name = optionData.name.trim().toUpperCase();
        const docRef = doc(optionsCollection, collectionName);
        
        const docSnap = await retryFirestoreOperation(
            () => getDoc(docRef),
            `addOption - get current items for ${collectionName}`
        );
        const currentItems = docSnap.exists() ? (docSnap.data().items || []) : [];
        
        if (currentItems.includes(name)) {
            throw new Error(`Option "${name}" already exists`);
        }
        
        const meta = getEditMetadata();
        if (!isSqliteMode()) {
            const updatePayload: any = {
                items: arrayUnion(name),
                ...meta
            };
            if (optionData.unit || optionData.category) {
                updatePayload[`metadata.${name.toLowerCase()}`] = {
                    unit: optionData.unit || "",
                    category: optionData.category || ""
                };
            }
            await retryFirestoreOperation(
                () => setDoc(docRef, updatePayload, { merge: true }),
                `addOption - set item for ${collectionName}`
            );
        }
        logActivity({ type: "create", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Added option ${name} to ${collectionName}`, afterData: { items: [...currentItems, name], ...meta } as Record<string, unknown> }).catch(() => {});
        
        if (db) {
            try {
                const optionItem = { 
                    id: name.toLowerCase(), 
                    name, 
                    type: collectionName,
                    unit: optionData.unit,
                    category: optionData.category
                };
                await db.options.put(optionItem);
            } catch (dbError) {
                logError(dbError, `addOption - IndexedDB update for ${collectionName}`, 'low');
            }
        }
    } catch (error) {
        logError(error, `addOption(${collectionName})`, 'medium');
        throw error;
    }
}

export async function updateOption(collectionName: string, id: string, optionData: Partial<OptionItem>): Promise<void> {
    if (!optionData || !optionData.name || !optionData.name.trim()) {
        throw new Error('Option name cannot be empty');
    }
    
    try {
        const newName = optionData.name.trim().toUpperCase();
        const docRef = doc(optionsCollection, collectionName);
        
        const docSnap = await retryFirestoreOperation(
            () => getDoc(docRef),
            `updateOption - get current items for ${collectionName}`
        );
        if (!docSnap.exists()) {
            throw new Error(`Collection ${collectionName} does not exist`);
        }
        
        const currentItems = (docSnap.data()?.items || []) as string[];
        const searchId = id.trim().toLowerCase();
        const oldName = currentItems.find((item: string) => item.trim().toLowerCase() === searchId);
        
        let shouldUpdateFirestore = true;
        if (!oldName) {
            // Fallback: If it's missing from the main list, we'll try to find it by name if provided in optionData
            const possibleName = optionData.name?.trim().toUpperCase();
            if (possibleName && currentItems.includes(possibleName)) {
                 // it's already there with the new name? maybe it was updated by another client
            } else {
                 console.warn(`Option "${id}" not found in Firestore ${collectionName} list. Skipping Firestore update, will only update local database.`);
                 shouldUpdateFirestore = false;
            }
        }
        
        if (!newName) {
            throw new Error('New name cannot be empty');
        }

        if (shouldUpdateFirestore) {
            if (currentItems.includes(newName) && oldName !== newName) {
                throw new Error(`Option "${newName}" already exists`);
            }
            
            const updatedItems = currentItems.map((item: string) => item === oldName ? newName : item);
            const meta = getEditMetadata();
            if (!isSqliteMode()) {
                const updatePayload: any = {
                    items: updatedItems,
                    ...meta
                };
                
                // Remove old metadata if name changed
                if (oldName.toLowerCase() !== newName.toLowerCase()) {
                    updatePayload[`metadata.${oldName.toLowerCase()}`] = null;
                }
                
                // Set new metadata
                updatePayload[`metadata.${newName.toLowerCase()}`] = {
                    unit: optionData.unit || "",
                    category: optionData.category || ""
                };

                await retryFirestoreOperation(
                    () => setDoc(docRef, updatePayload, { merge: true }),
                    `updateOption - set updated items for ${collectionName}`
                );
            }
            logActivity({ type: "edit", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Updated option ${oldName} to ${newName} in ${collectionName}`, afterData: { items: updatedItems, ...meta } as Record<string, unknown> }).catch(() => {});
        }
        
        if (db) {
            try {
                // Direct delete of old item first to guarantee removal
                if (id) {
                    await db.options.delete(id);
                    await db.options.delete(id.toLowerCase());
                }
                if (oldName) {
                    await db.options.delete(oldName.toLowerCase());
                }

                // Fallback search-and-delete
                const oldOptions = await db.options.where('type').equals(collectionName).toArray();
                const oldOption = oldOptions.find(opt => {
                    const optId = typeof opt.id === 'string' ? opt.id.toLowerCase() : String(opt.id);
                    const optName = String(opt.name || '').toLowerCase();
                    return optId === id.toLowerCase() || optName === id.toLowerCase() || (oldName && optName === oldName.toLowerCase());
                });
                
                if (oldOption) {
                    await db.options.delete(oldOption.id);
                }
                
                const optionItem = { 
                    id: newName.toLowerCase(), 
                    name: newName, 
                    type: collectionName,
                    unit: optionData.unit,
                    category: optionData.category
                };
                await db.options.put(optionItem);
            } catch (dbError) {
                logError(dbError, `updateOption - IndexedDB update for ${collectionName}`, 'low');
            }
        }
    } catch (error) {
        logError(error, `updateOption(${collectionName}, ${id})`, 'medium');
        throw error;
    }
}

export async function deleteOption(collectionName: string, id: string, name: string): Promise<void> {
    try {
        const docRef = doc(optionsCollection, collectionName);
        const docSnap = await getDoc(docRef);
        const beforeItems = docSnap.exists() ? (docSnap.data().items || []) : [];
        const normalizedName = name.trim().toUpperCase();
        if (!isSqliteMode()) {
            await retryFirestoreOperation(
                () => setDoc(docRef, {
                    items: arrayRemove(normalizedName),
                    [`metadata.${normalizedName.toLowerCase()}`]: null,
                    ...getEditMetadata()
                }, { merge: true }),
                `deleteOption - remove item from ${collectionName}`
            );
        }
        logActivity({ type: "delete", collection: "options", docId: collectionName, docPath: getTenantCollectionPath("options").join("/"), summary: `Deleted option ${normalizedName} from ${collectionName}`, beforeData: { items: beforeItems } as Record<string, unknown> }).catch(() => {});
        
        if (db) {
            try {
                // Direct delete to guarantee execution
                if (id) {
                    await db.options.delete(id);
                    await db.options.delete(id.toLowerCase());
                }
                await db.options.delete(normalizedName.toLowerCase());

                // Fallback search-and-delete
                const oldOptions = await db.options.where('type').equals(collectionName).toArray();
                const oldOption = oldOptions.find(opt => {
                    const optId = typeof opt.id === 'string' ? opt.id.toLowerCase() : String(opt.id);
                    const optName = String(opt.name || '').toLowerCase();
                    return optId === id.toLowerCase() || optName === id.toLowerCase() || optName === normalizedName.toLowerCase();
                });
                
                if (oldOption) {
                    await db.options.delete(oldOption.id);
                }
            } catch (dbError) {
                logError(dbError, `deleteOption - IndexedDB update for ${collectionName}`, 'low');
            }
        }
    } catch (error) {
        logError(error, `deleteOption(${collectionName}, ${id})`, 'medium');
        throw error;
    }
}

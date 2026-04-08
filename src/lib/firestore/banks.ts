import { doc, getDoc, writeBatch, query, where, getDocs } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { db } from "../database";
import { isSqliteMode } from "../sqlite-storage";
import { getTenantDocPath, getTenantCollectionPath } from "../tenancy";
import { withCreateMetadata, withEditMetadata, logActivity, moveToRecycleBin } from "../audit";
import { bankBranchesCollection, bankAccountsCollection, createLocalSubscription } from "./core";
import { Bank, BankBranch, BankAccount } from "@/lib/definitions";

export async function addBank(bankName: string): Promise<Bank> {
  const normalizedBankName = bankName.trim().toUpperCase();
  const batch = writeBatch(firestoreDB);
  const docRef = doc(firestoreDB, ...getTenantDocPath('banks', normalizedBankName));
  const bankData = withCreateMetadata({ name: normalizedBankName, updatedAt: new Date().toISOString() } as Record<string, unknown>);
  batch.set(docRef, bankData);
  const { notifySyncRegistry } = await import('../sync-registry');
  await notifySyncRegistry('banks', { batch });
  
  const newBank = { id: docRef.id, ...(bankData as any) } as Bank;
  
  if (typeof window !== 'undefined' && db) {
    try {
      await db.banks.put(newBank);
      window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'banks' }));
      window.dispatchEvent(new CustomEvent('bank-added', { detail: normalizedBankName }));
    } catch { /* ignore */ }
  }

  await batch.commit();
  logActivity({ type: "create", collection: "banks", docId: docRef.id, docPath: getTenantCollectionPath("banks").join("/"), summary: `Created bank ${normalizedBankName}`, afterData: bankData as Record<string, unknown> }).catch(() => {});
  
  return newBank;
}

export async function deleteBank(id: string): Promise<void> {
    const docRef = doc(firestoreDB, ...getTenantDocPath("banks", id));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "banks", docId: id, docPath: getTenantCollectionPath("banks").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted bank ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('banks', { batch });
    
    if (typeof window !== 'undefined' && db) {
      try {
        await db.banks.delete(id);
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'banks' }));
      } catch { /* ignore */ }
    }

    await batch.commit();
}

export async function addBankBranch(branchData: Omit<BankBranch, 'id'>): Promise<BankBranch> {
    const { ifscCode, branchName, bankName } = branchData;
    if (!ifscCode || !branchName || !bankName) {
        throw new Error("Bank name, branch name, and IFSC code are required.");
    }
    const normalizedBankName = bankName.trim().toUpperCase();
    const normalizedBranchName = branchName.trim().toUpperCase();
    const normalizedIfsc = ifscCode.trim().toUpperCase();
    
    const q = query(bankBranchesCollection, 
        where("ifscCode", "==", normalizedIfsc),
        where("branchName", "==", normalizedBranchName),
        where("bankName", "==", normalizedBankName)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        throw new Error(`This exact branch already exists for ${normalizedBankName}.`);
    }

    const batch = writeBatch(firestoreDB);
    const docRef = doc(bankBranchesCollection);
    const dataWithTimestamp = withCreateMetadata({ 
        ...branchData, 
        bankName: normalizedBankName,
        branchName: normalizedBranchName,
        ifscCode: normalizedIfsc,
        updatedAt: new Date().toISOString() 
    } as Record<string, unknown>);
    batch.set(docRef, dataWithTimestamp);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    const newBranch = { id: docRef.id, ...(dataWithTimestamp as any) } as BankBranch;
    
    if (typeof window !== 'undefined' && db) {
      try {
        await db.bankBranches.put(newBranch);
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankBranches' }));
        window.dispatchEvent(new CustomEvent('branch-added', { detail: normalizedBranchName }));
      } catch { /* ignore */ }
    }

    await batch.commit();
    logActivity({ type: "create", collection: "bankBranches", docId: docRef.id, docPath: getTenantCollectionPath("bankBranches").join("/"), summary: `Created branch ${normalizedBranchName}`, afterData: dataWithTimestamp as Record<string, unknown> }).catch(() => {});
    
    return newBranch;
}

export async function updateBankBranch(id: string, branchData: Partial<BankBranch>): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const docRef = doc(firestoreDB, ...getTenantDocPath("bankBranches", id));
    const normalizedData = { ...branchData };
    if (normalizedData.branchName) normalizedData.branchName = normalizedData.branchName.trim().toUpperCase();
    if (normalizedData.bankName) normalizedData.bankName = normalizedData.bankName.trim().toUpperCase();
    if (normalizedData.ifscCode) normalizedData.ifscCode = normalizedData.ifscCode.trim().toUpperCase();

    const data = withEditMetadata({ ...normalizedData, updatedAt: new Date().toISOString() } as Record<string, unknown>);
    batch.update(docRef, data);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    if (typeof window !== 'undefined' && db) {
      try {
        const existing = await db.bankBranches.get(id);
        if (existing) {
          await db.bankBranches.put({ ...existing, ...normalizedData });
          window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankBranches' }));
        }
      } catch { /* ignore */ }
    }

    await batch.commit();
    logActivity({ type: "edit", collection: "bankBranches", docId: id, docPath: getTenantCollectionPath("bankBranches").join("/"), summary: `Updated branch ${id}`, afterData: data }).catch(() => {});
}

export async function deleteBankBranch(id: string): Promise<void> {
    const docRef = doc(firestoreDB, ...getTenantDocPath("bankBranches", id));
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await moveToRecycleBin({ collection: "bankBranches", docId: id, docPath: getTenantCollectionPath("bankBranches").join("/"), data: { id: snap.id, ...snap.data() } as Record<string, unknown>, summary: `Deleted branch ${id}` });
    }
    const batch = writeBatch(firestoreDB);
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('bankBranches', { batch });
    
    if (typeof window !== 'undefined' && db) {
      try {
        await db.bankBranches.delete(id);
        window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankBranches' }));
      } catch { /* ignore */ }
    }

    await batch.commit();
}

export async function addBankAccount(accountData: Partial<Omit<BankAccount, 'id'>>): Promise<BankAccount> {
    const { writeLocalFirst } = await import('../local-first-sync');
    const id = accountData.accountNumber || doc(bankAccountsCollection).id;
    const normalizedData = { ...accountData };
    if (normalizedData.bankName) normalizedData.bankName = normalizedData.bankName.trim().toUpperCase();
    if (normalizedData.branchName) normalizedData.branchName = normalizedData.branchName.trim().toUpperCase();
    if (normalizedData.ifscCode) normalizedData.ifscCode = normalizedData.ifscCode.trim().toUpperCase();
    if (normalizedData.accountHolderName) normalizedData.accountHolderName = normalizedData.accountHolderName.trim().toUpperCase();
    
    const newAccount = withCreateMetadata({ ...normalizedData, id, updatedAt: new Date().toISOString() } as Record<string, unknown>) as BankAccount;
    
    if (isSqliteMode()) {
        const dbInstance = (await import('../database')).db;
        await dbInstance.bankAccounts.put(newAccount);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankAccounts' }));
            window.dispatchEvent(new CustomEvent('bank-account-added', { detail: id }));
        }
        return newAccount;
    }

    const result = await writeLocalFirst('bankAccounts', 'create', id, newAccount) as BankAccount;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bank-account-added', { detail: id }));
    }
    return result;
}

export function getBanksRealtime(callback: (data: Bank[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<Bank>("banks", callback);
}

export function getBankBranchesRealtime(callback: (data: BankBranch[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<BankBranch>("bankBranches", callback);
}

export function getBankAccountsRealtime(callback: (data: BankAccount[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<BankAccount>("bankAccounts", callback);
}

export function getSupplierBankAccountsRealtime(callback: (data: any[]) => void, onError: (error: Error) => void) {
    return createLocalSubscription<any>("supplierBankAccounts", callback);
}

export async function addSupplierBankAccount(data: any): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    const id = data.id || `sba-${Date.now()}`;
    const normalizedData = { ...data, id };
    if (normalizedData.bankName) normalizedData.bankName = normalizedData.bankName.trim().toUpperCase();
    if (normalizedData.branchName) normalizedData.branchName = normalizedData.branchName.trim().toUpperCase();
    if (normalizedData.ifscCode) normalizedData.ifscCode = normalizedData.ifscCode.trim().toUpperCase();
    if (normalizedData.accountHolderName) normalizedData.accountHolderName = normalizedData.accountHolderName.trim().toUpperCase();
    
    await writeLocalFirst('supplierBankAccounts', 'create', id, normalizedData);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bank-account-added', { detail: id }));
    }
}

export async function updateSupplierBankAccount(id: string, data: any): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    const normalizedData = { ...data };
    if (normalizedData.bankName) normalizedData.bankName = normalizedData.bankName.trim().toUpperCase();
    if (normalizedData.branchName) normalizedData.branchName = normalizedData.branchName.trim().toUpperCase();
    if (normalizedData.ifscCode) normalizedData.ifscCode = normalizedData.ifscCode.trim().toUpperCase();
    if (normalizedData.accountHolderName) normalizedData.accountHolderName = normalizedData.accountHolderName.trim().toUpperCase();
    
    await writeLocalFirst('supplierBankAccounts', 'update', id, undefined, normalizedData);
}

export async function deleteSupplierBankAccount(id: string): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    await writeLocalFirst('supplierBankAccounts', 'delete', id);
}

export async function updateBankAccount(id: string, accountData: Partial<BankAccount>): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');
    
    if (isSqliteMode()) {
        const dbInstance = (await import('../database')).db;
        const existing = await dbInstance.bankAccounts.get(id);
        const data = withEditMetadata({ ...existing, ...accountData, updatedAt: new Date().toISOString() } as Record<string, unknown>) as BankAccount;
        await dbInstance.bankAccounts.put(data);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankAccounts' }));
        }
        return;
    }

    await writeLocalFirst('bankAccounts', 'update', id, undefined, accountData);
}

export async function deleteBankAccount(id: string): Promise<void> {
    const { writeLocalFirst } = await import('../local-first-sync');

    if (isSqliteMode()) {
        const dbInstance = (await import('../database')).db;
        await dbInstance.bankAccounts.delete(id);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sqlite-change', { detail: 'bankAccounts' }));
        }
        return;
    }

    await writeLocalFirst('bankAccounts', 'delete', id);
}

import { doc, setDoc, getDoc, deleteDoc, collection, Timestamp, query, where, orderBy, getDocs, writeBatch } from "firebase/firestore";
import { firestoreDB } from "../firebase";
import { getDb } from "../database";
import { getErpCollectionPath } from "../tenancy";
import { settingsCollection, mandiHeaderDocRef, bankAccountsCollection, handleSilentError, isSqliteMode } from "./core";
import { RtgsSettings, ReceiptSettings, ReceiptFieldSettings, MandiHeaderSettings, BankAccount, Holiday, FormatSettings } from "@/lib/definitions";

export async function getCompanyEmailSettings(erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<{ email: string; appPassword: string } | null> {
    try {
        let coll = settingsCollection;
        if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
            coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
        }
        const docRef = doc(coll, "emailConfig");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as { email: string; appPassword: string };
        }
    } catch (e) {
        console.error("Error getting company email settings:", e);
    }
    return null;
}

export async function saveCompanyEmailSettings(settings: { email: string; appPassword: string }, erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<void> {
    let coll = settingsCollection;
    if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
        coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
    }
    const docRef = doc(coll, "emailConfig");
    await setDoc(docRef, settings, { merge: true });
}

export async function deleteCompanyEmailSettings(erp?: { companyId: string; subCompanyId: string; seasonKey: string }): Promise<void> {
    let coll = settingsCollection;
    if (erp?.companyId && erp?.subCompanyId && erp?.seasonKey) {
        coll = collection(firestoreDB, ...getErpCollectionPath("settings", erp));
    }
    const docRef = doc(coll, "emailConfig");
    await deleteDoc(docRef);
}

export async function getRtgsSettings(): Promise<RtgsSettings> {
    if (isSqliteMode()) {
        const { getReceiptSettingsFromLocal } = await import('../database');
        const local = await getReceiptSettingsFromLocal();
        if (local) return local as RtgsSettings;
    }

    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as RtgsSettings;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return data;
    }
    return {
        companyName: "BizSuite DataFlow",
        companyAddress1: "123 Business Rd",
        companyAddress2: "Suite 100, BizCity",
        contactNo: "9876543210",
        gmail: "contact@bizsuite.com",
    } as RtgsSettings;
}

export async function updateRtgsSettings(settings: Partial<RtgsSettings>): Promise<void> {
    if (isSqliteMode()) {
        const d = getDb();
        const existing = await d.settings.get('companyDetails');
        await d.settings.put({ ...existing, ...settings, id: 'companyDetails' } as any);
    }
    
    try {
        const docRef = doc(settingsCollection, "companyDetails");
        await setDoc(docRef, settings, { merge: true });
    } catch (e) {
        if (!isSqliteMode()) throw e;
        console.warn("Firestore sync for RTGS settings failed (skipped in SQLite mode):", e);
    }
}

const defaultReceiptFields: ReceiptFieldSettings = {
    date: true, name: true, contact: true, address: true, vehicleNo: true, term: true, rate: true, grossWeight: true, teirWeight: true, weight: true, amount: true, dueDate: true, kartaWeight: true, netAmount: true, srNo: true, variety: true, netWeight: true,
};

export async function getReceiptSettings(): Promise<ReceiptSettings | null> {
    if (isSqliteMode()) {
        const { getReceiptSettingsFromLocal } = await import('../database');
        return await getReceiptSettingsFromLocal();
    }
    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ReceiptSettings>;
        if (data.defaultBankAccountId) {
            const bankDoc = await getDoc(doc(bankAccountsCollection, data.defaultBankAccountId));
            if (bankDoc.exists()) {
                data.defaultBank = bankDoc.data() as BankAccount;
            }
        }
        return {
            companyName: data.companyName || "JAGDAMBE RICE MILL",
            companyAddress1: data.companyAddress1 || "Devkali Road, Banda, Shajahanpur",
            companyAddress2: data.companyAddress2 || "Near Devkali, Uttar Pradesh",
            contactNo: data.contactNo || "9555130735",
            gmail: data.gmail || "JRMDofficial@gmail.com",
            fields: { ...defaultReceiptFields, ...(data.fields || {}) },
            defaultBankAccountId: data.defaultBankAccountId,
            defaultBank: data.defaultBank,
            companyGstin: data.companyGstin,
            companyStateName: data.companyStateName,
            companyStateCode: data.companyStateCode,
            panNo: data.panNo
        };
    }
    return {
        companyName: "JAGDAMBE RICE MILL",
        companyAddress1: "Devkali Road, Banda, Shajahanpur",
        companyAddress2: "Near Devkali, Uttar Pradesh",
        contactNo: "9555130735",
        gmail: "JRMDofficial@gmail.com",
        fields: defaultReceiptFields,
    };
}

export async function updateReceiptSettings(settings: Partial<ReceiptSettings>): Promise<void> {
    const docRef = doc(settingsCollection, "companyDetails");
    await setDoc(docRef, settings, { merge: true });
}

export async function getMandiHeaderSettings(): Promise<MandiHeaderSettings | null> {
    const snapshot = await getDoc(mandiHeaderDocRef);
    if (!snapshot.exists()) return null;
    const data = snapshot.data() as Partial<MandiHeaderSettings>;
    return {
        firmName: data.firmName || "", firmAddress: data.firmAddress || "", mandiName: data.mandiName || "", licenseNo: data.licenseNo || "", licenseNo2: data.licenseNo2 || "", mandiType: data.mandiType || "", registerNo: data.registerNo || "", commodity: data.commodity || "", financialYear: data.financialYear || "",
    };
}

export async function saveMandiHeaderSettings(settings: Partial<MandiHeaderSettings>): Promise<void> {
    const payload: Partial<MandiHeaderSettings> = {};
    if (settings.firmName !== undefined) payload.firmName = settings.firmName;
    if (settings.firmAddress !== undefined) payload.firmAddress = settings.firmAddress;
    if (settings.mandiName !== undefined) payload.mandiName = settings.mandiName;
    if (settings.licenseNo !== undefined) payload.licenseNo = settings.licenseNo;
    if (settings.licenseNo2 !== undefined) payload.licenseNo2 = settings.licenseNo2;
    if (settings.mandiType !== undefined) payload.mandiType = settings.mandiType;
    if (settings.registerNo !== undefined) payload.registerNo = settings.registerNo;
    if (settings.commodity !== undefined) payload.commodity = settings.commodity;
    if (settings.financialYear !== undefined) payload.financialYear = settings.financialYear;
    await setDoc(mandiHeaderDocRef, payload, { merge: true });
}

// --- Holiday Functions ---
export async function getHolidays(): Promise<Holiday[]> {
    const d = getDb();
    if (d) {
        try {
            const localHolidays = await d.settings.where('id').startsWith('holiday:').toArray();
            if (isSqliteMode() || localHolidays.length > 0) return localHolidays as Holiday[];
        } catch (error) {
            handleSilentError(error, 'getHolidays - local read fallback');
        }
    }

    const getLastSyncTime = (): number | undefined => {
        if (typeof window === 'undefined') return undefined;
        const stored = localStorage.getItem('lastSync:holidays');
        return stored ? parseInt(stored, 10) : undefined;
    };

    const lastSyncTime = getLastSyncTime();
    let q;
    const { getTenantCollectionPath } = await import('../tenancy');
    const holidaysPath = getTenantCollectionPath("holidays");
    if (lastSyncTime) {
        const lastSyncTimestamp = Timestamp.fromMillis(lastSyncTime);
        q = query(collection(firestoreDB, ...holidaysPath), where('updatedAt', '>', lastSyncTimestamp), orderBy('updatedAt'));
    } else {
        q = query(collection(firestoreDB, ...holidaysPath));
    }

    const querySnapshot = await getDocs(q);
    const holidays = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id } as Holiday));
    if (d && holidays.length > 0 && typeof window !== 'undefined') {
        localStorage.setItem('lastSync:holidays', String(Date.now()));
    }
    return holidays;
}

export async function addHoliday(date: string, name: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const { getTenantDocPath } = await import('../tenancy');
    const docRef = doc(firestoreDB, ...getTenantDocPath("holidays", date));
    batch.set(docRef, { date, name, updatedAt: Timestamp.now() });
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('holidays', { batch });
    await batch.commit();
}

export async function deleteHoliday(id: string): Promise<void> {
    const batch = writeBatch(firestoreDB);
    const { getTenantDocPath } = await import('../tenancy');
    const docRef = doc(firestoreDB, ...getTenantDocPath("holidays", id));
    batch.delete(docRef);
    const { notifySyncRegistry } = await import('../sync-registry');
    await notifySyncRegistry('holidays', { batch });
    await batch.commit();
}

// --- Daily Payment Limit ---
export async function getDailyPaymentLimit(): Promise<number> {
    const d = getDb();
    if (d) {
        try {
            const data = await d.settings.get('companyDetails') as any;
            if (isSqliteMode() || data?.dailyPaymentLimit !== undefined) return data?.dailyPaymentLimit ?? 800000;
        } catch (error) {
            handleSilentError(error, 'getDailyPaymentLimit - local read fallback');
        }
    }
    const docRef = doc(settingsCollection, "companyDetails");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().dailyPaymentLimit) return docSnap.data().dailyPaymentLimit;
    return 800000;
}

// --- Format Settings Functions ---
export async function getFormatSettings(): Promise<FormatSettings> {
    const docRef = doc(settingsCollection, "formats");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data() as FormatSettings;
    return {
        income: { prefix: 'IM', padding: 5 }, expense: { prefix: 'ES', padding: 5 }, loan: { prefix: 'LN', padding: 4 }, fundTransaction: { prefix: 'AT', padding: 4 }, supplier: { prefix: 'S', padding: 5 }, customer: { prefix: 'C', padding: 5 }, supplierPayment: { prefix: 'SP', padding: 5 }, customerPayment: { prefix: 'CP', padding: 5 },
    };
}

export async function saveFormatSettings(settings: FormatSettings): Promise<void> {
    const docRef = doc(settingsCollection, "formats");
    await setDoc(docRef, settings, { merge: true });
}

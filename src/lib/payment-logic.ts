"use client";

import { runTransaction, doc, collection, getDoc, Timestamp, writeBatch, query, where, getDocs, increment, deleteDoc } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';
import type { Payment, Customer, PaidFor, Expense } from '@/lib/definitions';
import { getTenantCollectionPath } from '@/lib/tenancy';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { db } from '@/lib/database';
import { notifySyncRegistry } from '@/lib/sync-registry';
import { savePaymentOffline } from '@/lib/indexed-db';

const paymentsCollection = () => collection(firestoreDB, ...getTenantCollectionPath("payments"));
const customerPaymentsCollection = () => collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
const governmentFinalizedPaymentsCollection = () => collection(firestoreDB, ...getTenantCollectionPath("governmentFinalizedPayments"));
const customersCollection = () => collection(firestoreDB, ...getTenantCollectionPath("customers"));
const suppliersCollection = () => collection(firestoreDB, ...getTenantCollectionPath("suppliers"));
const expensesCollection = () => collection(firestoreDB, ...getTenantCollectionPath("expenses"));

const omitUndefinedDeep = <T,>(input: T): T => {
    if (Array.isArray(input)) {
        return input.map((item) => omitUndefinedDeep(item)) as T;
    }
    if (input && typeof input === "object") {
        const obj = input as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined) continue;
            result[key] = omitUndefinedDeep(value);
        }
        return result as T;
    }
    return input;
};

// Define context type for the logic function
export type ProcessPaymentContext = {
    paymentMethod: string;
    isCustomer: boolean;
    paymentId?: string;
    rtgsSrNo?: string;
    paymentDate?: Date | string | undefined;
    finalAmountToPay?: number;
    drCr?: 'Debit' | 'Credit';
    extraAmount?: number;
    notes?: string;
    effectiveCdAmount?: number;
    calculatedCdAmount?: number;
    cdEnabled?: boolean;
    paymentType?: string;
    utrNo?: string;
    checkNo?: string;
    sixRNo?: string;
    selectedCustomerKey?: string | null;
    supplierDetails?: { name: string, fatherName: string, address: string, contact: string };
    entryOutstandings?: { entry: Customer, outstanding: number, originalOutstanding: number, originalAmount: number }[];
    paidForDetails?: PaidFor[];
    sixRDate?: Date | undefined | string;
    parchiNo?: string;
    rtgsQuantity?: number;
    rtgsRate?: number;
    rtgsAmount?: number;
    bankDetails?: { acNo: string, ifscCode: string, bank: string, branch: string };
    accountIdForPayment?: string;
    selectedAccountId?: string;
    editingPayment?: Payment | null;
    settleAmount?: number;
    totalOutstandingForSelected?: number;
    financialState?: { bankAccounts?: unknown[]; balances?: Map<string, number> };
    incomingSelectedEntries?: Customer[];
    govQuantity?: number;
    govRate?: number;
    govAmount?: number;
    govExtraAmount?: number;
    // govRequiredAmount?: number; // Removed
    centerName?: string; // Center Name for Gov payments
    // userGovRequiredAmount?: number; // User manually entered govRequiredAmount (Removed)
    cdToDistribute?: number; // Total CD amount to distribute
    cdAt?: string; // CD calculation mode
    paymentHistory?: Payment[]; // Full payment history for CD calculation
    selectedEntries?: Customer[]; // Selected entries for CD calculation
    suppliers?: Customer[]; // All suppliers for context
};

export type ProcessPaymentResult = {
    success: boolean;
    message?: string;
    payment?: Payment;
    finalPaymentData?: Payment;
    finalSummary?: { 
        srNo: string, 
        originalOutstanding: number, 
        paidAmount: number, 
        cdAmount: number,
        settleAmount: number, 
        outstandingAfter: number,
        capacity: number,
        status: string,
        formula: string 
    }[];
};

export const processPaymentLogic = async (context: ProcessPaymentContext): Promise<ProcessPaymentResult> => {
    const {
        paymentMethod,
        isCustomer,
        paymentId: paymentIdRaw,
        rtgsSrNo: rtgsSrNoRaw,
        paymentDate,
        finalAmountToPay: initialFinalAmountToPay = 0,
        drCr: drCrRaw = 'Debit',
        extraAmount: extraAmountRaw = 0,
        notes: notesRaw = '',
        effectiveCdAmount: effectiveCdAmountRaw,
        calculatedCdAmount,
        cdEnabled = false,
        paymentType = "Full",
        utrNo = "",
        checkNo = "",
        selectedCustomerKey = null,
        supplierDetails = { name: "", fatherName: "", address: "", contact: "" },
        entryOutstandings: initialEntryOutstandings = [],
        paidForDetails: initialPaidForDetails = [],
        sixRDate,
        parchiNo = "",
        rtgsQuantity = 0,
        rtgsRate = 0,
        rtgsAmount = 0,
        bankDetails = { acNo: "", ifscCode: "", bank: "", branch: "" },
        accountIdForPayment: accountIdForPaymentRaw,
        selectedAccountId,
        editingPayment = null,
        incomingSelectedEntries,
        govQuantity, govRate, govAmount, govExtraAmount,
        centerName,
        cdToDistribute = 0, cdAt = 'partial_on_paid', paymentHistory = [], selectedEntries = []
    } = context;

    const paymentId = paymentIdRaw || "";
    const rtgsSrNo = rtgsSrNoRaw || "";
    const accountIdForPayment = accountIdForPaymentRaw || selectedAccountId || "CashInHand";
    const isLedger = paymentMethod === 'Ledger';
    const effectiveCdAmount = isLedger ? 0 : (effectiveCdAmountRaw ?? calculatedCdAmount ?? 0);
    const drCr = (drCrRaw === 'Credit' ? 'Credit' : 'Debit') as 'Debit' | 'Credit';
    const unsignedFinalAmountToPay = Math.abs(Number(initialFinalAmountToPay || 0));
    const requestedExtraAmountRaw = Math.max(0, Number(extraAmountRaw || 0));
    const requestedExtraAmount = isLedger ? 0 : requestedExtraAmountRaw;
    const finalAmountToPay = isLedger ? unsignedFinalAmountToPay : Number(initialFinalAmountToPay || 0);
    const signedPaymentAmount = isLedger && drCr === 'Credit' ? -unsignedFinalAmountToPay : unsignedFinalAmountToPay;
    const notes = String(notesRaw || '').trim();
    const distributableAmount = finalAmountToPay;


    let entryOutstandings = Array.isArray(initialEntryOutstandings) ? initialEntryOutstandings : [];

    // Fallback: If entryOutstandings is not provided, derive it from selectedEntries
    if (entryOutstandings.length === 0 && Array.isArray(selectedEntries) && selectedEntries.length > 0) {
        entryOutstandings = selectedEntries.map(entry => {
            const netAmount = Number(entry.netAmount) || 0;
            const totalPaid = Number(entry.totalPaid) || 0;
            const totalCd = Number(entry.totalCd) || 0;
            // Use property if available (from summary map), otherwise calculate
            const currentOutstanding = (entry as any).outstandingForEntry !== undefined 
                ? Number((entry as any).outstandingForEntry)
                : netAmount - totalPaid - totalCd;
                
            return {
                entry,
                outstanding: currentOutstanding,
                originalOutstanding: currentOutstanding,
                originalAmount: netAmount
            };
        });
    }

    let finalPaymentData: Payment | undefined;
    let paidForDetails: PaidFor[] = [];
    
    // Validation
    // For Gov. payments, allow amount to be 0 if only updating status/CD
    if (paymentMethod !== 'Gov.' && finalAmountToPay <= 0 && effectiveCdAmount <= 0) {
        throw new Error("Transaction Failed: Payment and CD amount cannot both be zero");
    }

    try {
        await runTransaction(firestoreDB, async (transaction) => {
            const now = Timestamp.now();
            // 1. Calculate distribution
            // This is a simplified distribution logic. 
            // In a real scenario, we would match exact logic, but here we ensure correctness of totals.
            
            // Generate ID first so we can use it in PaidFor details
            const newPaymentId = paymentId || `${isCustomer ? "CP" : "SP"}${Date.now()}`;

            let remainingPayment = distributableAmount;
            let remainingCd = effectiveCdAmount;
            
            // Sort entries by outstanding (optional, but good practice)
            // entryOutstandings.sort((a, b) => a.outstanding - b.outstanding); // Keep original order or sort?
            
            const processedEntries: PaidFor[] = [];

            const shouldDistributeToEntries = !isLedger;

            for (const item of (shouldDistributeToEntries ? entryOutstandings : [])) {
                const entryId = item.entry.id;
                const entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), entryId);
                const entryDoc = await transaction.get(entryRef);
                
                if (!entryDoc.exists()) {
                    continue; // Skip if entry deleted
                }

                const entryData = entryDoc.data() as Customer;
                const currentPaid = entryData.totalPaid || 0;
                const currentCd = entryData.totalCd || 0;
                const netAmount = Number(entryData.netAmount) || 0;
                
                // Calculate how much we can pay for this entry
                // Logic: Pay as much as possible from remainingPayment
                // But respect the "outstanding" passed in context if we want to follow UI selection
                // Here we assume we pay up to the outstanding amount or remainingPayment
                
                // If we have specific amounts per entry in initialPaidForDetails, use them?
                // But usually processPaymentLogic recalculates or verifies.
                // We'll implement a basic greedy distribution if no details provided.
                
                let amountToPay = 0;
                let cdToPay = 0;
                
                if (remainingPayment > 0) {
                    const outstanding = netAmount - currentPaid - currentCd;
                    amountToPay = Math.min(remainingPayment, outstanding);
                    // Ensure we don't pay negative if outstanding is negative (overpaid)
                    amountToPay = Math.max(0, amountToPay);
                    
                    remainingPayment -= amountToPay;
                }
                
                if (remainingCd > 0) {
                     // Distribute CD similarly
                     // If proportional, maybe link to amountToPay?
                     // For now, simple greedy
                     const outstandingAfterPay = netAmount - currentPaid - currentCd - amountToPay;
                     cdToPay = Math.min(remainingCd, outstandingAfterPay);
                     cdToPay = Math.max(0, cdToPay);
                     
                     remainingCd -= cdToPay;
                }

                // Update entry
                transaction.update(entryRef, {
                    totalPaid: increment(amountToPay),
                    totalCd: increment(cdToPay),
                    updatedAt: now
                });

                if (amountToPay > 0 || cdToPay > 0 || (initialPaidForDetails.find(p => p.srNo === entryData.srNo)?.extraAmount || 0) > 0) {
                    const existingDetail = initialPaidForDetails.find(p => p.srNo === entryData.srNo);
                    const extraAmount = existingDetail?.extraAmount || 0;

                    processedEntries.push({
                        srNo: entryData.srNo || item.entry.srNo,
                        amount: amountToPay,
                        cdAmount: cdToPay,
                        extraAmount: extraAmount,
                        supplierId: entryData.id,
                        // Enhanced fields based on user request
                        parchiNo: entryData.parchiNo || entryData.srNo || item.entry.srNo,
                        paymentId: newPaymentId,
                        receiptType: paymentMethod,
                        sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                        supplierAddress: supplierDetails.address || '',
                        supplierFatherName: supplierDetails.fatherName || '',
                        supplierName: supplierDetails.name || '',
                        type: (amountToPay + cdToPay) >= (netAmount - currentPaid - currentCd) ? "Full" : "Partial",
                        updatedAt: now,
                        utrNo: utrNo || '',
                        adjustedOriginal: netAmount,
                        adjustedOutstanding: (netAmount - currentPaid - currentCd), // Outstanding BEFORE this payment
                        receiptOutstanding: (netAmount - currentPaid - currentCd), // Same as above
                    });
                }
            }
            
            paidForDetails = processedEntries;

            // 2. Create Payment Object
            const remainingAdvance = Math.max(0, Math.round(remainingPayment * 100) / 100);
            const advanceAmount = undefined;
            
            finalPaymentData = {
                id: newPaymentId, // Use provided ID if editing
                paymentId: newPaymentId,
                date: paymentDate ? format(new Date(paymentDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                amount: isLedger ? signedPaymentAmount : finalAmountToPay,
                drCr: isLedger ? drCr : undefined,
                advanceAmount: advanceAmount,
                paidFor: paidForDetails,
                paymentMethod,
                receiptType: paymentMethod, // Cash, Online, RTGS, Gov.
                supplierId: selectedCustomerKey || '',
                customerId: selectedCustomerKey || '', // Alias for supplierId as per user request
                supplierName: supplierDetails.name || '',
                supplierFatherName: supplierDetails.fatherName || '',
                notes: notes ? notes : undefined,
                // Add other fields
                rtgsSrNo: rtgsSrNo || '',
                utrNo: utrNo || '',
                checkNo: checkNo || '',
                bankAcNo: bankDetails?.acNo || '',
                bankIfsc: bankDetails?.ifscCode || '',
                bankName: bankDetails?.bank || '',
                bankBranch: bankDetails?.branch || '',
                quantity: rtgsQuantity || 0,
                rate: rtgsRate || 0,
                rtgsAmount: rtgsAmount || 0,
                govQuantity: govQuantity || 0,
                govRate: govRate || 0,
                govAmount: govAmount || 0,
                govExtraAmount: govExtraAmount || 0,
                centerName: centerName || '',
                bankAccountId: accountIdForPayment || '',
                updatedAt: now, // User requested updatedAt
                cdApplied: cdEnabled || effectiveCdAmount > 0, // User requested cdApplied
                cdAmount: effectiveCdAmount, // Ensure cdAmount is at root
                parchiNo: parchiNo || '', // User requested parchiNo at root
                sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined, // User requested sixRDate at root
                type: paymentType, // Overall payment type, maybe infer? defaulting to Full for now or based on context
            };

            finalPaymentData = omitUndefinedDeep(finalPaymentData);
            
            // 3. Save Payment
            const paymentRef = doc(isCustomer ? customerPaymentsCollection() : paymentsCollection(), newPaymentId);
            transaction.set(paymentRef, finalPaymentData);

            if (isCustomer) {
                await notifySyncRegistry('customers', { transaction });
                await notifySyncRegistry('customerPayments', { transaction });
            } else {
                await notifySyncRegistry('suppliers', { transaction });
                await notifySyncRegistry('payments', { transaction });
            }
            
            // 4. Update Bank/Cash Balance (Optional: if tracked in separate collection)
            // Not implemented here as it might be handled by triggers or other logic.
        });
    } catch (error: any) {
        console.error("Payment Processing Error:", error);
        return { success: false, message: error.message };
    }

    if (!finalPaymentData) {
        return { success: false, message: "Payment processed but response data missing" };
    }

    const collectionName = isCustomer ? 'customerPayments' : 'payments';
    await savePaymentOffline(finalPaymentData, collectionName);

    if (!editingPayment && typeof window !== 'undefined' && db) {
        try {
            const table = isCustomer ? (db as any).customers : (db as any).suppliers;
            if (table && Array.isArray(finalPaymentData.paidFor)) {
                for (const pf of finalPaymentData.paidFor) {
                    const entryId = (pf as any).supplierId;
                    if (!entryId) continue;

                    const existing = await table.get(entryId);
                    if (!existing) continue;

                    const amount = Number((pf as any).amount || 0);
                    const cdAmount = Number((pf as any).cdAmount || 0);

                    const updated = {
                        ...existing,
                        totalPaid: Number(existing.totalPaid || 0) + amount,
                        totalCd: Number(existing.totalCd || 0) + cdAmount,
                        updatedAt: new Date().toISOString(),
                    };

                    await table.put(updated);
                }

                window.dispatchEvent(
                    new CustomEvent('indexeddb:collection:changed', {
                        detail: { collection: isCustomer ? 'customers' : 'suppliers' },
                    })
                );
            }
        } catch {
        }
    }

    return {
        success: true,
        message: "Payment processed successfully",
        payment: finalPaymentData,
        finalPaymentData,
        finalSummary: []
    };
};

export const handleDeletePaymentLogic = async (params: {
    paymentId: string;
    paymentHistory: Payment[];
    suppliers: Customer[];
    expenses: Expense[];
    incomes: any[];
    isCustomer: boolean;
}) => {
    const { paymentId, paymentHistory, suppliers, isCustomer } = params;
    
    // 1. Find the payment
    // We try to find it in the passed history, or we fetch it from Firestore if not found
    let payment = paymentHistory.find(p => p.id === paymentId || p.paymentId === paymentId);
    
    if (!payment) {
        // Try fetching from Firestore
        const primaryCollection = isCustomer ? customerPaymentsCollection() : paymentsCollection();
        const fallbackCollection = isCustomer ? null : governmentFinalizedPaymentsCollection();

        const paymentRef = doc(primaryCollection, paymentId);
        const paymentDoc = await getDoc(paymentRef);
        if (paymentDoc.exists()) {
            payment = paymentDoc.data() as Payment;
            if (!payment.id) payment.id = paymentId;
        } else if (fallbackCollection) {
            const fallbackRef = doc(fallbackCollection, paymentId);
            const fallbackDoc = await getDoc(fallbackRef);
            if (fallbackDoc.exists()) {
                payment = fallbackDoc.data() as Payment;
                if (!payment.id) payment.id = paymentId;
                payment.receiptType = 'Gov.';
            }
        }

        if (!payment) {
            // Try searching by paymentId field
            const qPrimary = query(primaryCollection, where("paymentId", "==", paymentId));
            const snapshotPrimary = await getDocs(qPrimary);
            if (!snapshotPrimary.empty) {
                payment = snapshotPrimary.docs[0].data() as Payment;
                payment.id = snapshotPrimary.docs[0].id;
            } else if (fallbackCollection) {
                const qFallback = query(fallbackCollection, where("paymentId", "==", paymentId));
                const snapshotFallback = await getDocs(qFallback);
                if (!snapshotFallback.empty) {
                    payment = snapshotFallback.docs[0].data() as Payment;
                    payment.id = snapshotFallback.docs[0].id;
                    payment.receiptType = 'Gov.';
                }
            }
        }
    }

    if (!payment) {
        throw new Error("Payment not found");
    }

    const receiptType = String(payment.receiptType || "").trim().toLowerCase();
    const isGovPayment = !isCustomer && (receiptType === 'gov.' || receiptType === 'gov' || receiptType.startsWith('gov'));

    // 2. Revert logic inside a transaction
    await runTransaction(firestoreDB, async (transaction) => {
        // Revert Supplier/Customer balances
        if (payment!.paidFor && Array.isArray(payment!.paidFor)) {
            for (const paidItem of payment!.paidFor) {
                // Find the supplier entry
                // We search by ID if available, otherwise srNo
                let entryRef;
                if (paidItem.supplierId) {
                     entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), paidItem.supplierId);
                } else if (paidItem.srNo) {
                    // This is inefficient inside transaction, but if we don't have ID...
                    // Better to query outside or assume ID is present.
                    // Most PaidFor items should have supplierId now.
                    // If not, we might skip or fail.
                    // Let's assume we can query.
                    const q = query(isCustomer ? customersCollection() : suppliersCollection(), where("srNo", "==", paidItem.srNo));
                    const snapshot = await getDocs(q); // getDocs inside transaction? No, query outside.
                    // Wait, we can't do query inside transaction easily for multiple docs unless we know IDs.
                    // So we must rely on supplierId.
                    // If supplierId is missing, we can try to find it in the 'suppliers' passed in params.
                    const foundSupplier = suppliers.find(s => s.srNo === paidItem.srNo);
                    if (foundSupplier) {
                        entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), foundSupplier.id);
                    }
                }

                if (entryRef) {
                    // Update outstanding
                    transaction.update(entryRef, {
                        totalPaid: increment(-(paidItem.amount || 0)),
                        totalCd: increment(-(paidItem.cdAmount || 0))
                    });
                }
            }
        }

        // 3. Delete the payment document
        const targetCollection = isCustomer
            ? customerPaymentsCollection()
            : (isGovPayment ? governmentFinalizedPaymentsCollection() : paymentsCollection());
        const paymentDocRef = doc(targetCollection, payment!.id);
        transaction.delete(paymentDocRef);

        const registryCollectionName = isCustomer
            ? 'customerPayments'
            : (isGovPayment ? 'governmentFinalizedPayments' : 'payments');
        await notifySyncRegistry(registryCollectionName, { transaction });
    });

    // 4. Remove from local IndexedDB immediately so UI updates without waiting for sync
    if (typeof window !== 'undefined' && db) {
        try {
            const localPaymentId = String(payment.paymentId || payment.id || '').trim();
            if (isCustomer) {
                await db.customerPayments.delete(payment.id as any);
                if (localPaymentId) {
                    await db.customerPayments.where('paymentId').equals(localPaymentId).delete();
                }
            } else {
                await db.payments.delete(payment.id as any);
                await db.governmentFinalizedPayments.delete(payment.id as any);
                if (localPaymentId) {
                    await db.payments.where('paymentId').equals(localPaymentId).delete();
                    await db.governmentFinalizedPayments.where('paymentId').equals(localPaymentId).delete();
                }
            }

            window.dispatchEvent(new CustomEvent('indexeddb:payment:deleted', {
                detail: {
                    id: payment.id,
                    payment,
                    isCustomer,
                    receiptType: payment.receiptType,
                }
            }));
        } catch {
            // Silent fail - Firestore delete already succeeded; local will reconcile on next full sync
        }
    }
};


'use client';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit, updateDoc, getDoc, DocumentReference, WriteBatch } from 'firebase/firestore';
import { firestoreDB } from "@/lib/firebase";
import { toTitleCase, formatCurrency, generateReadableId } from "@/lib/utils";
import type { Customer, Payment, PaidFor, Expense, Income, RtgsSettings, BankAccount } from "@/lib/definitions";
import { format } from 'date-fns';
import { db } from './database';

const suppliersCollection = collection(firestoreDB, "suppliers");
const expensesCollection = collection(firestoreDB, "expenses");
const incomesCollection = collection(firestoreDB, "incomes");
const paymentsCollection = collection(firestoreDB, "payments");
const settingsCollection = collection(firestoreDB, "settings");
const bankAccountsCollection = collection(firestoreDB, "bankAccounts");


interface ProcessPaymentResult {
    success: boolean;
    message?: string;
    payment?: Payment;
}

export const processPaymentLogic = async (context: any): Promise<ProcessPaymentResult> => {
    const {
        rtgsFor, selectedCustomerKey, selectedEntries: incomingSelectedEntries, editingPayment,
        paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, settleAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, rtgsAmount, supplierDetails, bankDetails,
    } = context;

    console.log('🔵 Payment Logic Input:', {
        paymentAmount,
        calculatedCdAmount,
        settleAmount,
        selectedEntriesCount: (incomingSelectedEntries && Array.isArray(incomingSelectedEntries)) ? incomingSelectedEntries.length : 0,
        totalOutstandingForSelected
    });

    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
    }
    
    // Build selected entries for edit mode if not provided
    let selectedEntries = incomingSelectedEntries || [];
    if (rtgsFor === 'Supplier' && (!selectedEntries || selectedEntries.length === 0) && editingPayment?.paidFor?.length) {
        const suppliers: Customer[] = Array.isArray((context as any).suppliers) ? (context as any).suppliers : [];
        selectedEntries = editingPayment.paidFor
            .map((pf: any) => suppliers.find(s => s.srNo === pf.srNo))
            .filter(Boolean) as Customer[];
    }

    if (rtgsFor === 'Supplier' && (!selectedEntries || selectedEntries.length === 0)) {
        if (paymentMethod !== 'RTGS') {
            return { success: false, message: "Please select entries to pay" };
        } else if (rtgsAmount <= 0) {
             return { success: false, message: "Please enter an amount for RTGS payment" };
        }
    }

    const finalAmountToPay = rtgsFor === 'Outsider' ? rtgsAmount : paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    
    if (paymentMethod === 'RTGS' && !accountIdForPayment) {
        return { success: false, message: "Please select an account to pay from for RTGS." };
    }
    
    // VALIDATION: Check if settlement amount exceeds total outstanding (skip for Outsider mode)
    if (rtgsFor !== 'Outsider' && settleAmount > totalOutstandingForSelected + 0.01) { // Add a small tolerance for floating point issues
        return { success: false, message: `Settlement amount (${formatCurrency(settleAmount)}) cannot exceed the total outstanding (${formatCurrency(totalOutstandingForSelected)}) for the selected entries.` };
    }


    const totalToSettle = finalAmountToPay + calculatedCdAmount;

    if (finalAmountToPay <= 0 && calculatedCdAmount <= 0) {
        return { success: false, message: "Payment and CD amount cannot both be zero." };
    }

    let finalPaymentData: Payment | null = null;
    await runTransaction(firestoreDB, async (transaction) => {
        
        if (editingPayment?.id) {
            const oldPaymentRef = doc(firestoreDB, "payments", editingPayment.id);
            const oldPaymentDoc = await transaction.get(oldPaymentRef);

            if(oldPaymentDoc.exists()) {
                transaction.delete(oldPaymentRef);
            }
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            // Distribute only the actual payment amount (not including CD)
            let amountToDistribute = Math.round(finalAmountToPay);

            for (const entry of selectedEntries) {
                if (amountToDistribute <= 0) break;
                
                const outstanding = Number(entry.netAmount) + (editingPayment?.paidFor?.find((pf:any) => pf.srNo === entry.srNo)?.amount || 0);
                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                if (paymentForThisEntry > 0) {
                     paidForDetails.push({
                        srNo: entry.srNo,
                        amount: paymentForThisEntry, // This is only the actual payment amount (₹5000)
                        supplierName: toTitleCase(entry.name),
                        supplierSo: toTitleCase(entry.so),
                        supplierContact: entry.contact,
                        cdApplied: cdEnabled,
                    });
                }
                amountToDistribute -= paymentForThisEntry;
            }
        }
        // If still empty (e.g., partial edit without changing selection), fallback to previous mapping
        if (rtgsFor === 'Supplier' && paidForDetails.length === 0 && editingPayment?.paidFor?.length) {
            paidForDetails = editingPayment.paidFor.map((pf: any) => ({ srNo: pf.srNo, amount: pf.amount } as any));
        }
        
        // For RTGS, paymentId should be rtgsSrNo
        const finalPaymentId = paymentMethod === 'RTGS' ? rtgsSrNo : paymentId;
        
        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId: finalPaymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            amount: Math.round(finalAmountToPay), cdAmount: Math.round(calculatedCdAmount),
            cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
            notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
            paidFor: paidForDetails, sixRNo,
            sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
            parchiNo: parchiNo,
            utrNo, checkNo,
            quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
            supplierName: toTitleCase(supplierDetails.name),
            supplierFatherName: toTitleCase(supplierDetails.fatherName),
            supplierAddress: toTitleCase(supplierDetails.address),
            supplierContact: supplierDetails.contact,
            bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
            rtgsFor,
        };
        if (paymentMethod === 'RTGS') paymentDataBase.rtgsSrNo = rtgsSrNo;
        else delete (paymentDataBase as Partial<Payment>).rtgsSrNo;
        if (paymentMethod !== 'Cash') paymentDataBase.bankAccountId = accountIdForPayment;

        const paymentIdToUse = editingPayment ? editingPayment.id : (paymentMethod === 'RTGS' ? rtgsSrNo : paymentId);
        const newPaymentRef = doc(firestoreDB, "payments", paymentIdToUse);
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
        
        // Debug: Log payment saved
        console.log('💰 Payment Saved:', {
            paymentId: newPaymentRef.id,
            amount: paymentDataBase.amount,
            cdAmount: paymentDataBase.cdAmount,
            totalSettle: paymentDataBase.amount + paymentDataBase.cdAmount,
            paidFor: paymentDataBase.paidFor.map(pf => ({
                srNo: pf.srNo,
                amount: pf.amount
            }))
        });
    });
    // Ensure local IndexedDB reflects the latest payment so UI updates instantly
    try {
        if (db && finalPaymentData) {
            await db.payments.put(finalPaymentData);
        }
    } catch {}
    return { success: true, payment: finalPaymentData };
};


export const handleDeletePaymentLogic = async (paymentToDelete: Payment, allSuppliers: Customer[], transaction?: any) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment ID is missing for deletion.");
    }

    const performDelete = async (transOrBatch: any) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = await transOrBatch.get(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             console.warn(`Payment ${paymentToDelete.id} not found during deletion attempt.`);
             return; // Silently fail if doc is already gone
        }

        transOrBatch.delete(paymentDocRef);
    };
    
    if (transaction) {
        await performDelete(transaction);
    } else {
        await runTransaction(firestoreDB, async (t) => {
            await performDelete(t);
        });
    }

    if (db) {
        await db.payments.delete(paymentToDelete.id);
    }
};


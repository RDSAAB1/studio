
'use client';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit, updateDoc, getDoc, DocumentReference, WriteBatch } from 'firebase/firestore';
import { firestoreDB } from "@/lib/firebase";
import { toTitleCase, formatCurrency, generateReadableId } from "@/lib/utils";
import type { Customer, Payment, PaidFor, Expense, Income, RtgsSettings, BankAccount } from "@/lib/definitions";
import { format } from 'date-fns';
import { updateSupplierInLocalDB, deletePaymentFromLocalDB, db } from './database';

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
        rtgsFor, selectedCustomerKey, selectedEntries, editingPayment,
        rtgsAmount, paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, 
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, supplierDetails, bankDetails,
    } = context;

    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
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

    const totalToSettle = finalAmountToPay + calculatedCdAmount;

    if (finalAmountToPay <= 0 && calculatedCdAmount <= 0) {
        return { success: false, message: "Payment and CD amount cannot both be zero." };
    }

    let finalPaymentData: Payment | null = null;
    await runTransaction(firestoreDB, async (transaction) => {
        
        // --- Step 1 (inside transaction): Revert old payment if editing ---
        if (editingPayment?.id) {
            await handleDeletePaymentLogic(editingPayment, context.suppliers, transaction, true);
        }

        // --- Step 2 (inside transaction): Fetch current state for validation ---
        let totalOutstandingForSelected = 0;
        const supplierDocsToUpdate: { ref: DocumentReference, data: Customer }[] = [];

        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            for (const entryData of selectedEntries) {
                const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                const supplierDoc = await transaction.get(supplierRef);
                if (!supplierDoc.exists()) throw new Error(`Supplier entry ${entryData.srNo} not found.`);
                const supplierData = supplierDoc.data() as Customer;
                totalOutstandingForSelected += Number(supplierData.netAmount);
                supplierDocsToUpdate.push({ ref: supplierRef, data: supplierData });
            }
        }
        
        if (rtgsFor === 'Supplier' && paymentType === 'Partial' && totalToSettle > totalOutstandingForSelected + 0.01) { // Add tolerance
            throw new Error(`Partial payment plus CD (${formatCurrency(totalToSettle)}) cannot exceed the adjusted outstanding amount (${formatCurrency(totalOutstandingForSelected)}).`);
        }

        // --- Step 3 (inside transaction): Apply new payment logic ---
        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && supplierDocsToUpdate.length > 0) {
            let amountToDistribute = Math.round(finalAmountToPay);
            let cdToDistribute = Math.round(calculatedCdAmount);
            const sortedEntries = supplierDocsToUpdate.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

            for (const entry of sortedEntries) {
                if (amountToDistribute <= 0 && cdToDistribute <= 0) break;
                
                // CRITICAL FIX: Fetch the most current state of the document WITHIN the transaction
                const supplierDoc = await transaction.get(entry.ref);
                if (!supplierDoc.exists()) continue; // Should not happen, but a safeguard
                const currentSupplierData = supplierDoc.data() as Customer;
                const outstanding = Number(currentSupplierData.netAmount);

                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);
                const remainingOutstandingAfterPayment = outstanding - paymentForThisEntry;
                const cdForThisEntry = Math.min(remainingOutstandingAfterPayment, cdToDistribute);
                
                if (paymentForThisEntry > 0 || cdForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: currentSupplierData.srNo, 
                        amount: paymentForThisEntry,
                        cdApplied: cdEnabled,
                        supplierName: toTitleCase(currentSupplierData.name), 
                        supplierSo: toTitleCase(currentSupplierData.so),
                        supplierContact: currentSupplierData.contact,
                    });
                    const newNetAmount = outstanding - paymentForThisEntry - cdForThisEntry;
                    
                    if (newNetAmount < -0.01) { // Small tolerance for floating point issues
                         throw new Error(`Overpayment on SR# ${currentSupplierData.srNo}. Outstanding: ${formatCurrency(outstanding)}, Settlement: ${formatCurrency(paymentForThisEntry + cdForThisEntry)}.`);
                    }

                    transaction.update(entry.ref, { netAmount: newNetAmount < 0 ? 0 : newNetAmount });
                }
                amountToDistribute -= paymentForThisEntry;
                cdToDistribute -= cdForThisEntry;
            }
        }

        let expenseTransactionId = undefined;
        if (finalAmountToPay > 0) {
             const expenseData: Partial<Expense> = {
                date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                transactionType: 'Expense', category: 'Supplier Payments',
                subCategory: rtgsFor === 'Supplier' ? 'Supplier Payment' : 'Outsider Payment',
                amount: finalAmountToPay, payee: supplierDetails.name,
                description: `Payment for ${rtgsFor === 'Supplier' && selectedEntries.length > 0 ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
                paymentMethod: paymentMethod as 'Cash' | 'Online' | 'RTGS' | 'Cheque',
                status: 'Paid', isRecurring: false,
            };
            if (paymentMethod !== 'Cash') expenseData.bankAccountId = accountIdForPayment;
            
            const newExpenseRef = doc(collection(firestoreDB, "expenses"));
            transaction.set(newExpenseRef, { ...expenseData, id: newExpenseRef.id, transactionId: newExpenseRef.id });
            expenseTransactionId = newExpenseRef.id;
        }
        
        if (cdEnabled && calculatedCdAmount > 0) {
            const incomeTransactionRef = doc(incomesCollection);
            const incomeData: Partial<Income> = {
                id: incomeTransactionRef.id, 
                date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                transactionType: 'Income', category: 'Cash Discount Received',
                subCategory: 'Supplier CD', amount: calculatedCdAmount, payee: supplierDetails.name,
                description: `CD received for ${rtgsFor === 'Supplier' && selectedEntries.length > 0 ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
                paymentMethod: 'Other', status: 'Paid', isRecurring: false,
            };
            transaction.set(incomeTransactionRef, incomeData);
        }

        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            amount: Math.round(finalAmountToPay), cdAmount: Math.round(calculatedCdAmount),
            cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
            notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
            paidFor: rtgsFor === 'Supplier' ? paidForDetails : [], sixRNo,
            sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '', parchiNo, utrNo, checkNo,
            quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
            supplierName: toTitleCase(supplierDetails.name),
            supplierFatherName: toTitleCase(supplierDetails.fatherName),
            supplierAddress: toTitleCase(supplierDetails.address),
            bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
            rtgsFor, expenseTransactionId: expenseTransactionId,
        };
        if (paymentMethod === 'RTGS') paymentDataBase.rtgsSrNo = rtgsSrNo;
        else delete (paymentDataBase as Partial<Payment>).rtgsSrNo;
        if (paymentMethod !== 'Cash') paymentDataBase.bankAccountId = accountIdForPayment;

        const paymentIdToUse = editingPayment ? editingPayment.id : (paymentMethod === 'RTGS' ? rtgsSrNo : paymentId);
        const newPaymentRef = doc(firestoreDB, "payments", paymentIdToUse);
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
    });
    return { success: true, payment: finalPaymentData };
};


export const handleDeletePaymentLogic = async (paymentToDelete: Payment, allSuppliers: Customer[], transaction?: any, isEditing: boolean = false) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment ID is missing for deletion.");
    }

    const performDelete = async (transOrBatch: any) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = isEditing ? await transOrBatch.get(paymentDocRef) : await getDoc(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             console.warn(`Payment ${paymentToDelete.id} not found during deletion attempt.`);
             return;
        }

        const paymentData = paymentDoc.data() as Payment;

        if (paymentData.rtgsFor === 'Supplier' && paymentData.paidFor) {
            for (const detail of paymentData.paidFor) {
                const supplierToUpdate = allSuppliers.find(s => s.srNo === detail.srNo);

                if (supplierToUpdate) {
                    const supplierRef = doc(firestoreDB, "suppliers", supplierToUpdate.id);
                    const supplierDoc = isEditing ? await transOrBatch.get(supplierRef) : await getDoc(supplierRef);
                    
                    if (supplierDoc.exists()) {
                        const currentSupplier = supplierDoc.data() as Customer;
                        let amountToRestore = detail.amount;
                        if (paymentData.cdApplied && paymentData.cdAmount && paymentData.paidFor.length > 0) {
                            const totalPaidInTx = paymentData.paidFor.reduce((s: number, pf: any) => s + pf.amount, 0);
                            if (totalPaidInTx > 0) {
                                const proportion = detail.amount / totalPaidInTx;
                                amountToRestore += paymentData.cdAmount * proportion;
                            }
                        }
                        const newNetAmount = (Number(currentSupplier.netAmount) || 0) + amountToRestore;
                        
                        let finalNetAmount = Math.round(newNetAmount);
                        if (finalNetAmount > currentSupplier.originalNetAmount) {
                            console.warn(`Restored net amount for ${currentSupplier.srNo} exceeded original. Capping it.`);
                            finalNetAmount = currentSupplier.originalNetAmount;
                        }
                        
                        transOrBatch.update(supplierRef, { netAmount: finalNetAmount });
                        if (db && !isEditing) await updateSupplierInLocalDB(supplierDoc.id, { netAmount: finalNetAmount });
                    }
                }
            }
        }
        
        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            transOrBatch.delete(expenseDocRef);
        }
      
        if (!isEditing) {
            transOrBatch.delete(paymentDocRef);
            if (db) await deletePaymentFromLocalDB(paymentToDelete.id);
        }
    };
    
    if (transaction) { // If called from within an existing transaction
        await performDelete(transaction);
    } else { // If called as a standalone operation
        await runTransaction(firestoreDB, async (t) => {
            await performDelete(t);
        });
    }
};

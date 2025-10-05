
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
        rtgsFor, selectedCustomerKey, selectedEntries, editingPayment,
        paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, settleAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, rtgsAmount, supplierDetails, bankDetails,
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
    
    // VALIDATION: Check if settlement amount exceeds total outstanding
    if (settleAmount > totalOutstandingForSelected + 0.01) { // Add a small tolerance for floating point issues
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
                const oldPaymentData = oldPaymentDoc.data() as Payment;
                if (oldPaymentData.expenseTransactionId) {
                    const oldExpenseRef = doc(firestoreDB, "expenses", oldPaymentData.expenseTransactionId);
                    transaction.delete(oldExpenseRef);
                }
                transaction.delete(oldPaymentRef);
            }
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            let amountToDistribute = Math.round(totalToSettle); // Distribute based on total settlement amount

            for (const entry of selectedEntries) {
                if (amountToDistribute <= 0) break;
                
                const outstanding = Number(entry.netAmount) + (editingPayment?.paidFor?.find((pf:any) => pf.srNo === entry.srNo)?.amount || 0);
                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                if (paymentForThisEntry > 0) {
                     paidForDetails.push({
                        srNo: entry.srNo,
                        amount: paymentForThisEntry,
                        supplierName: toTitleCase(entry.name),
                        supplierSo: toTitleCase(entry.so),
                        supplierContact: entry.contact,
                        cdApplied: cdEnabled,
                    });
                }
                amountToDistribute -= paymentForThisEntry;
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

        const paymentData = paymentDoc.data() as Payment;
        
        // This part is no longer needed because the balance is calculated dynamically.
        // We just need to delete the payment and its associated expense.

        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            transOrBatch.delete(expenseDocRef);
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

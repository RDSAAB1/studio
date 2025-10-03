
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
    
    if (rtgsFor === 'Supplier' && (!selectedEntries || selectedEntries.length === 0) && !editingPayment) {
        if (paymentMethod !== 'RTGS') {
            return { success: false, message: "Please select entries to pay" };
        } else if (rtgsAmount <= 0) {
             return { success: false, message: "Please enter an amount for RTGS payment" };
        }
    }


    const finalPaymentAmount = rtgsAmount || paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    
    if (paymentMethod === 'RTGS' && !accountIdForPayment) {
        return { success: false, message: "Please select an account to pay from for RTGS." };
    }


    const availableBalance = financialState.balances.get(accountIdForPayment) || 0;
    
    const totalOutstandingForSelected = selectedEntries?.reduce((sum: number, entry: Customer) => sum + Number(entry.netAmount), 0) || 0;


    if (finalPaymentAmount > availableBalance && !editingPayment) { // Check balance only for new payments
        const accountName = bankAccounts.find((acc: any) => acc.id === accountIdForPayment)?.accountHolderName || 'Cash in Hand';
        return { success: false, message: `Payment of ${formatCurrency(finalPaymentAmount)} exceeds available balance of ${formatCurrency(availableBalance)} in ${accountName}.` };
    }

    const totalPaidAmount = finalPaymentAmount + calculatedCdAmount;
    if (totalPaidAmount <= 0) {
        return { success: false, message: "Payment amount must be positive" };
    }
    if (rtgsFor === 'Supplier' && paymentType === 'Partial' && !editingPayment && totalPaidAmount > totalOutstandingForSelected) {
        return { success: false, message: "Partial payment cannot exceed outstanding" };
    }

    let finalPaymentData: Payment | null = null;
    await runTransaction(firestoreDB, async (transaction) => {
        
        const supplierDocsToUpdate: { ref: DocumentReference, data: Customer }[] = [];
        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            for (const entryData of selectedEntries) {
                const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                const supplierDoc = await transaction.get(supplierRef);
                if (!supplierDoc.exists()) throw new Error(`Supplier entry ${entryData.srNo} not found.`);
                supplierDocsToUpdate.push({ ref: supplierRef, data: supplierDoc.data() as Customer });
            }
        }
        
        // When updating, we delete the old payment logic which is handled in handleEditPayment via handleDeletePaymentLogic.
        // The processPaymentLogic now only handles creation.
        // We just need to make sure we use the correct ID.
        if (editingPayment?.id) {
            const oldPaymentRef = doc(firestoreDB, "payments", editingPayment.id);
            const oldPaymentDoc = await transaction.get(oldPaymentRef);
            if (oldPaymentDoc.exists()) {
                // The actual deletion happens in handleEditPayment, we just check existence here if needed
                // For a pure 'create' logic, this block might be removed or adjusted.
            }
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && supplierDocsToUpdate.length > 0) {
            let amountToDistribute = Math.round(totalPaidAmount);
            const sortedEntries = supplierDocsToUpdate.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

            for (const entryData of sortedEntries) {
                if (amountToDistribute <= 0) break;
                
                const supplierToUpdate = entryData;
                if (!supplierToUpdate) continue; 

                const currentSupplierData = supplierToUpdate.data;
                const outstanding = Number(currentSupplierData.netAmount);

                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                if (paymentForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: entryData.data.srNo, amount: paymentForThisEntry, cdApplied: cdEnabled,
                        supplierName: toTitleCase(entryData.data.name), supplierSo: toTitleCase(entryData.data.so),
                        supplierContact: entryData.data.contact,
                    });
                    const newNetAmount = outstanding - paymentForThisEntry;
                    transaction.update(supplierToUpdate.ref, { netAmount: newNetAmount });
                }
                amountToDistribute -= paymentForThisEntry;
            }
        }

        const expenseTransactionRef = doc(expensesCollection);
        const expenseData: Partial<Expense> = {
            id: expenseTransactionRef.id, 
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            transactionType: 'Expense', category: 'Supplier Payments',
            subCategory: rtgsFor === 'Supplier' ? 'Supplier Payment' : 'Outsider Payment',
            amount: finalPaymentAmount, payee: supplierDetails.name,
            description: `Payment for ${rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0 ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
            paymentMethod: paymentMethod as 'Cash' | 'Online' | 'RTGS' | 'Cheque',
            status: 'Paid', isRecurring: false,
        };
        if (paymentMethod !== 'Cash') expenseData.bankAccountId = accountIdForPayment;
        transaction.set(expenseTransactionRef, expenseData);

        if (cdEnabled && calculatedCdAmount > 0) {
            const incomeTransactionRef = doc(incomesCollection);
            const incomeData: Partial<Income> = {
                id: incomeTransactionRef.id, 
                date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                transactionType: 'Income', category: 'Cash Discount Received',
                subCategory: 'Supplier CD', amount: calculatedCdAmount, payee: supplierDetails.name,
                description: `CD received for ${rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0 ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
                paymentMethod: 'Other', status: 'Paid', isRecurring: false,
            };
            transaction.set(incomeTransactionRef, incomeData);
        }

        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            amount: Math.round(finalPaymentAmount), cdAmount: Math.round(calculatedCdAmount),
            cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod,
            notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
            paidFor: rtgsFor === 'Supplier' ? paidForDetails : [], sixRNo,
            sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '', parchiNo, utrNo, checkNo,
            quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
            supplierName: toTitleCase(supplierDetails.name),
            supplierFatherName: toTitleCase(supplierDetails.fatherName),
            supplierAddress: toTitleCase(supplierDetails.address),
            bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
            rtgsFor, expenseTransactionId: expenseTransactionRef.id,
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


export const handleDeletePaymentLogic = async (paymentToDelete: Payment, paymentHistory: Payment[], isEditing: boolean = false) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment ID is missing for deletion.");
    }

    await runTransaction(firestoreDB, async (transaction) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = await transaction.get(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             console.warn(`Payment ${paymentToDelete.id} not found during deletion.`);
             return;
        }

        const paymentData = paymentDoc.data() as Payment;

        if (paymentData.rtgsFor === 'Supplier' && paymentData.paidFor) {
            for (const detail of paymentData.paidFor) {
                const q = query(suppliersCollection, where('srNo', '==', detail.srNo), limit(1));
                const supplierDocsSnapshot = await getDocs(q); 
                
                if (!supplierDocsSnapshot.empty) {
                    const customerDoc = supplierDocsSnapshot.docs[0];
                    const currentSupplier = customerDoc.data() as Customer;
                    const amountToRestore = detail.amount + (paymentData.cdApplied && paymentData.cdAmount ? paymentData.cdAmount / paymentData.paidFor.length : 0);
                    const newNetAmount = (currentSupplier.netAmount as number) + amountToRestore;
                    
                    transaction.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                    if (db) await updateSupplierInLocalDB(customerDoc.id, { netAmount: Math.round(newNetAmount) });
                }
            }
        }
        
        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            transaction.delete(expenseDocRef);
        }
      
      if (!isEditing) {
        transaction.delete(paymentDocRef);
      }
    });
  
    if (db && !isEditing) {
      await deletePaymentFromLocalDB(paymentToDelete.id);
    }
  };



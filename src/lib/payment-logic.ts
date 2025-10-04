
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
        let oldPaymentData: Payment | null = null;
        if (editingPayment?.id) {
            const oldPaymentRef = doc(firestoreDB, "payments", editingPayment.id);
            const oldPaymentDoc = await transaction.get(oldPaymentRef);
            if (oldPaymentDoc.exists()) {
                oldPaymentData = oldPaymentDoc.data() as Payment;
            }
        }
        
        let totalOutstandingForSelected = 0;
        const supplierDocsToUpdate: { ref: DocumentReference, data: Customer }[] = [];

        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            for (const entryData of selectedEntries) {
                const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                const supplierDoc = await transaction.get(supplierRef);
                if (!supplierDoc.exists()) throw new Error(`Supplier entry ${entryData.srNo} not found.`);
                const supplierData = supplierDoc.data() as Customer;
                
                let currentOutstanding = Number(supplierData.netAmount);

                // If editing, temporarily add back the old paid amount for this specific entry
                if (oldPaymentData && oldPaymentData.paidFor) {
                    const oldPaidDetail = oldPaymentData.paidFor.find(pf => pf.srNo === supplierData.srNo);
                    if (oldPaidDetail) {
                        let amountToRestore = oldPaidDetail.amount;
                        if (oldPaymentData.cdApplied && oldPaymentData.cdAmount && oldPaymentData.paidFor.length > 0) {
                            const totalPaidInTx = oldPaymentData.paidFor.reduce((s, pf) => s + pf.amount, 0);
                            if (totalPaidInTx > 0) {
                                const proportion = oldPaidDetail.amount / totalPaidInTx;
                                amountToRestore += oldPaymentData.cdAmount * proportion;
                            }
                        }
                        currentOutstanding += amountToRestore;
                    }
                }
                
                totalOutstandingForSelected += currentOutstanding;
                supplierDocsToUpdate.push({ ref: supplierRef, data: { ...supplierData, netAmount: currentOutstanding } });
            }
        }
        
        if (rtgsFor === 'Supplier' && paymentType === 'Partial' && totalToSettle > totalOutstandingForSelected + 0.01) { // Add tolerance
            throw new Error(`Partial payment plus CD (${formatCurrency(totalToSettle)}) cannot exceed the adjusted outstanding amount (${formatCurrency(totalOutstandingForSelected)}).`);
        }

        // --- Step 1 (inside transaction): Revert old payment if editing ---
        if (oldPaymentData) {
            // Revert supplier balances
            if (oldPaymentData.paidFor) {
                for (const detail of oldPaymentData.paidFor) {
                    const supplierToUpdate = supplierDocsToUpdate.find(s => s.data.srNo === detail.srNo);
                    if (supplierToUpdate) {
                         let amountToRestore = detail.amount;
                         if (oldPaymentData.cdApplied && oldPaymentData.cdAmount && oldPaymentData.paidFor.length > 0) {
                            const totalPaidInTx = oldPaymentData.paidFor.reduce((s, pf) => s + pf.amount, 0);
                            if(totalPaidInTx > 0) {
                                const proportion = detail.amount / totalPaidInTx;
                                amountToRestore += oldPaymentData.cdAmount * proportion;
                            }
                        }
                        const newNetAmount = Number(supplierToUpdate.data.netAmount) + amountToRestore;
                        transaction.update(supplierToUpdate.ref, { netAmount: Math.round(newNetAmount) });
                        // Update the local copy for subsequent calculations
                        supplierToUpdate.data.netAmount = Math.round(newNetAmount); 
                    }
                }
            }
            // Delete old expense record
            if (oldPaymentData.expenseTransactionId) {
                const expenseRef = doc(firestoreDB, "expenses", oldPaymentData.expenseTransactionId);
                transaction.delete(expenseRef);
            }
        }

        // --- Step 2 (inside transaction): Apply new payment logic ---
        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && supplierDocsToUpdate.length > 0) {
            let amountToDistribute = Math.round(finalAmountToPay);
            let cdToDistribute = Math.round(calculatedCdAmount);
            const sortedEntries = supplierDocsToUpdate.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

            for (const entryData of sortedEntries) {
                if (amountToDistribute <= 0 && cdToDistribute <= 0) break;
                
                const currentSupplierData = entryData.data;
                const outstanding = Number(currentSupplierData.netAmount);

                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);
                const remainingOutstandingAfterPayment = outstanding - paymentForThisEntry;
                const cdForThisEntry = Math.min(remainingOutstandingAfterPayment, cdToDistribute);
                
                if (paymentForThisEntry > 0 || cdForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: entryData.data.srNo, 
                        amount: paymentForThisEntry,
                        cdApplied: cdEnabled,
                        supplierName: toTitleCase(entryData.data.name), 
                        supplierSo: toTitleCase(entryData.data.so),
                        supplierContact: entryData.data.contact,
                    });
                    const newNetAmount = outstanding - paymentForThisEntry - cdForThisEntry;
                    
                    if (newNetAmount < -0.01) {
                         throw new Error(`Overpayment on SR# ${entryData.data.srNo}. Outstanding: ${formatCurrency(outstanding)}, Settlement: ${formatCurrency(paymentForThisEntry + cdForThisEntry)}.`);
                    }

                    transaction.update(entryData.ref, { netAmount: newNetAmount < 0 ? 0 : newNetAmount });
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


export const handleDeletePaymentLogic = async (paymentToDelete: Payment, isEditing: boolean = false) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment ID is missing for deletion.");
    }

    await runTransaction(firestoreDB, async (transaction) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = await transaction.get(paymentDocRef);
        
        if (!paymentDoc.exists()) {
             console.warn(`Payment ${paymentToDelete.id} not found during deletion attempt.`);
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
                    
                    let amountToRestore = detail.amount;
                     if (paymentData.cdApplied && paymentData.cdAmount && paymentData.paidFor.length > 0) {
                        const totalPaidInTx = paymentData.paidFor.reduce((s, pf) => s + pf.amount, 0);
                        if(totalPaidInTx > 0) {
                            const proportion = detail.amount / totalPaidInTx;
                            amountToRestore += paymentData.cdAmount * proportion;
                        }
                    }

                    let newNetAmount = (currentSupplier.netAmount as number) + amountToRestore;
                    
                    if (newNetAmount > currentSupplier.originalNetAmount) {
                        console.warn(`Restored net amount for ${currentSupplier.srNo} exceeded original. Capping it.`);
                        newNetAmount = currentSupplier.originalNetAmount;
                    }

                    transaction.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                    if (db) await updateSupplierInLocalDB(customerDoc.id, { netAmount: Math.round(newNetAmount) });
                }
            }
        }
        
        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            const expenseDoc = await transaction.get(expenseDocRef);
            if (expenseDoc.exists()) {
                 transaction.delete(expenseDocRef);
            }
        }
      
      if (!isEditing) {
        transaction.delete(paymentDocRef);
      }
    });
  
    if (db && !isEditing) {
      await deletePaymentFromLocalDB(paymentToDelete.id);
    }
};

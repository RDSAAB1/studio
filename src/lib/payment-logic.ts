
'use client';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit, updateDoc, getDoc, DocumentReference } from 'firebase/firestore';
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
        rtgsFor, selectedCustomerKey, selectedEntryIds, editingPayment,
        rtgsAmount, paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, supplierDetails, bankDetails,
        selectedEntries, handleDeletePayment, paymentHistory
    } = context;

    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
    }
    if (rtgsFor === 'Supplier' && selectedEntryIds.size === 0 && !editingPayment) {
        return { success: false, message: "Please select entries to pay" };
    }

    const finalPaymentAmount = rtgsAmount || paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    
    if (paymentMethod === 'RTGS' && !accountIdForPayment) {
        return { success: false, message: "Please select an account to pay from for RTGS." };
    }


    const availableBalance = financialState.balances.get(accountIdForPayment) || 0;

    if (finalPaymentAmount > availableBalance) {
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
        
        // --- READ PHASE ---
        const supplierDocsToUpdate: { ref: DocumentReference, data: Customer }[] = [];
        if (rtgsFor === 'Supplier') {
            for (const entryData of selectedEntries) {
                const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                const supplierDoc = await transaction.get(supplierRef);
                if (!supplierDoc.exists()) throw new Error(`Supplier entry ${entryData.srNo} not found.`);
                supplierDocsToUpdate.push({ ref: supplierRef, data: supplierDoc.data() as Customer });
            }
        }
        
        let oldPaymentDoc = null;
        if(editingPayment?.id) {
            const oldPaymentRef = doc(firestoreDB, "payments", editingPayment.id);
            oldPaymentDoc = await transaction.get(oldPaymentRef);
            if (!oldPaymentDoc.exists()) {
                throw new Error("The payment you are trying to edit does not exist anymore.");
            }
        }

        // --- WRITE PHASE ---
        if (editingPayment?.id && oldPaymentDoc?.exists()) {
            await handleDeletePaymentLogic(oldPaymentDoc.data() as Payment, transaction);
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier') {
            let amountToDistribute = Math.round(totalPaidAmount);
            const sortedEntries = selectedEntries.sort((a: Customer, b: Customer) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const entryData of sortedEntries) {
                if (amountToDistribute <= 0) break;
                
                const supplierToUpdate = supplierDocsToUpdate.find(s => s.ref.id === entryData.id);
                if (!supplierToUpdate) continue; // Should not happen if reads were successful

                const currentSupplierData = supplierToUpdate.data;
                const outstanding = Number(currentSupplierData.netAmount);

                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                if (paymentForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: entryData.srNo, amount: paymentForThisEntry, cdApplied: cdEnabled,
                        supplierName: toTitleCase(entryData.name), supplierSo: toTitleCase(entryData.so),
                        supplierContact: entryData.contact,
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
            description: `Payment for ${rtgsFor === 'Supplier' ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
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
                description: `CD received for ${rtgsFor === 'Supplier' ? 'SR# ' + selectedEntries.map((e: Customer) => e.srNo).join(', ') : 'RTGS ' + rtgsSrNo}`,
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

        const paymentIdToUse = editingPayment ? editingPayment.id : paymentDataBase.paymentId;
        const newPaymentRef = doc(firestoreDB, "payments", paymentIdToUse);
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
    });
    return { success: true, payment: finalPaymentData };
};

export const handleEditPaymentLogic = async (paymentToEdit: Payment, context: any) => {
    const {
        setEditingPayment, setPaymentId, setRtgsSrNo,
        setPaymentAmount, setPaymentType, setPaymentMethod, setSelectedAccountId,
        setCdEnabled, setRtgsFor, setUtrNo, setCheckNo,
        setSixRNo, setSixRDate, setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
        setSupplierDetails, setBankDetails, setSelectedCustomerKey, setSelectedEntryIds,
        suppliers, setPaymentDate
    } = context;

    if (!paymentToEdit.id) throw new Error("Payment ID is missing.");
    
    setEditingPayment(paymentToEdit);
    setPaymentId(paymentToEdit.paymentId);
    setRtgsSrNo(paymentToEdit.rtgsSrNo || '');
    setPaymentAmount(paymentToEdit.amount);
    setPaymentType(paymentToEdit.type);
    setPaymentMethod(paymentToEdit.receiptType);
    setSelectedAccountId(paymentToEdit.bankAccountId || 'CashInHand');
    setCdEnabled(!!paymentToEdit.cdApplied);
    setRtgsFor(paymentToEdit.rtgsFor || 'Supplier');
    setUtrNo(paymentToEdit.utrNo || '');
    setCheckNo(paymentToEdit.checkNo || '');
    setSixRNo(paymentToEdit.sixRNo || '');
    if (paymentToEdit.sixRDate) {
        const sixRDateObj = new Date(paymentToEdit.sixRDate + "T00:00:00");
        setSixRDate(sixRDateObj);
    } else {
        setSixRDate(undefined);
    }
    setParchiNo(paymentToEdit.parchiNo || (paymentToEdit.paidFor || []).map(pf => pf.srNo).join(', '));
    setRtgsQuantity(paymentToEdit.quantity || 0);
    setRtgsRate(paymentToEdit.rate || 0);
    setRtgsAmount(paymentToEdit.rtgsAmount || 0);
    setSupplierDetails({
        name: paymentToEdit.supplierName || '', fatherName: paymentToEdit.supplierFatherName || '',
        address: paymentToEdit.supplierAddress || '', contact: ''
    });
    setBankDetails({
        acNo: paymentToEdit.bankAcNo || '', ifscCode: paymentToEdit.bankIfsc || '',
        bank: paymentToEdit.bankName || '', branch: paymentToEdit.bankBranch || '',
    });
    
    if (paymentToEdit.date) {
        const dateParts = paymentToEdit.date.split('-').map(Number);
        const utcDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        setPaymentDate(utcDate);
    }

    if (paymentToEdit.rtgsFor === 'Supplier') {
        setSelectedCustomerKey(paymentToEdit.customerId);
        const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
        if (srNosInPayment.length > 0) {
            const selectedSupplierEntries = suppliers.filter((s: Customer) => srNosInPayment.includes(s.srNo));
            if (selectedSupplierEntries.length !== srNosInPayment.length) {
                 throw new Error("One or more original entries for this payment are missing from local data.");
            }
            setSelectedEntryIds(new Set(selectedSupplierEntries.map((s: Customer) => s.id)));
        } else {
            setSelectedEntryIds(new Set());
        }
    } else {
        setSelectedCustomerKey(null);
        setSelectedEntryIds(new Set());
    }
};

export const handleDeletePaymentLogic = async (paymentToDelete: Payment, transaction?: any) => {
    
    const runDelete = async (tx: any) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        const paymentDoc = await tx.get(paymentDocRef);
        
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
                    tx.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                    if (db) {
                         await updateSupplierInLocalDB(customerDoc.id, { netAmount: Math.round(newNetAmount) });
                    }
                }
            }
        }
        
        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            tx.delete(expenseDocRef);
        }

        tx.delete(paymentDocRef);
    };

    if (transaction) {
        await runDelete(transaction);
    } else {
        await runTransaction(firestoreDB, runDelete);
    }
    
     if (db) {
        await deletePaymentFromLocalDB(paymentToDelete.id);
    }
};

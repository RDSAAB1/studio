
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
        rtgsFor, selectedCustomerKey, selectedEntryIds, editingPayment,
        rtgsAmount, paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, 
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, supplierDetails, bankDetails,
        selectedEntries
    } = context;

    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        return { success: false, message: "No supplier selected" };
    }
    // Allow processing for RTGS to outsider even without selected entries
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
    
    const totalOutstandingForSelected = selectedEntries.reduce((sum: number, entry: Customer) => sum + Number(entry.netAmount), 0);

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
        
        // --- READ PHASE ---
        const supplierDocsToUpdate: { ref: DocumentReference, data: Customer }[] = [];
        if (rtgsFor === 'Supplier' && selectedEntries && selectedEntries.length > 0) {
            for (const entryData of selectedEntries) {
                const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                const supplierDoc = await transaction.get(supplierRef);
                if (!supplierDoc.exists()) throw new Error(`Supplier entry ${entryData.srNo} not found.`);
                supplierDocsToUpdate.push({ ref: supplierRef, data: supplierDoc.data() as Customer });
            }
        }
        
        // --- WRITE PHASE ---
        if (editingPayment?.id) {
            await handleDeletePaymentLogic(editingPayment, transaction);
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier' && supplierDocsToUpdate.length > 0) {
            let amountToDistribute = Math.round(totalPaidAmount);
            const sortedEntries = supplierDocsToUpdate.sort((a, b) => new Date(a.data.date).getTime() - new Date(b.data.date).getTime());

            for (const entryData of sortedEntries) {
                if (amountToDistribute <= 0) break;
                
                const supplierToUpdate = entryData;
                if (!supplierToUpdate) continue; // Should not happen

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

export const handleEditPaymentLogic = async (paymentToEdit: Payment, context: any, onCustomerSelect: (key: string) => void) => {
    const {
        setEditingPayment, setPaymentId, setRtgsSrNo,
        setPaymentAmount, setPaymentType, setPaymentMethod, setSelectedAccountId,
        setCdEnabled, setCdAt, setCdPercent,
        setRtgsFor, setUtrNo, setCheckNo,
        setSixRNo, setSixRDate, setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
        setSupplierDetails, setBankDetails, setSelectedEntryIds,
        suppliers, setPaymentDate, customerSummaryMap
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
    if (paymentToEdit.cdApplied && paymentToEdit.cdAmount && paymentToEdit.amount) {
        const baseForCd = paymentToEdit.type === 'Full' 
            ? (paymentToEdit.paidFor || []).reduce((sum, pf) => sum + (suppliers.find((s: Customer) => s.srNo === pf.srNo)?.originalNetAmount || 0), 0)
            : paymentToEdit.amount;
        if (baseForCd > 0) {
            setCdPercent(Number(((paymentToEdit.cdAmount / baseForCd) * 100).toFixed(2)));
        }
        setCdAt(paymentToEdit.type === 'Full' ? 'on_full_amount' : 'partial_on_paid');
    }

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
        address: paymentToEdit.supplierAddress || '', contact: '' // Contact will be fetched from supplier entry
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
        const firstSrNo = paymentToEdit.paidFor?.[0]?.srNo;
        if (!firstSrNo) {
            // Fallback for older data or outsider payments mistakenly marked as supplier
            const customerProfileKey = Array.from(customerSummaryMap.keys()).find(key => {
                const summary = customerSummaryMap.get(key);
                return toTitleCase(summary?.name || '') === toTitleCase(paymentToEdit.supplierName || '') && toTitleCase(summary?.so || '') === toTitleCase(paymentToEdit.supplierFatherName || '');
            });
            if (customerProfileKey) onCustomerSelect(customerProfileKey);
            else console.warn("Could not find matching customer profile for this payment based on name.");
            return;
        }

        const originalEntry = suppliers.find((s: Customer) => s.srNo === firstSrNo);
        if (!originalEntry) {
            throw new Error(`Original supplier entry for SR# ${firstSrNo} not found.`);
        }
        
        const originalEntryName = toTitleCase(originalEntry.name || '');
        const originalEntrySO = toTitleCase(originalEntry.so || '');

        const customerProfileKey = Array.from(customerSummaryMap.keys()).find(key => {
            const summary = customerSummaryMap.get(key);
            return toTitleCase(summary?.name || '') === originalEntryName && toTitleCase(summary?.so || '') === originalEntrySO;
        });

        if (customerProfileKey) {
            onCustomerSelect(customerProfileKey);
        } else {
            console.warn(`Could not find customer profile for ${originalEntryName} S/O ${originalEntrySO}.`);
        }
        
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
    } else { // Outsider payment
        onCustomerSelect(null);
        setSelectedEntryIds(new Set());
    }
};

export const handleDeletePaymentLogic = async (paymentToDelete: Payment, transaction: any) => {
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment object or ID is missing for deletion.");
    }

    const runDelete = async (tx: any) => {
        const paymentDocRef = doc(firestoreDB, "payments", paymentToDelete.id);
        
        let paymentDoc;
        if(transaction) { // If called from within another transaction
             paymentDoc = await tx.get(paymentDocRef);
        } else { // If called directly
             paymentDoc = await getDoc(paymentDocRef);
        }
        
        if (!paymentDoc.exists()) {
            console.warn(`Payment ${paymentToDelete.id} not found during deletion.`);
            return;
        }

        const paymentData = paymentDoc.data() as Payment;

        if (paymentData.rtgsFor === 'Supplier' && paymentData.paidFor) {
            for (const detail of paymentData.paidFor) {
                const q = query(suppliersCollection, where('srNo', '==', detail.srNo), limit(1));
                
                let supplierDocsSnapshot;
                 if(transaction) {
                    // Firestore transactions don't support getDocs. We have to do this read outside.
                    // This is a limitation. For now, we will perform a non-transactional get.
                    // This might lead to issues in high-concurrency scenarios.
                     supplierDocsSnapshot = await getDocs(q);
                 } else {
                     supplierDocsSnapshot = await getDocs(q);
                 }
                
                if (!supplierDocsSnapshot.empty) {
                    const customerDoc = supplierDocsSnapshot.docs[0];
                    const currentSupplier = customerDoc.data() as Customer;
                    const amountToRestore = detail.amount + (paymentData.cdApplied && paymentData.cdAmount ? paymentData.cdAmount / paymentData.paidFor.length : 0);
                    const newNetAmount = (currentSupplier.netAmount as number) + amountToRestore;
                    
                    if(transaction) {
                         tx.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                    } else {
                        await updateDoc(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                    }
                    if (db) {
                         await updateSupplierInLocalDB(customerDoc.id, { netAmount: Math.round(newNetAmount) });
                    }
                }
            }
        }
        
        if (paymentData.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentData.expenseTransactionId);
            if(transaction) {
                 tx.delete(expenseDocRef);
            } else {
                 await deleteDoc(expenseDocRef);
            }
        }
        
        if(transaction) {
             tx.delete(paymentDocRef);
        } else {
             await deleteDoc(paymentDocRef);
        }
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

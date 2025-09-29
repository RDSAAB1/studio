
'use server';

import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit } from 'firebase/firestore';
import { firestoreDB } from "@/lib/firebase";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import type { Customer, Payment, PaidFor, Expense, Income } from "@/lib/definitions";
import { format } from 'date-fns';

const suppliersCollection = collection(firestoreDB, "suppliers");
const expensesCollection = collection(firestoreDB, "expenses");
const incomesCollection = collection(firestoreDB, "incomes");
const paymentsCollection = collection(firestoreDB, "payments");

export const processPaymentLogic = async (context: any): Promise<Payment | null> => {
    const {
        rtgsFor, selectedCustomerKey, selectedEntryIds, editingPayment,
        rtgsAmount, paymentAmount, paymentMethod, selectedAccountId,
        cdEnabled, calculatedCdAmount, totalOutstandingForSelected,
        paymentType, financialState, bankAccounts, paymentId, rtgsSrNo,
        paymentDate, utrNo, checkNo, sixRNo, sixRDate, parchiNo,
        rtgsQuantity, rtgsRate, supplierDetails, bankDetails,
        selectedEntries
    } = context;

    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        throw new Error("No supplier selected");
    }
    if (rtgsFor === 'Supplier' && selectedEntryIds.size === 0 && !editingPayment) {
        throw new Error("Please select entries to pay");
    }

    const finalPaymentAmount = rtgsAmount || paymentAmount;
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    const availableBalance = financialState.balances.get(accountIdForPayment) || 0;

    if (finalPaymentAmount > availableBalance) {
        const accountName = bankAccounts.find((acc: any) => acc.id === accountIdForPayment)?.accountHolderName || 'Cash in Hand';
        throw new Error(`Payment of ${formatCurrency(finalPaymentAmount)} exceeds available balance of ${formatCurrency(availableBalance)} in ${accountName}.`);
    }

    const totalPaidAmount = finalPaymentAmount + calculatedCdAmount;
    if (totalPaidAmount <= 0) {
        throw new Error("Payment amount must be positive");
    }
    if (rtgsFor === 'Supplier' && paymentType === 'Partial' && !editingPayment && totalPaidAmount > totalOutstandingForSelected) {
        throw new Error("Partial payment cannot exceed outstanding");
    }

    let finalPaymentData: Payment | null = null;
    await runTransaction(firestoreDB, async (transaction) => {
        const supplierDocsToGet = new Set<string>();
        if (rtgsFor === 'Supplier') {
            selectedEntryIds.forEach((id: string) => supplierDocsToGet.add(id));
        }

        const supplierDocs = new Map<string, any>();
        for (const id of supplierDocsToGet) {
            const docRef = doc(firestoreDB, "suppliers", id);
            const supplierDoc = await transaction.get(docRef);
            if (supplierDoc.exists()) {
                supplierDocs.set(id, supplierDoc.data());
            } else {
                throw new Error(`Supplier with ID ${id} not found.`);
            }
        }

        let paidForDetails: PaidFor[] = [];
        if (rtgsFor === 'Supplier') {
            let amountToDistribute = Math.round(totalPaidAmount);
            const sortedEntries = selectedEntries.sort((a: Customer, b: Customer) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const entryData of sortedEntries) {
                if (amountToDistribute <= 0) break;
                const supplierData = supplierDocs.get(entryData.id);
                let outstanding = Number(supplierData.netAmount);
                const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                if (paymentForThisEntry > 0) {
                    paidForDetails.push({
                        srNo: entryData.srNo, amount: paymentForThisEntry, cdApplied: cdEnabled,
                        supplierName: toTitleCase(entryData.name), supplierSo: toTitleCase(entryData.so),
                        supplierContact: entryData.contact,
                    });
                    const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                    transaction.update(supplierRef, { netAmount: outstanding - paymentForThisEntry });
                    amountToDistribute -= paymentForThisEntry;
                }
            }
        }

        const expenseTransactionRef = doc(expensesCollection);
        const expenseData: Partial<Expense> = {
            id: expenseTransactionRef.id, date: new Date().toISOString().split('T')[0],
            transactionType: 'Expense', category: 'Supplier Payments',
            subCategory: rtgsFor === 'Supplier' ? 'Supplier Payment' : 'Outsider Payment',
            amount: finalPaymentAmount, payee: supplierDetails.name,
            description: `Payment ${paymentId} to ${supplierDetails.name}`,
            paymentMethod: paymentMethod as 'Cash' | 'Online' | 'RTGS' | 'Cheque',
            status: 'Paid', isRecurring: false,
        };
        if (paymentMethod !== 'Cash') expenseData.bankAccountId = selectedAccountId;
        transaction.set(expenseTransactionRef, expenseData);

        if (cdEnabled && calculatedCdAmount > 0) {
            const incomeTransactionRef = doc(incomesCollection);
            const incomeData: Partial<Income> = {
                id: incomeTransactionRef.id, date: new Date().toISOString().split('T')[0],
                transactionType: 'Income', category: 'Cash Discount Received',
                subCategory: 'Supplier CD', amount: calculatedCdAmount, payee: supplierDetails.name,
                description: `CD received on payment ${paymentId}`,
                paymentMethod: 'Other', status: 'Paid', isRecurring: false,
            };
            transaction.set(incomeTransactionRef, incomeData);
        }

        const paymentDataBase: Omit<Payment, 'id'> = {
            paymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
            date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : new Date().toISOString().split("T")[0],
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
        if (paymentMethod !== 'Cash') paymentDataBase.bankAccountId = selectedAccountId;

        const newPaymentRef = doc(paymentsCollection);
        transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
        finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
    });
    return finalPaymentData;
};

export const handleEditPaymentLogic = async (paymentToEdit: Payment, context: any) => {
    const {
        handleDeletePayment, setEditingPayment, setPaymentId, setRtgsSrNo,
        setPaymentAmount, setPaymentType, setPaymentMethod, setSelectedAccountId,
        setCdEnabled, setCalculatedCdAmount, setRtgsFor, setUtrNo, setCheckNo,
        setSixRNo, setSixRDate, setParchiNo, setRtgsQuantity, setRtgsRate, setRtgsAmount,
        setSupplierDetails, setBankDetails, setSelectedCustomerKey, setSelectedEntryIds
    } = context;

    if (!paymentToEdit.id) throw new Error("Payment ID is missing.");
    await handleDeletePayment(paymentToEdit.id, true);

    setEditingPayment(paymentToEdit);
    setPaymentId(paymentToEdit.paymentId);
    setRtgsSrNo(paymentToEdit.rtgsSrNo || '');
    setPaymentAmount(paymentToEdit.amount);
    setPaymentType(paymentToEdit.type);
    setPaymentMethod(paymentToEdit.receiptType);
    setSelectedAccountId(paymentToEdit.bankAccountId || 'CashInHand');
    setCdEnabled(paymentToEdit.cdApplied);
    setCalculatedCdAmount(paymentToEdit.cdAmount);
    setRtgsFor(paymentToEdit.rtgsFor || 'Supplier');
    setUtrNo(paymentToEdit.utrNo || '');
    setCheckNo(paymentToEdit.checkNo || '');
    setSixRNo(paymentToEdit.sixRNo || '');
    setSixRDate(paymentToEdit.sixRDate ? new Date(paymentToEdit.sixRDate) : undefined);
    setParchiNo(paymentToEdit.parchiNo || '');
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

    if (paymentToEdit.rtgsFor === 'Supplier') {
        setSelectedCustomerKey(paymentToEdit.customerId);
        const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
        if (srNosInPayment.length > 0) {
            const q = query(suppliersCollection, where('srNo', 'in', srNosInPayment));
            const supplierDocs = await getDocs(q);
            const foundSrNos = new Set(supplierDocs.docs.map(d => d.data().srNo));
            if (foundSrNos.size !== srNosInPayment.length) {
                throw new Error("One or more original entries for this payment are missing.");
            }
            const newSelectedEntryIds = new Set<string>();
            supplierDocs.forEach(doc => newSelectedEntryIds.add(doc.id));
            setSelectedEntryIds(newSelectedEntryIds);
        } else {
            setSelectedEntryIds(new Set());
        }
    } else {
        setSelectedCustomerKey(null);
        setSelectedEntryIds(new Set());
    }
};

export const handleDeletePaymentLogic = async (paymentIdToDelete: string, paymentHistory: Payment[]) => {
    const paymentToDelete = paymentHistory.find(p => p.id === paymentIdToDelete);
    if (!paymentToDelete || !paymentToDelete.id) {
        throw new Error("Payment not found or ID missing.");
    }

    await runTransaction(firestoreDB, async (transaction) => {
        const paymentRef = doc(firestoreDB, "payments", paymentIdToDelete);
        if (paymentToDelete.rtgsFor === 'Supplier' && paymentToDelete.paidFor) {
            for (const detail of paymentToDelete.paidFor) {
                const q = query(suppliersCollection, where('srNo', '==', detail.srNo), limit(1));
                const supplierDocsSnapshot = await getDocs(q);
                if (!supplierDocsSnapshot.empty) {
                    const customerDoc = supplierDocsSnapshot.docs[0];
                    const currentSupplier = customerDoc.data() as Customer;
                    const amountToRestore = detail.amount + (paymentToDelete.cdApplied ? paymentToDelete.cdAmount || 0 : 0) / paymentToDelete.paidFor.length;
                    const newNetAmount = (currentSupplier.netAmount as number) + amountToRestore;
                    transaction.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                }
            }
        }
        if (paymentToDelete.expenseTransactionId) {
            const expenseDocRef = doc(expensesCollection, paymentToDelete.expenseTransactionId);
            transaction.delete(expenseDocRef);
        }
        transaction.delete(paymentRef);
    });
};

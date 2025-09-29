
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, addBank, getBanksRealtime, getBankBranchesRealtime, getReceiptSettings, getFundTransactionsRealtime, getExpensesRealtime, getBankAccountsRealtime, deletePayment as deletePaymentFromDB, getIncomeRealtime, getCustomerPaymentsRealtime, addIncome, updateSupplier } from "@/lib/firestore";
import { firestoreDB } from "@/lib/firebase";
import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { toTitleCase, generateReadableId, formatCurrency } from "@/lib/utils";
import type { Customer, CustomerSummary, Payment, PaidFor, ReceiptSettings, FundTransaction, Transaction, BankAccount, Income, Expense, CustomerPayment } from "@/lib/definitions";
import { useCashDiscount } from './use-cash-discount';

export const useSupplierPayments = () => {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
    const [banks, setBanks] = useState<any[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

    const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

    const [paymentId, setPaymentId] = useState('');
    const [rtgsSrNo, setRtgsSrNo] = useState('');
    const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [paymentType, setPaymentType] = useState('Full');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('CashInHand');

    const [supplierDetails, setSupplierDetails] = useState({ name: '', fatherName: '', address: '', contact: ''});
    const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
    const [isPayeeEditing, setIsPayeeEditing] = useState(false);

    const [sixRNo, setSixRNo] = useState('');
    const [sixRDate, setSixRDate] = useState<Date | undefined>(new Date());
    const [parchiNo, setParchiNo] = useState('');
    const [utrNo, setUtrNo] = useState('');
    const [checkNo, setCheckNo] = useState('');

    const [rtgsQuantity, setRtgsQuantity] = useState(0);
    const [rtgsRate, setRtgsRate] = useState(0);
    const [rtgsAmount, setRtgsAmount] = useState(0);
    const [rtgsFor, setRtgsFor] = useState<'Supplier' | 'Outsider'>('Supplier');
    
    const [isClient, setIsClient] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<Customer | null>(null);
    const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
    const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
    const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
    const [rtgsReceiptData, setRtgsReceiptData] = useState<Payment | null>(null);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    
    const [calcTargetAmount, setCalcTargetAmount] = useState(0);
    
    const allExpenses = useMemo(() => [...expenses, ...paymentHistory], [expenses, paymentHistory]);
    const allIncomes = useMemo(() => [...incomes, ...customerPayments], [incomes, customerPayments]);
    
    const selectedEntries = useMemo(() => {
        if (!Array.isArray(suppliers)) return [];
        return suppliers.filter(s => selectedEntryIds.has(s.id));
    }, [suppliers, selectedEntryIds]);
    
    const totalOutstandingForSelected = useMemo(() => {
        return Math.round(selectedEntries.reduce((acc, entry) => acc + (entry.netAmount || 0), 0));
    }, [selectedEntries]);

    const {
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent,
        cdAt, setCdAt,
        calculatedCdAmount,
    } = useCashDiscount({
        paymentAmount,
        paymentType,
        selectedEntries,
        paymentHistory,
    });
    
    const getNextPaymentId = useCallback((method: 'Cash' | 'Online' | 'RTGS') => {
        if (method === 'RTGS') {
            const rtgsPayments = paymentHistory.filter(p => p.rtgsSrNo);
            const lastNum = rtgsPayments.reduce((max, p) => {
                const numMatch = p.rtgsSrNo?.match(/^R(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('RT', lastNum, 5);
        }
        if (method === 'Online') {
            const onlinePayments = paymentHistory.filter(p => p.receiptType === 'Online');
            const lastNum = onlinePayments.reduce((max, p) => {
                const numMatch = p.paymentId.match(/^P(\d+)$/);
                const num = numMatch ? parseInt(numMatch[1], 10) : 0;
                return num > max ? num : max;
            }, 0);
            return generateReadableId('P', lastNum, 6);
        }
        const cashPayments = paymentHistory.filter(p => p.receiptType === 'Cash');
        const lastCashNum = cashPayments.reduce((max, p) => {
            const numMatch = p.paymentId.match(/^EX(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        const lastExpenseNum = expenses.reduce((max, e) => {
            const numMatch = e.transactionId?.match(/^EX(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        const lastNum = Math.max(lastCashNum, lastExpenseNum);
        return generateReadableId('EX', lastNum, 5);
    }, [paymentHistory, expenses]);
    
    const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
    
    const customerSummaryMap = useMemo(() => {
        const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
        const summary = new Map<string, CustomerSummary>();
        
        safeSuppliers.forEach(s => {
            if (s.customerId && !summary.has(s.customerId)) {
                summary.set(s.customerId, {
                    name: s.name, contact: s.contact, so: s.so, address: s.address,
                    totalOutstanding: 0, paymentHistory: [], totalAmount: 0,
                    totalPaid: 0, outstandingEntryIds: [], acNo: s.acNo,
                    ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    allTransactions: []
                } as CustomerSummary);
            }
        });
        
        safeSuppliers.forEach(supplier => {
            if (!supplier.customerId) return;
            const data = summary.get(supplier.customerId)!;
            data.allTransactions!.push(supplier);
            const netAmount = Math.round(parseFloat(String(supplier.netAmount)));
            data.totalOutstanding += netAmount;
        });
        
        return summary;
    }, [suppliers]);
    
    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        bankAccounts.forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
    
        fundTransactions.forEach(t => {
            if (t.type === 'CapitalInflow') {
                if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            } else if (t.type === 'CashTransfer') {
                 if (balances.has(t.source)) balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
                if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        allIncomes.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
        });
        
        allExpenses.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' || ('receiptType' in t && t.receiptType === 'Cash') ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
        });
        
        return { balances };
      }, [fundTransactions, allIncomes, allExpenses, bankAccounts]);

    
    const autoSetCDToggle = useCallback(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isAnyDueInFuture = selectedEntries.some(e => new Date(e.dueDate) >= today);
        setCdEnabled(isAnyDueInFuture);
    }, [selectedEntries]);

    useEffect(() => {
        setIsClient(true);
        const lastUsedAccount = localStorage.getItem('lastSelectedAccountId');
        if (lastUsedAccount) setSelectedAccountId(lastUsedAccount);
    }, []);

    const handleSetSelectedAccount = (accountId: string) => {
        setSelectedAccountId(accountId);
        localStorage.setItem('lastSelectedAccountId', accountId);
    }

    useEffect(() => {
        if(!isClient) return;
        let isSubscribed = true;
        setLoading(true);
        const unsubSuppliers = getSuppliersRealtime((data) => isSubscribed && setSuppliers(data), console.error);
        const unsubPayments = getPaymentsRealtime((data) => isSubscribed && setPaymentHistory(data), console.error);
        const unsubIncomes = getIncomeRealtime((data) => isSubscribed && setIncomes(data), console.error);
        const unsubExpenses = getExpensesRealtime((data) => isSubscribed && setExpenses(data), console.error);
        const unsubFunds = getFundTransactionsRealtime((data) => isSubscribed && setFundTransactions(data), console.error);
        const unsubBankAccounts = getBankAccountsRealtime((data) => isSubscribed && setBankAccounts(data), console.error);
        const unsubCustomerPayments = getCustomerPaymentsRealtime((data) => isSubscribed && setCustomerPayments(data), console.error);
        const unsubscribeBanks = getBanksRealtime((data) => isSubscribed && setBanks(data), console.error);
        getReceiptSettings().then(settings => isSubscribed && setReceiptSettings(settings));
        setLoading(false);
        return () => { isSubscribed = false; unsubSuppliers(); unsubPayments(); unsubIncomes(); unsubExpenses(); unsubFunds(); unsubBankAccounts(); unsubCustomerPayments(); unsubscribeBanks(); };
    }, [isClient]);

    useEffect(() => {
        if (!editingPayment) {
            setPaymentId(getNextPaymentId(paymentMethod as 'Cash' | 'Online' | 'RTGS'));
            if (paymentMethod === 'RTGS') setRtgsSrNo(getNextPaymentId('RTGS'));
        }
    }, [paymentHistory, expenses, editingPayment, paymentMethod, getNextPaymentId]);

    useEffect(() => { autoSetCDToggle(); }, [selectedEntryIds, autoSetCDToggle]);
    
    useEffect(() => {
        if (paymentType === 'Full') setCdAt('on_unpaid_amount');
        else if (paymentType === 'Partial') setCdAt('partial_on_paid');
    }, [paymentType, setCdAt]);
    
    useEffect(() => {
        const finalAmount = Math.round(totalOutstandingForSelected - calculatedCdAmount);
        setCalcTargetAmount(finalAmount > 0 ? finalAmount : 0);
        if (paymentType === 'Full') setPaymentAmount(finalAmount > 0 ? finalAmount : 0);
    }, [totalOutstandingForSelected, calculatedCdAmount, paymentType]);

    useEffect(() => {
        if (selectedEntries.length > 0) setParchiNo(selectedEntries.map(e => e.srNo).join(', '));
        else setParchiNo('');
    }, [selectedEntries]);

    const resetPaymentForm = useCallback((isOutsider: boolean = false) => {
        if (!isOutsider) setSelectedEntryIds(new Set());
        setPaymentAmount(0);
        setCdEnabled(false);
        setEditingPayment(null);
        setUtrNo(''); setCheckNo(''); setSixRNo(''); setParchiNo('');
        setRtgsQuantity(0); setRtgsRate(0); setRtgsAmount(0);
        setPaymentId(getNextPaymentId(paymentMethod as 'Cash' | 'Online' | 'RTGS'));
        setRtgsSrNo(getNextPaymentId('RTGS'));
        if (isOutsider) {
            setSupplierDetails({ name: '', fatherName: '', address: '', contact: '' });
            setBankDetails({ acNo: '', ifscCode: '', bank: '', branch: '' });
            setPaymentType('Full');
        }
    }, [getNextPaymentId, paymentHistory, paymentMethod, expenses]);

    const handleFullReset = useCallback(() => { setSelectedCustomerKey(null); resetPaymentForm(); }, [resetPaymentForm]);
    
    const handleCustomerSelect = (key: string | null) => {
        setSelectedCustomerKey(key);
        if(key){
            const customerData = customerSummaryMap.get(key);
            if(customerData) {
                setSupplierDetails({ name: customerData.name || '', fatherName: customerData.so || '', address: customerData.address || '', contact: customerData.contact || '' });
                setBankDetails({ acNo: customerData.acNo || '', ifscCode: customerData.ifscCode || '', bank: customerData.bank || '', branch: customerData.branch || '' });
            }
        }
        resetPaymentForm();
    };
    
    const processPayment = async () => {
        if (rtgsFor === 'Supplier' && !selectedCustomerKey) { toast({ title: "No supplier selected", variant: 'destructive' }); return; }
        if (rtgsFor === 'Supplier' && selectedEntryIds.size === 0 && !editingPayment) { toast({ title: "Please select entries to pay", variant: "destructive" }); return; }
        const finalPaymentAmount = rtgsAmount || paymentAmount;
        const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
        const availableBalance = financialState.balances.get(accountIdForPayment) || 0;
        if (finalPaymentAmount > availableBalance) {
            const accountName = bankAccounts.find(acc => acc.id === accountIdForPayment)?.accountHolderName || 'Cash in Hand';
            toast({ title: "Insufficient Balance", description: `Payment of ${formatCurrency(finalPaymentAmount)} exceeds available balance of ${formatCurrency(availableBalance)} in ${accountName}.`, variant: "destructive" });
            return;
        }
        const totalPaidAmount = finalPaymentAmount + calculatedCdAmount;
        if (totalPaidAmount <= 0) { toast({ title: "Payment amount must be positive", variant: 'destructive' }); return; }
        if (rtgsFor === 'Supplier' && paymentType === 'Partial' && !editingPayment && totalPaidAmount > totalOutstandingForSelected) { toast({ title: "Partial payment cannot exceed outstanding", variant: 'destructive' }); return; }
        setIsProcessing(true);
        try {
            let finalPaymentData: Payment | null = null;
            await runTransaction(firestoreDB, async (transaction) => {
                const supplierDocsToGet = new Set<string>();
                if (rtgsFor === 'Supplier') selectedEntryIds.forEach(id => supplierDocsToGet.add(id));
                const supplierDocs = new Map<string, any>();
                for (const id of supplierDocsToGet) {
                    const docRef = doc(firestoreDB, "suppliers", id);
                    const supplierDoc = await transaction.get(docRef);
                    if (supplierDoc.exists()) supplierDocs.set(id, supplierDoc.data());
                    else throw new Error(`Supplier with ID ${id} not found.`);
                }
                let paidForDetails: PaidFor[] = [];
                if (rtgsFor === 'Supplier') {
                    let amountToDistribute = Math.round(totalPaidAmount);
                    const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    for (const entryData of sortedEntries) {
                        if (amountToDistribute <= 0) break;
                        const supplierData = supplierDocs.get(entryData.id);
                        let outstanding = Number(supplierData.netAmount);
                        const paymentForThisEntry = Math.min(outstanding, amountToDistribute);
                        if (paymentForThisEntry > 0) {
                            paidForDetails.push({ srNo: entryData.srNo, amount: paymentForThisEntry, cdApplied: cdEnabled, supplierName: toTitleCase(entryData.name), supplierSo: toTitleCase(entryData.so), supplierContact: entryData.contact });
                            const supplierRef = doc(firestoreDB, "suppliers", entryData.id);
                            transaction.update(supplierRef, { netAmount: outstanding - paymentForThisEntry });
                            amountToDistribute -= paymentForThisEntry;
                        }
                    }
                }
                const expenseTransactionRef = doc(collection(firestoreDB, 'expenses'));
                const expenseData: Partial<Expense> = { id: expenseTransactionRef.id, date: new Date().toISOString().split('T')[0], transactionType: 'Expense', category: 'Supplier Payments', subCategory: rtgsFor === 'Supplier' ? 'Supplier Payment' : 'Outsider Payment', amount: finalPaymentAmount, payee: supplierDetails.name, description: `Payment ${paymentId} to ${supplierDetails.name}`, paymentMethod: paymentMethod as 'Cash' | 'Online' | 'RTGS' | 'Cheque', status: 'Paid', isRecurring: false };
                if (paymentMethod !== 'Cash') expenseData.bankAccountId = selectedAccountId;
                transaction.set(expenseTransactionRef, expenseData);
                if (cdEnabled && calculatedCdAmount > 0) {
                    const incomeTransactionRef = doc(collection(firestoreDB, 'incomes'));
                    const incomeData: Partial<Income> = { id: incomeTransactionRef.id, date: new Date().toISOString().split('T')[0], transactionType: 'Income', category: 'Cash Discount Received', subCategory: 'Supplier CD', amount: calculatedCdAmount, payee: supplierDetails.name, description: `CD received on payment ${paymentId}`, paymentMethod: 'Other', status: 'Paid', isRecurring: false };
                    transaction.set(incomeTransactionRef, incomeData);
                }
                const paymentDataBase: Omit<Payment, 'id'> = { paymentId: paymentId, customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER', date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : new Date().toISOString().split("T")[0], amount: Math.round(finalPaymentAmount), cdAmount: Math.round(calculatedCdAmount), cdApplied: cdEnabled, type: paymentType, receiptType: paymentMethod, notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`, paidFor: rtgsFor === 'Supplier' ? paidForDetails : [], sixRNo: sixRNo, sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '', parchiNo, utrNo, checkNo, quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount, supplierName: toTitleCase(supplierDetails.name), supplierFatherName: toTitleCase(supplierDetails.fatherName), supplierAddress: toTitleCase(supplierDetails.address), bankName: bankDetails.bank, bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode, rtgsFor: rtgsFor, expenseTransactionId: expenseTransactionRef.id };
                if (paymentMethod === 'RTGS') paymentDataBase.rtgsSrNo = rtgsSrNo;
                else delete (paymentDataBase as Partial<Payment>).rtgsSrNo;
                if (paymentMethod !== 'Cash') paymentDataBase.bankAccountId = selectedAccountId;
                const newPaymentRef = doc(collection(firestoreDB, "payments"));
                transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
                finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
            });
            toast({ title: `Payment processed successfully.`, variant: 'success' });
            if (paymentMethod === 'RTGS' && finalPaymentData) setRtgsReceiptData(finalPaymentData);
            resetPaymentForm(rtgsFor === 'Outsider');
        } catch (error) { console.error("Error processing payment:", error); toast({ title: "Transaction Failed", description: (error as Error).message, variant: "destructive" }); } 
        finally { setIsProcessing(false); }
    };
    
    const handleEditPayment = async (paymentToEdit: Payment) => {
        if (!paymentToEdit.id) return;
        await handleDeletePayment(paymentToEdit.id, true);
        setEditingPayment(paymentToEdit); setPaymentId(paymentToEdit.paymentId); setRtgsSrNo(paymentToEdit.rtgsSrNo || '');
        setPaymentAmount(paymentToEdit.amount); setPaymentType(paymentToEdit.type); setPaymentMethod(paymentToEdit.receiptType);
        setSelectedAccountId(paymentToEdit.bankAccountId || 'CashInHand'); setCdEnabled(paymentToEdit.cdApplied); setCalculatedCdAmount(paymentToEdit.cdAmount);
        setRtgsFor(paymentToEdit.rtgsFor || 'Supplier'); setUtrNo(paymentToEdit.utrNo || ''); setCheckNo(paymentToEdit.checkNo || '');
        setSixRNo(paymentToEdit.sixRNo || ''); setSixRDate(paymentToEdit.sixRDate ? new Date(paymentToEdit.sixRDate) : undefined);
        setParchiNo(paymentToEdit.parchiNo || ''); setRtgsQuantity(paymentToEdit.quantity || 0); setRtgsRate(paymentToEdit.rate || 0); setRtgsAmount(paymentToEdit.rtgsAmount || 0);
        setSupplierDetails({ name: paymentToEdit.supplierName || '', fatherName: paymentToEdit.supplierFatherName || '', address: paymentToEdit.supplierAddress || '', contact: '' });
        setBankDetails({ acNo: paymentToEdit.bankAcNo || '', ifscCode: paymentToEdit.bankIfsc || '', bank: paymentToEdit.bankName || '', branch: paymentToEdit.bankBranch || '' });
        if (paymentToEdit.rtgsFor === 'Supplier') {
            setSelectedCustomerKey(paymentToEdit.customerId);
            const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
            if (srNosInPayment.length > 0) {
              const q = query(collection(firestoreDB, "suppliers"), where('srNo', 'in', srNosInPayment));
              const supplierDocs = await getDocs(q);
              const foundSrNos = new Set(supplierDocs.docs.map(d => d.data().srNo));
              if (foundSrNos.size !== srNosInPayment.length) { toast({ title: "Cannot Edit: Original entry missing.", variant: "destructive" }); setEditingPayment(null); return; }
              const newSelectedEntryIds = new Set<string>();
              supplierDocs.forEach(doc => newSelectedEntryIds.add(doc.id));
              setSelectedEntryIds(newSelectedEntryIds);
            } else { setSelectedEntryIds(new Set()); }
        } else { setSelectedCustomerKey(null); setSelectedEntryIds(new Set()); }
        toast({ title: `Editing Payment ${paymentToEdit.paymentId}`, description: "Details loaded. Make changes and re-save."});
    };

    const handleDeletePayment = async (paymentIdToDelete: string, isEditing: boolean = false) => {
        const paymentToDelete = paymentHistory.find(p => p.id === paymentIdToDelete);
        if (!paymentToDelete || !paymentToDelete.id) { toast({ title: "Payment not found or ID missing.", variant: "destructive" }); return; }
        try {
            await runTransaction(firestoreDB, async (transaction) => {
                const paymentRef = doc(firestoreDB, "payments", paymentIdToDelete);
                if (paymentToDelete.rtgsFor === 'Supplier' && paymentToDelete.paidFor) {
                    for (const detail of paymentToDelete.paidFor) {
                        const q = query(collection(firestoreDB, "suppliers"), where('srNo', '==', detail.srNo), limit(1));
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
                    const expenseDocRef = doc(collection(firestoreDB, 'expenses'), paymentToDelete.expenseTransactionId);
                    transaction.delete(expenseDocRef);
                }
                transaction.delete(paymentRef);
            });
            if (!isEditing) toast({ title: `Payment ${paymentToDelete.paymentId} deleted successfully.`, variant: 'success', duration: 3000 });
            if (editingPayment?.id === paymentIdToDelete) resetPaymentForm();
        } catch (error) { console.error("Error deleting payment:", error); toast({ title: "Failed to delete payment.", description: (error as Error).message, variant: "destructive" }); }
    };
    
    const handlePaySelectedOutstanding = () => {
        if (selectedEntryIds.size === 0) { toast({ title: "No Entries Selected.", variant: "destructive" }); return; }
        setIsOutstandingModalOpen(false);
    };

    const selectPaymentAmount = (option: any) => {
        setPaymentType('Partial'); 
        setCdAt('full_amount'); 
        setPaymentAmount(option.calculatedAmount); 
        setRtgsQuantity(option.quantity); 
        setRtgsRate(option.rate); 
        setRtgsAmount(option.calculatedAmount);
        toast({ title: `Amount ${formatCurrency(option.calculatedAmount)} selected.`, variant: 'success' });
    };

    return {
        isClient, loading, suppliers, paymentHistory, banks, bankAccounts, financialState, customerSummaryMap,
        selectedCustomerKey, setSelectedCustomerKey, selectedEntryIds, setSelectedEntryIds,
        paymentId, setPaymentId, rtgsSrNo, setRtgsSrNo, paymentDate, setPaymentDate, paymentAmount, setPaymentAmount,
        paymentType, setPaymentType, paymentMethod, setPaymentMethod, selectedAccountId, handleSetSelectedAccount,
        supplierDetails, setSupplierDetails, bankDetails, setBankDetails, isPayeeEditing, setIsPayeeEditing,
        sixRNo, setSixRNo, sixRDate, setSixRDate, parchiNo, setParchiNo, utrNo, setUtrNo, checkNo, setCheckNo,
        rtgsQuantity, setRtgsQuantity, rtgsRate, setRtgsRate, rtgsAmount, setRtgsAmount, rtgsFor, setRtgsFor,
        cdEnabled, setCdEnabled, cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount,
        isProcessing, editingPayment, detailsSupplierEntry, setDetailsSupplierEntry,
        selectedPaymentForDetails, setSelectedPaymentForDetails, isOutstandingModalOpen, setIsOutstandingModalOpen,
        isBankSettingsOpen, setIsBankSettingsOpen, rtgsReceiptData, setRtgsReceiptData, receiptSettings,
        calcTargetAmount, selectPaymentAmount, processPayment, handleEditPayment, handleDeletePayment,
        resetPaymentForm, handleFullReset, handleCustomerSelect, handlePaySelectedOutstanding,
    };
};

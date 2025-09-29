
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, CustomerSummary, Payment, PaidFor, ReceiptSettings, FundTransaction, Transaction, BankAccount, Income, Expense, CustomerPayment } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, cn, formatCurrency, formatSrNo, generateReadableId, levenshteinDistance } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, addBank, addBankBranch, getBanksRealtime, getBankBranchesRealtime, getReceiptSettings, getFundTransactionsRealtime, getExpensesRealtime, addTransaction, getBankAccountsRealtime, deletePayment as deletePaymentFromDB, getIncomeRealtime, getCustomerPaymentsRealtime, addIncome, updateSupplier, deleteIncome } from "@/lib/firestore";
import { firestoreDB } from "@/lib/firebase";
import { collection, doc, getDocs, query, runTransaction, where, addDoc, deleteDoc, limit } from 'firebase/firestore';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Pen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { DetailsDialog } from '@/components/sales/supplier-payments/details-dialog';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { OutstandingEntriesDialog } from '@/components/sales/supplier-payments/outstanding-entries-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';


const suppliersCollection = collection(firestoreDB, "suppliers");
const expensesCollection = collection(firestoreDB, "expenses");


type PaymentOption = {
  quantity: number;
  rate: number;
  calculatedAmount: number;
  amountRemaining: number;
};

type SortConfig = {
    key: keyof PaymentOption;
    direction: 'ascending' | 'descending';
};

export default function SupplierPaymentsClient() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankBranches, setBankBranches] = useState<any[]>([]);
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


  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

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
  const [activeTab, setActiveTab] = useState('processing');
  
  // Combination Generator State
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [calcTargetAmount, setCalcTargetAmount] = useState(0);
  const [calcMinRate, setCalcMinRate] = useState(2300);
  const [calcMaxRate, setCalcMaxRate] = useState(2400);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [roundFigureToggle, setRoundFigureToggle] = useState(false);

  const allExpenses = useMemo(() => [...expenses, ...paymentHistory], [expenses, paymentHistory]);
  const allIncomes = useMemo(() => [...incomes, ...customerPayments], [incomes, customerPayments]);


  const stableToast = useCallback(toast, []);

    const getNextPaymentId = useCallback((method: 'Cash' | 'Online' | 'RTGS') => {
        if (method === 'RTGS') {
            const rtgsPayments = paymentHistory.filter(p => p.rtgsSrNo);
            const lastNum = rtgsPayments.reduce((max, p) => {
                const numMatch = p.rtgsSrNo?.match(/^RT(\d+)$/);
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
        // For 'Cash', it shares sequence with 'expenses'
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
    const LEVENSHTEIN_THRESHOLD = 2;
    
    const normalizeString = (str: string) => str.replace(/\s+/g, '').toLowerCase();

    const findBestMatchKey = (supplier: Customer, existingKeys: string[]): string | null => {
        if (supplier.forceUnique) {
            return `${normalizeString(supplier.name)}|${normalizeString(supplier.contact)}|${supplier.id}`;
        }
        
        const supNameNorm = normalizeString(supplier.name);
        const supSoNorm = normalizeString(supplier.so || '');
        let bestMatch: string | null = null;
        let minDistance = Infinity;

        for (const key of existingKeys) {
            const keyParts = key.split('|');
            if (keyParts.length > 2) continue; // Skip forceUnique keys
            
            const [keyNameNorm, keySoNorm] = keyParts;
            const nameDist = levenshteinDistance(supNameNorm, keyNameNorm);
            const soDist = levenshteinDistance(supSoNorm, keySoNorm);
            const totalDist = nameDist + soDist;

            if (totalDist < minDistance && totalDist <= LEVENSHTEIN_THRESHOLD) {
                minDistance = totalDist;
                bestMatch = key;
            }
        }
        return bestMatch;
    };

    safeSuppliers.forEach(s => {
        const groupingKey = findBestMatchKey(s, Array.from(summary.keys())) || `${normalizeString(s.name)}|${normalizeString(s.so || '')}`;
        if (!summary.has(groupingKey)) {
            summary.set(groupingKey, {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                totalOutstanding: 0, paymentHistory: [], totalAmount: 0,
                totalPaid: 0, outstandingEntryIds: [], acNo: s.acNo,
                ifscCode: s.ifscCode, bank: s.bank, branch: s.branch
            } as CustomerSummary);
        }
    });

    safeSuppliers.forEach(supplier => {
        const groupingKey = findBestMatchKey(supplier, Array.from(summary.keys())) || `${normalizeString(supplier.name)}|${normalizeString(supplier.so || '')}`;
        if (!summary.has(groupingKey)) return;
        
        const data = summary.get(groupingKey)!;
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
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        } else if (t.type === 'CashTransfer') {
             if (balances.has(t.source)) {
                balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            }
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        }
    });
    
    allIncomes.forEach(t => {
        const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
         if (balanceKey && balances.has(balanceKey)) {
            balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
        }
    });
    
    allExpenses.forEach(t => {
        const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' || ('receiptType' in t && t.receiptType === 'Cash') ? 'CashInHand' : '');
         if (balanceKey && balances.has(balanceKey)) {
             balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
        }
    });
    
    return { balances };
  }, [fundTransactions, allIncomes, allExpenses, bankAccounts]);

  const selectedEntries = useMemo(() => {
    if (!Array.isArray(suppliers)) return [];
    return suppliers.filter(s => selectedEntryIds.has(s.id));
  }, [suppliers, selectedEntryIds]);
  
  const totalOutstandingForSelected = useMemo(() => {
    return Math.round(selectedEntries.reduce((acc, entry) => acc + (entry.netAmount || 0), 0));
  }, [selectedEntries]);
  
  const autoSetCDToggle = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isAnyDueInFuture = selectedEntries.some(e => new Date(e.dueDate) >= today);
    setCdEnabled(isAnyDueInFuture);
  }, [selectedEntries]);

  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsSupplierEntry || !paymentHistory) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsSupplierEntry.srNo)
    );
  }, [detailsSupplierEntry, paymentHistory]);

  const isLoadingInitial = loading && suppliers.length === 0;
  
  useEffect(() => {
    setIsClient(true);
    const lastUsedAccount = localStorage.getItem('lastSelectedAccountId');
    if (lastUsedAccount) {
      setSelectedAccountId(lastUsedAccount);
    }
  }, []);

  const handleSetSelectedAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    localStorage.setItem('lastSelectedAccountId', accountId);
  }

  useEffect(() => {
    if(!isClient) return;
    
    let isSubscribed = true;
    setLoading(true);

    const unsubSuppliers = getSuppliersRealtime((fetchedSuppliers) => {
      if (isSubscribed) {
          setSuppliers(fetchedSuppliers);
          setLoading(false);
      }
    }, (error) => {
        if(isSubscribed) {
            console.error("Error fetching suppliers:", error);
            stableToast({ title: "Failed to load supplier data.", variant: 'destructive' });
            setLoading(false);
        }
    });

    const unsubPayments = getPaymentsRealtime((fetchedPayments) => {
      if(isSubscribed) {
        setPaymentHistory(fetchedPayments);
      }
    }, (error) => {
        if(isSubscribed) {
            console.error("Error fetching payments:", error);
            stableToast({ title: "Failed to load payment history.", variant: 'destructive' });
        }
    });
    
    const unsubIncomes = getIncomeRealtime(setIncomes, console.error);
    const unsubExpenses = getExpensesRealtime(setExpenses, console.error);
    const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
    const unsubBankAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
    const unsubCustomerPayments = getCustomerPaymentsRealtime(setCustomerPayments, console.error);
    
    const unsubscribeBanks = getBanksRealtime(setBanks, (error) => {
      if(isSubscribed) console.error("Error fetching banks:", error);
    });

    const unsubscribeBankBranches = getBankBranchesRealtime(setBankBranches, (error) => {
      if(isSubscribed) console.error("Error fetching bank branches:", error);
    });
    
    const fetchSettings = async () => {
        const settings = await getReceiptSettings();
        if (settings && isSubscribed) {
            setReceiptSettings(settings);
        }
    };
    fetchSettings();


    return () => {
      isSubscribed = false;
      unsubSuppliers();
      unsubPayments();
      unsubIncomes();
      unsubExpenses();
      unsubFunds();
      unsubBankAccounts();
      unsubCustomerPayments();
      unsubscribeBanks();
      unsubscribeBankBranches();
    };
  }, [isClient, stableToast]);

    useEffect(() => {
        if (!editingPayment) {
            setPaymentId(getNextPaymentId(paymentMethod as 'Cash' | 'Online' | 'RTGS'));
            if (paymentMethod === 'RTGS') {
                setRtgsSrNo(getNextPaymentId('RTGS'));
            }
        }
    }, [paymentHistory, expenses, editingPayment, paymentMethod, getNextPaymentId]);
  
  useEffect(() => {
    autoSetCDToggle();
  }, [selectedEntryIds, autoSetCDToggle]);
  
  useEffect(() => {
    if (paymentType === 'Full') {
        setCdAt('full_amount');
    } else if (paymentType === 'Partial') {
        setCdAt('partial_on_paid');
    }
  }, [paymentType]);

  useEffect(() => {
    if (!cdEnabled) {
        setCalculatedCdAmount(0);
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let baseAmountForCd = 0;

    if (cdAt === 'partial_on_paid') {
        baseAmountForCd = paymentAmount;
    } else {
        const eligibleEntries = selectedEntries.filter(e => new Date(e.dueDate) >= today);

        if (cdAt === 'on_unpaid_amount') {
            baseAmountForCd = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
        } else { // 'on_previously_paid' or 'on_full_amount'
            const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
            const paymentsForSelectedEntries = (paymentHistory || []).filter(p => 
                p.paidFor?.some(pf => selectedSrNos.has(pf.srNo))
            );

            let eligiblePaidAmount = 0;
            paymentsForSelectedEntries.forEach(p => {
                if (!p.cdApplied) {
                    p.paidFor?.forEach(pf => {
                        const originalEntry = selectedEntries.find(s => s.srNo === pf.srNo);
                        if (originalEntry && new Date(p.date) <= new Date(originalEntry.dueDate)) {
                            eligiblePaidAmount += pf.amount;
                        }
                    });
                }
            });
            
            if (cdAt === 'on_previously_paid') {
                baseAmountForCd = eligiblePaidAmount;
            } else if (cdAt === 'on_full_amount') {
                const eligibleUnpaid = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
                baseAmountForCd = eligibleUnpaid + eligiblePaidAmount;
            }
        }
    }

    setCalculatedCdAmount(Math.round((baseAmountForCd * cdPercent) / 100));
  }, [cdEnabled, cdPercent, cdAt, paymentAmount, selectedEntries, paymentHistory]);
  
  useEffect(() => {
    const finalAmount = Math.round(totalOutstandingForSelected - calculatedCdAmount);
    setCalcTargetAmount(finalAmount > 0 ? finalAmount : 0);
    if (paymentType === 'Full') {
      setPaymentAmount(finalAmount > 0 ? finalAmount : 0);
    }
  }, [totalOutstandingForSelected, calculatedCdAmount, paymentType]);

   useEffect(() => {
    if (selectedEntries.length > 0) {
      const parchiNumbers = selectedEntries.map(e => e.srNo).join(', ');
      setParchiNo(parchiNumbers);
    } else {
      setParchiNo('');
    }
  }, [selectedEntries]);
   
  const resetPaymentForm = useCallback((isOutsider: boolean = false) => {
    if (!isOutsider) {
      setSelectedEntryIds(new Set());
    }
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPayment(null);
    setUtrNo('');
    setCheckNo('');
    setSixRNo('');
    setParchiNo('');
    setRtgsQuantity(0);
    setRtgsRate(0);
    setRtgsAmount(0);
    setPaymentOptions([]);
    setPaymentId(getNextPaymentId(paymentMethod as 'Cash' | 'Online' | 'RTGS'));
    setRtgsSrNo(getNextPaymentId('RTGS'));
    if (isOutsider) {
      setSupplierDetails({ name: '', fatherName: '', address: '', contact: '' });
      setBankDetails({ acNo: '', ifscCode: '', bank: '', branch: '' });
      setPaymentType('Full');
    }
  }, [getNextPaymentId, paymentHistory, paymentMethod, expenses]);

  const handleFullReset = useCallback(() => {
    setSelectedCustomerKey(null);
    resetPaymentForm();
  }, [resetPaymentForm]);

  const handleCustomerSelect = (key: string | null) => {
    setSelectedCustomerKey(key);
    if(key){
        const customerData = customerSummaryMap.get(key);
        if(customerData) {
            setSupplierDetails({
                name: customerData.name || '',
                fatherName: customerData.so || '',
                address: customerData.address || '',
                contact: customerData.contact || ''
            });
            setBankDetails({
                acNo: customerData.acNo || '',
                ifscCode: customerData.ifscCode || '',
                bank: customerData.bank || '',
                branch: customerData.branch || '',
            });
        }
    }
    resetPaymentForm();
  };
  
  const handleEntrySelect = (entryId: string) => {
    const newSet = new Set(selectedEntryIds);
    if (newSet.has(entryId)) {
      newSet.delete(entryId);
    } else {
      newSet.add(entryId);
    }
    setSelectedEntryIds(newSet);
  };
  
    const handlePaymentIdBlur = () => {
        let value = paymentId.trim();
        if (!value) return;

        let prefix = '';
        if (paymentMethod === 'Cash') prefix = 'EX';
        else if (paymentMethod === 'Online') prefix = 'P';
        
        if (value && !isNaN(parseInt(value)) && isFinite(Number(value))) {
            const padding = paymentMethod === 'Online' ? 6 : 5;
            value = generateReadableId(prefix, parseInt(value) -1, padding);
            setPaymentId(value);
        }

        if (paymentMethod === 'Cash') {
            const foundExpense = expenses.find(e => e.transactionId === value);
            if (foundExpense) {
                toast({ title: 'ID Occupied', description: `This ID is already used in expenses for payee: ${foundExpense.payee}`, variant: 'destructive' });
                return;
            }
        }
        
        const foundPayment = paymentHistory.find(p => p.paymentId === value);
        if (foundPayment) {
            handleEditPayment(foundPayment);
        }
    };

const processPayment = async () => {
    if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
        toast({ title: "No supplier selected", variant: 'destructive' });
        return;
    }
    if (rtgsFor === 'Supplier' && selectedEntryIds.size === 0 && !editingPayment) {
        toast({ title: "Please select entries to pay", variant: 'destructive' });
        return;
    }

    const finalPaymentAmount = rtgsAmount || paymentAmount;
    
    const accountIdForPayment = paymentMethod === 'Cash' ? 'CashInHand' : selectedAccountId;
    const availableBalance = financialState.balances.get(accountIdForPayment) || 0;
    
    if (finalPaymentAmount > availableBalance) {
        const accountName = bankAccounts.find(acc => acc.id === accountIdForPayment)?.accountHolderName || 'Cash in Hand';
        toast({
            title: "Insufficient Balance",
            description: `Payment of ${formatCurrency(finalPaymentAmount)} exceeds available balance of ${formatCurrency(availableBalance)} in ${accountName}.`,
            variant: "destructive"
        });
        return;
    }
    
    const totalPaidAmount = finalPaymentAmount + calculatedCdAmount;

    if (totalPaidAmount <= 0) {
        toast({ title: "Payment amount must be positive", variant: 'destructive' });
        return;
    }
    if (rtgsFor === 'Supplier' && paymentType === 'Partial' && !editingPayment && totalPaidAmount > totalOutstandingForSelected) {
        toast({ title: "Partial payment cannot exceed outstanding", variant: 'destructive' });
        return;
    }

    setIsProcessing(true);
    try {
        let finalPaymentData: Payment | null = null;
        
        await runTransaction(firestoreDB, async (transaction) => {
            const supplierDocsToGet = new Set<string>();
            
            if (rtgsFor === 'Supplier') {
                selectedEntryIds.forEach(id => supplierDocsToGet.add(id));
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
                const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
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

            const paymentDataBase: Omit<Payment, 'id'> = {
                paymentId: paymentId,
                customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
                date: paymentDate ? format(paymentDate, 'yyyy-MM-dd') : new Date().toISOString().split("T")[0],
                amount: Math.round(finalPaymentAmount),
                cdAmount: Math.round(calculatedCdAmount),
                cdApplied: cdEnabled,
                type: paymentType,
                receiptType: paymentMethod,
                notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                paidFor: rtgsFor === 'Supplier' ? paidForDetails : [],
                sixRNo: sixRNo,
                sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
                parchiNo,
                utrNo,
                checkNo,
                quantity: rtgsQuantity,
                rate: rtgsRate,
                rtgsAmount,
                supplierName: toTitleCase(supplierDetails.name),
                supplierFatherName: toTitleCase(supplierDetails.fatherName),
                supplierAddress: toTitleCase(supplierDetails.address),
                bankName: bankDetails.bank,
                bankBranch: bankDetails.branch,
                bankAcNo: bankDetails.acNo,
                bankIfsc: bankDetails.ifscCode,
                rtgsFor: rtgsFor,
            };
            
            if (paymentMethod === 'RTGS') {
                paymentDataBase.rtgsSrNo = rtgsSrNo;
            } else {
                 delete (paymentDataBase as Partial<Payment>).rtgsSrNo;
            }
             if (paymentMethod !== 'Cash') {
                paymentDataBase.bankAccountId = selectedAccountId;
            }
            
            const newPaymentRef = doc(collection(firestoreDB, "payments"));
            transaction.set(newPaymentRef, { ...paymentDataBase, id: newPaymentRef.id });
            finalPaymentData = { id: newPaymentRef.id, ...paymentDataBase } as Payment;
        });

        toast({ title: `Payment processed successfully.`, variant: 'success' });
        if (paymentMethod === 'RTGS' && finalPaymentData) {
            setRtgsReceiptData(finalPaymentData);
        }
        resetPaymentForm(rtgsFor === 'Outsider');
    } catch (error) {
        console.error("Error processing payment:", error);
        toast({ title: "Transaction Failed", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
};

    const handleEditPayment = async (paymentToEdit: Payment) => {
        if (!paymentToEdit.id) return;
        
        await handleDeletePayment(paymentToEdit.id, true);
        
        setActiveTab('processing');
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
                  toast({ title: "Cannot Edit: Original entry missing.", variant: "destructive" });
                  setEditingPayment(null); // Reset editing state
                  return;
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

        toast({ title: `Editing Payment ${paymentToEdit.paymentId}`, description: "Details loaded. Make changes and re-save."});
    };

    const handleDeletePayment = async (paymentIdToDelete: string, isEditing: boolean = false) => {
        const paymentToDelete = paymentHistory.find(p => p.id === paymentIdToDelete);
        if (!paymentToDelete || !paymentToDelete.id) {
            toast({ title: "Payment not found or ID missing.", variant: "destructive" });
            return;
        }

        try {
            await runTransaction(firestoreDB, async (transaction) => {
                const paymentRef = doc(firestoreDB, "payments", paymentIdToDelete);
                
                // Revert supplier netAmount
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
            if (!isEditing) {
                toast({ title: `Payment ${paymentToDelete.paymentId} deleted successfully.`, variant: 'success', duration: 3000 });
            }
            if (editingPayment?.id === paymentIdToDelete) {
              resetPaymentForm();
            }
        } catch (error) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const handlePaySelectedOutstanding = () => {
        if (selectedEntryIds.size === 0) {
            toast({ title: "No Entries Selected.", variant: "destructive" });
            return;
        }
        setIsOutstandingModalOpen(false);
    };

    const handleGeneratePaymentOptions = () => {
        if (isNaN(calcTargetAmount) || isNaN(calcMinRate) || isNaN(calcMaxRate) || calcMinRate > calcMaxRate) {
            toast({ title: 'Invalid input for payment calculation.', variant: 'destructive' });
            return;
        }

        const rawOptions: PaymentOption[] = [];
        const generatedUniqueRemainingAmounts = new Map<number, number>();
        const maxQuantityToSearch = Math.min(200, Math.ceil(calcTargetAmount / (calcMinRate > 0 ? calcMinRate : 1)) + 50);

        for (let q = 0.10; q <= maxQuantityToSearch; q = parseFloat((q + 0.10).toFixed(2))) {
            for (let currentRate = calcMinRate; currentRate <= calcMaxRate; currentRate += 5) {
                if (currentRate % 5 !== 0) continue;

                let calculatedAmount = q * currentRate;
                if (roundFigureToggle) {
                    calculatedAmount = Math.round(calculatedAmount / 100) * 100;
                } else {
                    calculatedAmount = Math.round(calculatedAmount / 5) * 5;
                }

                if (calculatedAmount > calcTargetAmount) continue;

                const amountRemaining = parseFloat((calcTargetAmount - calculatedAmount).toFixed(2));
                if (amountRemaining < 0) continue;

                const count = generatedUniqueRemainingAmounts.get(amountRemaining) || 0;
                if (count < 5) {
                    rawOptions.push({
                        quantity: q,
                        rate: currentRate,
                        calculatedAmount: calculatedAmount,
                        amountRemaining: amountRemaining
                    });
                    generatedUniqueRemainingAmounts.set(amountRemaining, count + 1);
                }
            }
        }
        
        const sortedOptions = rawOptions.sort((a, b) => a.amountRemaining - b.amountRemaining);
        const limitedOptions = sortedOptions.slice(0, 100);

        setPaymentOptions(limitedOptions);
        setSortConfig(null);
        
        toast({ title: `Generated ${limitedOptions.length} payment options.`, variant: 'success' });
    };

    const selectPaymentAmount = (option: PaymentOption) => {
        setPaymentType('Partial');
        setCdAt('full_amount');
        setPaymentAmount(option.calculatedAmount); 
        setRtgsQuantity(option.quantity);
        setRtgsRate(option.rate);
        setRtgsAmount(option.calculatedAmount);
        toast({ title: `Amount ${formatCurrency(option.calculatedAmount)} selected.`, variant: 'success' });
    };

    const requestSort = (key: keyof PaymentOption) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedPaymentOptions = useMemo(() => {
        let sortableItems = [...paymentOptions];
        if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
        }
        return sortableItems;
    }, [paymentOptions, sortConfig]);

    if (!isClient || isLoadingInitial) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
            </div>
        );
    }
  
  return (
    <div className="space-y-3">
        <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-3 h-9"><TabsTrigger value="Cash">Cash</TabsTrigger><TabsTrigger value="Online">Online</TabsTrigger><TabsTrigger value="RTGS">RTGS</TabsTrigger></TabsList>
        </Tabs>
        
        {paymentMethod === 'RTGS' && (
             <div className="flex items-center space-x-2 p-2">
                <button
                    type="button"
                    onClick={() => {
                        const newType = rtgsFor === 'Supplier' ? 'Outsider' : 'Supplier';
                        setRtgsFor(newType);
                        resetPaymentForm(newType === 'Outsider');
                    }}
                    className={cn(
                        "relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        rtgsFor === 'Outsider' ? 'bg-primary/20' : 'bg-secondary/20'
                    )}
                >
                    <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", rtgsFor === 'Supplier' ? 'text-primary' : 'text-muted-foreground')}>Supplier</span>
                    <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", rtgsFor === 'Outsider' ? 'text-primary' : 'text-muted-foreground')}>Outsider</span>
                    <div
                        className={cn(
                            "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                            rtgsFor === 'Supplier' ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'
                        )}
                    >
                        <div className={cn(
                            "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300",
                            rtgsFor === 'Supplier' ? 'bg-secondary' : 'bg-primary'
                        )}>
                            <span className="text-sm font-bold text-primary-foreground">For</span>
                        </div>
                    </div>
                </button>
            </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                <TabsTrigger value="history">Full History</TabsTrigger>
            </TabsList>
            <TabsContent value="processing" className="space-y-3">
                {(paymentMethod !== 'RTGS' || rtgsFor === 'Supplier') && (
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                                <div className="flex flex-1 items-center gap-2">
                                    <Label htmlFor="supplier-select" className="text-sm font-semibold whitespace-nowrap">Select Supplier:</Label>
                                    <CustomDropdown
                                        options={Array.from(customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} (${data.contact})` }))}
                                        value={selectedCustomerKey}
                                        onChange={handleCustomerSelect}
                                        placeholder="Search and select supplier..."
                                    />
                                </div>
                                {selectedCustomerKey && (
                                    <div className="flex items-center gap-2 md:border-l md:pl-2 w-full md:w-auto mt-2 md:mt-0">
                                        <div className="flex items-center gap-1 text-xs">
                                            <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                            <p className="font-bold text-destructive">{formatCurrency(customerSummaryMap.get(selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)} className="h-7 text-xs">Change Selection</Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {(selectedCustomerKey || rtgsFor === 'Outsider') && (
                    <PaymentForm
                        paymentMethod={paymentMethod} rtgsFor={rtgsFor} supplierDetails={supplierDetails} setSupplierDetails={setSupplierDetails}
                        isPayeeEditing={isPayeeEditing} setIsPayeeEditing={setIsPayeeEditing}
                        bankDetails={bankDetails} setBankDetails={setBankDetails}
                        banks={banks} bankBranches={bankBranches} paymentId={paymentId} setPaymentId={setPaymentId}
                        handlePaymentIdBlur={() => {}} rtgsSrNo={rtgsSrNo} setRtgsSrNo={setRtgsSrNo} paymentType={paymentType} setPaymentType={setPaymentType}
                        paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount} cdEnabled={cdEnabled}
                        setCdEnabled={setCdEnabled} cdPercent={cdPercent} setCdPercent={setCdPercent}
                        cdAt={cdAt} setCdAt={setCdAt} calculatedCdAmount={calculatedCdAmount} sixRNo={sixRNo}
                        setSixRNo={setSixRNo} sixRDate={sixRDate} setSixRDate={setSixRDate} utrNo={utrNo}
                        setUtrNo={setUtrNo} 
                        parchiNo={parchiNo} setParchiNo={setParchiNo}
                        rtgsQuantity={rtgsQuantity} setRtgsQuantity={setRtgsQuantity} rtgsRate={rtgsRate}
                        setRtgsRate={setRtgsRate} rtgsAmount={rtgsAmount} setRtgsAmount={setRtgsAmount}
                        processPayment={processPayment} isProcessing={isProcessing} resetPaymentForm={() => resetPaymentForm(rtgsFor === 'Outsider')}
                        editingPayment={editingPayment} setIsBankSettingsOpen={setIsBankSettingsOpen} checkNo={checkNo}
                        setCheckNo={setCheckNo}
                        calcTargetAmount={calcTargetAmount} setCalcTargetAmount={setCalcTargetAmount}
                        calcMinRate={calcMinRate} setCalcMinRate={setCalcMinRate}
                        calcMaxRate={calcMaxRate} setCalcMaxRate={setCalcMaxRate}
                        handleGeneratePaymentOptions={handleGeneratePaymentOptions}
                        paymentOptions={paymentOptions}
                        selectPaymentAmount={selectPaymentAmount}
                        requestSort={requestSort}
                        sortedPaymentOptions={sortedPaymentOptions}
                        roundFigureToggle={roundFigureToggle}
                        setRoundFigureToggle={setRoundFigureToggle}
                        bankAccounts={bankAccounts}
                        selectedAccountId={selectedAccountId}
                        setSelectedAccountId={handleSetSelectedAccount}
                        financialState={financialState}
                    />
                )}
            </TabsContent>
            <TabsContent value="history">
                 <div className="space-y-3">
                    <PaymentHistory
                        payments={paymentHistory}
                        onEdit={handleEditPayment}
                        onDelete={handleDeletePayment}
                        onShowDetails={setSelectedPaymentForDetails}
                        onPrintRtgs={setRtgsReceiptData}
                    />
                    <TransactionTable
                        suppliers={suppliers}
                        onShowDetails={setDetailsSupplierEntry}
                    />
                 </div>
            </TabsContent>
        </Tabs>
      
        <OutstandingEntriesDialog
            isOpen={isOutstandingModalOpen}
            onOpenChange={setIsOutstandingModalOpen}
            customerName={toTitleCase(customerSummaryMap.get(selectedCustomerKey || '')?.name || '')}
            entries={suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0)}
            selectedIds={selectedEntryIds}
            onSelect={handleEntrySelect}
            onSelectAll={(checked: boolean) => {
                const newSet = new Set<string>();
                const outstandingEntries = suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0);
                if(checked) outstandingEntries.forEach(e => newSet.add(e.id));
                setSelectedEntryIds(newSet);
            }}
            onConfirm={handlePaySelectedOutstanding}
            onCancel={() => { setIsOutstandingModalOpen(false); handleFullReset(); }}
        />

        <DetailsDialog 
            isOpen={!!detailsSupplierEntry}
            onOpenChange={() => setDetailsSupplierEntry(null)}
            customer={detailsSupplierEntry}
            paymentHistory={paymentsForDetailsEntry}
        />
        
        <PaymentDetailsDialog
            payment={selectedPaymentForDetails}
            suppliers={suppliers}
            onOpenChange={() => setSelectedPaymentForDetails(null)}
            onShowEntryDetails={setDetailsSupplierEntry}
        />
        
       <RTGSReceiptDialog
            payment={rtgsReceiptData}
            settings={receiptSettings}
            onOpenChange={() => setRtgsReceiptData(null)}
       />

      <BankSettingsDialog
        isOpen={isBankSettingsOpen}
        onOpenChange={setIsBankSettingsOpen}
        banks={banks}
        onAddBank={async (name: string) => { await addBank(name); toast({title: 'Bank Added', variant: 'success'}); }}
        onAddBranch={async (branch: any) => { await addBankBranch(branch); toast({title: 'Branch Added', variant: 'success'}); }}
      />
    </div>
  );
}

    

    

    



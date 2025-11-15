"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getSupplierBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getCustomerPaymentsRealtime, getReceiptSettings, getIncomeRealtime, getBankBranchesRealtime } from "@/lib/firestore";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';


export const useSupplierData = () => {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [supplierBankAccounts, setSupplierBankAccounts] = useState<BankAccount[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    
    const allExpenses = useMemo(() => [...(expenses || []), ...(paymentHistory || [])], [expenses, paymentHistory]);
    const allIncomes = useMemo(() => [...(incomes || []), ...(customerPayments || [])], [incomes, customerPayments]);
    

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        let isSubscribed = true;
        
        const unsubFunctions = [
            getSuppliersRealtime(data => { if (isSubscribed) setSuppliers(data); }, error => console.error("Suppliers fetch error:", error)),
            getPaymentsRealtime(data => { if (isSubscribed) setPaymentHistory(data); }, error => console.error("Payments fetch error:", error)),
            getCustomerPaymentsRealtime(data => { if (isSubscribed) setCustomerPayments(data); }, error => console.error("Customer Payments fetch error:", error)),
            getIncomeRealtime(data => { if (isSubscribed) setIncomes(data); }, error => console.error("Incomes fetch error:", error)),
            getExpensesRealtime(data => { if (isSubscribed) setExpenses(data); }, error => console.error("Expenses fetch error:", error)),
            getFundTransactionsRealtime(data => { if (isSubscribed) setFundTransactions(data); }, error => console.error("Fund Transactions fetch error:", error)),
            getBanksRealtime(data => { if (isSubscribed) setBanks(data); }, error => console.error("Banks fetch error:", error)),
            getBankBranchesRealtime(data => { if (isSubscribed) setBankBranches(data); }, error => console.error("Bank Branches fetch error:", error)),
            getBankAccountsRealtime(data => { if (isSubscribed) setBankAccounts(data); }, error => console.error("Bank Accounts fetch error:", error)),
            getSupplierBankAccountsRealtime(data => { if (isSubscribed) setSupplierBankAccounts(data); }, error => console.error("Supplier Bank Accounts fetch error:", error)),
        ];

        getReceiptSettings().then(settings => {
            if (isSubscribed) setReceiptSettings(settings);
        }).catch(error => {
            console.error("Receipt settings fetch error:", error);
        });

        setLoading(false);

        return () => {
            isSubscribed = false;
            unsubFunctions.forEach(unsub => unsub());
        };
    }, [isClient]);
    
    const customerSummaryMap = useMemo(() => {
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
        if (safeSuppliers.length === 0) return new Map<string, CustomerSummary>();

        const summaryList: CustomerSummary[] = [];
        const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const makeKey = (name: string, father: string, address: string) => `${normalize(name)}|${normalize(father)}|${normalize(address)}`;
        const byKey = new Map<string, CustomerSummary>();

        safeSuppliers.forEach(s => {
            const father = (s as any).fatherName || s.so || '';
            const key = makeKey(s.name || '', father, s.address || '');
            const existing = byKey.get(key);
            if (existing) {
                existing.allTransactions!.push({ ...s });
                return;
            }
            const newSummary: CustomerSummary = {
                name: s.name, so: father, address: s.address,
                contact: '', 
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                totalOutstanding: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [],
                allTransactions: [{...s}], allPayments: [], transactionsByVariety: {},
                totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalTransactions: 0, totalOutstandingTransactions: 0,
                totalBrokerage: 0, totalCd: 0,
            };
            byKey.set(key, newSummary);
            summaryList.push(newSummary);
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
    safePaymentHistory.forEach(p => {
            // NEW LOGIC: Match by Serial Number from paidFor array
            if (p.paidFor && p.paidFor.length > 0) {
                // This payment has paidFor array - match by srNo
                p.paidFor.forEach(pf => {
                    // Find which supplier has a transaction with this srNo
                    for (const summary of summaryList) {
                        const matchingTransaction = summary.allTransactions?.find(t => t.srNo === pf.srNo);
                        if (matchingTransaction) {
                            // Found the supplier with this srNo - add payment to their allPayments
                            if (!summary.allPayments!.some(existingP => existingP.id === p.id)) {
                                summary.allPayments!.push(p);
                            }
                            break; // Found match, no need to check other summaries
                        }
                    }
                });
            } else {
                // STRICT: Match payments by exact normalized name + father (+ address if provided)
                const nameNorm = normalize(p.supplierName || 'Outsider');
                const fatherNorm = normalize(p.supplierFatherName || '');
                const addrNorm = normalize((p as any).supplierAddress || '');

                let matched: CustomerSummary | null = null;
                if (addrNorm) {
                    // Try composite match first (name+father+address)
                    matched = summaryList.find(s => normalize(s.name) === nameNorm && normalize(s.so || '') === fatherNorm && normalize(s.address || '') === addrNorm) || null;
                }
                if (!matched) {
                    // Fallback to name+father exact match
                    matched = summaryList.find(s => normalize(s.name) === nameNorm && normalize(s.so || '') === fatherNorm) || null;
                }

                if (matched) {
                    matched.allPayments!.push(p);
                } else if (p.rtgsFor === 'Outsider') {
                    const newSummary: CustomerSummary = {
                        name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: (p as any).supplierAddress || '',
                        contact: '', 
                        acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
                        totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                        totalOutstanding: 0, totalCdAmount: 0,
                        paymentHistory: [], outstandingEntryIds: [],
                        allTransactions: [], allPayments: [p], transactionsByVariety: {},
                        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                        totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                        totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                        totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                        averageKartaPercentage: 0, averageLabouryRate: 0,
                        totalTransactions: 0, totalOutstandingTransactions: 0,
                        totalBrokerage: 0, totalCd: 0,
                    };
                    summaryList.push(newSummary);
                }
            }
        });

        const finalSummaryMap = new Map<string, CustomerSummary>();

        summaryList.forEach((data, index) => {
            // Use the same composite key (name|father|address) for final map to ensure proper grouping
            const uniqueKey = makeKey(data.name || '', data.so || '', data.address || '') + `_${index}`;
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');

            data.allTransactions!.forEach(transaction => {
                // DIRECT DATABASE VALUES: No calculation, just sum values directly from database
                const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
            
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                const paymentBreakdown: Array<{ paymentId: string; amount: number; cdAmount: number; receiptType?: string; date?: string }> = [];

                // Simply sum all amounts directly from database without any calculation or normalization
                paymentsForThisEntry.forEach(p => {
                    const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo);
                    if (!paidForThisDetail) return;
                
                    // Direct database value - no calculation
                    const paidAmount = Number(paidForThisDetail.amount || 0);
                    totalPaidForEntry += paidAmount;

                    let cdForThisDetail = 0;
                    if ('cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount !== undefined && paidForThisDetail.cdAmount !== null) {
                        cdForThisDetail = Number(paidForThisDetail.cdAmount || 0);
                    } else if (p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                        const totalPaidInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                        if (totalPaidInPayment > 0) {
                            const proportion = paidAmount / totalPaidInPayment;
                            cdForThisDetail = Math.round((p.cdAmount || 0) * proportion * 100) / 100;
                        }
                    }
                    totalCdForEntry += cdForThisDetail;

                    paymentBreakdown.push({
                        paymentId: p.paymentId || p.rtgsSrNo || p.id || 'N/A',
                        amount: Math.round(paidAmount * 100) / 100,
                        cdAmount: Math.round(cdForThisDetail * 100) / 100,
                        receiptType: p.receiptType,
                        date: p.date,
                    });
                });
            
                // Store direct values (round only for display precision)
                transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                (transaction as any).paymentBreakdown = paymentBreakdown;
                
                // Outstanding: Original - (Payment + CD)
                const calculatedNetAmount = (transaction.originalNetAmount || 0) - totalPaidForEntry - totalCdForEntry;
                
                // Handle very small negative amounts due to rounding - treat as zero
                if (calculatedNetAmount < 0 && Math.abs(calculatedNetAmount) <= 0.01) {
                    transaction.netAmount = 0;
                } else {
                    transaction.netAmount = Math.round(calculatedNetAmount * 100) / 100;
                }
        });
        
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + t.weight, 0);
            data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + t.kartaWeight, 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + t.netWeight, 0);
            data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + t.kartaAmount, 0);
            data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + t.labouryAmount, 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + t.kanta, 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalTransactions = data.allTransactions!.length;
        
        data.totalPaid = data.allPayments!.reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);
        data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        
        // Calculate totalOutstanding as sum of individual transaction netAmount values
        // This ensures CD fix is properly applied (each transaction's netAmount has CD fix)
        const netAmountSum = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount || 0), 0);
        
        // Calculate outstanding as sum of individual transaction netAmount (with CD fix applied)
        // This matches exactly what's shown in transaction table and negative report
        data.totalOutstanding = netAmountSum;
        
        data.totalCashPaid = data.allPayments!.filter(p => p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
        data.totalRtgsPaid = data.allPayments!.filter(p => p.receiptType !== 'Cash').reduce((sum, p) => sum + p.amount, 0);
        
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => (t.netAmount || 0) >= 1).length;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments!;

        const rateData = data.allTransactions!.reduce((acc, s) => {
            if(s.rate > 0) {
                acc.karta += s.kartaPercentage;
                acc.laboury += s.labouryRate;
                acc.count++;
            }
            return acc;
        }, { karta: 0, laboury: 0, count: 0 });

        if(rateData.count > 0) {
            data.averageKartaPercentage = rateData.karta / rateData.count;
            data.averageLabouryRate = rateData.laboury / rateData.count;
        }

            finalSummaryMap.set(uniqueKey, data);
        });

    return finalSummaryMap;
}, [suppliers, paymentHistory]);

    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        (bankAccounts || []).forEach((acc: BankAccount) => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
    
        (fundTransactions || []).forEach((t: FundTransaction) => {
            if (t.type === 'CapitalInflow') {
                if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            } else if (t.type === 'CashTransfer') {
                 if (balances.has(t.source)) balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
                if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        allIncomes.forEach((t: Income | CustomerPayment) => {
            const balanceKey = t.bankAccountId || ((t as Income).paymentMethod === 'Cash' ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
        });
        
        allExpenses.forEach((t: Expense | Payment) => {
            const balanceKey = t.bankAccountId || (('receiptType' in t && t.receiptType === 'Cash') || ('paymentMethod' in t && t.paymentMethod === 'Cash') ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
        });
        
        return { balances };
      }, [fundTransactions, allIncomes, allExpenses, bankAccounts]);


    return {
        isClient,
        loading,
        suppliers,
        paymentHistory,
        customerPayments,
        incomes,
        expenses,
        fundTransactions,
        banks,
        bankBranches,
        bankAccounts,
        supplierBankAccounts,
        receiptSettings,
        customerSummaryMap,
        financialState,
    };
};

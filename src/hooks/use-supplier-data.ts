
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getCustomerPaymentsRealtime, getReceiptSettings, getIncomeRealtime, getBankBranchesRealtime } from "@/lib/firestore";
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

        const summary = new Map<string, CustomerSummary>();

        safeSuppliers.forEach(s => {
            const groupingKey = `${toTitleCase(s.name || '')}|${toTitleCase(s.so || '')}`;

            if (!summary.has(groupingKey)) {
                summary.set(groupingKey, {
                    name: s.name, so: s.so, address: s.address,
                    contact: '', 
                    acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0,
                    totalOutstanding: 0, totalCdAmount: 0,
                    paymentHistory: [], outstandingEntryIds: [],
                    allTransactions: [], allPayments: [], transactionsByVariety: {},
                    totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                    totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                    totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                    totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                    averageKartaPercentage: 0, averageLabouryRate: 0,
                    totalTransactions: 0, totalOutstandingTransactions: 0,
                });
            }
            summary.get(groupingKey)!.allTransactions!.push({ ...s }); // Push a copy
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
        safePaymentHistory.forEach(p => {
            if(p.rtgsFor === 'Outsider') {
                const outsiderKey = `${toTitleCase(p.supplierName || 'Outsider')}|${toTitleCase(p.supplierFatherName || '')}`;
                 if (!summary.has(outsiderKey)) {
                    summary.set(outsiderKey, {
                        name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: p.supplierAddress || '',
                        contact: '', 
                        acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
                        totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0,
                        totalOutstanding: 0, totalCdAmount: 0,
                        paymentHistory: [], outstandingEntryIds: [],
                        allTransactions: [], allPayments: [], transactionsByVariety: {},
                        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                        totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                        totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                        totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                        averageKartaPercentage: 0, averageLabouryRate: 0,
                        totalTransactions: 0, totalOutstandingTransactions: 0,
                    });
                }
                summary.get(outsiderKey)!.allPayments!.push(p);

            } else {
                const supplierForPayment = safeSuppliers.find(s => s.customerId === p.customerId);
                if (supplierForPayment) {
                     const groupingKey = `${toTitleCase(supplierForPayment.name || '')}|${toTitleCase(supplierForPayment.so || '')}`;
                    if (summary.has(groupingKey)) {
                        summary.get(groupingKey)!.allPayments!.push(p);
                    }
                }
            }
        });

        summary.forEach((data, key) => {
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');

            data.allTransactions!.forEach(transaction => {
                const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
                
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;

                paymentsForThisEntry.forEach(p => {
                    const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo)!;
                    totalPaidForEntry += paidForThisDetail.amount;

                    if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                        const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
                        if(totalAmountInPayment > 0) {
                            const proportion = paidForThisDetail.amount / totalAmountInPayment;
                            totalCdForEntry += p.cdAmount * proportion;
                        }
                    }
                });
                
                transaction.netAmount = (transaction.originalNetAmount || 0) - totalPaidForEntry - totalCdForEntry;
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
            data.totalOutstanding = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount), 0);
            
            data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => (t.netAmount || 0) >= 1).length;
            data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
            data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;

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
        });

        return summary;
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
        receiptSettings,
        customerSummaryMap,
        financialState,
    };
};

const normalizeString = (str: string | undefined) => (str || '').replace(/\s+/g, '').toLowerCase();
    

    

"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getCustomerPaymentsRealtime, getReceiptSettings, getIncomeRealtime, getBankBranchesRealtime } from "@/lib/firestore";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from "@/lib/utils";


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
        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
        
        const summary = new Map<string, CustomerSummary>();

        // Step 1: Create profiles from suppliers
        safeSuppliers.forEach(s => {
            if (s.customerId && !summary.has(s.customerId)) {
                summary.set(s.customerId, {
                    name: s.name, so: s.so, address: s.address, contact: s.contact,
                    acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                    totalOutstanding: 0, totalCdAmount: 0, paymentHistory: [], outstandingEntryIds: [],
                    allTransactions: [], allPayments: [], transactionsByVariety: {},
                    totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                    totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                    totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                    totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0,
                    averageKartaPercentage: 0, averageLabouryRate: 0, totalTransactions: 0,
                    totalOutstandingTransactions: 0, totalBrokerage: 0, totalCd: 0,
                });
            }
        });
        
        // Step 2: Assign transactions and payments to profiles
        safeSuppliers.forEach(s => {
            if(s.customerId && summary.has(s.customerId)) {
                summary.get(s.customerId)!.allTransactions!.push(s);
            }
        });

        safePaymentHistory.forEach(p => {
             if (p.customerId && summary.has(p.customerId)) {
                summary.get(p.customerId)!.allPayments!.push(p);
            }
        });
        
        // Step 3: Calculate stats for each profile
        summary.forEach(data => {
            const allTransactions = data.allTransactions!;
            const allPayments = data.allPayments!;

            data.totalAmount = allTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
            data.totalOriginalAmount = allTransactions.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
            data.totalGrossWeight = allTransactions.reduce((sum, t) => sum + t.grossWeight, 0);
            data.totalTeirWeight = allTransactions.reduce((sum, t) => sum + t.teirWeight, 0);
            data.totalFinalWeight = allTransactions.reduce((sum, t) => sum + t.weight, 0);
            data.totalKartaWeight = allTransactions.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
            data.totalNetWeight = allTransactions.reduce((sum, t) => sum + t.netWeight, 0);
            data.totalKartaAmount = allTransactions.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
            data.totalLabouryAmount = allTransactions.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
            data.totalKanta = allTransactions.reduce((sum, t) => sum + t.kanta, 0);
            data.totalOtherCharges = allTransactions.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
            data.totalTransactions = allTransactions.length;

            data.totalPaid = allPayments.reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);
            data.totalCdAmount = allPayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
            data.totalCashPaid = allPayments.filter(p => p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
            data.totalRtgsPaid = allPayments.filter(p => p.receiptType !== 'Cash').reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);

            data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount!;
            
            const updatedTransactions = allTransactions.map(t => {
                 const paymentsForThisEntry = allPayments.filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
                 let totalPaidForEntry = 0;
                 paymentsForThisEntry.forEach(p => {
                     const pf = p.paidFor!.find(pf => pf.srNo === t.srNo)!;
                     totalPaidForEntry += pf.amount;
                 });
                 const newNetAmount = (t.originalNetAmount || 0) - totalPaidForEntry;
                 return { ...t, netAmount: newNetAmount };
            });

            data.allTransactions = updatedTransactions;
            data.totalOutstandingTransactions = updatedTransactions.filter(t => (t.netAmount || 0) >= 1).length;

            data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
            data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
            data.paymentHistory = allPayments;

             const varietyTally: { [key: string]: number } = {};
             data.allTransactions!.forEach(t => {
                const variety = toTitleCase(t.variety) || 'Unknown';
                varietyTally[variety] = (varietyTally[variety] || 0) + 1;
             });
             data.transactionsByVariety = varietyTally;
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

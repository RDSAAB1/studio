
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

        // Step 1: Group all transactions by a primary key (name|so)
        const groupedTransactions = new Map<string, Customer[]>();
        safeSuppliers.forEach(s => {
            const groupingKey = `${toTitleCase(s.name || '')}|${toTitleCase(s.so || '')}`;
            if (!groupedTransactions.has(groupingKey)) {
                groupedTransactions.set(groupingKey, []);
            }
            groupedTransactions.get(groupingKey)!.push(s);
        });
        
        // Step 2: Create a summary for each group
        groupedTransactions.forEach((transactions, key) => {
            const representative = transactions[0]; // Use the first entry as representative
            const allCustomerIds = new Set(transactions.map(t => t.customerId));
            const allContacts = new Set(transactions.map(t => t.contact));

            const summaryData: CustomerSummary = {
                name: representative.name,
                so: representative.so,
                address: representative.address,
                contact: Array.from(allContacts).join(', '),
                acNo: representative.acNo,
                ifscCode: representative.ifscCode,
                bank: representative.bank,
                branch: representative.branch,
                totalAmount: 0,
                totalOriginalAmount: 0,
                totalPaid: 0,
                totalOutstanding: 0,
                totalCdAmount: 0,
                paymentHistory: [],
                outstandingEntryIds: [],
                allTransactions: transactions, // All transactions for this group
                allPayments: [],
                transactionsByVariety: {},
                totalGrossWeight: 0,
                totalTeirWeight: 0,
                totalFinalWeight: 0,
                totalKartaWeight: 0,
                totalNetWeight: 0,
                totalKartaAmount: 0,
                totalLabouryAmount: 0,
                totalKanta: 0,
                totalOtherCharges: 0,
                totalDeductions: 0,
                averageRate: 0,
                averageOriginalPrice: 0,
                averageKartaPercentage: 0,
                averageLabouryRate: 0,
                totalTransactions: 0,
                totalOutstandingTransactions: 0
            };
            summary.set(key, summaryData);
        });
        
        let supplierRateSum: { [key: string]: { rate: number; karta: number; laboury: number; count: number } } = {};

        summary.forEach((data, key) => {
            data.allTransactions!.forEach(s => {
                data.totalAmount += s.amount || 0;
                data.totalOriginalAmount += s.originalNetAmount || 0;
                data.totalGrossWeight! += s.grossWeight;
                data.totalTeirWeight! += s.teirWeight;
                data.totalFinalWeight! += s.weight;
                data.totalKartaWeight! += s.kartaWeight;
                data.totalNetWeight! += s.netWeight;
                data.totalKartaAmount! += s.kartaAmount;
                data.totalLabouryAmount! += s.labouryAmount;
                data.totalKanta! += s.kanta;
                data.totalOtherCharges! += s.otherCharges || 0;
                data.totalTransactions! += 1;
        
                if (!supplierRateSum[key]) {
                    supplierRateSum[key] = { rate: 0, karta: 0, laboury: 0, count: 0 };
                }
                if (s.rate > 0) {
                    supplierRateSum[key].rate += s.rate;
                    supplierRateSum[key].karta += s.kartaPercentage;
                    supplierRateSum[key].laboury += s.labouryRate;
                    supplierRateSum[key].count++;
                }
        
                const variety = toTitleCase(s.variety) || 'Unknown';
                data.transactionsByVariety![variety] = (data.transactionsByVariety![variety] || 0) + 1;
            });
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
        safePaymentHistory.forEach(p => {
             const supplierForPayment = safeSuppliers.find(s => s.customerId === p.customerId);
            if (supplierForPayment) {
                const groupingKey = `${toTitleCase(supplierForPayment.name || '')}|${toTitleCase(supplierForPayment.so || '')}`;
                 if (summary.has(groupingKey)) {
                    const data = summary.get(groupingKey)!;
                    data.totalPaid += p.amount;
                    data.totalCdAmount! += p.cdAmount || 0;
                    data.paymentHistory.push(p);
                    data.allPayments!.push(p);
                }
            }
        });
    
        summary.forEach((data, key) => {
            data.totalDeductions = data.totalKartaAmount! + data.totalLabouryAmount! + data.totalKanta! + data.totalOtherCharges!;
            data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount!;
            data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => (t.netAmount || 0) >= 1).length;
            data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
            data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
    
            const rates = supplierRateSum[key];
            if (rates && rates.count > 0) {
                data.averageKartaPercentage = rates.karta / rates.count;
                data.averageLabouryRate = rates.laboury / rates.count;
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

    

    

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

        const profiles = new Map<string, Customer[]>();

        // Phase 1: Group by contact number
        safeSuppliers.forEach(s => {
            const key = s.contact;
            if (!profiles.has(key)) profiles.set(key, []);
            profiles.get(key)!.push(s);
        });

        // Phase 2: Merge profiles based on Name + S/O
        const mergedKeys = new Map<string, string>(); // Map from old key to new merged key
        const finalProfiles = new Map<string, Customer[]>();

        profiles.forEach((entries, contact) => {
            const representative = entries[0];
            const normalizedName = normalizeString(representative.name);
            const normalizedSo = normalizeString(representative.so);
            const mergeKey = `${normalizedName}|${normalizedSo}`;
            
            let bestMatchKey: string | null = null;
            let minDistance = Infinity;
            
            finalProfiles.forEach((_, key) => {
                 const [keyName, keySo] = key.split('|');
                 const dist = levenshteinDistance(normalizedName, keyName) + levenshteinDistance(normalizedSo, keySo);
                 if (dist < minDistance && dist < 3) {
                     minDistance = dist;
                     bestMatchKey = key;
                 }
            });

            if (bestMatchKey) {
                finalProfiles.get(bestMatchKey)!.push(...entries);
                mergedKeys.set(contact, bestMatchKey);
            } else {
                finalProfiles.set(mergeKey, entries);
                mergedKeys.set(contact, mergeKey);
            }
        });


        // Phase 3: Create summary from the final merged profiles
        const summary = new Map<string, CustomerSummary>();
        finalProfiles.forEach((entries, key) => {
            const representative = entries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]; // Most recent entry
            const allTransactions = entries;
            
             const uniquePaymentIds = new Set<string>();
            const uniquePayments: Payment[] = [];

            allTransactions.forEach(t => {
                (paymentHistory || []).forEach(p => {
                    if (p.paidFor?.some(pf => pf.srNo === t.srNo)) {
                        if (!uniquePaymentIds.has(p.id)) {
                            uniquePaymentIds.add(p.id);
                            uniquePayments.push(p);
                        }
                    }
                });
            });

            const totalPaid = uniquePayments.reduce((sum, p) => sum + p.amount, 0);
            const totalCdAmount = uniquePayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
            const totalOriginalAmount = allTransactions.reduce((sum, s) => sum + (s.originalNetAmount || 0), 0);
            
            const summaryData: CustomerSummary = {
                name: representative.name,
                contact: representative.contact,
                so: representative.so,
                address: representative.address,
                totalOriginalAmount,
                totalPaid,
                totalCdAmount,
                totalOutstanding: totalOriginalAmount - totalPaid - totalCdAmount,
                allTransactions: allTransactions,
                allPayments: uniquePayments,
                paymentHistory: uniquePayments,
                // Initialize other fields...
                 totalAmount: allTransactions.reduce((sum, s) => sum + (s.amount || 0), 0),
                 totalGrossWeight: allTransactions.reduce((sum, s) => sum + s.grossWeight, 0),
                 totalTeirWeight: allTransactions.reduce((sum, s) => sum + s.teirWeight, 0),
                 totalFinalWeight: allTransactions.reduce((sum, s) => sum + s.weight, 0),
                 totalKartaWeight: allTransactions.reduce((sum, s) => sum + s.kartaWeight, 0),
                 totalNetWeight: allTransactions.reduce((sum, s) => sum + s.netWeight, 0),
                 totalKartaAmount: allTransactions.reduce((sum, s) => sum + s.kartaAmount, 0),
                 totalLabouryAmount: allTransactions.reduce((sum, s) => sum + s.labouryAmount, 0),
                 totalKanta: allTransactions.reduce((sum, s) => sum + s.kanta, 0),
                 totalOtherCharges: allTransactions.reduce((sum, s) => sum + (s.otherCharges || 0), 0),
                 totalTransactions: allTransactions.length,
                 outstandingEntryIds: allTransactions.filter(t => (t.netAmount || 0) >= 1).map(t => t.id),
                 totalOutstandingTransactions: allTransactions.filter(t => (t.netAmount || 0) >= 1).length,
                 transactionsByVariety: allTransactions.reduce((acc, s) => {
                     const variety = toTitleCase(s.variety) || 'Unknown';
                     acc[variety] = (acc[variety] || 0) + 1;
                     return acc;
                 }, {} as {[key: string]: number}),
                 averageRate: 0, averageKartaPercentage: 0, averageLabouryRate: 0, averageOriginalPrice: 0, totalDeductions: 0,
            };
            
            const rateData = allTransactions.reduce((acc, s) => {
                if (s.rate > 0) {
                    acc.karta += s.kartaPercentage;
                    acc.laboury += s.labouryRate;
                    acc.count++;
                }
                return acc;
            }, { karta: 0, laboury: 0, count: 0 });

            if (rateData.count > 0) {
                summaryData.averageKartaPercentage = rateData.karta / rateData.count;
                summaryData.averageLabouryRate = rateData.laboury / rateData.count;
            }
            if(summaryData.totalFinalWeight! > 0) {
                summaryData.averageRate = summaryData.totalAmount / summaryData.totalFinalWeight;
            }

            summary.set(key, summaryData);
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

    
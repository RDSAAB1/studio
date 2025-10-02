
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
        const summary = new Map<string, CustomerSummary>();
        const LEVENSHTEIN_THRESHOLD = 2;

        const normalizeString = (str: string) => str.replace(/\s+/g, '').toLowerCase();

        // Step 1: Initial grouping by contact number (most reliable)
        safeSuppliers.forEach(s => {
            if (!s.contact) return;
            if (!summary.has(s.contact)) {
                summary.set(s.contact, {
                    id: s.contact, // Use contact as initial ID
                    name: s.name, contact: s.contact, so: s.so, address: s.address,
                    acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    totalAmount: 0, totalPaid: 0, totalOutstanding: 0, totalOriginalAmount: 0,
                    paymentHistory: [], outstandingEntryIds: [], allTransactions: [], allPayments: [],
                    transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, 
                    totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, 
                    totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, averageRate: 0, 
                    averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
                    averageKartaPercentage: 0, averageLabouryRate: 0, totalDeductions: 0,
                });
            }
            summary.get(s.contact)!.allTransactions!.push(s);
        });

        // Step 2: Merge profiles with same Name + S/O but different contact numbers
        const profiles = Array.from(summary.values());
        const mergedSummary = new Map<string, CustomerSummary>();

        profiles.forEach(profile => {
            const profileKey = `${normalizeString(profile.name)}|${normalizeString(profile.so || '')}`;
            
            let foundMatch = false;
            for (const [key, existingProfile] of mergedSummary.entries()) {
                const existingKey = `${normalizeString(existingProfile.name)}|${normalizeString(existingProfile.so || '')}`;
                if (existingKey === profileKey) {
                    existingProfile.allTransactions.push(...profile.allTransactions);
                    // Update contact if the new one is more recent (optional, but good practice)
                    if (new Date(profile.allTransactions[0]?.date) > new Date(existingProfile.allTransactions[0]?.date)) {
                        existingProfile.contact = profile.contact;
                    }
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                // Also check for fuzzy matches if no exact match is found
                let bestFuzzyMatch: CustomerSummary | null = null;
                let minDistance = Infinity;

                for (const existingProfile of mergedSummary.values()) {
                    const dist = levenshteinDistance(profileKey, `${normalizeString(existingProfile.name)}|${normalizeString(existingProfile.so || '')}`);
                    if (dist < minDistance && dist <= LEVENSHTEIN_THRESHOLD) {
                        minDistance = dist;
                        bestFuzzyMatch = existingProfile;
                    }
                }

                if (bestFuzzyMatch) {
                    bestFuzzyMatch.allTransactions.push(...profile.allTransactions);
                } else {
                    mergedSummary.set(profile.id, profile);
                }
            }
        });


        // Step 3: Recalculate totals for the final merged groups
        mergedSummary.forEach(data => {
            const allTransactions = data.allTransactions!;
            data.totalAmount = allTransactions.reduce((sum, s) => sum + (s.amount || 0), 0);
            data.totalOriginalAmount = allTransactions.reduce((sum, s) => sum + (s.originalNetAmount || 0), 0);
            data.totalGrossWeight = allTransactions.reduce((sum, s) => sum + s.grossWeight, 0);
            data.totalTeirWeight = allTransactions.reduce((sum, s) => sum + s.teirWeight, 0);
            data.totalFinalWeight = allTransactions.reduce((sum, s) => sum + s.weight, 0);
            data.totalKartaWeight = allTransactions.reduce((sum, s) => sum + s.kartaWeight, 0);
            data.totalNetWeight = allTransactions.reduce((sum, s) => sum + s.netWeight, 0);
            data.totalKartaAmount = allTransactions.reduce((sum, s) => sum + s.kartaAmount, 0);
            data.totalLabouryAmount = allTransactions.reduce((sum, s) => sum + s.labouryAmount, 0);
            data.totalKanta = allTransactions.reduce((sum, s) => sum + s.kanta, 0);
            data.totalOtherCharges = allTransactions.reduce((sum, s) => sum + (s.otherCharges || 0), 0);
            data.totalTransactions = allTransactions.length;
            
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

            data.paymentHistory = uniquePayments;
            data.allPayments = uniquePayments;
            data.totalPaid = uniquePayments.reduce((sum, p) => sum + p.amount, 0);
            data.totalCdAmount = uniquePayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);

            data.totalOutstanding = data.totalOriginalAmount - data.totalPaid - data.totalCdAmount;
        });

        return mergedSummary;
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

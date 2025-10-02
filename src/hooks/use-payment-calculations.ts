
"use client";

import { useMemo, useEffect } from 'react';
import { useCashDiscount } from './use-cash-discount';
import type { Customer, CustomerSummary, Payment, CustomerPayment, FundTransaction, Transaction, BankAccount, Income, Expense } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance, formatCurrency } from '@/lib/utils';

export const usePaymentCalculations = (data: any, form: any) => {
    const { suppliers, paymentHistory, bankAccounts, fundTransactions, incomes, expenses, customerPayments } = data;
    const { paymentAmount, paymentType, selectedEntryIds, paymentDate } = form; // Added paymentDate

    const selectedEntries = useMemo(() => {
        if (!suppliers || !selectedEntryIds) return [];
        return suppliers.filter((s: Customer) => selectedEntryIds.has(s.id));
    }, [suppliers, selectedEntryIds]);

    const totalOutstandingForSelected = useMemo(() => {
        return selectedEntries.reduce((acc: number, entry: Customer) => acc + (Number(entry.netAmount) || 0), 0);
    }, [selectedEntries]);
    
    const {
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent,
        cdAt, setCdAt,
        calculatedCdAmount,
    } = useCashDiscount({
        paymentAmount,
        paymentType,
        selectedEntries: selectedEntries,
        paymentHistory,
        paymentDate: paymentDate, // Pass paymentDate
    });
    
    useEffect(() => {
        form.setCalcTargetAmount(Math.round(totalOutstandingForSelected - calculatedCdAmount) > 0 ? Math.round(totalOutstandingForSelected - calculatedCdAmount) : 0);
        if (paymentType === 'Full') {
            form.setPaymentAmount(Math.round(totalOutstandingForSelected - calculatedCdAmount) > 0 ? Math.round(totalOutstandingForSelected - calculatedCdAmount) : 0);
        }
    }, [totalOutstandingForSelected, calculatedCdAmount, paymentType, form.setCalcTargetAmount, form.setPaymentAmount]);

    const allExpenses = useMemo(() => [...(expenses || []), ...(paymentHistory || [])], [expenses, paymentHistory]);
    const allIncomes = useMemo(() => [...(incomes || []), ...(customerPayments || [])], [incomes, customerPayments]);
    
    const customerSummaryMap = useMemo(() => {
        const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
        const summary = new Map<string, CustomerSummary>();
        const LEVENSHTEIN_THRESHOLD = 2;

        // Function to create a normalized key from customer data
        const createKey = (c: Customer) => `${toTitleCase(c.name)}|${toTitleCase(c.so || '')}|${c.contact}`.toLowerCase();
        
        // Function to find a similar key using Levenshtein distance
        const findBestMatchKey = (customer: Customer, existingKeys: string[]): string | null => {
            const custNameNorm = toTitleCase(customer.name).replace(/\s+/g, '').toLowerCase();
            const custSoNorm = toTitleCase(customer.so || '').replace(/\s+/g, '').toLowerCase();
            let bestMatch: string | null = null;
            let minDistance = Infinity;

            for (const key of existingKeys) {
                const [keyName, keySo] = key.split('|');
                const nameDist = levenshteinDistance(custNameNorm, keyName.replace(/\s+/g, '').toLowerCase());
                const soDist = levenshteinDistance(custSoNorm, (keySo || '').replace(/\s+/g, '').toLowerCase());
                const totalDist = nameDist + soDist;
                
                if (totalDist > 0 && totalDist < LEVENSHTEIN_THRESHOLD) {
                    if (totalDist < minDistance) {
                        minDistance = totalDist;
                        bestMatch = key;
                    }
                }
            }
            return bestMatch;
        };
        
        // Group suppliers
        safeSuppliers.forEach(s => {
            if (!s.customerId) return;
            
            // Prefer exact match on customerId first
            let groupingKey = s.customerId;
            if (!summary.has(groupingKey)) {
                // If no exact match, try to find a fuzzy match
                const bestMatchKey = findBestMatchKey(s, Array.from(summary.keys()));
                if (bestMatchKey) {
                    groupingKey = bestMatchKey;
                }
            }

            if (!summary.has(groupingKey)) {
                summary.set(groupingKey, {
                    name: s.name, contact: s.contact, so: s.so, address: s.address,
                    totalOutstanding: 0, paymentHistory: [], totalAmount: 0,
                    totalPaid: 0, outstandingEntryIds: [], acNo: s.acNo,
                    ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    allTransactions: []
                } as CustomerSummary);
            }
            const data = summary.get(groupingKey)!;
            data.allTransactions!.push(s);
        });

        // Calculate totals for each group
        summary.forEach(data => {
            let totalNet = 0;
            data.allTransactions!.forEach(s => {
                totalNet += Number(s.netAmount) || 0;
            });
            data.totalOutstanding = totalNet;

            const customerIdsInGroup = new Set(data.allTransactions!.map(t => t.customerId));
            const relevantPayments = (paymentHistory || []).filter((p: Payment) => customerIdsInGroup.has(p.customerId));
            data.paymentHistory = relevantPayments;
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
        customerSummaryMap,
        financialState,
        selectedEntries, // Expose for use in payment logic
        totalOutstandingForSelected, // Expose for use in payment logic
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent,
        cdAt, setCdAt,
        calculatedCdAmount
    };
};


"use client";

import { useMemo, useEffect } from 'react';
import { useCashDiscount } from './use-cash-discount';
import type { Customer, CustomerSummary, Payment, CustomerPayment, FundTransaction, Transaction, BankAccount, Income, Expense } from "@/lib/definitions";
import { toTitleCase } from '@/lib/utils';

export const usePaymentCalculations = (data: any, form: any) => {
    const { suppliers, paymentHistory, bankAccounts, fundTransactions, incomes, expenses, customerPayments } = data;
    const { paymentAmount, paymentType, selectedEntryIds } = form;

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
        selectedEntries: selectedEntries, // Pass the locally computed selectedEntries
        paymentHistory,
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

    
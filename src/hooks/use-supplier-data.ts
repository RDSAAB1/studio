
"use client";

import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getCustomerPaymentsRealtime, getReceiptSettings, getIncomeRealtime } from "@/lib/firestore";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings } from "@/lib/definitions";

export const useSupplierData = () => {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        let isSubscribed = true;
        setLoading(true);

        const unsubFunctions = [
            getSuppliersRealtime(data => isSubscribed && setSuppliers(data), error => console.error("Suppliers fetch error:", error)),
            getPaymentsRealtime(data => isSubscribed && setPaymentHistory(data), error => console.error("Payments fetch error:", error)),
            getCustomerPaymentsRealtime(data => isSubscribed && setCustomerPayments(data), error => console.error("Customer Payments fetch error:", error)),
            getIncomeRealtime(data => isSubscribed && setIncomes(data), error => console.error("Incomes fetch error:", error)),
            getExpensesRealtime(data => isSubscribed && setExpenses(data), error => console.error("Expenses fetch error:", error)),
            getFundTransactionsRealtime(data => isSubscribed && setFundTransactions(data), error => console.error("Fund Transactions fetch error:", error)),
            getBanksRealtime(data => isSubscribed && setBanks(data), error => console.error("Banks fetch error:", error)),
            getBankAccountsRealtime(data => isSubscribed && setBankAccounts(data), error => console.error("Bank Accounts fetch error:", error)),
        ];

        getReceiptSettings().then(settings => {
            if (isSubscribed) setReceiptSettings(settings);
        });

        // A simple way to set loading to false once initial data starts coming in.
        // A more robust solution might wait for all initial fetches.
        if (suppliers.length > 0) {
            setLoading(false);
        }

        return () => {
            isSubscribed = false;
            unsubFunctions.forEach(unsub => unsub());
        };
    }, [isClient]);

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
        bankAccounts,
        receiptSettings
    };
};

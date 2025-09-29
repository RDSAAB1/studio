
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
        let dataLoaded = 0;
        const totalDataSources = 9;

        const handleDataLoad = () => {
            dataLoaded++;
            if (dataLoaded === totalDataSources) {
                setLoading(false);
            }
        };

        const unsubFunctions = [
            getSuppliersRealtime(data => { if (isSubscribed) { setSuppliers(data); handleDataLoad(); } }, error => { console.error("Suppliers fetch error:", error); handleDataLoad(); }),
            getPaymentsRealtime(data => { if (isSubscribed) { setPaymentHistory(data); handleDataLoad(); } }, error => { console.error("Payments fetch error:", error); handleDataLoad(); }),
            getCustomerPaymentsRealtime(data => { if (isSubscribed) { setCustomerPayments(data); handleDataLoad(); } }, error => { console.error("Customer Payments fetch error:", error); handleDataLoad(); }),
            getIncomeRealtime(data => { if (isSubscribed) { setIncomes(data); handleDataLoad(); } }, error => { console.error("Incomes fetch error:", error); handleDataLoad(); }),
            getExpensesRealtime(data => { if (isSubscribed) { setExpenses(data); handleDataLoad(); } }, error => { console.error("Expenses fetch error:", error); handleDataLoad(); }),
            getFundTransactionsRealtime(data => { if (isSubscribed) { setFundTransactions(data); handleDataLoad(); } }, error => { console.error("Fund Transactions fetch error:", error); handleDataLoad(); }),
            getBanksRealtime(data => { if (isSubscribed) { setBanks(data); handleDataLoad(); } }, error => { console.error("Banks fetch error:", error); handleDataLoad(); }),
            getBankAccountsRealtime(data => { if (isSubscribed) { setBankAccounts(data); handleDataLoad(); } }, error => { console.error("Bank Accounts fetch error:", error); handleDataLoad(); }),
        ];

        getReceiptSettings().then(settings => {
            if (isSubscribed) {
                setReceiptSettings(settings);
                handleDataLoad();
            }
        }).catch(error => {
            console.error("Receipt settings fetch error:", error);
            handleDataLoad();
        });

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

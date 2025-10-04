
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getCustomerPaymentsRealtime, getReceiptSettings, getIncomeRealtime, getBankBranchesRealtime } from "@/lib/firestore";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';

const MILL_OVERVIEW_KEY = 'mill-overview';

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
    const safeCustomerPayments = Array.isArray(customerPayments) ? customerPayments : [];

    const summary = new Map<string, CustomerSummary>();

    // Combine suppliers and payments for grouping
    const allItems = [...safeSuppliers, ...safePaymentHistory, ...safeCustomerPayments];

    allItems.forEach(item => {
        let customerId, name, so, companyName, isOutsider = false;

        if ('srNo' in item) { // It's a Customer
            customerId = item.customerId;
            name = item.name;
            so = item.so;
            companyName = item.companyName;
        } else { // It's a Payment or CustomerPayment
            customerId = item.customerId;
            name = ('supplierName' in item) ? item.supplierName : ('customerName' in item) ? item.customerName : 'Unknown';
            so = ('supplierFatherName' in item) ? item.supplierFatherName : '';
            isOutsider = ('rtgsFor' in item) && item.rtgsFor === 'Outsider';
        }

        if (!customerId && isOutsider) {
            customerId = `${normalizeString(name)}|${normalizeString(so)}`;
        }
        
        if (!customerId) return;

        if (!summary.has(customerId)) {
            summary.set(customerId, {
                name: name, so: so, companyName: companyName,
                address: 'address' in item ? item.address : '',
                contact: 'contact' in item ? item.contact : '',
                acNo: 'acNo' in item ? item.acNo : '',
                ifscCode: 'ifscCode' in item ? item.ifscCode : '',
                bank: 'bank' in item ? item.bank : '',
                branch: 'branch' in item ? item.branch : '',
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                totalOutstanding: 0, totalCdAmount: 0, totalDeductions: 0,
                paymentHistory: [], outstandingEntryIds: [],
                allTransactions: [], allPayments: [], transactionsByVariety: {},
                totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                averageRate: 0, averageOriginalPrice: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalTransactions: 0, totalOutstandingTransactions: 0,
                totalBrokerage: 0, totalCd: 0,
            });
        }
        
        const data = summary.get(customerId)!;
        if('srNo' in item) { // Is a Customer entry
            data.allTransactions!.push(item);
        } else { // Is a Payment entry
            data.allPayments!.push(item);
        }
    });

    summary.forEach((data) => {
        // First, link payments to transactions
        data.allTransactions!.forEach(t => {
            const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;
            paymentsForThisEntry.forEach(p => {
                const paidDetail = p.paidFor?.find(pf => pf.srNo === t.srNo);
                if(paidDetail) {
                    totalPaidForEntry += paidDetail.amount;
                     if(p.cdApplied && p.cdAmount) {
                         const totalAmountInPayment = p.paidFor!.reduce((sum, pf) => sum + pf.amount, 0);
                         if(totalAmountInPayment > 0) {
                            totalCdForEntry += (p.cdAmount * (paidDetail.amount / totalAmountInPayment));
                         }
                     }
                }
            });
            t.netAmount = (t.originalNetAmount || 0) - totalPaidForEntry - totalCdForEntry;
        });

        // Now calculate all summaries
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalPaid = data.allPayments!.reduce((sum, p) => sum + p.amount, 0);
        data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        data.totalOutstanding = data.allTransactions!.reduce((sum, t) => sum + (t.netAmount as number), 0);
        
        data.totalCashPaid = data.allPayments!.filter(p => p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
        data.totalRtgsPaid = data.allPayments!.filter(p => p.receiptType !== 'Cash').reduce((sum, p) => sum + p.amount, 0);
        
        // Other aggregations
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + t.weight, 0);
        data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + t.netWeight, 0);
        data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
        data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + t.kanta, 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalDeductions = data.totalKartaAmount! + data.totalLabouryAmount! + data.totalKanta! + data.totalOtherCharges!;
        data.totalTransactions = data.allTransactions!.length;
        data.totalOutstandingTransactions = data.allTransactions!.filter(t => (t.netAmount || 0) >= 1).length;
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

        data.paymentHistory = data.allPayments!;
        data.transactionsByVariety = data.allTransactions!.reduce((acc, s) => {
            const variety = toTitleCase(s.variety) || 'Unknown';
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as {[key: string]: number});
    });

     const millSummary: CustomerSummary = Array.from(summary.values()).reduce((acc, s) => {
         acc.totalOriginalAmount += s.totalOriginalAmount;
         acc.totalPaid += s.totalPaid;
         acc.totalCashPaid += s.totalCashPaid;
         acc.totalRtgsPaid += s.totalRtgsPaid;
         acc.totalCdAmount! += s.totalCdAmount!;
         acc.totalAmount += s.totalAmount;
         acc.totalGrossWeight! += s.totalGrossWeight!;
         acc.totalTeirWeight! += s.totalTeirWeight!;
         acc.totalFinalWeight! += s.totalFinalWeight!;
         acc.totalKartaWeight! += s.totalKartaWeight!;
         acc.totalNetWeight! += s.totalNetWeight!;
         acc.totalKartaAmount! += s.totalKartaAmount!;
         acc.totalLabouryAmount! += s.totalLabouryAmount!;
         acc.totalKanta! += s.totalKanta!;
         acc.totalOtherCharges! += s.totalOtherCharges!;
         return acc;
     }, {
         name: 'Mill (Total Overview)', contact: '', totalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
         totalOutstanding: 0, totalOriginalAmount: 0,
         paymentHistory: [], outstandingEntryIds: [], totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
         totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalCdAmount: 0, totalDeductions: 0,
         averageRate: 0, averageOriginalPrice: 0, totalTransactions: 0, totalOutstandingTransactions: 0, allTransactions: [], 
         allPayments: [], transactionsByVariety: {}, averageKartaPercentage: 0, averageLabouryRate: 0,
         totalBrokerage: 0, totalCd: 0,
     });
     
    millSummary.totalDeductions = millSummary.totalKartaAmount! + millSummary.totalLabouryAmount! + millSummary.totalKanta! + millSummary.totalOtherCharges!;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    millSummary.totalTransactions = safeSuppliers.length;
    millSummary.totalOutstandingTransactions = safeSuppliers.filter(c => parseFloat(String(c.netAmount)) >= 1).length;
    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
    
    const totalRateData = safeSuppliers.reduce((acc, s) => {
         if(s.rate > 0) {
             acc.karta += s.kartaPercentage;
             acc.laboury += s.labouryRate;
             acc.count++;
         }
         return acc;
     }, { karta: 0, laboury: 0, count: 0 });
    if(totalRateData.count > 0) {
         millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;
         millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;
    }
    
    millSummary.allTransactions = safeSuppliers;
    millSummary.allPayments = [...safePaymentHistory, ...safeCustomerPayments];
    millSummary.paymentHistory = [...safePaymentHistory, ...safeCustomerPayments];

    millSummary.transactionsByVariety = safeSuppliers.reduce((acc, s) => {
         const variety = toTitleCase(s.variety) || 'Unknown';
         acc[variety] = (acc[variety] || 0) + 1;
         return acc;
     }, {} as {[key: string]: number});
     
    const finalSummaryMap = new Map<string, CustomerSummary>();
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);
    summary.forEach((value, key) => finalSummaryMap.set(key, value));

    return finalSummaryMap;
}, [suppliers, paymentHistory, customerPayments]);

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
    

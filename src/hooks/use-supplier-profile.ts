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
    const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
        if (safeSuppliers.length === 0) return new Map<string, CustomerSummary>();

        const summaryList: CustomerSummary[] = [];
        const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();

        // 1. Group suppliers using fuzzy matching based on name + father name (S/O)
    safeSuppliers.forEach(s => {
            const sNameNorm = normalize(s.name || '');
            const sSoNorm = normalize(s.so || '');

            let bestMatch: CustomerSummary | null = null;
            let minDistance = 5;

            for (const existingSummary of summaryList) {
                const eNameNorm = normalize(existingSummary.name || '');
                const eSoNorm = normalize(existingSummary.so || '');

                const distance = levenshteinDistance(sNameNorm + sSoNorm, eNameNorm + eSoNorm);

                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = existingSummary;
                }
            }

            if (bestMatch) {
                bestMatch.allTransactions!.push({ ...s });
            } else {
                const newSummary: CustomerSummary = {
                    name: s.name, so: s.so, address: s.address,
                    contact: '', 
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                    totalOutstanding: 0, totalCdAmount: 0,
                    paymentHistory: [], outstandingEntryIds: [],
                    allTransactions: [{...s}], allPayments: [], transactionsByVariety: {},
                    totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                    totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                    totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                    totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0,
                    averageKartaPercentage: 0, averageLabouryRate: 0,
                    totalTransactions: 0, totalOutstandingTransactions: 0,
                    totalBrokerage: 0, totalCd: 0,
                };
                summaryList.push(newSummary);
            }
        });

        // 2. Add payments using paidFor.srNo (direct link)
    safePaymentHistory.forEach(p => {
            if (p.paidFor && p.paidFor.length > 0) {
                const srNos = p.paidFor.map(pf => pf.srNo);
                
                let matched = false;
                for (const profile of summaryList) {
                    const hasTransaction = profile.allTransactions!.some(t => srNos.includes(t.srNo));
                    if (hasTransaction) {
                        profile.allPayments!.push(p);
                        matched = true;
                        break;
                    }
                }
                
                if (!matched && p.rtgsFor === 'Outsider') {
                    const newSummary: CustomerSummary = {
                name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: p.supplierAddress || '',
                        contact: '', 
                acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                        totalOutstanding: 0, totalCdAmount: 0,
                        paymentHistory: [], outstandingEntryIds: [],
                        allTransactions: [], allPayments: [p], transactionsByVariety: {},
                        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                        totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                        totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                        totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0,
                        averageKartaPercentage: 0, averageLabouryRate: 0,
                        totalTransactions: 0, totalOutstandingTransactions: 0,
                        totalBrokerage: 0, totalCd: 0,
                    };
                    summaryList.push(newSummary);
                }
            }
        });

        const finalSummaryMap = new Map<string, CustomerSummary>();

    // 3. Calculate stats for each profile
        summaryList.forEach((data, index) => {
            const uniqueKey = data.name + (data.so || '') + index;
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');

            data.allTransactions!.forEach(transaction => {
                const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
            
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;

            paymentsForThisEntry.forEach(p => {
                const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo)!;
                // paidFor.amount already includes CD portion, so we add it directly
                totalPaidForEntry += paidForThisDetail.amount;

                // Calculate CD portion for display purposes only
                if ('cdApplied' in p && p.cdApplied && 'cdAmount' in p && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                    const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
                    if(totalAmountInPayment > 0) {
                        const proportion = paidForThisDetail.amount / totalAmountInPayment;
                        totalCdForEntry += p.cdAmount * proportion;
                    }
                }
            });
            
                // Store amounts for display (totalPaid already includes CD)
                // For display: show actual payment separately from CD
                transaction.totalPaid = totalPaidForEntry - totalCdForEntry; // Actual payment without CD
                transaction.totalCd = totalCdForEntry; // CD amount
                // Outstanding: Original - (Payment + CD) = Original - totalPaidForEntry
                transaction.netAmount = (transaction.originalNetAmount || 0) - totalPaidForEntry;
        });
        
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + t.weight, 0);
        data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + t.netWeight, 0);
        data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
        data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + t.kanta, 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalBrokerage = data.allTransactions!.reduce((sum, t) => {
            const brokerageAmount = t.brokerageAmount || 0;
            const signedBrokerage = (t.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            return sum + signedBrokerage;
        }, 0);
        data.totalTransactions = data.allTransactions!.length;
        
            data.totalPaid = data.allPayments!.reduce((sum, p) => sum + (('rtgsAmount' in p ? p.rtgsAmount : null) || p.amount || 0), 0);
            data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (('cdAmount' in p ? p.cdAmount : null) || 0), 0);
        data.totalOutstanding = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount), 0);
        
            data.totalCashPaid = data.allPayments!.filter(p => {
                const receiptType = ('receiptType' in p ? p.receiptType : '')?.toLowerCase() || ('type' in p ? (p as any).type : '')?.toLowerCase();
                return receiptType === 'cash';
            }).reduce((sum, p) => sum + p.amount, 0);
            data.totalRtgsPaid = data.allPayments!.reduce((sum, p) => {
                const receiptType = ('receiptType' in p ? p.receiptType : '')?.toLowerCase() || ('type' in p ? (p as any).type : '')?.toLowerCase();
                // Only count RTGS payments
                if (receiptType === 'rtgs') {
                    // Use rtgsAmount if available (same logic as statement), otherwise use amount
                    const rtgsAmount = ('rtgsAmount' in p ? (p as any).rtgsAmount : null);
                    return sum + (rtgsAmount !== undefined && rtgsAmount !== null ? rtgsAmount : p.amount);
                }
                return sum;
            }, 0);
        
            data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => Number(t.netAmount || 0) >= 1).length;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments!;

        const validRates = data.allTransactions!.map(t => t.rate).filter(rate => rate > 0);
        data.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        data.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;

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

        const varietyTally: { [key: string]: number } = {};
        data.allTransactions!.forEach(t => {
            const variety = toTitleCase(t.variety) || 'Unknown';
            varietyTally[variety] = (varietyTally[variety] || 0) + 1;
        });
        data.transactionsByVariety = varietyTally;

            finalSummaryMap.set(uniqueKey, data);
        });

    return finalSummaryMap;
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

        return acc;


    }, { karta: 0, laboury: 0, count: 0 });



    if(totalRateData.count > 0) {


        millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;


        millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;

    }



    finalSummaryMap.set('mill-overview', millSummary);




    return finalSummaryMap;


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





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
    const profiles: CustomerSummary[] = [];

    const normalize = (str: string) => (str || '').replace(/\s+/g, '').toLowerCase();

    // 1. Create unique profiles from suppliers
    safeSuppliers.forEach(s => {
        const sNameNorm = normalize(s.name || '');
        const sSoNorm = normalize(s.so || '');
        
        let bestMatch = profiles.find(p => {
            const pNameNorm = normalize(p.name || '');
            const pSoNorm = normalize(p.so || '');
            return levenshteinDistance(sNameNorm + sSoNorm, pNameNorm + pSoNorm) < 3;
        });

        if (!bestMatch) {
            bestMatch = {
                name: s.name, so: s.so, address: s.address,
                contact: '', // Will be aggregated later
                allTransactions: [], allPayments: [],
                // Initialize all other properties
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                totalOutstanding: 0, totalCdAmount: 0, paymentHistory: [], outstandingEntryIds: [],
                transactionsByVariety: {}, totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0,
                totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0, totalTransactions: 0,
                totalOutstandingTransactions: 0, totalBrokerage: 0, totalCd: 0,
            };
            profiles.push(bestMatch);
        }
    });

    // 2. Assign transactions to profiles
    safeSuppliers.forEach(s => {
        const sNameNorm = normalize(s.name || '');
        const sSoNorm = normalize(s.so || '');

        let bestMatch = profiles.find(p => {
            const pNameNorm = normalize(p.name || '');
            const pSoNorm = normalize(p.so || '');
            return levenshteinDistance(sNameNorm + sSoNorm, pNameNorm + pSoNorm) < 3;
        });

        if (bestMatch) {
            bestMatch.allTransactions!.push({ ...s });
        }
    });

    // 3. Assign payments to profiles
    safePaymentHistory.forEach(p => {
         if (p.rtgsFor === 'Outsider') {
            const key = `${normalize(p.supplierName || 'Outsider')}|${normalize(p.supplierFatherName || '')}`;
            let bestMatch = profiles.find(prof => `${normalize(prof.name || '')}|${normalize(prof.so || '')}` === key);

            if (!bestMatch) {
                bestMatch = {
                    name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: p.supplierAddress || '',
                    contact: '', allTransactions: [], allPayments: [],
                    acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
                    totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                    totalOutstanding: 0, totalCdAmount: 0, paymentHistory: [], outstandingEntryIds: [], transactionsByVariety: {},
                    totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
                    totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                    totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0, averageKartaPercentage: 0, averageLabouryRate: 0,
                    totalTransactions: 0, totalOutstandingTransactions: 0, totalBrokerage: 0, totalCd: 0,
                };
                profiles.push(bestMatch);
            }
            bestMatch.allPayments!.push(p);

         } else if (p.paidFor && p.paidFor.length > 0) {
             const firstSrNo = p.paidFor[0].srNo;
             const associatedSupplier = safeSuppliers.find(s => s.srNo === firstSrNo);
             if (associatedSupplier) {
                let bestMatch = profiles.find(prof => {
                    const profNameNorm = normalize(prof.name || '');
                    const profSoNorm = normalize(prof.so || '');
                    const supNameNorm = normalize(associatedSupplier.name || '');
                    const supSoNorm = normalize(associatedSupplier.so || '');
                    return levenshteinDistance(profNameNorm + profSoNorm, supNameNorm + supSoNorm) < 3;
                });
                if (bestMatch) {
                    bestMatch.allPayments!.push(p);
                }
             }
        }
    });

    // 4. Calculate stats for each profile
    profiles.forEach(data => {
        const allContacts = new Set(data.allTransactions!.map(t => t.contact));
        data.contact = Array.from(allContacts).join(', ');

        const updatedTransactions = data.allTransactions!.map(transaction => {
            const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
            
            let totalPaidForEntry = 0;
            let totalCdForEntry = 0;

            paymentsForThisEntry.forEach(p => {
                const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo)!;
                totalPaidForEntry += paidForThisDetail.amount;

                if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                    const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
                    if(totalAmountInPayment > 0) {
                        const proportion = paidForThisDetail.amount / totalAmountInPayment;
                        totalCdForEntry += p.cdAmount * proportion;
                    }
                }
            });
            
            const calculatedNetAmount = (transaction.originalNetAmount || 0) - totalPaidForEntry;
            return { ...transaction, netAmount: calculatedNetAmount, totalPaid: totalPaidForEntry - totalCdForEntry, totalCd: totalCdForEntry };
        });

        data.allTransactions = updatedTransactions;
        
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
        data.totalTransactions = data.allTransactions!.length;
        
        data.totalPaid = data.allPayments!.reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);
        data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        data.totalOutstanding = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount), 0);
        
        data.totalCashPaid = data.allPayments!.filter(p => p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
        data.totalRtgsPaid = data.allPayments!.filter(p => p.receiptType !== 'Cash').reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);

        
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => (t.netAmount || 0) >= 1).length;
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

    });

    const finalSummaryMap = new Map<string, CustomerSummary>();
    profiles.forEach((data, index) => {
        const uniqueKey = `${data.name}|${data.so || ''}|${index}`;
        finalSummaryMap.set(uniqueKey, data);
    });

    // Add Mill Overview
    const millSummary: CustomerSummary = {
        name: 'Mill (Total Overview)', contact: '', so: '', address: '',
        totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
        totalOutstanding: 0, totalCdAmount: 0,
        paymentHistory: [], outstandingEntryIds: [], 
        allTransactions: [], // This will be populated with re-calculated entries
        allPayments: [],
        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
        totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
        totalDeductions: 0, averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0, averageKartaPercentage: 0, averageLabouryRate: 0,
        totalTransactions: 0, totalOutstandingTransactions: 0,
        transactionsByVariety: {}, totalBrokerage: 0, totalCd: 0,
    };
    
    // Recalculate netAmount for all suppliers for the Mill Overview
    const allRecalculatedSuppliers = safeSuppliers.map(transaction => {
        const paymentsForThisEntry = safePaymentHistory.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
        let totalPaidForEntry = 0;
        let totalCdForEntry = 0;
        paymentsForThisEntry.forEach(p => {
            const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo)!;
            totalPaidForEntry += paidForThisDetail.amount;
            if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
                if(totalAmountInPayment > 0) {
                    const proportion = paidForThisDetail.amount / totalAmountInPayment;
                    totalCdForEntry += p.cdAmount * proportion;
                }
            }
        });
        const calculatedNetAmount = (transaction.originalNetAmount || 0) - totalPaidForEntry;
        return { ...transaction, netAmount: calculatedNetAmount, totalPaid: totalPaidForEntry - totalCdForEntry, totalCd: totalCdForEntry };
    });

    millSummary.allTransactions = allRecalculatedSuppliers;
    millSummary.allPayments = safePaymentHistory;

    // Now calculate mill summary stats based on the re-calculated data
    millSummary.totalOriginalAmount = millSummary.allTransactions.reduce((sum, t) => sum + t.originalNetAmount, 0);
    millSummary.totalPaid = millSummary.allPayments.reduce((sum, p) => sum + p.amount, 0);
    millSummary.totalCdAmount = millSummary.allPayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
    millSummary.totalOutstanding = millSummary.allTransactions.reduce((sum, t) => sum + Number(t.netAmount), 0);
    
    millSummary.totalCashPaid = millSummary.allPayments.filter(p => p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
    millSummary.totalRtgsPaid = millSummary.allPayments.filter(p => p.receiptType !== 'Cash').reduce((sum, p) => sum + (p.rtgsAmount || p.amount || 0), 0);


    millSummary.totalTransactions = millSummary.allTransactions.length;
    millSummary.totalOutstandingTransactions = millSummary.allTransactions.filter(t => Number(t.netAmount) >= 1).length;

    // Copy other aggregations from individual profiles
    Array.from(finalSummaryMap.values()).forEach(s => {
        millSummary.totalAmount += s.totalAmount;
        millSummary.totalGrossWeight! += s.totalGrossWeight!;
        millSummary.totalTeirWeight! += s.totalTeirWeight!;
        millSummary.totalFinalWeight! += s.totalFinalWeight!;
        millSummary.totalKartaWeight! += s.totalKartaWeight!;
        millSummary.totalNetWeight! += s.totalNetWeight!;
        millSummary.totalKartaAmount! += s.totalKartaAmount!;
        millSummary.totalLabouryAmount! += s.totalLabouryAmount!;
        millSummary.totalKanta! += s.totalKanta!;
        millSummary.totalOtherCharges! += s.totalOtherCharges!;
        Object.entries(s.transactionsByVariety!).forEach(([variety, count]) => {
            millSummary.transactionsByVariety![variety] = (millSummary.transactionsByVariety![variety] || 0) + count;
        });
    });

    millSummary.averageRate = millSummary.totalFinalWeight! > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight! : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight! > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight! : 0;
    
    const allValidRates = safeSuppliers.map(s => s.rate).filter(rate => rate > 0);
    millSummary.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
    millSummary.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;

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

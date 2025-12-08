"use client";

import { useState, useEffect, useMemo, startTransition } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getCustomersRealtime, getCustomerPaymentsRealtime, getBanksRealtime, getBankAccountsRealtime, getFundTransactionsRealtime, getExpensesRealtime, getReceiptSettings, getIncomeRealtime, getBankBranchesRealtime } from "@/lib/firestore";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';


export const useCustomerData = () => {
    const { toast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);
    
    const allExpenses = useMemo(() => [...(expenses || [])], [expenses]);
    const allIncomes = useMemo(() => [...(incomes || []), ...(paymentHistory || [])], [incomes, paymentHistory]);
    

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;

        let isSubscribed = true;
        let dataLoadCount = 0;
        const totalListeners = 9; // 8 realtime + 1 receipt settings
        
        const checkAllLoaded = () => {
            dataLoadCount++;
            if (dataLoadCount >= totalListeners && isSubscribed) {
                startTransition(() => {
                    setLoading(false);
                });
            }
        };
        
        const unsubFunctions = [
            getCustomersRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setCustomers(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Customers fetch error:", error);
                checkAllLoaded();
            }),
            getCustomerPaymentsRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setPaymentHistory(data as Payment[]));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Customer Payments fetch error:", error);
                checkAllLoaded();
            }),
            getIncomeRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setIncomes(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Incomes fetch error:", error);
                checkAllLoaded();
            }),
            getExpensesRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setExpenses(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Expenses fetch error:", error);
                checkAllLoaded();
            }),
            getFundTransactionsRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setFundTransactions(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Fund Transactions fetch error:", error);
                checkAllLoaded();
            }),
            getBanksRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBanks(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Banks fetch error:", error);
                checkAllLoaded();
            }),
            getBankBranchesRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBankBranches(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Bank Branches fetch error:", error);
                checkAllLoaded();
            }),
            getBankAccountsRealtime(data => { 
                if (isSubscribed) {
                    startTransition(() => setBankAccounts(data));
                    checkAllLoaded();
                }
            }, error => {
                console.error("Bank Accounts fetch error:", error);
                checkAllLoaded();
            }),
        ];

        getReceiptSettings().then(settings => {
            if (isSubscribed) {
                startTransition(() => setReceiptSettings(settings));
                checkAllLoaded();
            }
        }).catch(error => {
            console.error("Receipt settings fetch error:", error);
            checkAllLoaded();
        });

        return () => {
            isSubscribed = false;
            unsubFunctions.forEach(unsub => unsub());
        };
    }, [isClient]);
    
    const customerSummaryMap = useMemo(() => {
    const safeCustomers = Array.isArray(customers) ? customers : [];
        if (safeCustomers.length === 0) return new Map<string, CustomerSummary>();

        const summaryList: CustomerSummary[] = [];
        const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
        // For customers, use customerId as key (name|contact format)
        const makeKey = (customerId: string) => customerId || '';
        const byKey = new Map<string, CustomerSummary>();

        safeCustomers.forEach(c => {
            const key = c.customerId || makeKey(`${c.name || ''}|${c.contact || ''}`);
            const existing = byKey.get(key);
            if (existing) {
                existing.allTransactions!.push({ ...c });
                return;
            }
            const newSummary: CustomerSummary = {
                name: c.name, so: '', address: c.address,
                contact: c.contact, 
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                totalOutstanding: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [],
                allTransactions: [{...c}], allPayments: [], transactionsByVariety: {},
                totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalTransactions: 0, totalOutstandingTransactions: 0,
                totalBrokerage: 0, totalCd: 0,
            };
            byKey.set(key, newSummary);
            summaryList.push(newSummary);
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
    safePaymentHistory.forEach(p => {
            // Match by customerId from payment
            if (p.customerId) {
                const matched = summaryList.find(s => s.name === (p as any).customerName || byKey.has(p.customerId));
                if (matched) {
                    matched.allPayments!.push(p);
                } else {
                    // Create new summary for payments without matching customer entry
                    const newSummary: CustomerSummary = {
                        name: (p as any).customerName || 'Customer', so: '', address: '',
                        contact: '', 
                        totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                        totalOutstanding: 0, totalCdAmount: 0,
                        paymentHistory: [], outstandingEntryIds: [],
                        allTransactions: [], allPayments: [p], transactionsByVariety: {},
                        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                        totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                        totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                        totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                        averageKartaPercentage: 0, averageLabouryRate: 0,
                        totalTransactions: 0, totalOutstandingTransactions: 0,
                        totalBrokerage: 0, totalCd: 0,
                    };
                    summaryList.push(newSummary);
                    byKey.set(p.customerId, newSummary);
                }
            } else if (p.paidFor && p.paidFor.length > 0) {
                // Match by srNo from paidFor array
                p.paidFor.forEach(pf => {
                    for (const summary of summaryList) {
                        const matchingTransaction = summary.allTransactions?.find(t => t.srNo === pf.srNo);
                        if (matchingTransaction) {
                            if (!summary.allPayments!.some(existingP => existingP.id === p.id)) {
                                summary.allPayments!.push(p);
                            }
                            break;
                        }
                    }
                });
            }
        });

        const finalSummaryMap = new Map<string, CustomerSummary>();

        summaryList.forEach((data, index) => {
            // Use customerId as key for customers
            const uniqueKey = (data.allTransactions?.[0]?.customerId || `${data.name || ''}|${data.contact || ''}`) + `_${index}`;
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');

            data.allTransactions!.forEach(transaction => {
                // Calculate payments for this entry
                const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
            
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                const paymentBreakdown: Array<{ paymentId: string; amount: number; cdAmount: number; receiptType?: string; date?: string }> = [];

                paymentsForThisEntry.forEach(p => {
                    const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo);
                    if (!paidForThisDetail) return;
                
                    const paidAmount = Number(paidForThisDetail.amount || 0);
                    totalPaidForEntry += paidAmount;

                    let cdForThisDetail = 0;
                    if ('cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount !== undefined && paidForThisDetail.cdAmount !== null) {
                        cdForThisDetail = Number(paidForThisDetail.cdAmount || 0);
                    } else if (p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                        const totalPaidInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                        if (totalPaidInPayment > 0) {
                            const proportion = paidAmount / totalPaidInPayment;
                            cdForThisDetail = Math.round((p.cdAmount || 0) * proportion * 100) / 100;
                        }
                    }
                    totalCdForEntry += cdForThisDetail;

                    paymentBreakdown.push({
                        paymentId: p.paymentId || p.id || 'N/A',
                        amount: Math.round(paidAmount * 100) / 100,
                        cdAmount: Math.round(cdForThisDetail * 100) / 100,
                        receiptType: p.receiptType,
                        date: p.date,
                    });
                });
            
                transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                (transaction as any).paymentBreakdown = paymentBreakdown;
                
                // Check for Gov. payment extra amount
                let adjustedOriginal = transaction.originalNetAmount || transaction.netAmount || 0;
                let totalExtraAmount = 0;
                
                // Find Gov. payment for this entry
                const govPayment = paymentsForThisEntry.find(p => 
                    (p as any).receiptType === 'Gov.' && 
                    p.paidFor?.some(pf => pf.srNo === transaction.srNo)
                );
                
                if (govPayment) {
                    const paidForThisEntry = govPayment.paidFor?.find(pf => pf.srNo === transaction.srNo);
                    // IMPORTANT: Check for adjustedOriginal first (most reliable)
                    // If adjustedOriginal is available, use it directly
                    if (paidForThisEntry && paidForThisEntry.adjustedOriginal !== undefined) {
                        adjustedOriginal = paidForThisEntry.adjustedOriginal;
                        totalExtraAmount = adjustedOriginal - (transaction.originalNetAmount || transaction.netAmount || 0);
                    } else if (paidForThisEntry && paidForThisEntry.extraAmount !== undefined) {
                        // Fallback: Use extraAmount to calculate adjustedOriginal
                        // IMPORTANT: Check for extraAmount even if it's 0 (use !== undefined, not truthy check)
                        // extraAmount can be 0 if Gov. Required = Receipt Outstanding
                        totalExtraAmount = paidForThisEntry.extraAmount || 0;
                        adjustedOriginal = (transaction.originalNetAmount || transaction.netAmount || 0) + totalExtraAmount;
                    } else if (paidForThisEntry && (govPayment as any).extraAmount !== undefined) {
                        // Fallback: Check payment-level extraAmount if paidFor doesn't have it
                        totalExtraAmount = (govPayment as any).extraAmount || 0;
                        adjustedOriginal = (transaction.originalNetAmount || transaction.netAmount || 0) + totalExtraAmount;
                    }
                }
                
                // Outstanding: Adjusted Original - (Payment + CD)
                // Adjusted Original = Original + Extra Amount (from Gov. payment)
                const calculatedNetAmount = adjustedOriginal - totalPaidForEntry - totalCdForEntry;
                
                if (calculatedNetAmount < 0 && Math.abs(calculatedNetAmount) <= 0.01) {
                    transaction.netAmount = 0;
                } else {
                    transaction.netAmount = Math.round(calculatedNetAmount * 100) / 100;
                }
                
                // Store extra amount and adjusted original for reference
                (transaction as any).extraAmount = totalExtraAmount;
                (transaction as any).adjustedOriginal = adjustedOriginal;
        });
        
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || t.netAmount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + (t.grossWeight || 0), 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + (t.teirWeight || 0), 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + (t.weight || 0), 0);
            data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + (t.netWeight || 0), 0);
            data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
            data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + (t.kanta || 0), 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalTransactions = data.allTransactions!.length;
        
        data.totalPaid = data.allPayments!.reduce((sum, p) => sum + (p.amount || 0), 0);
        data.totalCdAmount = data.allPayments!.reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        
        const netAmountSum = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount || 0), 0);
        data.totalOutstanding = netAmountSum;
        
        data.totalCashPaid = data.allPayments!.filter(p => (p as any).paymentMethod === 'Cash' || p.receiptType === 'Cash').reduce((sum, p) => sum + p.amount, 0);
        data.totalRtgsPaid = data.allPayments!.filter(p => (p as any).paymentMethod !== 'Cash' && p.receiptType !== 'Cash').reduce((sum, p) => sum + p.amount, 0);
        
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => (t.netAmount || 0) >= 1).length;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments!;

        const rateData = data.allTransactions!.reduce((acc, s) => {
            if(s.rate > 0) {
                acc.karta += s.kartaPercentage || 0;
                acc.laboury += s.labouryRate || 0;
                acc.count++;
            }
            return acc;
        }, { karta: 0, laboury: 0, count: 0 });

        if(rateData.count > 0) {
            data.averageKartaPercentage = rateData.karta / rateData.count;
            data.averageLabouryRate = rateData.laboury / rateData.count;
        }

            finalSummaryMap.set(uniqueKey, data);
        });

    return finalSummaryMap;
}, [customers, paymentHistory]);

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
        suppliers: customers, // Use customers as suppliers for compatibility
        paymentHistory,
        customerPayments: paymentHistory as CustomerPayment[],
        incomes,
        expenses,
        fundTransactions,
        banks,
        bankBranches,
        bankAccounts,
        supplierBankAccounts: [], // Not used for customers
        receiptSettings,
        customerSummaryMap,
        financialState,
    };
};


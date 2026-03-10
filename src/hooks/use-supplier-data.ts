"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useGlobalData } from "@/contexts/global-data-context";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';


export const useSupplierData = () => {
    const { toast } = useToast();
    // ✅ Use global data context - NO duplicate listeners
    const globalData = useGlobalData();
    
    // Map global data to local variables for backward compatibility
    const suppliers = globalData.suppliers;
    const paymentHistory = globalData.paymentHistory;
    const customerPayments = globalData.customerPayments;
    const incomes = globalData.incomes;
    const expenses = globalData.expenses;
    const fundTransactions = globalData.fundTransactions;
    const banks = globalData.banks;
    const bankBranches = globalData.bankBranches;
    const bankAccounts = globalData.bankAccounts;
    const supplierBankAccounts = globalData.supplierBankAccounts;
    const receiptSettings = globalData.receiptSettings;
    
    const [loading, setLoading] = useState(false); // No loading needed - data is already available
    const [isClient, setIsClient] = useState(false);
    
    const allExpenses = useMemo(() => [...(expenses || []), ...(paymentHistory || [])], [expenses, paymentHistory]);
    const allIncomes = useMemo(() => [...(incomes || []), ...(customerPayments || [])], [incomes, customerPayments]);
    

    useEffect(() => {
        setIsClient(true);
        // Data is already loaded from global context, no need to wait
        setLoading(false);
    }, []);
    
    const customerSummaryMap = useMemo(() => {
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
        if (safeSuppliers.length === 0) return new Map<string, CustomerSummary>();

        const summaryList: CustomerSummary[] = [];
        const normalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const makeKey = (name: string, father: string, address: string) => `${normalize(name)}|${normalize(father)}|${normalize(address)}`;
        const byKey = new Map<string, CustomerSummary>();

        safeSuppliers.forEach(s => {
            const father = (s as any).fatherName || s.so || '';
            const key = makeKey(s.name || '', father, s.address || '');
            const existing = byKey.get(key);
            if (existing) {
                existing.allTransactions!.push({ ...s });
                return;
            }
            const newSummary: CustomerSummary = {
                name: s.name, so: father, address: s.address,
                contact: '', 
                acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                totalOutstanding: 0, totalCdAmount: 0,
                paymentHistory: [], outstandingEntryIds: [],
                allTransactions: [{...s}], allPayments: [], transactionsByVariety: {},
                totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0,
                totalKartaWeight: 0, totalNetWeight: 0, totalKartaAmount: 0,
                totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0,
                totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                averageKartaPercentage: 0, averageLabouryRate: 0,
                totalTransactions: 0, totalOutstandingTransactions: 0,
                totalBrokerage: 0, totalCd: 0,
                minRate: 0, maxRate: 0,
            };
            byKey.set(key, newSummary);
            summaryList.push(newSummary);
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
    safePaymentHistory.forEach(p => {
            // NEW LOGIC: Match by Serial Number from paidFor array
            if (p.paidFor && p.paidFor.length > 0) {
                // This payment has paidFor array - match by srNo
                p.paidFor.forEach(pf => {
                    // Find which supplier has a transaction with this srNo
                    for (const summary of summaryList) {
                        const matchingTransaction = summary.allTransactions?.find(t => t.srNo === pf.srNo);
                        if (matchingTransaction) {
                            // Found the supplier with this srNo - add payment to their allPayments
                            // Check for duplicates by ID OR Payment ID (to handle double-submission data)
                            const isDuplicate = summary.allPayments!.some(existingP => 
                                existingP.id === p.id || 
                                (p.paymentId && existingP.paymentId === p.paymentId) ||
                                ((p as any).rtgsSrNo && (existingP as any).rtgsSrNo === (p as any).rtgsSrNo)
                            );
                            
                            if (!isDuplicate) {
                                summary.allPayments!.push(p);
                            }
                            break; // Found match, no need to check other summaries
                        }
                    }
                });
            } else {
                // STRICT: Match payments by exact normalized name + father (+ address if provided)
                const nameNorm = normalize(p.supplierName || 'Outsider');
                const fatherNorm = normalize(p.supplierFatherName || '');
                const addrNorm = normalize((p as any).supplierAddress || '');

                let matched: CustomerSummary | null = null;
                if (addrNorm) {
                    // Try composite match first (name+father+address)
                    matched = summaryList.find(s => normalize(s.name) === nameNorm && normalize(s.so || '') === fatherNorm && normalize(s.address || '') === addrNorm) || null;
                }
                if (!matched) {
                    // Fallback to name+father exact match
                    matched = summaryList.find(s => normalize(s.name) === nameNorm && normalize(s.so || '') === fatherNorm) || null;
                }

                if (matched) {
                    // Prevent duplicates in fallback matching
                    // Check for duplicates by ID OR Payment ID (to handle double-submission data)
                    const isDuplicate = matched.allPayments!.some(existingP => 
                        existingP.id === p.id || 
                        (p.paymentId && existingP.paymentId === p.paymentId) ||
                        ((p as any).rtgsSrNo && (existingP as any).rtgsSrNo === (p as any).rtgsSrNo)
                    );

                    if (!isDuplicate) {
                        matched.allPayments!.push(p);
                    }
                } else if ((p as any).rtgsFor === 'Outsider') {
                    const newSummary: CustomerSummary = {
                        name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: (p as any).supplierAddress || '',
                        contact: '', 
                        acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
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
                        minRate: 0, maxRate: 0,
                    };
                    summaryList.push(newSummary);
                }
            }
        });

        const finalSummaryMap = new Map<string, CustomerSummary>();

        summaryList.forEach((data, index) => {
            // Use the same composite key (name|father|address) for final map
            const uniqueKey = makeKey(data.name || '', data.so || '', data.address || '');
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');

            data.allTransactions!.forEach(transaction => {
                const entrySrNo = String(transaction.srNo || '').trim().toLowerCase();
                const paymentsForThisEntry = data.allPayments!.filter(p => {
                    const paidForMatch = p.paidFor?.some(pf => String(pf.srNo || '').trim().toLowerCase() === entrySrNo);
                    const parchiMatch = String((p as any).parchiNo || '').trim().toLowerCase() === entrySrNo;
                    return Boolean(paidForMatch || parchiMatch);
                });
            
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                let totalGovExtraForEntry = 0;
                let totalExtraForEntry = 0;
                const paymentBreakdown: Array<{ paymentId: string; amount: number; cdAmount: number; receiptType?: string; date?: string; drCr?: string }> = [];

                // Simply sum all amounts directly from database without any calculation or normalization
                paymentsForThisEntry.forEach(p => {
                    const paidForThisDetail = p.paidFor?.find(pf => String(pf.srNo || '').trim().toLowerCase() === entrySrNo);
                    const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
                    const paidForExtraForThisEntry = Number((paidForThisDetail as any)?.extraAmount || 0);
                    const amountAbs = Math.abs(Number((p as any).amount || 0));
                    const drCrLower = String((p as any).drCr || '').trim().toLowerCase();
                    const isLedger = receiptType === 'ledger';
                    const isLedgerCredit = isLedger && (drCrLower === 'credit' || Number((p as any).amount || 0) < 0);

                    const parchiNoRaw = String((p as any).parchiNo || '').trim().toLowerCase();
                    const parchiTokens = parchiNoRaw
                        .split(/[,\s]+/g)
                        .map(t => t.trim())
                        .filter(Boolean);
                    const parchiMatch = parchiTokens.includes(entrySrNo) || parchiNoRaw === entrySrNo;

                    // Legacy/unlinked ledger payments: paidFor empty but parchiNo has SR# list.
                    // Ledger concept: Debit = payment (Paid/Expense), Credit = charge (Extra/Income).
                    if (isLedger && !paidForThisDetail && parchiMatch && amountAbs > 0) {
                        const share =
                            parchiTokens.length > 0 ? Math.round((amountAbs / parchiTokens.length) * 100) / 100 : amountAbs;
                        if (isLedgerCredit) totalExtraForEntry += share;
                        else totalPaidForEntry += share;
                        paymentBreakdown.push({
                            paymentId: p.paymentId || p.rtgsSrNo || p.id || 'N/A',
                            amount: share,
                            cdAmount: 0,
                            receiptType: p.receiptType,
                            date: p.date,
                            drCr: (p as any).drCr,
                        });
                        return;
                    }

                    // Online payment-level extra (when not stored per paidFor)
                    const paymentLevelExtraRawFromFields =
                        (Number((p as any).extraAmount) || 0) + (Number((p as any).advanceAmount) || 0);
                    const shouldAttachPaymentLevelExtra =
                        paymentLevelExtraRawFromFields !== 0 &&
                        receiptType === 'online' &&
                        parchiMatch &&
                        paidForExtraForThisEntry === 0;

                    if (shouldAttachPaymentLevelExtra) {
                        totalExtraForEntry += paymentLevelExtraRawFromFields;
                    }

                    if (!paidForThisDetail) return;
                
                    // Direct database value - no calculation
                    const paidAmount = Number(paidForThisDetail.amount || 0);
                    // Ledger: Debit = payment => paid; Credit = charge => extra (amount side)
                    if (receiptType === 'ledger' && isLedgerCredit) {
                        totalExtraForEntry += paidAmount;
                    } else {
                        totalPaidForEntry += paidAmount;
                    }

                    if (paidForExtraForThisEntry > 0) {
                        totalGovExtraForEntry += paidForExtraForThisEntry;
                    } else if ((p as any).govExtraAmount && Number((p as any).govExtraAmount) > 0 && p.paidFor && p.paidFor.length > 0) {
                        const totalPaidInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                        if (totalPaidInPayment > 0) {
                            const proportion = paidAmount / totalPaidInPayment;
                            totalGovExtraForEntry += Number((p as any).govExtraAmount) * proportion;
                        }
                    }

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
                        paymentId: p.paymentId || p.rtgsSrNo || p.id || 'N/A',
                        amount: Math.round(paidAmount * 100) / 100,
                        cdAmount: Math.round(cdForThisDetail * 100) / 100,
                        receiptType: p.receiptType,
                        date: p.date,
                        drCr: (p as any).drCr,
                    });
                });

                totalExtraForEntry += totalGovExtraForEntry;
            
                // Store direct values (round only for display precision)
                transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                (transaction as any).paymentBreakdown = paymentBreakdown;
                
                const baseOutstanding = Number(transaction.originalNetAmount || 0);
                const totalPayableAmount = baseOutstanding + totalExtraForEntry;
                const calculatedNetAmount = totalPayableAmount - totalPaidForEntry - totalCdForEntry;
                
                // Handle very small negative amounts due to rounding - treat as zero
                if (calculatedNetAmount < 0 && Math.abs(calculatedNetAmount) <= 0.01) {
                    transaction.netAmount = 0;
                } else {
                    transaction.netAmount = Math.round(calculatedNetAmount * 100) / 100;
                }

                (transaction as any).outstandingForEntry = Number(transaction.netAmount || 0);
                (transaction as any).totalGovExtraForEntry = Math.round(totalGovExtraForEntry * 100) / 100;
                (transaction as any).totalExtraForEntry = Math.round(totalExtraForEntry * 100) / 100;
        });
        
        data.totalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.amount || 0), 0);
        data.totalOriginalAmount = data.allTransactions!.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
        data.totalGrossWeight = data.allTransactions!.reduce((sum, t) => sum + t.grossWeight, 0);
        data.totalTeirWeight = data.allTransactions!.reduce((sum, t) => sum + t.teirWeight, 0);
        data.totalFinalWeight = data.allTransactions!.reduce((sum, t) => sum + t.weight, 0);
            data.totalKartaWeight = data.allTransactions!.reduce((sum, t) => sum + t.kartaWeight, 0);
        data.totalNetWeight = data.allTransactions!.reduce((sum, t) => sum + t.netWeight, 0);
            data.totalKartaAmount = data.allTransactions!.reduce((sum, t) => sum + t.kartaAmount, 0);
            data.totalLabouryAmount = data.allTransactions!.reduce((sum, t) => sum + t.labouryAmount, 0);
        data.totalKanta = data.allTransactions!.reduce((sum, t) => sum + t.kanta, 0);
        data.totalOtherCharges = data.allTransactions!.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
        data.totalTransactions = data.allTransactions!.length;
        
        data.totalPaid = data.allTransactions!.reduce((sum, t) => sum + Number((t as any).totalPaid || 0), 0);
        data.totalCdAmount = data.allTransactions!.reduce((sum, t) => sum + Number((t as any).totalCd || 0), 0);
        
        const netAmountSum = data.allTransactions!.reduce((sum, t) => sum + Number(t.netAmount || 0), 0);

        const ledgerAdjustment = (data.allPayments || []).reduce(
            (acc, p) => {
                const receiptType = ((p as any).receiptType || (p as any).type || '').toString().trim().toLowerCase();
                if (receiptType !== 'ledger') return acc;

                const amountRaw = Number((p as any).amount || 0);
                const amountAbs = Math.abs(amountRaw);
                const drCrLower = String((p as any).drCr || '').trim().toLowerCase();
                const isLedgerCredit = drCrLower === 'credit' || amountRaw < 0;
                const linkedPaid = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
                const unlinked = Math.max(0, amountAbs - linkedPaid);

                if (unlinked > 0) {
                    if (isLedgerCredit) {
                        acc.credit += unlinked;
                    } else {
                        acc.debit += unlinked;
                    }
                }

                return acc;
            },
            { debit: 0, credit: 0 }
        );

        data.totalOutstanding = Math.round((netAmountSum + ledgerAdjustment.debit - ledgerAdjustment.credit) * 100) / 100;

        data.totalCashPaid = (data.allPayments || []).reduce((sum, p) => {
            const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
            if (receiptType !== 'cash') return sum;
            if ((p as any).bankAccountId === 'Adjustment') return sum; // Adjustment: no real cash movement
            const linkedPaid = p.paidFor?.reduce((innerSum: number, pf: any) => innerSum + Number(pf.amount || 0), 0) || 0;
            return sum + linkedPaid;
        }, 0);
        data.totalRtgsPaid = (data.allPayments || []).reduce((sum, p) => {
            const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
            if (receiptType !== 'rtgs') return sum;
            if ((p as any).bankAccountId === 'Adjustment') return sum; // Adjustment: no bank movement
            const linkedPaid = p.paidFor?.reduce((innerSum: number, pf: any) => innerSum + Number(pf.amount || 0), 0) || 0;
            return sum + linkedPaid;
        }, 0);
        (data as any).totalGovExtraAmount = data.allTransactions!.reduce((sum, t) => sum + Number((t as any).totalGovExtraForEntry || 0), 0);
        data.outstandingEntryIds = (data.allTransactions || []).filter(t => Number((t as any).outstandingForEntry || t.netAmount || 0) > 0).map(t => String(t.srNo || '')).filter(Boolean);
        
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => Number(t.netAmount || 0) >= 1).length;
        data.averageRate = data.totalFinalWeight! > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = data.totalNetWeight! > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments!;

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
        supplierBankAccounts,
        receiptSettings,
        customerSummaryMap,
        financialState,
    };
};

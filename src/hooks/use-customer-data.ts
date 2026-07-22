"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useGlobalData } from "@/contexts/global-data-context";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';


export const useCustomerData = () => {
    const { toast } = useToast();
    // ✅ Use global data context - NO duplicate listeners
    const globalData = useGlobalData();
    
    // Map global data to local variables for backward compatibility
    // For customers, suppliers = customers, paymentHistory = customerPayments
    const suppliers = globalData.customers; // Customers are treated as suppliers in payment context
    const paymentHistory = globalData.customerPayments as any as Payment[]; // Customer payments as Payment[]
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
    
    const allExpenses = useMemo(() => [...(expenses || [])], [expenses]);
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

        // Build srNo → summary index for O(1) payment matching
        const srNoToSummary = new Map<string, CustomerSummary>();
        for (const summary of summaryList) {
            for (const t of (summary.allTransactions || [])) {
                const sr = String(t.srNo || '').trim().toLowerCase();
                if (sr) srNoToSummary.set(sr, summary);
            }
        }

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
        for (const p of safePaymentHistory) {
            // FAST PATH 1: Match by paidFor srNo — O(1) map lookup per entry
            if (p.paidFor && p.paidFor.length > 0) {
                for (const pf of p.paidFor) {
                    const sr = String(pf.srNo || '').trim().toLowerCase();
                    if (sr) {
                        const found = srNoToSummary.get(sr);
                        if (found) {
                            if (!found.allPayments!.some(existingP => existingP.id === p.id)) {
                                found.allPayments!.push(p);
                            }
                            break;
                        }
                    }
                }
            } else {
                // FALLBACK: Match by exact normalized name + father (+address)
                const nameNorm = normalize(p.supplierName || 'Outsider');
                const fatherNorm = normalize(p.supplierFatherName || '');
                const addrNorm = normalize((p as any).supplierAddress || '');

                let matched: CustomerSummary | null = null;
                if (addrNorm) {
                    matched = byKey.get(`${nameNorm}|${fatherNorm}|${addrNorm}`) || null;
                }
                if (!matched) {
                    matched = byKey.get(`${nameNorm}|${fatherNorm}|`) || null;
                    if (!matched) {
                        // Last resort: linear scan
                        matched = summaryList.find(s => normalize(s.name) === nameNorm && normalize(s.so || '') === fatherNorm) || null;
                    }
                }

                if (matched) {
                    const isDuplicate = matched.allPayments!.some(existingP =>
                        existingP.id === p.id ||
                        (p.paymentId && existingP.paymentId === p.paymentId) ||
                        ((p as any).rtgsSrNo && (existingP as any).rtgsSrNo === (p as any).rtgsSrNo)
                    );
                    if (!isDuplicate) matched.allPayments!.push(p);
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
                        totalBrokerage: 0, totalCd: 0, minRate: 0, maxRate: 0,
                    };
                    summaryList.push(newSummary);
                }
            }
        }

        const finalSummaryMap = new Map<string, CustomerSummary>();

        summaryList.forEach((data, index) => {
            // Use the same composite key (name|father|address) for final map to ensure proper grouping
            const uniqueKey = makeKey(data.name || '', data.so || '', data.address || '') + `_${index}`;
            const allContacts = new Set(data.allTransactions!.map(t => t.contact));
            data.contact = Array.from(allContacts).join(', ');
            const cdRate = 1;

            data.allTransactions!.forEach(transaction => {
                // DIRECT DATABASE VALUES: No calculation, just sum values directly from database
                const paymentsForThisEntry = data.allPayments!.filter(p => p.paidFor?.some(pf => pf.srNo === transaction.srNo));
            
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                let totalExtraForEntry = 0;
                let ledgerCreditForEntry = 0;
                let ledgerDebitForEntry = 0;
                const paymentBreakdown: Array<{ paymentId: string; amount: number; cdAmount: number; extraAmount?: number; receiptType?: string; date?: string; drCr?: string }> = [];

                // Simply sum all amounts directly from database without any calculation or normalization
                paymentsForThisEntry.forEach(p => {
                    const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === transaction.srNo);
                    if (!paidForThisDetail) return;
                
                    // Direct database value - no calculation
                    const paidAmount = Number(paidForThisDetail.amount || 0);
                    const paidForExtra = Number((paidForThisDetail as any).extraAmount || 0);
                    
                    const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
                    const drCrLower = String((p as any).drCr || '').trim().toLowerCase();
                    const isLedger = receiptType === 'ledger';
                    const isLedgerCredit = isLedger && (drCrLower === 'credit' || Number(p.amount || 0) < 0);

                    if (isLedger) {
                        if (isLedgerCredit) {
                            totalPaidForEntry += paidAmount;
                            ledgerCreditForEntry += paidAmount;
                        } else {
                            totalExtraForEntry += paidAmount;
                            ledgerDebitForEntry += paidAmount;
                        }
                    } else {
                        totalPaidForEntry += paidAmount;
                    }
                    totalExtraForEntry += paidForExtra;

                    let cdForThisDetail = 0;
                    if ('cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount !== undefined && paidForThisDetail.cdAmount !== null) {
                        cdForThisDetail = Number(paidForThisDetail.cdAmount || 0);
                    } else if (p.cdAmount && p.paidFor && p.paidFor.length > 0) {
                        const totalCdCapacity = p.paidFor.reduce((sum: number, pf: any) => {
                            const pfSrNo = pf.srNo ? String(pf.srNo).trim().toLowerCase() : "";
                            const pfId = pf.id ? String(pf.id).trim().toLowerCase() : "";
                            const t = data.allTransactions.find(tr => 
                                (pfSrNo !== '' && String(tr.srNo || '').trim().toLowerCase() === pfSrNo) ||
                                (pfId !== '' && String(tr.id || '').trim().toLowerCase() === pfId)
                            );
                            if (t) {
                                const orig = Number(t.originalNetAmount ?? t.netAmount ?? t.amount ?? 0);
                                return sum + Math.max(0, orig * (cdRate / 100));
                            }
                            return sum + Number(pf.amount || 0);
                        }, 0);

                        const origThis = Number(transaction.originalNetAmount ?? transaction.netAmount ?? transaction.amount ?? 0);
                        const thisCdCap = Math.max(0, origThis * (cdRate / 100));

                        if (totalCdCapacity > 0) {
                            const proportion = thisCdCap / totalCdCapacity;
                            cdForThisDetail = Math.round((p.cdAmount || 0) * proportion * 100) / 100;
                        } else {
                            const totalPaidInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalPaidInPayment > 0) {
                                const proportion = paidAmount / totalPaidInPayment;
                                cdForThisDetail = Math.round((p.cdAmount || 0) * proportion * 100) / 100;
                            }
                        }
                    }
                    totalCdForEntry += cdForThisDetail;

                    paymentBreakdown.push({
                        paymentId: p.paymentId || p.rtgsSrNo || p.id || 'N/A',
                        amount: Math.round(paidAmount * 100) / 100,
                        cdAmount: Math.round(cdForThisDetail * 100) / 100,
                        extraAmount: Math.round(paidForExtra * 100) / 100,
                        receiptType: p.receiptType,
                        date: p.date,
                        drCr: (p as any).drCr,
                    });
                });
            
                // Store direct values (round only for display precision)
                transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                (transaction as any).totalExtraForEntry = Math.round(totalExtraForEntry * 100) / 100;
                (transaction as any).ledgerCreditForEntry = Math.round(ledgerCreditForEntry * 100) / 100;
                (transaction as any).ledgerDebitForEntry = Math.round(ledgerDebitForEntry * 100) / 100;
                (transaction as any).paymentBreakdown = paymentBreakdown;
                
                // Outstanding: (Original + Advance Freight + Extras) - (Payment + CD). Advance freight and extras increase total receivable.
                if (transaction.originalNetAmount === undefined || transaction.originalNetAmount === null) {
                    transaction.originalNetAmount = Number(transaction.netAmount ?? 0);
                }
                const baseOriginal = (Number(transaction.originalNetAmount)) + (Number(transaction.advanceFreight) || 0);
                const calculatedNetAmount = baseOriginal + totalExtraForEntry - totalPaidForEntry - totalCdForEntry;
                
                // Handle very small negative amounts due to rounding - treat as zero
                if (calculatedNetAmount < 0 && Math.abs(calculatedNetAmount) <= 0.01) {
                    transaction.netAmount = 0;
                } else {
                    transaction.netAmount = Math.round(calculatedNetAmount * 100) / 100;
                }
                (transaction as any).outstandingForEntry = transaction.netAmount;
                (transaction as any).adjustedOriginal = baseOriginal + totalExtraForEntry;
        });
        
        // PERFORMANCE FIX: Merge 8 separate reduce() loops into ONE combined pass
        let totalSalesWithExtra = 0;
        let grossWeight = 0, teirWeight = 0, finalWeight = 0, kartaWeight = 0;
        let netWeight = 0, kartaAmount = 0, labouryAmount = 0, kanta = 0, otherCharges = 0;
        let totalAmount = 0;
        let rataKarta = 0, rataLaboury = 0, rataCount = 0;

        for (const t of (data.allTransactions || [])) {
            totalSalesWithExtra += (Number(t.originalNetAmount ?? t.netAmount ?? 0) || 0) +
                (Number((t as any).advanceFreight) || 0) + (Number((t as any).totalExtraForEntry) || 0);

            grossWeight += t.grossWeight || 0;
            teirWeight += t.teirWeight || 0;
            finalWeight += t.weight || 0;
            kartaWeight += t.kartaWeight || 0;
            netWeight += t.netWeight || 0;
            kartaAmount += t.kartaAmount || 0;
            labouryAmount += t.labouryAmount || 0;
            kanta += t.kanta || 0;
            otherCharges += t.otherCharges || 0;

            const amt = Number(t.amount) || 0;
            if (amt > 0) {
                totalAmount += amt;
            } else {
                const rate = String((t as any).variety || '').toLowerCase() === 'rice bran' && (Number((t as any).calculatedRate) || 0) > 0
                    ? Number((t as any).calculatedRate) || 0
                    : Number(t.rate) || 0;
                totalAmount += Math.round(rate * (Number(t.weight) || 0) * 100) / 100;
            }

            if (t.rate > 0) {
                rataKarta += t.kartaPercentage || 0;
                rataLaboury += t.labouryRate || 0;
                rataCount++;
            }
        }

        // Aggregate payments in one pass
        let totalPaymentsAmt = 0, totalCdsAmt = 0, totalChargesAmt = 0;
        let totalCashPaid = 0, totalRtgsPaid = 0;
        let ledgerCreditAmount = 0, ledgerDebitAmount = 0;

        for (const p of (data.allPayments || [])) {
            const receiptType = ((p as any).receiptType || (p as any).type || '').toString().trim().toLowerCase();
            const amountAbs = Math.abs(Number(p.amount || 0));
            const cdAbs = Math.abs(Number(p.cdAmount || 0));

            if (receiptType === 'ledger') {
                const drCr = String((p as any).drCr || '').trim().toLowerCase();
                const isCredit = drCr === 'credit' || Number(p.amount || 0) < 0;
                if (isCredit) {
                    totalPaymentsAmt += amountAbs;
                    ledgerCreditAmount += amountAbs;
                } else {
                    totalChargesAmt += amountAbs;
                    ledgerDebitAmount += amountAbs;
                }
            } else {
                totalPaymentsAmt += amountAbs;
                if (receiptType === 'cash') totalCashPaid += amountAbs;
                else totalRtgsPaid += amountAbs;
            }
            totalCdsAmt += cdAbs;
        }

        const calculatedOutstanding = totalSalesWithExtra + totalChargesAmt - totalPaymentsAmt - totalCdsAmt;
        data.totalOutstanding = Math.round(calculatedOutstanding * 100) / 100;
        data.totalOriginalAmount = totalSalesWithExtra;
        data.totalPaid = totalPaymentsAmt;
        data.totalCdAmount = totalCdsAmt;
        data.totalCashPaid = totalCashPaid;
        data.totalRtgsPaid = totalRtgsPaid;
        data.ledgerCreditAmount = ledgerCreditAmount;
        data.ledgerDebitAmount = ledgerDebitAmount;

        data.totalGrossWeight = grossWeight;
        data.totalTeirWeight = teirWeight;
        data.totalFinalWeight = finalWeight;
        data.totalKartaWeight = kartaWeight;
        data.totalNetWeight = netWeight;
        data.totalKartaAmount = kartaAmount;
        data.totalLabouryAmount = labouryAmount;
        data.totalKanta = kanta;
        data.totalOtherCharges = otherCharges;
        data.totalAmount = totalAmount;
        data.totalTransactions = (data.allTransactions || []).length;
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => Number(t.netAmount || 0) >= 1).length;
        data.averageRate = (data.totalFinalWeight ?? 0) > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
        data.averageOriginalPrice = (data.totalNetWeight ?? 0) > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
        data.paymentHistory = data.allPayments!;

        if (rataCount > 0) {
            data.averageKartaPercentage = rataKarta / rataCount;
            data.averageLabouryRate = rataLaboury / rataCount;
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
             if (balanceKey && balances.has(balanceKey)) {
                 let amount = Number(t.amount || 0);
                 const isLedger = 'receiptType' in t ? (t.receiptType as string) === 'Ledger' : ('paymentMethod' in t && (t.paymentMethod as string) === 'Ledger');
                 if (isLedger) {
                     amount = -amount;
                 }
                 balances.set(balanceKey, (balances.get(balanceKey) || 0) + amount);
             }
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



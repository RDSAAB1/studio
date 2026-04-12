"use client";

import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useGlobalData } from "@/contexts/global-data-context";
import type { Customer, Payment, Bank, BankAccount, FundTransaction, Income, Expense, CustomerPayment, ReceiptSettings, BankBranch, CustomerSummary } from "@/lib/definitions";
import { toTitleCase, levenshteinDistance } from '@/lib/utils';
import { fuzzyMatchProfiles } from '@/app/sales/supplier-profile/utils/fuzzy-matching';


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
        const smartNormalize = (str: string) => (str || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^(f:|s\/o:|d\/o:|w\/o:|c\/o:)\s*/g, '');
        const makeKey = (name: string, father: string, address: string) => `${smartNormalize(name)}|${smartNormalize(father)}|${smartNormalize(address)}`;
        const byKey = new Map<string, CustomerSummary>();
        const internalIdToSummary = new Map<string, CustomerSummary>();

        safeSuppliers.forEach(s => {
            const father = (s as any).fatherName || s.so || '';
            const currentProfile = {
                name: s.name || '',
                fatherName: father,
                address: s.address || ''
            };

            // Fuzzy matched search for existing summary
            let existing = summaryList.find(summary => 
                fuzzyMatchProfiles(
                    { name: summary.name || '', fatherName: summary.so || '', address: summary.address || '' },
                    currentProfile
                ).isMatch
            );

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
                supplierIds: [], supplierNames: [],
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
            
            summaryList.push(newSummary);
            
            // For fast lookup by exact key (optional optimization for performance)
            const key = makeKey(s.name || '', father, s.address || '');
            byKey.set(key, newSummary);
            
            if (s.id) {
                internalIdToSummary.set(String(s.id).trim().toLowerCase(), newSummary);
            }
        });

        // Collect all supplier IDs and names for each summary profile
        summaryList.forEach(summary => {
            const ids = new Set<string>();
            const names = new Set<string>();
            summary.allTransactions?.forEach(t => {
                if (t.id) ids.add(t.id);
                if (t.name) names.add(t.name);
            });
            (summary as any).supplierIds = Array.from(ids);
            (summary as any).supplierNames = Array.from(names);
        });

        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
    safePaymentHistory.forEach(p => {
            // Support JSON-stringified paidFor from local database (SQLite/IndexedDB)
            if (typeof p.paidFor === 'string') {
                try {
                    p.paidFor = JSON.parse(p.paidFor);
                } catch (e) {
                    console.error("Failed to parse paidFor string:", p.paidFor, e);
                    p.paidFor = [];
                }
            }
            // Case 1: Match by Serial Number from paidFor array
            if (p.paidFor && p.paidFor.length > 0) {
                p.paidFor.forEach(pf => {
                    const sr = String(pf.srNo || '').trim().toLowerCase();
                    for (const summary of summaryList) {
                        const matchingTransaction = summary.allTransactions?.find(t => String(t.srNo || '').trim().toLowerCase() === sr);
                        if (matchingTransaction) {
                            const isDuplicate = summary.allPayments!.some(existingP => 
                                existingP.id === p.id || (p.paymentId && existingP.paymentId === p.paymentId)
                            );
                            if (!isDuplicate) summary.allPayments!.push(p);
                            break;
                        }
                    }
                });
            } else {
                // Case 2: Fallback to parchiNo / checkNo if paidFor is empty
                const parchiNoStr = String((p as any).parchiNo || (p as any).checkNo || '').trim().toLowerCase();
                const tokens = parchiNoStr.split(/[,\s]+/g).filter(Boolean);
                if (tokens.length > 0) {
                    tokens.forEach(tk => {
                        for (const summary of summaryList) {
                            const matchingTransaction = summary.allTransactions?.find(t => String(t.srNo || '').trim().toLowerCase() === tk);
                            if (matchingTransaction) {
                                const isDuplicate = summary.allPayments!.some(existingP => 
                                    existingP.id === p.id || (p.paymentId && existingP.paymentId === p.paymentId)
                                );
                                if (!isDuplicate) summary.allPayments!.push(p);
                                break;
                            }
                        }
                    });
                }
            }

            // Case 3: Priority 1 - Match by supplierId (selectedCustomerKey)
            const supplierId = (p as any).supplierId || (p as any).customerId || '';
            let matched: CustomerSummary | null = null;
            
            if (supplierId) {
                const searchId = String(supplierId).trim().toLowerCase();
                // Try matching by supplierId directly if it exists in internalIdToSummary
                matched = internalIdToSummary.get(searchId) || null;
            }
            
            // Priority 2 - Fallback to Name+Father+Address match
            if (!matched) {
                const nameNorm = smartNormalize(p.supplierName || 'Outsider');
                const fatherNorm = smartNormalize(p.supplierFatherName || '');
                const addrNorm = smartNormalize((p as any).supplierAddress || '');
                matched = summaryList.find(s => smartNormalize(s.name) === nameNorm && smartNormalize(s.so || '') === fatherNorm && (!addrNorm || smartNormalize(s.address || '') === addrNorm)) || null;
            }

            if (matched) {
                const isDuplicate = matched.allPayments!.some(existingP => 
                    existingP.id === p.id || (p.paymentId && existingP.paymentId === p.paymentId)
                );
                if (!isDuplicate) matched.allPayments!.push(p);
            } else if ((p as any).rtgsFor === 'Outsider' || !supplierId) {
                // Handle as Outsider if no match found
                const exists = summaryList.find(s => s.name === (p.supplierName || 'Outsider') && s.so === (p.supplierFatherName || ''));
                if (exists) {
                     const isDuplicate = exists.allPayments!.some(existingP => existingP.id === p.id);
                     if (!isDuplicate) exists.allPayments!.push(p);
                } else {
                    const newSummary: CustomerSummary = {
                        name: p.supplierName || 'Outsider', so: p.supplierFatherName || '', address: (p as any).supplierAddress || '',
                        contact: '', 
                        acNo: p.bankAcNo, ifscCode: p.bankIfsc, bank: p.bankName, branch: p.bankBranch,
                        totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                        totalOutstanding: 0, totalCdAmount: 0, paymentHistory: [], outstandingEntryIds: [],
                        allTransactions: [], allPayments: [p], transactionsByVariety: {},
                        totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, 
                        totalNetWeight: 0, totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, 
                        totalOtherCharges: 0, totalDeductions: 0, averageRate: 0, averageOriginalPrice: 0,
                        averageKartaPercentage: 0, averageLabouryRate: 0, totalTransactions: 0, 
                        totalOutstandingTransactions: 0, totalBrokerage: 0, totalCd: 0, minRate: 0, maxRate: 0,
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
                const entryId = String(transaction.id || '').trim().toLowerCase();

                const paymentsForThisEntry = data.allPayments!.filter(p => {
                    const entrySrNoLower = entrySrNo;
                    const entryIdLower = entryId;
                    
                    // JSON string handling for local-first storage
                    let safePaidFor: any[] = [];
                    const pfRaw = p.paidFor as any;
                    if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
                    else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
                        try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
                    }

                    const paidForMatch = safePaidFor.some(pf => {
                        const pfSrNo = pf.srNo ? String(pf.srNo).trim().toLowerCase() : "";
                        const pfId = pf.id ? String(pf.id).trim().toLowerCase() : "";
                        const pfSupplierId = (pf as any).supplierId ? String((pf as any).supplierId).trim().toLowerCase() : "";
                        return (entrySrNoLower !== '' && pfSrNo === entrySrNoLower) || 
                               (entryIdLower !== '' && (pfId === entryIdLower || pfSupplierId === entryIdLower));
                    });

                    const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || '').trim().toLowerCase();
                    const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(s => s.trim().toLowerCase()).filter(Boolean);
                    const isParchiMatch = parchiTokens.includes(entrySrNoLower);
                    
                    return Boolean(paidForMatch || isParchiMatch);
                });
            
                let totalPaidForEntry = 0;
                let totalCdForEntry = 0;
                let totalGovExtraForEntry = 0;
                let totalExtraForEntry = 0;
                const paymentBreakdown: Array<{ paymentId: string; amount: number; cdAmount: number; receiptType?: string; date?: string; drCr?: string }> = [];

                // Simply sum all amounts directly from database without any calculation or normalization
                paymentsForThisEntry.forEach(p => {
                    const status = ((p as any).status || '').toString().trim().toLowerCase();
                    // if (status === 'pending') return; // Incllude pending RTGS for immediate balance updates

                    // Robust paidFor matching (handles JSON tokens from local-first storage)
                    let safePaidFor: any[] = [];
                    const pfRaw = p.paidFor as any;
                    if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
                    else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
                        try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
                    }

                    const entrySrNoLower = entrySrNo;
                    const entryIdLower = entryId;

                    // Detailed match for this specific bill
                    const paidForThisDetail = safePaidFor.find(pf => {
                        const pfSrNo = pf.srNo ? String(pf.srNo).trim().toLowerCase() : "";
                        const pfId = pf.id ? String(pf.id).trim().toLowerCase() : "";
                        const pfSupplierId = (pf as any).supplierId ? String((pf as any).supplierId).trim().toLowerCase() : "";
                        
                        return (entrySrNoLower !== '' && pfSrNo === entrySrNoLower) || 
                               (entryIdLower !== '' && (pfId === entryIdLower || pfSupplierId === entryIdLower));
                    });
                    
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

                    // Legacy/unlinked payments: ONLY if paidFor is completely empty and parchiNo matches.
                    // If paidFor exists but doesn't include this entry, it means this entry was NOT paid in this payment.
                    if (!paidForThisDetail && (safePaidFor.length === 0) && parchiMatch && (amountAbs > 0 || Number(p.cdAmount || 0) > 0)) {
                        // FILL-UP SPLIT: Instead of proportional share, fill entries in order (matches payment-logic.ts)
                        // This ensures UI reflection matches the intended distribution even for unlinked legacy payments
                        const parchiTokensSorted = [...parchiTokens].sort(); // Consistent order
                        const currentTokenIndex = parchiTokensSorted.indexOf(entrySrNoLower);
                        
                        if (currentTokenIndex !== -1) {
                            let tempCash = amountAbs;
                            let tempCd = Number(p.cdAmount || 0);
                            let share = 0;
                            let cdShare = 0;

                            for (let i = 0; i < parchiTokensSorted.length; i++) {
                                const token = parchiTokensSorted[i];
                                const tEntry = data.allTransactions!.find(t => String(t.srNo || '').trim().toLowerCase() === token);
                                if (!tEntry) continue;

                                const tOriginal = Number(tEntry.originalNetAmount ?? tEntry.netAmount ?? 0);
                                // For simplicity in UI hook, we use original amount as capacity for legacy unlinked payments
                                const tCapacity = Math.max(0, tOriginal);
                                
                                const tCdShare = Math.min(tempCd, tCapacity);
                                const tCashShare = Math.min(tempCash, Math.max(0, tCapacity - tCdShare));

                                if (i === currentTokenIndex) {
                                    share = tCashShare;
                                    cdShare = tCdShare;
                                    break;
                                }

                                tempCash -= tCashShare;
                                tempCd -= tCdShare;
                            }

                            if (isLedger && isLedgerCredit) {
                                totalExtraForEntry += share;
                            } else {
                                totalPaidForEntry += share;
                            }
                            
                            totalCdForEntry += cdShare;

                            paymentBreakdown.push({
                                paymentId: p.paymentId || p.rtgsSrNo || p.id || 'N/A',
                                amount: share,
                                cdAmount: cdShare,
                                receiptType: p.receiptType,
                                date: p.date,
                                drCr: (p as any).drCr,
                            });
                            return;
                        }
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
                    if (paidForThisDetail) {
                        if ('cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount !== undefined && paidForThisDetail.cdAmount !== null) {
                            cdForThisDetail = Number(paidForThisDetail.cdAmount || 0);
                        } else if (p.cdAmount && safePaidFor.length > 0) {
                            const totalPaidInPayment = safePaidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
                            if (totalPaidInPayment > 0) {
                                const proportion = Number(paidForThisDetail.amount || 0) / totalPaidInPayment;
                                cdForThisDetail = Math.round((p.cdAmount || 0) * proportion * 100) / 100;
                            }
                        }
                    } else if (parchiMatch && Number(p.cdAmount || 0) > 0) {
                        // Fallback: Proportional CD distribution by parchiNo
                        const cdTotal = Number(p.cdAmount || 0);
                        cdForThisDetail = parchiTokens.length > 0 
                            ? Math.round((cdTotal / parchiTokens.length) * 100) / 100 
                            : cdTotal;
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
            
                // FINAL CALCULATION: Apply all deductions to the original base value
                // Save original value permanently to object if not already there
                if (transaction.originalNetAmount === undefined || transaction.originalNetAmount === null) {
                    transaction.originalNetAmount = Number(transaction.netAmount || 0);
                }
                
                const baseValue = Number(transaction.originalNetAmount || 0);
                const totalPayableForEntry = baseValue + totalExtraForEntry;
                const outstandingValue = totalPayableForEntry - totalPaidForEntry - totalCdForEntry;
                
                // Enforce exact precision and zero-floor
                const finalOutstanding = Math.max(0, Math.round(outstandingValue * 100) / 100);
                
                // Update transaction properties for table rendering
                transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                (transaction as any).paymentBreakdown = paymentBreakdown;
                (transaction as any).totalExtraForEntry = Math.round(totalExtraForEntry * 100) / 100;
                (transaction as any).outstandingForEntry = finalOutstanding;
                
                // netAmount is often used as the source for Outstanding column
                transaction.netAmount = finalOutstanding;
                (transaction as any).outstandingForEntry = finalOutstanding;
                (transaction as any).totalGovExtraForEntry = Math.round(totalGovExtraForEntry * 100) / 100;
        });
        
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
        
        // Sum CD from ALL payments matched to this supplier (more robust than summing from entries)
        data.totalCdAmount = (data.allPayments || []).reduce((sum, p) => sum + Number(p.cdAmount || 0), 0);
        
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

        // 🚨 CRITICAL FIX: Outstanding must subtract CD to show 0 when fully paid
        const rawOutstanding = netAmountSum + ledgerAdjustment.debit - ledgerAdjustment.credit;
        data.totalOutstanding = Math.max(0, Math.round((rawOutstanding) * 100) / 100);

        data.totalCashPaid = (data.allPayments || []).reduce((sum, p) => {
            const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
            if (receiptType !== 'cash') return sum;
            if ((p as any).bankAccountId === 'Adjustment') return sum;
            
            // Check how much of this Cash payment is linked to THIS supplier's entries
            const linkedToThisSupplier = data.allTransactions!.reduce((acc, t) => {
                const entrySrNo = String(t.srNo || '').trim().toLowerCase();
                const pf = p.paidFor?.find(f => String(f.srNo || '').trim().toLowerCase() === entrySrNo);
                if (pf) return acc + Number(pf.amount || 0);
                
                const pNo = String((p as any).parchiNo || '').trim().toLowerCase();
                const tks = pNo.split(/[,\s]+/g).filter(Boolean);
                if (tks.includes(entrySrNo)) {
                    return acc + (tks.length > 0 ? (Math.abs(Number(p.amount || 0)) / tks.length) : Math.abs(Number(p.amount || 0)));
                }
                return acc;
            }, 0);

            return sum + (linkedToThisSupplier > 0 ? linkedToThisSupplier : (p.paidFor?.length ? 0 : Math.abs(Number(p.amount || 0))));
        }, 0);

        data.totalRtgsPaid = (data.allPayments || []).reduce((sum, p) => {
            const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
            if (receiptType !== 'rtgs') return sum;
            if ((p as any).bankAccountId === 'Adjustment') return sum;
            
            // Check how much of this RTGS payment is linked to THIS supplier's entries
            const linkedToThisSupplier = data.allTransactions!.reduce((acc, t) => {
                const entrySrNo = String(t.srNo || '').trim().toLowerCase();
                const pf = p.paidFor?.find(f => String(f.srNo || '').trim().toLowerCase() === entrySrNo);
                if (pf) return acc + Number(pf.amount || 0);
                
                const pNo = String((p as any).parchiNo || '').trim().toLowerCase();
                const tks = pNo.split(/[,\s]+/g).filter(Boolean);
                if (tks.includes(entrySrNo)) {
                    return acc + (tks.length > 0 ? (Math.abs(Number(p.amount || 0)) / tks.length) : Math.abs(Number(p.amount || 0)));
                }
                return acc;
            }, 0);

            return sum + (linkedToThisSupplier > 0 ? linkedToThisSupplier : (p.paidFor?.length ? 0 : Math.abs(Number(p.amount || 0))));
        }, 0);
        (data as any).totalGovExtraAmount = data.allTransactions!.reduce((sum, t) => sum + Number((t as any).totalGovExtraForEntry || 0), 0);
        // Total Amount (bina deduction) = same as Detail for Serial: sum of entry.amount (Rate × Final WT per entry)
        data.totalAmount = data.allTransactions!.reduce((sum, t) => {
          const amt = Number(t.amount) || 0;
          if (amt > 0) return sum + amt;
          const rate = (t as any).variety?.toLowerCase?.() === 'rice bran' && (Number((t as any).calculatedRate) || 0) > 0
            ? Number((t as any).calculatedRate) || 0
            : Number(t.rate) || 0;
          return sum + Math.round(rate * (Number(t.weight) || 0) * 100) / 100;
        }, 0);
        data.outstandingEntryIds = (data.allTransactions || []).filter(t => Number((t as any).outstandingForEntry ?? t.netAmount ?? 0) > 0).map(t => String(t.srNo || '')).filter(Boolean);
        
        data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => Number(t.netAmount ?? 0) >= 1).length;
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

    const supplierIdToKey = useMemo(() => {
        const map = new Map<string, string>();
        customerSummaryMap.forEach((summary: any, key: string) => {
            const ids = summary.supplierIds || [];
            if (Array.isArray(ids)) {
                ids.forEach(id => {
                    if (id) map.set(String(id).trim().toLowerCase(), key);
                });
            }
        });
        return map;
    }, [customerSummaryMap]);

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
            // 🚨 CRITICAL FIX: Do NOT deduct Pending RTGS from bank balance
            if ('receiptType' in t && t.receiptType === 'RTGS' && (t as any).status === 'Pending') {
                return;
            }
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
        supplierIdToKey,
        financialState,
        upsertSupplierPayment: globalData.upsertSupplierPayment,
        deleteSupplierPayment: globalData.deleteSupplierPayment,
        upsertCustomerPayment: globalData.upsertCustomerPayment,
        deleteCustomerPayment: globalData.deleteCustomerPayment,
    };
};

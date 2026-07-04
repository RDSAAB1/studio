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

        // ─────────────────────────────────────────────────────────────
        // PERFORMANCE FIX: O(n²) → O(n)
        // Strategy:
        //   1. Build summaries using EXACT key (name|father|address) — O(1) map lookup per supplier
        //   2. Only run fuzzy match as a LAST RESORT for genuinely ambiguous cases
        //   3. Cache fuzzy results to avoid repeat scans
        // ─────────────────────────────────────────────────────────────

        const smartNormalize = (str: string) =>
            (str || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^(f:|s\/o:|d\/o:|w\/o:|c\/o:)\s*/g, '');
        
        const makeKey = (name: string, father: string, address: string) =>
            `${smartNormalize(name)}|${smartNormalize(father)}|${smartNormalize(address)}`;

        // Pass 1: Build exact-key lookup map and summary list — O(n)
        const byExactKey = new Map<string, CustomerSummary>();
        // Only-name key for fallback matching (when address differs slightly)
        const byNameFatherKey = new Map<string, CustomerSummary>();
        const summaryList: CustomerSummary[] = [];
        const internalIdToSummary = new Map<string, CustomerSummary>();

        for (const s of safeSuppliers) {
            const father = (s as any).fatherName || s.so || '';
            const exactKey = makeKey(s.name || '', father, s.address || '');
            const nameFatherKey = makeKey(s.name || '', father, '');

            // Try exact key first — O(1)
            let existing = byExactKey.get(exactKey);

            // Try name+father key second (address may differ slightly) — O(1)
            if (!existing) {
                existing = byNameFatherKey.get(nameFatherKey);
            }

            // Last resort: fuzzy match — only for genuinely ambiguous entries
            // This replaces the old O(n) inner scan with a targeted fuzzy check
            if (!existing) {
                // Fuzzy check only against summaries with same normalized first-letter of name
                const nameNorm = smartNormalize(s.name || '');
                if (nameNorm) {
                    for (const summary of summaryList) {
                        const summaryNameNorm = smartNormalize(summary.name || '');
                        // Quick pre-filter: skip if first chars differ significantly
                        if (summaryNameNorm.charAt(0) !== nameNorm.charAt(0)) continue;
                        
                        const match = fuzzyMatchProfiles(
                            { name: summaryNameNorm, fatherName: smartNormalize(summary.so || ''), address: smartNormalize(summary.address || '') },
                            { name: nameNorm, fatherName: smartNormalize(father), address: smartNormalize(s.address || '') }
                        );
                        if (match.isMatch) {
                            existing = summary;
                            // Register this exact key for future O(1) lookup
                            byExactKey.set(exactKey, summary);
                            break;
                        }
                    }
                }
            }

            if (existing) {
                existing.allTransactions!.push({ ...s });
                // Also register any new exact keys for future O(1) lookups
                if (!byExactKey.has(exactKey)) byExactKey.set(exactKey, existing);
                if (!byNameFatherKey.has(nameFatherKey)) byNameFatherKey.set(nameFatherKey, existing);
            } else {
                const newSummary: CustomerSummary = {
                    name: s.name, so: father, address: s.address,
                    contact: '',
                    acNo: s.acNo, ifscCode: s.ifscCode, bank: s.bank, branch: s.branch,
                    totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
                    totalOutstanding: 0, totalCdAmount: 0,
                    paymentHistory: [], outstandingEntryIds: [],
                    supplierIds: [], supplierNames: [],
                    allTransactions: [{ ...s }], allPayments: [], transactionsByVariety: {},
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
                byExactKey.set(exactKey, newSummary);
                byNameFatherKey.set(nameFatherKey, newSummary);

                if (s.id) {
                    internalIdToSummary.set(String(s.id).trim().toLowerCase(), newSummary);
                }
            }
        }

        // Collect all supplier IDs and names for each summary profile — O(n)
        for (const summary of summaryList) {
            const ids = new Set<string>();
            const names = new Set<string>();
            if (summary.allTransactions) {
                for (const t of summary.allTransactions) {
                    if (t.id) ids.add(t.id);
                    if (t.name) names.add(t.name);
                    if (t.id) internalIdToSummary.set(String(t.id).trim().toLowerCase(), summary);
                }
            }
            (summary as any).supplierIds = Array.from(ids);
            (summary as any).supplierNames = Array.from(names);
        }

        // ─────────────────────────────────────────────────────────────
        // PERFORMANCE FIX: Build srNo → summary index ONCE — O(n)
        // Then payment matching becomes O(paidFor.length) instead of O(summaries×transactions)
        // ─────────────────────────────────────────────────────────────
        const srNoToSummary = new Map<string, CustomerSummary>();
        for (const summary of summaryList) {
            if (summary.allTransactions) {
                for (const t of summary.allTransactions) {
                    const sr = String(t.srNo || '').trim().toLowerCase();
                    if (sr) srNoToSummary.set(sr, summary);
                }
            }
        }

        // ─────────────────────────────────────────────────────────────
        // Pass 2: Assign payments to summaries — NOW O(payments × paidFor.length)
        // ─────────────────────────────────────────────────────────────
        const safePaymentHistory = Array.isArray(paymentHistory) ? paymentHistory : [];

        for (const p of safePaymentHistory) {
            // Support JSON-stringified paidFor from local database (SQLite/IndexedDB)
            if (typeof p.paidFor === 'string') {
                try {
                    p.paidFor = JSON.parse(p.paidFor);
                } catch (e) {
                    p.paidFor = [];
                }
            }

            const supplierId = (p as any).supplierId || (p as any).customerId || '';
            const isOutsider = String(supplierId).toUpperCase() === 'OUTSIDER' || (p as any).rtgsFor === 'Outsider';
            let matched: CustomerSummary | null = null;

            if (!isOutsider) {
                // ✅ FAST PATH 1: Match by paidFor srNo — O(1) map lookup per entry
                if (p.paidFor && p.paidFor.length > 0) {
                    for (const pf of p.paidFor) {
                        const sr = String(pf.srNo || '').trim().toLowerCase();
                        if (sr) {
                            const found = srNoToSummary.get(sr);
                            if (found) { matched = found; break; }
                        }
                    }
                }

                // ✅ FAST PATH 2: Match by parchiNo tokens — O(tokens) map lookups
                if (!matched) {
                    const parchiNoStr = String((p as any).parchiNo || (p as any).checkNo || '').trim().toLowerCase();
                    const tokens = parchiNoStr.split(/[,\s]+/g).filter(Boolean);
                    for (const tk of tokens) {
                        const found = srNoToSummary.get(tk);
                        if (found) { matched = found; break; }
                    }
                }

                // ✅ FAST PATH 3: Match by supplierId — O(1) map lookup
                if (!matched && supplierId) {
                    const searchId = String(supplierId).trim().toLowerCase();
                    matched = internalIdToSummary.get(searchId) || null;
                }

                // FALLBACK 4: Match by exact name+father+address key — O(1)
                if (!matched) {
                    const nameNorm = smartNormalize(p.supplierName || '');
                    if (nameNorm && nameNorm !== 'outsider') {
                        const fatherNorm = smartNormalize(p.supplierFatherName || '');
                        const addrNorm = smartNormalize((p as any).supplierAddress || '');
                        matched = byExactKey.get(`${nameNorm}|${fatherNorm}|${addrNorm}`) ||
                                  byNameFatherKey.get(`${nameNorm}|${fatherNorm}|`) || null;
                    }
                }
            }

            if (matched) {
                const isDuplicate = matched.allPayments!.some(existingP =>
                    existingP.id === p.id || (p.paymentId && existingP.paymentId === p.paymentId)
                );
                if (!isDuplicate) matched.allPayments!.push(p);
            } else {
                // Handle as Outsider (either explicitly marked or no supplier match found)
                const outsiderName = p.supplierName || 'Outsider';
                const outsiderFather = p.supplierFatherName || '';

                const exists = summaryList.find(s =>
                    (s.allTransactions?.length === 0 || !s.allTransactions) &&
                    s.name === outsiderName &&
                    s.so === outsiderFather
                );

                if (exists) {
                    const isDuplicate = exists.allPayments!.some(existingP => existingP.id === p.id);
                    if (!isDuplicate) exists.allPayments!.push(p);
                } else {
                    const newSummary: CustomerSummary = {
                        name: outsiderName, so: outsiderFather, address: (p as any).supplierAddress || '',
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
        }

        // ─────────────────────────────────────────────────────────────
        // Pass 3: Per-transaction outstanding calculation + aggregation
        // PERFORMANCE FIX: Combine 5 separate reduce() loops into 1
        // ─────────────────────────────────────────────────────────────
        const finalSummaryMap = new Map<string, CustomerSummary>();

        for (const data of summaryList) {
            const uniqueKey = makeKey(data.name || '', data.so || '', data.address || '');
            
            // Collect contacts in one pass
            const allContacts = new Set<string>();
            if (data.allTransactions) {
                for (const t of data.allTransactions) {
                    if (t.contact) allContacts.add(t.contact);
                }
            }
            data.contact = Array.from(allContacts).join(', ');

            // Process each transaction — per-entry outstanding calculation
            if (data.allTransactions) {
                for (const transaction of data.allTransactions) {
                    const entrySrNo = String(transaction.srNo || '').trim().toLowerCase();
                    const entryId = String(transaction.id || '').trim().toLowerCase();

                    const paymentsForThisEntry = (data.allPayments || []).filter(p => {
                        const entrySrNoLower = entrySrNo;
                        const entryIdLower = entryId;

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

                    for (const p of paymentsForThisEntry) {
                        let safePaidFor: any[] = [];
                        const pfRaw = p.paidFor as any;
                        if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
                        else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
                            try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
                        }

                        const entrySrNoLower = entrySrNo;
                        const entryIdLower = entryId;

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

                        // Legacy/unlinked payments: ONLY if paidFor is completely empty and parchiNo matches
                        if (!paidForThisDetail && (safePaidFor.length === 0) && parchiMatch && (amountAbs > 0 || Number(p.cdAmount || 0) > 0)) {
                            const parchiTokensSorted = [...parchiTokens].sort();
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
                                continue;
                            }
                        }

                        // Online payment-level extra
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

                        if (!paidForThisDetail) continue;

                        const paidAmount = Number(paidForThisDetail.amount || 0);
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
                    }

                    totalExtraForEntry += totalGovExtraForEntry;

                    if (transaction.originalNetAmount === undefined || transaction.originalNetAmount === null) {
                        transaction.originalNetAmount = Number(transaction.netAmount || 0);
                    }

                    const baseValue = Math.round(Number(transaction.amount || 0) - Number(transaction.labouryAmount || 0) - Number(transaction.kanta || 0) - Number(transaction.kartaAmount || 0));
                    const totalPayableForEntry = baseValue + totalExtraForEntry;
                    const outstandingValue = totalPayableForEntry - totalPaidForEntry - totalCdForEntry;

                    const finalOutstanding = Math.max(0, Math.round(outstandingValue * 100) / 100);

                    transaction.totalPaid = Math.round(totalPaidForEntry * 100) / 100;
                    transaction.totalCd = Math.round(totalCdForEntry * 100) / 100;
                    (transaction as any).paymentBreakdown = paymentBreakdown;
                    (transaction as any).totalExtraForEntry = Math.round(totalExtraForEntry * 100) / 100;
                    (transaction as any).outstandingForEntry = finalOutstanding;
                    transaction.netAmount = finalOutstanding;
                    (transaction as any).totalGovExtraForEntry = Math.round(totalGovExtraForEntry * 100) / 100;
                }
            }

            // ─────────────────────────────────────────────────────────────
            // PERFORMANCE FIX: Merge 5 separate reduce() loops into ONE combined pass
            // ─────────────────────────────────────────────────────────────
            let totalBillsWithExtra = 0;
            let grossWeight = 0, teirWeight = 0, finalWeight = 0, kartaWeight = 0;
            let netWeight = 0, kartaAmount = 0, labouryAmount = 0, kanta = 0, otherCharges = 0;
            let totalAmount = 0;
            let rataKarta = 0, rataLaboury = 0, rataCount = 0;

            for (const t of (data.allTransactions || [])) {
                const correctedBase = Math.round(
                    Number(t.amount || 0) - Number(t.labouryAmount || 0) - Number(t.kanta || 0) - Number(t.kartaAmount || 0)
                );
                totalBillsWithExtra += correctedBase + Number((t as any).totalExtraForEntry || 0);

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
                    const rate = (t as any).variety?.toLowerCase?.() === 'rice bran' && (Number((t as any).calculatedRate) || 0) > 0
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

            for (const p of (data.allPayments || [])) {
                const receiptType = ((p as any).receiptType || (p as any).type || '').toString().trim().toLowerCase();
                const amountAbs = Math.abs(Number(p.amount || 0));
                const cdAbs = Math.abs(Number(p.cdAmount || 0));

                if (receiptType === 'ledger') {
                    const drCr = String((p as any).drCr || '').trim().toLowerCase();
                    const isCredit = drCr === 'credit' || Number(p.amount || 0) < 0;
                    if (isCredit) {
                        totalChargesAmt += amountAbs;
                    } else {
                        totalPaymentsAmt += amountAbs;
                    }
                } else {
                    totalPaymentsAmt += amountAbs;
                }
                totalCdsAmt += cdAbs;

                // Cash/RTGS breakdown — per-entry linked amount
                if ((receiptType === 'cash' || receiptType === 'rtgs') && (p as any).bankAccountId !== 'Adjustment') {
                    let linkedToThis = 0;
                    const safePaidFor: any[] = Array.isArray(p.paidFor) ? p.paidFor : [];
                    for (const t of (data.allTransactions || [])) {
                        const entrySrNo = String(t.srNo || '').trim().toLowerCase();
                        const pf = safePaidFor.find((f: any) => String(f.srNo || '').trim().toLowerCase() === entrySrNo);
                        if (pf) {
                            linkedToThis += Number(pf.amount || 0);
                        } else {
                            const pNo = String((p as any).parchiNo || '').trim().toLowerCase();
                            const tks = pNo.split(/[,\s]+/g).filter(Boolean);
                            if (tks.includes(entrySrNo)) {
                                linkedToThis += tks.length > 0 ? (amountAbs / tks.length) : amountAbs;
                            }
                        }
                    }
                    const effectiveAmt = linkedToThis > 0 ? linkedToThis : (safePaidFor.length ? 0 : amountAbs);
                    if (receiptType === 'cash') totalCashPaid += effectiveAmt;
                    else totalRtgsPaid += effectiveAmt;
                }
            }

            const calculatedOutstanding = totalBillsWithExtra + totalChargesAmt - totalPaymentsAmt - totalCdsAmt;
            data.totalOutstanding = Math.round(calculatedOutstanding * 100) / 100;
            data.totalOriginalAmount = totalBillsWithExtra;
            data.totalPaid = totalPaymentsAmt;
            data.totalCdAmount = totalCdsAmt;
            data.totalCashPaid = totalCashPaid;
            data.totalRtgsPaid = totalRtgsPaid;

            // Set aggregated weight/amount fields from combined loop
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
            (data as any).totalGovExtraAmount = (data.allTransactions || []).reduce((sum, t) => sum + Number((t as any).totalGovExtraForEntry || 0), 0);

            data.outstandingEntryIds = (data.allTransactions || [])
                .filter(t => Number((t as any).outstandingForEntry ?? t.netAmount ?? 0) > 0)
                .map(t => String(t.srNo || '')).filter(Boolean);
            data.totalOutstandingTransactions = (data.allTransactions || []).filter(t => Number(t.netAmount ?? 0) >= 1).length;

            data.averageRate = (data.totalFinalWeight ?? 0) > 0 ? data.totalAmount / data.totalFinalWeight! : 0;
            data.averageOriginalPrice = (data.totalNetWeight ?? 0) > 0 ? data.totalOriginalAmount / data.totalNetWeight! : 0;
            data.paymentHistory = data.allPayments!;

            if (rataCount > 0) {
                data.averageKartaPercentage = rataKarta / rataCount;
                data.averageLabouryRate = rataLaboury / rataCount;
            }

            finalSummaryMap.set(uniqueKey, data);
        }

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
            if (balanceKey && balances.has(balanceKey)) {
                let amount = Number(t.amount || 0);
                const isLedger = 'receiptType' in t ? (t.receiptType as string) === 'Ledger' : ('paymentMethod' in t && (t.paymentMethod as string) === 'Ledger');
                if (isLedger) {
                    amount = -amount;
                }
                balances.set(balanceKey, Math.round(((balances.get(balanceKey) || 0) + amount) * 100) / 100);
            }
        });
        
        allExpenses.forEach((t: Expense | Payment) => {
            const balanceKey = t.bankAccountId || (('receiptType' in t && t.receiptType === 'Cash') || ('paymentMethod' in t && t.paymentMethod === 'Cash') ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                const amount = Number(t.amount || 0);
                balances.set(balanceKey, Math.round(((balances.get(balanceKey) || 0) - amount) * 100) / 100);
            }
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

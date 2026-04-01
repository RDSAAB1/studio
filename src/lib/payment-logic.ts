"use client";

import { runTransaction, doc, collection, getDoc, Timestamp, writeBatch, query, where, getDocs, increment, deleteDoc, type DocumentSnapshot, type DocumentReference } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';
import type { Payment, Customer, PaidFor, Expense } from '@/lib/definitions';
import { getTenantCollectionPath } from '@/lib/tenancy';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { db } from '@/lib/database';
import { notifySyncRegistry } from '@/lib/sync-registry';
import { savePaymentOffline } from '@/lib/indexed-db';

const paymentsCollection = () => collection(firestoreDB, ...getTenantCollectionPath("payments"));
const customerPaymentsCollection = () => collection(firestoreDB, ...getTenantCollectionPath("customer_payments"));
const customersCollection = () => collection(firestoreDB, ...getTenantCollectionPath("customers"));
const suppliersCollection = () => collection(firestoreDB, ...getTenantCollectionPath("suppliers"));
const expensesCollection = () => collection(firestoreDB, ...getTenantCollectionPath("expenses"));

const omitUndefinedDeep = <T,>(input: T): T => {
    if (Array.isArray(input)) {
        return input.map((item) => omitUndefinedDeep(item)) as T;
    }
    if (input && typeof input === "object") {
        const obj = input as Record<string, unknown>;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined) continue;
            result[key] = omitUndefinedDeep(value);
        }
        return result as T;
    }
    return input;
};

// Define context type for the logic function
export type ProcessPaymentContext = {
    paymentMethod: string;
    isCustomer: boolean;
    paymentId?: string;
    rtgsSrNo?: string;
    paymentDate?: Date | string | undefined;
    finalAmountToPay?: number;
    drCr?: 'Debit' | 'Credit';
    extraAmount?: number;
    notes?: string;
    effectiveCdAmount?: number;
    calculatedCdAmount?: number;
    cdEnabled?: boolean;
    paymentType?: string;
    utrNo?: string;
    checkNo?: string;
    sixRNo?: string;
    selectedCustomerKey?: string | null;
    supplierDetails?: { name: string, fatherName: string, address: string, contact: string };
    entryOutstandings?: { entry: Customer, outstanding: number, originalOutstanding: number, originalAmount: number }[];
    paidForDetails?: PaidFor[];
    sixRDate?: Date | undefined | string;
    parchiNo?: string;
    rtgsQuantity?: number;
    rtgsRate?: number;
    rtgsAmount?: number;
    bankDetails?: { acNo: string, ifscCode: string, bank: string, branch: string };
    accountIdForPayment?: string;
    selectedAccountId?: string;
    editingPayment?: Payment | null;
    settleAmount?: number;
    totalOutstandingForSelected?: number;
    financialState?: { bankAccounts?: unknown[]; balances?: Map<string, number> };
    incomingSelectedEntries?: Customer[];
    govQuantity?: number;
    govRate?: number;
    govAmount?: number;
    govExtraAmount?: number;
    // govRequiredAmount?: number; // Removed
    centerName?: string; // Center Name for Gov payments
    // userGovRequiredAmount?: number; // User manually entered govRequiredAmount (Removed)
    cdToDistribute?: number; // Total CD amount to distribute
    cdAt?: string; // CD calculation mode
    cdPercent?: number; // From CD% field in form — kitna % CD katna hai vahi use hota hai
    paymentHistory?: Payment[]; // Full payment history for CD calculation
    selectedEntries?: Customer[]; // Selected entries for CD calculation
    suppliers?: Customer[]; // All suppliers for context
};

export type ProcessPaymentResult = {
    success: boolean;
    message?: string;
    payment?: Payment;
    finalPaymentData?: Payment;
    finalSummary?: { 
        srNo: string, 
        originalOutstanding: number, 
        paidAmount: number, 
        cdAmount: number,
        settleAmount: number, 
        outstandingAfter: number,
        capacity: number,
        status: string,
        formula: string 
    }[];
};

export const processPaymentLogic = async (context: ProcessPaymentContext): Promise<ProcessPaymentResult> => {
    const {
        paymentMethod,
        isCustomer,
        paymentId: paymentIdRaw,
        rtgsSrNo: rtgsSrNoRaw,
        paymentDate,
        finalAmountToPay: initialFinalAmountToPay = 0,
        drCr: drCrRaw = 'Debit',
        extraAmount: extraAmountRaw = 0,
        notes: notesRaw = '',
        effectiveCdAmount: effectiveCdAmountRaw,
        calculatedCdAmount,
        cdEnabled = false,
        paymentType = "Full",
        utrNo = "",
        checkNo = "",
        selectedCustomerKey = null,
        supplierDetails = { name: "", fatherName: "", address: "", contact: "" },
        entryOutstandings: initialEntryOutstandings = [],
        paidForDetails: initialPaidForDetails = [],
        sixRDate,
        parchiNo = "",
        rtgsQuantity = 0,
        rtgsRate = 0,
        rtgsAmount = 0,
        bankDetails = { acNo: "", ifscCode: "", bank: "", branch: "" },
        accountIdForPayment: accountIdForPaymentRaw,
        selectedAccountId,
        editingPayment = null,
        incomingSelectedEntries,
        govQuantity, govRate, govAmount, govExtraAmount,
        centerName,
        cdToDistribute = 0, cdAt = 'partial_on_paid', cdPercent: cdPercentRaw, paymentHistory = [], selectedEntries = []
    } = context;
    const cdPercentNumber = Number(cdPercentRaw);
    const cdPercent = (cdPercentRaw !== undefined && cdPercentRaw !== null && String(cdPercentRaw).trim() !== '' && Number.isFinite(cdPercentNumber))
        ? Math.max(0, cdPercentNumber)
        : 2;

    const paymentId = paymentIdRaw || "";
    const rtgsSrNo = rtgsSrNoRaw || "";
    const isAdjustmentAccount =
        selectedAccountId === 'Adjustment' || accountIdForPaymentRaw === 'Adjustment';
    const accountIdForPayment = isAdjustmentAccount
        ? 'Adjustment'
        : (accountIdForPaymentRaw || selectedAccountId || (paymentMethod === 'Cash' ? 'CashInHand' : undefined));
    const isLedger = paymentMethod === 'Ledger';
    // At finalize: hook passes effectiveCdAmount (0 when cdEnabled false) so CD is only applied when enabled
    const effectiveCdAmount = isLedger ? 0 : (effectiveCdAmountRaw ?? calculatedCdAmount ?? 0);
    const drCr = (drCrRaw === 'Credit' ? 'Credit' : 'Debit') as 'Debit' | 'Credit';
    const unsignedFinalAmountToPay = Math.abs(Number(initialFinalAmountToPay || 0));
    const requestedExtraAmountRaw = Math.max(0, Number(extraAmountRaw || 0));
    const requestedExtraAmount = isLedger ? 0 : requestedExtraAmountRaw;
    const finalAmountToPay = isLedger ? unsignedFinalAmountToPay : Number(initialFinalAmountToPay || 0);
    const signedPaymentAmount = isLedger && drCr === 'Credit' ? -unsignedFinalAmountToPay : unsignedFinalAmountToPay;
    const notes = String(notesRaw || '').trim();
    const distributableAmount = finalAmountToPay;


    let entryOutstandings = Array.isArray(initialEntryOutstandings) ? initialEntryOutstandings : [];

    // Fallback: If entryOutstandings is not provided, derive it from selectedEntries
    if (entryOutstandings.length === 0 && Array.isArray(selectedEntries) && selectedEntries.length > 0) {
        entryOutstandings = selectedEntries.map(entry => {
            const netAmount = Number(entry.netAmount) || 0;
            const totalPaid = Number(entry.totalPaid) || 0;
            const totalCd = Number(entry.totalCd) || 0;
            // Use property if available (from summary map), otherwise calculate
            const currentOutstanding = (entry as any).outstandingForEntry !== undefined 
                ? Number((entry as any).outstandingForEntry)
                : netAmount - totalPaid - totalCd;
                
            return {
                entry,
                outstanding: currentOutstanding,
                originalOutstanding: currentOutstanding,
                originalAmount: netAmount
            };
        });
    }

    let finalPaymentData: Payment | undefined;
    let paidForDetails: PaidFor[] = [];
    
    // Validation
    // For Gov. payments, allow amount to be 0 if only updating status/CD
    if (paymentMethod !== 'Gov.' && finalAmountToPay <= 0 && effectiveCdAmount <= 0) {
        throw new Error("Transaction Failed: Payment and CD amount cannot both be zero");
    }

    // LOCAL-FIRST PATH (always): Build payment + paidFor from entryOutstandings first.
    // Firestore transaction path is skipped to keep supplier payments fast and avoid network lag.
    let usedLocalPath = false;
    try {
        const { isLocalFolderMode } = await import('@/lib/local-folder-storage');
        // isLocalFolderMode() still used elsewhere (catch path), but for performance we always
        // use the local computation path when we have entryOutstandings; Firestore is skipped.
        if (entryOutstandings.length > 0) {
            const now = new Date().toISOString();
            const newPaymentId = paymentId || `${isCustomer ? "CP" : "SP"}${Date.now()}`;
            const totalOutstanding = entryOutstandings.reduce((s, i) => s + Math.max(0, (i as any).outstanding ?? 0), 0);
            // Gov. extra: distribute proportionally by outstanding (same as Firestore path) so paidFor gets extraAmount
            const govExtraSharePerEntry: number[] = entryOutstandings.map(() => 0);
            if (paymentMethod === 'Gov.' && (govExtraAmount || 0) > 0) {
                const extraTotal = Math.round((govExtraAmount || 0) * 100) / 100;
                if (totalOutstanding > 0) {
                    let extraAssigned = 0;
                    for (let i = 0; i < entryOutstandings.length; i++) {
                        const outstanding = Math.max(0, (entryOutstandings[i] as any).outstanding ?? 0);
                        const isLast = i === entryOutstandings.length - 1;
                        const share = isLast
                            ? Math.round((extraTotal - extraAssigned) * 100) / 100
                            : Math.round((extraTotal * outstanding / totalOutstanding) * 100) / 100;
                        govExtraSharePerEntry[i] = Math.max(0, share);
                        extraAssigned += govExtraSharePerEntry[i];
                    }
                } else {
                    const perEntry = Math.round((extraTotal / entryOutstandings.length) * 100) / 100;
                    for (let i = 0; i < entryOutstandings.length; i++) {
                        govExtraSharePerEntry[i] = i === entryOutstandings.length - 1
                            ? Math.round((extraTotal - perEntry * (entryOutstandings.length - 1)) * 100) / 100
                            : perEntry;
                    }
                }
            }
            const paidForDetailsLocal: PaidFor[] = [];
            let remainingCash = Math.round(finalAmountToPay * 100) / 100;
            let remainingCd = Math.round(effectiveCdAmount * 100) / 100;
            for (let i = 0; i < entryOutstandings.length; i++) {
                const item = entryOutstandings[i];
                const entry = item.entry;
                const outstanding = Math.max(0, (item as any).outstanding ?? (Number(entry.netAmount) || 0) - Number(entry.totalPaid || 0) - Number(entry.totalCd || 0));
                const share = totalOutstanding > 0 ? (outstanding / totalOutstanding) : 1 / entryOutstandings.length;
                const amount = i === entryOutstandings.length - 1
                    ? Math.round(remainingCash * 100) / 100
                    : Math.min(remainingCash, Math.round(finalAmountToPay * share * 100) / 100);
                const cdAmount = i === entryOutstandings.length - 1
                    ? Math.round(remainingCd * 100) / 100
                    : Math.min(remainingCd, Math.round(effectiveCdAmount * share * 100) / 100);
                remainingCash = Math.round((remainingCash - amount) * 100) / 100;
                remainingCd = Math.round((remainingCd - cdAmount) * 100) / 100;
                const extraAmount = govExtraSharePerEntry[i] ?? 0;
                if (amount > 0 || cdAmount > 0 || extraAmount > 0) {
                    const netAmount = Number(entry.netAmount) || 0;
                    const entryAny = entry as any;
                    paidForDetailsLocal.push({
                        srNo: entry.srNo || '',
                        amount: Math.round(amount * 100) / 100,
                        cdAmount: Math.round(cdAmount * 100) / 100,
                        supplierId: entry.id,
                        parchiNo: entry.parchiNo || entry.srNo || '',
                        paymentId: newPaymentId,
                        receiptType: paymentMethod,
                        sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                        supplierName: supplierDetails?.name || entryAny?.name || '',
                        supplierFatherName: supplierDetails?.fatherName || entryAny?.fatherName || '',
                        supplierAddress: supplierDetails?.address || entryAny?.address || '',
                        type: (amount + cdAmount + extraAmount) >= outstanding ? 'Full' : 'Partial',
                        updatedAt: now,
                        utrNo: utrNo || '',
                        adjustedOriginal: netAmount,
                        adjustedOutstanding: outstanding,
                        receiptOutstanding: outstanding,
                        extraAmount: Math.round((extraAmount || 0) * 100) / 100,
                    });
                }
            }
            finalPaymentData = omitUndefinedDeep({
                id: newPaymentId,
                paymentId: newPaymentId,
                date: paymentDate ? format(new Date(paymentDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                amount: isLedger ? (drCr === 'Credit' ? -Math.abs(finalAmountToPay) : Math.abs(finalAmountToPay)) : finalAmountToPay,
                drCr: isLedger ? drCr : undefined,
                paidFor: paidForDetailsLocal,
                paymentMethod,
                receiptType: paymentMethod,
                supplierId: selectedCustomerKey || '',
                customerId: selectedCustomerKey || '',
                supplierName: supplierDetails?.name || '',
                supplierFatherName: supplierDetails?.fatherName || '',
                notes: notes || undefined,
                rtgsSrNo: rtgsSrNo || '',
                utrNo: utrNo || '',
                checkNo: checkNo || '',
                bankAcNo: bankDetails?.acNo || '',
                bankIfsc: bankDetails?.ifscCode || '',
                bankName: bankDetails?.bank || '',
                bankBranch: bankDetails?.branch || '',
                updatedAt: now,
                cdApplied: cdEnabled || effectiveCdAmount > 0,
                cdAmount: Number(effectiveCdAmount) || 0,
                parchiNo: parchiNo || '',
                sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                type: paymentType,
                govQuantity: govQuantity || 0,
                govRate: govRate || 0,
                govAmount: govAmount || 0,
                govExtraAmount: govExtraAmount || 0,
                centerName: centerName || '',
                bankAccountId: accountIdForPayment || '',
                quantity: rtgsQuantity || 0,
                rate: rtgsRate || 0,
                rtgsAmount: rtgsAmount || 0,
            } as Payment);
            usedLocalPath = true;
        }
    } catch (_) { /* ignore */ }

    if (!usedLocalPath) {
        try {
        await runTransaction(firestoreDB, async (transaction) => {
            const now = Timestamp.now();
            // 1. Calculate distribution
            // This is a simplified distribution logic. 
            // In a real scenario, we would match exact logic, but here we ensure correctness of totals.
            
            // Generate ID first so we can use it in PaidFor details
            const newPaymentId = paymentId || `${isCustomer ? "CP" : "SP"}${Date.now()}`;

            let remainingPayment = distributableAmount;
            let remainingCd = effectiveCdAmount;
            
            // Ledger Debit overpayment: sort so entries with positive outstanding get payment first
            // (otherwise 0-outstanding entry gets full amount and 4K-outstanding entry gets 0)
            if (isLedger && drCr === 'Debit' && entryOutstandings.length > 1) {
                entryOutstandings = [...entryOutstandings].sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0));
            }
            
            const processedEntries: PaidFor[] = [];
            // Ledger: Debit = payment (entries ko distribute/update karo). Credit = charge (entries ko update nahi, summary me extra side se treat hota hai).
            // UPDATE: Allow distribution for Ledger Credit too, so it can be linked to specific entries if selected.
            const shouldDistributeToEntries = true;
            const entriesToProcess = shouldDistributeToEntries ? entryOutstandings : [];

            // Phase 1: ALL READS FIRST (Firestore transaction rule)
            const readResults: { entryRef: DocumentReference; entryDoc: DocumentSnapshot }[] = [];
            for (const item of entriesToProcess) {
                const entryId = item.entry.id;
                const entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), entryId);
                const entryDoc = await transaction.get(entryRef);
                readResults.push({ entryRef, entryDoc });
            }

            // Phase 2a: Pehle sirf outstanding nikalo; amountToPay abhi 0. CD pehle distribute hogi, phir jo bache vo To Be Paid (cash).
            type EntryPlan = { entryRef: DocumentReference; item: typeof entriesToProcess[0]; entryData: Customer; currentPaid: number; currentCd: number; netAmount: number; outstanding: number; amountToPay: number; roomForCd: number };
            const plan: EntryPlan[] = [];
            const toBePaidTotal = remainingPayment; // User ka To Be Paid = cash; ye CD distribute ke BAAD bache hue par distribute hoga
            for (let i = 0; i < readResults.length; i++) {
                const { entryRef, entryDoc } = readResults[i];
                const item = entriesToProcess[i];
                if (!entryDoc.exists()) continue;
                const entryData = entryDoc.data() as Customer;
                const currentPaid = entryData.totalPaid || 0;
                const currentCd = entryData.totalCd || 0;
                const netAmount = Number(entryData.netAmount) || 0;
                const outstandingFromDoc = netAmount - currentPaid - currentCd;
                // Ledger Debit: allow negative outstanding (overpayment); others cap at 0
                const rawOutstanding = Number((item as any).outstanding ?? (item as any).originalOutstanding ?? outstandingFromDoc);
                const outstanding = (isLedger && drCr === 'Debit') ? rawOutstanding : Math.max(0, rawOutstanding);
                const roomForCd = Math.round(Math.max(0, outstanding) * 100) / 100; // CD room: non-negative only
                plan.push({ entryRef, item, entryData, currentPaid, currentCd, netAmount, outstanding, amountToPay: 0, roomForCd });
            }

            // Gov: Extra amount pehle entries ki capacity mein add karo, PHIR To Be Paid distribute. Isse full amount distribute ho jata hai.
            // Pehle extra add karo → capacity badh jati hai → phir cash distribute karo.
            const govExtraSharePerEntry: number[] = plan.map(() => 0);
            if (paymentMethod === 'Gov.' && (govExtraAmount || 0) > 0 && plan.length > 0) {
                const totalBaseOutstanding = plan.reduce((s, p) => s + p.outstanding, 0);
                const extraTotal = Math.round((govExtraAmount || 0) * 100) / 100;
                if (totalBaseOutstanding > 0) {
                    let extraAssigned = 0;
                    for (let i = 0; i < plan.length; i++) {
                        const p = plan[i];
                        const isLast = i === plan.length - 1;
                        const share = isLast
                            ? Math.round((extraTotal - extraAssigned) * 100) / 100
                            : Math.round((extraTotal * p.outstanding / totalBaseOutstanding) * 100) / 100;
                        const extraShare = Math.max(0, share);
                        govExtraSharePerEntry[i] = extraShare;
                        p.outstanding = Math.round((p.outstanding + extraShare) * 100) / 100;
                        p.roomForCd = Math.round(Math.max(0, p.outstanding) * 100) / 100;
                        extraAssigned += extraShare;
                    }
                } else {
                    // Equal split when no outstanding
                    const perEntry = Math.round((extraTotal / plan.length) * 100) / 100;
                    for (let i = 0; i < plan.length; i++) {
                        govExtraSharePerEntry[i] = perEntry;
                        plan[i].outstanding = Math.round((plan[i].outstanding + perEntry) * 100) / 100;
                        plan[i].roomForCd = Math.round(Math.max(0, plan[i].outstanding) * 100) / 100;
                    }
                }
            }

            // Phase 2b: Pehle CD distribute karo (har entry ko uske hisse ki CD); room = outstanding abhi, so sabko CD milne ka mauka. CD allocation/distribution usi hisaab se; paid + CD ≤ outstanding (jab CD de rahe hain to paid amount kam hoga tabhi proper, nahi to outstanding negative ho jayegi).
            // - on_previously_paid_no_cd: CD ONLY on previously paid amount that had no CD (no CD on current payment); per entry = cdPercent% of previouslyPaidNoCd, capped by room; "Ensure full CD" pass skipped.
            // - partial_on_paid: First CD on "previously paid without CD" (by earliest date), then remainder by current amountToPay; cap by room.
            // - on_full_amount / proportional_cd: CD by original amount (proportional); prefer entries with no previous CD; cap by room; redistribute excess.
            // - on_unpaid_amount: CD by outstanding (proportional), cap by room.
            // - default: by room (outstanding - amountToPay). Final verification and STEP 7 ensure no CD > room where required (no negative outstanding).
            const totalPayment = plan.reduce((s, p) => s + p.amountToPay, 0);
            const totalOutstandingForCd = plan.reduce((s, p) => s + p.outstanding, 0);
            const totalRoomForCd = plan.reduce((s, p) => s + p.roomForCd, 0);
            const cdAllocations: number[] = plan.map(() => 0);
            const isCdOnPaidAmount = cdAt === 'partial_on_paid';
            const isOnPreviouslyPaidNoCd = cdAt === 'on_previously_paid_no_cd';
            const history = Array.isArray(paymentHistory) ? paymentHistory : [];
            const editingId = editingPayment?.id;

            // 20-day rule (CD On/Off jaisa): receipt ki ACTUAL DATE (date field) se 20 din — calendar day pe compare karo. 20 din ke baad wali payment par CD nahi.
            const twentyDaysMs = 20 * 24 * 60 * 60 * 1000;
            const toDayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            const isPaymentWithin20DaysOfReceipt = (p: Payment, receiptActualDate: string | undefined) => {
                if (!p.date || !receiptActualDate) return false;
                const pTime = toDayStart(new Date(p.date));
                const rTime = toDayStart(new Date(receiptActualDate));
                const diff = pTime - rTime; // payment receipt ke baad (calendar days)
                return diff >= 0 && diff <= twentyDaysMs; // 20 din ke andar — 21+ din baad wali include nahi
            };

            // CD is per-payment: 2 payments 10k+10k — ek par CD kati, doosri par nahi. Kabhi mix mat karo.

            // Helper: per-entry "previously paid without CD". 20-day rule: receipt ki ACTUAL DATE (entryData.date) use — createdAt/system date nahi.
            const buildPreviouslyPaidNoCd = (apply20DayRule: boolean = true) => {
                const previouslyPaidNoCd: number[] = [];
                const earliestDateNoCd: (number | null)[] = [];
                for (let i = 0; i < plan.length; i++) {
                    const srNo = plan[i].entryData.srNo;
                    const receiptActualDate = plan[i].entryData.date; // actual date field (receipt/entry date) — system createdAt nahi
                    let sum = 0;
                    let earliest: number | null = null;
                    for (const p of history) {
                        if (p.id === editingId) continue;
                        if (apply20DayRule && !isPaymentWithin20DaysOfReceipt(p, receiptActualDate)) continue; // 20-day: sirf actual date se 20 din ke andar wali payment
                        if (!p.paidFor?.some((pf: PaidFor) => pf.srNo === srNo)) continue;
                        const hadNoCd = !p.cdApplied || !(Number(p.cdAmount) || 0);
                        if (!hadNoCd) continue; // sirf jis payment par CD nahi kati usi ka amount count
                        const pf = p.paidFor.find((f: PaidFor) => f.srNo === srNo);
                        if (pf) {
                            sum += Number(pf.amount) || 0;
                            const d = p.date ? new Date(p.date).getTime() : 0;
                            if (d && (earliest === null || d < earliest)) earliest = d;
                        }
                    }
                    previouslyPaidNoCd.push(sum);
                    earliestDateNoCd.push(earliest);
                }
                return { previouslyPaidNoCd, earliestDateNoCd };
            };

            // Total CD already received by each entry — sirf un payments se jahan CD kati (usi amount ki CD jis par banti hai)
            const totalCdReceivedByEntry: number[] = plan.map((_, i) => {
                const srNo = plan[i].entryData.srNo;
                let total = 0;
                for (const p of history) {
                    if (p.id === editingId) continue;
                    const pf = p.paidFor?.find((f: PaidFor) => f.srNo === srNo);
                    if (!pf) continue;
                    if ('cdAmount' in pf && pf.cdAmount != null) total += Number(pf.cdAmount) || 0;
                    else if (p.cdAmount && p.paidFor?.length) {
                        const totalPaid = p.paidFor.reduce((s: number, x: PaidFor) => s + Number(x.amount || 0), 0);
                        if (totalPaid > 0) total += Math.round((p.cdAmount * Number(pf.amount || 0) / totalPaid) * 100) / 100;
                    }
                }
                return total;
            });

            if (remainingCd > 0) {
                if (isOnPreviouslyPaidNoCd && history.length > 0) {
                    // "CD on Paid Amount (No CD)": CD ONLY on previously paid amount that had no CD — no CD on current payment.
                    // 20-day rule: sirf 20 din ke andar wali payments count — 20 din se pehley payment to CD include, 20 din ke baad wali to include nahi. Isse yahaan CD sahi calculate hoti hai.
                    const { previouslyPaidNoCd } = buildPreviouslyPaidNoCd(true);
                    let cdRemaining = remainingCd;
                    for (let i = 0; i < plan.length; i++) {
                        const prevNoCd = previouslyPaidNoCd[i] ?? 0;
                        if (prevNoCd <= 0) continue;
                        const p = plan[i];
                        const cdEligible = Math.round((prevNoCd * cdPercent) / 100 * 100) / 100;
                        const room = Math.max(0, p.roomForCd - cdAllocations[i]);
                        const give = Math.min(cdRemaining, cdEligible, room);
                        if (give > 0) {
                            cdAllocations[i] = Math.round((cdAllocations[i] + give) * 100) / 100;
                            cdRemaining = Math.round((cdRemaining - give) * 100) / 100;
                        }
                    }
                } else if (isCdOnPaidAmount && (totalPayment > 0 || history.length > 0)) {
                    // "Partial CD on Paid Amount": First CD on previously paid without CD (by date), then remaining by current amountToPay. 20-day rule yahan nahi (sirf No CD mode par).
                    const { previouslyPaidNoCd, earliestDateNoCd } = buildPreviouslyPaidNoCd(false);

                    let cdRemaining = remainingCd;
                    const sortedByEarliestFirst = plan.map((_, i) => i).sort((a, b) => {
                        const ea = earliestDateNoCd[a] ?? Infinity;
                        const eb = earliestDateNoCd[b] ?? Infinity;
                        if (ea !== eb) return ea - eb;
                        return (previouslyPaidNoCd[b] ?? 0) - (previouslyPaidNoCd[a] ?? 0);
                    });
                    for (const i of sortedByEarliestFirst) {
                        if (cdRemaining <= 0) break;
                        const prevNoCd = previouslyPaidNoCd[i] ?? 0;
                        if (prevNoCd <= 0) continue;
                        const p = plan[i];
                        const cdEligibleOnPrev = Math.round((prevNoCd * cdPercent) / 100 * 100) / 100;
                        const room = p.roomForCd - cdAllocations[i];
                        const give = Math.min(cdRemaining, cdEligibleOnPrev, Math.max(0, room));
                        if (give > 0) {
                            cdAllocations[i] = Math.round((cdAllocations[i] + give) * 100) / 100;
                            cdRemaining = Math.round((cdRemaining - give) * 100) / 100;
                        }
                    }

                    if (cdRemaining > 0 && (totalPayment > 0 || totalOutstandingForCd > 0)) {
                        const totalBase = totalPayment > 0 ? totalPayment : totalOutstandingForCd;
                        let cdAssigned = 0;
                        for (let i = 0; i < plan.length; i++) {
                            const p = plan[i];
                            const roomLeft = p.roomForCd - cdAllocations[i];
                            if (roomLeft <= 0) continue;
                            const isLast = i === plan.length - 1;
                            let extra: number;
                            if (isLast) {
                                extra = Math.max(0, Math.min(roomLeft, Math.round((cdRemaining - cdAssigned) * 100) / 100));
                            } else {
                                const base = totalPayment > 0 ? p.amountToPay : p.outstanding;
                                const share = totalBase > 0 ? (cdRemaining * base) / totalBase : 0;
                                extra = Math.min(roomLeft, Math.round(share * 100) / 100);
                                extra = Math.max(0, extra);
                            }
                            cdAllocations[i] = Math.round((cdAllocations[i] + extra) * 100) / 100;
                            cdAssigned += extra;
                        }
                        let remainder = Math.round((cdRemaining - cdAssigned) * 100) / 100;
                        if (remainder > 0) {
                            for (let i = 0; i < plan.length && remainder > 0; i++) {
                                const roomLeft = plan[i].roomForCd - cdAllocations[i];
                                if (roomLeft > 0) {
                                    const ex = Math.min(remainder, roomLeft);
                                    cdAllocations[i] = Math.round((cdAllocations[i] + ex) * 100) / 100;
                                    remainder = Math.round((remainder - ex) * 100) / 100;
                                }
                            }
                        }
                    }
                } else if (totalRoomForCd > 0 && !isCdOnPaidAmount && !isOnPreviouslyPaidNoCd) {
                    const isOnFullAmount = cdAt === 'on_full_amount' || cdAt === 'proportional_cd';
                    const isOnUnpaidAmount = cdAt === 'on_unpaid_amount';
                    const eligibleIndices = plan
                        .map((_, i) => i)
                        .filter(i => (totalCdReceivedByEntry[i] ?? 0) <= 0.01 && plan[i].outstanding > 0.01);
                    const useEligibleOnly = isOnFullAmount && eligibleIndices.length > 0;
                    const indicesToUse = useEligibleOnly
                        ? eligibleIndices
                        : plan.map((_, i) => i).filter(i => plan[i].roomForCd > 0.01);

                    if (isOnFullAmount && indicesToUse.length > 0) {
                        // on_full_amount / proportional_cd: CD by original amount (proportional), cap by room, redistribute excess
                        const totalOriginal = indicesToUse.reduce((s, i) => s + plan[i].netAmount, 0);
                        if (totalOriginal > 0) {
                            let totalAlloc = 0;
                            for (const i of indicesToUse) {
                                const p = plan[i];
                                const share = (remainingCd * p.netAmount) / totalOriginal;
                                const raw = Math.round(share * 100) / 100;
                                const capped = Math.min(p.roomForCd, Math.max(0, raw));
                                cdAllocations[i] = capped;
                                totalAlloc += capped;
                            }
                            let excess = Math.round((remainingCd - totalAlloc) * 100) / 100;
                            if (excess > 0.01) {
                                const byCapacity = [...indicesToUse].sort((a, b) => (plan[b].roomForCd - cdAllocations[b]) - (plan[a].roomForCd - cdAllocations[a]));
                                for (const i of byCapacity) {
                                    if (excess <= 0.01) break;
                                    const roomLeft = plan[i].roomForCd - cdAllocations[i];
                                    if (roomLeft > 0.01) {
                                        const add = Math.min(excess, roomLeft);
                                        cdAllocations[i] = Math.round((cdAllocations[i] + add) * 100) / 100;
                                        excess = Math.round((excess - add) * 100) / 100;
                                    }
                                }
                            }
                        }
                    } else if (isOnUnpaidAmount && indicesToUse.length > 0) {
                        // on_unpaid_amount: CD by outstanding (proportional), cap by room
                        const totalOut = indicesToUse.reduce((s, i) => s + plan[i].outstanding, 0);
                        if (totalOut > 0) {
                            let totalAlloc = 0;
                            for (const i of indicesToUse) {
                                const p = plan[i];
                                const share = (remainingCd * p.outstanding) / totalOut;
                                const raw = Math.round(share * 100) / 100;
                                const capped = Math.min(p.roomForCd, Math.max(0, raw));
                                cdAllocations[i] = capped;
                                totalAlloc += capped;
                            }
                            let remainder = Math.round((remainingCd - totalAlloc) * 100) / 100;
                            if (remainder > 0.01) {
                                for (const i of indicesToUse) {
                                    if (remainder <= 0.01) break;
                                    const roomLeft = plan[i].roomForCd - cdAllocations[i];
                                    if (roomLeft > 0.01) {
                                        const add = Math.min(remainder, roomLeft);
                                        cdAllocations[i] = Math.round((cdAllocations[i] + add) * 100) / 100;
                                        remainder = Math.round((remainder - add) * 100) / 100;
                                    }
                                }
                            }
                        }
                    } else {
                        // Default: distribute by room (outstanding - amountToPay)
                        let cdAssigned = 0;
                        for (let i = 0; i < plan.length; i++) {
                            const p = plan[i];
                            const isLast = i === plan.length - 1;
                            let cdToPay: number;
                            if (isLast) {
                                cdToPay = Math.max(0, Math.min(p.roomForCd, Math.round((remainingCd - cdAssigned) * 100) / 100));
                            } else {
                                cdToPay = Math.min(p.roomForCd, Math.round((remainingCd * p.roomForCd / totalRoomForCd) * 100) / 100);
                                cdToPay = Math.max(0, cdToPay);
                            }
                            cdAllocations[i] = cdToPay;
                            cdAssigned += cdToPay;
                        }
                        let remainder = Math.round((remainingCd - cdAllocations.reduce((a, b) => a + b, 0)) * 100) / 100;
                        if (remainder > 0) {
                            for (let i = 0; i < plan.length && remainder > 0; i++) {
                                const roomLeft = plan[i].roomForCd - cdAllocations[i];
                                if (roomLeft > 0) {
                                    const extra = Math.min(remainder, roomLeft);
                                    cdAllocations[i] = Math.round((cdAllocations[i] + extra) * 100) / 100;
                                    remainder = Math.round((remainder - extra) * 100) / 100;
                                }
                            }
                        }
                    }
                }
            }

            // Final verification: no entry gets CD > room (outstanding - amountToPay); cap and redistribute excess
            for (let i = 0; i < plan.length; i++) {
                const maxCd = plan[i].roomForCd;
                if (cdAllocations[i] > maxCd + 0.01) {
                    let excess = Math.round((cdAllocations[i] - maxCd) * 100) / 100;
                    cdAllocations[i] = Math.round(maxCd * 100) / 100;
                    for (let j = 0; j < plan.length && excess > 0.01; j++) {
                        if (i === j) continue;
                        const roomLeft = plan[j].roomForCd - cdAllocations[j];
                        if (roomLeft > 0.01) {
                            const add = Math.min(excess, roomLeft);
                            cdAllocations[j] = Math.round((cdAllocations[j] + add) * 100) / 100;
                            excess = Math.round((excess - add) * 100) / 100;
                        }
                    }
                }
            }

            // Ensure full CD is allocated to paidFor (breakdown) even when room was 0 (full payment)
            // Skip for "CD on Paid Amount (No CD)". Jab amountToPay abhi 0 hai to proportion ke liye outstanding use karo.
            const totalAllocated = cdAllocations.reduce((a, b) => a + b, 0);
            if (
                !isOnPreviouslyPaidNoCd &&
                remainingCd > 0 &&
                totalAllocated < remainingCd - 0.01 &&
                (totalPayment > 0 || totalOutstandingForCd > 0)
            ) {
                const toDistribute = Math.round((remainingCd - totalAllocated) * 100) / 100;
                const totalBase = totalPayment > 0 ? totalPayment : totalOutstandingForCd;
                let assigned = 0;
                for (let i = 0; i < plan.length; i++) {
                    const p = plan[i];
                    const isLast = i === plan.length - 1;
                    const base = totalPayment > 0 ? p.amountToPay : p.outstanding;
                    const share = isLast
                        ? Math.round((toDistribute - assigned) * 100) / 100
                        : Math.round((toDistribute * base / totalBase) * 100) / 100;
                    const add = Math.max(0, share);
                    cdAllocations[i] = Math.round((cdAllocations[i] + add) * 100) / 100;
                    assigned += add;
                }
            }

            // STEP 7: ensure no negative outstanding (paid + CD ≤ outstanding). CD amount de rahe hain to paid+CD kam hona chahiye, nahi to outstanding negative ho jayegi.
            // For "CD on Paid Amount (No CD)": always cap CD to room so paid+CD ≤ outstanding.
            // For other modes: cap only when room > 0 so "Ensure full CD" breakdown is preserved when room === 0 (multiple receipts).
            for (let i = 0; i < plan.length; i++) {
                const room = plan[i].roomForCd;
                const shouldCap = isOnPreviouslyPaidNoCd ? (cdAllocations[i] > room + 0.01) : (room > 0.01 && cdAllocations[i] > room + 0.01);
                if (shouldCap) {
                    let excess = Math.round((cdAllocations[i] - room) * 100) / 100;
                    cdAllocations[i] = Math.round(Math.min(cdAllocations[i], room) * 100) / 100;
                    for (let j = 0; j < plan.length && excess > 0.01; j++) {
                        if (i === j) continue;
                        const roomLeft = plan[j].roomForCd - cdAllocations[j];
                        if (roomLeft > 0.01) {
                            const add = Math.min(excess, roomLeft);
                            cdAllocations[j] = Math.round((cdAllocations[j] + add) * 100) / 100;
                            excess = Math.round((excess - add) * 100) / 100;
                        }
                    }
                }
            }

            // Pehle CD distribute ho chuki; ab jo bache vo To Be Paid (cash). Har entry ko capacity = outstanding - cdAllocations[i] tak cash mil sakti hai.
            // Ledger Debit: allow overpayment (full amount), so outstanding can go negative
            let remainingCash = Math.round(toBePaidTotal * 100) / 100;
            const allowOverpayment = isLedger && drCr === 'Debit';
            for (let i = 0; i < plan.length; i++) {
                const p = plan[i];
                const baseCap = Math.round((p.outstanding - (cdAllocations[i] ?? 0)) * 100) / 100;
                const cap = allowOverpayment ? Math.max(remainingCash, baseCap) : Math.max(0, baseCap);
                let pay = 0;
                if (remainingCash > 0 && (cap > 0 || allowOverpayment)) {
                    pay = Math.min(remainingCash, allowOverpayment ? remainingCash : cap);
                    pay = Math.round(pay * 100) / 100;
                    remainingCash = Math.round((remainingCash - pay) * 100) / 100;
                }
                p.amountToPay = pay;
                p.roomForCd = Math.max(0, Math.round((p.outstanding - pay - (cdAllocations[i] ?? 0)) * 100) / 100);
            }

            // Phase 2c: ALL WRITES (update each entry with amountToPay and cdToPay)
            for (let i = 0; i < plan.length; i++) {
                const p = plan[i];
                const amountToPay = p.amountToPay;
                const cdToPay = cdAllocations[i] ?? 0;

                transaction.update(p.entryRef, {
                    totalPaid: increment(amountToPay),
                    totalCd: increment(cdToPay),
                    updatedAt: now
                });

                // amount = cash (Paid Amount) only; cdAmount = CD only — keep separate so calculations are correct
                // Gov: use proportional extra per entry (from govExtraSharePerEntry); others: use existingDetail from initialPaidForDetails
                const existingDetail = initialPaidForDetails.find(x => x.srNo === p.entryData.srNo);
                const extraAmount = (paymentMethod === 'Gov.' && (govExtraAmount || 0) > 0)
                    ? (govExtraSharePerEntry[i] ?? 0)
                    : (existingDetail?.extraAmount || 0);
                if (amountToPay > 0 || cdToPay > 0 || extraAmount > 0) {
                    const entryData = p.entryData as any;
                    const entryItem = p.item.entry as any;
                    processedEntries.push({
                        srNo: p.entryData.srNo || p.item.entry.srNo,
                        amount: amountToPay,
                        cdAmount: cdToPay,
                        extraAmount: extraAmount,
                        supplierId: p.entryData.id,
                        parchiNo: p.entryData.parchiNo || p.entryData.srNo || p.item.entry.srNo,
                        paymentId: newPaymentId,
                        receiptType: paymentMethod,
                        sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                        supplierAddress: supplierDetails?.address || entryData?.address || entryItem?.address || '',
                        supplierFatherName: supplierDetails?.fatherName || entryData?.fatherName || entryItem?.fatherName || '',
                        supplierName: supplierDetails?.name || entryData?.name || entryItem?.name || '',
                        type: (amountToPay + cdToPay) >= p.outstanding ? "Full" : "Partial",
                        updatedAt: now,
                        utrNo: utrNo || '',
                        adjustedOriginal: p.netAmount,
                        adjustedOutstanding: p.outstanding,
                        receiptOutstanding: p.outstanding,
                    });
                }
            }
            paidForDetails = processedEntries;

            // Normalize paidFor so cdAmount and extraAmount (Gov. extra) are always numbers (saves correctly in DB and PaidFor sheet)
            const normalizedPaidFor: PaidFor[] = paidForDetails.map((pf) => ({
                ...pf,
                amount: Number(pf.amount) || 0,
                cdAmount: Number((pf as any).cdAmount) || 0,
                extraAmount: Number((pf as any).extraAmount) || 0,
            }));

            // 2. Create Payment Object
            const remainingAdvance = Math.max(0, Math.round(remainingPayment * 100) / 100);
            const advanceAmount = undefined;
            
            finalPaymentData = {
                id: newPaymentId, // Use provided ID if editing
                paymentId: newPaymentId,
                date: paymentDate ? format(new Date(paymentDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                amount: isLedger ? signedPaymentAmount : finalAmountToPay,
                drCr: isLedger ? drCr : undefined,
                advanceAmount: advanceAmount,
                paidFor: normalizedPaidFor,
                paymentMethod,
                receiptType: paymentMethod, // Cash, Online, RTGS, Gov.
                supplierId: selectedCustomerKey || '',
                customerId: selectedCustomerKey || '', // Alias for supplierId as per user request
                supplierName: supplierDetails.name || '',
                supplierFatherName: supplierDetails.fatherName || '',
                notes: notes ? notes : undefined,
                // Add other fields
                rtgsSrNo: rtgsSrNo || '',
                utrNo: utrNo || '',
                checkNo: checkNo || '',
                bankAcNo: bankDetails?.acNo || '',
                bankIfsc: bankDetails?.ifscCode || '',
                bankName: bankDetails?.bank || '',
                bankBranch: bankDetails?.branch || '',
                quantity: rtgsQuantity || 0,
                rate: rtgsRate || 0,
                rtgsAmount: rtgsAmount || 0,
                govQuantity: govQuantity || 0,
                govRate: govRate || 0,
                govAmount: govAmount || 0,
                govExtraAmount: govExtraAmount || 0,
                centerName: centerName || '',
                bankAccountId: accountIdForPayment || '',
                updatedAt: now, // User requested updatedAt
                cdApplied: cdEnabled || effectiveCdAmount > 0, // User requested cdApplied
                cdAmount: Number(effectiveCdAmount) || 0, // Always number so CD on Paid Amount persists in DB
                parchiNo: parchiNo || '', // User requested parchiNo at root
                sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined, // User requested sixRDate at root
                type: paymentType, // Overall payment type, maybe infer? defaulting to Full for now or based on context
            };

            finalPaymentData = omitUndefinedDeep(finalPaymentData);
            
            // 3. Save Payment
            const paymentRef = doc(isCustomer ? customerPaymentsCollection() : paymentsCollection(), newPaymentId);
            transaction.set(paymentRef, finalPaymentData);

            if (isCustomer) {
                await notifySyncRegistry('customers', { transaction });
                await notifySyncRegistry('customerPayments', { transaction });
            } else {
                await notifySyncRegistry('suppliers', { transaction });
                await notifySyncRegistry('payments', { transaction });
            }
            
            // 4. Update Bank/Cash Balance (Optional: if tracked in separate collection)
            // Not implemented here as it might be handled by triggers or other logic.
        });
    } catch (error: any) {
        console.error("Payment Processing Error:", error);
        // Local folder mode: Firestore may be unavailable — build payment + paidFor from entryOutstandings and save to Dexie
        try {
            const { isLocalFolderMode } = await import('@/lib/local-folder-storage');
            if (isLocalFolderMode() && entryOutstandings.length > 0) {
                const now = new Date().toISOString();
                const newPaymentId = paymentId || `${isCustomer ? "CP" : "SP"}${Date.now()}`;
                const totalOutstanding = entryOutstandings.reduce((s, i) => s + Math.max(0, (i as any).outstanding ?? 0), 0);
                const govExtraSharePerEntryCatch: number[] = entryOutstandings.map(() => 0);
                if (paymentMethod === 'Gov.' && (govExtraAmount || 0) > 0) {
                    const extraTotal = Math.round((govExtraAmount || 0) * 100) / 100;
                    if (totalOutstanding > 0) {
                        let extraAssigned = 0;
                        for (let i = 0; i < entryOutstandings.length; i++) {
                            const outstanding = Math.max(0, (entryOutstandings[i] as any).outstanding ?? 0);
                            const isLast = i === entryOutstandings.length - 1;
                            const share = isLast ? Math.round((extraTotal - extraAssigned) * 100) / 100 : Math.round((extraTotal * outstanding / totalOutstanding) * 100) / 100;
                            govExtraSharePerEntryCatch[i] = Math.max(0, share);
                            extraAssigned += govExtraSharePerEntryCatch[i];
                        }
                    } else {
                        const perEntry = Math.round((extraTotal / entryOutstandings.length) * 100) / 100;
                        for (let i = 0; i < entryOutstandings.length; i++) {
                            govExtraSharePerEntryCatch[i] = i === entryOutstandings.length - 1 ? Math.round((extraTotal - perEntry * (entryOutstandings.length - 1)) * 100) / 100 : perEntry;
                        }
                    }
                }
                const paidForDetails: PaidFor[] = [];
                let remainingCash = Math.round(finalAmountToPay * 100) / 100;
                let remainingCd = Math.round(effectiveCdAmount * 100) / 100;
                for (let i = 0; i < entryOutstandings.length; i++) {
                    const item = entryOutstandings[i];
                    const entry = item.entry;
                    const outstanding = Math.max(0, (item as any).outstanding ?? (Number(entry.netAmount) || 0) - Number(entry.totalPaid || 0) - Number(entry.totalCd || 0));
                    const share = totalOutstanding > 0 ? (outstanding / totalOutstanding) : 1 / entryOutstandings.length;
                    const amount = i === entryOutstandings.length - 1
                        ? Math.round(remainingCash * 100) / 100
                        : Math.min(remainingCash, Math.round(finalAmountToPay * share * 100) / 100);
                    const cdAmount = i === entryOutstandings.length - 1
                        ? Math.round(remainingCd * 100) / 100
                        : Math.min(remainingCd, Math.round(effectiveCdAmount * share * 100) / 100);
                    
                    let extraAmount = govExtraSharePerEntryCatch[i] ?? 0;
                    let entryAmount = amount;

                    // If Ledger Credit (Income), treat the amount as a negative extra (deduction)
                    if (isLedger && drCr === 'Credit') {
                        extraAmount -= amount;
                        entryAmount = 0;
                    }

                    remainingCash = Math.round((remainingCash - amount) * 100) / 100;
                    remainingCd = Math.round((remainingCd - cdAmount) * 100) / 100;
                    
                    if (entryAmount > 0 || cdAmount > 0 || extraAmount !== 0) {
                        const netAmount = Number(entry.netAmount) || 0;
                        const entryAny = entry as any;
                        paidForDetails.push({
                            srNo: entry.srNo || '',
                            amount: Math.round(entryAmount * 100) / 100,
                            cdAmount: Math.round(cdAmount * 100) / 100,
                            supplierId: entry.id,
                            parchiNo: entry.parchiNo || entry.srNo || '',
                            paymentId: newPaymentId,
                            receiptType: paymentMethod,
                            sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                            supplierName: supplierDetails?.name || entryAny?.name || '',
                            supplierFatherName: supplierDetails?.fatherName || entryAny?.fatherName || '',
                            supplierAddress: supplierDetails?.address || entryAny?.address || '',
                            type: (entryAmount + cdAmount + (extraAmount < 0 ? 0 : extraAmount)) >= outstanding ? 'Full' : 'Partial',
                            updatedAt: now,
                            utrNo: utrNo || '',
                            adjustedOriginal: netAmount,
                            adjustedOutstanding: outstanding,
                            receiptOutstanding: outstanding,
                            extraAmount: Math.round((extraAmount || 0) * 100) / 100,
                        });
                    }
                }
                finalPaymentData = omitUndefinedDeep({
                    id: newPaymentId,
                    paymentId: newPaymentId,
                    date: paymentDate ? format(new Date(paymentDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                    amount: isLedger ? (drCr === 'Credit' ? -Math.abs(finalAmountToPay) : Math.abs(finalAmountToPay)) : finalAmountToPay,
                    drCr: isLedger ? drCr : undefined,
                    paidFor: paidForDetails,
                    paymentMethod,
                    receiptType: paymentMethod,
                    supplierId: selectedCustomerKey || '',
                    customerId: selectedCustomerKey || '',
                    supplierName: supplierDetails?.name || '',
                    supplierFatherName: supplierDetails?.fatherName || '',
                    notes: notes || undefined,
                    rtgsSrNo: rtgsSrNo || '',
                    utrNo: utrNo || '',
                    checkNo: checkNo || '',
                    bankAcNo: bankDetails?.acNo || '',
                    bankIfsc: bankDetails?.ifscCode || '',
                    bankName: bankDetails?.bank || '',
                    bankBranch: bankDetails?.branch || '',
                    updatedAt: now,
                    cdApplied: cdEnabled || effectiveCdAmount > 0,
                    cdAmount: Number(effectiveCdAmount) || 0,
                    parchiNo: parchiNo || '',
                    sixRDate: sixRDate ? format(new Date(sixRDate), 'yyyy-MM-dd') : undefined,
                    type: paymentType,
                } as Payment);
            }
        } catch (_) { /* ignore */ }
        if (!finalPaymentData) {
            return { success: false, message: error.message };
        }
    }
    }

    if (!finalPaymentData) {
        return { success: false, message: "Payment processed but response data missing" };
    }

    // Ensure paidFor is always an array when saving (finalize) so Dexie + Excel get receipt detail
    const paidForArray = Array.isArray(finalPaymentData.paidFor) ? finalPaymentData.paidFor : [];
    const dataToSave = { ...finalPaymentData, paidFor: paidForArray };

    const collectionName = isCustomer ? 'customerPayments' : 'payments';
    await savePaymentOffline(dataToSave, collectionName);

    if (!editingPayment && typeof window !== 'undefined' && db) {
        try {
            const table = isCustomer ? (db as any).customers : (db as any).suppliers;
            if (table && Array.isArray(dataToSave.paidFor)) {
                for (const pf of dataToSave.paidFor) {
                    const entryId = (pf as any).supplierId;
                    if (!entryId) continue;

                    const existing = await table.get(entryId);
                    if (!existing) continue;

                    const amount = Number((pf as any).amount || 0);
                    const cdAmount = Number((pf as any).cdAmount || 0);

                    const updated = {
                        ...existing,
                        totalPaid: Number(existing.totalPaid || 0) + amount,
                        totalCd: Number(existing.totalCd || 0) + cdAmount,
                        updatedAt: new Date().toISOString(),
                    };

                    await table.put(updated);
                }

                window.dispatchEvent(
                    new CustomEvent('indexeddb:collection:changed', {
                        detail: { collection: isCustomer ? 'customers' : 'suppliers' },
                    })
                );
            }
        } catch {
        }
    }

    return {
        success: true,
        message: "Payment processed successfully",
        payment: finalPaymentData,
        finalPaymentData,
        finalSummary: []
    };
};

export const handleDeletePaymentLogic = async (params: {
    paymentId: string;
    paymentHistory: Payment[];
    suppliers: Customer[];
    expenses: Expense[];
    incomes: any[];
    isCustomer: boolean;
}) => {
    const { paymentId, paymentHistory, suppliers, isCustomer } = params;

    // LOCAL FOLDER MODE SHORT-CIRCUIT:
    // If running in local-folder mode, skip Firestore transaction entirely and
    // perform all deletes/reverts using Dexie + folder storage only. This avoids
    // network/transaction delays that were causing heavy lag after delete.
    let isLocalFolder = true;
    try {
        const { isLocalFolderMode } = await import('@/lib/local-folder-storage');
        // Even if Firestore mode is technically available, we treat supplier payments as
        // local-first for performance and always use Dexie + folder path for delete.
        isLocalFolder = isLocalFolderMode() || true;
    } catch {
        // If local-folder helper is unavailable, still fall back to local delete path.
        isLocalFolder = true;
    }

    // 1. Find the payment
    // We try to find it in the passed history, or we fetch it from Firestore if not found
    let payment = paymentHistory.find(p => p.id === paymentId || p.paymentId === paymentId);
    
    if (!payment) {
        // Try fetching from Firestore - single payments collection for all supplier payments (including Gov)
        const primaryCollection = isCustomer ? customerPaymentsCollection() : paymentsCollection();
        const paymentRef = doc(primaryCollection, paymentId);
        const paymentDoc = await getDoc(paymentRef);
        if (paymentDoc.exists()) {
            payment = paymentDoc.data() as Payment;
            if (!payment.id) payment.id = paymentId;
        }
        if (!payment) {
            const qPrimary = query(primaryCollection, where("paymentId", "==", paymentId));
            const snapshotPrimary = await getDocs(qPrimary);
            if (!snapshotPrimary.empty) {
                payment = snapshotPrimary.docs[0].data() as Payment;
                payment.id = snapshotPrimary.docs[0].id;
            }
        }
    }

    if (!payment) {
        throw new Error("Payment not found");
    }

    const localPaymentId = String(payment.paymentId || payment.id || '').trim();

    const deleteFromLocalDexieAndNotify = async () => {
        if (typeof window === 'undefined' || !db) return;
        const table = isCustomer ? (db as any).customerPayments : (db as any).payments;
        if (!table) return;
        try {
            const { isLocalFolderMode, removePaymentsFromFolderFile } = await import('@/lib/local-folder-storage');
            if (isLocalFolderMode() && localPaymentId) {
                await removePaymentsFromFolderFile(isCustomer ? 'customerPayments' : 'payments', [localPaymentId]);
            }
        } catch { /* ignore */ }
        if (localPaymentId) await table.where('paymentId').equals(localPaymentId).delete();
        await table.delete(payment.id as any);
        window.dispatchEvent(new CustomEvent('indexeddb:payment:deleted', { detail: { id: payment.id, payment, isCustomer, receiptType: payment.receiptType } }));
    };

    const revertSuppliersOrCustomersInDexie = async () => {
        if (typeof window === 'undefined' || !db || !payment?.paidFor?.length) return;
        const table = isCustomer ? (db as any).customers : (db as any).suppliers;
        if (!table) return;
        for (const paidItem of payment.paidFor) {
            const entryId = (paidItem as any).supplierId || suppliers.find(s => s.srNo === paidItem.srNo)?.id;
            if (!entryId) continue;
            const existing = await table.get(entryId);
            if (!existing) continue;
            const amount = Number((paidItem as any).amount || 0);
            const cdAmount = Number((paidItem as any).cdAmount || 0);
            await table.put({
                ...existing,
                totalPaid: Math.max(0, Number(existing.totalPaid || 0) - amount),
                totalCd: Math.max(0, Number(existing.totalCd || 0) - cdAmount),
                updatedAt: new Date().toISOString(),
            });
        }
        window.dispatchEvent(new CustomEvent('indexeddb:collection:changed', { detail: { collection: isCustomer ? 'customers' : 'suppliers' } }));
    };

    // In local-folder mode, do NOT attempt Firestore transaction; just update Dexie + folder.
    if (isLocalFolder) {
        await revertSuppliersOrCustomersInDexie();
        await deleteFromLocalDexieAndNotify();
        return;
    }

    try {
        await runTransaction(firestoreDB, async (transaction) => {
        // Revert Supplier/Customer balances
        if (payment!.paidFor && Array.isArray(payment!.paidFor)) {
            for (const paidItem of payment!.paidFor) {
                // Find the supplier entry
                // We search by ID if available, otherwise srNo
                let entryRef;
                if (paidItem.supplierId) {
                     entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), paidItem.supplierId);
                } else if (paidItem.srNo) {
                    // Resolve by srNo using the suppliers/customers list (no read inside transaction)
                    const foundSupplier = suppliers.find(s => s.srNo === paidItem.srNo);
                    if (foundSupplier) {
                        entryRef = doc(isCustomer ? customersCollection() : suppliersCollection(), foundSupplier.id);
                    }
                }

                if (entryRef) {
                    // Update outstanding
                    transaction.update(entryRef, {
                        totalPaid: increment(-(paidItem.amount || 0)),
                        totalCd: increment(-(paidItem.cdAmount || 0))
                    });
                }
            }
        }

        // 3. Delete the payment document - single payments collection for all supplier payments (including Gov)
        const firestoreDocId = String(payment!.paymentId || payment!.id || '').trim() || String(payment!.id);
        if (isCustomer) {
            const paymentDocRef = doc(customerPaymentsCollection(), payment!.id);
            transaction.delete(paymentDocRef);
            await notifySyncRegistry('customerPayments', { transaction });
        } else {
            const paymentDocRef = doc(paymentsCollection(), firestoreDocId);
            transaction.delete(paymentDocRef);
            await notifySyncRegistry('payments', { transaction });
        }
    });
    } catch (_) {
        // Firestore failed (e.g. local folder / offline) — still delete from Dexie and sync to folder
    }
    await revertSuppliersOrCustomersInDexie();
    await deleteFromLocalDexieAndNotify();
};

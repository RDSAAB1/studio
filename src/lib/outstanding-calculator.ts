/**
 * Shared outstanding calculation - MUST match DetailsDialog logic exactly.
 * Used by use-supplier-summary so the outstanding entries table shows the same
 * value as "Details for SR No" dialog.
 */
import type { Customer, Payment, CustomerPayment, PaidFor } from "@/lib/definitions";

// Helper to ensure paidFor is always an array (handles JSON strings from local storage)
function getSafePaidFor(p: any): PaidFor[] {
  if (!p || !p.paidFor) return [];
  if (Array.isArray(p.paidFor)) return p.paidFor;
  if (typeof p.paidFor === 'string') {
    try {
      const parsed = JSON.parse(p.paidFor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function matchesEntry(pf: PaidFor, targetSrNo: string, targetId: string): boolean {
  const pfSrNo = String(pf.srNo || "").trim().toLowerCase();
  const pfId = String(pf.id || (pf as any).supplierId || "").trim().toLowerCase();
  const sNo = String(targetSrNo || "").trim().toLowerCase();
  const sId = String(targetId || "").trim().toLowerCase();
  
  return (sNo !== "" && pfSrNo === sNo) || (sId !== "" && pfId === sId);
}

function getPaymentsForEntry(srNo: string, entryId: string, paymentHistory: (Payment | CustomerPayment)[]): (Payment | CustomerPayment)[] {
  const targetSrNo = String(srNo || "").trim().toLowerCase();
  const targetId = String(entryId || "").trim().toLowerCase();
  
  const filtered = (paymentHistory || []).filter((p) => {
    const safePaidFor = getSafePaidFor(p);
    const paidForMatch = safePaidFor.some((pf) => matchesEntry(pf, targetSrNo, targetId));
    
    const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw
      .split(/[,\s]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
    const parchiMatch = parchiTokens.includes(targetSrNo) || parchiNoRaw === targetSrNo;
    
    return Boolean(paidForMatch || parchiMatch);
  });

  // Deduplicate by paymentId
  return filtered.filter((p, index, self) => {
    const pKey = String((p as any).paymentId || (p as any).id || "").trim();
    if (!pKey) return false;
    return (
      index ===
      self.findIndex((t) => {
        const tKey = String((t as any).paymentId || (t as any).id || "").trim();
        return tKey === pKey;
      })
    );
  });
}

function calcTotalPaid(payments: (Payment | CustomerPayment)[], targetSrNo: string, targetId: string, srNoToNetAmount?: Map<string, number>): number {
  const tokenToPaid = new Map<string, number>();
  let totalForTarget = 0;

  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  for (const p of sortedPayments) {
    const safePaidFor = getSafePaidFor(p);
    const paidForThis = safePaidFor.find((pf) => matchesEntry(pf, targetSrNo, targetId));
    
    const receiptType = String((p as any).receiptType || "").trim().toLowerCase();
    const isLedger = receiptType === "ledger";
    const amountRaw = Number((p as any).amount || 0);
    const drCrLower = String((p as any).drCr || "").trim().toLowerCase();
    const isLedgerCredit = isLedger && (drCrLower === "credit" || amountRaw < 0);

    if (isLedger && isLedgerCredit) continue;

    if (paidForThis) {
      const share = Number(paidForThis.amount || 0);
      if (matchesEntry(paidForThis, targetSrNo, targetId)) {
          totalForTarget += share;
      }
      for (const pf of safePaidFor) {
          const s = String(pf.srNo || "").toLowerCase();
          if (s) tokenToPaid.set(s, (tokenToPaid.get(s) || 0) + Number(pf.amount || 0));
      }
      continue;
    }

    const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const parchiMatch = parchiTokens.includes(targetSrNo.toLowerCase());
    
    if (parchiMatch) {
      const amountAbs = Math.abs(amountRaw);
      let remaining = amountAbs;
      for (const token of parchiTokens) {
        const billNet = srNoToNetAmount?.get(token) || 0;
        const paidBefore = tokenToPaid.get(token) || 0;
        // CD consumes capacity too (Proportional CD usually already distributed)
        const currentBillCd = calcTotalCd(sortedPayments, token, "", srNoToNetAmount);

        const capacity = Math.max(0, billNet - paidBefore - currentBillCd);
        const consumption = Math.min(remaining, capacity || remaining);
        
        if (token === targetSrNo.toLowerCase()) {
          totalForTarget += consumption;
        }
        tokenToPaid.set(token, paidBefore + consumption);
        remaining -= consumption;
        if (remaining <= 0) break;
      }
    }
  }
  return totalForTarget;
}

function calcTotalCd(payments: (Payment | CustomerPayment)[], targetSrNo: string, targetId: string, srNoToNetAmount?: Map<string, number>): number {
  const tokenToCd = new Map<string, number>();
  let totalForTarget = 0;

  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  for (const p of sortedPayments) {
    const safePaidFor = getSafePaidFor(p);
    const paidForThisDetail = safePaidFor.find((pf) => matchesEntry(pf, targetSrNo, targetId));
    const cdAmountTotal = Number((p as any).cdAmount || 0);

    if (paidForThisDetail && 'cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount != null) {
      const share = Number(paidForThisDetail.cdAmount || 0);
      if (matchesEntry(paidForThisDetail, targetSrNo, targetId)) {
          totalForTarget += share;
      }
      for (const pf of safePaidFor) {
          const s = String(pf.srNo || "").toLowerCase();
          if (s) tokenToCd.set(s, (tokenToCd.get(s) || 0) + Number(pf.cdAmount || 0));
      }
      continue;
    }

    if (cdAmountTotal > 0) {
      const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
      const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t) => t.trim().toLowerCase()).filter(Boolean);
      
      if (paidForThisDetail) {
         const totalAmountInPayment = safePaidFor.reduce((s: number, i: any) => s + Math.abs(Number(i.amount || 0)), 0);
         if (totalAmountInPayment > 0) {
           const share = (Math.abs(Number(paidForThisDetail.amount || 0)) / totalAmountInPayment) * cdAmountTotal;
           totalForTarget += share;
         }
      } else if (parchiTokens.includes(targetSrNo.toLowerCase())) {
         const totalBillAmountInParchi = parchiTokens.reduce((s, token) => s + (srNoToNetAmount?.get(token) || 0), 0);
         const share = totalBillAmountInParchi > 0 ? ((srNoToNetAmount?.get(targetSrNo.toLowerCase()) || 0) / totalBillAmountInParchi) * cdAmountTotal : (cdAmountTotal / parchiTokens.length);
         totalForTarget += share;
      }
    }
  }
  return totalForTarget;
}

function calcTotalExtra(payments: (Payment | CustomerPayment)[], targetSrNo: string, targetId: string, srNoToNetAmount?: Map<string, number>): number {
  return payments.reduce((sum, p) => {
    // if (String((p as any).status || "").trim().toLowerCase() === "pending") return sum;
    const safePaidFor = getSafePaidFor(p);
    const paidForThis = safePaidFor.find((pf) => matchesEntry(pf, targetSrNo, targetId));
    
    const paidForExtra = Number((paidForThis as any)?.extraAmount || 0);
    const receiptType = String((p as any).receiptType || "").trim().toLowerCase();
    const isLedger = receiptType === "ledger";
    const isLedgerCredit =
      String((p as any).drCr || "").trim().toLowerCase() === "credit" ||
      Number((p as any).amount || 0) < 0;

    const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw
      .split(/[,\s]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
    const isPaymentAttachedToThisEntry =
      parchiTokens.includes(targetSrNo.toLowerCase()) || parchiNoRaw === targetSrNo.toLowerCase();

    const paymentLevelExtraRawFromFields =
      Number((p as any).extraAmount || 0) + Number((p as any).advanceAmount || 0);
    const ledgerAmountFallback =
      isLedger && (safePaidFor.length || 0) === 0 && paymentLevelExtraRawFromFields === 0
        ? Math.abs(Number((p as any).amount || 0))
        : 0;
    const paymentLevelExtraRaw = paymentLevelExtraRawFromFields + ledgerAmountFallback;
    
    let ledgerShare = 0;
    if (isLedger && isPaymentAttachedToThisEntry && ledgerAmountFallback > 0 && parchiTokens.length > 0) {
        if (srNoToNetAmount && parchiTokens.length > 1) {
            let remainingExtra = ledgerAmountFallback;
            for (const token of parchiTokens) {
                const billNet = srNoToNetAmount.get(token.toLowerCase()) || 0;
                const consumption = Math.min(remainingExtra, billNet);
                if (token.toLowerCase() === targetSrNo.toLowerCase()) {
                    ledgerShare = consumption;
                    break;
                }
                remainingExtra -= consumption;
                if (remainingExtra <= 0) break;
            }
        } else {
            ledgerShare = Math.round((ledgerAmountFallback / parchiTokens.length) * 100) / 100;
        }
    }

    const canUsePaymentLevelExtra = (safePaidFor.length || 0) === 0 || !(receiptType === "ledger" || receiptType === "online" || receiptType === "rtgs" || receiptType === "gov.");
    const includePaymentLevelExtra = paidForExtra === 0 && canUsePaymentLevelExtra;
    
    const paymentLevelExtra =
      isPaymentAttachedToThisEntry && includePaymentLevelExtra
        ? isLedger
          ? isLedgerCredit
            ? -(paymentLevelExtraRawFromFields + ledgerShare)
            : 0
          : (paymentLevelExtraRawFromFields + (receiptType === 'gov.' ? Number((p as any).govExtraAmount || 0) : 0))
        : 0;

    return sum + paidForExtra + paymentLevelExtra;
  }, 0);
}

export type OutstandingPayment = (Payment | CustomerPayment) & {
    shareAmount: number;
    shareCd: number;
    shareExtra: number;
};

export type OutstandingResult = {
  outstanding: number;
  totalPaid: number;
  totalCd: number;
  totalExtra: number;
  adjustedOriginal: number;
  paymentsForEntry: OutstandingPayment[];
};

export type GlobalResultMap = Map<string, {
    outstanding: number;
    totalPaid: number;
    totalCd: number;
    totalExtra: number;
    adjustedOriginal: number;
    paymentsForEntry: OutstandingPayment[];
}>;

/**
 * Simulates a chronological stack for an entire group of bills/payments.
 * Ensures strict sequential fill-up across the whole account.
 */
export function calculateGlobalSimulation(
    allBills: Customer[],
    allPayments: (Payment | CustomerPayment)[],
    srNoToNetAmount?: Map<string, number>
): GlobalResultMap {
    const results = new Map<string, any>();
    
    // 1. Prepare Bills Stack (Sorted by SR No/Date)
    const sortedBills = [...allBills].sort((a, b) => {
        const srA = String(a.srNo || "").toLowerCase();
        const srB = String(b.srNo || "").toLowerCase();
        return srA.localeCompare(srB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // 2. Prepare Payments Pool (Sorted chronologically)
    const sortedPayments = [...allPayments].sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return String(a.id || a.paymentId || "").localeCompare(String(b.id || b.paymentId || ""));
    });

    // Initialize tracking
    const billState = new Map<string, { 
        paid: number; 
        cd: number; 
        extra: number; 
        net: number;
        history: OutstandingPayment[];
    }>();

    for (const b of sortedBills) {
        const sr = String(b.srNo || "").toLowerCase();
        const net = Number(b.originalNetAmount ?? b.netAmount ?? 0) + (Number((b as any).advanceFreight) || 0);
        billState.set(sr, { paid: 0, cd: 0, extra: 0, net, history: [] });
    }

    // First Pass: Collect Extras
    for (const p of sortedPayments) {
        const srNoToGive = new Set<string>();
        const parchiRaw = String((p as any).parchiNo || "").toLowerCase();
        parchiRaw.split(/[,\s]+/g).forEach(t => { if(t.trim()) srNoToGive.add(t.trim()); });
        getSafePaidFor(p).forEach(pf => { if(pf.srNo) srNoToGive.add(pf.srNo.toLowerCase()); });

        if (srNoToGive.size === 0) continue;

        // Extra calculation
        for (const sr of srNoToGive) {
            const state = billState.get(sr);
            if (!state) continue;
            const extra = calcTotalExtra([p], sr, "", srNoToNetAmount);
            if (extra !== 0) {
                state.extra += extra;
            }
        }
    }

    // Second Pass: Distribute CD and Cash Simulation
    for (const p of sortedPayments) {
        const amountRemaining = Math.abs(Number((p as any).amount || 0));
        const cdRemaining = Number((p as any).cdAmount || 0);
        
        // Find which bills this payment touches (either via paidFor or parchiNo fallback)
        const safePaidFor = getSafePaidFor(p);
        const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
        const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(t => t.trim().toLowerCase()).filter(Boolean);
        
        let targetSrNos = safePaidFor.map(pf => String(pf.srNo || "").toLowerCase()).filter(Boolean);
        if (targetSrNos.length === 0) targetSrNos = parchiTokens;
        
        // If it's a "Global" payment (matched by profile but no specific bill), let it touch ALL group bills
        if (targetSrNos.length === 0) {
            targetSrNos = sortedBills.map(b => String(b.srNo || "").toLowerCase());
        }

        // Logic: Try to fill targetSrNos in sequence
        let pCashRem = amountRemaining;
        let pCdRem = cdRemaining;

        // To satisfy the user: even if a payment mentions S00044, if S00017 is older and outstanding, we consider a spillover.
        // For strictness, we use the order defined by targetSrNos. 
        // But the user's specific request "move 5k to S00017" means they want Global Chronological Fill-up.
        
        // UNIVERSAL FILL-UP: Use any available cash to fill any available bill in chronological order
        const eligibleBills = sortedBills.filter(b => targetSrNos.includes(String(b.srNo || "").toLowerCase()));
        
        // 1. CD Pass (Proportional)
        if (pCdRem > 0) {
            const totalRemainingForCd = eligibleBills.reduce((acc, b) => {
                const s = billState.get(String(b.srNo || "").toLowerCase());
                return acc + Math.max(0, (s?.net || 0) + (s?.extra || 0) - (s?.paid || 0) - (s?.cd || 0));
            }, 0);
            
            for (let i = 0; i < eligibleBills.length; i++) {
                const b = eligibleBills[i];
                const sr = String(b.srNo || "").toLowerCase();
                const state = billState.get(sr)!;
                // CD should be capped by total remaining bill room, not 2%
                const room = Math.max(0, state.net + state.extra - state.paid - state.cd);
                const share = (i === eligibleBills.length - 1) ? pCdRem : (pCdRem * room / (totalRemainingForCd || 1));
                const give = Math.min(pCdRem, Math.round(share * 100) / 100);
                state.cd += give;
                pCdRem -= give;
                // Record history later
                (p as any)._tempCd = (p as any)._tempCd || new Map();
                (p as any)._tempCd.set(sr, give);
            }
        }

        // 2. Cash Pass (Sequential)
        for (let i = 0; i < eligibleBills.length; i++) {
            const b = eligibleBills[i];
            const sr = String(b.srNo || "").toLowerCase();
            const state = billState.get(sr)!;
            const capacity = Math.max(0, state.net + state.extra - state.paid - state.cd);
            
            let give = 0;
            if (i === eligibleBills.length - 1) {
                give = pCashRem; // Catch all overpayment for last target bill
            } else {
                give = Math.min(pCashRem, capacity);
            }
            give = Math.round(give * 100) / 100;
            state.paid += give;
            pCashRem -= give;
            
            // Record history item
            const pShareItem: OutstandingPayment = {
                ...p,
                shareAmount: give,
                shareCd: (p as any)._tempCd?.get(sr) || 0,
                shareExtra: i === 0 ? calcTotalExtra([p], sr, "", srNoToNetAmount) : 0 // Simplified extra attach
            };
            state.history.push(pShareItem);
            if (pCashRem <= 0 && pCdRem <= 0) break;
        }
    }

    // Final Assembly
    for (const [sr, state] of billState) {
        results.set(sr, {
            outstanding: Math.round((state.net + state.extra - state.paid - state.cd) * 100) / 100,
            totalPaid: state.paid,
            totalCd: state.cd,
            totalExtra: state.extra,
            adjustedOriginal: state.net + state.extra,
            paymentsForEntry: state.history
        });
    }

    return results;
}

/**
 * Calculate outstanding for an entry - Falls back to a 1-item global simulation
 */
export function calculateOutstandingForEntry(
  entry: Customer,
  paymentHistory: (Payment | CustomerPayment)[],
  srNoToNetAmount?: Map<string, number>
): OutstandingResult {
  const resMap = calculateGlobalSimulation([entry], paymentHistory, srNoToNetAmount);
  const sr = String(entry.srNo || "").toLowerCase();
  const res = resMap.get(sr);
  
  if (res) return res;
  
  // Minimal fallback if SR No mismatch
  return {
    outstanding: 0,
    totalPaid: 0,
    totalCd: 0,
    totalExtra: 0,
    adjustedOriginal: 0,
    paymentsForEntry: []
  };
}

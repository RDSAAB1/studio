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
  return payments.reduce((sum, p) => {
    const status = String((p as any).status || "").trim().toLowerCase();
    // if (status === 'pending') return sum; // Count pending payments for "hand-to-hand" updates

    const safePaidFor = getSafePaidFor(p);
    const paidForThis = safePaidFor.find((pf) => matchesEntry(pf, targetSrNo, targetId));
    
    const receiptType = String((p as any).receiptType || "").trim().toLowerCase();
    const isLedger = receiptType === "ledger";
    const amountRaw = Number((p as any).amount || 0);
    const drCrLower = String((p as any).drCr || "").trim().toLowerCase();
    const isLedgerCredit = isLedger && (drCrLower === "credit" || amountRaw < 0);

    // If it's a ledger charge (Credit), it's Extra, not Paid
    if (isLedger && isLedgerCredit) return sum;

    if (paidForThis) {
      return sum + Number(paidForThis.amount || 0);
    }

    // Fallback: Proportional split by parchiNo
    const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const parchiMatch = parchiTokens.includes(targetSrNo.toLowerCase()) || parchiNoRaw === targetSrNo.toLowerCase();
    
    if (parchiMatch) {
      const amountAbs = Math.abs(amountRaw);
      
      // Proportional split logic
      if (srNoToNetAmount && parchiTokens.length > 0) {
        const totalBillAmountInParchi = parchiTokens.reduce((s, token) => s + (srNoToNetAmount.get(token.toLowerCase()) || 0), 0);
        const currentBillAmount = srNoToNetAmount.get(targetSrNo.toLowerCase()) || 0;
        if (totalBillAmountInParchi > 0) {
            const weight = currentBillAmount / totalBillAmountInParchi;
            return sum + Math.round(amountAbs * weight * 100) / 100;
        }
      }

      const share = parchiTokens.length > 0 ? Math.round((amountAbs / parchiTokens.length) * 100) / 100 : amountAbs;
      return sum + share;
    }

    return sum;
  }, 0);
}

function calcTotalCd(payments: (Payment | CustomerPayment)[], targetSrNo: string, targetId: string, srNoToNetAmount?: Map<string, number>): number {
  return payments.reduce((sum, p) => {
    const status = String((p as any).status || "").trim().toLowerCase();
    // if (status === 'pending') return sum; // Count pending CD for "hand-to-hand" updates

    const safePaidFor = getSafePaidFor(p);
    const paidForThisDetail = safePaidFor.find((pf) => matchesEntry(pf, targetSrNo, targetId));

    const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t) => t.trim().toLowerCase()).filter(Boolean);
    const parchiMatch = parchiTokens.includes(targetSrNo.toLowerCase()) || parchiNoRaw === targetSrNo.toLowerCase();

    // CD logic - 1. From paidFor item directly
    if (paidForThisDetail && 'cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount != null) {
      return sum + Number(paidForThisDetail.cdAmount || 0);
    }
    
    // CD logic - 2. Proportional from payment-level cdAmount
    const cdAmountTotal = Number((p as any).cdAmount || 0);
    if (cdAmountTotal > 0) {
      if (paidForThisDetail && safePaidFor.length > 0) {
        const totalAmountInPayment = safePaidFor.reduce((s: number, i: any) => s + Math.abs(Number(i.amount || 0)), 0);
        if (totalAmountInPayment > 0) {
          const proportion = Math.abs(Number(paidForThisDetail.amount || 0)) / totalAmountInPayment;
          return sum + Math.round(cdAmountTotal * proportion * 100) / 100;
        }
      } else if (parchiMatch) {
         if (srNoToNetAmount && parchiTokens.length > 0) {
            const totalBillAmountInParchi = parchiTokens.reduce((s, token) => s + (srNoToNetAmount.get(token.toLowerCase()) || 0), 0);
            const currentBillAmount = srNoToNetAmount.get(targetSrNo.toLowerCase()) || 0;
            if (totalBillAmountInParchi > 0) {
                const weight = currentBillAmount / totalBillAmountInParchi;
                return sum + Math.round(cdAmountTotal * weight * 100) / 100;
            }
         }
         const share = parchiTokens.length > 0 ? Math.round((cdAmountTotal / parchiTokens.length) * 100) / 100 : cdAmountTotal;
         return sum + share;
      }
    }
    return sum;
  }, 0);
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
        if (srNoToNetAmount) {
            const totalBillAmountInParchi = parchiTokens.reduce((s, token) => s + (srNoToNetAmount.get(token.toLowerCase()) || 0), 0);
            const currentBillAmount = srNoToNetAmount.get(targetSrNo.toLowerCase()) || 0;
            if (totalBillAmountInParchi > 0) {
                const weight = currentBillAmount / totalBillAmountInParchi;
                ledgerShare = Math.round(ledgerAmountFallback * weight * 100) / 100;
            } else {
                ledgerShare = Math.round((ledgerAmountFallback / parchiTokens.length) * 100) / 100;
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

export type OutstandingResult = {
  outstanding: number;
  totalPaid: number;
  totalCd: number;
  totalExtra: number;
  adjustedOriginal: number;
  paymentsForEntry: (Payment | CustomerPayment)[];
};

/**
 * Calculate outstanding for an entry - SAME logic as DetailsDialog.
 */
export function calculateOutstandingForEntry(
  entry: Customer,
  paymentHistory: (Payment | CustomerPayment)[],
  srNoToNetAmount?: Map<string, number>
): OutstandingResult {
  const targetSrNo = String(entry.srNo || "").trim().toLowerCase();
  const targetId = String(entry.id || "").trim().toLowerCase();
  
  const payments = getPaymentsForEntry(targetSrNo, targetId, paymentHistory);

  const totalPaid = calcTotalPaid(payments, targetSrNo, targetId, srNoToNetAmount);
  const totalCd = calcTotalCd(payments, targetSrNo, targetId, srNoToNetAmount);
  const totalExtra = calcTotalExtra(payments, targetSrNo, targetId, srNoToNetAmount);

  const netAmount = Number(entry.originalNetAmount ?? entry.netAmount ?? 0);
  const baseOriginal = netAmount + (Number((entry as any).advanceFreight) || 0);
  const adjustedOriginal = baseOriginal + totalExtra;
  const outstanding = adjustedOriginal - totalPaid - totalCd;

  return {
    outstanding: Math.round(outstanding * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalCd: Math.round(totalCd * 100) / 100,
    totalExtra: Math.round(totalExtra * 100) / 100,
    adjustedOriginal: Math.round(adjustedOriginal * 100) / 100,
    paymentsForEntry: payments,
  };
}

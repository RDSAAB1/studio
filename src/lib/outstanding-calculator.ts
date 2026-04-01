/**
 * Shared outstanding calculation - MUST match DetailsDialog logic exactly.
 * Used by use-supplier-summary so the outstanding entries table shows the same
 * value as "Details for SR No" dialog.
 */
import type { Customer, Payment, CustomerPayment } from "@/lib/definitions";

function getPaymentsForEntry(srNo: string, paymentHistory: (Payment | CustomerPayment)[]): (Payment | CustomerPayment)[] {
  const targetSrNo = String(srNo || "").trim().toLowerCase();
  const filtered = (paymentHistory || []).filter((p) => {
    const paidForMatch = p.paidFor?.some(
      (pf) => String(pf.srNo || "").trim().toLowerCase() === targetSrNo
    );
    const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
    const parchiTokens = parchiNoRaw
      .split(/[,\s]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
    const parchiMatch = parchiTokens.includes(targetSrNo) || parchiNoRaw === targetSrNo;
    return Boolean(paidForMatch || parchiMatch);
  });
  // Deduplicate by paymentId (same as DetailsDialog)
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

function calcTotalPaid(payments: (Payment | CustomerPayment)[], targetSrNo: string): number {
  return payments.reduce((sum, p) => {
    const paidForThis = p.paidFor?.find(
      (pf) => String(pf.srNo || "").trim().toLowerCase() === targetSrNo
    );
    const receiptType = String((p as any).receiptType || "").trim().toLowerCase();
    const isLedger = receiptType === "ledger";
    const isLedgerCredit =
      String((p as any).drCr || "").trim().toLowerCase() === "credit" ||
      Number((p as any).amount || 0) < 0;

    if (paidForThis) {
      if (isLedger && isLedgerCredit) return sum;
      return sum + Number(paidForThis.amount || 0);
    }

    if (isLedger) {
      const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
      const parchiTokens = parchiNoRaw
        .split(/[,\s]+/g)
        .map((t) => t.trim())
        .filter(Boolean);
      const parchiMatch = parchiTokens.includes(targetSrNo) || parchiNoRaw === targetSrNo;
      if (parchiMatch && !isLedgerCredit) {
        const amountAbs = Math.abs(Number((p as any).amount || 0));
        const share =
          parchiTokens.length > 0
            ? Math.round((amountAbs / parchiTokens.length) * 100) / 100
            : amountAbs;
        return sum + share;
      }
    }

    return sum;
  }, 0);
}

function calcTotalCd(payments: (Payment | CustomerPayment)[], targetSrNo: string): number {
  return payments.reduce((sum, p) => {
    const paidForThisDetail = p.paidFor?.find(
      (pf) => String(pf.srNo || "").trim().toLowerCase() === targetSrNo
    );
    if (!paidForThisDetail) return sum;

    if (
      "cdAmount" in paidForThisDetail &&
      paidForThisDetail.cdAmount !== undefined &&
      paidForThisDetail.cdAmount !== null
    ) {
      return sum + Number(paidForThisDetail.cdAmount || 0);
    }

    if ((p as any).cdAmount && p.paidFor && p.paidFor.length > 0) {
      const totalAmountInPayment = p.paidFor.reduce(
        (s: number, i: any) => s + Number(i.amount || 0),
        0
      );
      if (totalAmountInPayment > 0) {
        const proportion = Number(paidForThisDetail.amount || 0) / totalAmountInPayment;
        return sum + Math.round((p as any).cdAmount * proportion * 100) / 100;
      }
    }
    return sum;
  }, 0);
}

function calcTotalExtra(payments: (Payment | CustomerPayment)[], targetSrNo: string): number {
  return payments.reduce((sum, p) => {
    const paidForThis = p.paidFor?.find(
      (pf) => String(pf.srNo || "").trim().toLowerCase() === targetSrNo
    );
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
      parchiTokens.includes(targetSrNo) || parchiNoRaw === targetSrNo;

    const paymentLevelExtraRawFromFields =
      Number((p as any).extraAmount || 0) + Number((p as any).advanceAmount || 0);
    const ledgerAmountFallback =
      isLedger && (p.paidFor?.length || 0) === 0 && paymentLevelExtraRawFromFields === 0
        ? Math.abs(Number((p as any).amount || 0))
        : 0;
    const paymentLevelExtraRaw = paymentLevelExtraRawFromFields + ledgerAmountFallback;
    const ledgerShare =
      isLedger && isPaymentAttachedToThisEntry && ledgerAmountFallback > 0 && parchiTokens.length > 0
        ? Math.round((ledgerAmountFallback / parchiTokens.length) * 100) / 100
        : ledgerAmountFallback;

    // When paidFor has extraAmount, payment.extraAmount = sum of paidFor — don't add both (double count)
    const includePaymentLevelExtra =
      paidForExtra === 0 && (paidForExtra === 0 || !(receiptType === "ledger" || receiptType === "online"));
    const paymentLevelExtra =
      isPaymentAttachedToThisEntry && includePaymentLevelExtra
        ? isLedger
          ? isLedgerCredit
            ? -(paymentLevelExtraRawFromFields + ledgerShare)
            : 0
          : paymentLevelExtraRaw
        : 0;

    return sum + paidForExtra + paymentLevelExtra;
  }, 0);
}

export type OutstandingResult = {
  outstanding: number;
  totalPaid: number;
  totalCd: number;
  totalExtra: number;
  paymentsForEntry: (Payment | CustomerPayment)[];
};

/**
 * Calculate outstanding for an entry - SAME logic as DetailsDialog.
 * Outstanding = (originalNetAmount + totalExtra) - totalPaid - totalCd
 */
export function calculateOutstandingForEntry(
  entry: Customer,
  paymentHistory: (Payment | CustomerPayment)[]
): OutstandingResult {
  const targetSrNo = String(entry.srNo || "").trim().toLowerCase();
  const payments = getPaymentsForEntry(targetSrNo, paymentHistory);

  const totalPaid = calcTotalPaid(payments, targetSrNo);
  const totalCd = calcTotalCd(payments, targetSrNo);
  const totalExtra = calcTotalExtra(payments, targetSrNo);

  // For customer: include advanceFreight in base (increases receivable)
  const baseOriginal = Number(entry.originalNetAmount ?? entry.netAmount ?? 0) + (Number((entry as any).advanceFreight) || 0);
  const adjustedOriginal = baseOriginal + totalExtra;
  const outstanding = adjustedOriginal - totalPaid - totalCd;

  return {
    outstanding: Math.round(outstanding * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalCd: Math.round(totalCd * 100) / 100,
    totalExtra: Math.round(totalExtra * 100) / 100,
    paymentsForEntry: payments,
  };
}

export { getPaymentsForEntry };

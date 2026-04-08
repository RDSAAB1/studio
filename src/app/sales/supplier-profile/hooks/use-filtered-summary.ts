import { useMemo } from 'react';
import type { Customer, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

// Helper functions for formatting and math
const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

interface UseFilteredSummaryProps {
  type: 'supplier' | 'customer' | 'outsider';
  selectedSupplierSummary: any;
  selectedEntries: Customer[];
  paymentHistory: Payment[];
  transactionsForSelectedSupplier: Customer[];
  isWithinDateRange: (date: string | Date | undefined) => boolean;
  filterVariety: string;
  paymentMethod?: string;
  govExtraAmount?: number;
  govRate?: number;
  minRate?: number;
  selectedCustomerKey: string | null;
}

/**
 * Custom hook to calculate the filtered summary for a selected set of entries.
 * Extracted from UnifiedPaymentsClient to reduce file size and improve HMR speed.
 */
export function useFilteredSummary({
  type,
  selectedSupplierSummary,
  selectedEntries = [],
  paymentHistory = [],
  transactionsForSelectedSupplier = [],
  isWithinDateRange,
  filterVariety,
  paymentMethod,
  govExtraAmount,
  selectedCustomerKey
}: UseFilteredSummaryProps) {
  
  return useMemo(() => {
    if (type === 'outsider') return null;
    if (!selectedSupplierSummary) return null;
    
    // Determine base transactions depending on selection
    const selectedSrNos = new Set(
      selectedEntries.map((e: Customer) => (e.srNo || "").toLowerCase()).filter(Boolean)
    );
    
    const filteredTransactions = selectedEntries && selectedEntries.length > 0
      ? transactionsForSelectedSupplier.filter((t: Customer) =>
          selectedSrNos.has((t.srNo || "").toLowerCase())
        )
      : transactionsForSelectedSupplier;

    let totalGrossWeight = 0;
    let totalTeirWeight = 0;
    let totalFinalWeight = 0;
    let totalKartaWeight = 0;
    let totalNetWeight = 0;

    let totalKartaAmount = 0;
    let totalLabouryAmount = 0;
    let totalKanta = 0;
    let totalOther = 0;
    let totalBaseOriginalAmount = 0;
    let totalAmountBinaDeduction = 0;

    let totalWeightedRate = 0;
    let minRateFound = 0;
    let maxRateFound = 0;
    let totalKartaPercentage = 0;
    let totalLabouryRate = 0;

    const outstandingEntryIds: string[] = [];
    const filteredSrNosSet = new Set<string>();

    for (const t of filteredTransactions) {
      totalGrossWeight += Number(t.grossWeight) || 0;
      totalTeirWeight += Number(t.teirWeight) || 0;
      totalFinalWeight += Number((t as any).weight) || 0;
      totalKartaWeight += Number(t.kartaWeight) || 0;

      const netWeight = Number(t.netWeight) || 0;
      totalNetWeight += netWeight;

      totalKartaAmount += Number(t.kartaAmount) || 0;
      totalLabouryAmount += Number(t.labouryAmount) || 0;
      totalKanta += Number(t.kanta) || 0;
      totalOther += Number(t.otherCharges) || 0;

      const base = Number(t.originalNetAmount) || 0;
      const advance = type === 'customer' ? (Number((t as any).advanceFreight) || 0) : 0;
      totalBaseOriginalAmount += base + advance;

      const amt = Number(t.amount) || 0;
      if (amt > 0) {
        totalAmountBinaDeduction += amt;
      } else {
        const rate = String((t as any).variety || '').toLowerCase() === 'rice bran' && (Number((t as any).calculatedRate) || 0) > 0
          ? Number((t as any).calculatedRate) || 0
          : Number(t.rate) || 0;
        totalAmountBinaDeduction += round2(rate * (Number((t as any).weight) || 0));
      }

      const rateValue = Number(t.rate) || 0;
      totalWeightedRate += rateValue * netWeight;
      if (rateValue > 0) {
        if (minRateFound === 0 || rateValue < minRateFound) minRateFound = rateValue;
        if (rateValue > maxRateFound) maxRateFound = rateValue;
      }

      totalKartaPercentage += Number(t.kartaPercentage) || 0;
      totalLabouryRate += Number(t.labouryRate) || 0;

      const srNoLower = (t.srNo || "").toLowerCase();
      if (srNoLower) filteredSrNosSet.add(srNoLower);

      const outstanding = Number((t as any).outstandingForEntry ?? t.netAmount ?? 0);
      if (outstanding > 0.01 && t.id) outstandingEntryIds.push(t.id);
    }

    const filteredPayments = (paymentHistory || []).filter((p: Payment) => {
      const pfRaw = p.paidFor as any;
      let safePaidFor: any[] = [];
      if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
      else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
          try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
      }
        
      const paidForMatch = safePaidFor.some(pf => filteredSrNosSet.has((pf.srNo || "").toLowerCase()));
      if (paidForMatch) return true;
      const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
      const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(t => t.trim()).filter(Boolean);
      const parchiMatch = parchiTokens.some(token => filteredSrNosSet.has(token));
      return parchiMatch;
    });
    
    // Ledger logic
    const receiptTypeOf = (p: Payment) => ((p as any).receiptType || (p as any).type || "").toString().trim().toLowerCase();
    const isLedgerCredit = (p: Payment) => {
      const drCr = String((p as any).drCr || "").trim().toLowerCase();
      const amountRaw = Number((p as any).amount || 0);
      return drCr === "credit" || amountRaw < 0;
    };

    let totalPaid = 0;
    let totalCd = 0;
    let totalCashPaid = 0;
    let totalRtgsPaid = 0;
    let totalGovExtraAmount = 0;
    let totalLinkedLedgerCredit = 0;

    for (const payment of filteredPayments) {
      const receiptType = receiptTypeOf(payment);
      
      const pfRaw = payment.paidFor as any;
      let paidForList: any[] = [];
      if (Array.isArray(pfRaw)) paidForList = pfRaw;
      else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
          try { paidForList = JSON.parse(pfRaw); } catch { paidForList = []; }
      }

      const hasAnyPaidForExtra = paidForList.some((pf) => Number((pf as any).extraAmount || 0) > 0);
      const isLedger = receiptType === "ledger";
      const ledgerCredit = isLedger && isLedgerCredit(payment);

      if (paidForList.length > 0) {
        const totalPaidForInPayment = paidForList.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);

        for (const pf of paidForList) {
          const srNoLower = (pf.srNo || "").toLowerCase();
          if (!srNoLower || !filteredSrNosSet.has(srNoLower)) continue;

          const pfAmount = Number(pf.amount || 0);

          if (!isLedger || !ledgerCredit) {
            totalPaid += pfAmount;
          } else {
            totalLinkedLedgerCredit += pfAmount;
          }

          const extraAmount = Number((pf as any).extraAmount || 0);
          if (extraAmount > 0) totalGovExtraAmount += extraAmount;

          if ('cdAmount' in pf && (pf as any).cdAmount !== undefined && (pf as any).cdAmount !== null) {
            totalCd += Number((pf as any).cdAmount || 0);
          } else if (payment.cdAmount && totalPaidForInPayment > 0) {
            const proportion = pfAmount / totalPaidForInPayment;
            totalCd += round2(Number(payment.cdAmount) * proportion);
          }

          if (receiptType === 'cash') {
            totalCashPaid += pfAmount;
          } else if (receiptType === 'rtgs') {
            totalRtgsPaid += pfAmount;
          }
        }
      } else {
        const parchiNoRaw = String((payment as any).parchiNo || (payment as any).checkNo || "").trim().toLowerCase();
        const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t: string) => t.trim()).filter(Boolean);
        if (parchiTokens.length > 0) {
          const matchingTokenCount = parchiTokens.reduce((count: number, token: string) => {
            return filteredSrNosSet.has(token) ? count + 1 : count;
          }, 0);

          if (matchingTokenCount > 0) {
            const amountAbs = Math.abs(Number((payment as any).amount || 0));
            const share = parchiTokens.length > 0 ? round2(amountAbs / parchiTokens.length) : amountAbs;
            
            const cdTotal = Number(payment.cdAmount || 0);
            const cdShare = (cdTotal > 0 && parchiTokens.length > 0) ? round2(cdTotal / parchiTokens.length) : cdTotal;

            if (!isLedger || !ledgerCredit) {
              totalPaid += share * matchingTokenCount;
            }
            
            if (cdTotal > 0) {
              totalCd += cdShare * matchingTokenCount;
            }

            if (receiptType === 'cash') {
              totalCashPaid += share * matchingTokenCount;
            } else if (receiptType === 'rtgs') {
              totalRtgsPaid += share * matchingTokenCount;
            }
          }
        }
      }

      const rt = String((payment as any).receiptType || '').trim().toLowerCase();
      const isGov = rt === 'gov.' || rt === 'gov' || rt.startsWith('gov');
      const govExtra = Number((payment as any).govExtraAmount || 0);
      if (isGov && govExtra > 0 && !hasAnyPaidForExtra) {
        totalGovExtraAmount += govExtra;
      }
    }

    // Include current form's govExtraAmount when in Gov mode
    if (type === 'supplier' && paymentMethod === 'Gov.' && (govExtraAmount || 0) > 0) {
      const formExtra = Number(govExtraAmount || 0);
      const selectedMatch = selectedEntries?.some((e: Customer) =>
        filteredSrNosSet.has((e.srNo || '').toLowerCase())
      );
      if (selectedMatch) {
        totalGovExtraAmount += formExtra;
      }
    }
    
    const totalOriginalAmount = totalBaseOriginalAmount + totalGovExtraAmount + totalLinkedLedgerCredit;
    
    // Ledger candidates
    const ledgerCandidatePayments = (paymentHistory || []).filter((p: Payment) => {
      const receiptType = ((p as any).receiptType || (p as any).type || "").toString().trim().toLowerCase();
      if (receiptType !== "ledger") return false;

      const pfRaw = p.paidFor as any;
      let safePaidFor: any[] = [];
      if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
      else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
          try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
      }

      const paidForMatch = safePaidFor.some((pf) => filteredSrNosSet.has((pf.srNo || "").toLowerCase())) || false;
      const parchiNoRaw = String((p as any).parchiNo || "").trim().toLowerCase();
      const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map((t) => t.trim()).filter(Boolean);
      const parchiMatch = parchiTokens.some((token) => filteredSrNosSet.has(token));

      return paidForMatch || parchiMatch;
    });

    const uniqueLedgerPayments = Array.from(
      new Map(
        ledgerCandidatePayments.map((p: Payment) => [
          String(p.paymentId || p.id || (p as any).rtgsSrNo || `${p.date}_${p.amount}`),
          p,
        ])
      ).values()
    );

    const ledgerAdjustment = uniqueLedgerPayments.reduce(
      (acc, p: Payment) => {
        const amountRaw = Number((p as any).amount || 0);
        const amountAbs = Math.abs(amountRaw);
        const drCrLower = String((p as any).drCr || "").trim().toLowerCase();
        const isLedgerCredit = drCrLower === "credit" || amountRaw < 0;
        const pfRaw = p.paidFor as any;
        let safePaidFor: any[] = [];
        if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
        const linkedPaid = safePaidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
        const unlinked = Math.max(0, amountAbs - linkedPaid);

        if (unlinked > 0) {
          if (isLedgerCredit) acc.credit += unlinked;
          else acc.debit += unlinked;
        }

        return acc;
      },
      { debit: 0, credit: 0 }
    );

    const ledgerCreditAmount = Math.round((totalLinkedLedgerCredit + ledgerAdjustment.credit) * 100) / 100;
    const linkedLedgerDebitPaid = filteredPayments.reduce((sum: number, p: Payment) => {
      const receiptType = String((p as any).receiptType || "").toLowerCase().trim();
      if (receiptType !== "ledger") return sum;
      const drCrLower = String((p as any).drCr || "").toLowerCase().trim();
      const amountRaw = Number((p as any).amount || 0);
      const isLedgerCredit = drCrLower === "credit" || amountRaw < 0;
      if (isLedgerCredit) return sum;
      const pfRaw = p.paidFor as any;
      let safePaidFor: any[] = [];
      if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
      const linkedPaid = safePaidFor.reduce((inner: number, pf: any) => inner + Number(pf.amount || 0), 0) || 0;
      return sum + linkedPaid;
    }, 0);
    const unlinkedLedgerDebit = Math.round(ledgerAdjustment.debit * 100) / 100;
    const ledgerDebitAmount = Math.round((linkedLedgerDebitPaid + unlinkedLedgerDebit) * 100) / 100;
    const totalAmountIncludingLedger = Math.round((totalOriginalAmount + ledgerAdjustment.credit) * 100) / 100;
    
    const baseOutstanding = totalOriginalAmount - totalPaid - totalCd;
    const totalOutstanding = Math.round((baseOutstanding + ledgerAdjustment.credit - unlinkedLedgerDebit) * 100) / 100;
    
    const safeNetWeight = totalNetWeight || 0;
    const averageRate = safeNetWeight > 0 ? totalWeightedRate / safeNetWeight : 0;
    const averageOriginalPrice = safeNetWeight > 0 ? totalOriginalAmount / safeNetWeight : 0;

    const averageKartaPercentage = filteredTransactions.length > 0 ? totalKartaPercentage / filteredTransactions.length : 0;
    const averageLabouryRate = filteredTransactions.length > 0 ? totalLabouryRate / filteredTransactions.length : 0;

    const allPaymentsForSummary = Array.from(
      new Map(
        [...filteredPayments, ...uniqueLedgerPayments].map((p: Payment) => [
          String(p.paymentId || p.id || (p as any).rtgsSrNo || `${p.date}_${p.amount}`),
          p,
        ])
      ).values()
    );

    const govPaid = (allPaymentsForSummary || [])
      .filter((p: Payment) => {
        const receiptType = ((p as any).receiptType || "").trim();
        return (
          receiptType === "Gov." ||
          receiptType.toLowerCase() === "gov" ||
          receiptType.toLowerCase().startsWith("gov")
        );
      })
      .reduce((sum: number, p: Payment) => {
          let safePaidFor: any[] = [];
          const pfRaw = p.paidFor as any;
          if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
          else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
              try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
          }

          const srNoToNetAmount = new Map<string, number>();
          (filteredTransactions || []).forEach((t: Customer) => {
              srNoToNetAmount.set(String(t.srNo || "").trim().toLowerCase(), Number(t.originalNetAmount || t.netAmount || 0));
          });

          const matchingPaidFor = safePaidFor.filter((pf: any) => {
              const pfSrNo = String(pf.srNo || "").trim().toLowerCase();
              const pfId = String(pf.supplierId || "").trim().toLowerCase();
              return (filteredTransactions || []).some((t: Customer) => {
                  const tSrNo = String(t.srNo || "").trim().toLowerCase();
                  const tId = String(t.id || "").trim().toLowerCase();
                  return (tSrNo !== "" && pfSrNo === tSrNo) || (tId !== "" && pfId === tId);
              });
          });

          if (matchingPaidFor.length > 0) {
              return sum + matchingPaidFor.reduce((paymentSum, pf) => paymentSum + (pf.amount || 0), 0);
          } else {
              const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
              const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(t => t.trim()).filter(Boolean);
              const matchingTokens = parchiTokens.filter(token => (filteredTransactions || []).some((t: Customer) => String(t.srNo || "").trim().toLowerCase() === token.toLowerCase()));

              if (matchingTokens.length > 0) {
                  const amountAbs = Math.abs(Number((p as any).amount || 0));
                  const totalBillAmountInParchi = parchiTokens.reduce((s, token) => s + (srNoToNetAmount.get(token.toLowerCase()) || 0), 0);
                  const totalMatchingShare = matchingTokens.reduce((s, token) => {
                      const weight = totalBillAmountInParchi > 0 ? ((srNoToNetAmount.get(token.toLowerCase()) || 0) / totalBillAmountInParchi) : (1 / parchiTokens.length);
                      return s + (amountAbs * weight);
                  }, 0);
                  return sum + Math.round(totalMatchingShare * 100) / 100;
              }
              return sum;
          }
      }, 0);

    return {
      ...selectedSupplierSummary,
      allTransactions: filteredTransactions,
      allPayments: allPaymentsForSummary,
      totalGrossWeight,
      totalTeirWeight,
      totalFinalWeight,
      totalKartaWeight,
      totalNetWeight,
      totalAmount: totalAmountBinaDeduction,
      totalKartaAmount,
      totalLabouryAmount,
      totalKanta,
      totalOther,
      totalOriginalAmount,
      totalBaseOriginalAmount,
      totalGovExtraAmount,
      totalPaid,
      totalCdAmount: totalCd,
      totalCashPaid,
      totalRtgsPaid,
      govPaid,
      ledgerCreditAmount,
      ledgerDebitAmount,
      totalOutstanding,
      outstandingEntryIds,
      averageRate,
      averageOriginalPrice,
      minRate: minRateFound,
      maxRate: maxRateFound,
      averageKartaPercentage,
      averageLabouryRate,
    };
  }, [
    type, 
    selectedSupplierSummary, 
    selectedEntries, 
    paymentHistory, 
    transactionsForSelectedSupplier, 
    filterVariety,
    paymentMethod,
    govExtraAmount
  ]);
}

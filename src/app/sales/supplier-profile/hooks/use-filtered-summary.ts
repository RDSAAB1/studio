import { useMemo } from 'react';
import type { Customer, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";
import { calculateGlobalSimulation } from "@/lib/outstanding-calculator";

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
    const srNoToNetAmount = new Map<string, number>();

    for (const t of filteredTransactions) {
      const srNoVal = String(t.srNo || "").trim().toLowerCase();
      if (srNoVal) {
        filteredSrNosSet.add(srNoVal);
        srNoToNetAmount.set(srNoVal, toNumber(t.originalNetAmount || t.netAmount || 0));
      }
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
      // Removed duplicate summation of totalBaseOriginalAmount here (handled by Global Simulation Pass below)

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

    // Use Global Simulation for consistency regardless of filters
    const allSupplierTransactions = (selectedSupplierSummary?.allTransactions || []) as Customer[];
    const allSupplierPayments = (selectedSupplierSummary?.allPayments || []) as Payment[];
    
    // Map to feed simulation
    const netAmountMap = new Map<string, number>();
    allSupplierTransactions.forEach(s => {
      const srNo = String(s.srNo || '').trim().toLowerCase();
      if (srNo) netAmountMap.set(srNo, Number(s.originalNetAmount || s.netAmount || 0));
    });

    const globalSimRes = calculateGlobalSimulation(allSupplierTransactions, allSupplierPayments, netAmountMap);

    // Sum results only for entries currently checked (filteredSrNosSet)
    for (const entry of allSupplierTransactions) {
      const sr = String(entry.srNo || "").toLowerCase();
      if (!filteredSrNosSet.has(sr)) continue;

      const res = globalSimRes.get(sr);
      if (!res) {
          totalBaseOriginalAmount += Number(entry.originalNetAmount || entry.netAmount || 0) + (Number((entry as any).advanceFreight) || 0);
          continue;
      }

      totalPaid += res.totalPaid;
      totalCd += res.totalCd;
      totalGovExtraAmount += res.totalExtra;
      totalBaseOriginalAmount += res.adjustedOriginal;
      
      res.paymentsForEntry.forEach((p: any) => {
          const rt = String(p.receiptType || '').trim().toLowerCase();
          if (rt === 'cash') totalCashPaid += p.shareAmount;
          else if (rt === 'rtgs') totalRtgsPaid += p.shareAmount;
      });
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
          const pfRaw = p.paidFor as any;
          let safePaidFor: any[] = [];
          if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
          else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
              try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
          }
          
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
              return sum + matchingPaidFor.reduce((paymentSum: number, pf: any) => paymentSum + (pf.amount || 0), 0);
          } else {
              const parchiNoRaw = String((p as any).parchiNo || (p as any).checkNo || "").trim().toLowerCase();
              const parchiTokens = parchiNoRaw.split(/[,\s]+/g).map(t => t.trim()).filter(Boolean);
              
              const amountAbs = Math.abs(Number((p as any).amount || 0));
              let remaining = amountAbs;
              let shareForSelection = 0;
              for (const token of parchiTokens) {
                  const billNet = srNoToNetAmount.get(token.toLowerCase()) || 0;
                  const consumption = Math.min(remaining, billNet);
                  if ((filteredTransactions || []).some(t => String(t.srNo || "").trim().toLowerCase() === token.toLowerCase())) {
                      shareForSelection += consumption;
                  }
                  remaining -= consumption;
                  if (remaining <= 0) break;
              }
              return sum + Math.round(shareForSelection * 100) / 100;
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

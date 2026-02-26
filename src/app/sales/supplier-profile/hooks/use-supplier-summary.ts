import { useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";
import { fuzzyMatchProfiles, type SupplierProfile as FuzzySupplierProfile } from "../utils/fuzzy-matching";

const MILL_OVERVIEW_KEY = 'mill-overview';

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeProfileField = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
};

const toFuzzyProfile = (source: any): FuzzySupplierProfile => ({
  name: normalizeProfileField(source?.name),
  fatherName: normalizeProfileField(source?.fatherName ?? source?.so),
  address: normalizeProfileField(source?.address),
  contact: normalizeProfileField(source?.contact),
  srNo: normalizeProfileField(source?.srNo),
});

const buildProfileKey = (profile: FuzzySupplierProfile, index: number): string => {
  const base = [profile.name, profile.fatherName || "", profile.address || ""]
    .map((part) => part.toLowerCase().replace(/\s+/g, "_"))
    .join("__")
    .replace(/^_+|_+$/g, "");

  if (base) {
    return base;
  }

  return `profile_${index}`;
};

// Helper function to parse payment ID for proper sorting
// Handles IDs like: E832, EX00039, EX00138, EX00138.1, P00081, RT00393, etc.
const parsePaymentIdForSort = (id: string): { prefix: string; numericValue: number; decimalValue: number } => {
  if (!id || typeof id !== 'string') return { prefix: '', numericValue: 0, decimalValue: 0 };
  
  // Clean the ID - remove any non-alphanumeric characters except dots
  const cleanId = id.trim().replace(/[^A-Za-z0-9.]/g, '');
  if (!cleanId) return { prefix: '', numericValue: 0, decimalValue: 0 };
  
  // Extract prefix (letters), number, and optional decimal part
  // Pattern: letters + digits + optional decimal point + optional decimal digits
  const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
  if (match && match[2]) {
    const prefix = match[1] || '';
    const numberStr = match[2] || '0';
    const decimalStr = match[3] || '0';
    
    // Convert to numbers for proper numeric comparison
    const numericValue = parseInt(numberStr, 10);
    const decimalValue = decimalStr ? parseInt(decimalStr, 10) : 0;
    
    // Validate that parsing was successful
    if (!isNaN(numericValue)) {
      return { prefix, numericValue, decimalValue };
    }
  }
  
  // Fallback: if no match or parsing failed, treat entire ID as string for prefix comparison
  return { prefix: cleanId || id, numericValue: 0, decimalValue: 0 };
};

// Sort payment by ID (ascending for chronological processing order)
const sortPaymentByIdAscending = (a: Payment, b: Payment): number => {
  try {
    const idA = (a.id || a.paymentId || '').toString().trim();
    const idB = (b.id || b.paymentId || '').toString().trim();
    
    if (!idA && !idB) return 0;
    if (!idA) return 1;
    if (!idB) return -1;
    
    const parsedA = parsePaymentIdForSort(idA);
    const parsedB = parsePaymentIdForSort(idB);
    
    // First compare prefixes alphabetically (case-insensitive)
    const prefixA = parsedA.prefix.toUpperCase();
    const prefixB = parsedB.prefix.toUpperCase();
    const prefixCompare = prefixA.localeCompare(prefixB);
    if (prefixCompare !== 0) return prefixCompare;
    
    // If prefixes are same, compare numbers numerically (ascending for chronological order)
    if (parsedA.numericValue !== parsedB.numericValue) {
      return parsedA.numericValue - parsedB.numericValue;
    }
    
    // If numbers are same, compare decimal parts (ascending)
    return parsedA.decimalValue - parsedB.decimalValue;
  } catch (error) {
    // Error sorting payment - return 0 for safe fallback
    return 0;
  }
};

// Sort payment by ID (descending for display - highest ID first)
const sortPaymentByIdDescending = (a: Payment, b: Payment): number => {
  try {
    const idA = (a.paymentId || a.id || '').toString().trim();
    const idB = (b.paymentId || b.id || '').toString().trim();
    
    if (!idA && !idB) return 0;
    if (!idA) return 1;
    if (!idB) return -1;
    
    const parsedA = parsePaymentIdForSort(idA);
    const parsedB = parsePaymentIdForSort(idB);
    
    // First compare prefixes alphabetically (case-insensitive)
    const prefixA = parsedA.prefix.toUpperCase();
    const prefixB = parsedB.prefix.toUpperCase();
    const prefixCompare = prefixA.localeCompare(prefixB);
    if (prefixCompare !== 0) return prefixCompare;
    
    // If prefixes are same, compare numbers numerically (descending - highest first)
    if (parsedA.numericValue !== parsedB.numericValue) {
      return parsedB.numericValue - parsedA.numericValue;
    }
    
    // If numbers are same, compare decimal parts (descending)
    return parsedB.decimalValue - parsedA.decimalValue;
  } catch (error) {
    // Error sorting payment - return 0 for safe fallback
    return 0;
  }
};

export const useSupplierSummary = (
  suppliers: Supplier[],
  paymentHistory: Payment[],
  startDate?: Date,
  endDate?: Date
) => {
  const supplierSummaryMap = useMemo(() => {
    // Return empty map if data is not loaded yet
    if (!suppliers || !Array.isArray(suppliers) || !paymentHistory || !Array.isArray(paymentHistory)) {
      return new Map<string, CustomerSummary>();
    }


    const processedSuppliers = suppliers.map(s => {
      // Find all payments for this specific purchase (srNo)
      const entrySrNo = String(s.srNo || '').trim().toLowerCase();
      const paymentsForEntry = paymentHistory.filter(p => {
        const paidForMatch = p.paidFor?.some(pf => String(pf.srNo || '').trim().toLowerCase() === entrySrNo);
        const parchiMatch = String((p as any).parchiNo || '').trim().toLowerCase() === entrySrNo;
        return Boolean(paidForMatch || parchiMatch);
      });
      
      let totalPaidForEntry = 0;
      let totalCdForEntry = 0;
      let totalCashPaidForEntry = 0;
      let totalRtgsPaidForEntry = 0;
      let totalGovExtraForEntry = 0;
      let totalExtraForEntry = 0;

      // DIRECT DATABASE VALUES: No calculation, just sum values directly from database
      paymentsForEntry.forEach(payment => {
        const paidForThisPurchase = payment.paidFor?.find(pf => String(pf.srNo || '').trim().toLowerCase() === entrySrNo);
        const receiptType = (payment.receiptType || '').toString().trim().toLowerCase();
        const paidForExtraForThisEntry = Number((paidForThisPurchase as any)?.extraAmount || 0);
        const paymentLevelExtraRawFromFields =
          (Number((payment as any).extraAmount) || 0) + (Number((payment as any).advanceAmount) || 0);
        const ledgerAmountFallback =
          receiptType === 'ledger' &&
          (payment.paidFor?.length || 0) === 0 &&
          paymentLevelExtraRawFromFields === 0
            ? Math.abs(Number((payment as any).amount || 0))
            : 0;
        const paymentLevelExtraRaw = paymentLevelExtraRawFromFields + ledgerAmountFallback;
        const paymentLevelExtraSign =
          receiptType === 'ledger' && String((payment as any).drCr || '').toLowerCase() === 'credit' ? -1 : 1;
        const paymentLevelExtra = paymentLevelExtraRaw * paymentLevelExtraSign;
        const shouldAttachPaymentLevelExtra =
          paymentLevelExtraRaw !== 0 &&
          (receiptType === 'ledger' || receiptType === 'online') &&
          String((payment as any).parchiNo || '').trim().toLowerCase() === entrySrNo &&
          paidForExtraForThisEntry === 0;

        if (shouldAttachPaymentLevelExtra) {
          totalExtraForEntry += paymentLevelExtra;
        }

        if (paidForThisPurchase) {
          // Direct database value - no calculation
          totalPaidForEntry += Number(paidForThisPurchase.amount || 0);
          
          // Calculate Gov Extra Amount share for this entry
          // Use extraAmount from paidFor details if available (highest priority as it's specific to this entry)
          // This matches the data structure where extraAmount is stored in paidFor array
          if (paidForExtraForThisEntry > 0) {
            totalGovExtraForEntry += paidForExtraForThisEntry;
          }
          // Fallback logic (only if no specific extra amount in paidFor but parent has it - unlikely with new logic)
          else if (payment.govExtraAmount && payment.govExtraAmount > 0) {
            const totalPaidInPayment = payment.paidFor!.reduce((sum, pf) => sum + Number(pf.amount || 0), 0);
            if (totalPaidInPayment > 0) {
              const proportion = Number(paidForThisPurchase.amount || 0) / totalPaidInPayment;
              totalGovExtraForEntry += (payment.govExtraAmount * proportion);
            }
          }

          // CD amount calculation: First check if directly stored in paidFor (new format), else calculate proportionally
          if ('cdAmount' in paidForThisPurchase && paidForThisPurchase.cdAmount !== undefined && paidForThisPurchase.cdAmount !== null) {
            // New format: CD amount directly stored in paidFor
            totalCdForEntry += Number(paidForThisPurchase.cdAmount || 0);
          } else if (payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
            // Old format: Calculate proportionally from payment.cdAmount
            // Check cdAmount even if cdApplied is not explicitly set (for cash payments)
            const totalPaidForInPayment = payment.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
            if (totalPaidForInPayment > 0) {
              const proportion = Number(paidForThisPurchase.amount || 0) / totalPaidForInPayment;
              totalCdForEntry += Math.round(payment.cdAmount * proportion * 100) / 100;
            }
          }
          
          // Calculate payment amount based on type (for cash/rtgs breakdown)
          // IMPORTANT: Always use paidFor.amount for outstanding calculation
          // RTGS amount is only for display/tracking, not for outstanding calculation
          const receiptTypeForBreakdown = payment.receiptType?.toLowerCase();
          const actualPaidAmount = Number(paidForThisPurchase.amount || 0);
          
          if (receiptTypeForBreakdown === 'cash') {
            // For cash, use actual paid amount
            totalCashPaidForEntry += actualPaidAmount;
          } else if (receiptTypeForBreakdown === 'rtgs') {
            // IMPORTANT: For RTGS, use actual paid amount (paidFor.amount), NOT rtgsAmount
            // rtgsAmount is only for display/tracking purposes (cash vs RTGS breakdown)
            // Outstanding calculation should always use paidFor.amount
            totalRtgsPaidForEntry += actualPaidAmount;
          }
        }
      });

      totalExtraForEntry += totalGovExtraForEntry;

      // Removed debug logging for performance

      // Direct database sum - no calculation
      const finalTotalPaid = Math.round(totalPaidForEntry * 100) / 100;
      const finalTotalCd = Math.round(totalCdForEntry * 100) / 100;
      
      // Initialize variables (will be calculated in outstanding calculation)
      // Outstanding calculation using new method:
      // 1. Get base outstanding from supplier data (originalNetAmount - this is the actual outstanding before any payments)
      // 2. Add all extra amounts from Gov payments (chronologically by payment ID order)
      // 3. This gives Total Payable Amount
      // 4. Subtract all payments made (chronologically by payment ID order) from Total Payable Amount
      // 5. Result = Outstanding (no capping needed)
      
      // Step 1: Get base outstanding from supplier entry
      // IMPORTANT: Use originalNetAmount as the base (original amount before any payments)
      // This is the "actual outstanding" from supplier data as per user's requirement
      const baseOutstanding = s.originalNetAmount || 0;
      
      // Step 2: Calculate Total Payable Amount = Base Outstanding + Gov Extra Amount
      // Gov Extra Amount increases the amount payable to the supplier (e.g. bonus)
      const totalPayableAmount = baseOutstanding + totalExtraForEntry;
      
      // Step 3: Subtract all payments made
      // Step 4: Use finalTotalPaid (already calculated) for consistency
      
      // This ensures we use the same payment amount that was used for totalPaidForEntry
      // IMPORTANT: finalTotalPaid is the direct sum from all payments, which is more reliable
      // than recalculating from sorted payments which might have rounding differences
      
      // Step 5: Calculate Outstanding = Total Payable - All Payments - All CD (no capping)
      // Use finalTotalPaid instead of recalculating totalPaidAmount to ensure consistency
      let finalOutstanding = totalPayableAmount - finalTotalPaid - finalTotalCd;
      
      return {
        ...s,
        totalPaidForEntry: finalTotalPaid,
        totalGovExtraForEntry,
        totalExtraForEntry,
        totalCdForEntry: finalTotalCd,
        totalCd: finalTotalCd, // Map totalCdForEntry to totalCd for compatibility
        totalPaid: finalTotalPaid, // Direct database sum
        totalCashPaidForEntry,
        totalRtgsPaidForEntry,
        paymentsForEntry,
        // Outstanding: Adjusted Original - (Paid + CD)
        outstandingForEntry: Math.round(finalOutstanding * 100) / 100,
        // netAmount mirrors outstandingForEntry for downstream logic
        netAmount: Math.round(finalOutstanding * 100) / 100,
      };
    });

    const finalSummaryMap = new Map<string, CustomerSummary>();

    type SupplierGroup = {
      key: string;
      profile: FuzzySupplierProfile;
      suppliers: typeof processedSuppliers;
    };

    const supplierGroups: SupplierGroup[] = [];

    processedSuppliers.forEach((supplier) => {
      const profile = toFuzzyProfile(supplier);
      let bestIndex = -1;
      let bestDifference = Number.POSITIVE_INFINITY;

      supplierGroups.forEach((group, index) => {
        const match = fuzzyMatchProfiles(profile, group.profile);
        if (!match.isMatch) {
          return;
        }
        if (match.totalDifference < bestDifference) {
          bestDifference = match.totalDifference;
          bestIndex = index;
        }
      });

      if (bestIndex >= 0) {
        supplierGroups[bestIndex].suppliers.push(supplier);
      } else {
        const key = buildProfileKey(profile, supplierGroups.length + 1);
        supplierGroups.push({ key, profile, suppliers: [supplier] });
      }
    });

    // Create summary for each fuzzy-matched profile group
    supplierGroups.forEach(({ key: groupKey, profile: groupProfile, suppliers: groupSuppliers }, groupIndex) => {
      const firstSupplier = groupSuppliers[0];
      const displayName = groupProfile.name || firstSupplier.name || `Supplier ${groupIndex + 1}`;
      const displayFather = groupProfile.fatherName || firstSupplier.so || firstSupplier.fatherName || '';
      const displayAddress = groupProfile.address || firstSupplier.address || '';
      
      // Get all unique payments for this group and sort them for display
      const allPayments = groupSuppliers.flatMap(s => s.paymentsForEntry);
      const uniquePayments = Array.from(
        new Map(allPayments.map(p => [p.paymentId || p.id || `${p.date}_${p.amount}`, p])).values()
      ).sort(sortPaymentByIdDescending);
      
      // Calculate total RTGS paid from actual RTGS payments
      // IMPORTANT: Use sum of paidFor.amount, not rtgsAmount
      // rtgsAmount is for display/tracking only, but financial calculations should use paidFor.amount
      const totalRtgsPaidFromPayments = uniquePayments.reduce((sum, p) => {
        const receiptType = (p as any).receiptType?.toLowerCase() || (p as any).type?.toLowerCase();
        if (receiptType === 'rtgs') {
          // Sum of paidFor.amount for RTGS payments (not rtgsAmount)
          const rtgsPaidAmount = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
          return sum + rtgsPaidAmount;
        }
        return sum;
      }, 0);
      
      // Calculate total Cash paid from actual Cash payments
      // IMPORTANT: Use sum of paidFor.amount for consistency
      const totalCashPaidFromPayments = uniquePayments.reduce((sum, p) => {
        const receiptType = (p as any).receiptType?.toLowerCase() || (p as any).type?.toLowerCase();
        if (receiptType === 'cash') {
          // Sum of paidFor.amount for cash payments
          const cashPaidAmount = p.paidFor?.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0) || 0;
          return sum + cashPaidAmount;
        }
        return sum;
      }, 0);
      
      // Merge all suppliers in the group with proper payment calculations
      const totalBaseOriginalAmount = groupSuppliers.reduce((sum, s) => sum + toNumber(s.originalNetAmount), 0);
      const totalGovExtraAmount = groupSuppliers.reduce((sum, s) => sum + toNumber((s as any).totalGovExtraForEntry || 0), 0);
      const totalOriginalAmount = totalBaseOriginalAmount + totalGovExtraAmount;
      const totalCdAmount = groupSuppliers.reduce((sum, s) => sum + toNumber(s.totalCdForEntry), 0);
      
      // IMPORTANT: Use totalPaid (from paidFor.amount) for outstanding calculation, not totalCashPaid + totalRtgsPaid
      // totalPaid is calculated from totalPaidForEntry which uses paidFor.amount (correct)
      // totalCashPaid and totalRtgsPaid are for display/tracking only
      const totalPaid = groupSuppliers.reduce((sum, s) => sum + toNumber(s.totalPaidForEntry), 0);

      const ledgerAdjustment = uniquePayments.reduce(
        (acc, p) => {
          const receiptType = (p as any).receiptType?.toLowerCase() || (p as any).type?.toLowerCase();
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

      const baseOutstanding = groupSuppliers.reduce((sum, s) => sum + toNumber(s.outstandingForEntry), 0);
      const totalOutstanding = Math.round((baseOutstanding + ledgerAdjustment.debit - ledgerAdjustment.credit) * 100) / 100;
      
      const mergedData: CustomerSummary = {
        ...firstSupplier,
        name: displayName,
        so: displayFather,
        address: displayAddress,
        totalAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.amount) + toNumber((s as any).totalGovExtraForEntry || 0), 0),
        totalOriginalAmount,
        totalBaseOriginalAmount,
        totalGovExtraAmount,
        // Use totalPaidForEntry which includes all payment types (cash, rtgs, etc.)
        totalPaid: totalPaid,
        totalCashPaid: totalCashPaidFromPayments,
        totalRtgsPaid: totalRtgsPaidFromPayments,
        totalCdAmount,
        // IMPORTANT: Final Outstanding = Sum of all individual entry outstanding amounts
        // This ensures consistency: Final Outstanding = Sum of all Outstanding column values
        totalOutstanding,
        paymentHistory: [...groupSuppliers.flatMap(s => s.paymentsForEntry)].sort(sortPaymentByIdDescending),
        outstandingEntryIds: groupSuppliers.filter(s => s.outstandingForEntry > 0).map(s => s.srNo),
        allTransactions: groupSuppliers,
        allPayments: [...groupSuppliers.flatMap(s => s.paymentsForEntry)].sort(sortPaymentByIdDescending),
        transactionsByVariety: groupSuppliers.reduce((acc, s) => {
          const variety = toTitleCase(s.variety);
          acc[variety] = (acc[variety] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalGrossWeight: groupSuppliers.reduce((sum, s) => {
          let grossWeight = 0;
          const storedGrossWeight = s.grossWeight !== null && s.grossWeight !== undefined ? toNumber(s.grossWeight) : null;
          const storedTeirWeight = s.teirWeight !== null && s.teirWeight !== undefined ? toNumber(s.teirWeight) : null;
          const storedWeight = s.weight !== null && s.weight !== undefined ? toNumber(s.weight) : null;
          
          // Priority 1: Use stored grossWeight if it's a valid positive number
          if (storedGrossWeight !== null && !isNaN(storedGrossWeight) && storedGrossWeight > 0) {
            grossWeight = storedGrossWeight;
          }
          // Priority 2: Calculate from weight + teirWeight if both are available
          else if (storedWeight !== null && storedTeirWeight !== null && !isNaN(storedWeight) && !isNaN(storedTeirWeight)) {
            grossWeight = storedWeight + storedTeirWeight;
          }
          // Priority 3: If grossWeight is 0/null but weight exists, check if it makes sense
          // If weight > 0 and grossWeight is 0, it's likely missing data, so calculate from weight
          else if (storedWeight !== null && !isNaN(storedWeight) && storedWeight > 0) {
            // If teirWeight is available, use it; otherwise assume 0
            const teirWeight = storedTeirWeight !== null && !isNaN(storedTeirWeight) ? storedTeirWeight : 0;
            grossWeight = storedWeight + teirWeight;
          }
          // Priority 4: Use stored value even if 0 (might be legitimate)
          else if (storedGrossWeight !== null && !isNaN(storedGrossWeight)) {
            grossWeight = storedGrossWeight;
          }
          
          return sum + (Number.isFinite(grossWeight) && grossWeight >= 0 ? grossWeight : 0);
        }, 0),
        totalTeirWeight: groupSuppliers.reduce((sum, s) => {
          let teirWeight = 0;
          const storedGrossWeight = s.grossWeight !== null && s.grossWeight !== undefined ? toNumber(s.grossWeight) : null;
          const storedTeirWeight = s.teirWeight !== null && s.teirWeight !== undefined ? toNumber(s.teirWeight) : null;
          const storedWeight = s.weight !== null && s.weight !== undefined ? toNumber(s.weight) : null;
          
          // Priority 1: Use stored teirWeight if it's a valid number (including 0)
          if (storedTeirWeight !== null && !isNaN(storedTeirWeight) && storedTeirWeight >= 0) {
            teirWeight = storedTeirWeight;
          }
          // Priority 2: Calculate from grossWeight - weight if both are available
          else if (storedGrossWeight !== null && storedWeight !== null && !isNaN(storedGrossWeight) && !isNaN(storedWeight)) {
            teirWeight = Math.max(0, storedGrossWeight - storedWeight);
          }
          // Priority 3: If teirWeight is missing but weight exists, assume 0
          else if (storedWeight !== null && !isNaN(storedWeight)) {
            teirWeight = 0; // Default to 0 if not provided
          }
          
          return sum + (Number.isFinite(teirWeight) && teirWeight >= 0 ? teirWeight : 0);
        }, 0),
        totalFinalWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.weight), 0),
        totalKartaWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kartaWeight), 0),
        totalNetWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.netWeight), 0),
        totalKartaAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kartaAmount), 0),
        totalLabouryAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.labouryAmount), 0),
        totalKanta: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kanta), 0),
        totalOtherCharges: groupSuppliers.reduce((sum, s) => {
            const otherCharges = toNumber(s.otherCharges);
            // Safety check: prevent extremely large values (likely data corruption)
            if (Math.abs(otherCharges) > 1000000000) { // 1 billion limit

                return sum;
            }
            return sum + otherCharges;
        }, 0),
        totalDeductions: groupSuppliers.reduce((sum, s) => sum + toNumber((s as any).deductions || 0), 0),
        averageRate: 0, // Will be calculated below
        minRate: 0, // Will be calculated below
        maxRate: 0, // Will be calculated below
        averageOriginalPrice: 0, // Will be calculated below
        averageKartaPercentage: 0, // Will be calculated below
        averageLabouryRate: 0, // Will be calculated below
        totalTransactions: groupSuppliers.length,
        totalOutstandingTransactions: groupSuppliers.filter(s => s.outstandingForEntry > 0).length,
        totalBrokerage: groupSuppliers.reduce((sum, s) => {
            // Use brokerageAmount if available, otherwise calculate from brokerageRate * netWeight
            let brokerageAmount = toNumber(s.brokerageAmount);
            if (!brokerageAmount && s.brokerageRate && s.netWeight) {
                brokerageAmount = Math.round(toNumber(s.brokerageRate) * toNumber(s.netWeight) * 100) / 100;
            }
            const signedBrokerage = (s.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            return sum + signedBrokerage;
        }, 0),
        totalCd: groupSuppliers.reduce((sum, s) => sum + toNumber(s.totalCdForEntry), 0),
      };

      // Calculate averages and rates
      const totalWeightedRate = groupSuppliers.reduce((sum, s) => {
        const rate = toNumber(s.rate);
        const netWeight = toNumber(s.netWeight);
        return sum + rate * netWeight;
      }, 0);

      const safeNetWeight = mergedData.totalNetWeight || 0;
      mergedData.averageRate = safeNetWeight > 0 ? totalWeightedRate / safeNetWeight : 0;
      mergedData.averageOriginalPrice = safeNetWeight > 0 ? mergedData.totalOriginalAmount / safeNetWeight : 0;
      
      const allValidRates = groupSuppliers.map(s => toNumber(s.rate)).filter(rate => rate > 0);
      mergedData.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
      mergedData.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;

      const totalRateData = groupSuppliers.reduce((acc, s) => {
        const rate = toNumber(s.rate);
        if(rate > 0) {
          acc.karta += toNumber(s.kartaPercentage);
          acc.laboury += toNumber(s.labouryRate);
          acc.count++;
        }
        return acc;
      }, { karta: 0, laboury: 0, count: 0 });

      if(totalRateData.count > 0) {
        mergedData.averageKartaPercentage = totalRateData.karta / totalRateData.count;
        mergedData.averageLabouryRate = totalRateData.laboury / totalRateData.count;
      }

      finalSummaryMap.set(groupKey, mergedData);
    });

    // Create mill overview with proper payment calculations
    const millSummary = Array.from(finalSummaryMap.values()).reduce((acc, s) => {
      acc.totalBaseOriginalAmount = (acc.totalBaseOriginalAmount || 0) + (s.totalBaseOriginalAmount || 0);
      acc.totalGovExtraAmount = (acc.totalGovExtraAmount || 0) + (s.totalGovExtraAmount || 0);
      // Recalculate totalOriginalAmount to ensure consistency with base + extra
      // This fixes the issue where totalOriginalAmount might not have included the extra amount correctly in the sum
      acc.totalOriginalAmount = acc.totalBaseOriginalAmount + acc.totalGovExtraAmount;
      acc.totalPaid += s.totalPaid;
      acc.totalCashPaid += s.totalCashPaid;
      acc.totalRtgsPaid += s.totalRtgsPaid;
      acc.totalCdAmount! += s.totalCdAmount!;
      acc.totalGrossWeight! += s.totalGrossWeight!;
      acc.totalTeirWeight! += s.totalTeirWeight!;
      acc.totalFinalWeight! += s.totalFinalWeight!;
      acc.totalKartaWeight! += s.totalKartaWeight!;
      acc.totalNetWeight! += s.totalNetWeight!;
      acc.totalKartaAmount! += s.totalKartaAmount!;
      acc.totalLabouryAmount! += s.totalLabouryAmount!;
      acc.totalKanta! += s.totalKanta!;
      acc.totalOtherCharges! += s.totalOtherCharges!;
      acc.totalTransactions! += s.totalTransactions!;
      acc.totalOutstandingTransactions! += s.totalOutstandingTransactions!;
      acc.totalAmount += s.totalAmount;
      acc.totalBrokerage! += s.totalBrokerage!;

      // Aggregate all payment history and outstanding entries
      acc.paymentHistory = [...acc.paymentHistory, ...s.paymentHistory];
      acc.outstandingEntryIds = [...acc.outstandingEntryIds, ...s.outstandingEntryIds];
      acc.allTransactions = [...acc.allTransactions, ...s.allTransactions];
      acc.allPayments = [...acc.allPayments, ...s.allPayments];

      Object.entries(s.transactionsByVariety!).forEach(([variety, count]) => {
        acc.transactionsByVariety![variety] = (acc.transactionsByVariety![variety] || 0) + count;
      });

      return acc;
    }, {
      name: 'Mill (Total Overview)', contact: '', so: '', address: '',
      totalAmount: 0, totalOriginalAmount: 0, totalBaseOriginalAmount: 0, totalGovExtraAmount: 0,
      totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
      totalOutstanding: 0, totalCdAmount: 0,
      paymentHistory: [], outstandingEntryIds: [], allTransactions: [], 
      allPayments: [], transactionsByVariety: {},
      totalGrossWeight: 0, totalTeirWeight: 0, totalFinalWeight: 0, totalKartaWeight: 0, totalNetWeight: 0,
      totalKartaAmount: 0, totalLabouryAmount: 0, totalKanta: 0, totalOtherCharges: 0, totalDeductions: 0,
      averageRate: 0, minRate: 0, maxRate: 0, averageOriginalPrice: 0, averageKartaPercentage: 0, averageLabouryRate: 0,
      totalTransactions: 0, totalOutstandingTransactions: 0, totalBrokerage: 0, totalCd: 0,
    });

    // Set mill overview data properly
    millSummary.allTransactions = processedSuppliers;
    // Sort paymentHistory for display (descending - highest ID first)
    millSummary.allPayments = [...paymentHistory].sort(sortPaymentByIdDescending);
    // IMPORTANT: Final Outstanding = Sum of all individual entry outstanding amounts
    // This ensures consistency: Final Outstanding = Sum of all Outstanding column values
    millSummary.totalOutstanding = processedSuppliers.reduce((sum, s) => sum + toNumber(s.outstandingForEntry), 0);
    
    // Ensure mill summary has all the necessary data
    millSummary.paymentHistory = millSummary.allPayments;
    millSummary.outstandingEntryIds = processedSuppliers
      .filter(s => s.outstandingForEntry > 0)
      .map(s => s.srNo);

    // Calculate averages and min/max for mill overview
    const millWeightedRate = millSummary.allTransactions.reduce((sum, s) => {
      const rate = toNumber(s.rate);
      const netWeight = toNumber(s.netWeight);
      return sum + rate * netWeight;
    }, 0);

    const millNetWeight = millSummary.totalNetWeight || 0;
    millSummary.averageRate = millNetWeight > 0 ? millWeightedRate / millNetWeight : 0;
    millSummary.averageOriginalPrice = millNetWeight > 0 ? millSummary.totalOriginalAmount / millNetWeight : 0;
    
    const allValidRates = millSummary.allTransactions.map(s => toNumber(s.rate)).filter(rate => rate > 0);
    millSummary.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
    millSummary.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;

    const totalRateData = millSummary.allTransactions.reduce((acc, s) => {
      const rate = toNumber(s.rate);
      if(rate > 0) {
        acc.karta += toNumber(s.kartaPercentage);
        acc.laboury += toNumber(s.labouryRate);
        acc.count++;
      }
      return acc;
    }, { karta: 0, laboury: 0, count: 0 });

    if(totalRateData.count > 0) {
      millSummary.averageKartaPercentage = totalRateData.karta / totalRateData.count;
      millSummary.averageLabouryRate = totalRateData.laboury / totalRateData.count;
    }
    
    // Set payment history for mill overview
    millSummary.paymentHistory = millSummary.allPayments;

    // Set mill overview data in the map
    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);

    return finalSummaryMap;
  }, [suppliers, paymentHistory, startDate, endDate]);

  return { supplierSummaryMap, MILL_OVERVIEW_KEY };
};

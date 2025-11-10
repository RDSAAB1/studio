import { useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

const MILL_OVERVIEW_KEY = 'mill-overview';

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
      const paymentsForEntry = paymentHistory.filter(p => 
        p.paidFor?.some(pf => pf.srNo === s.srNo)
      );
      
      let totalPaidForEntry = 0;
      let totalCdForEntry = 0;
      let totalCashPaidForEntry = 0;
      let totalRtgsPaidForEntry = 0;

      // DIRECT DATABASE VALUES: No calculation, just sum values directly from database
      paymentsForEntry.forEach(payment => {
        const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === s.srNo);
        if (paidForThisPurchase) {
          // Direct database value - no calculation
          totalPaidForEntry += Number(paidForThisPurchase.amount || 0);
          
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
          const receiptType = payment.receiptType?.toLowerCase();
          const actualPaidAmount = Number(paidForThisPurchase.amount || 0);
          
          if (receiptType === 'cash') {
            // For cash, use actual paid amount
            totalCashPaidForEntry += actualPaidAmount;
          } else if (receiptType === 'rtgs') {
            // IMPORTANT: For RTGS, use actual paid amount (paidFor.amount), NOT rtgsAmount
            // rtgsAmount is only for display/tracking purposes (cash vs RTGS breakdown)
            // Outstanding calculation should always use paidFor.amount
            totalRtgsPaidForEntry += actualPaidAmount;
          }
        }
      });

      // Removed debug logging for performance

      // Direct database sum - no calculation
      const finalTotalPaid = Math.round(totalPaidForEntry * 100) / 100;
      const finalTotalCd = Math.round(totalCdForEntry * 100) / 100;
      const finalOutstanding = (s.originalNetAmount || 0) - finalTotalPaid - finalTotalCd;
      
      return {
        ...s,
        totalPaidForEntry: finalTotalPaid,
        totalCdForEntry: finalTotalCd,
        totalCd: finalTotalCd, // Map totalCdForEntry to totalCd for compatibility
        totalPaid: finalTotalPaid, // Direct database sum
        totalCashPaidForEntry,
        totalRtgsPaidForEntry,
        paymentsForEntry,
        // Outstanding: Original - (Paid + CD)
        outstandingForEntry: Math.round(finalOutstanding * 100) / 100,
        // netAmount mirrors outstandingForEntry for downstream logic
        netAmount: Math.round(finalOutstanding * 100) / 100,
      };
    });

    const finalSummaryMap = new Map<string, CustomerSummary>();

    // Helper function to calculate Levenshtein distance
    const levenshteinDistance = (str1: string, str2: string): number => {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[str2.length][str1.length];
    };

    // Helper function to normalize strings for comparison
    const normalize = (str: string) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');

    // Group suppliers using STRICT exact matching (name + father + address must match exactly)
    const groupedSuppliers = new Map<string, typeof processedSuppliers>();
    const makeCompositeKey = (name: string, father: string, address: string) => 
        `${normalize(name)}|${normalize(father)}|${normalize(address)}`;
    
    processedSuppliers.forEach((supplier) => {
        const father = supplier.fatherName || supplier.so || '';
        const compositeKey = makeCompositeKey(supplier.name || '', father, supplier.address || '');
        
        const existing = groupedSuppliers.get(compositeKey);
        if (existing) {
            existing.push(supplier);
        } else {
            groupedSuppliers.set(compositeKey, [supplier]);
        }
    });

    // Create summary for each unique profile group
    Array.from(groupedSuppliers.entries()).forEach(([groupKey, groupSuppliers]) => {
      const firstSupplier = groupSuppliers[0];
      
      // Get all unique payments for this group
      const allPayments = groupSuppliers.flatMap(s => s.paymentsForEntry);
      const uniquePayments = Array.from(
        new Map(allPayments.map(p => [p.id || p.paymentId || `${p.date}_${p.amount}`, p])).values()
      );
      
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
      const totalOriginalAmount = groupSuppliers.reduce((sum, s) => sum + toNumber(s.originalNetAmount), 0);
      const totalCdAmount = groupSuppliers.reduce((sum, s) => sum + toNumber(s.totalCdForEntry), 0);
      
      // IMPORTANT: Use totalPaid (from paidFor.amount) for outstanding calculation, not totalCashPaid + totalRtgsPaid
      // totalPaid is calculated from totalPaidForEntry which uses paidFor.amount (correct)
      // totalCashPaid and totalRtgsPaid are for display/tracking only
      const totalPaid = groupSuppliers.reduce((sum, s) => sum + toNumber(s.totalPaidForEntry), 0);
      
      const mergedData: CustomerSummary = {
        ...firstSupplier,
        totalAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.amount), 0),
        totalOriginalAmount,
        // Use totalPaidForEntry which includes all payment types (cash, rtgs, etc.)
        totalPaid: totalPaid,
        totalCashPaid: totalCashPaidFromPayments,
        totalRtgsPaid: totalRtgsPaidFromPayments,
        totalCdAmount,
        // IMPORTANT: Outstanding = Original - Paid - CD (use totalPaid, not totalCashPaid + totalRtgsPaid)
        // totalPaid is calculated from paidFor.amount which is the correct amount
        totalOutstanding: totalOriginalAmount - totalPaid - totalCdAmount,
        paymentHistory: groupSuppliers.flatMap(s => s.paymentsForEntry),
        outstandingEntryIds: groupSuppliers.filter(s => s.outstandingForEntry > 0).map(s => s.srNo),
        allTransactions: groupSuppliers,
        allPayments: groupSuppliers.flatMap(s => s.paymentsForEntry),
        transactionsByVariety: groupSuppliers.reduce((acc, s) => {
          const variety = toTitleCase(s.variety);
          acc[variety] = (acc[variety] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalGrossWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.grossWeight), 0),
        totalTeirWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.teirWeight), 0),
        totalFinalWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.weight), 0),
        totalKartaWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kartaWeight), 0),
        totalNetWeight: groupSuppliers.reduce((sum, s) => sum + toNumber(s.netWeight), 0),
        totalKartaAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kartaAmount), 0),
        totalLabouryAmount: groupSuppliers.reduce((sum, s) => sum + toNumber(s.labouryAmount), 0),
        totalKanta: groupSuppliers.reduce((sum, s) => sum + toNumber(s.kanta), 0),
        totalOtherCharges: groupSuppliers.reduce((sum, s) => sum + toNumber(s.otherCharges), 0),
        totalDeductions: groupSuppliers.reduce((sum, s) => sum + toNumber(s.deductions), 0),
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
      acc.totalOriginalAmount += s.totalOriginalAmount;
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
      totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
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
    millSummary.allPayments = paymentHistory;
    // IMPORTANT: Outstanding = Original - Paid - CD (use totalPaid, not totalCashPaid + totalRtgsPaid)
    // totalPaid is calculated from paidFor.amount which is the correct amount
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid - millSummary.totalCdAmount!;
    
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

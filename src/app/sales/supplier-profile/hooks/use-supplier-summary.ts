import { useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

const MILL_OVERVIEW_KEY = 'mill-overview';

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
          
          // Direct database value for CD - no calculation or proportion
          if ('cdAmount' in paidForThisPurchase && paidForThisPurchase.cdAmount !== undefined && paidForThisPurchase.cdAmount !== null) {
            totalCdForEntry += Number(paidForThisPurchase.cdAmount || 0);
          }
          
          // Calculate payment amount based on type (for cash/rtgs breakdown)
          const receiptType = payment.receiptType?.toLowerCase();
          const actualPaymentAmount = Number(paidForThisPurchase.amount || 0);
          
          if (receiptType === 'cash') {
            totalCashPaidForEntry += actualPaymentAmount;
          } else if (receiptType === 'rtgs') {
            totalRtgsPaidForEntry += actualPaymentAmount;
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
      
      // Merge all suppliers in the group with proper payment calculations
      const mergedData: CustomerSummary = {
        ...firstSupplier,
        totalAmount: groupSuppliers.reduce((sum, s) => sum + (s.amount || 0), 0),
        totalOriginalAmount: groupSuppliers.reduce((sum, s) => sum + (s.originalNetAmount || 0), 0),
        // Use the calculated payment amounts for each purchase (excluding CD)
        totalPaid: groupSuppliers.reduce((sum, s) => sum + s.totalCashPaidForEntry + s.totalRtgsPaidForEntry, 0),
        totalCashPaid: groupSuppliers.reduce((sum, s) => sum + s.totalCashPaidForEntry, 0),
        totalRtgsPaid: groupSuppliers.reduce((sum, s) => sum + s.totalRtgsPaidForEntry, 0),
        totalCdAmount: groupSuppliers.reduce((sum, s) => sum + s.totalCdForEntry, 0),
        totalOutstanding: groupSuppliers.filter(s => s.outstandingForEntry > 0).reduce((sum, s) => sum + s.outstandingForEntry, 0),
        paymentHistory: groupSuppliers.flatMap(s => s.paymentsForEntry),
        outstandingEntryIds: groupSuppliers.filter(s => s.outstandingForEntry > 0).map(s => s.srNo),
        allTransactions: groupSuppliers,
        allPayments: groupSuppliers.flatMap(s => s.paymentsForEntry),
        transactionsByVariety: groupSuppliers.reduce((acc, s) => {
          const variety = toTitleCase(s.variety);
          acc[variety] = (acc[variety] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        totalGrossWeight: groupSuppliers.reduce((sum, s) => sum + (s.grossWeight || 0), 0),
        totalTeirWeight: groupSuppliers.reduce((sum, s) => sum + (s.teirWeight || 0), 0),
        totalFinalWeight: groupSuppliers.reduce((sum, s) => sum + (s.weight || 0), 0),
        totalKartaWeight: groupSuppliers.reduce((sum, s) => sum + (s.kartaWeight || 0), 0),
        totalNetWeight: groupSuppliers.reduce((sum, s) => sum + (s.netWeight || 0), 0),
        totalKartaAmount: groupSuppliers.reduce((sum, s) => sum + (s.kartaAmount || 0), 0),
        totalLabouryAmount: groupSuppliers.reduce((sum, s) => sum + (s.labouryAmount || 0), 0),
        totalKanta: groupSuppliers.reduce((sum, s) => sum + (s.kanta || 0), 0),
        totalOtherCharges: groupSuppliers.reduce((sum, s) => sum + (s.otherCharges || 0), 0),
        totalDeductions: groupSuppliers.reduce((sum, s) => sum + (s.deductions || 0), 0),
        averageRate: 0, // Will be calculated below
        minRate: 0, // Will be calculated below
        maxRate: 0, // Will be calculated below
        averageOriginalPrice: 0, // Will be calculated below
        averageKartaPercentage: 0, // Will be calculated below
        averageLabouryRate: 0, // Will be calculated below
        totalTransactions: groupSuppliers.length,
        totalOutstandingTransactions: groupSuppliers.filter(s => s.outstandingForEntry > 0).length,
        totalBrokerage: groupSuppliers.reduce((sum, s) => sum + (s.brokerage || 0), 0),
        totalCd: groupSuppliers.reduce((sum, s) => sum + s.totalCdForEntry, 0),
      };

      // Calculate averages and rates
      mergedData.averageRate = mergedData.totalFinalWeight > 0 ? mergedData.totalAmount / mergedData.totalFinalWeight : 0;
      mergedData.averageOriginalPrice = mergedData.totalNetWeight > 0 ? mergedData.totalOriginalAmount / mergedData.totalNetWeight : 0;
      
      const allValidRates = groupSuppliers.map(s => s.rate).filter(rate => rate > 0);
      mergedData.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
      mergedData.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;

      const totalRateData = groupSuppliers.reduce((acc, s) => {
        if(s.rate > 0) {
          acc.karta += s.kartaPercentage;
          acc.laboury += s.labouryRate;
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
    // Outstanding = Original - (Paid + CD)
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - (millSummary.totalPaid + millSummary.totalCdAmount!);
    
    // Ensure mill summary has all the necessary data
    millSummary.paymentHistory = millSummary.allPayments;
    millSummary.outstandingEntryIds = processedSuppliers
      .filter(s => s.outstandingForEntry > 0)
      .map(s => s.srNo);

    // Calculate averages and min/max for mill overview
    millSummary.averageRate = millSummary.totalFinalWeight > 0 ? millSummary.totalAmount / millSummary.totalFinalWeight : 0;
    millSummary.averageOriginalPrice = millSummary.totalNetWeight > 0 ? millSummary.totalOriginalAmount / millSummary.totalNetWeight : 0;
    
    const allValidRates = millSummary.allTransactions.map(s => s.rate).filter(rate => rate > 0);
    millSummary.minRate = allValidRates.length > 0 ? Math.min(...allValidRates) : 0;
    millSummary.maxRate = allValidRates.length > 0 ? Math.max(...allValidRates) : 0;

    const totalRateData = millSummary.allTransactions.reduce((acc, s) => {
      if(s.rate > 0) {
        acc.karta += s.kartaPercentage;
        acc.laboury += s.labouryRate;
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

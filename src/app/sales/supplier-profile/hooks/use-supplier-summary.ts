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

    // Debug: Log all unique payment types and sample payment structure
    const allPaymentTypes = [...new Set(paymentHistory.map(p => p.type))];
    const allReceiptTypes = [...new Set(paymentHistory.map(p => p.receiptType))];
    console.log('All Payment Types in Data:', allPaymentTypes);
    console.log('All Receipt Types in Data:', allReceiptTypes);
    
    // Log sample payment structure
    if (paymentHistory.length > 0) {
      console.log('Sample Payment Structure:', paymentHistory[0]);
      console.log('Sample Payment Type:', paymentHistory[0].type);
      console.log('Sample Receipt Type:', paymentHistory[0].receiptType);
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

      // Calculate payments for this specific purchase
      paymentsForEntry.forEach(payment => {
        const paidForThisPurchase = payment.paidFor!.find(pf => pf.srNo === s.srNo);
        if (paidForThisPurchase) {
          // Total amount paid for this purchase (including CD)
          totalPaidForEntry += paidForThisPurchase.amount;
          
          // Calculate CD portion for this purchase first
          let cdPortionForThisPurchase = 0;
          if (payment.cdApplied && payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
            const totalAmountInPayment = payment.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
            cdPortionForThisPurchase = (paidForThisPurchase.amount / totalAmountInPayment) * payment.cdAmount;
            totalCdForEntry += cdPortionForThisPurchase;
          }
          
          // Calculate the proportion of this purchase in the total payment
          const totalPaidForAmount = payment.paidFor?.reduce((sum, pf) => sum + pf.amount, 0) || 0;
          const proportion = totalPaidForAmount > 0 ? paidForThisPurchase.amount / totalPaidForAmount : 0;
          
          // Calculate payment amount based on type
          const receiptType = payment.receiptType?.toLowerCase();
          let actualPaymentAmount;
          
          if (receiptType === 'cash') {
            // For cash payments, payment.amount is already the actual payment amount (₹5000)
            actualPaymentAmount = payment.amount * proportion;
            totalCashPaidForEntry += actualPaymentAmount;
          } else if (receiptType === 'rtgs') {
            // For RTGS payments, use rtgsAmount if available, otherwise use amount
            const rtgsPaymentAmount = payment.rtgsAmount || payment.amount;
            actualPaymentAmount = rtgsPaymentAmount * proportion;
            totalRtgsPaidForEntry += actualPaymentAmount;
            // Debug: Log RTGS payment details
            console.log('RTGS Payment:', {
              paymentId: payment.paymentId || payment.id,
              receiptType: payment.receiptType,
              paymentAmount: payment.amount,
              rtgsAmount: payment.rtgsAmount,
              usedAmount: rtgsPaymentAmount,
              cdAmount: payment.cdAmount,
              paidForAmount: paidForThisPurchase.amount,
              totalPaidForAmount: totalPaidForAmount,
              proportion: proportion,
              actualPaymentAmount: actualPaymentAmount,
              totalRtgsPaidForEntry: totalRtgsPaidForEntry
            });
          } else {
            // If payment type is not recognized, log it for debugging
            console.log('Unknown receipt type:', payment.receiptType, 'for payment:', payment);
          }
        }
      });

      // Debug: Log payment calculations for first few suppliers
      if (s.srNo && (s.srNo === '1' || s.srNo === '2' || s.srNo === '3')) {
        console.log(`Supplier ${s.srNo} - ${s.name}:`, {
          totalPaidForEntry,
          totalCashPaidForEntry,
          totalRtgsPaidForEntry,
          totalCdForEntry,
          paymentsForEntry: paymentsForEntry.length,
          paymentTypes: paymentsForEntry.map(p => p.type),
          paymentDetails: paymentsForEntry.map(p => ({
            type: p.type,
            receiptType: p.receiptType,
            amount: p.amount,
            cdAmount: p.cdAmount,
            cdApplied: p.cdApplied,
            paidFor: p.paidFor?.map(pf => ({ srNo: pf.srNo, amount: pf.amount }))
          }))
        });
      }

      return {
        ...s,
        totalPaidForEntry,
        totalCdForEntry,
        totalCd: totalCdForEntry, // Map totalCdForEntry to totalCd for compatibility
        totalPaid: totalCashPaidForEntry + totalRtgsPaidForEntry, // Actual payment without CD (for compatibility)
        totalCashPaidForEntry,
        totalRtgsPaidForEntry,
        paymentsForEntry,
        // Calculate outstanding for this specific purchase (including CD deduction)
        outstandingForEntry: (s.originalNetAmount || 0) - (totalCashPaidForEntry + totalRtgsPaidForEntry) - totalCdForEntry,
        // Set netAmount for compatibility with payment logic (including CD deduction)
        netAmount: (s.originalNetAmount || 0) - (totalCashPaidForEntry + totalRtgsPaidForEntry) - totalCdForEntry,
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

    // Group suppliers using fuzzy matching
    const groupedSuppliers = new Map<string, typeof processedSuppliers>();
    
    processedSuppliers.forEach((supplier) => {
        const sName = normalize(supplier.name || '');
        const sFatherName = normalize(supplier.fatherName || '');
        const sAddress = normalize(supplier.address || '');

        // Find existing group that matches this supplier
        let matchingGroupKey: string | null = null;
        
        for (const [groupKey, groupSuppliers] of groupedSuppliers.entries()) {
            const firstSupplier = groupSuppliers[0];
            const eName = normalize(firstSupplier.name || '');
            const eFatherName = normalize(firstSupplier.fatherName || '');
            const eAddress = normalize(firstSupplier.address || '');

            // Calculate character differences
            const nameDiff = levenshteinDistance(sName, eName);
            const fatherNameDiff = levenshteinDistance(sFatherName, eFatherName);
            const addressDiff = levenshteinDistance(sAddress, eAddress);
            const totalDiff = nameDiff + fatherNameDiff + addressDiff;

            // Fuzzy matching rules:
            // 1. Max 2 character difference per field
            // 2. Max 4 total character difference across all fields
            if (nameDiff <= 2 && fatherNameDiff <= 2 && addressDiff <= 2 && totalDiff <= 4) {
                matchingGroupKey = groupKey;
                break;
            }
        }

        if (matchingGroupKey) {
            // Add to existing group
            groupedSuppliers.get(matchingGroupKey)!.push(supplier);
        } else {
            // Create new group
            const newGroupKey = `${supplier.name || ''}_${supplier.fatherName || ''}_${supplier.address || ''}`.trim();
            groupedSuppliers.set(newGroupKey, [supplier]);
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
      
      // Debug: Log individual supplier totals
      if (s.name && s.totalTransactions > 0) {
        console.log(`${s.name}: Cash=${s.totalCashPaid}, RTGS=${s.totalRtgsPaid}, Total=${s.totalPaid}`);
      }
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
    // Use totalPaid which already includes CD deduction, don't double-deduct CD
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid;
    
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

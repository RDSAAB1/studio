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
      const paymentsForEntry = paymentHistory.filter(p => p.paidFor?.some(pf => pf.srNo === s.srNo));
      let totalPaidForEntry = 0;
      let totalCdForEntry = 0;

      paymentsForEntry.forEach(p => {
        const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === s.srNo)!;
        // paidFor.amount already includes CD portion
        totalPaidForEntry += paidForThisDetail.amount;
        
        // Calculate CD portion for display purposes only
        if (p.cdApplied && p.cdAmount && p.paidFor && p.paidFor.length > 0) {
            const totalAmountInPayment = p.paidFor.reduce((sum, pf) => sum + pf.amount, 0);
            const cdPortion = (paidForThisDetail.amount / totalAmountInPayment) * p.cdAmount;
            totalCdForEntry += cdPortion;
        }
      });

      return {
        ...s,
        totalPaidForEntry,
        totalCdForEntry,
        paymentsForEntry,
      };
    });

    const finalSummaryMap = new Map<string, CustomerSummary>();

    processedSuppliers.forEach((supplier, index) => {
      const data: CustomerSummary = {
        ...supplier,
        totalAmount: supplier.amount || 0,
        totalOriginalAmount: supplier.originalNetAmount || 0,
        totalPaid: supplier.totalPaidForEntry,
        totalCashPaid: supplier.paymentsForEntry.filter(p => p.type === 'cash').reduce((sum, p) => sum + p.amount, 0),
        totalRtgsPaid: supplier.paymentsForEntry.filter(p => p.type === 'rtgs').reduce((sum, p) => sum + p.amount, 0),
        totalCdAmount: supplier.totalCdForEntry,
        totalOutstanding: (supplier.originalNetAmount || 0) - supplier.totalPaidForEntry,
        paymentHistory: supplier.paymentsForEntry,
        outstandingEntryIds: supplier.totalPaidForEntry < (supplier.originalNetAmount || 0) ? [supplier.srNo] : [],
        allTransactions: [supplier],
        allPayments: supplier.paymentsForEntry,
        transactionsByVariety: { [toTitleCase(supplier.variety)]: 1 },
        totalGrossWeight: supplier.grossWeight || 0,
        totalTeirWeight: supplier.teirWeight || 0,
        totalFinalWeight: supplier.weight || 0,
        totalKartaWeight: supplier.kartaWeight || 0,
        totalNetWeight: supplier.netWeight || 0,
        totalKartaAmount: supplier.kartaAmount || 0,
        totalLabouryAmount: supplier.labouryAmount || 0,
        totalKanta: supplier.kanta || 0,
        totalOtherCharges: supplier.otherCharges || 0,
        totalDeductions: supplier.deductions || 0,
        averageRate: supplier.rate || 0,
        minRate: supplier.rate || 0,
        maxRate: supplier.rate || 0,
        averageOriginalPrice: supplier.originalNetAmount && supplier.netWeight ? supplier.originalNetAmount / supplier.netWeight : 0,
        averageKartaPercentage: supplier.kartaPercentage || 0,
        averageLabouryRate: supplier.labouryRate || 0,
        totalTransactions: 1,
        totalOutstandingTransactions: supplier.totalPaidForEntry < (supplier.originalNetAmount || 0) ? 1 : 0,
        totalBrokerage: supplier.brokerage || 0,
        totalCd: supplier.totalCdForEntry,
      };

      const uniqueKey = data.name + (data.so || '') + index;
      finalSummaryMap.set(uniqueKey, data);
    });

    // Create mill overview
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

    millSummary.allTransactions = processedSuppliers;
    millSummary.allPayments = paymentHistory;
    millSummary.totalOutstanding = millSummary.totalOriginalAmount - millSummary.totalPaid;

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

    finalSummaryMap.set(MILL_OVERVIEW_KEY, millSummary);

    return finalSummaryMap;
  }, [suppliers, paymentHistory, startDate, endDate]);

  return { supplierSummaryMap, MILL_OVERVIEW_KEY };
};

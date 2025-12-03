"use client";

import React, { useState, useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment } from "@/lib/definitions";
import { useToast } from '@/hooks/use-toast';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { usePersistedSelection, usePersistedState } from '@/hooks/use-persisted-state';

// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";

// Custom components and hooks
import { StatementPreview } from "./components/statement-preview";
import { SupplierProfileHeader } from "./components/supplier-profile-header";
import { SupplierGroupingInfo } from "./components/supplier-grouping-info";
import { useSupplierSummary } from "./hooks/use-supplier-summary";
import { useSupplierFiltering } from "./hooks/use-supplier-filtering";
import { useSupplierGrouping } from "./hooks/use-supplier-grouping";

export default function SupplierProfileClient() {
  const { toast } = useToast();
  const [selectedSupplierKey, setSelectedSupplierKey] = usePersistedSelection('selectedSupplierKey', 'mill-overview');
  const [startDate, setStartDate] = usePersistedState<Date | undefined>('startDate', undefined);
  const [endDate, setEndDate] = usePersistedState<Date | undefined>('endDate', undefined);
  const [detailsCustomer, setDetailsCustomer] = useState<CustomerSummary | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [selectedVariety, setSelectedVariety] = usePersistedSelection('selectedVariety', null as string | null);

  // Use the existing hook for data loading
  const { suppliers, paymentHistory, loading } = useSupplierData();

  // Use custom hooks for data processing
  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    suppliers, 
    paymentHistory, 
    startDate, 
    endDate
  );

  const { filteredSupplierOptions } = useSupplierFiltering(
    supplierSummaryMap,
    selectedSupplierKey,
    setSelectedSupplierKey as (key: string | null) => void,
    startDate,
    endDate,
    MILL_OVERVIEW_KEY
  );

  // Use supplier grouping for fuzzy matching
  const { supplierGroups, getGroupedSupplierStats } = useSupplierGrouping(suppliers);

  // Filter supplier data based on variety selection
  const filteredSupplierData = useMemo(() => {
    console.log('Getting data for key:', selectedSupplierKey);
    console.log('Available keys:', Array.from(supplierSummaryMap.keys()));
    
    const selectedData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
    console.log('Selected data:', selectedData);
    
    // If no variety selected or if it's mill overview, return the data as is
    if (!selectedVariety || selectedSupplierKey === MILL_OVERVIEW_KEY) {
      return selectedData;
    }
    
    // Apply variety filtering for individual suppliers
    if (!selectedData) return selectedData;

    const filteredTransactions = selectedData.allTransactions?.filter(t => 
      t.variety?.toLowerCase() === (selectedVariety as string)?.toLowerCase()
    ) || [];

    const filteredPayments = selectedData.allPayments?.filter(p => 
      filteredTransactions.some(t => p.paidFor?.some(pf => pf.srNo === t.srNo))
    ) || [];

    const filteredData = {
      ...selectedData,
      allTransactions: filteredTransactions,
      allPayments: filteredPayments,
    };

    // Recalculate totals based on filtered data with proper validation
    filteredData.totalAmount = filteredTransactions.reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    
    filteredData.totalOriginalAmount = filteredTransactions.reduce((sum, t) => {
      const original = Number(t.originalNetAmount) || 0;
      return sum + (Number.isFinite(original) ? original : 0);
    }, 0);
    
    filteredData.totalGrossWeight = filteredTransactions.reduce((sum, t) => {
      let grossWeight = 0;
      const storedGrossWeight = t.grossWeight !== null && t.grossWeight !== undefined ? Number(t.grossWeight) : null;
      const storedTeirWeight = t.teirWeight !== null && t.teirWeight !== undefined ? Number(t.teirWeight) : null;
      const storedWeight = t.weight !== null && t.weight !== undefined ? Number(t.weight) : null;
      
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
    }, 0);
    
    filteredData.totalTeirWeight = filteredTransactions.reduce((sum, t) => {
      let teirWeight = 0;
      const storedGrossWeight = t.grossWeight !== null && t.grossWeight !== undefined ? Number(t.grossWeight) : null;
      const storedTeirWeight = t.teirWeight !== null && t.teirWeight !== undefined ? Number(t.teirWeight) : null;
      const storedWeight = t.weight !== null && t.weight !== undefined ? Number(t.weight) : null;
      
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
    }, 0);
    filteredData.totalFinalWeight = filteredTransactions.reduce((sum, t) => {
      const weight = Number(t.weight) || 0;
      return sum + (Number.isFinite(weight) && weight >= 0 ? weight : 0);
    }, 0);
    
    filteredData.totalKartaWeight = filteredTransactions.reduce((sum, t) => {
      const kartaWeight = Number(t.kartaWeight) || 0;
      return sum + (Number.isFinite(kartaWeight) && kartaWeight >= 0 ? kartaWeight : 0);
    }, 0);
    
    filteredData.totalNetWeight = filteredTransactions.reduce((sum, t) => {
      const netWeight = Number(t.netWeight) || 0;
      return sum + (Number.isFinite(netWeight) && netWeight >= 0 ? netWeight : 0);
    }, 0);
    filteredData.totalKartaAmount = filteredTransactions.reduce((sum, t) => {
      const kartaAmount = Number(t.kartaAmount) || 0;
      return sum + (Number.isFinite(kartaAmount) ? kartaAmount : 0);
    }, 0);
    
    filteredData.totalLabouryAmount = filteredTransactions.reduce((sum, t) => {
      const labouryAmount = Number(t.labouryAmount) || 0;
      return sum + (Number.isFinite(labouryAmount) ? labouryAmount : 0);
    }, 0);
    
    filteredData.totalKanta = filteredTransactions.reduce((sum, t) => {
      const kanta = Number(t.kanta) || 0;
      return sum + (Number.isFinite(kanta) ? kanta : 0);
    }, 0);
    
    filteredData.totalOtherCharges = filteredTransactions.reduce((sum, t) => {
      const otherCharges = Number(t.otherCharges) || 0;
      // Safety check: prevent extremely large values (likely data corruption)
      if (Math.abs(otherCharges) > 1000000000) {
        console.warn(`Invalid otherCharges value for ${t.srNo}:`, otherCharges);
        return sum;
      }
      return sum + (Number.isFinite(otherCharges) ? otherCharges : 0);
    }, 0);
    
    filteredData.totalDeductions = filteredTransactions.reduce((sum, t) => sum + (Number((t as any).deductions) || 0), 0);
    
    // Recalculate brokerage with proper validation
    filteredData.totalBrokerage = filteredTransactions.reduce((sum, t) => {
      let brokerageAmount = Number(t.brokerageAmount) || 0;
      if (!brokerageAmount && t.brokerageRate && t.netWeight) {
        brokerageAmount = Math.round(Number(t.brokerageRate || 0) * Number(t.netWeight || 0) * 100) / 100;
      }
      const signedBrokerage = (t.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
      return sum + (Number.isFinite(signedBrokerage) ? signedBrokerage : 0);
    }, 0);
    
    // Calculate total paid from individual entry allocations (paidFor amounts) for filtered transactions
    let totalPaidForFiltered = 0;
    let totalCdForFiltered = 0;
    let totalCashPaidForFiltered = 0;
    let totalRtgsPaidForFiltered = 0;
    
    filteredTransactions.forEach(t => {
      const paymentsForEntry = filteredPayments.filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
      paymentsForEntry.forEach(p => {
        const paidForThisEntry = p.paidFor!.find(pf => pf.srNo === t.srNo);
        if (paidForThisEntry) {
          totalPaidForFiltered += Number(paidForThisEntry.amount || 0);
          
          // CD amount calculation: First check if directly stored in paidFor (new format), else calculate proportionally
          if ('cdAmount' in paidForThisEntry && (paidForThisEntry as any).cdAmount !== undefined && (paidForThisEntry as any).cdAmount !== null) {
            // New format: CD amount directly stored in paidFor
            totalCdForFiltered += Number((paidForThisEntry as any).cdAmount || 0);
          } else if ((p as any).cdAmount && p.paidFor && p.paidFor.length > 0) {
            // Old format: Calculate proportionally from payment.cdAmount
            // Check cdAmount even if cdApplied is not explicitly set (for cash payments)
            const totalPaidForInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
            if (totalPaidForInPayment > 0) {
              const proportion = Number(paidForThisEntry.amount || 0) / totalPaidForInPayment;
              totalCdForFiltered += Math.round((p as any).cdAmount * proportion * 100) / 100;
            }
          }
          
          const receiptType = (p as any).receiptType?.toLowerCase() || p.type?.toLowerCase();
          // IMPORTANT: For outstanding calculation, always use paidFor.amount, not rtgsAmount
          // rtgsAmount is for display/tracking only, but financial calculations should use paidFor.amount
          if (receiptType === 'cash') {
            totalCashPaidForFiltered += Number(paidForThisEntry.amount || 0);
          } else if (receiptType === 'rtgs') {
            // Use actual paidFor.amount for RTGS, not rtgsAmount
            // This ensures consistency with outstanding calculation
            totalRtgsPaidForFiltered += Number(paidForThisEntry.amount || 0);
          }
        }
      });
    });
    
    filteredData.totalPaid = totalPaidForFiltered;
    filteredData.totalCashPaid = totalCashPaidForFiltered;
    filteredData.totalRtgsPaid = totalRtgsPaidForFiltered;
    filteredData.totalCdAmount = totalCdForFiltered;
    
    // Outstanding = Net Payable - Total Paid - CD
    // Use totalPaid (calculated from paidFor.amount) instead of totalCashPaid + totalRtgsPaid
    // because totalPaid uses the actual paid amount, not rtgsAmount
    filteredData.totalOutstanding = Math.round((filteredData.totalOriginalAmount - filteredData.totalPaid - filteredData.totalCdAmount) * 100) / 100;
    filteredData.totalTransactions = filteredTransactions.length;
    filteredData.totalOutstandingTransactions = filteredTransactions.filter(t => {
      const paymentsForEntry = filteredPayments.filter(p => p.paidFor?.some(pf => pf.srNo === t.srNo));
      const totalPaidForEntry = paymentsForEntry.reduce((sum, p) => {
        const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === t.srNo);
        return sum + (paidForThisDetail?.amount || 0);
      }, 0);
      const totalCdForEntry = paymentsForEntry.reduce((sum, p) => {
        const paidForThisDetail = p.paidFor!.find(pf => pf.srNo === t.srNo);
        if (!paidForThisDetail) return sum;
        
        // CD amount calculation: First check if directly stored in paidFor (new format), else calculate proportionally
        if ('cdAmount' in paidForThisDetail && (paidForThisDetail as any).cdAmount !== undefined && (paidForThisDetail as any).cdAmount !== null) {
          return sum + Number((paidForThisDetail as any).cdAmount || 0);
        } else if ((p as any).cdAmount && p.paidFor && p.paidFor.length > 0) {
          // Old format: Calculate proportionally from payment.cdAmount
          // Check cdAmount even if cdApplied is not explicitly set (for cash payments)
          const totalPaidForInPayment = p.paidFor.reduce((sum: number, pf: any) => sum + Number(pf.amount || 0), 0);
          if (totalPaidForInPayment > 0) {
            const proportion = Number(paidForThisDetail.amount || 0) / totalPaidForInPayment;
            return sum + Math.round((p as any).cdAmount * proportion * 100) / 100;
          }
        }
        return sum;
      }, 0);
      // Outstanding if: (Paid + CD) < Original Amount
      return (totalPaidForEntry + totalCdForEntry) < (t.originalNetAmount || 0);
    }).length;
    filteredData.totalBrokerage = filteredTransactions.reduce((sum, t) => {
      // Use brokerageAmount if available, otherwise calculate from brokerageRate * netWeight
      let brokerageAmount = t.brokerageAmount || 0;
      if (!brokerageAmount && t.brokerageRate && t.netWeight) {
        brokerageAmount = Math.round(Number(t.brokerageRate || 0) * Number(t.netWeight || 0) * 100) / 100;
      }
      const signedBrokerage = (t.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
      return sum + signedBrokerage;
    }, 0);
    filteredData.totalCd = filteredPayments.reduce((sum, p) => sum + ((p as any).cdAmount || 0), 0);

    // Group transactions by variety
    filteredData.transactionsByVariety = filteredTransactions.reduce((acc, t) => {
      const variety = t.variety || 'Unknown';
      acc[variety] = (acc[variety] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate averages and rates
    // Note: totalOutstandingTransactions is already calculated above with proper CD calculation
    const totalWeightedRate = filteredTransactions.reduce((sum, t) => {
      const rate = Number(t.rate) || 0;
      const netWeight = Number(t.netWeight) || 0;
      return sum + rate * netWeight;
    }, 0);

    const safeNetWeight = filteredData.totalNetWeight || 0;
    filteredData.averageRate = safeNetWeight > 0 ? totalWeightedRate / safeNetWeight : 0;
    filteredData.averageOriginalPrice = safeNetWeight > 0 ? filteredData.totalOriginalAmount / safeNetWeight : 0;
        
        // Calculate min/max rate
    const validRates = filteredTransactions.map(t => t.rate).filter(rate => rate > 0);
    filteredData.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
    filteredData.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;

        // Calculate average karta and laboury
    const rateData = filteredTransactions.reduce((acc, s) => {
            if(s.rate > 0) {
                acc.karta += s.kartaPercentage;
                acc.laboury += s.labouryRate;
                acc.count++;
            }
            return acc;
        }, { karta: 0, laboury: 0, count: 0 });

        if(rateData.count > 0) {
      filteredData.averageKartaPercentage = rateData.karta / rateData.count;
      filteredData.averageLabouryRate = rateData.laboury / rateData.count;
    }
    
    return filteredData;
  }, [supplierSummaryMap, selectedSupplierKey, selectedVariety]);

  const selectedSupplierData = filteredSupplierData as CustomerSummary | null;

  // Get the selected supplier for fuzzy matching display
  const selectedSupplier = selectedSupplierKey && selectedSupplierKey !== MILL_OVERVIEW_KEY 
    ? suppliers.find(s => {
        const key = `${s.name}_${s.contact}`.trim();
        return key === selectedSupplierKey;
      })
    : null;

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <SupplierProfileHeader
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        selectedSupplierKey={selectedSupplierKey}
        setSelectedSupplierKey={setSelectedSupplierKey as (key: string | null) => void}
        filteredSupplierOptions={filteredSupplierOptions}
        suppliers={suppliers}
      />

      <SupplierProfileView 
        selectedSupplierData={selectedSupplierData}
        isMillSelected={selectedSupplierKey === MILL_OVERVIEW_KEY}
        onShowDetails={setDetailsCustomer as any}
        onShowPaymentDetails={setSelectedPaymentForDetails as any}
        onGenerateStatement={() => setIsStatementOpen(true)}
      />
      
      {/* Removed Mill Overview debug/summary blocks as requested */}
      
      
      {/* Fuzzy Matching Information */}
      {selectedSupplier && (
        <SupplierGroupingInfo 
          selectedSupplier={selectedSupplier}
          allSuppliers={suppliers}
        />
      )}

      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
          <DialogHeader className="sr-only">
            <DialogTitle>Statement Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
            <StatementPreview data={selectedSupplierData} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <DetailsDialog 
          isOpen={!!detailsCustomer}
          onOpenChange={(open) => !open && setDetailsCustomer(null)}
        customer={detailsCustomer as any}
          paymentHistory={paymentHistory}
      />
      
      <PaymentDetailsDialog
        payment={selectedPaymentForDetails}
        suppliers={suppliers}
        onOpenChange={() => setSelectedPaymentForDetails(null)}
        onShowEntryDetails={setDetailsCustomer}
      />
    </div>
  );
}

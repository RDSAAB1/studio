"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer as Supplier, CustomerSummary, Payment, CustomerPayment } from "@/lib/definitions";
import { useToast } from '@/hooks/use-toast';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { usePersistedSelection, usePersistedState } from '@/hooks/use-persisted-state';
import { getSuppliersRealtime, getPaymentsRealtime } from '@/lib/firestore';

// UI Components
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { SupplierProfileView } from "@/app/sales/supplier-profile/supplier-profile-view";

// Custom components and hooks
import { StatementPreview } from "./components/statement-preview";
import { SupplierProfileHeader } from "./components/supplier-profile-header";
import { useSupplierSummary } from "./hooks/use-supplier-summary";
import { useSupplierFiltering } from "./hooks/use-supplier-filtering";

export default function SupplierProfileClient() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedSupplierKey, setSelectedSupplierKey] = usePersistedSelection('selectedSupplierKey', null);
  const [startDate, setStartDate] = usePersistedState<Date | undefined>('startDate', undefined);
  const [endDate, setEndDate] = usePersistedState<Date | undefined>('endDate', undefined);
  const [detailsCustomer, setDetailsCustomer] = useState<CustomerSummary | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [serialNoSearch, setSerialNoSearch] = useState('');
  const [selectedVariety, setSelectedVariety] = usePersistedSelection('selectedVariety', null);

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
    setSelectedSupplierKey,
    startDate,
    endDate,
    MILL_OVERVIEW_KEY
  );

  // Filter supplier data based on variety selection
  const filteredSupplierData = useMemo(() => {
    const selectedData = selectedSupplierKey ? supplierSummaryMap.get(selectedSupplierKey) : null;
    if (!selectedData || !selectedVariety) return selectedData;

    const filteredTransactions = selectedData.allTransactions?.filter(t => 
      t.variety?.toLowerCase() === selectedVariety.toLowerCase()
    ) || [];

    const filteredPayments = selectedData.allPayments?.filter(p => 
      filteredTransactions.some(t => p.paidFor?.some(pf => pf.srNo === t.srNo))
    ) || [];

    const filteredData = {
      ...selectedData,
      allTransactions: filteredTransactions,
      allPayments: filteredPayments,
    };

    // Recalculate totals based on filtered data
    filteredData.totalAmount = filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    filteredData.totalOriginalAmount = filteredTransactions.reduce((sum, t) => sum + (t.originalNetAmount || 0), 0);
    filteredData.totalGrossWeight = filteredTransactions.reduce((sum, t) => sum + t.grossWeight, 0);
    filteredData.totalTeirWeight = filteredTransactions.reduce((sum, t) => sum + t.teirWeight, 0);
    filteredData.totalFinalWeight = filteredTransactions.reduce((sum, t) => sum + t.weight, 0);
    filteredData.totalKartaWeight = filteredTransactions.reduce((sum, t) => sum + (t.kartaWeight || 0), 0);
    filteredData.totalNetWeight = filteredTransactions.reduce((sum, t) => sum + t.netWeight, 0);
    filteredData.totalKartaAmount = filteredTransactions.reduce((sum, t) => sum + (t.kartaAmount || 0), 0);
    filteredData.totalLabouryAmount = filteredTransactions.reduce((sum, t) => sum + (t.labouryAmount || 0), 0);
    filteredData.totalKanta = filteredTransactions.reduce((sum, t) => sum + (t.kanta || 0), 0);
    filteredData.totalOtherCharges = filteredTransactions.reduce((sum, t) => sum + (t.otherCharges || 0), 0);
    filteredData.totalDeductions = filteredTransactions.reduce((sum, t) => sum + (t.deductions || 0), 0);
    
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
          if (receiptType === 'cash') {
            totalCashPaidForFiltered += Number(paidForThisEntry.amount || 0);
          } else if (receiptType === 'rtgs') {
            // For RTGS, use the proportion of rtgsAmount if available
            const rtgsAmount = (p as any).rtgsAmount;
            if (rtgsAmount !== undefined && rtgsAmount !== null) {
              // Calculate proportion: (paidFor amount / total payment amount) * rtgsAmount
              const totalPaymentAmount = p.paidFor!.reduce((sum, pf) => sum + Number(pf.amount || 0), 0);
              const proportion = totalPaymentAmount > 0 ? Number(paidForThisEntry.amount || 0) / totalPaymentAmount : 0;
              totalRtgsPaidForFiltered += rtgsAmount * proportion;
            } else {
              totalRtgsPaidForFiltered += Number(paidForThisEntry.amount || 0);
            }
          }
        }
      });
    });
    
    filteredData.totalPaid = totalPaidForFiltered;
    filteredData.totalCashPaid = totalCashPaidForFiltered;
    filteredData.totalRtgsPaid = totalRtgsPaidForFiltered;
    filteredData.totalCdAmount = totalCdForFiltered;
    
    // Outstanding = Net Payable - Cash - RTGS - CD
    filteredData.totalOutstanding = filteredData.totalOriginalAmount - filteredData.totalCashPaid - filteredData.totalRtgsPaid - filteredData.totalCdAmount;
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
    filteredData.totalCd = filteredPayments.reduce((sum, p) => sum + (p.cdAmount || 0), 0);

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

  // Handle serial number search with auto-format
  const handleSerialNoSearch = (srNo: string) => {
    setSerialNoSearch(srNo);
  };

  const handleSerialNoBlur = () => {
    if (!serialNoSearch.trim()) return;
    
    const formattedSrNo = serialNoSearch.replace(/[^0-9]/g, '').padStart(4, '0');
    setSerialNoSearch(formattedSrNo);
    
    // Find supplier with matching serial number
    const matchingSupplier = suppliers.find(s => s.srNo === formattedSrNo);
    if (matchingSupplier) {
      const supplierKey = `${matchingSupplier.name}_${matchingSupplier.contact}`.trim();
      setSelectedSupplierKey(supplierKey);
      toast({
        title: "Supplier Found",
        description: `Selected ${matchingSupplier.name}`,
      });
    } else {
      toast({
        title: "Supplier Not Found",
        description: `No supplier found with SR# ${formattedSrNo}`,
        variant: "destructive",
      });
    }
  };

  // Load data on component mount
  useEffect(() => {
    setIsClient(true);
    
    const loadData = async () => {
      try {
        setLoading(true);
        const [suppliersData, paymentsData] = await Promise.all([
          getSuppliersRealtime(),
          getPaymentsRealtime()
        ]);
        
        setSuppliers(suppliersData);
        setPaymentHistory(paymentsData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load supplier data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [toast]);

  if (!isClient || loading) {
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
        setSelectedSupplierKey={setSelectedSupplierKey}
        filteredSupplierOptions={filteredSupplierOptions}
      />
      
      <SupplierProfileView 
        selectedSupplierData={selectedSupplierData}
        isMillSelected={selectedSupplierKey === MILL_OVERVIEW_KEY}
        onShowDetails={setDetailsCustomer}
        onShowPaymentDetails={setSelectedPaymentForDetails}
        onGenerateStatement={() => setIsStatementOpen(true)}
      />
      
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl p-0 printable-statement-container">
          <ScrollArea className="max-h-[90vh] printable-statement-scroll-area">
            <StatementPreview data={selectedSupplierData} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <DetailsDialog 
        isOpen={!!detailsCustomer}
        onOpenChange={(open) => !open && setDetailsCustomer(null)}
        customer={detailsCustomer}
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

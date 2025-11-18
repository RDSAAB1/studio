
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { usePaymentCombination } from '@/hooks/use-payment-combination';
import { PaymentCombinationGenerator, PaymentCombinationResults } from '@/components/sales/supplier-payments/payment-combination-generator';
import { RtgsForm } from '@/components/sales/supplier-payments/rtgs-form';
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";
import { useSupplierData } from "@/hooks/use-supplier-data";


export default function SupplierPaymentsClient() {
    const { toast } = useToast();
    
  const hook = useSupplierPayments();
  const { supplierBankAccounts, banks, bankBranches } = useSupplierData();
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const { activeTab, setActiveTab } = hook;

  const paymentCombination = usePaymentCombination({
    calcTargetAmount: hook.calcTargetAmount,
    minRate: hook.minRate,
    maxRate: hook.maxRate,
  });

  // Use the same supplier summary and filtering as supplier profile
  const { supplierSummaryMap, MILL_OVERVIEW_KEY } = useSupplierSummary(
    hook.suppliers,
    hook.paymentHistory,
    undefined,
    undefined
  );

  const onSelectSupplierKey = useCallback((key: string | null) => {
    if (key) {
      hook.handleCustomerSelect(key);
    }
  }, [hook]);

  // Update the hook's customerSummaryMap to use our new supplierSummaryMap
  useEffect(() => {
    if (supplierSummaryMap.size > 0) {
      // Replace the hook's customerSummaryMap with our new one
      hook.customerSummaryMap.clear();
      supplierSummaryMap.forEach((value, key) => {
        hook.customerSummaryMap.set(key, value);
      });
    }
  }, [supplierSummaryMap, hook.customerSummaryMap]);

  const { filteredSupplierOptions } = useSupplierFiltering(
    supplierSummaryMap,
    hook.selectedCustomerKey as string | null,
    onSelectSupplierKey as (key: string | null) => void,
    undefined,
    undefined,
    MILL_OVERVIEW_KEY
  );

  // Force lightweight rerender of heavy tables when payments list changes
  useEffect(() => {
    setRefreshKey(Date.now());
  }, [hook.paymentHistory?.length]);

  // Check for editPaymentData from localStorage (when navigating from detail window)
  useEffect(() => {
    const editData = localStorage.getItem('editPaymentData');
    if (editData && hook.handleEditPayment) {
      try {
        const paymentData = JSON.parse(editData) as Payment;
        // Clear the localStorage
        localStorage.removeItem('editPaymentData');
        
        // Edit the payment
        hook.handleEditPayment(paymentData);
        
        toast({
          title: "Payment Loaded",
          description: `Loaded payment ${paymentData.paymentId || paymentData.id} for editing.`,
        });
      } catch (error) {
        console.error('Error loading edit payment data:', error);
        localStorage.removeItem('editPaymentData');
      }
    }
  }, [hook.handleEditPayment]);
    // Removed toast from dependencies - it's stable from useToast hook
    // eslint-disable-next-line react-hooks/exhaustive-deps

  const selectedSupplierSummary = useMemo(() => {
    if (!hook.selectedCustomerKey) return null;
    return supplierSummaryMap.get(hook.selectedCustomerKey) ?? null;
    }, [hook.selectedCustomerKey, supplierSummaryMap]);

  const transactionsForSelectedSupplier = useMemo(() => {
    return selectedSupplierSummary?.allTransactions || [];
  }, [selectedSupplierSummary]);

  const selectedSupplierSrNos = useMemo(() => {
    if (!selectedSupplierSummary?.allTransactions) return [];
    return selectedSupplierSummary.allTransactions
      .map((transaction: Customer) => (transaction.srNo || "").toLowerCase())
      .filter(Boolean);
  }, [selectedSupplierSummary]);

  const normalizedSerialFilter = useMemo(() => {
    const raw = hook.serialNoSearch.trim().toLowerCase();
    if (!raw) return "";
    const numericPart = raw.startsWith("s") ? raw.slice(1) : raw;
    if (/^\d+$/.test(numericPart)) {
      return `s${numericPart.padStart(5, "0")}`;
    }
    return raw.startsWith("s") ? raw : `s${raw}`;
  }, [hook.serialNoSearch]);

  const paymentMatchesSelection = useCallback(
    (payment: Payment) => {
      const paidSrNos =
        payment.paidFor?.map((pf) => (pf.srNo || "").toLowerCase()).filter(Boolean) || [];

      const matchesSerial =
        !normalizedSerialFilter || paidSrNos.includes(normalizedSerialFilter);
      const matchesSupplier =
        !selectedSupplierSrNos.length ||
        paidSrNos.some((sr) => selectedSupplierSrNos.includes(sr));

      return matchesSerial && matchesSupplier;
    },
    [normalizedSerialFilter, selectedSupplierSrNos]
  );

  // Helper function to extract numeric part from serial number for sorting
  const getSerialNumberForSort = (payment: Payment): number => {
    const srNo = payment.paidFor?.[0]?.srNo || payment.parchiNo || '';
    if (!srNo) return 0;
    // Extract numeric part from serial number (e.g., "S00001" -> 1, "00001" -> 1)
    const numericMatch = srNo.toString().match(/\d+/);
    return numericMatch ? parseInt(numericMatch[0], 10) : 0;
  };

  const cashHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "cash")
      .filter(paymentMatchesSelection);
    // Sort by serial number (ascending - low to high)
    return [...filtered].sort((a, b) => {
      const srNoA = getSerialNumberForSort(a);
      const srNoB = getSerialNumberForSort(b);
      return srNoA - srNoB;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);

  const rtgsHistoryRows = useMemo(() => {
    const filtered = hook.paymentHistory
      .filter((payment: Payment) => (payment.receiptType || "").toLowerCase() === "rtgs")
      .filter(paymentMatchesSelection);
    // Sort by serial number (ascending - low to high)
    return [...filtered].sort((a, b) => {
      const srNoA = getSerialNumberForSort(a);
      const srNoB = getSerialNumberForSort(b);
      return srNoA - srNoB;
    });
  }, [hook.paymentHistory, paymentMatchesSelection]);


    const handlePaymentMethodChange = useCallback(
      (method: 'Cash' | 'Online' | 'RTGS') => {
        // Call the setPaymentMethod directly from the hook
        // It's already handleSetPaymentMethod which has all the logic
        if (hook.setPaymentMethod) {
          hook.setPaymentMethod(method);
        }
      },
      [hook]
    );

    if (!hook.isClient || hook.loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
            </div>
        );
    }
  
    return (
        <div className="space-y-3 text-[12px]">
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="sticky top-0 z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 border-b">
                    <div className="w-full px-3 md:px-5 py-1 flex flex-wrap gap-2 md:gap-3 items-center text-[12px]">
                         <TabsList className="flex flex-none rounded-full border bg-background px-1 text-[12px]">
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="process">Payment</TabsTrigger>
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="cash">Cash History</TabsTrigger>
                            <TabsTrigger className="px-3 py-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" value="rtgs">RTGS History</TabsTrigger>
                </TabsList>
                        <div className="flex-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                            <div className="flex flex-1 min-w-[220px]">
                                        <CustomDropdown
                                            options={filteredSupplierOptions.map(({ value, data }) => ({
                                                value,
                                                label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim()
                                            }))}
                                            value={hook.selectedCustomerKey}
                                            onChange={onSelectSupplierKey}
                                    placeholder="Select supplier..."
                                        />
                                    </div>
                            <div className="relative w-full md:w-[180px]">
                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                    placeholder="Serial No..."
                                                value={hook.serialNoSearch}
                                                onChange={(e) => hook.handleSerialNoSearch(e.target.value)}
                                                onBlur={hook.handleSerialNoBlur}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        hook.handleSerialNoBlur();
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                    className="pl-7 h-8"
                                            />
                                        </div>
                            <div className="flex items-center gap-2 md:pl-3">
                                <Button size="sm" className="h-7 text-[11px]" variant="outline" onClick={hook.resetPaymentForm}>Clear</Button>
                                <Button size="sm" className="h-7 text-[11px]" onClick={hook.processPayment}>Finalize</Button>
                                                        </div>
                                                        </div>
                                                    </div>
                                                </div>
                <TabsContent value="process" className="space-y-3">
                     <Card>
                        <CardContent className="p-3 space-y-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-3">
                                <TransactionTable
                                  suppliers={transactionsForSelectedSupplier}
                                  onShowDetails={hook.setDetailsSupplierEntry}
                                  selectedIds={hook.selectedEntryIds}
                                  onSelectionChange={hook.setSelectedEntryIds}
                                  embed
                                />
                                {hook.paymentMethod === 'RTGS' && (
                                  <Card className="text-[11px]">
                                    <CardContent className="p-3">
                                      <RtgsForm {...hook} bankAccounts={supplierBankAccounts} banks={banks} bankBranches={bankBranches} />
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                              <div className="space-y-3">
                                {((hook.selectedCustomerKey) || hook.rtgsFor === 'Outsider') && (
                                  <PaymentForm
                                    {...hook}
                                    bankAccounts={hook.bankAccounts}
                                    bankBranches={hook.bankBranches}
                                    onPaymentMethodChange={handlePaymentMethodChange}
                                  />
                                )}
                                {hook.paymentMethod === 'RTGS' && (
                                  <Card className="text-[11px]">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-[12px] font-semibold text-muted-foreground">Generate Payment Options</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 p-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                          <Label className="text-[11px]">Quantity</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsQuantity}
                                            onChange={(e) => hook.setRtgsQuantity(Number(e.target.value) || 0)}
                                            className="h-8 text-[11px]"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[11px]">Rate</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsRate}
                                            onChange={(e) => hook.setRtgsRate(Number(e.target.value) || 0)}
                                            className="h-8 text-[11px]"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[11px]">Amount</Label>
                                          <Input
                                            type="number"
                                            value={hook.rtgsAmount}
                                            onChange={(e) => hook.setRtgsAmount(Number(e.target.value) || 0)}
                                            className="h-8 text-[11px]"
                                            placeholder="Auto-filled from To Be Paid"
                                          />
                                        </div>
                                      </div>
                                      <PaymentCombinationGenerator
                                        calcTargetAmount={hook.calcTargetAmount}
                                        setCalcTargetAmount={hook.setCalcTargetAmount}
                                        minRate={hook.minRate}
                                        setMinRate={hook.setMinRate}
                                        maxRate={hook.maxRate}
                                        setMaxRate={hook.setMaxRate}
                                        selectPaymentAmount={hook.selectPaymentAmount}
                                        combination={paymentCombination}
                                        showResults={false}
                                      />
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="cash" className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground">Cash Payments</h2>
                        <Badge variant="outline" className="text-xs font-medium">
                            {cashHistoryRows.length} {cashHistoryRows.length === 1 ? "entry" : "entries"}
                        </Badge>
                    </div>
                    <PaymentHistory
                        key={`cash-${refreshKey}`}
                        payments={cashHistoryRows}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="Cash Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
                <TabsContent value="rtgs" className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-muted-foreground">RTGS Payments</h2>
                        <Badge variant="outline" className="text-xs font-medium">
                            {rtgsHistoryRows.length} {rtgsHistoryRows.length === 1 ? "entry" : "entries"}
                        </Badge>
                    </div>
                    <PaymentHistory
                        key={`rtgs-${refreshKey}`}
                        payments={rtgsHistoryRows}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="RTGS Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
            </Tabs>

            {hook.paymentMethod === 'RTGS' && paymentCombination.sortedPaymentOptions.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">Generated Payment Options</h3>
                  <span className="text-[11px] text-muted-foreground">{paymentCombination.sortedPaymentOptions.length} combinations</span>
                </div>
                <PaymentCombinationResults
                  options={paymentCombination.sortedPaymentOptions}
                  requestSort={paymentCombination.requestSort}
                  onSelect={hook.selectPaymentAmount}
                />
              </div>
            )}
 
            <DetailsDialog
                isOpen={!!hook.detailsSupplierEntry}
                onOpenChange={() => hook.setDetailsSupplierEntry(null)}
                customer={hook.detailsSupplierEntry}
                paymentHistory={hook.paymentHistory}
                entryType="Supplier"
            />

            <PaymentDetailsDialog
                payment={hook.selectedPaymentForDetails}
                suppliers={hook.suppliers}
                onOpenChange={() => hook.setSelectedPaymentForDetails(null)}
                onShowEntryDetails={hook.setDetailsSupplierEntry}
            />
            
           <RTGSReceiptDialog
                payment={hook.rtgsReceiptData}
                settings={hook.receiptSettings}
                onOpenChange={() => hook.setRtgsReceiptData(null)}
           />

          <BankSettingsDialog
            isOpen={hook.isBankSettingsOpen}
            onOpenChange={hook.setIsBankSettingsOpen}
          />

          {/* Outstanding selection dialog removed as requested */}
        </div>
    );
}

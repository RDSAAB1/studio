
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, History, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";
import { useSupplierFiltering } from "../supplier-profile/hooks/use-supplier-filtering";
import { useSupplierSummary } from "../supplier-profile/hooks/use-supplier-summary";


export default function SupplierPaymentsClient() {
    const { toast } = useToast();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    
  const hook = useSupplierPayments();
  const { activeTab, setActiveTab } = hook;

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

    const transactionsForSelectedSupplier = useMemo(() => {
        if (!hook.selectedCustomerKey) return [];
        const summary = supplierSummaryMap.get(hook.selectedCustomerKey);
        return summary ? summary.allTransactions || [] : [];
    }, [hook.selectedCustomerKey, supplierSummaryMap]);


    if (!hook.isClient || hook.loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
            </div>
        );
    }
  
    return (
        <div className="space-y-3">
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="process">Payment Process</TabsTrigger>
                    <TabsTrigger value="cash">Cash History</TabsTrigger>
                    <TabsTrigger value="rtgs">RTGS History</TabsTrigger>
                </TabsList>
                <TabsContent value="process" className="space-y-3 mt-4">
                     <Card>
                        <CardHeader className="p-0">
                            <div className="flex items-center justify-between p-3 border-b">
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => { hook.setPaymentMethod('Cash'); hook.resetPaymentForm(hook.rtgsFor === 'Outsider'); }} variant={hook.paymentMethod === 'Cash' ? 'default' : 'outline'} size="sm">Cash</Button>
                                    <Button onClick={() => { hook.setPaymentMethod('Online'); hook.resetPaymentForm(hook.rtgsFor === 'Outsider'); }} variant={hook.paymentMethod === 'Online' ? 'default' : 'outline'} size="sm">Online</Button>
                                    <Button onClick={() => { hook.setPaymentMethod('RTGS'); hook.resetPaymentForm(hook.rtgsFor === 'Outsider'); }} variant={hook.paymentMethod === 'RTGS' ? 'default' : 'outline'} size="sm">RTGS</Button>
                                </div>
                                {hook.paymentMethod === 'RTGS' && (
                                    <div className="flex items-center space-x-2">
                                        <button type="button" onClick={() => { const newType = hook.rtgsFor === 'Supplier' ? 'Outsider' : 'Supplier'; hook.setRtgsFor(newType); hook.resetPaymentForm(newType === 'Outsider'); }} className={`relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${hook.rtgsFor === 'Outsider' ? 'bg-primary/20' : 'bg-secondary/20'}`} >
                                            <span className={`absolute right-4 text-xs font-semibold transition-colors duration-300 ${hook.rtgsFor === 'Outsider' ? 'text-primary' : 'text-muted-foreground'}`}>Outsider</span>
                                            <span className={`absolute left-4 text-xs font-semibold transition-colors duration-300 ${hook.rtgsFor === 'Supplier' ? 'text-primary' : 'text-muted-foreground'}`}>Supplier</span>
                                            <div className={`absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform ${hook.rtgsFor === 'Supplier' ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'}`} >
                                                <div className={`h-full w-full rounded-full flex items-center justify-center transition-colors duration-300 ${hook.rtgsFor === 'Supplier' ? 'bg-secondary' : 'bg-primary'}`}>
                                                    <span className="text-sm font-bold text-primary-foreground">For</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-3">
                            {(hook.paymentMethod !== 'RTGS' || hook.rtgsFor === 'Supplier') && (
                                <div className="mb-4">
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                        {/* Serial Number Search */}
                                        <div className="w-full md:w-[200px] relative">
                                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search by Serial No..."
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
                                                className="pl-8 h-9"
                                            />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <CustomDropdown
                                                options={filteredSupplierOptions.map(({ value, data }) => ({
                                                    value,
                                                    label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim()
                                                }))}
                                                value={hook.selectedCustomerKey}
                                                onChange={onSelectSupplierKey}
                                                placeholder="Search by Name, Father, Address..."
                                            />
                                        </div>
                                        {hook.selectedCustomerKey && (
                                            <div className="flex items-center gap-4 md:border-l md:pl-4 w-full md:w-auto mt-2 md:mt-0">
                                                <div className="flex items-baseline gap-2 text-sm">
                                                    <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                                    <p className="font-bold text-base text-destructive">{formatCurrency(supplierSummaryMap.get(hook.selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                     {hook.selectedCustomerKey && (
                                        <TransactionTable
                                            suppliers={transactionsForSelectedSupplier}
                                            onShowDetails={hook.setDetailsSupplierEntry}
                                            selectedIds={hook.selectedEntryIds}
                                            onSelectionChange={hook.setSelectedEntryIds}
                                        />
                                    )}
                                </div>
                            )}
                            {(hook.selectedCustomerKey || hook.rtgsFor === 'Outsider') && (
                                <PaymentForm {...hook} bankBranches={hook.bankBranches} />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="cash" className="mt-4">
                    <PaymentHistory
                        payments={hook.paymentHistory.filter((p: Payment) => p.receiptType === 'Cash')}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="Cash Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
                <TabsContent value="rtgs" className="mt-4">
                    <PaymentHistory
                        payments={hook.paymentHistory.filter((p: Payment) => p.receiptType === 'RTGS')}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                        title="RTGS Payment History"
                        suppliers={hook.suppliers}
                    />
                </TabsContent>
            </Tabs>
          
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
        </div>
    );
}

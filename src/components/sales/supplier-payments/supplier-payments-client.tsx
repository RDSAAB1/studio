
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { OutstandingEntriesDialog } from '@/components/sales/supplier-payments/outstanding-entries-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';
import { DetailsDialog } from "@/components/sales/details-dialog";


export default function SupplierPaymentsClient() {
    const { toast } = useToast();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    
    const hook = useSupplierPayments();
    const { activeTab, setActiveTab } = hook;

    const transactionsForSelectedSupplier = useMemo(() => {
        if (!hook.selectedCustomerKey) return [];
        const summary = hook.customerSummaryMap.get(hook.selectedCustomerKey);
        return summary ? summary.allTransactions || [] : [];
    }, [hook.selectedCustomerKey, hook.customerSummaryMap]);


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
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                    <TabsTrigger value="history">Full History</TabsTrigger>
                </TabsList>
                <TabsContent value="processing" className="space-y-3 mt-4">
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
                                        <div className="flex-1">
                                            <CustomDropdown
                                                options={Array.from(hook.customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} S/O ${toTitleCase(data.so || '')} (${data.contact})` }))}
                                                value={hook.selectedCustomerKey}
                                                onChange={hook.handleCustomerSelect}
                                                placeholder="Search and select supplier..."
                                            />
                                        </div>
                                        {hook.selectedCustomerKey && (
                                            <div className="flex items-center gap-4 md:border-l md:pl-4 w-full md:w-auto mt-2 md:mt-0">
                                                <div className="flex items-baseline gap-2 text-sm">
                                                    <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                                    <p className="font-bold text-base text-destructive">{formatCurrency(hook.customerSummaryMap.get(hook.selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => hook.setIsOutstandingModalOpen(true)} className="h-7 text-xs">Change Selection</Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {(hook.selectedCustomerKey || hook.rtgsFor === 'Outsider') && (
                                <PaymentForm {...hook} bankBranches={hook.bankBranches} />
                            )}
                            {hook.selectedCustomerKey && (
                                <TransactionTable
                                    suppliers={transactionsForSelectedSupplier}
                                    onShowDetails={hook.setDetailsSupplierEntry}
                                />
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="history" className="mt-4">
                    <PaymentHistory
                        payments={hook.paymentHistory}
                        onShowDetails={hook.setSelectedPaymentForDetails}
                        onPrintRtgs={hook.setRtgsReceiptData}
                        onEdit={hook.handleEditPayment}
                        onDelete={(payment: Payment) => hook.handleDeletePayment(payment)}
                    />
                </TabsContent>
            </Tabs>
          
            <OutstandingEntriesDialog
                isOpen={hook.isOutstandingModalOpen}
                onOpenChange={hook.setIsOutstandingModalOpen}
                customerName={toTitleCase(hook.customerSummaryMap.get(hook.selectedCustomerKey || '')?.name || '')}
                entries={transactionsForSelectedSupplier.filter((s:any) => parseFloat(String(s.netAmount)) > 0)}
                selectedIds={hook.selectedEntryIds}
                onSelect={(id: string) => hook.setSelectedEntryIds((prev: any) => { const newSet = new Set(prev); if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); } return newSet; })}
                onSelectAll={(checked: boolean) => {
                    const newSet = new Set<string>();
                    const outstandingEntries = transactionsForSelectedSupplier.filter((s:any) => parseFloat(String(s.netAmount)) > 0);
                    if(checked) outstandingEntries.forEach((e:any) => newSet.add(e.id));
                    hook.setSelectedEntryIds(newSet);
                }}
                onConfirm={hook.handlePaySelectedOutstanding}
                onCancel={() => { hook.setIsOutstandingModalOpen(false); hook.handleFullReset(); }}
            />
            
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

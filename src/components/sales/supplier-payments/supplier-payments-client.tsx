
"use client";

import { useMemo } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { DetailsDialog } from '@/components/sales/supplier-payments/details-dialog';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { OutstandingEntriesDialog } from '@/components/sales/supplier-payments/outstanding-entries-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';


export default function SupplierPaymentsClient() {
    const hook = useSupplierPayments();

    const transactionsForSelectedSupplier = useMemo(() => {
        if (!hook.selectedCustomerKey || !hook.suppliers) return [];
        const summary = hook.customerSummaryMap.get(hook.selectedCustomerKey);
        return summary ? summary.allTransactions || [] : [];
    }, [hook.selectedCustomerKey, hook.suppliers, hook.customerSummaryMap]);
    
    const paymentsForDetailsEntry = useMemo(() => {
        if (!hook.detailsSupplierEntry || !hook.paymentHistory) return [];
        return hook.paymentHistory.filter(p =>
            p.paidFor?.some(pf => pf.srNo === hook.detailsSupplierEntry.srNo)
        );
    }, [hook.detailsSupplierEntry, hook.paymentHistory]);

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
            <Tabs value={hook.paymentMethod} onValueChange={(value) => {
                hook.setPaymentMethod(value);
                hook.resetPaymentForm(hook.rtgsFor === 'Outsider');
            }}>
                <TabsList className="grid w-full grid-cols-3 h-9">
                    <TabsTrigger value="Cash">Cash</TabsTrigger>
                    <TabsTrigger value="Online">Online</TabsTrigger>
                    <TabsTrigger value="RTGS">RTGS</TabsTrigger>
                </TabsList>
            </Tabs>

            {hook.paymentMethod === 'RTGS' && (
                 <div className="flex items-center space-x-2 p-2">
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

            <Tabs value={hook.activeTab} onValueChange={hook.setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                    <TabsTrigger value="history">Full History</TabsTrigger>
                </TabsList>
                <TabsContent value="processing" className="space-y-3">
                    {(hook.paymentMethod !== 'RTGS' || hook.rtgsFor === 'Supplier') && (
                        <Card>
                            <CardContent className="p-3">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                                    <div className="flex flex-1 items-center gap-2">
                                        <Label htmlFor="supplier-select" className="text-sm font-semibold whitespace-nowrap">Select Supplier:</Label>
                                        <CustomDropdown
                                            options={Array.from(hook.customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} (${data.contact})` }))}
                                            value={hook.selectedCustomerKey}
                                            onChange={hook.handleCustomerSelect}
                                            placeholder="Search and select supplier..."
                                        />
                                    </div>
                                    {hook.selectedCustomerKey && (
                                        <div className="flex items-center gap-2 md:border-l md:pl-2 w-full md:w-auto mt-2 md:mt-0">
                                            <div className="flex items-center gap-1 text-xs">
                                                <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                                <p className="font-bold text-destructive">{formatCurrency(hook.customerSummaryMap.get(hook.selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => hook.setIsOutstandingModalOpen(true)} className="h-7 text-xs">Change Selection</Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
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
                </TabsContent>
                <TabsContent value="history">
                     <div className="space-y-3">
                        <PaymentHistory
                            payments={hook.paymentHistory}
                            onEdit={hook.handleEditPayment}
                            onDelete={hook.handleDeletePayment}
                            onShowDetails={hook.setSelectedPaymentForDetails}
                            onPrintRtgs={hook.setRtgsReceiptData}
                        />
                     </div>
                </TabsContent>
            </Tabs>
          
            <OutstandingEntriesDialog
                isOpen={hook.isOutstandingModalOpen}
                onOpenChange={hook.setIsOutstandingModalOpen}
                customerName={toTitleCase(hook.customerSummaryMap.get(hook.selectedCustomerKey || '')?.name || '')}
                entries={hook.suppliers.filter((s:any) => s.customerId === hook.selectedCustomerKey && parseFloat(String(s.netAmount)) > 0)}
                selectedIds={hook.selectedEntryIds}
                onSelect={(id: string) => hook.setSelectedEntryIds((prev: any) => { const newSet = new Set(prev); if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); } return newSet; })}
                onSelectAll={(checked: boolean) => {
                    const newSet = new Set<string>();
                    const outstandingEntries = hook.suppliers.filter((s:any) => s.customerId === hook.selectedCustomerKey && parseFloat(String(s.netAmount)) > 0);
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
                paymentHistory={paymentsForDetailsEntry}
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

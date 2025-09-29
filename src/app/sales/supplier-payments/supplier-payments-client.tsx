
"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, Payment, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSupplierPayments } from '@/hooks/use-supplier-payments';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { DetailsDialog } from '@/components/sales/supplier-payments/details-dialog';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { OutstandingEntriesDialog } from '@/components/sales/supplier-payments/outstanding-entries-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';


export default function SupplierPaymentsClient() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('processing');

    const {
        isClient,
        loading,
        suppliers,
        paymentHistory,
        banks,
        bankAccounts,
        financialState,
        customerSummaryMap,
        selectedCustomerKey,
        setSelectedCustomerKey,
        selectedEntryIds,
        setSelectedEntryIds,
        paymentId, setPaymentId,
        rtgsSrNo, setRtgsSrNo,
        paymentDate, setPaymentDate,
        paymentAmount, setPaymentAmount,
        paymentType, setPaymentType,
        paymentMethod, setPaymentMethod,
        selectedAccountId, handleSetSelectedAccount,
        supplierDetails, setSupplierDetails,
        bankDetails, setBankDetails,
        isPayeeEditing, setIsPayeeEditing,
        sixRNo, setSixRNo,
        sixRDate, setSixRDate,
        parchiNo, setParchiNo,
        utrNo, setUtrNo,
        checkNo, setCheckNo,
        rtgsQuantity, setRtgsQuantity,
        rtgsRate, setRtgsRate,
        rtgsAmount, setRtgsAmount,
        rtgsFor, setRtgsFor,
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent,
        cdAt, setCdAt,
        calculatedCdAmount,
        isProcessing,
        editingPayment,
        detailsSupplierEntry, setDetailsSupplierEntry,
        selectedPaymentForDetails, setSelectedPaymentForDetails,
        isOutstandingModalOpen, setIsOutstandingModalOpen,
        isBankSettingsOpen, setIsBankSettingsOpen,
        rtgsReceiptData, setRtgsReceiptData,
        receiptSettings,
        calcTargetAmount,
        selectPaymentAmount,
        processPayment,
        handleEditPayment,
        handleDeletePayment,
        resetPaymentForm,
        handleFullReset,
        handleCustomerSelect,
        handlePaySelectedOutstanding
    } = useSupplierPayments();

    const transactionsForSelectedSupplier = useMemo(() => {
        if (!selectedCustomerKey || !suppliers) return [];
        const summary = customerSummaryMap.get(selectedCustomerKey);
        return summary ? summary.allTransactions || [] : [];
    }, [selectedCustomerKey, suppliers, customerSummaryMap]);

    const paymentsForDetailsEntry = useMemo(() => {
        if (!detailsSupplierEntry || !paymentHistory) return [];
        return paymentHistory.filter(p =>
            p.paidFor?.some(pf => pf.srNo === detailsSupplierEntry.srNo)
        );
    }, [detailsSupplierEntry, paymentHistory]);

    if (!isClient || loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
            </div>
        );
    }
  
    return (
        <div className="space-y-3">
            <Tabs value={paymentMethod} onValueChange={(value) => {
                setPaymentMethod(value);
                resetPaymentForm(rtgsFor === 'Outsider');
            }}>
                <TabsList className="grid w-full grid-cols-3 h-9">
                    <TabsTrigger value="Cash">Cash</TabsTrigger>
                    <TabsTrigger value="Online">Online</TabsTrigger>
                    <TabsTrigger value="RTGS">RTGS</TabsTrigger>
                </TabsList>
            </Tabs>

            {paymentMethod === 'RTGS' && (
                 <div className="flex items-center space-x-2 p-2">
                    <button type="button" onClick={() => { const newType = rtgsFor === 'Supplier' ? 'Outsider' : 'Supplier'; setRtgsFor(newType); resetPaymentForm(newType === 'Outsider'); }} className={`relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${rtgsFor === 'Outsider' ? 'bg-primary/20' : 'bg-secondary/20'}`} >
                        <span className={`absolute right-4 text-xs font-semibold transition-colors duration-300 ${rtgsFor === 'Outsider' ? 'text-primary' : 'text-muted-foreground'}`}>Outsider</span>
                        <span className={`absolute left-4 text-xs font-semibold transition-colors duration-300 ${rtgsFor === 'Supplier' ? 'text-primary' : 'text-muted-foreground'}`}>Supplier</span>
                        <div className={`absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform ${rtgsFor === 'Supplier' ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'}`} >
                            <div className={`h-full w-full rounded-full flex items-center justify-center transition-colors duration-300 ${rtgsFor === 'Supplier' ? 'bg-secondary' : 'bg-primary'}`}>
                                <span className="text-sm font-bold text-primary-foreground">For</span>
                            </div>
                        </div>
                    </button>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                    <TabsTrigger value="history">Full History</TabsTrigger>
                </TabsList>
                <TabsContent value="processing" className="space-y-3">
                    {(paymentMethod !== 'RTGS' || rtgsFor === 'Supplier') && (
                        <Card>
                            <CardContent className="p-3">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                                    <div className="flex flex-1 items-center gap-2">
                                        <Label htmlFor="supplier-select" className="text-sm font-semibold whitespace-nowrap">Select Supplier:</Label>
                                        <CustomDropdown
                                            options={Array.from(customerSummaryMap.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} (${data.contact})` }))}
                                            value={selectedCustomerKey}
                                            onChange={handleCustomerSelect}
                                            placeholder="Search and select supplier..."
                                        />
                                    </div>
                                    {selectedCustomerKey && (
                                        <div className="flex items-center gap-2 md:border-l md:pl-2 w-full md:w-auto mt-2 md:mt-0">
                                            <div className="flex items-center gap-1 text-xs">
                                                <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                                <p className="font-bold text-destructive">{formatCurrency(customerSummaryMap.get(selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)} className="h-7 text-xs">Change Selection</Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(selectedCustomerKey || rtgsFor === 'Outsider') && (
                        <PaymentForm
                            paymentMethod={paymentMethod} rtgsFor={rtgsFor} supplierDetails={supplierDetails} setSupplierDetails={setSupplierDetails}
                            isPayeeEditing={isPayeeEditing} setIsPayeeEditing={setIsPayeeEditing}
                            bankDetails={bankDetails} setBankDetails={setBankDetails}
                            banks={banks} paymentId={paymentId} setPaymentId={setPaymentId}
                            handlePaymentIdBlur={() => {}} rtgsSrNo={rtgsSrNo} setRtgsSrNo={setRtgsSrNo} paymentType={paymentType} setPaymentType={setPaymentType}
                            paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount} cdEnabled={cdEnabled}
                            setCdEnabled={setCdEnabled} cdPercent={cdPercent} setCdPercent={setCdPercent}
                            cdAt={cdAt} setCdAt={setCdAt} calculatedCdAmount={calculatedCdAmount} sixRNo={sixRNo}
                            setSixRNo={setSixRNo} sixRDate={sixRDate} setSixRDate={setSixRDate} utrNo={utrNo}
                            setUtrNo={setUtrNo} parchiNo={parchiNo} setParchiNo={setParchiNo}
                            rtgsQuantity={rtgsQuantity} setRtgsQuantity={setRtgsQuantity} rtgsRate={rtgsRate}
                            setRtgsRate={setRtgsRate} rtgsAmount={rtgsAmount} setRtgsAmount={setRtgsAmount}
                            processPayment={processPayment} resetPaymentForm={() => resetPaymentForm(rtgsFor === 'Outsider')}
                            editingPayment={editingPayment} setIsBankSettingsOpen={setIsBankSettingsOpen} checkNo={checkNo}
                            setCheckNo={setCheckNo}
                            calcTargetAmount={calcTargetAmount} 
                            selectPaymentAmount={selectPaymentAmount}
                            bankAccounts={bankAccounts}
                            selectedAccountId={selectedAccountId}
                            setSelectedAccountId={handleSetSelectedAccount}
                            financialState={financialState}
                            paymentDate={paymentDate}
                            setPaymentDate={setPaymentDate}
                        />
                    )}
                     {selectedCustomerKey && (
                         <TransactionTable
                            suppliers={transactionsForSelectedSupplier}
                            onShowDetails={setDetailsSupplierEntry}
                         />
                     )}
                </TabsContent>
                <TabsContent value="history">
                     <div className="space-y-3">
                        <PaymentHistory
                            payments={paymentHistory}
                            onEdit={handleEditPayment}
                            onDelete={handleDeletePayment}
                            onShowDetails={setSelectedPaymentForDetails}
                            onPrintRtgs={setRtgsReceiptData}
                        />
                     </div>
                </TabsContent>
            </Tabs>
          
            <OutstandingEntriesDialog
                isOpen={isOutstandingModalOpen}
                onOpenChange={setIsOutstandingModalOpen}
                customerName={toTitleCase(customerSummaryMap.get(selectedCustomerKey || '')?.name || '')}
                entries={suppliers.filter(s => s.customerId === selectedCustomerKey && parseFloat(String(s.netAmount)) > 0)}
                selectedIds={selectedEntryIds}
                onSelect={(id: string) => setSelectedEntryIds(prev => { const newSet = new Set(prev); if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); } return newSet; })}
                onSelectAll={(checked: boolean) => {
                    const newSet = new Set<string>();
                    const outstandingEntries = suppliers.filter(s => s.customerId === selectedCustomerKey && parseFloat(String(s.netAmount)) > 0);
                    if(checked) outstandingEntries.forEach(e => newSet.add(e.id));
                    setSelectedEntryIds(newSet);
                }}
                onConfirm={handlePaySelectedOutstanding}
                onCancel={() => { setIsOutstandingModalOpen(false); handleFullReset(); }}
            />

            <DetailsDialog 
                isOpen={!!detailsSupplierEntry}
                onOpenChange={() => setDetailsSupplierEntry(null)}
                customer={detailsSupplierEntry}
                paymentHistory={paymentsForDetailsEntry}
            />
            
            <PaymentDetailsDialog
                payment={selectedPaymentForDetails}
                suppliers={suppliers}
                onOpenChange={() => setSelectedPaymentForDetails(null)}
                onShowEntryDetails={setDetailsSupplierEntry}
            />
            
           <RTGSReceiptDialog
                payment={rtgsReceiptData}
                settings={receiptSettings}
                onOpenChange={() => setRtgsReceiptData(null)}
           />

          <BankSettingsDialog
            isOpen={isBankSettingsOpen}
            onOpenChange={setIsBankSettingsOpen}
          />
        </div>
    );
}

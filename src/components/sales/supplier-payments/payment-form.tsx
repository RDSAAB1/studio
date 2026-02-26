
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { addBank, getOptionsRealtime, addOption, updateOption, deleteOption } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import type { OptionItem } from '@/lib/definitions';
import { Settings } from 'lucide-react';
import { OptionsManagerDialog } from '@/components/sales/options-manager-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const cdOptions = [
    { value: 'partial_on_paid', label: 'Partial CD on Paid Amount' },
    { value: 'on_unpaid_amount', label: 'CD on Unpaid Amount' },
    { value: 'on_full_amount', label: 'Full CD on Full Amount' },
    { value: 'proportional_cd', label: 'Proportional CD (Exact Distribution)' },
    { value: 'on_previously_paid_no_cd', label: 'On Paid Amount (No CD)' },
];

const getPaymentMethodStyles = (method: string, isSelected: boolean) => {
    if (!isSelected) {
        return "bg-transparent border border-transparent text-slate-600 hover:bg-card/70 hover:border-slate-200/80";
    }

    return "bg-card border border-slate-200/80 text-slate-900 shadow-sm ring-1 ring-violet-200/60";
};

export const PaymentForm = React.memo(PaymentFormComponent);

function PaymentFormComponent(props: any) {
    const {
        paymentMethod,
        paymentId, setPaymentId, handlePaymentIdBlur,
        paymentType, setPaymentType, paymentDate, setPaymentDate,
        drCr, setDrCr,
        notes, setNotes,
        settleAmount, handleSettleAmountChange,
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount, setCdAmount,
        editingPayment,
        bankAccounts, selectedAccountId, setSelectedAccountId,
        financialState,
        finalAmountToBePaid, handleToBePaidChange,
        setRtgsAmount,
        handleEditPayment, // Receive the edit handler
        parchiNo, setParchiNo, // Receive parchiNo and its setter
        rtgsSrNo, setRtgsSrNo, handleRtgsSrNoBlur,
        checkNo, setCheckNo,
        onPaymentMethodChange, // Explicitly extract onPaymentMethodChange
        setPaymentMethod, // Also get setPaymentMethod directly as fallback
        hideRtgsToggle = false, // New prop to hide RTGS toggle
        centerName, setCenterName, // Center Name for Gov payments
        centerNameOptions = [], // Center Name options
        onClearPaymentForm,
        onProcessPayment,
        isProcessing,
        
        

        totalOutstandingForSelected,
    } = props;

    // Local state for To Be Paid to prevent lag - updates immediately, syncs to parent after debounce
    const [localToBePaid, setLocalToBePaid] = useState(finalAmountToBePaid);
    const toBePaidDebounceRef = React.useRef<NodeJS.Timeout | null>(null);
    
    // Center Name management dialog state
    const [isCenterNameDialogOpen, setIsCenterNameDialogOpen] = useState(false);
    const { toast } = useToast();

    // Sync local state when prop changes (e.g., from external updates)
    useEffect(() => {
        setLocalToBePaid(finalAmountToBePaid);
    }, [finalAmountToBePaid]);

    // Cleanup debounce timer
    useEffect(() => {
        return () => {
            if (toBePaidDebounceRef.current) {
                clearTimeout(toBePaidDebounceRef.current);
            }
        };
    }, []);

    // Memoize payment options to avoid recalculation on every render
    const paymentFromOptions = useMemo(() => {
        const balances = financialState?.balances || new Map();
        const cashOption = { 
            value: 'CashInHand', 
            label: `Cash In Hand (${formatCurrency(balances.get('CashInHand') || 0)})`,
            displayValue: 'Cash In Hand'
        };
        const safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
        const bankOptions = safeBankAccounts.map((acc: any) => ({ 
            value: acc.id, 
            label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)}) (${formatCurrency(balances.get(acc.id) || 0)})`,
            displayValue: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)})`
        }));
        
        if (paymentMethod === 'Cash') {
            return [cashOption];
        }
        if (paymentMethod === 'Ledger') {
            return [cashOption, ...bankOptions];
        }
        return bankOptions;
    }, [paymentMethod, financialState?.balances, bankAccounts]);

    const isLedger = paymentMethod === 'Ledger';
    const isGov = paymentMethod === 'Gov.';
    const cdAllowed = !(isLedger || isGov);
    
    const queueToBePaidUpdate = (value: number) => {
        if (toBePaidDebounceRef.current) {
            clearTimeout(toBePaidDebounceRef.current);
        }
        toBePaidDebounceRef.current = setTimeout(() => {
            handleToBePaidChange(value);
        }, 500);
    };

    useEffect(() => {
        if (!cdAllowed && cdEnabled) {
            setCdEnabled(false);
        }
    }, [cdAllowed, cdEnabled, setCdEnabled]);

    useEffect(() => {
        if (!isLedger) return;
        if (paymentType !== 'Partial') {
            setPaymentType('Partial');
        }
    }, [isLedger, paymentType, setPaymentType]);


    useEffect(() => {
        if (paymentMethod === 'RTGS' && finalAmountToBePaid && finalAmountToBePaid > 0 && !editingPayment) {
            setRtgsAmount(finalAmountToBePaid);
        }
    }, [paymentMethod, finalAmountToBePaid, editingPayment, setRtgsAmount]);

    // Memoize the buttons list to avoid recreating on every render
    const paymentMethods = useMemo(() => ['Cash', 'Online', 'Ledger', 'RTGS', 'Gov.'] as const, []);

    return (
        <>
            <div className="w-full max-w-full flex flex-col h-full">
                <Card className="w-full max-w-full overflow-hidden flex flex-col h-full border border-slate-200/80 bg-card shadow-[0_10px_30px_rgba(0,0,0,0.10)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.14)] transition-shadow">
                    <CardContent className="px-2.5 py-1.5 space-y-1.5 text-[10px] overflow-hidden w-full max-w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                {!hideRtgsToggle && (
                                <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] bg-slate-100/80 border border-slate-200/80 p-0.5">
                                    {paymentMethods.map((method) => (
                                        <Button
                                            key={method}
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "h-6 px-2.5 text-[9px] font-semibold transition-colors border",
                                                getPaymentMethodStyles(method, paymentMethod === method)
                                            )}
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (onPaymentMethodChange) {
                                                    onPaymentMethodChange(method);
                                                } else if (setPaymentMethod) {
                                                    setPaymentMethod(method);
                                                }
                                            }}
                                        >
                                            {method}
                                        </Button>
                                    ))}
                                </div>
                                )}
                                {cdAllowed && (
                                <div className="flex items-center shrink-0">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            if (cdAllowed) {
                                                setCdEnabled(!cdEnabled);
                                            }
                                        }} 
                                        className={cn(
                                            "relative w-28 h-6 flex items-center rounded-[12px] p-0.5 border border-slate-200/80 bg-slate-100/80 overflow-hidden text-[9px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/15 focus-visible:ring-offset-0",
                                            cdAllowed ? "cursor-pointer hover:bg-slate-100 hover:border-slate-300" : "cursor-not-allowed opacity-60"
                                        )}
                                    >
                                        <span className="absolute left-2.5 text-[8px] font-semibold text-slate-500 z-0">Off</span>
                                        <span className="absolute right-2.5 text-[8px] font-semibold text-slate-500 z-0">On</span>
                                        <div
                                            className={cn(
                                                "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-[10px] shadow-sm flex items-center justify-center z-10 border border-slate-200/80",
                                                cdEnabled 
                                                    ? "left-[calc(50%+2px)]"
                                                    : "left-[2px]"
                                            )}
                                            style={{
                                                backgroundColor: cdEnabled 
                                                    ? 'hsl(var(--primary))'
                                                    : 'rgb(255 255 255 / 0.9)'
                                            }}
                                        >
                                            <span className={cn("text-[8px] font-black", cdEnabled ? "text-primary-foreground" : "text-slate-700")}>CD</span>
                                        </div>
                                    </button>
                                </div>
                                )}
                            </div>
                          {/* Payment Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 w-full">
                            {/* Payment Date - Hidden for RTGS (will be filled from RTGS Report) */}
                            {paymentMethod !== 'RTGS' && (
                                <div className="space-y-1">
                                    <Label htmlFor="paymentDate" className="text-[10px] font-semibold text-slate-500">Payment Date</Label>
                                    <SmartDatePicker
                                        id="paymentDate"
                                        value={paymentDate}
                                        onChange={(val) => setPaymentDate(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                                        placeholder="Pick a date"
                                        inputClassName="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                        buttonClassName="h-7 w-7"
                                        returnDate={true}
                                    />
                                </div>
                            )}
                            
                            {/* Additional Payment Fields */}
                            {(paymentMethod === 'Cash' || paymentMethod === 'Online' || paymentMethod === 'RTGS') && (
                                <>
                                </>
                            )}

                            {(paymentMethod === 'Cash' || paymentMethod === 'Online' || paymentMethod === 'Ledger' || paymentMethod === 'Gov.') && (
                                <div className="space-y-1">
                                    <Label htmlFor="paymentId" className="text-[10px] font-semibold text-slate-500">{paymentMethod === 'Cash' ? 'Voucher No.' : 'Payment ID'}</Label>
                                    <Input id="paymentId" name="paymentId" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={(e) => handlePaymentIdBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15" />
                                </div>
                            )}


                             
                            {(paymentMethod === 'Cash' || paymentMethod === 'RTGS' || paymentMethod === 'Gov.') && (
                                <div className="space-y-1">
                                    <Label htmlFor="parchiNo" className="text-[10px] font-semibold text-slate-500">Parchi (SR#)</Label>
                                    <Input 
                                        id="parchiNo"
                                        name="parchiNo"
                                        value={parchiNo || ''} 
                                        onChange={(e) => {

                                            if (setParchiNo) {
                                                setParchiNo(e.target.value);
                                            }
                                        }} 
                                        className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                        key={`parchi-${parchiNo}`}
                                    />
                                </div>
                            )}

                            {(paymentMethod === 'Online' || paymentMethod === 'Ledger' || paymentMethod === 'Gov.') && (
                                <div className="space-y-1">
                                    <Label htmlFor="checkNo" className="text-[10px] font-semibold text-slate-500">
                                        {paymentMethod === 'Online' ? 'Serial No. (SR#)' : 'Reference No.'}
                                    </Label>
                                    <Input
                                        id="checkNo"
                                        name="checkNo"
                                        value={checkNo}
                                        onChange={e => setCheckNo(e.target.value)}
                                        className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                    />
                                </div>
                            )}


                             {paymentMethod === 'RTGS' && (
                                <div className="space-y-1">
                                    <Label htmlFor="rtgsSrNo" className="text-[10px] font-semibold text-slate-500">RTGS SR No.</Label>
                                    <Input id="rtgsSrNo" name="rtgsSrNo" value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15" />
                                </div>
                            )}

                             {paymentMethod === 'Gov.' && (
                                <>
                                <div className="space-y-1">
                                    <Label htmlFor="govSrNo" className="text-[10px] font-semibold text-slate-500">Gov. SR No.</Label>
                                    <Input id="govSrNo" name="govSrNo" value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15" />
                                </div>
                                <div className="space-y-1 hidden">
                                    <Label className="text-[9px] font-bold">Gov Payment</Label>
                                    <div className="h-7 text-[9px] flex items-center px-3 py-1 bg-primary/10 border-2 border-primary/20 rounded-md text-primary font-extrabold">
                                        Gov Payment Account
                                    </div>
                                </div>
                                </>
                            )}

                            {paymentMethod === 'Ledger' && (
                                <div className="col-span-full grid grid-cols-2 gap-1 w-full">
                                    <div className="space-y-1">
                                        <Label htmlFor="ledgerDebit" className="text-[10px] font-semibold text-slate-500">Debit</Label>
                                        <Input
                                            id="ledgerDebit"
                                            name="ledgerDebit"
                                            type="number"
                                            value={drCr === 'Debit' ? (isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)) : 0}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                setDrCr('Debit');
                                                setLocalToBePaid(value);
                                                queueToBePaidUpdate(value);
                                            }}
                                            className="h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="ledgerCredit" className="text-[10px] font-semibold text-slate-500">Credit</Label>
                                        <Input
                                            id="ledgerCredit"
                                            name="ledgerCredit"
                                            type="number"
                                            value={drCr === 'Credit' ? (isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)) : 0}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                setDrCr('Credit');
                                                setLocalToBePaid(value);
                                                queueToBePaidUpdate(value);
                                            }}
                                            className="h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                        />
                                    </div>
                                </div>
                            )}

                            {(paymentMethod === 'Ledger' || paymentMethod === 'Gov.') && (
                                <div className="space-y-1 col-span-full">
                                    <Label htmlFor="notes" className="text-[10px] font-semibold text-slate-500">Particulars / Remarks</Label>
                                    <Input
                                        id="notes"
                                        name="notes"
                                        value={notes || ''}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                    />
                                </div>
                            )}
                            </div>

                          {!isLedger && (
                            <>
                              {paymentMethod === 'Gov.' ? (
                                <div className="grid grid-cols-3 gap-1 w-full">
                                  <div className="space-y-1">
                                    <Label htmlFor="centerName" className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                                      Center
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4 shrink-0 hover:bg-violet-50 hover:text-primary"
                                        onClick={() => setIsCenterNameDialogOpen(true)}
                                        title="Manage Center Names"
                                      >
                                        <Settings className="h-3 w-3"/>
                                      </Button>
                                    </Label>
                                    <CustomDropdown
                                      id="centerName"
                                      options={centerNameOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))}
                                      value={centerName || null}
                                      onChange={(value) => {
                                        if (setCenterName) {
                                          setCenterName(value || '');
                                        }
                                      }}
                                      placeholder="Select center..."
                                      inputClassName="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                      maxRows={5}
                                      showScrollbar={true}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label htmlFor="settle-amount" className="text-[10px] font-semibold text-slate-500">Settle</Label>
                                    <Input
                                      id="settle-amount"
                                      name="settle-amount"
                                      type="number"
                                      value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)}
                                      onChange={e => handleSettleAmountChange(parseFloat(e.target.value) || 0)}
                                      readOnly={paymentType === 'Partial'}
                                      className={cn(
                                        "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                        paymentType === 'Partial' && 'bg-slate-50'
                                      )}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label htmlFor="toBePaid" className="text-[10px] font-semibold text-slate-500">To Be Paid</Label>
                                    <Input
                                      id="toBePaid"
                                      name="toBePaid"
                                      type="number"
                                      value={isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        setLocalToBePaid(value);
                                        queueToBePaidUpdate(value);
                                      }}
                                      readOnly={paymentType === 'Full'}
                                      className={cn(
                                        "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                        paymentType === 'Full' && 'bg-slate-50 border-slate-200/80'
                                      )}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 w-full">
                                  {paymentMethod !== 'Gov.' && paymentMethod !== 'Ledger' && (
                                    <div className="space-y-1">
                                      <Label htmlFor="paymentType" className="text-[10px] font-semibold text-slate-500">Payment Type</Label>
                                      <Select value={paymentType} onValueChange={setPaymentType}>
                                        <SelectTrigger id="paymentType" className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Full">Full</SelectItem>
                                          <SelectItem value="Partial">Partial</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {paymentMethod !== 'Gov.' && paymentMethod !== 'Ledger' && (
                                    <div className="space-y-1">
                                      <Label htmlFor="paymentFrom" className="text-[10px] font-semibold text-slate-500">From</Label>
                                      <CustomDropdown
                                        id="paymentFrom"
                                        options={paymentFromOptions}
                                        value={selectedAccountId}
                                        onChange={(value) => setSelectedAccountId(value)}
                                        placeholder="Select Account"
                                        inputClassName="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                      />
                                    </div>
                                  )}

                                  <div className="space-y-1">
                                    <Label htmlFor="settle-amount" className="text-[10px] font-semibold text-slate-500">Settle</Label>
                                    <Input
                                      id="settle-amount"
                                      name="settle-amount"
                                      type="number"
                                      value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)}
                                      onChange={e => handleSettleAmountChange(parseFloat(e.target.value) || 0)}
                                      readOnly={paymentType === 'Partial'}
                                      className={cn(
                                        "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                        paymentType === 'Partial' && 'bg-slate-50'
                                      )}
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label htmlFor="toBePaid" className="text-[10px] font-semibold text-slate-500">To Be Paid</Label>
                                    <Input
                                      id="toBePaid"
                                      name="toBePaid"
                                      type="number"
                                      value={isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        setLocalToBePaid(value);
                                        queueToBePaidUpdate(value);
                                      }}
                                      readOnly={paymentType === 'Full'}
                                      className={cn(
                                        "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                        paymentType === 'Full' && 'bg-slate-50 border-slate-200/80'
                                      )}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        
                    </CardContent>
                    <CardFooter className="px-2.5 pb-2 pt-1 flex items-center justify-end gap-2">
                        <Button
                            size="sm"
                            className="h-7 text-[10px] font-semibold"
                            variant="outline"
                            onClick={() => (onClearPaymentForm ? onClearPaymentForm() : null)}
                            disabled={!!isProcessing}
                        >
                            Clear
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 text-[10px] font-bold"
                            onClick={() => (onProcessPayment ? onProcessPayment() : null)}
                            disabled={!!isProcessing}
                        >
                            {isProcessing ? "Processing..." : "Finalize"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
            
            {/* Center Name Management Dialog */}
            <OptionsManagerDialog
                isOpen={isCenterNameDialogOpen}
                setIsOpen={setIsCenterNameDialogOpen}
                type="centerName"
                options={centerNameOptions}
                onAdd={async (collectionName, optionData) => {
                    await addOption(collectionName, optionData);
                }}
                onUpdate={async (collectionName, id, optionData) => {
                    await updateOption(collectionName, id, optionData);
                }}
                onDelete={async (collectionName, id, name) => {
                    await deleteOption(collectionName, id, name);
                }}
            />
        </>
    );
};

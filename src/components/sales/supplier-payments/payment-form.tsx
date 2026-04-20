
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
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
import { Settings, Loader2 } from 'lucide-react';
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
        return "bg-transparent border border-transparent text-muted-foreground hover:bg-muted/50 hover:border-border/60";
    }

    return "bg-primary text-primary-foreground border-primary/40 shadow-md";
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
        checkNo, setCheckNo, handleCheckNoBlur,
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
    const containerRef = React.useRef<HTMLDivElement>(null);
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
        const adjustmentOption = {
            value: 'Adjustment',
            label: 'Adjustment (No Account Change)',
            displayValue: 'Adjustment',
        };
        
        if (paymentMethod === 'Cash') {
            return [cashOption, adjustmentOption];
        }
        if (paymentMethod === 'Ledger') {
            return [cashOption, ...bankOptions, adjustmentOption];
        }
        return [...bankOptions, adjustmentOption];
    }, [paymentMethod, financialState?.balances, bankAccounts]);

    const isLedger = paymentMethod === 'Ledger';
    const isGov = paymentMethod === 'Gov.';
    const isCash = paymentMethod === 'Cash';
    const isOnline = paymentMethod === 'Online';
    const isRtgs = paymentMethod === 'RTGS';
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

    // Handle Global Shortcuts (Alt+S, Alt+C)
    useEffect(() => {
        const onSave = (e: any) => {
            // Check if this component is "visible" in the SPA
            if (containerRef.current?.closest('.hidden')) return;
            onProcessPayment();
        };
        const onClear = (e: any) => {
            // Check if this component is "visible" in the SPA
            if (containerRef.current?.closest('.hidden')) return;
            onClearPaymentForm();
        };

        window.addEventListener('app:save-entry', onSave);
        window.addEventListener('app:clear-form', onClear);

        return () => {
            window.removeEventListener('app:save-entry', onSave);
            window.removeEventListener('app:clear-form', onClear);
        };
    }, [onProcessPayment, onClearPaymentForm]);

    // Memoize the buttons list to avoid recreating on every render
    const paymentMethods = useMemo(() => ['Cash', 'Online', 'Ledger', 'RTGS', 'Gov.'] as const, []);

    // Layout: Cash / Online / RTGS / Ledger => 2 fields per row, Gov => 3 per row
    const baseGridColsClass = isGov
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 w-full"
        : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-1 w-full";

    return (
        <>
            <div ref={containerRef} className="w-full max-w-full flex flex-col h-full rounded-xl border border-border/60 bg-card/60 shadow-sm overflow-hidden">
                    <div className="px-2 py-1 space-y-1 text-[10px] overflow-hidden w-full max-w-full flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                {!hideRtgsToggle && (
                                <div className="flex flex-nowrap items-center gap-1 rounded-t-xl border-b border-border/50 bg-muted/20 p-0.5 mb-1 -mx-2 px-2 pt-1 overflow-x-auto no-scrollbar min-h-[36px]">
                                    {paymentMethods.map((method) => (
                                        <Button
                                            key={method}
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "h-7 px-2 text-[10px] font-bold transition-colors border-0 rounded-lg",
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
                                            {method === 'Cash' ? 'Cash' : method}
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
                                            "relative w-28 h-7 flex items-center rounded-lg p-0.5 cursor-pointer transition-all duration-300 ease-in-out bg-muted/50 border border-border/80 overflow-hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20",
                                            cdAllowed ? "hover:border-primary/30" : "cursor-not-allowed opacity-60"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "absolute left-2.5 text-[10px] font-bold transition-colors z-0",
                                                !cdEnabled ? "text-muted-foreground/70" : "text-foreground"
                                            )}
                                        >
                                            Off
                                        </span>
                                        <span
                                            className={cn(
                                                "absolute right-2.5 text-[10px] font-bold transition-colors z-0",
                                                cdEnabled ? "text-muted-foreground/70" : "text-foreground"
                                            )}
                                        >
                                            On
                                        </span>
                                        <div
                                            className={cn(
                                                "absolute w-[calc(50%-3px)] h-[calc(100%-4px)] top-0.5 rounded-lg shadow-sm flex items-center justify-center transition-transform duration-300 ease-in-out bg-primary z-10",
                                                cdEnabled ? "left-[calc(50%+1.5px)]" : "left-[1.5px]"
                                            )}
                                        >
                                            <span className="text-[10px] font-bold text-primary-foreground">CD</span>
                                        </div>
                                    </button>
                                </div>
                                )}
                            </div>
                          {/* Payment Details */}
                          <div className={baseGridColsClass}>
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


                             
                            {(paymentMethod === 'RTGS' || paymentMethod === 'Gov.') && (
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

                            {/* (Cash PaymentType now lives with Settle/ToBePaid column below) */}

                            {/* Ledger: Reference + Particulars, Payment From, then Debit/Credit */}
                            {isLedger && (
                                <>
                                <div className="col-span-full grid grid-cols-2 gap-1 w-full">
                                    <div className="space-y-1 min-w-0">
                                      <Label htmlFor="checkNo" className="text-[10px] font-semibold text-slate-500">Reference No.</Label>
                                      <Input
                                          id="checkNo"
                                          name="checkNo"
                                          value={checkNo}
                                          onChange={e => setCheckNo(e.target.value)}
                                          onBlur={handlePaymentIdBlur}
                                          className="h-7 text-[10px] w-[130px] border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                      />
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <Label htmlFor="notes-ledger" className="text-[10px] font-semibold text-slate-500">Particulars / Remarks</Label>
                                      <Input
                                        id="notes-ledger"
                                        name="notes-ledger"
                                        value={notes || ''}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="h-7 text-[10px] w-full border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                      />
                                    </div>
                                </div>
                                <div className="col-span-full space-y-1">
                                    <Label htmlFor="ledger-paymentFrom" className="text-[10px] font-semibold text-slate-500">Payment Method</Label>
                                    <Select
                                        value={selectedAccountId || "__placeholder__"}
                                        onValueChange={(v) => setSelectedAccountId(v === "__placeholder__" ? null : v)}
                                    >
                                        <SelectTrigger id="ledger-paymentFrom" className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15">
                                            <SelectValue placeholder="Income/Credit ya Expense/Debit isse" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__placeholder__" disabled>
                                                Select account (Income/Credit ya Expense/Debit)
                                            </SelectItem>
                                            {paymentFromOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.displayValue || opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                </>
                            )}

                             {paymentMethod === 'RTGS' && (
                                <div className="space-y-1">
                                    <Label htmlFor="rtgsSrNo" className="text-[10px] font-semibold text-slate-500">RTGS SR No.</Label>
                                    <Input id="rtgsSrNo" name="rtgsSrNo" value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15" />
                                </div>
                            )}

                            {paymentMethod === 'Ledger' && (
                                <div className="col-span-full grid grid-cols-2 gap-1 w-full">
                                    <div className="space-y-1">
                                        <Label htmlFor="ledgerDebit" className="text-[10px] font-semibold text-slate-500">Debit (Expense)</Label>
                                        <Input
                                            id="ledgerDebit"
                                            name="ledgerDebit"
                                            type="number"
                                            placeholder="Payment – Total Paid"
                                            value={drCr === 'Debit' ? (isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)) : 0}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                setDrCr('Debit');
                                                setLocalToBePaid(value);
                                                queueToBePaidUpdate(value);
                                            }}
                                            className="h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="ledgerCredit" className="text-[10px] font-semibold text-slate-500">Credit (Income)</Label>
                                        <Input
                                            id="ledgerCredit"
                                            name="ledgerCredit"
                                            type="number"
                                            placeholder="Charge – Total Amount"
                                            value={drCr === 'Credit' ? (isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)) : 0}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                setDrCr('Credit');
                                                setLocalToBePaid(value);
                                                queueToBePaidUpdate(value);
                                            }}
                                            className="h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                        />
                                    </div>
                                </div>
                            )}

                            </div>

                          {!isLedger && (
                            <>
                              {paymentMethod === 'Gov.' ? (
                                <div className="space-y-1 w-full">
                                  {/* Center + Particulars – full width, half-half */}
                                  <div className="grid grid-cols-2 gap-1 w-full">
                                    <div className="space-y-1 min-w-0">
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
                                    <div className="space-y-1 min-w-0">
                                      <Label htmlFor="notes" className="text-[10px] font-semibold text-slate-500">Particulars / Remarks</Label>
                                      <Input
                                        id="notes"
                                        name="notes"
                                        value={notes || ''}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="h-7 text-[10px] w-full border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                      />
                                    </div>
                                  </div>

                                  {/* Settle + To Be Paid */}
                                  <div className="grid grid-cols-2 gap-1 w-full mt-1">
                                    <div className="space-y-1">
                                      <Label htmlFor="settle-amount" className="text-[10px] font-semibold text-slate-500">Settle</Label>
                                      <Input
                                        id="settle-amount"
                                        name="settle-amount"
                                        type="number"
                                        value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)}
                                        readOnly={true}
                                        onFocus={() => { if (paymentType !== 'Full') setPaymentType('Full'); }}
                                        className={cn(
                                          "h-7 text-[10px] w-[130px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15",
                                          'bg-slate-50'
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
                                        onFocus={() => { if (paymentType !== 'Partial') setPaymentType('Partial'); }}
                                        className={cn(
                                          "h-7 text-[10px] w-[130px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15",
                                          paymentType === 'Full' && 'bg-slate-50 border-slate-200/80'
                                        )}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : isCash || isOnline ? (
                                <>
                                  {/* Row 1: Serial/Parchi + Settle + To Be Paid (3 columns) */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 w-full">
                                    <div className="space-y-1">
                                      <Label
                                        htmlFor={isCash ? "parchiNo-inline" : "serial-inline"}
                                        className="text-[10px] font-semibold text-slate-500"
                                      >
                                        {isCash ? "Parchi (SR#)" : "Serial No. (SR#)"}
                                      </Label>
                                      <Input
                                        id={isCash ? "parchiNo-inline" : "serial-inline"}
                                        name={isCash ? "parchiNo-inline" : "serial-inline"}
                                        value={isCash ? (parchiNo || "") : checkNo}
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          if (isCash) {
                                            if (setParchiNo) setParchiNo(value);
                                          } else {
                                            setCheckNo(value);
                                          }
                                        }}
                                        onBlur={!isCash ? handlePaymentIdBlur : undefined}
                                        className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label htmlFor="settle-amount" className="text-[10px] font-semibold text-slate-500">
                                        Settle
                                      </Label>
                                      <Input
                                        id="settle-amount"
                                        name="settle-amount"
                                        type="number"
                                        value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)}
                                        readOnly={true}
                                        onFocus={() => { if (paymentType !== 'Full') setPaymentType('Full'); }}
                                        className={cn(
                                          "h-7 text-[9.5px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-[4px] focus-visible:ring-violet-500/15",
                                          "bg-slate-50"
                                        )}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label htmlFor="toBePaid" className="text-[10px] font-semibold text-slate-500">
                                        To Be Paid
                                      </Label>
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
                                        readOnly={paymentType === "Full"}
                                        onFocus={() => { if (paymentType !== 'Partial') setPaymentType('Partial'); }}
                                        className={cn(
                                          "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 rounded-lg focus-visible:ring-violet-500/15",
                                          paymentType === "Full" && "bg-slate-50 border-slate-200/80"
                                        )}
                                      />
                                    </div>
                                  </div>

                                  {/* Row 2: Payment Type + From (2 columns) */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 w-full mt-1">
                                    <div className="space-y-1">
                                      <Label htmlFor="paymentType" className="text-[10px] font-semibold text-slate-500">
                                        Payment Type
                                      </Label>
                                      <Select value={paymentType} onValueChange={setPaymentType}>
                                        <SelectTrigger
                                          id="paymentType"
                                          className="h-7 text-[9.5px] border border-slate-200/80 bg-transparent text-slate-900 rounded-[4px] focus-visible:ring-violet-500/15"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Full">Full</SelectItem>
                                          <SelectItem value="Partial">Partial</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label htmlFor="paymentFrom" className="text-[10px] font-semibold text-slate-500">
                                        Payment Method
                                      </Label>
                                      <Select
                                        value={selectedAccountId || "__placeholder__"}
                                        onValueChange={(v) => setSelectedAccountId(v === "__placeholder__" ? null : v)}
                                      >
                                        <SelectTrigger className="h-7 text-[9.5px] border border-slate-200/80 bg-transparent text-slate-900 rounded-[4px] focus-visible:ring-violet-500/15">
                                          <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__placeholder__" disabled>
                                            Select Account
                                          </SelectItem>
                                          {paymentFromOptions.length === 0 && (
                                            <SelectItem value="__empty__" disabled>
                                              Add bank accounts in Settings
                                            </SelectItem>
                                          )}
                                          {paymentFromOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.displayValue || opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="grid grid-cols-2 gap-1 w-full">
                                  {/* Default (e.g. RTGS): left Payment Type + From, right Settle + To Be Paid */}
                                  <div className="space-y-1">
                                    <div className="space-y-1">
                                      <Label htmlFor="paymentType" className="text-[10px] font-semibold text-slate-500">
                                        Payment Type
                                      </Label>
                                      <Select value={paymentType} onValueChange={setPaymentType}>
                                        <SelectTrigger
                                          id="paymentType"
                                          className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Full">Full</SelectItem>
                                          <SelectItem value="Partial">Partial</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label htmlFor="paymentFrom" className="text-[10px] font-semibold text-slate-500">
                                        Payment Method
                                      </Label>
                                      <Select
                                        value={selectedAccountId || "__placeholder__"}
                                        onValueChange={(v) => setSelectedAccountId(v === "__placeholder__" ? null : v)}
                                      >
                                        <SelectTrigger className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15">
                                          <SelectValue placeholder="Select Account" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__placeholder__" disabled>
                                            Select Account
                                          </SelectItem>
                                          {paymentFromOptions.length === 0 && (
                                            <SelectItem value="__empty__" disabled>
                                              Add bank accounts in Settings
                                            </SelectItem>
                                          )}
                                          {paymentFromOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.displayValue || opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="space-y-1">
                                      <Label htmlFor="settle-amount" className="text-[10px] font-semibold text-slate-500">
                                        Settle
                                      </Label>
                                      <Input
                                        id="settle-amount"
                                        name="settle-amount"
                                        type="number"
                                        value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)}
                                        readOnly={true}
                                        onFocus={() => { if (paymentType !== 'Full') setPaymentType('Full'); }}
                                        className={cn(
                                          "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                          "bg-slate-50"
                                        )}
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label htmlFor="toBePaid" className="text-[10px] font-semibold text-slate-500">
                                        To Be Paid
                                      </Label>
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
                                        readOnly={paymentType === "Full"}
                                        onFocus={() => { if (paymentType !== 'Partial') setPaymentType('Partial'); }}
                                        className={cn(
                                          "h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15",
                                          paymentType === "Full" && "bg-slate-50 border-slate-200/80"
                                        )}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {/* Inline CD section: when CD is ON, show three fields inside same form (for non-ledger & non-gov) */}
                          {cdEnabled && cdAllowed && (
                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_72px_minmax(0,1fr)] gap-1 w-full mt-1">
                              <div className="space-y-1 min-w-0">
                                <Label htmlFor="cdAt" className="text-[10px] font-semibold text-slate-500">CD At</Label>
                                <Select value={cdAt} onValueChange={setCdAt}>
                                  <SelectTrigger id="cdAt" className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15 w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {cdOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1 w-[72px] shrink-0">
                                <Label htmlFor="cd-percent" className="text-[10px] font-semibold text-slate-500">CD%</Label>
                                <Input
                                  id="cd-percent"
                                  type="number"
                                  value={cdPercent}
                                  onChange={(e) => setCdPercent(parseFloat(e.target.value) || 0)}
                                  className="h-7 text-[10px] border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15 w-full"
                                />
                              </div>

                              <div className="space-y-1 min-w-0">
                                <Label htmlFor="cdAmount" className="text-[10px] font-semibold text-slate-500">CD Amount</Label>
                                <Input
                                  id="cdAmount"
                                  name="cdAmount"
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  value={Number.isFinite(calculatedCdAmount) ? calculatedCdAmount : 0}
                                  onChange={(e) => setCdAmount?.(parseFloat(e.target.value) || 0)}
                                  className="h-7 text-[10px] font-semibold border border-slate-200/80 bg-transparent text-slate-900 focus-visible:ring-violet-500/15"
                                />
                              </div>
                            </div>
                          )}
                        
                    </div>
                    <div className="px-2 pb-1.5 pt-1.5 flex items-center justify-end gap-2 border-t border-border/40">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] font-bold px-4 py-0 rounded-lg border border-slate-200/80 bg-white/70 hover:bg-white hover:border-slate-300 shadow-sm transition-all"
                            onClick={onClearPaymentForm}
                            disabled={isProcessing}
                        >
                            Clear (Alt+C)
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 text-[10px] font-bold px-6 py-0 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10 transition-all disabled:opacity-50"
                            onClick={onProcessPayment}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <><Loader2 className="mr-1.5 h-3 w-3 animate-spin"/> Processing...</>
                            ) : (
                                "Finalize (Alt+S)"
                            )}
                        </Button>
                    </div>
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

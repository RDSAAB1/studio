
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { addBank } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const cdOptions = [
    { value: 'partial_on_paid', label: 'Partial CD on Paid Amount' },
    { value: 'on_unpaid_amount', label: 'CD on Unpaid Amount' },
    { value: 'on_full_amount', label: 'Full CD on Full Amount' },
    { value: 'proportional_cd', label: 'Proportional CD (Exact Distribution)' },
    { value: 'on_previously_paid_no_cd', label: 'On Paid Amount (No CD)' },
];

export const PaymentForm = (props: any) => {
    const {
        paymentMethod, rtgsFor,
        paymentId, setPaymentId, handlePaymentIdBlur,
        paymentType, setPaymentType, paymentDate, setPaymentDate,
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
        setPaymentMethod // Also get setPaymentMethod directly as fallback
    } = props;

    const paymentFromOptions = useMemo(() => {
        const cashOption = { 
            value: 'CashInHand', 
            label: `Cash In Hand (${formatCurrency(financialState.balances.get('CashInHand') || 0)})`,
            displayValue: 'Cash In Hand'
        };
        const safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
        const bankOptions = safeBankAccounts.map((acc: any) => ({ 
            value: acc.id, 
            label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)}) (${formatCurrency(financialState.balances.get(acc.id) || 0)})`,
            displayValue: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)})`
        }));
        
        if (paymentMethod === 'Cash') {
            return [cashOption];
        }
        return bankOptions;
    }, [paymentMethod, financialState.balances, bankAccounts]);


    useEffect(() => {
        if (paymentMethod === 'RTGS' && finalAmountToBePaid && finalAmountToBePaid > 0 && !editingPayment) {
            setRtgsAmount(finalAmountToBePaid);
        }
    }, [paymentMethod, finalAmountToBePaid, editingPayment, setRtgsAmount]);

    return (
        <>
            <div className="w-full max-w-full flex flex-col h-full">
                <Card className="w-full max-w-full overflow-hidden flex flex-col h-full">
                    <CardContent className="px-2.5 py-2.5 space-y-2 text-[10px] overflow-hidden w-full max-w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {(['Cash', 'Online', 'RTGS'] as const).map((method) => (
                                        <Button
                                            key={method}
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "h-6 px-2 text-[10px]",
                                                paymentMethod === method ? "bg-primary text-primary-foreground" : "border border-input bg-muted/60 text-muted-foreground hover:text-foreground"
                                            )}
                                            variant={paymentMethod === method ? "default" : "ghost"}
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
                                <div className="flex items-center shrink-0">
                                    <button type="button" onClick={() => setCdEnabled(!cdEnabled)} className={cn( "relative w-32 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", cdEnabled ? 'bg-primary/20' : 'bg-secondary/20' )} >
                                        <span className={cn("absolute right-3 text-[10px] font-semibold transition-colors duration-300", cdEnabled ? 'text-primary' : 'text-muted-foreground')}>On</span>
                                        <span className={cn("absolute left-3 text-[10px] font-semibold transition-colors duration-300", !cdEnabled ? 'text-primary' : 'text-muted-foreground')}>Off</span>
                                        <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", cdEnabled ? 'translate-x-[calc(100%-24px)]' : 'translate-x-[-4px]' )}>
                                            <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", cdEnabled ? 'bg-primary' : 'bg-secondary' )}>
                                                <span className="text-[10px] font-bold text-primary-foreground">CD</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                          <div className="flex flex-wrap items-end gap-x-2 gap-y-1.5 w-full">
                            {/* Payment Details */}
                            <div className="space-y-0.5 flex-1 min-w-[100px] max-w-full">
                                <Label className="text-[10px]">Payment Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-7 text-[10px]", !paymentDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-1.5 h-3 w-3" />
                                            {paymentDate ? format(paymentDate, "dd-MMM-yy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            
                            {(paymentMethod === 'Cash' || paymentMethod === 'Online') && (
                                <div className="space-y-0.5 flex-1 min-w-[90px] max-w-full">
                                    <Label className="text-[10px]">{paymentMethod === 'Cash' ? 'Payment ID (Voucher No.)' : 'Payment ID'}</Label>
                                    <Input value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={(e) => handlePaymentIdBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono" />
                                </div>
                            )}
                             
                            {(paymentMethod === 'Cash' || paymentMethod === 'RTGS') && (
                                <div className="space-y-0.5 flex-1 min-w-[90px] max-w-full">
                                    <Label className="text-[10px]">Parchi No. (SR#)</Label>
                                    <Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-7 text-[10px]"/>
                                </div>
                            )}

                             {paymentMethod === 'Online' && (
                                <div className="space-y-0.5 flex-1 min-w-[90px] max-w-full">
                                    <Label className="text-[10px]">Check No. / Ref</Label>
                                    <Input value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-7 text-[10px]"/>
                                </div>
                            )}

                             {paymentMethod === 'RTGS' && (
                                <div className="space-y-0.5 flex-1 min-w-[90px] max-w-full">
                                    <Label className="text-[10px]">RTGS SR No.</Label>
                                    <Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-7 text-[10px] font-mono" />
                                </div>
                            )}

                            <div className="space-y-0.5 flex-1 min-w-[90px] max-w-full">
                                <Label className="text-[10px]">Payment Type</Label>
                                <Select value={paymentType} onValueChange={setPaymentType}>
                                    <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Full">Full</SelectItem>
                                        <SelectItem value="Partial">Partial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-0.5 flex-1 min-w-[100px] max-w-full">
                                <Label htmlFor="settle-amount" className="text-[10px]">Settle Amount</Label>
                                <Input id="settle-amount" type="number" value={Math.round(settleAmount)} onChange={e => handleSettleAmountChange(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Partial' && rtgsFor !== 'Outsider'} className={cn("h-7 text-[10px]", paymentType === 'Partial' && rtgsFor !== 'Outsider' && 'bg-muted/50')} />
                            </div>

                             <div className="space-y-0.5 flex-1 min-w-[100px] max-w-full">
                                <Label className="text-[10px] font-bold text-green-600">To Be Paid</Label>
                                <Input type="number" value={Math.round(finalAmountToBePaid)} onChange={(e) => handleToBePaidChange(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full' && rtgsFor !== 'Outsider'} className={cn("h-7 text-[10px] font-bold text-green-600 border-green-500 bg-green-500/10", paymentType === 'Full' && rtgsFor !== 'Outsider' && 'bg-muted/50 border-input')} />
                            </div>
                            
                            <div className="space-y-0.5 flex-1 min-w-[120px] max-w-full">
                                <Label className="text-[10px]">Payment From</Label>
                                <CustomDropdown
                                    options={paymentFromOptions}
                                    value={selectedAccountId}
                                    onChange={(value) => setSelectedAccountId(value)}
                                    placeholder="Select Account"
                                    inputClassName="h-7 text-[10px]"
                                />
                            </div>
                        </div>
                        
                    </CardContent>
                </Card>
            </div>
            <CardFooter className="p-0 pt-2" />
        </>
    );
};

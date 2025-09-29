
"use client";

import React from 'react';
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, RefreshCw, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { RtgsForm } from './rtgs-form';
import { PaymentCombinationGenerator } from './payment-combination-generator';


const cdOptions = [
    { value: 'partial_on_paid', label: 'Partial CD on Paid Amount' },
    { value: 'on_unpaid_amount', label: 'CD on Unpaid Amount' },
    { value: 'on_full_amount', label: 'Full CD (Paid + Unpaid)' },
];


export const PaymentForm = (props: any) => {
    const {
        paymentMethod, rtgsFor,
        paymentId, setPaymentId, handlePaymentIdBlur,
        paymentType, setPaymentType, paymentDate, setPaymentDate,
        paymentAmount, setPaymentAmount, cdEnabled, setCdEnabled,
        cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount,
        processPayment, isProcessing, resetPaymentForm, editingPayment,
        bankAccounts, selectedAccountId,
        financialState,
        calcTargetAmount, setCalcTargetAmount,
        selectPaymentAmount,
    } = props;


    return (
        <Card>
            <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-2 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">Payment Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-8 text-xs", !paymentDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {paymentDate ? format(paymentDate, "dd-MMM-yy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={paymentDate} onSelect={setPaymentDate} initialFocus /></PopoverContent>
                        </Popover>
                    </div>

                    {(paymentMethod !== 'RTGS' || rtgsFor === 'Supplier') && (
                    <>
                        <div className="space-y-1"><Label className="text-xs">Payment ID</Label><Input id="payment-id" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={handlePaymentIdBlur} className="h-8 text-xs font-mono" /></div>
                        <div className="space-y-1"><Label className="text-xs">Payment Type</Label><Select value={paymentType} onValueChange={setPaymentType}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Full">Full</SelectItem><SelectItem value="Partial">Partial</SelectItem></SelectContent></Select></div>
                        <div className="space-y-1"><Label htmlFor="payment-amount" className="text-xs">Pay Amount</Label><Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-8 text-xs" /></div>
                    </>
                    )}
                    
                    {(paymentMethod === 'Online' || paymentMethod === 'RTGS') && (
                         <div className="space-y-1">
                            <Label className="text-xs">Payment From</Label>
                            <CustomDropdown
                                options={[{ value: 'CashInHand', label: `Cash In Hand (${formatCurrency(financialState.balances.get('CashInHand') || 0)})` }, ...bankAccounts.map((acc: any) => ({ value: acc.id, label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)}) (${formatCurrency(financialState.balances.get(acc.id) || 0)})` }))]}
                                value={selectedAccountId}
                                onChange={props.handleSetSelectedAccount}
                                placeholder="Select Account"
                            />
                        </div>
                    )}
                </div>
                
                {(paymentMethod !== 'RTGS' || rtgsFor === 'Supplier') && (
                <>
                <div className="flex items-center justify-between mt-4 mb-2">
                    <h3 className="text-sm font-semibold">Cash Discount (CD)</h3>
                    <div className="flex items-center space-x-2">
                        <button type="button" onClick={() => setCdEnabled(!cdEnabled)} className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", cdEnabled ? 'bg-primary/20' : 'bg-secondary/20' )} >
                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", cdEnabled ? 'text-primary' : 'text-muted-foreground')}>On</span>
                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !cdEnabled ? 'text-primary' : 'text-muted-foreground')}>Off</span>
                            <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", cdEnabled ? 'translate-x-[calc(100%-28px)]' : 'translate-x-[-4px]' )}>
                                <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", cdEnabled ? 'bg-primary' : 'bg-secondary' )}>
                                    <span className="text-xs font-bold text-primary-foreground">CD</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
                {cdEnabled && (
                    <div className="p-2 border rounded-lg bg-background grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div className="space-y-1"><Label htmlFor="cd-percent" className="text-xs">CD %</Label><Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-xs">CD At</Label><Select value={cdAt} onValueChange={setCdAt}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{cdOptions.map(opt => (<SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>))}</SelectContent></Select></div>
                        <div className="space-y-1"><Label className="text-xs">CD Amount</Label><Input value={formatCurrency(calculatedCdAmount)} readOnly className="h-8 text-xs font-bold text-primary" /></div>
                    </div>
                )}
                </>
                )}
                
                {paymentMethod === 'RTGS' && <RtgsForm {...props} />}
                 
                 <CardFooter className="p-0 pt-3">
                    <Card className="bg-muted/30 w-full p-2">
                        <CardContent className="p-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">To Pay:</span><span className="text-sm font-semibold">{formatCurrency(props.rtgsAmount || paymentAmount)}</span></div>
                            {cdEnabled && (<div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">CD:</span><span className="text-sm font-semibold">{formatCurrency(calculatedCdAmount)}</span></div>)}
                            <div className="flex items-center gap-2 border-l pl-2 ml-2"><span className="text-sm font-medium text-muted-foreground">Total Reduction:</span><span className="text-base font-bold text-primary">{formatCurrency((props.rtgsAmount || paymentAmount) + calculatedCdAmount)}</span></div>
                            <div className="flex-grow"></div>
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => resetPaymentForm(rtgsFor === 'Outsider')}><RefreshCw className="mr-2 h-3 w-3" />Clear Form</Button>
                            <Button onClick={processPayment} size="sm" className="h-8 text-xs" disabled={isProcessing}>
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                {editingPayment ? 'Update Payment' : 'Finalize Payment'}
                            </Button>
                        </CardContent>
                    </Card>
                </CardFooter>
            </CardContent>
        </Card>
    );
};

    
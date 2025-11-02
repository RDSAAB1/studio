
"use client";

import React, { useMemo, useState } from 'react';
import { cn, formatCurrency, toTitleCase } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, RefreshCw, Loader2, Pen, User, Hash, CircleDollarSign } from "lucide-react";
import { format } from 'date-fns';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { RtgsForm } from './rtgs-form';
import { PaymentCombinationGenerator } from './payment-combination-generator';
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

const SectionTitle = ({ title, onEdit, editingPayment, icon, description }: { title: string, onEdit?: () => void, editingPayment?: boolean, icon?: React.ReactNode, description?: string }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
             {icon}
            <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
        </div>
        {onEdit && !editingPayment && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pen className="h-4 w-4"/></Button>}
    </div>
);


export const PaymentForm = (props: any) => {
    const {
        paymentMethod, rtgsFor,
        paymentId, setPaymentId, handlePaymentIdBlur,
        paymentType, setPaymentType, paymentDate, setPaymentDate,
        settleAmount, handleSettleAmountChange,
        cdEnabled, setCdEnabled,
        cdPercent, setCdPercent, cdAt, setCdAt, calculatedCdAmount,
        processPayment, isProcessing, resetPaymentForm, editingPayment,
        bankAccounts, selectedAccountId, setSelectedAccountId,
        financialState,
        finalAmountToBePaid, handleToBePaidChange,
        calcTargetAmount, setCalcTargetAmount,
        minRate, setMinRate, maxRate, setMaxRate,
        selectPaymentAmount,
        handleEditPayment, // Receive the edit handler
        parchiNo, setParchiNo, // Receive parchiNo and its setter
        supplierDetails, setSupplierDetails, isPayeeEditing, setIsPayeeEditing,
        rtgsSrNo, setRtgsSrNo, handleRtgsSrNoBlur,
        utrNo, setUtrNo, checkNo, setCheckNo
    } = props;

    const paymentFromOptions = useMemo(() => {
        const cashOption = { value: 'CashInHand', label: `Cash In Hand (${formatCurrency(financialState.balances.get('CashInHand') || 0)})` };
        const safeBankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
        const bankOptions = safeBankAccounts.map((acc: any) => ({ 
            value: acc.id, 
            label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)}) (${formatCurrency(financialState.balances.get(acc.id) || 0)})` 
        }));
        
        if (paymentMethod === 'Cash') {
            return [cashOption];
        }
        return bankOptions;
    }, [paymentMethod, financialState.balances, bankAccounts]);


    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Payment & CD Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                         <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                            {/* Payment Details */}
                            <div className="space-y-1 flex-1 min-w-[150px]">
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
                            
                            {(paymentMethod === 'Cash' || paymentMethod === 'Online') && (
                                <div className="space-y-1 flex-1 min-w-[120px]">
                                    <Label className="text-xs">{paymentMethod === 'Cash' ? 'Payment ID (Voucher No.)' : 'Payment ID'}</Label>
                                    <Input value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={(e) => handlePaymentIdBlur(e, handleEditPayment)} className="h-8 text-xs font-mono" />
                                </div>
                            )}
                             
                            {paymentMethod === 'Cash' && (
                                <div className="space-y-1 flex-1 min-w-[120px]">
                                    <Label className="text-xs">Parchi No. (SR#)</Label>
                                    <Input value={parchiNo} onChange={(e) => setParchiNo(e.target.value)} className="h-8 text-xs"/>
                                </div>
                            )}

                             {paymentMethod === 'Online' && (
                                <div className="space-y-1 flex-1 min-w-[120px]">
                                    <Label className="text-xs">Check No. / Ref</Label>
                                    <Input value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-8 text-xs"/>
                                </div>
                            )}

                             {paymentMethod === 'RTGS' && (
                                <div className="space-y-1 flex-1 min-w-[120px]">
                                    <Label className="text-xs">RTGS SR No.</Label>
                                    <Input value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-8 text-xs font-mono" />
                                </div>
                            )}

                            <div className="space-y-1 flex-1 min-w-[120px]">
                                <Label className="text-xs">Payment Type</Label>
                                <Select value={paymentType} onValueChange={setPaymentType}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Full">Full</SelectItem>
                                        <SelectItem value="Partial">Partial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-1 flex-1 min-w-[150px]">
                                <Label htmlFor="settle-amount" className="text-xs">Settle Amount</Label>
                                <Input id="settle-amount" type="number" value={Math.round(settleAmount)} onChange={e => handleSettleAmountChange(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Partial' && rtgsFor !== 'Outsider'} className={cn("h-8 text-xs", paymentType === 'Partial' && rtgsFor !== 'Outsider' && 'bg-muted/50')} />
                            </div>

                             <div className="space-y-1 flex-1 min-w-[150px]">
                                <Label className="text-xs font-bold text-green-600">To Be Paid</Label>
                                <Input type="number" value={Math.round(finalAmountToBePaid)} onChange={(e) => handleToBePaidChange(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full' && rtgsFor !== 'Outsider'} className={cn("h-8 text-xs font-bold text-green-600 border-green-500 bg-green-500/10", paymentType === 'Full' && rtgsFor !== 'Outsider' && 'bg-muted/50 border-input')} />
                            </div>
                            
                            <div className="space-y-1 flex-grow min-w-[200px]">
                                <Label className="text-xs">Payment From</Label>
                                <CustomDropdown
                                    options={paymentFromOptions}
                                    value={selectedAccountId}
                                    onChange={(value) => setSelectedAccountId(value)}
                                    placeholder="Select Account"
                                />
                            </div>
                            
                             <div className="flex items-center justify-center pt-2">
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
                             <div className="p-2 border rounded-lg bg-background flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                                    <Label htmlFor="cd-percent" className="text-xs">CD%</Label>
                                    <Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1 flex-1 min-w-[200px]">
                                    <Label className="text-xs">CD At</Label>
                                    <Select value={cdAt} onValueChange={setCdAt}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {cdOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-[150px]">
                                    <Label className="text-xs">CD Amt</Label>
                                    <Input value={formatCurrency(calculatedCdAmount)} readOnly className="h-8 text-xs font-bold text-primary" />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                 {(props.selectedCustomerKey || props.rtgsFor === 'Outsider') && (
                    <Card>
                        <CardHeader>
                            <SectionTitle 
                                title="Payee Details" 
                                icon={<User size={18}/>} 
                                onEdit={() => setIsPayeeEditing(true)} 
                                editingPayment={editingPayment}
                                description={editingPayment ? "Click to edit payee details" : undefined}
                            />
                        </CardHeader>
                        <CardContent className="space-y-3 p-3">
                             {isPayeeEditing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 border rounded-lg bg-background border-blue-200 bg-blue-50/50">
                                    {editingPayment && (
                                        <div className="col-span-full mb-2">
                                            <p className="text-xs text-blue-600 font-medium">✏️ Editing payee details for payment {editingPayment.paymentId || editingPayment.rtgsSrNo}</p>
                                        </div>
                                    )}
                                    <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={supplierDetails.name} onChange={e => setSupplierDetails({...supplierDetails, name: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">{rtgsFor === 'Outsider' ? 'Company' : "Father's Name"}</Label><Input value={supplierDetails.fatherName} onChange={e => setSupplierDetails({...supplierDetails, fatherName: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1 sm:col-span-2 grid grid-cols-2 gap-2">
                                        <div><Label className="text-xs">Contact</Label><Input value={supplierDetails.contact} onChange={e => setSupplierDetails({...supplierDetails, contact: e.target.value})} className="h-8 text-xs" /></div>
                                        <div><Label className="text-xs">Address</Label><Input value={supplierDetails.address} onChange={e => setSupplierDetails({...supplierDetails, address: e.target.value})} className="h-8 text-xs" /></div>
                                    </div>
                                    <div className="col-span-full flex justify-end">
                                        <Button size="sm" onClick={() => setIsPayeeEditing(false)} className="h-7 text-xs">Done</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground p-2 rounded-lg bg-background/50">
                                    <p><span className="font-semibold">Name:</span> {supplierDetails.name}</p>
                                    <p><span className="font-semibold">{rtgsFor === 'Outsider' ? 'Company:' : "Father's Name:"}</span> {supplierDetails.fatherName}</p>
                                    <p><span className="font-semibold">Contact:</span> {supplierDetails.contact}</p>
                                    <p className="col-span-full"><span className="font-semibold">Address:</span> {supplierDetails.address}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {paymentMethod === 'RTGS' && (
                <div className="space-y-3">
                     <Card className="mt-3">
                        <CardContent className="p-3">
                            <RtgsForm {...props} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Generate Payment Combinations</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                             <PaymentCombinationGenerator
                                calcTargetAmount={calcTargetAmount}
                                setCalcTargetAmount={setCalcTargetAmount}
                                minRate={minRate}
                                setMinRate={setMinRate}
                                maxRate={maxRate}
                                setMaxRate={setMaxRate}
                                selectPaymentAmount={selectPaymentAmount}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}
             
            <CardFooter className="p-0 pt-3">
                <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="w-full sm:w-auto p-3 rounded-lg bg-muted/50 flex items-center justify-between sm:justify-start gap-4">
                        <div className="flex items-center gap-2">
                           <CircleDollarSign className="h-5 w-5 text-primary"/>
                           <div>
                            <p className="text-xs text-muted-foreground">To Be Paid</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(finalAmountToBePaid)}</p>
                           </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => resetPaymentForm(rtgsFor === 'Outsider')}><RefreshCw className="mr-2 h-3 w-3" />Clear Form</Button>
                        <Button onClick={processPayment} size="sm" className="h-8 text-xs" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingPayment ? 'Update Payment' : 'Finalize Payment'}
                        </Button>
                    </div>
                </div>
            </CardFooter>
        </>
    );
};

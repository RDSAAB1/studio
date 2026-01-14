
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

const cdOptions = [
    { value: 'partial_on_paid', label: 'Partial CD on Paid Amount' },
    { value: 'on_unpaid_amount', label: 'CD on Unpaid Amount' },
    { value: 'on_full_amount', label: 'Full CD on Full Amount' },
    { value: 'proportional_cd', label: 'Proportional CD (Exact Distribution)' },
    { value: 'on_previously_paid_no_cd', label: 'On Paid Amount (No CD)' },
];

export const PaymentForm = (props: any) => {
    const {
        paymentMethod,
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
        setPaymentMethod, // Also get setPaymentMethod directly as fallback
        hideRtgsToggle = false, // New prop to hide RTGS toggle
        centerName, setCenterName, // Center Name for Gov payments
        centerNameOptions = [] // Center Name options
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

    // Debug: Log when parchiNo changes
    useEffect(() => {

    }, [parchiNo]);

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
        return bankOptions;
    }, [paymentMethod, financialState?.balances, bankAccounts]);


    useEffect(() => {
        if (paymentMethod === 'RTGS' && finalAmountToBePaid && finalAmountToBePaid > 0 && !editingPayment) {
            setRtgsAmount(finalAmountToBePaid);
        }
    }, [paymentMethod, finalAmountToBePaid, editingPayment, setRtgsAmount]);

    return (
        <>
            <div className="w-full max-w-full flex flex-col h-full">
                <Card className="w-full max-w-full overflow-hidden flex flex-col h-full border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
                    <CardContent className="px-3 py-2.5 space-y-2 text-[10px] overflow-hidden w-full max-w-full flex flex-col flex-1 min-h-0 overflow-y-auto">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                {!hideRtgsToggle && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {(['Cash', 'Online', 'RTGS', 'Gov.'] as const).map((method) => (
                                        <Button
                                            key={method}
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "h-7 px-3 text-[10px] font-extrabold transition-all border-2",
                                                paymentMethod === method 
                                                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg border-primary/30" 
                                                    : "border-border/40 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/80 hover:border-primary/20"
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
                                )}
                                <div className="flex items-center shrink-0">
                                    <button 
                                        type="button" 
                                        onClick={() => setCdEnabled(!cdEnabled)} 
                                        className="relative w-32 h-7 flex items-center rounded-lg p-0.5 cursor-pointer border-2 border-border/55 bg-muted/75 overflow-hidden text-[9px] shadow-md hover:shadow-lg hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        <span className="absolute left-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">Off</span>
                                        <span className="absolute right-2.5 text-[9px] font-extrabold text-muted-foreground/70 z-0">On</span>
                                        <div
                                            className={cn(
                                                "absolute w-[calc(50%-4px)] h-[calc(100%-8px)] top-1 rounded-md shadow-xl flex items-center justify-center z-10 border",
                                                cdEnabled 
                                                    ? "left-[calc(50%+2px)] border-primary"
                                                    : "left-[2px] border-[hsl(160_40%_20%)]"
                                            )}
                                            style={{
                                                backgroundColor: cdEnabled 
                                                    ? 'hsl(160 40% 45%)' // Light green for ON
                                                    : 'hsl(160 40% 20%)' // Dark green for OFF
                                            }}
                                        >
                                            <span className="text-[9px] font-black text-primary-foreground drop-shadow-sm">CD</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                          {/* Payment Details - 2 fields per row */}
                          <div className="grid grid-cols-2 gap-2 w-full">
                            {/* Payment Date - Hidden for RTGS (will be filled from RTGS Report) */}
                            {paymentMethod !== 'RTGS' && (
                                <div className="space-y-1 col-span-2">
                                    <Label htmlFor="paymentDate" className="text-[10px] font-bold">Payment Date</Label>
                                    <SmartDatePicker
                                        id="paymentDate"
                                        value={paymentDate}
                                        onChange={(val) => setPaymentDate(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                                        placeholder="Pick a date"
                                        inputClassName="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                        buttonClassName="h-8 w-8"
                                        returnDate={true}
                                    />
                                </div>
                            )}
                            
                            {(paymentMethod === 'Cash' || paymentMethod === 'Online') && (
                                <div className="space-y-1">
                                    <Label htmlFor="paymentId" className="text-[10px] font-bold">{paymentMethod === 'Cash' ? 'Payment ID (Voucher No.)' : 'Payment ID'}</Label>
                                    <Input id="paymentId" name="paymentId" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={(e) => handlePaymentIdBlur(e, handleEditPayment)} className="h-8 text-[10px] font-mono border-2 border-primary/20 focus:border-primary" />
                                </div>
                            )}
                             
                            {(paymentMethod === 'Cash' || paymentMethod === 'RTGS' || paymentMethod === 'Gov.') && (
                                <div className="space-y-1">
                                    <Label htmlFor="parchiNo" className="text-[10px] font-bold">Parchi No. (SR#)</Label>
                                    <Input 
                                        id="parchiNo"
                                        name="parchiNo"
                                        value={parchiNo || ''} 
                                        onChange={(e) => {

                                            if (setParchiNo) {
                                                setParchiNo(e.target.value);
                                            }
                                        }} 
                                        className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                        key={`parchi-${parchiNo}`}
                                    />
                                </div>
                            )}

                             {paymentMethod === 'Online' && (
                                <div className="space-y-1">
                                    <Label htmlFor="checkNo" className="text-[10px] font-bold">Check No. / Ref</Label>
                                    <Input id="checkNo" name="checkNo" value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"/>
                                </div>
                            )}

                             {paymentMethod === 'RTGS' && (
                                <div className="space-y-1">
                                    <Label htmlFor="rtgsSrNo" className="text-[10px] font-bold">RTGS SR No.</Label>
                                    <Input id="rtgsSrNo" name="rtgsSrNo" value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-8 text-[10px] font-mono border-2 border-primary/20 focus:border-primary" />
                                </div>
                            )}

                             {paymentMethod === 'Gov.' && (
                                <>
                                <div className="space-y-1">
                                    <Label htmlFor="govSrNo" className="text-[10px] font-bold">Gov. SR No.</Label>
                                    <Input id="govSrNo" name="govSrNo" value={rtgsSrNo} onChange={e => setRtgsSrNo(e.target.value)} onBlur={(e) => handleRtgsSrNoBlur(e, handleEditPayment)} className="h-8 text-[10px] font-mono border-2 border-primary/20 focus:border-primary" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="centerName" className="text-[10px] font-bold flex items-center gap-1">Center Name <Button variant="ghost" size="icon" className="h-3.5 w-3.5 shrink-0 hover:bg-primary/10" onClick={() => setIsCenterNameDialogOpen(true)} title="Manage Center Names"><Settings className="h-2.5 w-2.5"/></Button></Label>
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
                                        inputClassName="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                        maxRows={5}
                                        showScrollbar={true}
                                    />
                                </div>
                                <div className="space-y-1 hidden">
                                    <Label className="text-[10px] font-bold">Gov Payment</Label>
                                    <div className="h-8 text-[10px] flex items-center px-3 py-1.5 bg-primary/10 border-2 border-primary/20 rounded-md text-primary font-extrabold">
                                        Gov Payment Account
                                    </div>
                                </div>
                                </>
                            )}

                            {/* Payment Type - Hidden for Gov. payments (they are always Partial) */}
                            {paymentMethod !== 'Gov.' && (
                            <div className="space-y-1">
                                <Label htmlFor="paymentType" className="text-[10px] font-bold">Payment Type</Label>
                                <Select value={paymentType} onValueChange={setPaymentType}>
                                    <SelectTrigger id="paymentType" className="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Full">Full</SelectItem>
                                        <SelectItem value="Partial">Partial</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            )}
                            
                            <div className="space-y-1">
                                <Label htmlFor="settle-amount" className="text-[10px] font-bold">Settle Amount</Label>
                                <Input id="settle-amount" name="settle-amount" type="number" value={isNaN(settleAmount) ? 0 : Math.round(settleAmount)} onChange={e => handleSettleAmountChange(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Partial'} className={cn("h-8 text-[10px] border-2 border-primary/20 focus:border-primary", paymentType === 'Partial' && 'bg-muted/50')} />
                            </div>

                             <div className="space-y-1">
                                <Label htmlFor="toBePaid" className="text-[10px] font-extrabold text-green-600">To Be Paid</Label>
                                <Input 
                                    id="toBePaid"
                                    name="toBePaid"
                                    type="number" 
                                    value={isNaN(localToBePaid) ? 0 : Math.round(localToBePaid)} 
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        // Update local state immediately for responsive UI
                                        setLocalToBePaid(value);
                                        
                                        // Debounce parent update to prevent lag
                                        if (toBePaidDebounceRef.current) {
                                            clearTimeout(toBePaidDebounceRef.current);
                                        }
                                        
                                        toBePaidDebounceRef.current = setTimeout(() => {
                                            handleToBePaidChange(value);
                                        }, 500); // 500ms debounce for parent updates
                                    }} 
                                    readOnly={paymentType === 'Full'} 
                                    className={cn("h-8 text-[10px] font-extrabold text-green-600 border-2 border-green-500/30 bg-green-500/10 focus:border-green-500", paymentType === 'Full' && 'bg-muted/50 border-input')} 
                                />
                            </div>
                            
                            {/* Payment From - Hidden for Gov. payments */}
                            {paymentMethod !== 'Gov.' && (
                            <div className="space-y-1">
                                <Label htmlFor="paymentFrom" className="text-[10px] font-bold">Payment From</Label>
                                <CustomDropdown
                                    id="paymentFrom"
                                    options={paymentFromOptions}
                                    value={selectedAccountId}
                                    onChange={(value) => setSelectedAccountId(value)}
                                    placeholder="Select Account"
                                    inputClassName="h-8 text-[10px] border-2 border-primary/20 focus:border-primary"
                                />
                            </div>
                            )}
                            </div>
                        
                    </CardContent>
                </Card>
            </div>
            <CardFooter className="p-0 pt-2" />
            
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

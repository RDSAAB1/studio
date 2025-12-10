"use client";

import React, { useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const GovForm = (props: any) => {
    const {
        govQuantity = 0,
        setGovQuantity,
        govRate = 0,
        setGovRate,
        govAmount = 0,
        setGovAmount,
        govRequiredAmount = 0,
        setGovRequiredAmount,
        extraAmount = 0,
        setExtraAmount,
        calcTargetAmount = 0,
        minRate = 0,
        selectedPaymentOption = null,
    } = props;

    // Auto-calculate amount when quantity or rate changes
    // Always round to nearest whole number (no paise)
    React.useEffect(() => {
        if (govQuantity > 0 && govRate > 0) {
            const calculatedAmount = govQuantity * govRate;
            const roundedAmount = Math.round(calculatedAmount); // Round to whole number
            if (setGovAmount) {
                setGovAmount(roundedAmount);
            }
        }
    }, [govQuantity, govRate, setGovAmount]);

    // Calculate all derived fields (Extra Amount is NOT auto-calculated, use manual value)
    const calculations = useMemo(() => {
        const baseQty = minRate > 0 ? calcTargetAmount / minRate : 0;
        const govQty = govQuantity || (selectedPaymentOption?.quantity || 0);
        const qtyDifference = govQty - baseQty; // Final (selected) - Base
        const baseAmt = calcTargetAmount;
        const govAmt = govAmount || (selectedPaymentOption?.calculatedAmount || 0);
        const pendingAmt = selectedPaymentOption?.amountRemaining || 0;
        const bags = selectedPaymentOption?.bags || null;
        // Use manual extraAmount from form (NOT auto-calculated)
        const extraAmt = extraAmount || 0;
        const selectedReceiptFinalWt = govQty; // Assuming this is the selected quantity
        const incrementalRate = selectedReceiptFinalWt > 0 ? extraAmt / selectedReceiptFinalWt : 0;

        return {
            baseQty: baseQty.toFixed(2),
            govQty: govQty.toFixed(2),
            qtyDifference: qtyDifference.toFixed(2),
            baseAmt,
            govAmt,
            pendingAmt,
            bags,
            extraAmt,
            incrementalRate: incrementalRate.toFixed(2),
        };
    }, [calcTargetAmount, minRate, govQuantity, govAmount, selectedPaymentOption, extraAmount]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-[11px] font-semibold text-muted-foreground">Government Payment Details</CardTitle>
            </div>
            
            {/* Row 1: Quantity, Rate, Amount */}
            <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Quantity (Qty)</Label>
                    <Input
                        type="number"
                        step="0.10"
                        value={govQuantity || ''}
                        onChange={(e) => setGovQuantity?.(Number(e.target.value) || 0)}
                        className="h-8 text-[11px] font-medium"
                        placeholder="Enter quantity"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Rate (per Qty)</Label>
                    <Input
                        type="number"
                        value={govRate || ''}
                        onChange={(e) => setGovRate?.(Number(e.target.value) || 0)}
                        className="h-8 text-[11px] font-medium"
                        placeholder="Enter rate"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Amount</Label>
                    <Input
                        type="number"
                        value={govAmount || ''}
                        onChange={(e) => {
                            const newAmount = Number(e.target.value) || 0;
                            const roundedAmount = Math.round(newAmount);
                            setGovAmount?.(roundedAmount);
                            if (govQuantity > 0 && roundedAmount > 0) {
                                const newRate = roundedAmount / govQuantity;
                                setGovRate?.(newRate);
                            }
                        }}
                        className="h-8 text-[11px] font-medium"
                        placeholder="Auto-calculated"
                    />
                </div>
            </div>

            {/* Row 2: Gov Required Amount */}
            <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                    <Label className="text-[10px] font-medium">Gov Required Amount</Label>
                    <Input
                        type="number"
                        value={govRequiredAmount || ''}
                        onChange={(e) => setGovRequiredAmount?.(Number(e.target.value) || 0)}
                        className="h-8 text-[11px] font-medium"
                        placeholder="Enter Gov Required Amount"
                    />
                </div>
            </div>

            {/* Calculation Fields - 3 columns per row */}
            <div className="border-t border-border/50 pt-3 mt-3">
                <Label className="text-xs font-bold text-foreground mb-3 block">Calculations</Label>
                <div className="space-y-2">
                    {/* Row 1: BASE QTY, QTY DIFFERENCE, BASE AMT */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">BASE QTY</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-accent/40 backdrop-blur-sm rounded-md border border-accent/50 text-foreground shadow-sm">
                                {calculations.baseQty}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">QTY DIFFERENCE</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-accent/40 backdrop-blur-sm rounded-md border border-accent/50 text-foreground shadow-sm">
                                {calculations.qtyDifference}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">BASE AMT</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-primary/30 backdrop-blur-sm rounded-md border border-primary/40 text-primary shadow-sm">
                                {formatCurrency(calculations.baseAmt)}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: PENDING AMT, BAGS, EXTRA AMT */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">PENDING AMT</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-primary/30 backdrop-blur-sm rounded-md border border-primary/40 text-primary shadow-sm">
                                {formatCurrency(calculations.pendingAmt)}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">BAGS</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-accent/40 backdrop-blur-sm rounded-md border border-accent/50 text-foreground shadow-sm">
                                {calculations.bags !== null ? calculations.bags : '-'}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">EXTRA AMT</Label>
                            <Input
                                type="number"
                                value={extraAmount || ''}
                                onChange={(e) => setExtraAmount?.(Number(e.target.value) || 0)}
                                className="h-9 text-sm font-bold px-3 bg-primary/30 backdrop-blur-sm rounded-md border border-primary/40 text-primary shadow-sm"
                                placeholder="Enter Extra Amount"
                            />
                        </div>
                    </div>

                    {/* Row 3: INCREMENTAL RATE */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-foreground block">INCREMENTAL RATE</Label>
                            <div className="h-9 text-sm font-bold flex items-center px-3 bg-accent/40 backdrop-blur-sm rounded-md border border-accent/50 text-foreground shadow-sm">
                                {calculations.incrementalRate}
                            </div>
                        </div>
                        <div className="col-span-2"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};


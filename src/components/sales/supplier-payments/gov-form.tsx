"use client";

import React, { useMemo } from 'react';
import { formatCurrency, cn } from "@/lib/utils";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const GovForm = (props: any) => {
    const {
        govQuantity = 0,
        govRate = 0,
        govExtraAmount = 0,
        targetAmount = 0,
        minRate = 0,
        selectedPaymentOption = null,
    } = props;

    const calculations = useMemo(() => {
        const baseQty = minRate > 0 ? targetAmount / minRate : 0;
        const govQty = govQuantity || (selectedPaymentOption?.quantity || 0);
        const qtyDifference = govQty - baseQty;
        const baseAmt = targetAmount;
        const pendingAmt = selectedPaymentOption?.amountRemaining || 0;
        const bags = selectedPaymentOption?.bags || null;

        return {
            baseQty: baseQty.toFixed(2),
            qtyDifference: qtyDifference.toFixed(2),
            baseAmt,
            pendingAmt,
            bags,
        };
    }, [targetAmount, minRate, govQuantity, selectedPaymentOption]);

    return (
        <Card className="text-[10px] rounded-xl border border-border/70 bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)] flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-1.5 px-3 pt-2 bg-muted/70 border-b border-border/80 shrink-0">
                <CardTitle className="text-[11px] font-semibold flex items-center gap-2 tracking-tight text-primary">
                    <Receipt className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Government Payment Details</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2.5 pt-2 bg-white flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">Quantity</span>
                        <span className="font-semibold tabular-nums">{govQuantity || 0}</span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">Rate</span>
                        <span className="font-semibold tabular-nums text-primary">{govRate || 0}</span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">Extra (Auto)</span>
                        <span className="font-semibold tabular-nums text-primary">
                            {formatCurrency(govExtraAmount || 0)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">BAGS</span>
                        <span className="font-semibold tabular-nums">{calculations.bags !== null ? calculations.bags : '-'}</span>
                    </div>
                    
                    <div className="col-span-2 border-b border-dashed border-border/60 my-0.5" />

                    {/* Calculation Summary Flowing directly */}
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">BASE QTY</span>
                        <span className="font-semibold tabular-nums">{calculations.baseQty}</span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">QTY DIFF</span>
                        <span className={cn("font-semibold tabular-nums", parseFloat(calculations.qtyDifference) >= 0 ? "text-primary" : "text-amber-700")}>{calculations.qtyDifference}</span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">BASE AMT</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(calculations.baseAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center h-5">
                        <span className="text-muted-foreground font-medium">PENDING</span>
                        <span className={cn("font-semibold tabular-nums", calculations.pendingAmt > 0 ? "text-amber-700" : "text-primary")}>{formatCurrency(calculations.pendingAmt)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

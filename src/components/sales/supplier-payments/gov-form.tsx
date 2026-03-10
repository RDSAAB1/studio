"use client";

import React, { useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Receipt, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

export const GovForm = (props: any) => {
    const {
        govQuantity = 0,
        govRate = 0,
        govAmount = 0,
        govExtraAmount = 0,
        setGovExtraAmount,
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
        <div className="rounded-xl border border-border/70 overflow-hidden bg-card shadow-[0_4px_14px_rgba(15,23,42,0.10)]">
            {/* Government Payment Details */}
            <div className="border-b border-border/80">
                <div className="px-3 py-1.5">
                    <CardTitle className="text-[11px] font-semibold flex items-center gap-2 tracking-tight text-primary">
                        <Receipt className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Government Payment Details</span>
                    </CardTitle>
                </div>
                <div className="px-3 pb-2 space-y-1 text-[10px]">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Quantity</span>
                        <span className="font-semibold tabular-nums">{govQuantity || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Rate</span>
                        <span className="font-semibold tabular-nums text-primary">{govRate || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Extra (Auto)</span>
                        <span className="font-semibold tabular-nums text-primary">
                            {formatCurrency(govExtraAmount || 0)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Calculations – same card, separator only */}
            <div>
                <div className="px-3 py-1.5 border-b border-border/60">
                    <Label className="text-[11px] font-semibold flex items-center gap-2 text-primary tracking-tight">
                        <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Calculations</span>
                    </Label>
                </div>
                <div className="px-3 py-2 space-y-1 text-[10px]">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">BASE QTY</span>
                        <span className="font-semibold tabular-nums">{calculations.baseQty}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">QTY DIFF</span>
                        <span className={cn("font-semibold tabular-nums", parseFloat(calculations.qtyDifference) >= 0 ? "text-primary" : "text-amber-700")}>{calculations.qtyDifference}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">BASE AMT</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(calculations.baseAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">PENDING</span>
                        <span className={cn("font-semibold tabular-nums", calculations.pendingAmt > 0 ? "text-amber-700" : "text-primary")}>{formatCurrency(calculations.pendingAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">BAGS</span>
                        <span className="font-semibold tabular-nums">{calculations.bags !== null ? calculations.bags : '-'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

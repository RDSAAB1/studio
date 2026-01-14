"use client";

import React, { useMemo } from 'react';
import { Label } from "@/components/ui/label";
import { CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { Receipt, Calculator, TrendingUp, Wallet, Package, Coins, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const GovForm = (props: any) => {
    const {
        govQuantity = 0,
        govRate = 0,
        govAmount = 0,
        govRequiredAmount = 0,
        extraAmount = 0,
        calcTargetAmount = 0,
        minRate = 0,
        selectedPaymentOption = null,
        extraAmountBaseType = 'receipt',
        setExtraAmountBaseType,
    } = props;

    const calculations = useMemo(() => {
        const baseQty = minRate > 0 ? calcTargetAmount / minRate : 0;
        const govQty = govQuantity || (selectedPaymentOption?.quantity || 0);
        const qtyDifference = govQty - baseQty;
        const baseAmt = calcTargetAmount;
        const pendingAmt = selectedPaymentOption?.amountRemaining || 0;
        const bags = selectedPaymentOption?.bags || null;
        const extraAmt = extraAmount || 0;
        const incrementalRate = govQty > 0 ? extraAmt / govQty : 0;

        return {
            baseQty: baseQty.toFixed(2),
            qtyDifference: qtyDifference.toFixed(2),
            baseAmt,
            pendingAmt,
            bags,
            incrementalRate: incrementalRate.toFixed(2),
        };
    }, [calcTargetAmount, minRate, govQuantity, selectedPaymentOption, extraAmount]);

    return (
        <div className="space-y-2">
            {/* Government Payment Details Section - Compact */}
            <div className="border-2 border-primary/25 rounded-lg shadow-2xl overflow-hidden bg-gradient-to-br from-card via-card/98 to-card/95 backdrop-blur-md">
                <div className="bg-gradient-to-r from-primary/18 via-primary/12 to-primary/8 border-b-2 border-primary/25 px-3 py-2 shadow-sm">
                    <CardTitle className="text-[11px] font-extrabold flex items-center gap-2 text-foreground tracking-tight">
                        <div className="p-1 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                            <Receipt className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                        </div>
                        <span className="bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text text-transparent">Government Payment Details</span>
                    </CardTitle>
                </div>
                <div className="bg-gradient-to-br from-primary/10 via-muted/75 to-muted/55 p-2 grid grid-cols-2 gap-1.5 border-t border-primary/20">
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-muted/70 border border-border/50 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                <Package className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">Quantity:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{govQuantity || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-primary/25 border border-primary/40">
                                <TrendingUp className="h-3 w-3 text-primary drop-shadow-sm" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">Rate:</span>
                        </div>
                        <span className="font-black text-primary text-[11px] px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">{govRate || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-muted/70 border border-border/50 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                <Wallet className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">Amount:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{formatCurrency(govAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-primary/25 border border-primary/40">
                                <Coins className="h-3 w-3 text-primary drop-shadow-sm" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">Gov Required:</span>
                        </div>
                        <span className="font-black text-primary text-[11px] px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">{formatCurrency(govRequiredAmount || 0)}</span>
                    </div>
                </div>
            </div>

            {/* Calculations Section - Compact */}
            <div className="border-2 border-primary/25 rounded-lg shadow-2xl overflow-hidden bg-gradient-to-br from-card via-card/98 to-card/95 backdrop-blur-md">
                <div className="bg-gradient-to-r from-primary/18 via-primary/12 to-primary/8 border-b-2 border-primary/25 px-3 py-2 shadow-sm">
                    <Label className="text-[11px] font-extrabold flex items-center gap-2 text-foreground tracking-tight">
                        <div className="p-1 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                            <Calculator className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                        </div>
                        <span className="bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text text-transparent">Calculations</span>
                    </Label>
                </div>
                <div className="bg-gradient-to-br from-primary/10 via-muted/75 to-muted/55 p-2 grid grid-cols-2 gap-1.5 border-t border-primary/20">
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-muted/70 border border-border/50 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                <Package className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BASE QTY:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{calculations.baseQty}</span>
                    </div>
                    <div className={cn(
                        "flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md border-2 hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer",
                        parseFloat(calculations.qtyDifference) >= 0 
                            ? "bg-green-500/18 border-green-500/35" 
                            : "bg-orange-500/18 border-orange-500/35"
                    )}>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "p-0.5 rounded border",
                                parseFloat(calculations.qtyDifference) >= 0 
                                    ? "bg-green-500/25 border-green-500/40" 
                                    : "bg-orange-500/25 border-orange-500/40"
                            )}>
                                <TrendingUp className={cn(
                                    "h-3 w-3",
                                    parseFloat(calculations.qtyDifference) >= 0 ? "text-green-600" : "text-orange-600"
                                )} />
                            </div>
                            <span className="text-muted-foreground font-extrabold">QTY DIFF:</span>
                        </div>
                        <span className={cn(
                            "font-black text-[11px] px-1.5 py-0.5 rounded-md border",
                            parseFloat(calculations.qtyDifference) >= 0 
                                ? "text-green-600 bg-green-500/20 border-green-500/30" 
                                : "text-orange-600 bg-orange-500/20 border-orange-500/30"
                        )}>
                            {calculations.qtyDifference}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-muted/70 border border-border/50 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                <Wallet className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BASE AMT:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{formatCurrency(calculations.baseAmt)}</span>
                    </div>
                    <div className={cn(
                        "flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md border-2 hover:opacity-95 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer",
                        calculations.pendingAmt > 0 
                            ? "bg-orange-500/18 border-orange-500/35" 
                            : "bg-green-500/18 border-green-500/35"
                    )}>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "p-0.5 rounded border",
                                calculations.pendingAmt > 0 
                                    ? "bg-orange-500/25 border-orange-500/40" 
                                    : "bg-green-500/25 border-green-500/40"
                            )}>
                                <AlertCircle className={cn(
                                    "h-3 w-3",
                                    calculations.pendingAmt > 0 ? "text-orange-600" : "text-green-600"
                                )} />
                            </div>
                            <span className="text-muted-foreground font-extrabold">PENDING:</span>
                        </div>
                        <span className={cn(
                            "font-black text-[11px] px-1.5 py-0.5 rounded-md border",
                            calculations.pendingAmt > 0 
                                ? "text-orange-600 bg-orange-500/20 border-orange-500/30" 
                                : "text-green-600 bg-green-500/20 border-green-500/30"
                        )}>
                            {formatCurrency(calculations.pendingAmt)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-background/50 border-2 border-border/40 hover:bg-primary/15 hover:border-primary/40 hover:shadow-md transition-all duration-300 group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-muted/70 border border-border/50 group-hover:bg-primary/20 group-hover:border-primary/30 transition-all">
                                <Package className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BAGS:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">
                            {calculations.bags !== null ? calculations.bags : '-'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-primary/25 border border-primary/40">
                                <Coins className="h-3 w-3 text-primary drop-shadow-sm" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">EXTRA AMT:</span>
                        </div>
                        <span className="font-black text-primary text-[11px] px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">{formatCurrency(extraAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-primary/18 border-2 border-primary/30 hover:bg-primary/25 hover:border-primary/45 hover:shadow-lg transition-all duration-300 shadow-md cursor-pointer col-span-2">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-primary/25 border border-primary/40">
                                <TrendingUp className="h-3 w-3 text-primary drop-shadow-sm" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">INCREMENTAL RATE:</span>
                        </div>
                        <span className="font-black text-primary text-[11px] px-1.5 py-0.5 rounded-md bg-primary/20 border border-primary/30">{calculations.incrementalRate}</span>
                    </div>
                </div>
            </div>

            {/* Extra Amount Base Type Toggle */}
            {setExtraAmountBaseType && (
                <div className="border-2 border-primary/25 rounded-lg shadow-2xl overflow-hidden bg-gradient-to-br from-card via-card/98 to-card/95 backdrop-blur-md">
                    <div className="bg-gradient-to-r from-primary/18 via-primary/12 to-primary/8 border-b-2 border-primary/25 px-3 py-2 shadow-sm">
                        <Label className="text-[11px] font-extrabold flex items-center gap-2 text-foreground tracking-tight">
                            <div className="p-1 rounded-md bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 shadow-md">
                                <Calculator className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                            </div>
                            <span className="bg-gradient-to-r from-foreground to-foreground/90 bg-clip-text text-transparent">Extra Amount Base</span>
                        </Label>
                    </div>
                    <div className="bg-gradient-to-br from-primary/10 via-muted/75 to-muted/55 p-2 border-t border-primary/20">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="calculationBase" className="text-[10px] font-extrabold text-muted-foreground">Calculation Base:</Label>
                            <Select 
                                value={extraAmountBaseType} 
                                onValueChange={(v) => setExtraAmountBaseType(v as 'receipt' | 'target')}
                            >
                                <SelectTrigger id="calculationBase" className="h-8 text-[10px] border-2 border-primary/25 focus:border-primary focus:ring-2 focus:ring-primary/25 transition-all bg-background/80 shadow-inner w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="receipt">Receipt Based</SelectItem>
                                    <SelectItem value="target">Target Based</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="mt-2 text-[9px] text-muted-foreground px-1">
                            {extraAmountBaseType === 'receipt' 
                                ? 'Extra amount = Gov Required - Receipt Outstanding'
                                : 'Extra amount = Gov Required - Target Amount'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

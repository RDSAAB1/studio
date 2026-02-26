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
                <div className="bg-gradient-to-br from-primary/10 via-muted/75 to-muted/55 p-2 grid grid-cols-3 gap-1.5 border-t border-primary/20">
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
                                <Coins className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">Extra:</span>
                        </div>
                         <input 
                            type="number"
                            className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30 w-16 text-right"
                            value={govExtraAmount || 0}
                            onChange={(e) => setGovExtraAmount && setGovExtraAmount(Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            {/* Calculations Section - Compact */}
            <div className="border border-slate-200/80 rounded-[12px] shadow-[0_10px_30px_rgba(0,0,0,0.10)] hover:shadow-[0_14px_40px_rgba(0,0,0,0.14)] transition-shadow overflow-hidden bg-white/80 backdrop-blur-md">
                <div className="bg-white/60 border-b border-slate-200/80 px-3 py-2">
                    <Label className="text-[11px] font-extrabold flex items-center gap-2 text-foreground tracking-tight">
                        <div className="p-1 rounded-md bg-violet-500/10 border border-violet-500/15">
                            <Calculator className="h-3.5 w-3.5 text-primary drop-shadow-sm" />
                        </div>
                        <span className="text-slate-900">Calculations</span>
                    </Label>
                </div>
                <div className="bg-slate-50/60 p-2 grid grid-cols-2 gap-1.5 border-t border-slate-200/80">
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-white/60 border border-slate-200/70 hover:bg-violet-50/60 hover:border-violet-200 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-white/60 border border-slate-200/70 group-hover:bg-violet-50/70 group-hover:border-violet-200 transition-colors">
                                <Package className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BASE QTY:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{calculations.baseQty}</span>
                    </div>
                    <div className={cn(
                        "flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md border hover:opacity-95 hover:shadow-md transition-colors shadow-sm cursor-pointer",
                        parseFloat(calculations.qtyDifference) >= 0 
                            ? "bg-violet-500/10 border-violet-500/25" 
                            : "bg-amber-500/12 border-amber-500/25"
                    )}>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "p-0.5 rounded border",
                                parseFloat(calculations.qtyDifference) >= 0 
                                    ? "bg-violet-500/15 border-violet-500/30" 
                                    : "bg-amber-500/18 border-amber-500/30"
                            )}>
                                <TrendingUp className={cn(
                                    "h-3 w-3",
                                    parseFloat(calculations.qtyDifference) >= 0 ? "text-violet-700" : "text-amber-700"
                                )} />
                            </div>
                            <span className="text-muted-foreground font-extrabold">QTY DIFF:</span>
                        </div>
                        <span className={cn(
                            "font-black text-[11px] px-1.5 py-0.5 rounded-md border",
                            parseFloat(calculations.qtyDifference) >= 0 
                                ? "text-violet-700 bg-violet-500/10 border-violet-500/25" 
                                : "text-amber-700 bg-amber-500/12 border-amber-500/25"
                        )}>
                            {calculations.qtyDifference}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-white/60 border border-slate-200/70 hover:bg-violet-50/60 hover:border-violet-200 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-white/60 border border-slate-200/70 group-hover:bg-violet-50/70 group-hover:border-violet-200 transition-colors">
                                <Wallet className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BASE AMT:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">{formatCurrency(calculations.baseAmt)}</span>
                    </div>
                    <div className={cn(
                        "flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md border hover:opacity-95 hover:shadow-md transition-colors shadow-sm cursor-pointer",
                        calculations.pendingAmt > 0 
                            ? "bg-amber-500/12 border-amber-500/25" 
                            : "bg-violet-500/10 border-violet-500/25"
                    )}>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "p-0.5 rounded border",
                                calculations.pendingAmt > 0 
                                    ? "bg-amber-500/18 border-amber-500/30" 
                                    : "bg-violet-500/15 border-violet-500/30"
                            )}>
                                <AlertCircle className={cn(
                                    "h-3 w-3",
                                    calculations.pendingAmt > 0 ? "text-amber-700" : "text-violet-700"
                                )} />
                            </div>
                            <span className="text-muted-foreground font-extrabold">PENDING:</span>
                        </div>
                        <span className={cn(
                            "font-black text-[11px] px-1.5 py-0.5 rounded-md border",
                            calculations.pendingAmt > 0 
                                ? "text-amber-700 bg-amber-500/12 border-amber-500/25" 
                                : "text-violet-700 bg-violet-500/10 border-violet-500/25"
                        )}>
                            {formatCurrency(calculations.pendingAmt)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] px-2 py-1.5 rounded-md bg-white/60 border border-slate-200/70 hover:bg-violet-50/60 hover:border-violet-200 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-1.5">
                            <div className="p-0.5 rounded bg-white/60 border border-slate-200/70 group-hover:bg-violet-50/70 group-hover:border-violet-200 transition-colors">
                                <Package className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <span className="text-muted-foreground font-extrabold">BAGS:</span>
                        </div>
                        <span className="font-black text-foreground text-[11px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/30">
                            {calculations.bags !== null ? calculations.bags : '-'}
                        </span>
                    </div>

                </div>
            </div>
        </div>
    );
};

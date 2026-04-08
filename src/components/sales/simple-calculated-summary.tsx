"use client";

import * as React from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, FileText, Banknote } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/date-utils";
import { useFormContext, useWatch } from "react-hook-form";
import { format } from "date-fns";

interface SimpleCalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onClearForm?: () => void;
    onToggleTable?: () => void;
    showTable?: boolean;
    isEditing: boolean;
    isSubmitting?: boolean;
}

export const SimpleCalculatedSummary = React.memo(({ 
    onSave, 
    onClearForm,
    onToggleTable,
    showTable = false,
    isEditing, 
    isSubmitting = false
}: Omit<SimpleCalculatedSummaryProps, 'customer'>) => {
    const { control } = useFormContext();
    
    // Watch fields for real-time calculation
    const watchedFields = useWatch({
        control,
        name: [
            "srNo", "grossWeight", "teirWeight", "kartaPercentage", 
            "rate", "labouryRate", "brokerageRate", "brokerageAddSubtract", 
            "kanta", "date", "term"
        ]
    });

    const [
        srNo, grossWeightRaw, teirWeightRaw, kartaPercentageRaw,
        rateRaw, labouryRateRaw, brokerageRateRaw, brokerageAddSubtract,
        kantaRaw, date, term
    ] = watchedFields;

    const isLoading = !srNo;
    
    // Always calculate from current form data
    const grossWeight = Number(grossWeightRaw) || 0;
    const teirWeight = Number(teirWeightRaw) || 0;
    const kartaPercentage = Number(kartaPercentageRaw) || 0;
    const rate = Number(rateRaw) || 0;
    const labouryRate = Number(labouryRateRaw) || 0;
    const brokerageRate = Number(brokerageRateRaw) || 0;
    const kanta = Number(kantaRaw) || 0;

    const dueDate = (() => {
        if (!date) return "-";
        const d = new Date(date);
        const t = Number(term) || 20;
        d.setDate(d.getDate() + t);
        return format(d, 'yyyy-MM-dd');
    })();
    
    // Calculate values based on current form data
    const finalWt = grossWeight - teirWeight;
    
    // Calculate Karta Weight with proper rounding: round UP when Final Wt decimal part >= 0.50
    const rawKartaWt = finalWt * (kartaPercentage / 100);
    const decimalPart = Math.round((finalWt - Math.floor(finalWt)) * 10);
    let kartaWt;
    if (decimalPart >= 5) {
        kartaWt = Math.ceil(rawKartaWt * 100) / 100;
    } else {
        kartaWt = Math.floor(rawKartaWt * 100) / 100;
    }
    
    const netWt = finalWt - kartaWt;
    const amount = finalWt * rate;
    const kartaAmt = kartaWt * rate;
    // Labour Amount calculated on Final Wt, not Net Wt
    const labAmt = finalWt * labouryRate;
    // Brokerage calculated on Final Wt, not Net Wt
    const brokerageAmt = brokerageRate * finalWt;
    const netPayable = amount - kartaAmt - labAmt - kanta + (brokerageAddSubtract ? brokerageAmt : -brokerageAmt);
    
    const formatWeight = (wt: number) => `${wt.toFixed(2)} Qtl`;
    const formatRate = (rt: number) => `₹${rt.toFixed(2)}/Qtl`;
    const formatPercentage = (pct: number) => `${pct.toFixed(2)}%`;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Operational Summary Card */}
            <Card className="ui-summary-card">
                <CardHeader className="pb-2 px-3 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Scale size={16} className="text-muted-foreground"/>
                        Operational Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Gross Wt:</span>
                            <span className="font-medium">{formatWeight(grossWeight)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Teir Wt:</span>
                            <span className="font-medium">{formatWeight(teirWeight)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Final Wt:</span>
                            <span className="font-bold">{formatWeight(finalWt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Karta Wt (@{formatPercentage(kartaPercentage)}):</span>
                            <span className="font-medium">{formatWeight(kartaWt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Net Wt:</span>
                            <span className="font-bold text-primary">{formatWeight(netWt)}</span>
                        </div>
                    </div>
                    <Separator className="my-2"/>
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Rate:</span>
                            <span className="font-medium">{formatRate(rate)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Due Date:</span>
                            <span className="font-medium">
                                {isLoading || dueDate === "-"
                                    ? "-"
                                    : formatDate(dueDate, "dd-MMM-yy")}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Deduction Summary Card */}
            <Card className="ui-summary-card">
                <CardHeader className="pb-2 px-3 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText size={16} className="text-muted-foreground"/>
                        Deduction Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount (@{formatRate(rate)}/Qtl):</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Karta Amt (@{formatPercentage(kartaPercentage)}):</span>
                            <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(kartaAmt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Laboury Amt (@{formatRate(labouryRate)}):</span>
                            <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(labAmt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Kanta:</span>
                            <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(kanta)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Brokerage Amt ({brokerageAddSubtract ? 'INCLUDE' : 'EXCLUDE'}):</span>
                            <span className={`font-medium ${brokerageAddSubtract ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {brokerageAddSubtract ? '+ ' : '- '}{formatCurrency(brokerageAmt)}
                            </span>
                        </div>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Deductions:</span>
                        <span className="font-bold text-primary">{formatCurrency(kartaAmt + labAmt + kanta + (brokerageAddSubtract ? 0 : brokerageAmt))}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Financial Summary Card */}
            <Card className="ui-summary-card">
                <CardHeader className="pb-2 px-3 pt-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Banknote size={16} className="text-muted-foreground"/>
                        Financial Summary
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 px-3 pb-3 text-xs">
                    <div className="space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Gross Amount:</span>
                            <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Deductions:</span>
                            <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(kartaAmt + labAmt + kanta + (brokerageAddSubtract ? 0 : brokerageAmt))}</span>
                        </div>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Net Payable:</span>
                        <span className="font-bold text-red-500 dark:text-red-400 text-base">{formatCurrency(netPayable)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});

SimpleCalculatedSummary.displayName = "SimpleCalculatedSummary";

"use client";

import type { Customer } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, FileText, Banknote } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface SimpleCalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onClearForm?: () => void;
    onToggleTable?: () => void;
    showTable?: boolean;
    isEditing: boolean;
    isSubmitting?: boolean;
}

export const SimpleCalculatedSummary = ({ 
    customer, 
    onSave, 
    onClearForm,
    onToggleTable,
    showTable = false,
    isEditing, 
    isSubmitting = false
}: SimpleCalculatedSummaryProps) => {

    const isLoading = !customer || !customer.srNo;
    
    // Always calculate from current form data (whether manual input or auto-filled)
    const grossWeight = Number(customer.grossWeight) || 0;
    const teirWeight = Number(customer.teirWeight) || 0;
    const kartaPercentage = Number(customer.kartaPercentage) || 0;
    const rate = Number(customer.rate) || 0;
    const labouryRate = Number(customer.labouryRate) || 0;
    const brokerageRate = Number(customer.brokerageRate) || 0;
    const brokerage = Number(customer.brokerage) || 0;
    const brokerageAddSubtract = customer.brokerageAddSubtract ?? true; // Default to add
    const kanta = Number(customer.kanta) || 0;
    
    // Calculate values based on current form data
    const finalWt = grossWeight - teirWeight;
    const kartaWt = Number((finalWt * (kartaPercentage / 100)).toFixed(2));
    const netWt = finalWt - kartaWt;
    const amount = finalWt * rate;
    const kartaAmt = kartaWt * rate;
    const labAmt = netWt * labouryRate;
    const brokerageAmt = brokerageRate * netWt;
    const netPayable = amount - kartaAmt - labAmt - kanta + (brokerageAddSubtract ? brokerageAmt : -brokerageAmt);
    
    const formatWeight = (wt: number) => `${wt.toFixed(2)} Qtl`;
    const formatRate = (rt: number) => `₹${rt.toFixed(2)}/Qtl`;
    const formatPercentage = (pct: number) => `${pct.toFixed(2)}%`;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Operational Summary Card */}
            <Card className="border border-gray-400/50">
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
                            <span className="font-medium">{isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Deduction Summary Card */}
            <Card className="border border-gray-400/50">
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
                            <span className="text-muted-foreground">Brokerage Amt:</span>
                            <span className="font-medium text-red-500 dark:text-red-400">{brokerageAddSubtract ? '- ' : '+ '}{formatCurrency(brokerageAmt)}</span>
                        </div>
                    </div>
                    <Separator className="my-2"/>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Deductions:</span>
                        <span className="font-bold text-primary">{formatCurrency(kartaAmt + labAmt + kanta + (brokerageAddSubtract ? brokerageAmt : -brokerageAmt))}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Financial Summary Card */}
            <Card className="border border-gray-400/50">
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
                            <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(kartaAmt + labAmt + kanta + (brokerageAddSubtract ? brokerageAmt : -brokerageAmt))}</span>
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
};
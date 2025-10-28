"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Loader2, Plus, Table } from "lucide-react";
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

const SummaryItem = ({ label, value, isHighlighted, className, valueType = 'default' }: { label: string; value: string; isHighlighted?: boolean, className?: string; valueType?: 'date' | 'weight' | 'amount' | 'percentage' | 'default' }) => {
    const getValueColor = () => {
        switch (valueType) {
            case 'date':
                return 'text-blue-700 font-bold';
            case 'weight':
                return 'text-green-700 font-bold';
            case 'amount':
                return 'text-purple-700 font-bold';
            case 'percentage':
                return 'text-orange-700 font-bold';
            default:
                return 'text-foreground font-bold';
        }
    };

    return (
        <div className={cn("", className)}>
            <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
            <div className={cn("text-xs", isHighlighted ? "text-primary font-bold text-sm" : getValueColor())}>
                {value}
            </div>
        </div>
    );
};

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
    const brokerageAmt = brokerage * netWt;
    const netPayable = amount - kartaAmt - labAmt - kanta + (brokerageAddSubtract ? brokerageAmt : -brokerageAmt);
    
    return (
        <div className="space-y-1">
            {/* Compact Header */}
            <div className="text-center">
                <h4 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <div className="w-1 h-1 bg-primary rounded-full"></div>
                    Summary Details
                </h4>
            </div>

            {/* Compact Grid - All in one container */}
            <div className="bg-muted/30 border border-border rounded p-1.5">
                <div className="grid grid-cols-6 gap-1">
                    <SummaryItem 
                        label="Due Date" 
                        value={isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")} 
                        className="bg-blue-50/80 border border-blue-200/50 p-1 rounded"
                        valueType="date"
                    />
                    <SummaryItem 
                        label="Rate" 
                        value={`₹${rate.toFixed(2)}/Qtl`} 
                        className="bg-orange-50/80 border border-orange-200/50 p-1 rounded"
                        valueType="amount"
                    />
                    <SummaryItem 
                        label="Gross Wt" 
                        value={`${grossWeight.toFixed(2)} Qtl`} 
                        className="bg-green-50/80 border border-green-200/50 p-1 rounded"
                        valueType="weight"
                    />
                    <SummaryItem 
                        label="Tier Wt" 
                        value={`${teirWeight.toFixed(2)} Qtl`} 
                        className="bg-green-50/80 border border-green-200/50 p-1 rounded"
                        valueType="weight"
                    />
                    <SummaryItem 
                        label="Final Wt" 
                        value={`${finalWt.toFixed(2)} Qtl`} 
                        className="bg-green-50/80 border border-green-200/50 p-1 rounded"
                        valueType="weight"
                    />
                    <SummaryItem 
                        label="Karta Wt" 
                        value={`${kartaWt.toFixed(2)} Qtl`} 
                        className="bg-green-50/80 border border-green-200/50 p-1 rounded"
                        valueType="weight"
                    />
                    <SummaryItem 
                        label="Net Wt" 
                        value={`${netWt.toFixed(2)} Qtl`} 
                        className="bg-green-50/80 border border-green-200/50 p-1 rounded"
                        valueType="weight"
                    />
                    <SummaryItem 
                        label="Kanta" 
                        value={formatCurrency(kanta)} 
                        className="bg-purple-50/80 border border-purple-200/50 p-1 rounded"
                        valueType="amount"
                    />
                    <SummaryItem 
                        label="Amount" 
                        value={formatCurrency(amount)} 
                        className="bg-purple-50/80 border border-purple-200/50 p-1 rounded"
                        valueType="amount"
                    />
                    <SummaryItem 
                        label="Karta Amt" 
                        value={formatCurrency(kartaAmt)} 
                        className="bg-purple-50/80 border border-purple-200/50 p-1 rounded"
                        valueType="amount"
                    />
                    <SummaryItem 
                        label="Lab Amt" 
                        value={formatCurrency(labAmt)} 
                        className="bg-purple-50/80 border border-purple-200/50 p-1 rounded"
                        valueType="amount"
                    />
                    <SummaryItem 
                        label="Brokerage Amt" 
                        value={formatCurrency(brokerageAmt)} 
                        className="bg-purple-50/80 border border-purple-200/50 p-1 rounded"
                        valueType="amount"
                    />
                </div>
            </div>

            {/* Net Payable - Compact */}
            <div className="bg-primary/5 border border-primary/20 rounded p-1.5">
                <SummaryItem 
                    label="Net Payable" 
                    value={formatCurrency(netPayable)} 
                    isHighlighted 
                    className="bg-primary/10 border border-primary/30 p-1.5 rounded text-center"
                />
            </div>
        </div>
    );
};
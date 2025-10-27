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

const SummaryItem = ({ label, value, isHighlighted, className }: { label: string; value: string; isHighlighted?: boolean, className?: string; }) => (
    <div className={cn("flex items-baseline gap-2", className)}>
        <p className="text-xs text-muted-foreground whitespace-nowrap">{label}:</p>
        <p className={cn("font-semibold text-sm", isHighlighted && "text-base font-bold text-primary")}>
            {value}
        </p>
    </div>
);

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
    const kanta = Number(customer.kanta) || 0;
    
    // Calculate values based on current form data
    const finalWt = grossWeight - teirWeight;
    const kartaWt = Number((finalWt * (kartaPercentage / 100)).toFixed(2));
    const netWt = finalWt - kartaWt;
    const amount = finalWt * rate;
    const kartaAmt = kartaWt * rate;
    const labAmt = netWt * labouryRate;
    const netPayable = amount - kartaAmt - labAmt - kanta;
    
    return (
        <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
            <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-around gap-x-4 gap-y-2 flex-wrap">
                    <SummaryItem label="Due Date" value={isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")} />
                    <SummaryItem label="Gross Wt" value={`${grossWeight.toFixed(2)} Qtl`} />
                    <SummaryItem label="Tier Wt" value={`${teirWeight.toFixed(2)} Qtl`} />
                    <SummaryItem label="Final Wt" value={`${finalWt.toFixed(2)} Qtl`} />
                    <SummaryItem label="Karta Wt" value={`${kartaWt.toFixed(2)} Qtl`} />
                    <SummaryItem label="Net Wt" value={`${netWt.toFixed(2)} Qtl`} />
                    <SummaryItem label="Rate" value={`₹${rate.toFixed(2)}/Qtl`} />
                    <SummaryItem label="Amount" value={formatCurrency(amount)} />
                    <SummaryItem label="Karta Amt" value={formatCurrency(kartaAmt)} />
                    <SummaryItem label="Lab Amt" value={formatCurrency(labAmt)} />
                    <SummaryItem label="Kanta" value={formatCurrency(kanta)} />
                    <SummaryItem label="Net Payable" value={formatCurrency(netPayable)} isHighlighted />
                </div>
                
                <div className="flex justify-between">
                    <div className="flex gap-2">
                        {onClearForm && (
                            <Button 
                                variant="outline"
                                onClick={onClearForm} 
                                size="sm" 
                                className="h-8 rounded-md" 
                                disabled={isSubmitting}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Clear Form
                            </Button>
                        )}
                        {onToggleTable && (
                            <Button 
                                variant="outline"
                                onClick={onToggleTable} 
                                size="sm" 
                                className="h-8 rounded-md" 
                                disabled={isSubmitting}
                            >
                                <Table className="mr-2 h-4 w-4" />
                                {showTable ? 'Hide Table' : 'Show Table'}
                            </Button>
                        )}
                    </div>
                    <Button 
                        onClick={onSave} 
                        size="sm" 
                        className="h-8 rounded-md" 
                        disabled={isLoading || isSubmitting}
                    >
                        {isSubmitting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {isEditing ? 'Update' : 'Save'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn, roundToTwoDecimalPlaces } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Search, Upload, Download, Trash2, Loader2, RefreshCw, X, Wheat, FileText, Banknote } from "lucide-react";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { SegmentedSwitch } from "../ui/segmented-switch";
import { Label } from "../ui/label";
import { formatDate } from "@/lib/date-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SmartDatePicker } from "../ui/smart-date-picker";


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface CalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onSaveAndPrint?: (docType: 'tax-invoice' | 'bill-of-supply' | 'challan' | 'receipt') => void;
    isEditing: boolean;
    onSearch?: (term: string) => void;
    onPrint?: () => void;
    selectedIdsCount?: number;
    isCustomerForm?: boolean;
    isBrokerageIncluded?: boolean;
    onBrokerageToggle?: (checked: boolean) => void;
    onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onExport?: () => void;
    onUpdateSelected?: () => void;
    onDeleteSelected?: () => void;
    onDeleteAll?: () => void;
    isDeleting?: boolean;
    onClear?: () => void;
    varietyOptions?: { value: string; label: string }[];
    selectedVariety?: string;
    onVarietyChange?: (value: string) => void;
}

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

const SummaryItem = ({ label, value, isHighlighted, className }: { label: string; value: string; isHighlighted?: boolean, className?: string; }) => (
    <div className={cn("flex items-baseline gap-2", className)}>
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">{label}:</p>
        <p className={cn("font-semibold text-[11px]", isHighlighted && "text-xs font-bold text-primary")}>
            {value}
        </p>
    </div>
);


export const CalculatedSummary = ({ 
    customer, 
    onSave, 
    onSaveAndPrint, 
    isEditing, 
    onSearch, 
    onPrint, 
    selectedIdsCount = 0,
    isCustomerForm = false,
    isBrokerageIncluded,
    onBrokerageToggle,
    onImport,
    onExport,
    onUpdateSelected,
    onDeleteSelected,
    onDeleteAll,
    isDeleting = false,
    onClear,
    varietyOptions = [],
    selectedVariety = "ALL",
    onVarietyChange,
    totals,
    onDateFilterChange,
    selectedDateRange
}: CalculatedSummaryProps & { 
    totals?: { bags: number; grossWt: number; netWt: number; baseAmt: number; finalAmt: number; totalRec: number };
    onDateFilterChange?: (range: { from: Date | undefined; to: Date | undefined }) => void;
    selectedDateRange?: { from: Date | undefined; to: Date | undefined };
}) => {

    // Only disable during delete operations, not during save/update (optimistic updates)
    const isLoading = isDeleting;
    const isPrintActionForSelected = selectedIdsCount > 0;
    
    // Determine which summary to show
    const showKantaParchiSummary = isCustomerForm;
    const showSupplierSummary = !isCustomerForm;
    
    const averageBagWeight = useMemo(() => {
        if (!customer || !customer.weight || !customer.bags) return 0;
        return (customer.weight / customer.bags) * 100;
    }, [customer]);

    const totalBagWeight = useMemo(() => {
        if (!customer || !customer.bags || !customer.bagWeightKg) return 0;
        return customer.bags * customer.bagWeightKg;
    }, [customer]);

    // Calculate brokerage amount for suppliers: Final Weight × Brokerage Rate
    const brokerageAmount = useMemo(() => {
        if (!customer || !showSupplierSummary) return 0;
        const finalWeight = customer.weight || 0;
        const brokerageRate = Number(customer.brokerageRate) || 0;
        return brokerageRate * finalWeight;
    }, [customer, showSupplierSummary]);
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
            {/* Kanta Parchi Summary */}
            {showKantaParchiSummary && (
                <>
                    {/* Deduction Summary Card */}
                    <Card className="shadow-sm border border-border/60 bg-slate-50/30 dark:bg-slate-900/20 p-2.5 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/40 mb-1.5">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold">Deduction Summary</span>
                            </div>
                            <div className="space-y-1 text-[10px]">
                                <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} className="justify-between" />
                                <SummaryItem label="Karta Wt" value={`${roundToTwoDecimalPlaces(customer.kartaWeight || 0).toFixed(2)} Qtl`} className="justify-between" />
                                <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} className="justify-between font-bold" />
                                <SummaryItem label="Avg Bags Wt" value={`${averageBagWeight.toFixed(2)} kg`} className="justify-between" />
                                <SummaryItem label="Total Bag Wt" value={`${(totalBagWeight / 100).toFixed(2)} Qtl`} className="justify-between" />
                                <SummaryItem label="Karta Amount" value={`-${formatCurrency(customer.kartaAmount || 0)}`} className="justify-between text-red-500 font-medium" />
                                <SummaryItem label="Bag Wt Deduction" value={`-${formatCurrency(customer.bagWeightDeductionAmount || 0)}`} className="justify-between text-red-500 font-medium" />
                            </div>
                        </div>
                        <div className="border-t border-dashed border-border/60 pt-1.5 mt-1.5">
                            <SummaryItem 
                                label="Final Amount" 
                                value={formatCurrency(customer.finalAmount || 0)} 
                                className="justify-between font-bold text-primary text-xs" 
                            />
                        </div>
                    </Card>

                    {/* Financial Summary Card */}
                    <Card className="shadow-sm border border-border/60 bg-slate-50/30 dark:bg-slate-900/20 p-2.5 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/40 mb-1.5">
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold">Financial Summary</span>
                            </div>
                            <div className="space-y-1 text-[10px]">
                                <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} className="justify-between" />
                                <SummaryItem label="CD" value={`-${formatCurrency(customer.cd || 0)}`} className="justify-between text-red-500 font-medium" />
                                <SummaryItem label="Brokerage" value={`-${formatCurrency(customer.brokerage || 0)}`} className="justify-between text-red-500 font-medium" />
                                <SummaryItem label="Kanta" value={`-${formatCurrency(customer.kanta || 0)}`} className="justify-between text-red-500 font-medium" />
                                <SummaryItem label="Total Bag Amt" value={formatCurrency(customer.bagAmount || 0)} className="justify-between" />
                                <SummaryItem label="Transport Amount" value={formatCurrency(customer.transportAmount || 0)} className="justify-between" />
                                {(Number(customer.advanceFreight) || 0) > 0 && (
                                    <SummaryItem label="Advance Freight" value={formatCurrency(Number(customer.advanceFreight) || 0)} className="justify-between text-emerald-600 font-medium" />
                                )}
                            </div>
                        </div>
                        <div className="border-t border-dashed border-border/60 pt-1.5 mt-1.5">
                            <SummaryItem 
                                label="Total Receivable" 
                                value={formatCurrency((Number(customer.originalNetAmount) || 0) + (Number(customer.advanceFreight) || 0))} 
                                isHighlighted 
                                className="justify-between text-emerald-600 font-black text-xs" 
                            />
                        </div>
                    </Card>
                </>
            )}
            
            {/* Supplier Summary */}
            {showSupplierSummary && (
                <>
                    {/* Deduction Summary Card */}
                    <Card className="shadow-sm border border-border/60 bg-slate-50/30 dark:bg-slate-900/20 p-2.5 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/40 mb-1.5">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold">Deduction Summary</span>
                            </div>
                            <div className="space-y-1 text-[10px]">
                                <SummaryItem label="Due Date" value={isLoading ? "-" : formatDate(customer.dueDate, "dd-MMM-yy")} className="justify-between" />
                                <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} className="justify-between" />
                                <SummaryItem label="Karta Wt" value={`${(customer.kartaWeight || 0).toFixed(2)} Qtl`} className="justify-between" />
                                <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} className="justify-between font-bold" />
                            </div>
                        </div>
                        <div className="border-t border-dashed border-border/60 pt-1.5 mt-1.5">
                            <SummaryItem 
                                label="Total Weight Parameters" 
                                value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} 
                                className="justify-between font-bold text-primary" 
                            />
                        </div>
                    </Card>

                    {/* Financial Summary Card */}
                    <Card className="shadow-sm border border-border/60 bg-slate-50/30 dark:bg-slate-900/20 p-2.5 flex flex-col justify-between h-full">
                        <div>
                            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/40 mb-1.5">
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold">Financial Summary</span>
                            </div>
                            <div className="space-y-1 text-[10px]">
                                <SummaryItem label="Gross Amount" value={formatCurrency(customer.amount || 0)} className="justify-between" />
                                <SummaryItem label="Laboury" value={`-${formatCurrency(customer.labouryAmount || 0)}`} className="justify-between text-red-500 font-medium" />
                                <SummaryItem label="Karta Amount" value={`-${formatCurrency(customer.kartaAmount || 0)}`} className="justify-between text-red-500 font-medium" />
                                {(customer.brokerageRate || brokerageAmount > 0) && (
                                    <SummaryItem label="Brokerage" value={`-${formatCurrency(brokerageAmount || customer.brokerageAmount || 0)}`} className="justify-between text-red-500 font-medium" />
                                )}
                            </div>
                        </div>
                        <div className="border-t border-dashed border-border/60 pt-1.5 mt-1.5">
                            <SummaryItem 
                                label="Net Payable" 
                                value={formatCurrency(Number(customer.originalNetAmount) || 0)} 
                                isHighlighted 
                                className="justify-between text-emerald-600 font-black text-xs" 
                            />
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

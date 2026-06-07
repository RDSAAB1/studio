
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn, roundToTwoDecimalPlaces } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Search, Upload, Download, Trash2, Loader2, RefreshCw, X, Wheat } from "lucide-react";
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
        <p className="text-xs text-muted-foreground whitespace-nowrap">{label}:</p>
        <p className={cn("font-semibold text-sm", isHighlighted && "text-base font-bold text-primary")}>
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
        <Card className="border-2 border-primary/20 shadow-md bg-slate-50/50">
            <CardContent className="p-3 space-y-3">
                 <div className="flex items-center justify-around gap-x-4 gap-y-2 flex-wrap">
                    {/* Kanta Parchi Summary */}
                    {showKantaParchiSummary && (
                        <>
                            <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Karta Wt" value={`${roundToTwoDecimalPlaces(customer.kartaWeight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Avg Bags Wt" value={`${averageBagWeight.toFixed(2)} kg`} />
                            <SummaryItem label="Total Bag Wt" value={`${(totalBagWeight / 100).toFixed(2)} Qtl`} />
                            <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} />
                            <SummaryItem label="Karta" value={formatCurrency(customer.kartaAmount || 0)} />
                            <SummaryItem label="Bag Wt Deduction" value={formatCurrency(customer.bagWeightDeductionAmount || 0)} />
                            <SummaryItem label="Final Amount" value={formatCurrency(customer.finalAmount || 0)} isHighlighted className="bg-primary/5 px-2 py-1 rounded-md" />
                            <SummaryItem label="Brokerage" value={formatCurrency(customer.brokerage || 0)} />
                            <SummaryItem label="CD" value={formatCurrency(customer.cd || 0)} />
                            <SummaryItem label="Total Bag Amt" value={formatCurrency(customer.bagAmount || 0)} />
                            <SummaryItem label="Transport Amount" value={formatCurrency(customer.transportAmount || 0)} />
                            <SummaryItem label="Kanta" value={formatCurrency(customer.kanta || 0)} />
                            {(Number(customer.advanceFreight) || 0) > 0 && (
                                <SummaryItem label="Advance Freight" value={formatCurrency(Number(customer.advanceFreight) || 0)} />
                            )}
                            <SummaryItem 
                                label="Total Receivable" 
                                value={formatCurrency((Number(customer.originalNetAmount) || 0) + (Number(customer.advanceFreight) || 0))} 
                                isHighlighted 
                            />
                        </>
                    )}
                    
                    {/* Supplier Summary */}
                    {showSupplierSummary && (
                        <>
                            <SummaryItem
                                label="Due Date"
                                value={isLoading ? "-" : formatDate(customer.dueDate, "dd-MMM-yy")}
                            />
                            <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Karta Wt" value={`${(customer.kartaWeight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} />
                            <SummaryItem label="Laboury" value={formatCurrency(customer.labouryAmount || 0)} />
                            <SummaryItem label="Karta" value={formatCurrency(customer.kartaAmount || 0)} />
                            {(customer.brokerageRate || brokerageAmount > 0) && (
                                <SummaryItem 
                                    label={`Brokerage (${customer.brokerageAddSubtract ? 'INCLUDE' : 'EXCLUDE'})`} 
                                    value={formatCurrency(brokerageAmount || customer.brokerageAmount || 0)} 
                                />
                            )}
                            <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} />
                            <SummaryItem label="Net Payable" value={formatCurrency(Number(customer.originalNetAmount) || 0)} isHighlighted />
                        </>
                    )}
                </div>
                
                <Separator />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                         {onSearch && (
                            <InputWithIcon icon={<Search className="h-4 w-4 text-muted-foreground" />}>
                                <Input
                                    placeholder="Search by SR No, Name, or Contact..."
                                    onChange={(e) => onSearch(e.target.value)}
                                    className="h-8 pl-10 text-xs w-48 sm:w-64"
                                />
                            </InputWithIcon>
                         )}

                        {onVarietyChange && varietyOptions.length > 0 && (
                            <div className="w-32">
                                <Select value={selectedVariety} onValueChange={onVarietyChange}>
                                    <SelectTrigger className="h-8 text-xs font-bold border-primary/30">
                                        <Wheat className="h-3 w-3 mr-1 text-primary" />
                                        <SelectValue placeholder="Variety" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Varieties</SelectItem>
                                        {varietyOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {onDateFilterChange && (
                            <div className="flex items-center gap-1">
                                <SmartDatePicker
                                    value={selectedDateRange?.from}
                                    onChange={(date) => onDateFilterChange({ ...selectedDateRange!, from: date })}
                                    placeholder="From Date"
                                    className="h-8 w-28 text-[10px]"
                                />
                                <span className="text-slate-400 text-xs">-</span>
                                <SmartDatePicker
                                    value={selectedDateRange?.to}
                                    onChange={(date) => onDateFilterChange({ ...selectedDateRange!, to: date })}
                                    placeholder="To Date"
                                    className="h-8 w-28 text-[10px]"
                                />
                            </div>
                        )}
                         {onImport && (
                            <Button asChild size="sm" variant="outline" className="h-8 relative cursor-pointer" type="button">
                                <label htmlFor="import-file">
                                    <Upload className="mr-2 h-4 w-4"/> Import
                                    <input id="import-file" type="file" className="sr-only" onChange={onImport} accept=".xlsx, .xls"/>
                                </label>
                            </Button>
                         )}
                         {onExport && (
                            <Button onClick={onExport} size="sm" variant="outline" className="h-8" type="button">
                            <Download className="mr-2 h-4 w-4"/> Export
                            </Button>
                         )}
                         {onUpdateSelected && selectedIdsCount > 0 && (
                            <Button onClick={onUpdateSelected} size="sm" variant="outline" className="h-8" type="button">
                                <RefreshCw className="mr-2 h-4 w-4"/> Update Selected ({selectedIdsCount})
                            </Button>
                         )}
                         {onDeleteSelected && selectedIdsCount > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" className="h-8" type="button" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>}
                                        Delete Selected ({selectedIdsCount})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the {selectedIdsCount} selected entries and their associated payments. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDeleteSelected}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         )}
                         {onDeleteAll && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive" className="h-8" type="button" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4"/>}
                                        Delete All
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>DELETE ALL ENTRIES?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action is irreversible. This will permanently delete ALL supplier entries and ALL payment history. Are you absolutely sure?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDeleteAll}>Yes, Delete Everything</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isCustomerForm && onBrokerageToggle && (
                            <div className="flex items-center space-x-2">
                                <SegmentedSwitch 
                                    id="brokerage-toggle" 
                                    checked={!!isBrokerageIncluded} 
                                    onCheckedChange={onBrokerageToggle}
                                    leftLabel="Off"
                                    rightLabel="On"
                                    className="w-32"
                                />
                                <Label htmlFor="brokerage-toggle" className="text-xs">Include Brokerage</Label>
                            </div>
                        )}

                        {onPrint && (
                             <Button
                                type="button"
                                onClick={onPrint}
                                size="sm"
                                className="h-8 rounded-md"
                                disabled={isLoading}
                            >
                                <Printer className="mr-2 h-4 w-4" /> 
                                {isPrintActionForSelected ? `Print (${selectedIdsCount})` : 'Print'}
                            </Button>
                        )}
                        
                       {onSaveAndPrint && isCustomerForm && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="h-8 rounded-md" disabled={isLoading} type="button">
                                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                    Save & Print <ChevronsUpDown className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onSaveAndPrint('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('challan')}>Challan</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                       )}

                        {onSaveAndPrint && !isCustomerForm && (
                            <Button onClick={() => onSaveAndPrint('receipt')} size="sm" className="h-8 rounded-md" disabled={isLoading} type="button">
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} 
                                Save & Print
                            </Button>
                        )}

                        <Button onClick={onSave} size="sm" className="h-8 rounded-md font-bold" disabled={isLoading} type="button">
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update (Alt+S)</> : <><Save className="mr-2 h-4 w-4" /> Save (Alt+S)</>)}
                        </Button>

                        {onClear && (
                            <Button onClick={onClear} size="sm" variant="outline" className="h-8 rounded-md" disabled={isLoading} type="button">
                                <X className="mr-2 h-4 w-4" /> Clear (Alt+C)
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

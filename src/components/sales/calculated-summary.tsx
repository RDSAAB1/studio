
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Search, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";

interface CalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onSaveAndPrint?: (docType: 'tax-invoice' | 'bill-of-supply' | 'challan') => void;
    onNew: () => void;
    isEditing: boolean;
    onSearch?: (term: string) => void;
    onPrint?: () => void;
    selectedIdsCount?: number;
    isCustomerForm?: boolean;
    isBrokerageIncluded?: boolean;
    onBrokerageToggle?: (checked: boolean) => void;
    onImport?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onExport?: () => void;
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
    onNew, 
    isEditing, 
    onSearch, 
    onPrint, 
    selectedIdsCount,
    isCustomerForm = false,
    isBrokerageIncluded,
    onBrokerageToggle,
    onImport,
    onExport
}: CalculatedSummaryProps) => {

    const isLoading = !customer || !customer.srNo;
    const isPrintActionForSelected = selectedIdsCount && selectedIdsCount > 0;
    
    return (
        <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
            <CardContent className="p-3 space-y-3">
                 <div className="flex items-center justify-around gap-x-4 gap-y-2 flex-wrap">
                    {!isCustomerForm && <SummaryItem label="Due Date" value={isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")} />}
                    <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} />
                    {!isCustomerForm && <SummaryItem label="Karta Wt" value={`${(customer.kartaWeight || 0).toFixed(2)} Qtl`} />}
                    <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} />
                    {!isCustomerForm && <SummaryItem label="Laboury" value={formatCurrency(customer.labouryAmount || 0)} />}
                    {!isCustomerForm && <SummaryItem label="Karta" value={formatCurrency(customer.kartaAmount || 0)} />}
                    {isCustomerForm && <SummaryItem label="Brokerage" value={formatCurrency(customer.brokerage || 0)} />}
                    {isCustomerForm && <SummaryItem label="CD" value={formatCurrency(customer.cd || 0)} />}
                    <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} />
                    <SummaryItem label="Net Payable" value={formatCurrency(Number(customer.originalNetAmount) || 0)} isHighlighted />
                </div>
                
                <Separator />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 flex-wrap">
                         <InputWithIcon icon={<Search className="h-4 w-4 text-muted-foreground" />}>
                            <Input
                                placeholder="Search by SR No, Name, or Contact..."
                                onChange={(e) => onSearch && onSearch(e.target.value)}
                                className="h-8 pl-10 text-xs w-48 sm:w-64"
                            />
                        </InputWithIcon>
                         <Button asChild size="sm" variant="outline" className="h-8 relative">
                            <label htmlFor="import-file">
                                <Upload className="mr-2 h-4 w-4"/> Import
                                <input id="import-file" type="file" className="sr-only" onChange={onImport} accept=".xlsx, .xls"/>
                            </label>
                        </Button>
                        <Button onClick={onExport} size="sm" variant="outline" className="h-8">
                           <Download className="mr-2 h-4 w-4"/> Export
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isCustomerForm && onBrokerageToggle && (
                            <div className="flex items-center space-x-2">
                                <Switch id="brokerage-toggle" checked={isBrokerageIncluded} onCheckedChange={onBrokerageToggle} />
                                <Label htmlFor="brokerage-toggle" className="text-xs">Include Brokerage</Label>
                            </div>
                        )}

                        {onPrint && !onSaveAndPrint && (
                             <Button
                                onClick={onPrint}
                                size="sm"
                                className="h-8 rounded-md"
                                disabled={isLoading}
                            >
                                <Printer className="mr-2 h-4 w-4" /> 
                                {isPrintActionForSelected ? `Print (${selectedIdsCount})` : 'Print'}
                            </Button>
                        )}
                        
                       {onSaveAndPrint && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="h-8 rounded-md" disabled={isLoading}>
                                    <Save className="mr-2 h-4 w-4" /> Save & Print <ChevronsUpDown className="ml-2 h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onSaveAndPrint('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('challan')}>Challan</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                       )}

                        <Button onClick={onSave} size="sm" className="h-8 rounded-md" disabled={isLoading}>
                            {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                        </Button>
                        <Button onClick={onNew} size="sm" variant="outline" className="h-8 rounded-md" disabled={isLoading}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

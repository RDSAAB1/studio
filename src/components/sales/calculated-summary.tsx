
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "../ui/separator";

interface CalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onSaveAndPrint: () => void;
    onNew: () => void;
    isEditing: boolean;
}

const SummaryItem = ({ label, value, isHighlighted, className }: { label: string; value: string; isHighlighted?: boolean, className?: string; }) => (
    <div className={cn("flex items-baseline gap-1.5", className)}>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("font-semibold text-sm", isHighlighted && "text-base font-bold text-primary")}>
            {value}
        </p>
    </div>
);


export const CalculatedSummary = ({ customer, onSave, onSaveAndPrint, onNew, isEditing }: CalculatedSummaryProps) => {

    const isLoading = !customer || !customer.srNo;
    
    return (
        <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
            <CardContent className="p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex-grow space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                       <SummaryItem label="Due Date" value={isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")} />
                       <Separator orientation="vertical" className="h-4" />
                       <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} />
                       <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} />
                       <Separator orientation="vertical" className="h-4" />
                       <SummaryItem label="Laboury" value={formatCurrency(customer.labouryAmount || 0)} />
                       <SummaryItem label="Karta" value={formatCurrency(customer.kartaAmount || 0)} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                       <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} />
                       <Separator orientation="vertical" className="h-4" />
                       <SummaryItem label="Net Payable" value={formatCurrency(Number(customer.netAmount) || 0)} isHighlighted/>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                    <Button onClick={onSave} size="sm" className="h-8 rounded-md flex-1 sm:flex-none" disabled={isLoading}>
                        {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                    </Button>
                    <Button onClick={onNew} size="sm" variant="outline" className="h-8 rounded-md flex-1 sm:flex-none" disabled={isLoading}>
                        <PlusCircle className="mr-2 h-4 w-4" /> New
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 rounded-md flex-1 sm:flex-none" disabled={isLoading}>
                                <Printer className="mr-2 h-4 w-4"/>
                                Print
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onSaveAndPrint}>Save & Print</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
};

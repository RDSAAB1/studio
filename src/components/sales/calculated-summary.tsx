
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Search } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "../ui/separator";
import { Input } from "../ui/input";

interface CalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onSaveAndPrint: () => void;
    onNew: () => void;
    isEditing: boolean;
    onSearch: (term: string) => void;
    onPrint: () => void;
    selectedIdsCount: number;
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


export const CalculatedSummary = ({ customer, onSave, onSaveAndPrint, onNew, isEditing, onSearch, onPrint, selectedIdsCount }: CalculatedSummaryProps) => {

    const isLoading = !customer || !customer.srNo;
    const isPrintActionForSelected = selectedIdsCount > 0;
    
    return (
        <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
            <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-around gap-x-4 gap-y-2 flex-wrap">
                    <SummaryItem label="Due Date" value={isLoading ? '-' : format(new Date(customer.dueDate), "dd-MMM-yy")} />
                    <SummaryItem label="Final Wt" value={`${(customer.weight || 0).toFixed(2)} Qtl`} />
                    <SummaryItem label="Net Wt" value={`${(customer.netWeight || 0).toFixed(2)} Qtl`} />
                    <SummaryItem label="Laboury" value={formatCurrency(customer.labouryAmount || 0)} />
                    <SummaryItem label="Karta" value={formatCurrency(customer.kartaAmount || 0)} />
                    <SummaryItem label="Amount" value={formatCurrency(customer.amount || 0)} />
                    <SummaryItem label="Net Payable" value={formatCurrency(Number(customer.netAmount) || 0)} isHighlighted />
                </div>
                
                <Separator />

                <div className="flex items-center justify-between gap-2 w-full">
                    <div className="relative w-full max-w-xs">
                         <InputWithIcon icon={<Search className="h-4 w-4 text-muted-foreground" />}>
                            <Input
                                placeholder="Search by SR No, Name, or Contact..."
                                onChange={(e) => onSearch(e.target.value)}
                                className="h-8 pl-10 text-xs"
                            />
                        </InputWithIcon>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={onPrint}
                            size="icon"
                            variant={isPrintActionForSelected ? "default" : "outline"}
                            className="h-8 w-8 rounded-full"
                            disabled={isLoading}
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
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

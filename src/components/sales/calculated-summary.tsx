
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Banknote, Scale, Percent, User, HandCoins, MoreVertical, CalendarDays, Weight, Calculator, Milestone } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "../ui/separator";

interface CalculatedSummaryProps {
    customer: Customer;
    onSave: () => void;
    onSaveAndPrint: (docType: any) => void;
    onNew: () => void;
    isEditing: boolean;
    isCustomerForm?: boolean;
    isBrokerageIncluded?: boolean;
    onBrokerageToggle?: (checked: boolean) => void;
}

const SummaryItem = ({ label, value, icon, isBold, isLarge, className }: { label: string; value: string; icon?: React.ReactNode; isBold?: boolean; isLarge?: boolean; className?: string; }) => (
    <div className={cn("flex items-start gap-1.5", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div className="leading-tight">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("font-semibold", isBold && "font-bold text-primary", isLarge ? "text-lg" : "text-sm")}>
                {value}
            </p>
        </div>
    </div>
);


export const CalculatedSummary = ({ customer, onSave, onSaveAndPrint, onNew, isEditing, isCustomerForm = true, isBrokerageIncluded, onBrokerageToggle }: CalculatedSummaryProps) => {

    if (!isCustomerForm) {
        // Supplier Form Summary
        return (
             <Card className="bg-card/70 backdrop-blur-sm border-primary/20 shadow-lg">
                <CardContent className="p-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="grid grid-flow-col auto-cols-max gap-x-4 gap-y-1">
                       <SummaryItem icon={<CalendarDays size={14} />} label="Due Date" value={customer.dueDate ? format(new Date(customer.dueDate), "dd-MMM-yy") : '-'} />
                       <Separator orientation="vertical" className="h-6 my-auto" />
                        <SummaryItem icon={<Weight size={14} />} label="Final Wt" value={`${customer.weight.toFixed(2)} Qtl`} />
                        <SummaryItem icon={<Scale size={14} />} label="Net Wt" value={`${customer.netWeight.toFixed(2)} Qtl`} />
                       <Separator orientation="vertical" className="h-6 my-auto" />
                       <SummaryItem icon={<Banknote size={14} />} label="Amount" value={formatCurrency(customer.amount)} />
                       <SummaryItem icon={<Calculator size={14} />} label="Laboury" value={formatCurrency(customer.labouryAmount)} />
                       <SummaryItem icon={<Milestone size={14} />} label="Karta" value={formatCurrency(customer.kartaAmount)} />
                    </div>

                    <div className="w-full sm:w-auto flex items-center justify-end gap-2">
                        <div className="text-right bg-primary/10 p-2 rounded-lg border border-primary/30">
                            <p className="text-xs font-semibold text-primary">Net Payable Amount</p>
                            <p className="text-xl font-bold text-primary">{formatCurrency(Number(customer.netAmount))}</p>
                        </div>
                         <div className="flex flex-col gap-1">
                            <Button onClick={onSave} size="sm" className="h-7 rounded-md">
                                {isEditing ? <><Pen className="mr-2 h-3 w-3" /> Update</> : <><Save className="mr-2 h-3 w-3" /> Save</>}
                            </Button>
                            <div className="flex gap-1">
                                <Button onClick={onNew} size="sm" variant="outline" className="h-7 rounded-md">
                                    <PlusCircle className="mr-2 h-3 w-3" /> New
                                </Button>
                                <Button type="button" onClick={() => onSaveAndPrint('receipt')} size="sm" variant="outline" className="h-7 rounded-md">
                                    <Printer className="mr-2 h-3 w-3"/> Print
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // Customer Form Summary
    return (
        <Card>
            <CardContent className="p-3 space-y-3">
                {/* Row 1: Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-2">
                    <SummaryItem label="Final Wt (Qtl)" value={customer.weight.toFixed(2)} icon={<Scale size={14} />} />
                    <SummaryItem label="Net Wt (Qtl)" value={customer.netWeight.toFixed(2)} icon={<Scale size={14} />} />
                    <SummaryItem label="Bag Amount" value={formatCurrency(customer.bagAmount || 0)} icon={<HandCoins size={14} />} />
                    <SummaryItem label="Brokerage" value={formatCurrency(customer.brokerage || 0)} icon={<User size={14}/>} />
                    <SummaryItem label="CD Amount" value={formatCurrency(customer.cd || 0)} icon={<Percent size={14} />} />
                    <SummaryItem label="Total Amount" value={formatCurrency(customer.amount)} icon={<Banknote size={14} />} />
                    <SummaryItem label="Net Amount" value={formatCurrency(Number(customer.netAmount))} icon={<Banknote size={14}/>} isBold isLarge />
                </div>
                
                <Separator/>

                {/* Row 2: Actions and Toggle */}
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Button onClick={onSave} size="sm" className="h-7">
                            {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                        </Button>
                         <Button onClick={onNew} size="sm" variant="outline" className="h-7">
                            <PlusCircle className="mr-2 h-4 w-4" /> New
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={() => onSaveAndPrint('tax-invoice')}>
                            <Printer className="mr-2 h-4 w-4"/> Tax Invoice
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" onClick={() => onSaveAndPrint('bill-of-supply')}>
                            <Printer className="mr-2 h-4 w-4"/> Bill of Supply
                        </Button>
                         <Button variant="outline" size="sm" className="h-7" onClick={() => onSaveAndPrint('challan')}>
                            <Printer className="mr-2 h-4 w-4"/> Challan
                        </Button>
                    </div>

                    {isCustomerForm && onBrokerageToggle && (
                         <div className="flex items-center justify-center pt-2 sm:pt-0">
                           <button
                                type="button"
                                onClick={() => onBrokerageToggle(!isBrokerageIncluded)}
                                className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isBrokerageIncluded ? 'bg-primary/20' : 'bg-secondary/20' )} >
                                <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", isBrokerageIncluded ? 'text-primary' : 'text-muted-foreground')}>Include</span>
                                <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !isBrokerageIncluded ? 'text-primary' : 'text-muted-foreground')}>Exclude</span>
                                <div className={cn( "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform", isBrokerageIncluded ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]' )}>
                                    <div className={cn( "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300", isBrokerageIncluded ? 'bg-primary' : 'bg-secondary' )}>
                                        <span className="text-xs font-bold text-primary-foreground">Brokerage</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};


"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Banknote, Scale, Percent, User, HandCoins, MoreVertical } from "lucide-react";
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
    <div className={cn("flex items-center gap-2", className)}>
        {icon && <div className="text-muted-foreground">{icon}</div>}
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
        const summaryFields = [
            { label: "Due Date", value: customer.dueDate ? format(new Date(customer.dueDate), "PPP") : '-' }, { label: "Weight", value: customer.weight.toFixed(2) },
            { label: "Karta Weight", value: customer.kartaWeight.toFixed(2) }, { label: "Karta Amount", value: formatCurrency(customer.kartaAmount) },
            { label: "Net Weight", value: customer.netWeight.toFixed(2) }, { label: "Laboury Amount", value: formatCurrency(customer.labouryAmount) },
            { label: "Amount", value: formatCurrency(customer.amount) }, { label: "Net Amount", value: formatCurrency(Number(customer.netAmount)), isBold: true },
        ];
        return (
            <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                <CardContent className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                        {summaryFields.map(item => (
                            <div key={item.label} className="leading-tight">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className={cn("font-semibold", item.isBold && "text-primary font-bold text-base")}>{String(item.value)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col justify-start items-stretch space-y-2 border-t lg:border-t-0 lg:border-l pt-3 lg:pt-0 lg:pl-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="h-8">
                                    Actions <MoreVertical className="ml-auto h-4 w-4 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={onSave}>{isEditing ? "Update" : "Save"}</DropdownMenuItem>
                                <DropdownMenuItem onClick={onNew}>New / Clear</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button type="button" onClick={() => onSaveAndPrint('receipt')} size="sm" variant="outline" className="h-8">
                            <Printer className="mr-2 h-4 w-4"/> Save & Print
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // Customer Form Summary
    return (
        <Card>
            <CardContent className="p-3 flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Left Side: Calculations */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2 flex-1">
                    <SummaryItem label="Final Wt (Qtl)" value={customer.weight.toFixed(2)} icon={<Scale size={14} />} />
                    <SummaryItem label="Net Wt (Qtl)" value={customer.netWeight.toFixed(2)} icon={<Scale size={14} />} />
                    <SummaryItem label="Bag Amount" value={formatCurrency(customer.bagAmount || 0)} icon={<HandCoins size={14} />} />
                    <SummaryItem label="Brokerage" value={formatCurrency(customer.brokerage || 0)} icon={<User size={14}/>} />
                    <SummaryItem label="CD Amount" value={formatCurrency(customer.cd || 0)} icon={<Percent size={14} />} />
                    <SummaryItem label="Total Amount" value={formatCurrency(customer.amount)} icon={<Banknote size={14} />} />
                    <SummaryItem label="Net Amount" value={formatCurrency(Number(customer.netAmount))} icon={<Banknote size={14}/>} isBold isLarge />
                </div>
                
                <Separator orientation="vertical" className="h-10 mx-3 hidden md:block" />

                {/* Right Side: Actions */}
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                        <Button onClick={onSave} size="sm" className="h-7">
                            {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                        </Button>
                         <Button onClick={onNew} size="sm" variant="outline" className="h-7">
                            <PlusCircle className="mr-2 h-4 w-4" /> New
                        </Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7">
                                    <Printer className="mr-2 h-4 w-4"/> Print <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('challan')}>Challan</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {isCustomerForm && onBrokerageToggle && (
                         <div className="flex items-center justify-center pt-2">
                           <button
                                type="button"
                                onClick={() => onBrokerageToggle(!isBrokerageIncluded)}
                                className={cn( "relative w-40 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", isBrokerageIncluded ? 'bg-primary/20' : 'bg-secondary/20' )} >
                                <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", isBrokerageIncluded ? 'text-primary' : 'text-muted-foreground')}>Include</span>
                                <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", !isBrokerageIncluded ? 'text-primary' : 'text-muted-foreground')}>Exclude</span>
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

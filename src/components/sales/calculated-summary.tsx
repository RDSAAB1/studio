
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown, Check, X } from "lucide-react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

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

export const CalculatedSummary = ({ customer, onSave, onSaveAndPrint, onNew, isEditing, isCustomerForm = true, isBrokerageIncluded, onBrokerageToggle }: CalculatedSummaryProps) => {

    const summaryFields = useMemo(() => {
        if (isCustomerForm) {
            const avgWeightPerBag = (customer.bags && customer.bags > 0) ? ((customer.weight * 100) / customer.bags).toFixed(2) : '0.00';
            return [
                { label: "Weight", value: `${customer.weight.toFixed(2)} Qtl` },
                { label: "Net Weight", value: `${customer.netWeight.toFixed(2)} Qtl`},
                { label: "Avg Wt/Bag", value: `${avgWeightPerBag} kg` },
                { label: "Bag Amount", value: formatCurrency(customer.bagAmount || 0) },
                { label: "Brokerage Amt", value: formatCurrency(customer.brokerage || 0) }, 
                { label: "CD Amount", value: formatCurrency(customer.cd || 0) },
                { label: "Amount", value: formatCurrency(customer.amount) }, 
                { label: "Net Amount", value: formatCurrency(Number(customer.netAmount)), isBold: true },
            ];
        }
        // Supplier form summary
        const dueDate = customer.dueDate ? format(new Date(customer.dueDate), "PPP") : '-';
        return [
            { label: "Due Date", value: dueDate }, { label: "Weight", value: customer.weight.toFixed(2) },
            { label: "Karta Weight", value: customer.kartaWeight.toFixed(2) }, { label: "Karta Amount", value: formatCurrency(customer.kartaAmount) },
            { label: "Net Weight", value: customer.netWeight.toFixed(2) }, { label: "Laboury Amount", value: formatCurrency(customer.labouryAmount) },
            { label: "Amount", value: formatCurrency(customer.amount) }, { label: "Net Amount", value: formatCurrency(Number(customer.netAmount)), isBold: true },
        ];

      }, [customer, isCustomerForm]);

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
                    <Button onClick={onSave} size="sm" className="h-8">
                        {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                    </Button>
                    {isCustomerForm ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8">
                                    <Printer className="mr-2 h-4 w-4"/> Save & Print <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSaveAndPrint('challan')}>Challan</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                         <Button type="button" onClick={() => onSaveAndPrint('receipt')} size="sm" variant="outline" className="h-8">
                            <Printer className="mr-2 h-4 w-4"/> Save & Print
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onNew} size="sm" className="h-8">
                        <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
                    </Button>
                    {isCustomerForm && onBrokerageToggle && (
                         <button
                            type="button"
                            onClick={() => onBrokerageToggle(!isBrokerageIncluded)}
                            className={cn(
                                "relative inline-flex items-center h-10 w-full rounded-full p-1 transition-colors duration-300 ease-in-out",
                                isBrokerageIncluded ? "bg-green-500/20" : "bg-red-500/20"
                            )}
                            >
                            <span
                                className={cn(
                                "absolute left-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out",
                                isBrokerageIncluded ? "translate-x-full" : "translate-x-0",
                                isBrokerageIncluded ? "translate-x-[calc(100%-0.5rem)]" : "translate-x-0"
                                )}
                                style={{ width: 'calc(50% - 0.25rem)'}}
                            >
                               {isBrokerageIncluded ? <Check className="h-5 w-5 text-green-600"/> : <X className="h-5 w-5 text-red-600"/>}
                            </span>
                            <span className="flex-1 text-center text-sm font-semibold text-green-700">{isBrokerageIncluded ? "Include Brokerage" : ""}</span>
                            <span className="flex-1 text-center text-sm font-semibold text-red-700">{!isBrokerageIncluded ? "Exclude Brokerage" : ""}</span>
                        </button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

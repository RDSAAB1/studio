
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
                        <div className="flex items-center space-x-3 pt-2">
                           <button
                                type="button"
                                onClick={() => onBrokerageToggle(!isBrokerageIncluded)}
                                className={cn(
                                    "relative inline-flex flex-shrink-0 h-7 w-[160px] border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-inner",
                                    isBrokerageIncluded ? "bg-primary" : "bg-secondary"
                                )}
                            >
                                <span className="sr-only">Toggle Brokerage</span>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-primary-foreground">
                                    <span className={cn("transition-opacity duration-200", isBrokerageIncluded ? 'opacity-100' : 'opacity-50')}>Include</span>
                                    <span className="w-10"></span>
                                    <span className={cn("transition-opacity duration-200", !isBrokerageIncluded ? 'opacity-100' : 'opacity-50')}>Exclude</span>
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "pointer-events-none inline-block h-6 w-[80px] rounded-full bg-background shadow-lg transform ring-0 transition ease-in-out duration-200 flex items-center justify-center text-xs font-bold",
                                        isBrokerageIncluded ? "translate-x-0 bg-primary-foreground text-primary" : "translate-x-[74px] bg-secondary-foreground text-secondary"
                                    )}
                                >
                                    Brokerage
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

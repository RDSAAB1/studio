
"use client";

import { useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pen, PlusCircle, Save, Printer, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";

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
            <CardContent className="p-2 space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-3 gap-y-1">
                    {summaryFields.map(item => (
                        <div key={item.label}>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className={cn("text-sm font-semibold", item.isBold && "text-primary font-bold text-base")}>{String(item.value)}</p>
                        </div>
                    ))}
                </div>
                <div className="flex justify-start items-center space-x-2">
                    <Button onClick={onSave} size="sm">
                        {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
                    </Button>
                    {isCustomerForm ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
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
                         <Button type="button" onClick={() => onSaveAndPrint('receipt')} size="sm">
                            <Printer className="mr-2 h-4 w-4"/> Save & Print
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onNew} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
                    </Button>
                    <div className="flex-grow"></div>
                    {isCustomerForm && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="brokerage-toggle"
                                checked={isBrokerageIncluded}
                                onCheckedChange={onBrokerageToggle}
                            />
                            <Label htmlFor="brokerage-toggle" className="text-sm font-normal">Include Brokerage in Net Amount</Label>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

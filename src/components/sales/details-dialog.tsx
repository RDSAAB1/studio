
"use client";

import { useState, useMemo } from "react";
import type { Customer, CustomerPayment, Payment } from "@/lib/definitions";
import { format } from "date-fns";
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Calendar as CalendarIcon, Scale, Calculator, Percent, Server, Milestone, CircleDollarSign, Weight, HandCoins, Printer, Boxes, Briefcase } from "lucide-react";

interface DetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    customer: Customer | null;
    paymentHistory?: (Payment | CustomerPayment)[];
    entryType?: 'Supplier' | 'Customer';
}

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);

export const DetailsDialog = ({ isOpen, onOpenChange, customer, paymentHistory, entryType = 'Supplier' }: DetailsDialogProps) => {
    if (!customer) return null;

    const paymentsForDetailsEntry = useMemo(() => 
        (paymentHistory || []).filter(p => p.paidFor?.some(pf => pf.srNo === customer.srNo)),
        [paymentHistory, customer.srNo]
    );

    const totalPaidForThisEntry = useMemo(() => 
        paymentsForDetailsEntry.reduce((sum, p) => {
            const paidForThis = p.paidFor?.find(pf => pf.srNo === customer.srNo);
            return sum + (paidForThis?.amount || 0);
        }, 0),
        [paymentsForDetailsEntry, customer.srNo]
    );

    const totalCdForThisEntry = useMemo(() =>
        paymentsForDetailsEntry.reduce((sum, p) => {
            if (!p.cdApplied || !p.cdAmount || !p.paidFor || p.paidFor.length === 0) {
                return sum;
            }
            const paidForThisDetail = p.paidFor.find(pf => pf.srNo === customer.srNo);
            if (!paidForThisDetail) return sum;

            const totalAmountInPayment = p.paidFor.reduce((s, i) => s + i.amount, 0);
            if (totalAmountInPayment > 0) {
                const proportion = paidForThisDetail.amount / totalAmountInPayment;
                return sum + (p.cdAmount * proportion);
            }
            return sum;
        }, 0),
        [paymentsForDetailsEntry, customer.srNo]
    );
    
    const finalOutstanding = (customer.originalNetAmount || 0) - totalPaidForThisEntry - totalCdForThisEntry;
    
    const isCustomer = entryType === 'Customer';

    const totalBagWeightKg = (customer.bags || 0) * (customer.bagWeightKg || 0);

    const displayBrokerageAmount = (Number(customer.weight) || 0) * (Number(customer.brokerageRate) || 0);
    const displayCdAmount = (Number(customer.amount) || 0) * ((Number(customer.cdRate) || 0) / 100);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center flex-shrink-0">
                    <div>
                        <DialogTitle className="text-base font-semibold">Details for SR No: {customer.srNo}</DialogTitle>
                    </div>
                    <DialogClose asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                    </DialogClose>
                </DialogHeader>
                <ScrollArea className="max-h-[85vh]">
                    <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                        <Card>
                            <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                                <div className="flex flex-col items-center justify-center space-y-2 p-4 bg-muted rounded-lg h-full">
                                    <p className="text-xs text-muted-foreground">SR No.</p>
                                    <p className="text-2xl font-bold font-mono text-primary">{customer.srNo}</p>
                                </div>
                                <Separator orientation="vertical" className="h-auto mx-4 hidden md:block" />
                                <Separator orientation="horizontal" className="w-full md:hidden" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 flex-1 text-sm">
                                    <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(customer.name)} />
                                    <DetailItem icon={<Phone size={14} />} label="Contact" value={customer.contact} />
                                    {!isCustomer && <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(customer.so || '')} />}
                                    {isCustomer && <DetailItem icon={<Briefcase size={14} />} label="Company Name" value={toTitleCase(customer.companyName || '')} />}
                                    <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(customer.date), "PPP")} />
                                    <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(customer.address)} className="col-span-1 sm:col-span-2" />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base">Transaction & Weight</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                        <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={customer.vehicleNo.toUpperCase()} />
                                        <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(customer.variety)} />
                                        <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={customer.paymentType} />
                                        {!isCustomer && <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(customer.dueDate), "PPP")} />}
                                        {isCustomer && <DetailItem icon={<Boxes size={14} />} label="Bags" value={customer.bags || 0} />}
                                    </div>
                                    <Separator />
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr className="[&_td]:p-1"><td className="text-muted-foreground">Gross Weight</td><td className="text-right font-semibold">{Number(customer.grossWeight || 0).toFixed(2)} Qtl</td></tr>
                                            <tr className="[&_td]:p-1"><td className="text-muted-foreground">Teir Weight (Less)</td><td className="text-right font-semibold">- {Number(customer.teirWeight || 0).toFixed(2)} Qtl</td></tr>
                                            <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold">Final Weight</td><td className="text-right font-bold">{Number(customer.weight || 0).toFixed(2)} Qtl</td></tr>
                                            {!isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Karta (Less) ({(customer.kartaPercentage || 0)}%)</td><td className="text-right font-semibold">- {Number(customer.kartaWeight || 0).toFixed(2)} Qtl</td></tr>}
                                            {isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Bag Weight (Less) ({(customer.bags || 0)} @ {Number(customer.bagWeightKg || 0).toFixed(2)}kg)</td><td className="text-right font-semibold">- {totalBagWeightKg.toFixed(2)} kg</td></tr>}
                                            <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold text-primary">Net Weight</td><td className="text-right font-bold text-primary">{Number(customer.netWeight || 0).toFixed(2)} Qtl</td></tr>
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr className="[&_td]:p-1"><td className="text-muted-foreground">Net Weight</td><td className="text-right font-semibold">{Number(customer.netWeight || 0).toFixed(2)} Qtl</td></tr>
                                            <tr className="[&_td]:p-1"><td className="text-muted-foreground">Rate</td><td className="text-right font-semibold">@ {formatCurrency(Number(customer.rate) || 0)}</td></tr>
                                            <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold">Total Amount</td><td className="text-right font-bold">{formatCurrency(Number(customer.amount) || 0)}</td></tr>
                                            {!isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Laboury (Less)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(Number(customer.labouryAmount) || 0)}</td></tr>}
                                            {!isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Kanta (Less)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(Number(customer.kanta) || 0)}</td></tr>}
                                            {!isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Karta (Less)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(Number(customer.kartaAmount) || 0)}</td></tr>}
                                            
                                            {isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Bag Amount ({(customer.bags || 0)} @ {formatCurrency(Number(customer.bagRate) || 0)})</td><td className="text-right font-semibold text-green-600">+ {formatCurrency(Number(customer.bagAmount) || 0)}</td></tr>}
                                            {isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Kanta</td><td className="text-right font-semibold text-green-600">+ {formatCurrency(Number(customer.kanta) || 0)}</td></tr>}
                                            {isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">CD (@{Number(customer.cdRate || customer.cd || 0).toFixed(2)}%)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(displayCdAmount || 0)}</td></tr>}
                                            {isCustomer && !customer.isBrokerageIncluded && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Brokerage (@{formatCurrency(Number(customer.brokerageRate || customer.brokerage) || 0)})</td><td className="text-right font-semibold text-destructive">- {formatCurrency(displayBrokerageAmount || 0)}</td></tr>}
                                            {isCustomer && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Advance/Freight</td><td className="text-right font-semibold text-green-600">+ {formatCurrency(Number(customer.advanceFreight) || 0)}</td></tr>}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <Card className="border-primary/50 bg-primary/5 text-center">
                            <CardContent className="p-3">
                                <p className="text-sm text-primary/80 font-medium">{isCustomer ? 'Original Receivable' : 'Original Payable'} Amount</p>
                                <p className="text-2xl font-bold text-primary/90 font-mono">{formatCurrency(Number(customer.originalNetAmount))}</p>
                                <Separator className="my-2"/>
                                <p className="text-sm text-destructive font-medium">{isCustomer ? 'Final Receivable' : 'Final Outstanding'} Amount</p>
                                <p className="text-3xl font-bold text-destructive font-mono">{formatCurrency(finalOutstanding)}</p>
                            </CardContent>
                        </Card>

                         <Card className="mt-4">
                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment Details</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    {paymentsForDetailsEntry.length > 0 ? (
                                        <Table className="text-sm">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="p-2 text-xs">Payment ID</TableHead>
                                                    <TableHead className="p-2 text-xs">Date</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">Total Paid Amount</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">CD</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">Actual Paid</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paymentsForDetailsEntry.map((payment, index) => {
                                                    const paidForThis = payment.paidFor?.find(pf => pf.srNo === customer?.srNo);
                                                    if (!paidForThis) return null;

                                                    let cdForThisEntry = 0;
                                                    if (payment.cdApplied && payment.cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                                                        const totalAmountInPayment = payment.paidFor.reduce((s: number, i: any) => s + i.amount, 0);
                                                        if (totalAmountInPayment > 0) {
                                                            const proportion = paidForThis.amount / totalAmountInPayment;
                                                            cdForThisEntry = payment.cdAmount * proportion;
                                                        }
                                                    }

                                                    const totalPaidAmountForEntry = paidForThis.amount;
                                                    const actualPaidForEntry = totalPaidAmountForEntry - cdForThisEntry;

                                                    return (
                                                        <TableRow key={payment.id || index}>
                                                            <TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell>
                                                            <TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                            <TableCell className="p-2 text-right font-semibold">{formatCurrency(totalPaidAmountForEntry)}</TableCell>
                                                            <TableCell className="p-2 text-right text-destructive">{formatCurrency(cdForThisEntry)}</TableCell>
                                                            <TableCell className="p-2 text-right font-bold text-green-600">{formatCurrency(actualPaidForEntry)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-center text-muted-foreground text-sm py-4">No payments have been applied to this entry yet.</p>
                                    )}
                                </CardContent>
                            </Card>  
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};


"use client";

import { useState } from "react";
import type { Customer, Payment } from "@/lib/definitions";
import { format } from "date-fns";
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Calendar as CalendarIcon, Scale, Calculator, Percent, Server, Milestone, CircleDollarSign, Weight, HandCoins, Printer } from "lucide-react";

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';

interface DetailsDialogProps {
    isOpen?: boolean;
    onOpenChange: (isOpen: boolean) => void;
    customer: Customer | null;
    paymentHistory?: Payment[];
    onPrint?: (customer: Customer) => void;
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

export const DetailsDialog = ({ isOpen, onOpenChange, customer, paymentHistory = [], onPrint }: DetailsDialogProps) => {
    const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');

    if (!customer) return null;
    
    const paymentsForDetailsEntry = paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === customer?.srNo)
    );
    
    return (
        <Dialog open={isOpen ?? !!customer} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                    <div>
                        <DialogTitle className="text-base font-semibold">Details for SR No: {customer.srNo}</DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {onPrint && (
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPrint(customer)}>
                                <Printer className="h-4 w-4" />
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8">
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuRadioGroup value={activeLayout} onValueChange={(v) => setActiveLayout(v as LayoutOption)}>
                                    <DropdownMenuRadioItem value="classic"><Rows3 className="mr-2 h-4 w-4" />Classic</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                        </DialogClose>
                    </div>
                </DialogHeader>
                <ScrollArea className="max-h-[85vh]">
                    <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                        {activeLayout === 'classic' && (
                        <div className="space-y-4">
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
                                        <DetailItem icon={<UserSquare size={14} />} label={customer.companyName ? "Company Name" : "S/O"} value={toTitleCase(customer.companyName || customer.so || '')} />
                                        <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(customer.date), "PPP")} />
                                        <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(customer.dueDate), "PPP")} />
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
                                        </div>
                                        <Separator />
                                        <Table className="text-xs">
                                            <TableBody>
                                                <tr className="[&_td]:p-1"><td className="text-muted-foreground">Gross Weight</td><td className="text-right font-semibold">{customer.grossWeight.toFixed(2)} kg</td></tr>
                                                <tr className="[&_td]:p-1"><td className="text-muted-foreground">Teir Weight (Less)</td><td className="text-right font-semibold">- {customer.teirWeight.toFixed(2)} kg</td></tr>
                                                <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold">Final Weight</td><td className="text-right font-bold">{customer.weight.toFixed(2)} kg</td></tr>
                                                <tr className="[&_td]:p-1"><td className="text-muted-foreground">Bag Weight (Less)</td><td className="text-right font-semibold">- {(Number(customer.bagWeightKg) || 0).toFixed(2)} kg</td></tr>
                                                <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold text-primary">Net Weight</td><td className="text-right font-bold text-primary">{customer.netWeight.toFixed(2)} kg</td></tr>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                                    <CardContent className="p-4 pt-0">
                                        <Table className="text-xs">
                                            <TableBody>
                                                <tr className="[&_td]:p-1"><td className="text-muted-foreground">Net Weight</td><td className="text-right font-semibold">{customer.netWeight.toFixed(2)} kg</td></tr>
                                                <tr className="[&_td]:p-1"><td className="text-muted-foreground">Rate</td><td className="text-right font-semibold">@ {formatCurrency(customer.rate)}</td></tr>
                                                <tr className="bg-muted/50 [&_td]:p-2"><td className="font-bold">Total Amount</td><td className="text-right font-bold">{formatCurrency(customer.amount)}</td></tr>
                                                {customer.bagAmount != null && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Bag Amount (@{formatCurrency(customer.bagRate || 0)})</td><td className="text-right font-semibold text-green-600">+ {formatCurrency(customer.bagAmount)}</td></tr>}
                                                {customer.kanta != null && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Kanta</td><td className="text-right font-semibold text-green-600">+ {formatCurrency(customer.kanta)}</td></tr>}
                                                {customer.cd != null && customer.cd > 0 && <tr className="[&_td]:p-1"><td className="text-muted-foreground">CD (@{customer.cdRate?.toFixed(2)}%)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(customer.cd)}</td></tr>}
                                                {customer.brokerage != null && customer.brokerage > 0 && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Brokerage (@{formatCurrency(customer.brokerageRate || 0)})</td><td className="text-right font-semibold text-destructive">- {formatCurrency(customer.brokerage)}</td></tr>}
                                                {customer.kartaAmount != null && customer.kartaAmount > 0 && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Karta (@{customer.kartaPercentage}%)</td><td className="text-right font-semibold text-destructive">- {formatCurrency(customer.kartaAmount)}</td></tr>}
                                                {customer.labouryAmount != null && customer.labouryAmount > 0 && <tr className="[&_td]:p-1"><td className="text-muted-foreground">Laboury (@{customer.labouryRate.toFixed(2)})</td><td className="text-right font-semibold text-destructive">- {formatCurrency(customer.labouryAmount)}</td></tr>}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-primary/50 bg-primary/5 text-center">
                                <CardContent className="p-3">
                                    <p className="text-sm text-primary/80 font-medium">Original Payable Amount</p>
                                    <p className="text-2xl font-bold text-primary/90 font-mono">{formatCurrency(Number(customer.originalNetAmount))}</p>
                                    <Separator className="my-2"/>
                                    <p className="text-sm text-destructive font-medium">Final Outstanding Amount</p>
                                    <p className="text-3xl font-bold text-destructive font-mono">{formatCurrency(Number(customer.netAmount))}</p>
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
                                                    <TableHead className="p-2 text-xs">Type</TableHead>
                                                    <TableHead className="p-2 text-xs">CD Applied</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">CD Amount</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">Amount Paid</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paymentsForDetailsEntry.map((payment, index) => {
                                                    const paidForThis = payment.paidFor?.find(pf => pf.srNo === customer?.srNo);
                                                    return (
                                                        <TableRow key={payment.id || index}>
                                                            <TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell>
                                                            <TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                            <TableCell className="p-2">{payment.type}</TableCell>
                                                            <TableCell className="p-2">{payment.cdApplied ? 'Yes' : 'No'}</TableCell>
                                                            <TableCell className="p-2 text-right">{formatCurrency(payment.cdAmount || 0)}</TableCell>
                                                            <TableCell className="p-2 text-right font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell>
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
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

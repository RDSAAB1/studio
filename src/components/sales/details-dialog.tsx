
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Customer, CustomerPayment, Payment } from "@/lib/definitions";
import { format } from "date-fns";
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Settings, X, Rows3, LayoutList, LayoutGrid, StepForward, User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Calendar as CalendarIcon, Scale, Calculator, Percent, Server, Milestone, CircleDollarSign, Weight, HandCoins, Printer, Boxes, Briefcase, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleDeletePaymentLogic } from "@/lib/payment-logic";
import { db } from "@/lib/database";

interface DetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    customer: Customer | null;
    paymentHistory?: (Payment | CustomerPayment)[];
    entryType?: 'Supplier' | 'Customer';
    onEditEntry?: (customer: Customer) => void;
    onEditPayment?: (payment: Payment | CustomerPayment) => void;
    onDeletePayment?: (payment: Payment | CustomerPayment) => void;
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

export const DetailsDialog = ({ isOpen, onOpenChange, customer, paymentHistory, entryType = 'Supplier', onEditEntry, onEditPayment, onDeletePayment }: DetailsDialogProps) => {
    const router = useRouter();
    const { toast } = useToast();
    const [paymentToDelete, setPaymentToDelete] = useState<Payment | CustomerPayment | null>(null);

    // All hooks must be called before any conditional returns
    const paymentsForDetailsEntry = useMemo(() => {
        if (!customer) return [];
        return (paymentHistory || []).filter(p => p.paidFor?.some(pf => pf.srNo === customer.srNo));
    }, [paymentHistory, customer?.srNo]);

    const totalPaidForThisEntry = useMemo(() => {
        if (!customer) return 0;
        return paymentsForDetailsEntry.reduce((sum, p) => {
            const paidForThis = p.paidFor?.find(pf => pf.srNo === customer.srNo);
            
            if (!paidForThis) return sum;

            // paidForThis.amount IS the actual paid amount (To Be Paid amount)
            // This is the actual payment amount, NOT (To Be Paid - CD)
            return sum + paidForThis.amount;
        }, 0);
    }, [paymentsForDetailsEntry, customer?.srNo]);

    const totalCdForThisEntry = useMemo(() => {
        if (!customer) return 0;
        return paymentsForDetailsEntry.reduce((sum, p) => {
            const paidForThisDetail = p.paidFor?.find(pf => pf.srNo === customer.srNo);
            if (!paidForThisDetail) return sum;

            // First check if CD amount is directly stored in paidFor (new format - more accurate)
            if ('cdAmount' in paidForThisDetail && paidForThisDetail.cdAmount !== undefined && paidForThisDetail.cdAmount !== null) {
                return sum + Number(paidForThisDetail.cdAmount || 0);
            }
            
            // Fallback to proportional calculation for old payments (check cdAmount even if cdApplied is not set)
            if ((p as any).cdAmount && p.paidFor && p.paidFor.length > 0) {
                const totalAmountInPayment = p.paidFor.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
                if (totalAmountInPayment > 0) {
                    const proportion = Number(paidForThisDetail.amount || 0) / totalAmountInPayment;
                    return sum + Math.round((p as any).cdAmount * proportion * 100) / 100;
                }
            }
            return sum;
        }, 0);
    }, [paymentsForDetailsEntry, customer?.srNo]);

    // Calculate adjusted original and extra amount from Gov. payments
    const { adjustedOriginal, totalExtraAmount, govPaymentDetails } = useMemo(() => {
        if (!customer) return { adjustedOriginal: 0, totalExtraAmount: 0, govPaymentDetails: null };
        
        let adjustedOriginal = customer.originalNetAmount || 0;
        let totalExtraAmount = 0;
        let govPaymentDetails: Payment | null = null;

        // Find Gov. payment for this entry
        const govPayment = paymentsForDetailsEntry.find(p => 
            (p as any).receiptType === 'Gov.' && 
            p.paidFor?.some(pf => pf.srNo === customer.srNo)
        );

        if (govPayment) {
            govPaymentDetails = govPayment as Payment;
            const paidForThisEntry = govPayment.paidFor?.find(pf => pf.srNo === customer.srNo);
            
            // Check for adjustedOriginal first (most reliable)
            if (paidForThisEntry && paidForThisEntry.adjustedOriginal !== undefined) {
                adjustedOriginal = paidForThisEntry.adjustedOriginal;
                totalExtraAmount = adjustedOriginal - (customer.originalNetAmount || 0);
            } else if (paidForThisEntry && paidForThisEntry.extraAmount !== undefined) {
                // Fallback: Use extraAmount to calculate adjustedOriginal
                totalExtraAmount = paidForThisEntry.extraAmount || 0;
                adjustedOriginal = (customer.originalNetAmount || 0) + totalExtraAmount;
            } else if ((govPayment as any).extraAmount !== undefined) {
                // Fallback: Check payment-level extraAmount
                totalExtraAmount = (govPayment as any).extraAmount || 0;
                adjustedOriginal = (customer.originalNetAmount || 0) + totalExtraAmount;
            }
        }

        return { adjustedOriginal, totalExtraAmount, govPaymentDetails };
    }, [paymentsForDetailsEntry, customer]);
    
    // Calculate derived values (not hooks, so safe to be after early return check)
    // Outstanding = Adjusted Original - Total Paid - Total CD
    const finalOutstanding = customer ? adjustedOriginal - totalPaidForThisEntry - totalCdForThisEntry : 0;
    const isCustomer = entryType === 'Customer';
    const totalBagWeightKg = customer ? (customer.bags || 0) * (customer.bagWeightKg || 0) : 0;
    // Calculate brokerage amount: Final Weight × Brokerage Rate (for both suppliers and customers)
    const displayBrokerageAmount = customer ? 
        (Number(customer.weight || 0)) * (Number(customer.brokerageRate || 0)) : 0;
    const displayCdAmount = customer ? (Number(customer.amount || 0)) * ((Number(customer.cdRate || 0)) / 100) : 0;

    // Early return after all hooks
    if (!customer) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <DialogTitle className="text-base font-semibold">Details for SR No: {customer.srNo}</DialogTitle>
                        {!isCustomer && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                    if (onEditEntry) {
                                        onEditEntry(customer);
                                        onOpenChange(false);
                                    } else {
                                        // Navigate to supplier entry page with customer data
                                        localStorage.setItem('editSupplierData', JSON.stringify(customer));
                                        router.push('/sales/supplier-entry');
                                        onOpenChange(false);
                                        toast({
                                            title: "Navigating to Supplier Entry",
                                            description: `Loading ${customer.name} (SR# ${customer.srNo}) for editing...`,
                                        });
                                    }
                                }}
                            >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Edit Entry
                            </Button>
                        )}
                    </div>
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
                                            {!isCustomer && (customer.brokerageRate || displayBrokerageAmount > 0) && (
                                                <tr className="[&_td]:p-1">
                                                    <td className="text-muted-foreground">
                                                        Brokerage ({customer.brokerageAddSubtract ? 'INCLUDE' : 'EXCLUDE'}) (@{formatCurrency(Number(customer.brokerageRate) || 0)})
                                                    </td>
                                                    <td className={`text-right font-semibold ${customer.brokerageAddSubtract ? 'text-green-600' : 'text-destructive'}`}>
                                                        {customer.brokerageAddSubtract ? '+ ' : '- '}{formatCurrency(displayBrokerageAmount || customer.brokerageAmount || 0)}
                                                    </td>
                                                </tr>
                                            )}
                                            
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
                            <CardContent className="p-3 space-y-2">
                                <div>
                                    <p className="text-xs text-muted-foreground">Base Original Amount</p>
                                    <p className="text-lg font-semibold text-primary/90 font-mono">{formatCurrency(Number(customer.originalNetAmount))}</p>
                                </div>
                                {totalExtraAmount > 0 && (
                                    <div className="pt-1">
                                        <p className="text-xs text-muted-foreground">Extra Amount (Gov. Payment)</p>
                                        <p className="text-lg font-semibold text-green-600 font-mono">+ {formatCurrency(totalExtraAmount)}</p>
                                    </div>
                                )}
                                <Separator className="my-2"/>
                                <div>
                                    <p className="text-sm text-primary/80 font-medium">{isCustomer ? 'Adjusted Original Receivable' : 'Adjusted Original Payable'} Amount</p>
                                    <p className="text-2xl font-bold text-primary/90 font-mono">{formatCurrency(adjustedOriginal)}</p>
                                </div>
                                <Separator className="my-2"/>
                                <div>
                                    <p className="text-sm text-destructive font-medium">{isCustomer ? 'Final Receivable' : 'Final Outstanding'} Amount</p>
                                    <p className="text-3xl font-bold text-destructive font-mono">{formatCurrency(finalOutstanding)}</p>
                                </div>
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
                                                    <TableHead className="p-2 text-xs text-right">Paid Amount</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">CD</TableHead>
                                                    <TableHead className="p-2 text-xs text-right">Total Settled</TableHead>
                                                    <TableHead className="p-2 text-xs text-center">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paymentsForDetailsEntry.map((payment, index) => {
                                                    const paidForThis = payment.paidFor?.find(pf => pf.srNo === customer?.srNo);
                                                    if (!paidForThis) return null;

                                                    let cdForThisEntry = 0;
                                                    // First check if CD amount is directly stored in paidFor (new format - more accurate)
                                                    if ('cdAmount' in paidForThis && paidForThis.cdAmount !== undefined && paidForThis.cdAmount !== null) {
                                                        cdForThisEntry = Number(paidForThis.cdAmount || 0);
                                                    } else if ((payment as any).cdAmount && payment.paidFor && payment.paidFor.length > 0) {
                                                        // Fallback to proportional calculation for old payments (check cdAmount even if cdApplied is not set)
                                                        const totalAmountInPayment = payment.paidFor.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
                                                        if (totalAmountInPayment > 0) {
                                                            const proportion = Number(paidForThis.amount || 0) / totalAmountInPayment;
                                                            cdForThisEntry = Math.round((payment as any).cdAmount * proportion * 100) / 100;
                                                        }
                                                    }

                                                    // paidForThis.amount IS the actual paid amount (To Be Paid amount)
                                                    // It's NOT (To Be Paid - CD), it's the actual payment amount
                                                    const actualPaidForEntry = paidForThis.amount; // This is the To Be Paid / Actual Paid amount
                                                    const settledAmountForEntry = actualPaidForEntry + cdForThisEntry; // Total settled = Paid + CD
                                                    
                                                    // Get extra amount for this payment (if Gov. payment)
                                                    const extraAmountForThisPayment = (paidForThis as any).extraAmount || 0;
                                                    const isGovPayment = (payment as any).receiptType === 'Gov.';

                                                    return (
                                                        <TableRow key={payment.id || index}>
                                                            <TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell>
                                                            <TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                            <TableCell className="p-2">
                                                                {payment.type}
                                                                {isGovPayment && extraAmountForThisPayment > 0 && (
                                                                    <span className="ml-1 text-xs text-green-600" title={`Extra Amount: ${formatCurrency(extraAmountForThisPayment)}`}>
                                                                        (Gov.)
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="p-2 text-right font-bold text-green-600">{formatCurrency(actualPaidForEntry)}</TableCell>
                                                            <TableCell className="p-2 text-right text-blue-600">{formatCurrency(cdForThisEntry)}</TableCell>
                                                            <TableCell className="p-2 text-right font-semibold">{formatCurrency(settledAmountForEntry)}</TableCell>
                                                            <TableCell className="p-2">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                                                                        onClick={() => {
                                                                            if (onEditPayment) {
                                                                                onEditPayment(payment);
                                                                                onOpenChange(false);
                                                                            } else {
                                                                                // Navigate to supplier payments page with payment data
                                                                                localStorage.setItem('editPaymentData', JSON.stringify(payment));
                                                                                router.push('/sales/supplier-payments');
                                                                                onOpenChange(false);
                                                                                toast({
                                                                                    title: "Navigating to Payments",
                                                                                    description: `Loading payment ${payment.paymentId || payment.id} for editing...`,
                                                                                });
                                                                            }
                                                                        }}
                                                                        title="Edit Payment"
                                                                    >
                                                                        <Edit2 className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                                                        onClick={() => setPaymentToDelete(payment)}
                                                                        title="Delete Payment"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
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
            
            {/* Delete Payment Confirmation Dialog */}
            <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete payment {paymentToDelete?.paymentId || paymentToDelete?.id}? 
                            This action cannot be undone and will remove this payment from the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={async () => {
                                if (paymentToDelete && paymentToDelete.id) {
                                    try {
                                        if (onDeletePayment) {
                                            onDeletePayment(paymentToDelete);
                                        } else {
                                            // Get all suppliers for the delete logic
                                            const allSuppliers = await db.suppliers.toArray();
                                            await handleDeletePaymentLogic(paymentToDelete as any, allSuppliers);
                                            toast({
                                                title: "Payment Deleted",
                                                description: `Payment ${paymentToDelete.paymentId || paymentToDelete.id} has been deleted successfully.`,
                                                variant: "success",
                                            });
                                        }
                                        setPaymentToDelete(null);
                                        onOpenChange(false);
                                    } catch (error) {
                                        console.error('Error deleting payment:', error);
                                        toast({
                                            title: "Error",
                                            description: "Failed to delete payment. Please try again.",
                                            variant: "destructive",
                                        });
                                    }
                                }
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
};

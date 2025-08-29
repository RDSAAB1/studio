
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import { Banknote, Percent, Calendar as CalendarIcon, Receipt, Hash, Info } from "lucide-react";

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className="flex items-start gap-3">
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);

export const PaymentDetailsDialog = ({ payment, suppliers, onOpenChange, onShowEntryDetails }: any) => {
    if (!payment) return null;

    return (
        <Dialog open={!!payment} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Payment Details: {payment.paymentId}</DialogTitle>
                <DialogDescription>Details of the payment made on {format(new Date(payment.date), "PPP")}.</DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <DetailItem icon={<Banknote size={14} />} label="Amount Paid" value={formatCurrency(payment.amount)} />
                <DetailItem icon={<Percent size={14} />} label="CD Amount" value={formatCurrency(payment.cdAmount)} />
                <DetailItem icon={<CalendarIcon size={14} />} label="Payment Type" value={payment.type} />
                <DetailItem icon={<Receipt size={14} />} label="Payment Method" value={payment.receiptType} />
                <DetailItem icon={<Hash size={14} />} label="CD Applied" value={payment.cdApplied ? "Yes" : "No"} />
              </div>
              <h4 className="font-semibold text-sm">Entries Paid in this Transaction</h4>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader><TableRow><TableHead>SR No</TableHead><TableHead>Supplier Name</TableHead><TableHead className="text-right">Amount Paid</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {payment.paidFor?.map((pf: any, index: number) => {
                            const supplier = suppliers.find((s: any) => s.srNo === pf.srNo);
                            return (
                                <TableRow key={index}>
                                    <TableCell>{pf.srNo}</TableCell>
                                    <TableCell>{supplier ? toTitleCase(supplier.name) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(pf.amount)}</TableCell>
                                    <TableCell className="text-center">
                                       {supplier && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onShowEntryDetails(supplier); onOpenChange(false); }}><Info className="h-4 w-4" /></Button>}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              </div>
            </DialogContent>
        </Dialog>
    );
};

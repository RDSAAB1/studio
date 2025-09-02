
"use client";

import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';

export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);

    const handleCopy = () => {
        if (tableRef.current) {
            const tableHtml = tableRef.current.outerHTML;
            const type = "text/html";
            const blob = new Blob([tableHtml], { type });
            const data = [new ClipboardItem({ [type]: blob })];

            navigator.clipboard.write(data).then(
                () => {
                    toast({ title: "Table copied to clipboard!", variant: "success" });
                },
                (err) => {
                    console.error("Failed to copy table: ", err);
                    toast({ title: "Failed to copy table", variant: "destructive" });
                }
            );
        }
    };
    
    const handleMail = () => {
        if (tableRef.current) {
            const tableHtml = `
                <p>Dear Sir/Madam,</p>
                <p>Please process the following RTGS payments:</p>
                <br/>
                ${tableRef.current.outerHTML}
                <br/>
                <p>Thank you,</p>
                <p>${settings.companyName}</p>
            `;
            const subject = "RTGS Payment Request";
            const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(tableHtml)}`;
            window.location.href = mailtoLink;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Bank Mail Format</DialogTitle>
                    <DialogDescription>
                        This format is optimized for copying to Excel or emailing directly to the bank for faster processing.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] border rounded-lg">
                    <Table ref={tableRef} className="bg-white">
                        <TableHeader className="bg-yellow-300">
                            <TableRow>
                                <TableHead className="text-black font-bold border">Sr.No</TableHead>
                                <TableHead className="text-black font-bold border">Debit_Ac_No</TableHead>
                                <TableHead className="text-black font-bold border">Amount</TableHead>
                                <TableHead className="text-black font-bold border">IFSC_Code</TableHead>
                                <TableHead className="text-black font-bold border">Credit_Ac_No</TableHead>
                                <TableHead className="text-black font-bold border">Beneficiary_Name</TableHead>
                                <TableHead className="text-black font-bold border">Scheme Type</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((p: any, index: number) => (
                                <TableRow key={p.paymentId || index}>
                                    <TableCell className="border">{p.srNo}</TableCell>
                                    <TableCell className="border">{settings.accountNo}</TableCell>
                                    <TableCell className="border">{p.amount}</TableCell>
                                    <TableCell className="border">{p.ifscCode}</TableCell>
                                    <TableCell className="border">{p.acNo}</TableCell>
                                    <TableCell className="border">{toTitleCase(p.supplierName)}</TableCell>
                                    <TableCell className="border">{p.type}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onOpenChange}>Close</Button>
                    <div className="flex-grow" />
                    <Button variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" /> Copy Table</Button>
                    <Button onClick={handleMail}><Mail className="mr-2 h-4 w-4" /> Mail to Bank</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

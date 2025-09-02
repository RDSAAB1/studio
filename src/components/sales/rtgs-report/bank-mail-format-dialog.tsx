
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
            // Construct the full HTML to be copied, including the greeting and closing.
            const mailBodyHtml = `
                <p>Dear Sir/Madam,</p>
                <p>Please process the following RTGS payments:</p>
                <br/>
                ${tableRef.current.outerHTML}
                <br/>
                <p>Thank you,</p>
                <p>${settings.companyName}</p>
            `;

            const type = "text/html";
            const blob = new Blob([mailBodyHtml], { type });
            const data = [new ClipboardItem({ [type]: blob })];

            navigator.clipboard.write(data).then(
                () => {
                    toast({ title: "Content copied to clipboard!", description: "You can now paste this into your email.", variant: "success" });
                },
                (err) => {
                    console.error("Failed to copy table: ", err);
                    toast({ title: "Failed to copy content", variant: "destructive" });
                }
            );
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
                        <TableHeader>
                            <TableRow style={{ backgroundColor: '#FCD34D' }}>
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
                                    <TableCell className="border text-black">{p.srNo}</TableCell>
                                    <TableCell className="border text-black">{settings.accountNo}</TableCell>
                                    <TableCell className="border text-black">{p.amount}</TableCell>
                                    <TableCell className="border text-black">{p.ifscCode}</TableCell>
                                    <TableCell className="border text-black">{p.acNo}</TableCell>
                                    <TableCell className="border text-black">{toTitleCase(p.supplierName)}</TableCell>
                                    <TableCell className="border text-black">{p.type}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <div className="flex-grow" />
                    <Button onClick={handleCopy}><Copy className="mr-2 h-4 w-4" /> Copy for Mail</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


"use client";

import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);

    const handleExportAndMail = () => {
        if (payments.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        // 1. Prepare and download the Excel file
        const dataToExport = payments.map((p: any) => ({
            'Sr.No': p.srNo,
            'Debit_Ac_No': settings.accountNo,
            'Amount': p.amount,
            'IFSC_Code': p.ifscCode,
            'Credit_Ac_No': p.acNo,
            'Beneficiary_Name': toTitleCase(p.supplierName),
            'Scheme Type': p.type
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RTGS Report");

        worksheet['!cols'] = [
            { wch: 10 }, // Sr.No
            { wch: 20 }, // Debit_Ac_No
            { wch: 15 }, // Amount
            { wch: 15 }, // IFSC_Code
            { wch: 20 }, // Credit_Ac_No
            { wch: 30 }, // Beneficiary_Name
            { wch: 15 }  // Scheme Type
        ];
        
        const today = format(new Date(), 'yyyy-MM-dd');
        XLSX.writeFile(workbook, `RTGS_Report_${today}.xlsx`);
        
        toast({ title: "Excel file downloaded!", description: "You can now attach it to your email.", variant: "success" });

        // 2. Open Gmail in a new tab with pre-filled details
        const bankEmail = "your.bank.email@example.com"; // Replace with actual bank email or make it a setting
        const subject = encodeURIComponent(`RTGS Payment Advice - ${settings.companyName} - ${today}`);
        const body = encodeURIComponent(
          `Dear Team,\n\nPlease find the attached RTGS payment advice for today, ${today}.\n\nThank you,\n${settings.companyName}`
        );
        
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${bankEmail}&su=${subject}&body=${body}`;
        
        window.open(gmailUrl, '_blank');
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Bank Mail Format</DialogTitle>
                    <DialogDescription>
                        This format is optimized for emailing to the bank. Download the Excel file and attach it to the pre-filled email.
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
                    <Button onClick={handleExportAndMail}><Download className="mr-2 h-4 w-4" /> Download & Open Mail</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


"use client";

import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download } from 'lucide-react';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const BankMailFormatDialog2 = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);

    // Guard clause to prevent rendering with incomplete data
    if (!isOpen || !payments || !settings) {
        return null;
    }

    const handleDownloadExcel = () => {
        if (payments.length === 0 || !settings?.defaultBank) {
            toast({ title: "No data or settings to export", variant: "destructive" });
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // --- Create Data for the Sheet ---
        
        // Header
        const header = [
            ["GURU KRIPA AGRO FOODS"],
            [settings.defaultBank.bankName],
            [settings.defaultBank.branchName],
            [`A/C.NO..${settings.defaultBank.accountNumber}`],
            [], // Spacer row
        ];
        
        const dateHeader = [
            ['', '', '', '', 'DATE', format(new Date(), 'dd-MM-yyyy')]
        ];

        // Table Header
        const tableHeader = [ "S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK" ];
        
        // Table Body
        const tableBody = payments.map((p: any, index: number) => ([
            index + 1,
            toTitleCase(p.supplierName),
            `'${p.acNo}`, // Prepend with ' to treat as text
            p.ifscCode,
            p.amount,
            toTitleCase(p.supplierAddress || ''),
            p.bank,
        ]));
        
        const grandTotalAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

        // Footer
        const footer = [
            [],[],[],[],[],[],[],[],[],[], // Spacer rows to push footer down
            ["PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"],
            [],
            ['', '', '', '', '', 'GT', grandTotalAmount],
        ];

        // --- Create Worksheet and Add Data ---
        const ws = XLSX.utils.aoa_to_sheet([]);
        
        // Append all parts
        XLSX.utils.sheet_add_aoa(ws, header, { origin: "A1" });
        XLSX.utils.sheet_add_aoa(ws, dateHeader, { origin: "A5" });
        XLSX.utils.sheet_add_aoa(ws, [tableHeader], { origin: "A7" });
        XLSX.utils.sheet_add_aoa(ws, tableBody, { origin: "A8" });
        XLSX.utils.sheet_add_aoa(ws, footer, { origin: "A20" });

        // --- Styling (Column Widths) ---
        ws['!cols'] = [
            { wch: 5 },  // S.N
            { wch: 20 }, // Name
            { wch: 20 }, // Account no
            { wch: 15 }, // IFCS Code
            { wch: 15 }, // Amount
            { wch: 20 }, // Place
            { wch: 20 }, // BANK
        ];

        // --- Append worksheet to workbook and download ---
        XLSX.utils.book_append_sheet(wb, ws, "RTGS Format 2");
        const filename = `RTGS_Report_Format2_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        XLSX.writeFile(wb, filename);

        toast({ title: "Excel file downloading...", variant: "success" });
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Bank Mail Format 2 Preview</DialogTitle>
                    <DialogDescription>
                        This is a preview of the custom Excel format for bank payments.
                    </DialogDescription>
                </DialogHeader>
                <div ref={printRef} className="p-4 border rounded-lg bg-gray-50">
                    <div className="grid grid-cols-7 gap-4">
                        <div className="col-span-4">
                             <p className="font-bold text-lg">GURU KRIPA AGRO FOODS</p>
                             <p>{settings?.defaultBank?.bankName}</p>
                             <p>{settings?.defaultBank?.branchName}</p>
                             <p>A/C.NO..{settings?.defaultBank?.accountNumber}</p>
                        </div>
                        <div className="col-span-3 text-right">
                             <p><span className="font-bold">DATE</span> {format(new Date(), 'dd-MM-yyyy')}</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-1 text-left">S.N</th>
                                    <th className="p-1 text-left">Name</th>
                                    <th className="p-1 text-left">Account no</th>
                                    <th className="p-1 text-left">IFCS Code</th>
                                    <th className="p-1 text-right">Amount</th>
                                    <th className="p-1 text-left">Place</th>
                                    <th className="p-1 text-left">BANK</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p: any, index: number) => (
                                    <tr key={index} className="border-b">
                                        <td className="p-1">{index + 1}</td>
                                        <td className="p-1">{toTitleCase(p.supplierName)}</td>
                                        <td className="p-1">{p.acNo}</td>
                                        <td className="p-1">{p.ifscCode}</td>
                                        <td className="p-1 text-right">{formatCurrency(p.amount)}</td>
                                        <td className="p-1">{toTitleCase(p.supplierAddress || '')}</td>
                                        <td className="p-1">{p.bank}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                 <tr>
                                    <td colSpan={7} className="pt-8 text-sm">PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -</td>
                                 </tr>
                                 <tr className="font-bold">
                                    <td colSpan={5} className="p-1 text-right">GT</td>
                                    <td colSpan={2} className="p-1 text-left">{formatCurrency(payments.reduce((sum: number, p: any) => sum + p.amount, 0))}</td>
                                 </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button onClick={handleDownloadExcel}><Download className="mr-2 h-4 w-4" /> Download Excel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


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

    // Guard clause to prevent rendering with incomplete data
    if (!isOpen || !payments || !settings) {
        return null;
    }

    const bankToUse = settings.defaultBank || {
        bankName: settings.bankName,
        branchName: settings.branchName,
        accountNumber: settings.accountNo,
    };
    
    const companyName = settings.companyName || "GURU KRIPA AGRO FOODS";

    const handleDownloadExcel = () => {
        if (payments.length === 0 || !bankToUse) {
            toast({ title: "No data or settings to export", variant: "destructive" });
            return;
        }

        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // --- Create Data for the Sheet ---
        const ws_data = [
            [companyName],
            [bankToUse.bankName],
            [bankToUse.branchName],
            [`A/C.NO..${bankToUse.accountNumber}`],
            [],
            ['', '', '', '', 'DATE', format(new Date(), 'dd-MM-yyyy')],
            [],
            [ "S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK" ]
        ];

        const grandTotalAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0);

        payments.forEach((p: any, index: number) => {
            ws_data.push([
                index + 1,
                toTitleCase(p.supplierName),
                `'${p.acNo}`, // Prepend with ' to treat as text
                p.ifscCode,
                p.amount,
                toTitleCase(p.supplierAddress || ''),
                p.bank,
            ]);
        });
        
        // Add empty rows to reach the footer
        const emptyRowsNeeded = Math.max(0, 19 - ws_data.length);
        for(let i=0; i<emptyRowsNeeded; i++) {
            ws_data.push([]);
        }

        ws_data.push(["PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"]);
        ws_data.push([]); // Spacer before GT
        ws_data.push(['', '', '', '', '', 'GT', grandTotalAmount]);

        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        
        // --- Styling (Column Widths) ---
        ws['!cols'] = [
            { wch: 5 },  // S.N
            { wch: 25 }, // Name
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
                <div className="p-4 border rounded-lg bg-gray-50 text-black">
                    <div className="grid grid-cols-7 gap-4">
                        <div className="col-span-4">
                             <p className="font-bold text-lg">{companyName}</p>
                             <p>{bankToUse?.bankName}</p>
                             <p>{bankToUse?.branchName}</p>
                             <p>A/C.NO..{bankToUse?.accountNumber}</p>
                        </div>
                        <div className="col-span-3 text-right">
                             <p><span className="font-bold">DATE</span> {format(new Date(), 'dd-MM-yyyy')}</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <table className="w-full text-sm table-auto border-collapse">
                            <thead>
                                <tr className="border-b border-black">
                                    <th className="p-1 text-left border border-black">S.N</th>
                                    <th className="p-1 text-left border border-black">Name</th>
                                    <th className="p-1 text-left border border-black">Account no</th>
                                    <th className="p-1 text-left border border-black">IFCS Code</th>
                                    <th className="p-1 text-right border border-black">Amount</th>
                                    <th className="p-1 text-left border border-black">Place</th>
                                    <th className="p-1 text-left border border-black">BANK</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p: any, index: number) => (
                                    <tr key={`${p.paymentId}-${index}`} className="border-b border-black">
                                        <td className="p-1 border border-black">{index + 1}</td>
                                        <td className="p-1 border border-black">{toTitleCase(p.supplierName)}</td>
                                        <td className="p-1 border border-black font-mono">{p.acNo}</td>
                                        <td className="p-1 border border-black font-mono">{p.ifscCode}</td>
                                        <td className="p-1 text-right border border-black">{formatCurrency(p.amount)}</td>
                                        <td className="p-1 border border-black">{toTitleCase(p.supplierAddress || '')}</td>
                                        <td className="p-1 border border-black">{p.bank}</td>
                                    </tr>
                                ))}
                                {/* Empty rows for consistent layout */}
                                {Array.from({ length: Math.max(0, 19 - 7 - payments.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-b border-black h-7"><td className="border border-black" colSpan={7}></td></tr>
                                ))}
                            </tbody>
                            <tfoot>
                                 <tr className="border-b border-black">
                                    <td colSpan={7} className="pt-8 text-sm border border-black p-1">PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -</td>
                                 </tr>
                                 <tr className="font-bold border-b border-black h-7">
                                    <td colSpan={7} className="border border-black"></td>
                                 </tr>
                                 <tr className="font-bold border-b border-black">
                                    <td colSpan={5} className="p-1 text-right border-r border-black"></td>
                                    <td className="p-1 border-r border-black">GT</td>
                                    <td className="p-1">{formatCurrency(payments.reduce((sum: number, p: any) => sum + p.amount, 0))}</td>
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

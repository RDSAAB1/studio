
"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Mail, Loader2, Paperclip, X } from 'lucide-react';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { sendEmailWithAttachment } from '@/lib/actions';
import { getFirebaseAuth } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Attachment {
    filename: string;
    buffer: number[];
    contentType: string;
}

export const BankMailFormatDialog2 = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isPreview, setIsPreview] = useState(true);
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    useEffect(() => {
        if (isOpen) {
            setIsPreview(true); // Reset to preview mode every time dialog opens
            if (settings && payments) {
                const today = format(new Date(), 'dd-MMM-yyyy');
                const subject = `RTGS Payment Advice - ${settings.companyName} - ${today}`;
                const body = `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}, attached with this email.\n\nThank you,\n${settings.companyName}`;
                
                setEmailData({ to: 'your.bank.email@example.com', subject, body });

                // Generate Excel buffer for attachment
                const excelBuffer = generateExcelBuffer();
                if (excelBuffer) {
                    setAttachments([excelBuffer]);
                }
            }
        }
    }, [isOpen, settings, payments]);

    const generateExcelBuffer = (): Attachment | null => {
        if (!payments || payments.length === 0 || !settings) return null;
    
        const bankToUse = settings.defaultBank || { bankName: settings.bankName, branchName: settings.branchName, accountNumber: settings.accountNo };
        const companyName = settings.companyName || "GURU KRIPA AGRO FOODS";
        const today = format(new Date(), 'dd-MM-yyyy');
        const filename = `RTGS_Report_Format2_${today}.xlsx`;
    
        const ws_data: (string | number | Date | null)[][] = [
            [], // Row 1
            [], // Row 2
            [null, null, null, null, 'DATE', today], // Row 3
            [null, companyName], // Row 4
            [null, `BoB - ${bankToUse.bankName}`], // Row 5
            [null, bankToUse.branchName], // Row 6
            [null, `A/C.NO..${bankToUse.accountNumber}`], // Row 7
            [], // Row 8
            ["S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK"] // Row 9
        ];
    
        payments.forEach((p: any, index: number) => {
            ws_data.push([
                index + 1, toTitleCase(p.supplierName), `'${p.acNo}`, p.ifscCode,
                p.amount, toTitleCase(p.supplierAddress || p.branch || ''), p.bank,
            ]);
        });
        
        const footerStartIndex = ws_data.length;
        while (ws_data.length < footerStartIndex + 4) {
            ws_data.push([]);
        }
        
        ws_data.push([null, "PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"]);
        ws_data.push([]);
        
        const grandTotal = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        ws_data.push([null, null, null, null, 'GT', grandTotal]);
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
        ws['!cols'] = [ { wch: 8 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 } ];
        
        const borderStyle = { style: "thin", color: { auto: 1 } };
        const allBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        
        const tableStartRow = 8;
        const tableEndRow = tableStartRow + payments.length;
    
        for (let R = tableStartRow; R <= tableEndRow; ++R) {
            for (let C = 0; C < 7; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) ws[cell_ref] = { t: 's', v: '' };
                ws[cell_ref].s = { ...ws[cell_ref].s, border: allBorders };
            }
        }
    
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "RTGS Format 2");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    
        return {
            filename,
            buffer: Array.from(new Uint8Array(excelBuffer)),
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
    };

    const handleDownloadExcel = () => {
        const excelAttachment = attachments.find(att => att.filename.endsWith('.xlsx'));
        if (!excelAttachment) {
            toast({ title: "Excel file not generated", variant: "destructive" });
            return;
        }
        const blob = new Blob([new Uint8Array(excelAttachment.buffer)], { type: excelAttachment.contentType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = excelAttachment.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Excel file downloading...", variant: "success" });
    };
    
    const handlePrint = () => {
        const node = printRef.current;
        if (!node) return;
        // Print logic similar to other components
    };

    const handleSendMail = async () => {
        // Mail sending logic...
    };

    if (!isOpen || !payments || !settings) {
        return null;
    }
    
    const bankToUse = settings.defaultBank || { bankName: settings.bankName, branchName: settings.branchName, accountNumber: settings.accountNo };
    const companyName = settings.companyName || "GURU KRIPA AGRO FOODS";

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
                 <DialogHeader className="p-4 border-b">
                    <DialogTitle>Bank Mail Format 2</DialogTitle>
                    <DialogDescription>
                        Preview, download, or email the custom Excel format for bank payments.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow p-4">
                    <div ref={printRef}>
                         <div className="p-4 text-black text-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="font-bold text-lg">{companyName}</p>
                                    <p>BoB - {bankToUse?.bankName}</p>
                                    <p>{bankToUse?.branchName}</p>
                                    <p>A/C.NO..{bankToUse?.accountNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p><span className="font-bold">DATE</span></p>
                                    <p>{format(new Date(), 'dd-MM-yyyy')}</p>
                                </div>
                            </div>
                            
                            <div>
                                <table className="w-full table-auto border-collapse border border-black">
                                    <thead className="font-bold">
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
                                                <td className="p-1 border border-black font-mono">{`'${p.acNo}`}</td>
                                                <td className="p-1 border border-black font-mono">{p.ifscCode}</td>
                                                <td className="p-1 text-right border border-black">{p.amount.toFixed(2)}</td>
                                                <td className="p-1 border border-black">{toTitleCase(p.supplierAddress || p.branch || '')}</td>
                                                <td className="p-1 border border-black">{p.bank}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={7} className="pt-8 p-1 border-b border-t border-black">PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -</td>
                                        </tr>
                                        <tr className="font-bold">
                                            <td colSpan={4} className="p-1"></td>
                                            <td className="p-1 text-right">GT</td>
                                            <td className="p-1 text-right font-semibold">{formatCurrency(payments.reduce((sum: number, p: any) => sum + p.amount, 0))}</td>
                                            <td className="p-1"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button variant="secondary" onClick={handleDownloadExcel}><Download className="mr-2 h-4 w-4" /> Download Excel</Button>
                    <Button variant="secondary" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                    <Button onClick={() => alert("Compose mail feature coming soon!")}><Mail className="mr-2 h-4 w-4" /> Compose Mail</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

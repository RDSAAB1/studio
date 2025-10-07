
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

        const ws_data = [
            [companyName], [bankToUse.bankName], [bankToUse.branchName], [`A/C.NO..${bankToUse.accountNumber}`], [],
            ['', '', '', '', 'DATE', today], [],
            ["S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK"]
        ];

        payments.forEach((p: any, index: number) => {
            ws_data.push([
                index + 1, toTitleCase(p.supplierName), `'${p.acNo}`, p.ifscCode,
                p.amount, toTitleCase(p.supplierAddress || ''), p.bank,
            ]);
        });
        
        const emptyRowsNeeded = Math.max(0, 19 - ws_data.length);
        for(let i=0; i<emptyRowsNeeded; i++) ws_data.push([]);
        
        ws_data.push(["PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"]);
        ws_data.push([]);
        ws_data.push(['', '', '', '', '', 'GT', payments.reduce((sum: number, p: any) => sum + p.amount, 0)]);
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        ws['!cols'] = [
            { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
            { wch: 15 }, { wch: 20 }, { wch: 20 },
        ];
        
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
                                        {Array.from({ length: Math.max(0, 19 - 7 - payments.length) }).map((_: any, i: number) => (
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


"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Mail, Loader2, Paperclip, X, FileSpreadsheet } from 'lucide-react';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getFirebaseAuth } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { useErpSelection } from '@/hooks/use-erp-selection';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Attachment {
    filename: string;
    buffer: number[];
    contentType: string;
}

import { printHtmlContent } from '@/lib/electron-print';

export const BankMailFormatDialog2 = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const erp = useErpSelection();
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [isPreview, setIsPreview] = useState(true);
    const [emailData, setEmailData] = useState({ to: '', subject: '', body: '' });
    const [attachments, setAttachments] = useState<Attachment[]>([]);

    const generateExcelBuffer = (): Attachment | null => {
        if (!payments || payments.length === 0 || !settings) return null;
    
        const bankToUse = settings.defaultBank || { bankName: settings.bankName, branchName: settings.branchName, accountNumber: settings.accountNo };
        const companyName = settings.companyName || "GURU KRIPA AGRO FOODS";
        const companyAddress1 = settings.companyAddress1 || "";
        const companyAddress2 = settings.companyAddress2 || "";

        const today = format(new Date(), 'dd-MM-yyyy');
        const filename = `RTGS_Report_Format2_${today}.xlsx`;
    
        const ws_data: (string | number | Date | null)[][] = [
            [null, companyName],
            [null, `${companyAddress1}${companyAddress2 ? `, ${companyAddress2}` : ''}`],
            [null, bankToUse.bankName ? `BoB - ${bankToUse.bankName}` : '', null, null, 'DATE', today],
            [null, `A/C.NO. ${bankToUse.accountNumber}`],
        ];

        const headerRowIndex = ws_data.length; 
        ws_data.push(["S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK"]);
    
        payments.forEach((p: any, index: number) => {
            ws_data.push([
                index + 1,
                toTitleCase(p.supplierName),
                p.acNo,
                p.ifscCode,
                p.amount,
                toTitleCase(p.supplierAddress || p.branch || ''),
                p.bank,
            ]);
        });
        
        ws_data.push([]);
        ws_data.push([]);
        const footerRow2Index = ws_data.length;
        ws_data.push(["", "PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"]);
        
        const grandTotal = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const totalRowIndex = ws_data.length;
        ws_data.push([null, null, null, null, grandTotal, null, null]);
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
        ws['!cols'] = [ { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 } ];
        
        const borderStyle = { style: "thin" as const, color: { auto: 1 } };
        const allBorders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        const boldFont = { bold: true };
        
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

        for (let R = headerRowIndex; R <= totalRowIndex; ++R) {
            for (let C = 0; C < 7; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                
                if (!ws[cell_ref]) ws[cell_ref] = { t: 's', v: '' }; 
                if (!ws[cell_ref].s) ws[cell_ref].s = {};
                
                ws[cell_ref].s.border = allBorders;

                if (C === 2 && R > headerRowIndex && R < footerRow2Index - 2) { 
                    ws[cell_ref].t = 's';
                }
                
                if (R === headerRowIndex || (R === totalRowIndex) || (R === footerRow2Index)) { 
                    if (!ws[cell_ref].s.font) ws[cell_ref].s.font = {};
                    ws[cell_ref].s.font = { ...ws[cell_ref].s.font, ...boldFont };
                }
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

    useEffect(() => {
        if (isOpen) {
            setIsPreview(true); // Reset to preview mode every time dialog opens
            if (settings && payments) {
                const today = format(new Date(), 'dd-MMM-yyyy');
                const subject = `RTGS Payment Advice - ${settings.companyName} - ${today}`;
                const body = `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}, attached with this email.\n\nThank you,\n${settings.companyName}`;
                
                setEmailData({ to: 'your.bank.email@example.com', subject, body });

                const excelBuffer = generateExcelBuffer();
                if (excelBuffer) {
                    setAttachments([excelBuffer]);
                }
            }
        }
    }, [isOpen, settings, payments]);


    const handleDownloadExcel = () => {
        const excelAttachment = generateExcelBuffer(); 
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
    
     const handlePrint = async () => {
         const node = printRef.current;
         if (!node) {
             toast({ variant: 'destructive', title: 'Error', description: 'No data to print.' });
             return;
         }

        const printHtml = `
            <div class="printable-area">
                ${node.innerHTML}
            </div>
        `;

        const printStyles = `
            @page {
                size: A4 landscape;
                margin: 10mm;
            }
            body {
                margin: 0;
                padding: 12px;
                font-family: Arial, sans-serif;
                color: #000 !important;
                background: #fff;
            }
            .printable-area {
                color: #000 !important;
            }
            .printable-area * {
                color: #000 !important;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 8px;
            }
            th, td {
                border: 1px solid #000;
                padding: 4px 6px;
            }
            th { font-weight: 700; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
        `;

        try {
            await printHtmlContent(printHtml, printStyles);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Print Failed', description: error.message });
        }
     };


    const handleSendMail = async () => {
        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in to send emails.", variant: "destructive" });
            return;
        }
        
        setIsSending(true);

        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    to: emailData.to,
                    subject: emailData.subject,
                    body: emailData.body,
                    attachments,
                    userId: auth.currentUser?.uid,
                    erp,
                }),
            });
            const result = await res.json();

            if (result.success) {
                toast({ title: "Email Sent!", variant: "success" });
                onOpenChange(false);
            } else {
                throw new Error(result.error || "An unknown error occurred.");
            }
        } catch (error: any) {

            toast({ title: "Failed to Send Email", description: error.message, variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target?.result as ArrayBuffer;
                if (buffer) {
                    setAttachments(prev => [...prev, {
                        filename: file.name,
                        buffer: Array.from(new Uint8Array(buffer)),
                        contentType: file.type
                    }]);
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };
    
    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };


     if (!isOpen || !settings || !payments) {
         return null;
     }
    
    const bankToUse = settings.defaultBank || { bankName: settings.bankName, branchName: settings.branchName, accountNumber: settings.accountNo };
    const companyName = settings.companyName || "GURU KRIPA AGRO FOODS";
    const companyAddress = `${settings.companyAddress1 || ""}${settings.companyAddress2 ? `, ${settings.companyAddress2}` : ""}`;


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
                 <DialogHeader className="p-4 border-b">
                     <DialogTitle>Bank Mail Format 2</DialogTitle>
                     <DialogDescription>
                         Preview, download, or email the custom Excel format for bank payments.
                     </DialogDescription>
                 </DialogHeader>
                {isPreview ? (
                     <>
                        <ScrollArea className="flex-grow p-4">
                            <div ref={printRef} className="bg-white" style={{ color: '#000' }}>
                                <div className="p-4 text-sm printable-area" style={{ color: '#000', backgroundColor: '#fff' }}>
                                    <div className="grid grid-cols-2 items-start mb-4" style={{ color: '#000' }}>
                                        <div className='space-y-1' style={{ color: '#000' }}>
                                            <p className="font-bold text-lg" style={{ color: '#000' }}>{companyName}</p>
                                            <p className="text-xs" style={{ color: '#000' }}>{companyAddress}</p>
                                            <p style={{ color: '#000' }}>BoB - {bankToUse?.bankName}</p>
                                            <p style={{ color: '#000' }}>{bankToUse?.branchName}</p>
                                            <p style={{ color: '#000' }}>A/C.NO. {bankToUse?.accountNumber}</p>
                                        </div>
                                        <div className="text-right" style={{ color: '#000' }}>
                                            <p style={{ color: '#000' }}><span className="font-bold" style={{ color: '#000' }}>DATE: </span>{format(new Date(), 'dd-MM-yyyy')}</p>
                                        </div>
                                    </div>
                                    
                                    <div style={{ color: '#000' }}>
                                        <table className="w-full table-auto border-collapse border border-black text-sm" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>
                                            <thead className="font-bold">
                                                <tr className="border-b border-black" style={{ color: '#000', borderColor: '#000' }}>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>S.N</th>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>Name</th>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>Account no</th>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>IFCS Code</th>
                                                    <th className="p-1 text-right border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>Amount</th>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>Place</th>
                                                    <th className="p-1 text-left border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>BANK</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payments && payments.map((p: any, index: number) => (
                                                    <tr key={`${p.paymentId}-${index}`} className="border-b border-black" style={{ color: '#000', borderColor: '#000' }}>
                                                        <td className="p-1 border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{index + 1}</td>
                                                        <td className="p-1 border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{toTitleCase(p.supplierName)}</td>
                                                        <td className="p-1 border border-black font-mono" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{p.acNo}</td>
                                                        <td className="p-1 border border-black font-mono" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{p.ifscCode}</td>
                                                        <td className="p-1 text-right border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{p.amount.toFixed(2)}</td>
                                                        <td className="p-1 border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{toTitleCase(p.supplierAddress || p.branch || '')}</td>
                                                        <td className="p-1 border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{p.bank}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                 <tr>
                                                      <td colSpan={7} className="h-4 p-1 border-x border-black" style={{ borderColor: '#000', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                                                 </tr>
                                                 <tr>
                                                      <td colSpan={7} className="h-4 p-1 border-x border-b border-black" style={{ borderColor: '#000', borderLeft: '1px solid #000', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}></td>
                                                 </tr>
                                                 <tr className="font-bold" style={{ color: '#000', borderColor: '#000' }}>
                                                     <td colSpan={4} className="p-1 text-right border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -</td>
                                                     <td className="p-1 text-right font-semibold border border-black" style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}>{formatCurrency(payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0)}</td>
                                                     <td className="p-1 border border-black" colSpan={2} style={{ fontSize: '13px', color: '#000', borderColor: '#000', border: '1px solid #000' }}></td>
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
                             <Button onClick={() => setIsPreview(false)}><Mail className="mr-2 h-4 w-4" /> Compose Mail</Button>
                         </DialogFooter>
                     </>
                ) : (
                     <>
                         <ScrollArea className="flex-grow">
                             <div className="p-4 space-y-3 flex flex-col min-h-0">
                                 <div className="flex items-center border-b pb-2">
                                     <Label htmlFor="to" className="text-sm text-muted-foreground w-16">To</Label>
                                     <Input id="to" placeholder="Recipients (comma-separated)" value={emailData.to} onChange={(e) => setEmailData({...emailData, to: e.target.value})} className="border-0 focus-visible:ring-0 shadow-none h-auto p-0" />
                                 </div>
                                 <div className="flex items-center border-b pb-2">
                                     <Label htmlFor="subject" className="text-sm text-muted-foreground w-16">Subject</Label>
                                     <Input id="subject" value={emailData.subject} onChange={(e) => setEmailData({...emailData, subject: e.target.value})} className="border-0 focus-visible:ring-0 shadow-none h-auto p-0" />
                                 </div>
                                 <Textarea 
                                     value={emailData.body}
                                     onChange={(e) => setEmailData({...emailData, body: e.target.value})}
                                     className="border-0 focus-visible:ring-0 shadow-none p-0 resize-y flex-grow min-h-[150px]"
                                 />
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                     {attachments.map((att, index) => (
                                         <div key={index} className="relative flex items-center gap-2 p-2 border rounded-md">
                                             <FileSpreadsheet className="h-6 w-6 text-green-600 flex-shrink-0" />
                                             <div className="flex-grow overflow-hidden">
                                                 <p className="text-sm font-medium truncate">{att.filename}</p>
                                                 <p className="text-xs text-muted-foreground">Excel Spreadsheet</p>
                                             </div>
                                             <Button
                                                 type="button"
                                                 onClick={() => removeAttachment(index)}
                                                 className="absolute top-1 right-1 rounded-full h-5 w-5"
                                                 variant="ghost"
                                                 size="icon"
                                             >
                                                 <X className="h-3 w-3" />
                                             </Button>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </ScrollArea>
                         <DialogFooter className="bg-muted p-3 rounded-b-lg flex justify-between items-center">
                             <div className="relative">
                                 <Button size="icon" variant="ghost" asChild>
                                     <Label htmlFor="file-upload"><Paperclip className="h-5 w-5"/></Label>
                                 </Button>
                                 <Input id="file-upload" type="file" className="sr-only" onChange={handleFileChange}/>
                             </div>
                             <div className="flex items-center gap-2">
                                 <Button variant="outline" onClick={() => setIsPreview(true)}>Cancel</Button>
                                 <Button onClick={handleSendMail} disabled={isSending}>
                                     {isSending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> ) : ( <><Mail className="mr-2 h-4 w-4" /> Send</> )}
                                 </Button>
                             </div>
                         </DialogFooter>
                     </>
                )}
            </DialogContent>
        </Dialog>
    );
};

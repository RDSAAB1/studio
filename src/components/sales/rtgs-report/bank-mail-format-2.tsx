
"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Printer, Mail, Loader2, Paperclip, X, FileSpreadsheet } from 'lucide-react';
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
            [null, `${companyAddress1}, ${companyAddress2}`],
            [],
            [null, bankToUse.bankName ? `BoB - ${bankToUse.bankName}` : '', null, null, 'DATE', today],
            [null, `A/C.NO.. ${bankToUse.accountNumber}`],
            [],
            [],
        ];
        
        const headerRowIndex = ws_data.length; 
        ws_data.push(["S.N", "Name", "Account no", "IFCS Code", "Amount", "Place", "BANK"]);
    
        payments.forEach((p: any, index: number) => {
            ws_data.push([
                index + 1,
                toTitleCase(p.supplierName),
                p.acNo, // Removed single quote
                p.ifscCode,
                p.amount,
                toTitleCase(p.supplierAddress || p.branch || ''),
                p.bank,
            ]);
        });
        
        const footerRow1Index = ws_data.length;
        ws_data.push([]);
        const footerRow2Index = ws_data.length;
        ws_data.push(["", "PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -"]);
        
        const grandTotal = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const totalRowIndex = ws_data.length;
        ws_data.push([null, null, null, "GT", grandTotal, null, null]);
        
        const ws = XLSX.utils.aoa_to_sheet(ws_data, { cellStyles: true });
    
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
                
                // Ensure the style object exists
                if (!ws[cell_ref].s) ws[cell_ref].s = {};
                
                // Always apply border
                ws[cell_ref].s.border = allBorders;

                // Explicitly set Account No column to text format
                if (C === 2 && R > headerRowIndex && R < footerRow1Index) { 
                    ws[cell_ref].t = 's';
                }
                
                // Apply bold font where needed
                if (R === headerRowIndex || (R === totalRowIndex && (C === 3 || C === 4)) || (R === footerRow2Index)) { 
                    ws[cell_ref].s.font = { ...ws[cell_ref].s.font, ...boldFont };
                }
            }
        }
        
        const gtCellRef = XLSX.utils.encode_cell({c: 3, r: totalRowIndex});
        if(ws[gtCellRef] && ws[gtCellRef].s) ws[gtCellRef].s.font = boldFont;

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
    
     const handlePrint = () => {
         const node = printRef.current;
         if (!node) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not find the content to print.' });
             return;
         }

         const iframe = document.createElement('iframe');
         iframe.style.position = 'absolute';
         iframe.style.width = '0';
         iframe.style.height = '0';
         iframe.style.border = '0';
         document.body.appendChild(iframe);
         
         const iframeDoc = iframe.contentWindow?.document;
         if (!iframeDoc) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not create print window.' });
             document.body.removeChild(iframe);
             return;
         }

         iframeDoc.open();
         iframeDoc.write('<html><head><title>RTGS Advice</title>');
         
         Array.from(document.styleSheets).forEach(styleSheet => {
             try {
                 const css = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                 const style = iframeDoc.createElement('style');
                 style.textContent = css;
                 iframeDoc.head.appendChild(style);
             } catch (e) {
                 console.warn('Could not copy stylesheet:', e);
             }
         });
         
         const printStyles = iframeDoc.createElement('style');
         printStyles.textContent = `
             @media print {
                 @page {
                     size: A4 landscape;
                     margin: 10mm;
                 }
                 body {
                     -webkit-print-color-adjust: exact !important;
                     print-color-adjust: exact !important;
                 }
                 .printable-area {
                     background-color: #fff !important;
                 }
                 .printable-area * {
                     border-color: #000 !important;
                     color: #000 !important;
                 }
                 .print-header-bg {
                      background-color: #fce5d5 !important;
                 }
                 .page-break {
                     page-break-after: always;
                 }
             }
         `;
         iframeDoc.head.appendChild(printStyles);

         iframeDoc.write('</head><body></body></html>');
         iframeDoc.body.innerHTML = node.innerHTML;
         iframeDoc.close();
         
         setTimeout(() => {
             iframe.contentWindow?.focus();
             iframe.contentWindow?.print();
             document.body.removeChild(iframe);
         }, 500);
     };

    const handleSendMail = async () => {
        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in to send emails.", variant: "destructive" });
            return;
        }
        
        setIsSending(true);

        try {
            const result = await sendEmailWithAttachment({
                to: emailData.to,
                subject: emailData.subject,
                body: emailData.body,
                attachments: attachments,
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email || '',
            });

            if (result.success) {
                toast({ title: "Email Sent!", variant: "success" });
                onOpenChange(false);
            } else {
                throw new Error(result.error || "An unknown error occurred.");
            }
        } catch (error: any) {
            console.error("Error sending email:", error);
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
                        <ScrollArea className="flex-grow">
                             <div ref={printRef} className="bg-white"> 
                                <div className="p-4 text-black text-sm">
                                    <div className="grid grid-cols-2 items-start mb-4">
                                        <div className='space-y-1'>
                                            <p className="font-bold text-lg">{companyName}</p>
                                            <p className="text-xs">{companyAddress}</p>
                                            <p>BoB - {bankToUse?.bankName}</p>
                                            <p>{bankToUse?.branchName}</p>
                                            <p>A/C.NO..'{bankToUse?.accountNumber}</p>
                                        </div>
                                        <div className="text-right">
                                            <p><span className="font-bold">DATE: </span>{format(new Date(), 'dd-MM-yyyy')}</p>
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
                                                {payments && payments.map((p: any, index: number) => (
                                                    <tr key={`${p.paymentId}-${index}`} className="border-b border-black">
                                                        <td className="p-1 border border-black">{index + 1}</td>
                                                        <td className="p-1 border border-black">{toTitleCase(p.supplierName)}</td>
                                                        <td className="p-1 border border-black font-mono">{p.acNo}</td>
                                                        <td className="p-1 border border-black font-mono">{p.ifscCode}</td>
                                                        <td className="p-1 text-right border border-black">{p.amount.toFixed(2)}</td>
                                                        <td className="p-1 border border-black">{toTitleCase(p.supplierAddress || p.branch || '')}</td>
                                                        <td className="p-1 border border-black">{p.bank}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                 <tr className="font-bold">
                                                     <td colSpan={4} className="p-1 text-right border border-black">GT</td>
                                                     <td className="p-1 text-right font-semibold border border-black">{formatCurrency(payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0)}</td>
                                                     <td className="p-1 border border-black" colSpan={2}></td>
                                                 </tr>
                                                  <tr>
                                                      <td colSpan={7} className="h-4 p-1 border-x border-black"></td>
                                                 </tr>
                                                 <tr>
                                                      <td colSpan={7} className="h-4 p-1 border-x border-b border-black"></td>
                                                 </tr>
                                                 <tr>
                                                    <td colSpan={7} className="pt-8 p-1 font-bold">PL SEND RTGS & NEFT AS PER CHART VIDE CH NO -</td>
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

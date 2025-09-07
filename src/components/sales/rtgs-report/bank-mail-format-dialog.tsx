
"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Paperclip, FileSpreadsheet, X } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { sendEmailWithAttachment } from '@/lib/actions';
import { getFirebaseAuth } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from "@/components/ui/card";

interface Attachment {
    filename: string;
    buffer: number[];
    contentType: string;
}

export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const [isSending, setIsSending] = useState(false);
    const [emailData, setEmailData] = useState({
        to: '',
        subject: '',
        body: '',
    });
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isPreview, setIsPreview] = useState(true);

    useEffect(() => {
        if (isOpen && settings) {
            const today = format(new Date(), 'dd-MMM-yyyy');
            const subject = `RTGS Payment Advice - ${settings.companyName} - ${today}`;
            const body = `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}, attached with this email.\n\nThank you,\n${settings.companyName}`;
            
            setEmailData({
                to: 'your.bank.email@example.com',
                subject,
                body,
            });

            const dataToExport = payments.map((p: any) => ({
                'Sr.No': p.srNo,
                'Debit_Ac_No': settings.accountNo,
                'Amount': p.amount,
                'IFSC_Code': p.ifscCode,
                'Credit_Ac_No': p.acNo,
                'Beneficiary_Name': toTitleCase(p.supplierName),
                'Scheme Type': settings.type || 'SB'
            }));
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "RTGS Report");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            
            setAttachments([{
                filename: `RTGS_Report_${today}.xlsx`,
                buffer: Array.from(new Uint8Array(excelBuffer)),
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }]);
            
            setIsPreview(true);
        }
    }, [isOpen, settings, payments]);
    
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

    const handleSendMail = async () => {
        if (payments.length === 0) {
            toast({ title: "No data to send", variant: "destructive" });
            return;
        }

        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
            toast({ title: "Authentication Error", variant: "destructive" });
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

    if (isPreview) {
        return (
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>RTGS Data Preview</DialogTitle>
                        <DialogDescription>Review the data that will be included in the Excel file before composing the email.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] border rounded-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Sr.No</th>
                                        <th className="p-2 text-left">Debit_Ac_No</th>
                                        <th className="p-2 text-right">Amount</th>
                                        <th className="p-2 text-left">IFSC_Code</th>
                                        <th className="p-2 text-left">Credit_Ac_No</th>
                                        <th className="p-2 text-left">Beneficiary_Name</th>
                                        <th className="p-2 text-left">Scheme Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p: any) => (
                                        <tr key={p.srNo} className="border-t">
                                            <td className="p-2">{p.srNo}</td>
                                            <td className="p-2">{settings.accountNo}</td>
                                            <td className="p-2 text-right font-medium">{p.amount}</td>
                                            <td className="p-2">{p.ifscCode}</td>
                                            <td className="p-2">{p.acNo}</td>
                                            <td className="p-2">{toTitleCase(p.supplierName)}</td>
                                            <td className="p-2">{settings.type || 'SB'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={() => setIsPreview(false)}>Compose Email</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="h-full w-full max-h-full max-w-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl p-0 flex flex-col">
                <DialogHeader className="bg-muted px-4 py-2 rounded-t-lg">
                    <DialogTitle className="text-base font-normal">New Message</DialogTitle>
                </DialogHeader>
                <div className="p-4 space-y-3 flex-grow flex flex-col min-h-0">
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
                             <Card key={index} className="relative flex items-center gap-2 p-2">
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
                            </Card>
                        ))}
                    </div>
                </div>
                <DialogFooter className="bg-muted p-3 rounded-b-lg flex justify-between items-center">
                    <div className="relative">
                        <Button size="icon" variant="ghost" asChild>
                            <Label htmlFor="file-upload"><Paperclip className="h-5 w-5"/></Label>
                        </Button>
                        <Input id="file-upload" type="file" className="sr-only" onChange={handleFileChange}/>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSendMail} disabled={isSending}>
                            {isSending ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> ) : ( <><Mail className="mr-2 h-4 w-4" /> Send</> )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

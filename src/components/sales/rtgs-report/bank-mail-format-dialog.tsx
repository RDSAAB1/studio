
"use client";

import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Paperclip, FileSpreadsheet } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { sendEmailWithAttachment } from '@/lib/actions';
import { getFirebaseAuth } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const [isSending, setIsSending] = useState(false);
    const [emailData, setEmailData] = useState({
        to: 'your.bank.email@example.com',
        subject: '',
        body: '',
    });

    useEffect(() => {
        if (isOpen && settings) {
            const today = format(new Date(), 'dd-MMM-yyyy');
            const subject = `RTGS Payment Advice - ${settings.companyName} - ${today}`;
            const body = `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}, attached with this email.\n\nThank you,\n${settings.companyName}`;
            
            setEmailData({
                to: 'your.bank.email@example.com', // This should be a configurable setting in the future
                subject,
                body,
            });
        }
    }, [isOpen, settings]);

    const handleSendMail = async () => {
        if (payments.length === 0) {
            toast({ title: "No data to send", variant: "destructive" });
            return;
        }

        const auth = getFirebaseAuth();
        if (!auth.currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in to send emails.", variant: "destructive" });
            return;
        }
        
        setIsSending(true);

        try {
            const userEmail = auth.currentUser.email;
            const userId = auth.currentUser.uid;
            
            if (!userEmail || !userId) {
                toast({ title: "Authentication Error", description: "User email or ID not found.", variant: "destructive" });
                setIsSending(false);
                return;
            }
            
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
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const bufferAsArray = Array.from(new Uint8Array(excelBuffer));

            const today = format(new Date(), 'yyyy-MM-dd');
            const filename = `RTGS_Report_${today}.xlsx`;

            const result = await sendEmailWithAttachment({
                to: emailData.to,
                subject: emailData.subject,
                body: emailData.body,
                attachmentBuffer: bufferAsArray,
                filename,
                userId: userId,
                userEmail: userEmail,
            });

            if (result.success) {
                toast({ title: "Email Sent!", description: "The RTGS report has been sent successfully.", variant: "success" });
                onOpenChange(false);
            } else {
                throw new Error(result.error || "An unknown error occurred.");
            }
        } catch (error: any) {
            console.error("Error sending email:", error);
            toast({ title: "Failed to Send Email", description: error.message || "Please check server logs.", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader className="bg-muted p-4 rounded-t-lg">
                    <DialogTitle className="text-sm font-normal">New Message</DialogTitle>
                </DialogHeader>
                <div className="p-4 space-y-3">
                    <div className="flex items-center border-b pb-2">
                        <Label htmlFor="to" className="text-sm text-muted-foreground w-16">To</Label>
                        <Input id="to" value={emailData.to} onChange={(e) => setEmailData({...emailData, to: e.target.value})} className="border-0 focus-visible:ring-0 shadow-none h-auto p-0" />
                    </div>
                     <div className="flex items-center border-b pb-2">
                        <Label htmlFor="subject" className="text-sm text-muted-foreground w-16">Subject</Label>
                        <Input id="subject" value={emailData.subject} onChange={(e) => setEmailData({...emailData, subject: e.target.value})} className="border-0 focus-visible:ring-0 shadow-none h-auto p-0" />
                    </div>
                    <Textarea 
                        value={emailData.body}
                        onChange={(e) => setEmailData({...emailData, body: e.target.value})}
                        className="border-0 focus-visible:ring-0 shadow-none min-h-48 p-0"
                    />
                    <div className="flex items-center gap-2 bg-muted/50 border rounded-lg p-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600"/>
                        <span className="text-sm font-medium">RTGS_Report_{format(new Date(), 'yyyy-MM-dd')}.xlsx</span>
                    </div>
                </div>
                <DialogFooter className="bg-muted p-3 rounded-b-lg">
                    <Button onClick={handleSendMail} disabled={isSending}>
                        {isSending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                        ) : (
                            <><Mail className="mr-2 h-4 w-4" /> Send</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

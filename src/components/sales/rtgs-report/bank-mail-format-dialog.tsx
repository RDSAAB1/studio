
"use client";

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, Download } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { sendEmailWithAttachment } from '@/lib/actions';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';


export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);
    const [isSending, setIsSending] = useState(false);

    const handleDownload = () => {
        if (!tableRef.current) return;
        const worksheet = XLSX.utils.table_to_sheet(tableRef.current);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "RTGS Report");
        worksheet['!cols'] = [
            { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }
        ];
        const today = format(new Date(), 'yyyy-MM-dd');
        XLSX.writeFile(workbook, `RTGS_Report_${today}.xlsx`);
    };

    const handleSendMail = async () => {
        if (payments.length === 0) {
            toast({ title: "No data to send", variant: "destructive" });
            return;
        }

        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in to send emails.", variant: "destructive" });
            return;
        }
        
        const userEmail = currentUser.email;

        if (!userEmail) {
             toast({ title: "Authentication Error", description: "Could not retrieve your email address.", variant: "destructive" });
            return;
        }

        setIsSending(true);

        try {
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
            const bankEmail = settings.gmail || "your.bank.email@example.com";
            const subject = `RTGS Payment Advice - ${settings.companyName} - ${today}`;
            const body = `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}, attached with this email.\n\nThank you,\n${settings.companyName}`;
            const filename = `RTGS_Report_${today}.xlsx`;

            const result = await sendEmailWithAttachment({
                to: bankEmail,
                subject,
                body,
                attachmentBuffer: bufferAsArray,
                filename,
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
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Bank Mail Format</DialogTitle>
                    <DialogDescription>
                        This format will be sent directly to the bank via email with an Excel attachment.
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Close</Button>
                    <div className="flex-grow" />
                    <Button onClick={handleDownload} variant="secondary" disabled={isSending}>
                        <Download className="mr-2 h-4 w-4" /> Download Excel
                    </Button>
                    <Button onClick={handleSendMail} disabled={isSending}>
                        {isSending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                        ) : (
                            <><Mail className="mr-2 h-4 w-4" /> Send Mail Directly</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

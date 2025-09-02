
"use client";

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, Mail, Loader2 } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';

export const BankMailFormatDialog = ({ isOpen, onOpenChange, payments, settings }: any) => {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleGenerateAndMail = async () => {
        if (payments.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }
        setIsUploading(true);

        try {
            // 1. Prepare data and create Excel file in memory
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
                { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }
            ];

            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // 2. Upload the file to Firebase Storage
            const today = format(new Date(), 'yyyy-MM-dd');
            const fileName = `RTGS_Report_${today}_${Date.now()}.xlsx`;
            const storageRef = ref(storage, `rtgs-reports/${fileName}`);
            
            await uploadBytes(storageRef, excelBlob);
            
            // 3. Get the download URL
            const downloadURL = await getDownloadURL(storageRef);

            // 4. Open Gmail with the link
            const bankEmail = "your.bank.email@example.com";
            const subject = encodeURIComponent(`RTGS Payment Advice - ${settings.companyName} - ${today}`);
            const body = encodeURIComponent(
              `Dear Team,\n\nPlease find the RTGS payment advice for today, ${today}. You can download the file from the link below:\n\n${downloadURL}\n\nThank you,\n${settings.companyName}`
            );
            
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${bankEmail}&su=${subject}&body=${body}`;
            window.open(gmailUrl, '_blank');
            
            toast({ title: "Success!", description: "File uploaded and email is ready to be sent.", variant: "success" });

        } catch (error) {
            console.error("Error generating or mailing file:", error);
            toast({ title: "Error", description: "Could not generate and mail the file. Please try again.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Bank Mail Format</DialogTitle>
                    <DialogDescription>
                        This will generate an Excel file, upload it, and open a pre-filled email with a link to the file.
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
                    <Button onClick={handleGenerateAndMail} disabled={isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                        {isUploading ? "Generating..." : "Generate &amp; Mail"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

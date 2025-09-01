
"use client";

import React, { useRef } from 'react';
import { RtgsSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface RtgsReportRow {
    paymentId: string;
    date: string;
    checkNo: string;
    type: string;
    srNo: string; 
    supplierName: string;
    fatherName: string;
    contact: string;
    acNo: string;
    ifscCode: string;
    branch: string;
    bank: string;
    amount: number;
    rate: number;
    weight: number;
    sixRNo: string;
    sixRDate: string;
    parchiNo: string;
}

interface ConsolidatedRtgsPrintFormatProps {
    payments: RtgsReportRow[];
    settings: RtgsSettings;
}

export const ConsolidatedRtgsPrintFormat = ({ payments, settings }: ConsolidatedRtgsPrintFormatProps) => {
    const printRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    const firstDate = payments.length > 0 ? payments[0].date : '';
    const isSameDate = payments.every(p => p.date === firstDate);
    
    const firstCheckNo = payments.length > 0 ? payments[0].checkNo : '';
    const isSameCheckNo = payments.every(p => p.checkNo === firstCheckNo);

    const handlePrint = () => {
        const node = printRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>RTGS Advice</title>');
        
        // Copy all style sheets from the main document to the iframe
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn('Could not copy stylesheet:', e);
            }
        });
        
        // Add specific print styles
        const printStyles = iframeDoc.createElement('style');
        printStyles.textContent = `
            @media print {
                @page {
                    size: A4;
                    margin: 0;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color: #000 !important;
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

    return (
        <>
            <DialogHeader className="p-4 pb-0 print:hidden">
                <DialogTitle>RTGS Print Preview</DialogTitle>
                <DialogDescription>
                    Review the consolidated RTGS report below before printing.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div ref={printRef} className="printable-area">
                    <div className="p-6 bg-white text-black font-sans text-[12px] leading-normal flex flex-col justify-between min-h-[29.7cm]">
                        <div className="flex-grow-0">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-1/2">
                                    <h2 className="font-bold text-2xl mb-1">{settings.companyName}</h2>
                                    <p className="text-gray-600 text-[11px]">{settings.companyAddress1}, {settings.companyAddress2}</p>
                                    <p className="text-gray-600 text-[11px]">Phone: {settings.contactNo} | Email: {settings.gmail}</p>
                                </div>
                                <div className="text-right">
                                    <h1 className="text-3xl font-bold text-gray-800 uppercase mb-1">RTGS ADVICE</h1>
                                    <div className="text-sm text-gray-700">
                                        <div className="grid grid-cols-2 text-left">
                                            {isSameDate && <>
                                                <span className="font-bold pr-2">Date:</span>
                                                <span>{format(new Date(firstDate), "dd MMM, yyyy")}</span>
                                            </>}
                                            {isSameCheckNo && <>
                                                <span className="font-bold pr-2">Check/UTR #:</span>
                                                <span>{firstCheckNo}</span>
                                            </>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Our Bank Details */}
                            <div className="border border-gray-200 p-3 rounded-lg mb-4">
                                <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Our Bank Details</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <div><span className="font-semibold">Bank:</span> <span>{settings.bankName}, {settings.branchName}</span></div>
                                    <div><span className="font-semibold">A/C No:</span> <span>{settings.accountNo}</span></div>
                                    <div><span className="font-semibold">IFSC:</span> <span>{settings.ifscCode}</span></div>
                                </div>
                            </div>

                            {/* Information Table */}
                            <table className="w-full text-left mb-4 print-table">
                                <thead>
                                    <tr className="bg-gray-800 text-white uppercase text-xs">
                                        <th className="p-2 font-semibold text-center w-[5%]">#</th>
                                        <th className="p-2 font-semibold w-[20%]">Payee Name</th>
                                        <th className="p-2 font-semibold w-[15%]">Bank Name</th>
                                        <th className="p-2 font-semibold w-[15%]">Branch</th>
                                        <th className="p-2 font-semibold w-[15%]">A/C No.</th>
                                        <th className="p-2 font-semibold w-[15%]">IFSC Code</th>
                                        <th className="p-2 font-semibold text-right w-[15%]">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment, index) => (
                                        <tr key={payment.paymentId} className="border-b border-gray-200">
                                            <td className="p-2 text-center border-x border-gray-200">{index + 1}</td>
                                            <td className="p-2 border-x border-gray-200">{toTitleCase(payment.supplierName || '')}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.bank}</td>
                                            <td className="p-2 border-x border-gray-200">{toTitleCase(payment.branch || '')}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.acNo}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.ifscCode}</td>
                                            <td className="p-2 text-right font-semibold border-x border-gray-200">{formatCurrency(payment.amount)}</td>
                                        </tr>
                                    ))}
                                    {Array.from({ length: Math.max(0, 15 - payments.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={7}></td></tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="p-2 text-right" colSpan={6}>GRAND TOTAL</td>
                                        <td className="p-2 text-right">{formatCurrency(totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div className="flex-grow-0 pt-16">
                            <div className="border-t border-gray-300 pt-4 mt-4">
                                <div className="flex justify-between items-end">
                                    <div className="w-3/5">
                                        <h4 className="font-bold mb-2 text-gray-600 uppercase text-xs">Notes</h4>
                                        <p className="text-gray-600 text-[10px]">This is a computer-generated advice and does not require a signature.</p>
                                    </div>
                                    <div className="w-2/5 text-center">
                                        <div className="h-16"></div>
                                        <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                            <p className="font-bold text-sm">Authorised Signatory</p>
                                            <p className="text-gray-600 text-xs">For {settings.companyName}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
             <DialogFooter className="p-4 pt-2 print:hidden">
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
            </DialogFooter>
        </>
    );
};

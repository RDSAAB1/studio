
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

const ReportHeader = ({ settings, firstDate, firstCheckNo, isSameDate, isSameCheckNo }: { settings: RtgsSettings, firstDate: string, firstCheckNo: string, isSameDate: boolean, isSameCheckNo: boolean }) => (
    <div className="flex-grow-0">
        <div className="flex justify-between items-start mb-4">
            <div className="w-1/2">
                <h2 className="font-bold text-3xl mb-2">{settings.companyName}</h2>
                <p className="text-gray-600 text-sm">{settings.companyAddress1}, {settings.companyAddress2}</p>
                <p className="text-gray-600 text-sm">Phone: {settings.contactNo} | Email: {settings.gmail}</p>
            </div>
            <div className="text-right">
                <h1 className="text-4xl font-bold text-gray-800 uppercase mb-2">RTGS ADVICE</h1>
                <div className="text-base text-gray-700">
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
        <div className="border border-gray-200 p-4 rounded-lg mb-4">
            <h3 className="font-bold text-gray-500 mb-3 uppercase tracking-wider text-sm">Our Bank Details</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-base">
                <div><span className="font-semibold">Bank:</span> <span>{settings.bankName}, {settings.branchName}</span></div>
                <div><span className="font-semibold">A/C No:</span> <span>{settings.accountNo}</span></div>
                <div><span className="font-semibold">IFSC:</span> <span>{settings.ifscCode}</span></div>
            </div>
        </div>
    </div>
);

const ReportFooter = ({ settings }: { settings: RtgsSettings }) => (
    <div className="flex-grow-0 pt-4 mt-auto">
        <div className="border-t border-gray-300 pt-4">
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
);

export const ConsolidatedRtgsPrintFormat = ({ payments, settings }: ConsolidatedRtgsPrintFormatProps) => {
    const printRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    const firstDate = payments.length > 0 ? payments[0].date : '';
    const isSameDate = payments.every(p => p.date === firstDate);
    
    const firstCheckNo = payments.length > 0 ? payments[0].checkNo : '';
    const isSameCheckNo = payments.every(p => p.checkNo === firstCheckNo);

    const CHUNK_SIZE = 15;
    const paymentChunks = [];
    for (let i = 0; i < payments.length; i += CHUNK_SIZE) {
        paymentChunks.push(payments.slice(i, i + CHUNK_SIZE));
    }

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
        
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
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
                    margin: 20px;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color: #000 !important;
                }
                 .printable-area * {
                    color: #000 !important;
                    border-color: #e5e7eb !important;
                }
                .page-break {
                    page-break-after: always;
                }
                .bg-gray-800 {
                    background-color: #1f2937 !important;
                }
                .bg-gray-800 * {
                    color: #fff !important;
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
                    {paymentChunks.map((chunk, pageIndex) => (
                        <div key={pageIndex} className={`p-6 bg-white text-black font-sans text-sm leading-normal flex flex-col min-h-[18.5cm] ${pageIndex < paymentChunks.length - 1 ? 'page-break' : ''}`}>
                            <ReportHeader settings={settings} firstDate={firstDate} firstCheckNo={firstCheckNo} isSameDate={isSameDate} isSameCheckNo={isSameCheckNo} />
                            
                            <table className="w-full text-left mb-4 print-table">
                                <thead className="print-bg-orange">
                                    <tr className="bg-gray-800 text-white uppercase text-xs">
                                        <th className="p-2 font-semibold text-center">#</th>
                                        <th className="p-2 font-semibold">Payee Name</th>
                                        <th className="p-2 font-semibold">Bank Name</th>
                                        <th className="p-2 font-semibold">Branch</th>
                                        <th className="p-2 font-semibold">A/C No.</th>
                                        <th className="p-2 font-semibold">IFSC Code</th>
                                        <th className="p-2 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chunk.map((payment, index) => (
                                        <tr key={payment.paymentId} className="border-b border-gray-200">
                                            <td className="p-2 text-center border-x border-gray-200">{pageIndex * CHUNK_SIZE + index + 1}</td>
                                            <td className="p-2 border-x border-gray-200">{toTitleCase(payment.supplierName || '')}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.bank}</td>
                                            <td className="p-2 border-x border-gray-200">{toTitleCase(payment.branch || '')}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.acNo}</td>
                                            <td className="p-2 border-x border-gray-200">{payment.ifscCode}</td>
                                            <td className="p-2 text-right font-semibold border-x border-gray-200">{formatCurrency(payment.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {pageIndex === paymentChunks.length - 1 && (
                                     <tfoot>
                                        <tr className="bg-gray-100 font-bold">
                                            <td className="p-2 text-right" colSpan={6}>GRAND TOTAL</td>
                                            <td className="p-2 text-right">{formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                            
                            <ReportFooter settings={settings} />
                        </div>
                    ))}
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

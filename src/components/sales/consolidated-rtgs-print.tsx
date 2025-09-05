
"use client";

import React, { useRef, useMemo } from 'react';
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
                <h2 className="font-bold text-3xl mb-1">{settings.companyName}</h2>
                <p className="text-gray-600 text-sm">{settings.companyAddress1}, {settings.companyAddress2}</p>
                <p className="text-gray-600 text-sm">Phone: {settings.contactNo} | Email: {settings.gmail}</p>
            </div>
            <div className="text-right">
                <h1 className="text-4xl font-bold text-gray-800 uppercase mb-1">RTGS ADVICE</h1>
                <div className="text-base text-gray-700">
                    <div className="grid grid-cols-2 text-left">
                        {isSameDate && <>
                            <span className="font-bold pr-2">Date:</span>
                            <span>{format(new Date(firstDate), "dd MMM, yyyy")}</span>
                        </>}
                        {isSameCheckNo && <>
                            <span className="font-bold pr-2">Check #:</span>
                            <span>{firstCheckNo}</span>
                        </>}
                    </div>
                </div>
            </div>
        </div>
        <div className="border border-gray-200 p-3 rounded-lg mb-4">
            <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-sm">Our Bank Details</h3>
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
        <div className="border-t border-gray-300 pt-2">
            <div className="flex justify-between items-end">
                <div className="w-3/5">
                    <h4 className="font-bold mb-1 text-gray-600 uppercase text-xs">Notes</h4>
                    <p className="text-gray-600 text-[9px]">This is a computer-generated advice and does not require a signature.</p>
                </div>
                <div className="w-2/5 text-center">
                    <div className="h-12"></div>
                    <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-1">
                        <p className="font-bold text-xs">Authorised Signatory</p>
                        <p className="text-gray-600 text-[10px]">For {settings.companyName}</p>
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

    const CHUNK_SIZE = 10;
    const paymentChunks = useMemo(() => {
        const chunks = [];
        for (let i = 0; i < payments.length; i += CHUNK_SIZE) {
            chunks.push(payments.slice(i, i + CHUNK_SIZE));
        }
        return chunks;
    }, [payments]);
    
    let cumulativeTotal = 0;

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
                    margin: 15px;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .page-break-after { page-break-after: always !important; }
                .bg-gray-800 { background-color: #1f2937 !important; }
                .bg-gray-800 * { color: #fff !important; }
                .text-black { color: #000 !important; }
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
                    {paymentChunks.map((chunk, pageIndex) => {
                        const isLastPage = pageIndex === paymentChunks.length - 1;
                        const pageTotal = chunk.reduce((sum, p) => sum + p.amount, 0);
                        cumulativeTotal += pageTotal;

                        return (
                            <div key={pageIndex} className={`p-4 bg-white text-black font-sans leading-normal flex flex-col justify-between min-h-[18.5cm] ${!isLastPage ? 'page-break-after' : ''}`}>
                                <ReportHeader settings={settings} firstDate={firstDate} firstCheckNo={firstCheckNo} isSameDate={isSameDate} isSameCheckNo={isSameCheckNo} />
                                
                                <div className="flex-grow overflow-x-auto">
                                    <table className="w-full text-left print-table">
                                        <thead>
                                            <tr className="bg-gray-800 text-white uppercase text-[10px]">
                                                <th className="py-1 px-2 font-semibold text-center">#</th>
                                                <th className="py-1 px-2 font-semibold">Payee Name</th>
                                                <th className="py-1 px-2 font-semibold">Bank Name</th>
                                                <th className="py-1 px-2 font-semibold">Branch</th>
                                                <th className="py-1 px-2 font-semibold">A/C No.</th>
                                                <th className="py-1 px-2 font-semibold">IFSC Code</th>
                                                <th className="py-1 px-2 font-semibold text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((payment, index) => (
                                                <tr key={payment.paymentId} className="border-b border-gray-200">
                                                    <td className="py-1 px-2 text-xs text-center border-x border-gray-200 text-black">{pageIndex * CHUNK_SIZE + index + 1}</td>
                                                    <td className="py-1 px-2 text-xs border-x border-gray-200 text-black">{toTitleCase(payment.supplierName || '')}</td>
                                                    <td className="py-1 px-2 text-xs border-x border-gray-200 text-black">{payment.bank}</td>
                                                    <td className="py-1 px-2 text-xs border-x border-gray-200 text-black">{toTitleCase(payment.branch || '')}</td>
                                                    <td className="py-1 px-2 text-xs border-x border-gray-200 text-black">{payment.acNo}</td>
                                                    <td className="py-1 px-2 text-xs border-x border-gray-200 text-black">{payment.ifscCode}</td>
                                                    <td className="py-1 px-2 text-xs font-semibold text-right border-x border-gray-200 text-black">{formatCurrency(payment.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="font-bold border-t-2 border-black">
                                            {paymentChunks.length === 1 ? (
                                                <tr>
                                                    <td className="py-1 px-2 text-right text-black" colSpan={6}>GRAND TOTAL</td>
                                                    <td className="py-1 px-2 text-right text-black">{formatCurrency(cumulativeTotal)}</td>
                                                </tr>
                                            ) : (
                                                <>
                                                    <tr>
                                                        <td className="py-1 px-2 text-right text-black text-xs" colSpan={6}>Page Total</td>
                                                        <td className="py-1 px-2 text-right text-black text-xs">{formatCurrency(pageTotal)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="py-1 px-2 text-right text-black text-xs" colSpan={6}>Cumulative Total</td>
                                                        <td className="py-1 px-2 text-right text-black text-xs">{formatCurrency(cumulativeTotal)}</td>
                                                    </tr>
                                                    {isLastPage && (
                                                        <tr className="bg-gray-200">
                                                            <td className="py-1 px-2 text-right text-black" colSpan={6}>GRAND TOTAL</td>
                                                            <td className="py-1 px-2 text-right text-black">{formatCurrency(cumulativeTotal)}</td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </tfoot>
                                    </table>
                                </div>
                                
                                <ReportFooter settings={settings} />
                            </div>
                        );
                    })}
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

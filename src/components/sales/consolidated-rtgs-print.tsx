
"use client";

import React, { useRef } from 'react';
import { RtgsSettings, BankAccount } from '@/lib/definitions';
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
    settings: RtgsSettings & { defaultBank?: BankAccount };
}

const BankHeader = () => (
    <div className="text-orange-700">
        <h3 className="font-bold text-lg">बैंक ऑफ़ बड़ौदा</h3>
        <h3 className="font-bold text-lg">Bank of Baroda</h3>
        <p className="text-xs">India's International Bank</p>
    </div>
);

const chunkArray = <T,>(array: T[], size: number): T[][] => {
    const chunkedArr: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
};

export const ConsolidatedRtgsPrintFormat = ({ payments, settings }: ConsolidatedRtgsPrintFormatProps) => {
    const printRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    
    if (!settings) {
        return <div>Loading settings...</div>;
    }

    const paymentChunks = chunkArray(payments, 10);
    const grandTotalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

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
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
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
                .printable-area, .printable-area * {
                    background-color: #fff !important;
                    color: #000 !important;
                    border-color: #000 !important;
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

    return (
        <>
            <DialogHeader className="p-4 pb-0 print:hidden">
                <DialogTitle>RTGS Print Preview</DialogTitle>
                <DialogDescription>
                    Review the consolidated RTGS report below before printing.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div ref={printRef}>
                    {paymentChunks.map((chunk, pageIndex) => {
                        const firstDate = chunk.length > 0 ? chunk[0].date : '';
                        const isSameDate = chunk.every(p => p.date === firstDate);
                        const firstCheckNo = chunk.length > 0 ? chunk[0].checkNo : '';
                        const isSameCheckNo = chunk.every(p => p.checkNo === firstCheckNo);
                        const pageTotalAmount = chunk.reduce((sum, p) => sum + p.amount, 0);

                        return (
                            <div key={pageIndex} className="p-4 font-sans leading-normal bg-white text-black printable-area page-break">
                                <div className="flex justify-between items-start mb-2">
                                    <BankHeader />
                                    <div className="text-center">
                                        <p className="font-bold text-xs text-black">FORM</p>
                                        <h2 className="font-bold text-xl text-black">{settings.companyName}</h2>
                                        <p className="font-bold text-sm text-black">{settings.companyAddress1}</p>
                                        <p className="font-bold text-sm text-black">{settings.companyAddress2}</p>
                                    </div>
                                    <BankHeader />
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <table className="text-sm">
                                        <tbody>
                                            <tr><td className="font-bold pr-4 text-black">BANK NAME</td><td className="text-black">- {settings.defaultBank?.bankName}</td></tr>
                                            <tr><td className="font-bold pr-4 text-black">IFSC CODE</td><td className="text-black">- {settings.defaultBank?.ifscCode}</td></tr>
                                            <tr><td className="font-bold pr-4 text-black">BRANCH NAME</td><td className="text-black">- {settings.defaultBank?.branchName}</td></tr>
                                            <tr><td className="font-bold pr-4 text-black">A/C NO.</td><td className="text-black">- '{settings.defaultBank?.accountNumber}</td></tr>
                                            <tr><td className="font-bold pr-4 text-black">CONTACT NO.</td><td className="text-black">- {settings.contactNo}</td></tr>
                                            <tr><td className="font-bold pr-4 text-black">GMAIL</td><td className="text-black">- {settings.gmail}</td></tr>
                                        </tbody>
                                    </table>
                                    <div className="text-left text-sm">
                                        <div className="flex">
                                            <span className="font-bold w-24 text-black">DATE</span>
                                            <span className="text-black">{isSameDate ? format(new Date(firstDate), "dd MMMM yyyy") : 'Multiple'}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="font-bold w-24 text-black">CHECK NO.</span>
                                            <span className="text-black">'{isSameCheckNo ? firstCheckNo : 'Multiple'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-center font-bold mb-1 text-black">INFORMATION</p>
                                <table className="w-full text-xs border-collapse border border-black">
                                    <thead className="text-black font-bold">
                                        <tr className="print-header-bg" style={{ backgroundColor: '#fce5d5' }}>
                                            <th className="border border-black p-1 text-black">SR.NO.</th>
                                            <th className="border border-black p-1 text-black">NAME</th>
                                            <th className="border border-black p-1 text-black">A/C NO.</th>
                                            <th className="border border-black p-1 text-black">IFSC CODE</th>
                                            <th className="border border-black p-1 text-black">AMMOUNT</th>
                                            <th className="border border-black p-1 text-black">BRANCH</th>
                                            <th className="border border-black p-1 text-black">BANK</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((p, index) => (
                                            <tr key={p.paymentId}>
                                                <td className="border border-black p-1 text-center h-6 text-black">{index + 1}</td>
                                                <td className="border border-black p-1 text-black">{toTitleCase(p.supplierName)}</td>
                                                <td className="border border-black p-1 text-black">'{p.acNo}</td>
                                                <td className="border border-black p-1 text-black">{p.ifscCode}</td>
                                                <td className="border border-black p-1 text-right text-black">{formatCurrency(p.amount)}</td>
                                                <td className="border border-black p-1 text-black">{toTitleCase(p.branch)}</td>
                                                <td className="border border-black p-1 text-black">{p.bank}</td>
                                            </tr>
                                        ))}
                                         {Array.from({ length: Math.max(0, 10 - chunk.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`}>
                                                <td className="border border-black p-1 h-6 text-center text-black">{chunk.length + i + 1}</td>
                                                <td className="border border-black p-1 h-6"></td>
                                                <td className="border border-black p-1 h-6"></td>
                                                <td className="border border-black p-1 h-6"></td>
                                                <td className="border border-black p-1 h-6"></td>
                                                <td className="border border-black p-1 h-6"></td>
                                                <td className="border border-black p-1 h-6"></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                 <div className="flex justify-between items-end mt-12">
                                    <p className="text-sm text-black">(Sign. Of Clerk/Cashier/Teller)</p>
                                    <p className="text-sm text-black">(Signature Of Owner)</p>
                                    <div className="text-right">
                                        <span className="font-bold mr-4 text-black">TOTAL</span>
                                        <span className="font-bold text-black">{formatCurrency(pageTotalAmount)}</span>
                                        {pageIndex === paymentChunks.length - 1 && (
                                            <div className="border-t border-black mt-1 pt-1">
                                                <span className="font-bold mr-4 text-black">GRAND TOTAL</span>
                                                <span className="font-bold text-black">{formatCurrency(grandTotalAmount)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
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

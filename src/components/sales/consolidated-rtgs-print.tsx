

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

import { printHtmlContent } from '@/lib/electron-print';

interface RtgsReportRow {
    paymentId: string;
    id?: string; // Add id as optional for compatibility
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

const BankHeader = ({ settings }: { settings: RtgsSettings }) => (
    <div className="text-orange-700">
        <h3 className="font-bold text-lg">{settings.bankHeaderLine1 || 'बैंक ऑफ़ बड़ौदा'}</h3>
        <h3 className="font-bold text-lg">{settings.bankHeaderLine2 || 'Bank of Baroda'}</h3>
        <p className="text-xs">{settings.bankHeaderLine3 || "India's International Bank"}</p>
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
        return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
    }

    if (!payments || payments.length === 0) {
        return (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                <Printer className="h-12 w-12 text-muted-foreground/50" />
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg">No Payments Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        Please select at least one completed payment to generate the RTGS print format.
                    </p>
                </div>
            </div>
        );
    }

    const paymentChunks = chunkArray(payments, 10);
    const grandTotalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    const handlePrint = async () => {
        const node = printRef.current;
        if (!node) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the content to print.' });
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
                padding: 0;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                color: #000;
                background: #fff;
            }
            .printable-area {
                color: #000 !important;
            }
            .printable-area * {
                color: #000 !important;
            }
            .printable-area h2,
            .printable-area h3,
            .printable-area p,
            .printable-area span {
                margin-top: 0;
                margin-bottom: 2px;
                line-height: 1.1;
            }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-start { align-items: flex-start; }
            .items-end { align-items: flex-end; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .text-xl { font-size: 1.25rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mt-12 { margin-top: 3rem; }
            .information-table {
                width: 100%;
                border-collapse: collapse;
            }
            .information-table th,
            .information-table td {
                border: 1px solid #000;
                padding: 3px 5px;
                font-size: 13px;
            }
            .print-header-bg {
                background-color: #fce5d5;
            }
            .page-break {
                page-break-after: always;
            }
        `;

        try {
            await printHtmlContent(printHtml, printStyles);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Print Failed', description: error.message });
        }
    };


    return (
        <>
            <style>{`
                .information-table {
                    border: 1px solid #666 !important;
                    border-collapse: collapse !important;
                }
                .information-table th,
                .information-table td {
                    border: 1px solid #666 !important;
                }
                .printable-area {
                    color: #000 !important;
                }
                .printable-area * {
                    color: #000 !important;
                }
                /* Preview ke andar bhi line spacing compact rakhen */
                .printable-area p,
                .printable-area h2,
                .printable-area h3,
                .printable-area span,
                .printable-area td,
                .printable-area th {
                    color: #000 !important;
                    margin-top: 0;
                    margin-bottom: 2px;
                    line-height: 1.1;
                }
            `}</style>
            <DialogHeader className="p-4 pb-0 print:hidden">
                <DialogTitle>RTGS Print Preview</DialogTitle>
                <DialogDescription>
                    Review the consolidated RTGS report below before printing.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div ref={printRef}>
                    {paymentChunks.map((chunk, pageIndex) => {
                        const firstDate = chunk.length > 0 ? format(new Date(chunk[0].date), 'yyyy-MM-dd') : '';
                        const isSameDate = chunk.every(p => format(new Date(p.date), 'yyyy-MM-dd') === firstDate);
                        const firstCheckNo = chunk.length > 0 ? String(chunk[0].checkNo || '').trim() : '';
                        const isSameCheckNo = chunk.every(p => String(p.checkNo || '').trim() === firstCheckNo);
                        const pageTotalAmount = chunk.reduce((sum, p) => sum + p.amount, 0);

                        return (
                            <div key={pageIndex} className="p-4 font-sans leading-normal bg-white text-black printable-area page-break">
                                <div className="flex justify-between items-start mb-2">
                                    <BankHeader settings={settings} />
                                    <div className="text-center">
                                        <p className="font-bold text-xs text-black">FORM</p>
                                        <h2 className="font-bold text-xl text-black">{settings.companyName}</h2>
                                        <p className="font-bold text-sm text-black">{settings.companyAddress1}</p>
                                        <p className="font-bold text-sm text-black">{settings.companyAddress2}</p>
                                    </div>
                                    <BankHeader settings={settings} />
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
                                <table className="information-table w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead className="text-black font-bold">
                                        <tr className="print-header-bg" style={{ backgroundColor: '#fce5d5' }}>
                                            <th className="p-1 text-black">SR.NO.</th>
                                            <th className="p-1 text-black">NAME</th>
                                            <th className="p-1 text-black">A/C NO.</th>
                                            <th className="p-1 text-black">IFSC CODE</th>
                                            <th className="p-1 text-black">AMMOUNT</th>
                                            <th className="p-1 text-black">BRANCH</th>
                                            <th className="p-1 text-black">BANK</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map((p, index) => (
                                            <tr key={`${p.paymentId}-${index}`}>
                                                <td className="p-1 text-center h-6 text-black">{index + 1}</td>
                                                <td className="p-1 text-black">{toTitleCase(p.supplierName)}</td>
                                                <td className="p-1 text-black">'{p.acNo}</td>
                                                <td className="p-1 text-black">{p.ifscCode}</td>
                                                <td className="p-1 text-right text-black">{formatCurrency(p.amount)}</td>
                                                <td className="p-1 text-black">{toTitleCase(p.branch)}</td>
                                                <td className="p-1 text-black">{p.bank}</td>
                                            </tr>
                                        ))}
                                         {Array.from({ length: Math.max(0, 10 - chunk.length) }).map((_, i) => (
                                            <tr key={`empty-${i}`}>
                                                <td className="p-1 h-6 text-center text-black">{chunk.length + i + 1}</td>
                                                <td className="p-1 h-6"></td>
                                                <td className="p-1 h-6"></td>
                                                <td className="p-1 h-6"></td>
                                                <td className="p-1 h-6"></td>
                                                <td className="p-1 h-6"></td>
                                                <td className="p-1 h-6"></td>
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
                                        {paymentChunks.length > 1 && pageIndex === paymentChunks.length - 1 && (
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

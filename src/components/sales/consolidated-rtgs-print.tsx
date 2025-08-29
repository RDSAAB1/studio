
"use client";

import React, { useRef } from 'react';
import { RtgsSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    onPrint: () => void;
}

export const ConsolidatedRtgsPrintFormat = ({ payments, settings, onPrint }: ConsolidatedRtgsPrintFormatProps) => {
    const printRef = useRef<HTMLDivElement>(null);
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

    const firstDate = payments.length > 0 ? payments[0].date : '';
    const isSameDate = payments.every(p => p.date === firstDate);
    
    const firstCheckNo = payments.length > 0 ? payments[0].checkNo : '';
    const isSameCheckNo = payments.every(p => p.checkNo === firstCheckNo);

    return (
        <>
            <DialogHeader className="p-4 pb-0 print:hidden">
                <DialogTitle>RTGS Print Preview</DialogTitle>
                <DialogDescription>
                    Review the consolidated RTGS report below before printing.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div id="rtgs-print-content" ref={printRef} className="p-4 bg-white text-black font-sans text-xs">
                    <style>
                        {`
                          @media print {
                            @page {
                              size: A4;
                              margin: 10mm;
                            }
                            body {
                              -webkit-print-color-adjust: exact !important;
                              print-color-adjust: exact !important;
                            }
                            .print-bg-orange {
                                background-color: #fed7aa !important;
                            }
                          }
                        `}
                    </style>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-1/4">
                                <div className="w-24 h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">Bank Logo</div>
                        </div>
                        <div className="w-1/2 text-center">
                            <h1 className="font-bold text-lg">{settings.companyName}</h1>
                            <p>{settings.companyAddress1}</p>
                            <p>{settings.companyAddress2}</p>
                        </div>
                        <div className="w-1/4 text-right">
                            <div className="w-24 h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs ml-auto">Bank Logo</div>
                        </div>
                    </div>

                    {/* Bank Details & Date */}
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <table className="text-left">
                                <tbody>
                                    <tr><td className="font-bold pr-4">BANK NAME</td><td>: {settings.bankName}</td></tr>
                                    <tr><td className="font-bold pr-4">IFSC CODE</td><td>: {settings.ifscCode}</td></tr>
                                    <tr><td className="font-bold pr-4">BRANCH NAME</td><td>: {settings.branchName}</td></tr>
                                    <tr><td className="font-bold pr-4">A/C NO.</td><td>: {settings.accountNo}</td></tr>
                                    <tr><td className="font-bold pr-4">CONTACT NO.</td><td>: {settings.contactNo}</td></tr>
                                    <tr><td className="font-bold pr-4">GMAIL</td><td>: {settings.gmail}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="text-right">
                            <table>
                                <tbody>
                                    {isSameDate && <tr><td className="font-bold pr-4">DATE</td><td>: {format(new Date(firstDate), "dd MMMM yyyy")}</td></tr>}
                                    {isSameCheckNo && <tr><td className="font-bold pr-4">CHECK NO.</td><td>: {firstCheckNo}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Information Table */}
                    <div className="mb-4">
                        <h2 className="text-center font-bold mb-1">INFORMATION</h2>
                        <table className="w-full border-collapse border border-black">
                            <thead>
                                <tr className="bg-orange-200 print-bg-orange">
                                    <th className="border border-black p-1">SR.NO.</th>
                                    <th className="border border-black p-1">NAME</th>
                                    <th className="border border-black p-1">A/C NO.</th>
                                    <th className="border border-black p-1">IFSC CODE</th>
                                    <th className="border border-black p-1">AMOUNT</th>
                                    <th className="border border-black p-1">BRANCH</th>
                                    <th className="border border-black p-1">BANK</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((payment, index) => (
                                    <tr key={payment.paymentId}>
                                        <td className="border border-black p-1 text-center">{index + 1}</td>
                                        <td className="border border-black p-1">{toTitleCase(payment.supplierName || '')}</td>
                                        <td className="border border-black p-1">{payment.acNo}</td>
                                        <td className="border border-black p-1">{payment.ifscCode}</td>
                                        <td className="border border-black p-1 text-right">{formatCurrency(payment.amount)}</td>
                                        <td className="border border-black p-1">{toTitleCase(payment.branch || '')}</td>
                                        <td className="border border-black p-1">{payment.bank}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 15 - payments.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`}>
                                        <td className="border border-black p-2 h-7">-</td><td className="border border-black">-</td><td className="border border-black">-</td><td className="border border-black">-</td><td className="border border-black">-</td><td className="border border-black">-</td><td className="border border-black">-</td>
                                    </tr>
                                ))}
                            </tbody>
                                <tfoot>
                                <tr>
                                    <td colSpan={4} className="text-right font-bold pr-2">TOTAL</td>
                                    <td className="border border-black p-1 text-right font-bold">{formatCurrency(totalAmount)}</td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    <div className="flex justify-between items-end mt-16">
                        <div className="text-center">
                            <p className="border-t border-black pt-1">(Sign. Of Clerk/Cashier/Teller)</p>
                        </div>
                        <div className="text-center">
                                <p className="border-t border-black pt-1">(Firm signature)</p>
                        </div>
                    </div>
                </div>
            </ScrollArea>
             <DialogFooter className="p-4 pt-2 print:hidden">
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
                <Button onClick={onPrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
            </DialogFooter>
        </>
    );
};

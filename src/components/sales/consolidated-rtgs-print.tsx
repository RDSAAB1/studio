
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
                <div id="rtgs-print-content" ref={printRef} className="p-6 bg-white text-black font-sans text-[12px] leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
                    <style>
                        {`
                          @media print {
                            @page {
                              size: A4;
                              margin: 0;
                            }
                            body {
                              -webkit-print-color-adjust: exact !important;
                              print-color-adjust: exact !important;
                            }
                            .printable-area {
                                color: #000 !important;
                            }
                            .printable-area * {
                                border-color: #e5e7eb !important;
                            }
                            .printable-area .bg-gray-800 {
                                background-color: #1f2937 !important;
                            }
                             .printable-area .bg-gray-800 * {
                                color: #fff !important;
                            }
                          }
                        `}
                    </style>
                     <div className="flex-grow-0">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                             <div className="w-1/2">
                                <h2 className="font-bold text-2xl mb-1" style={{ color: '#000' }}>{settings.companyName}</h2>
                                <p className="text-gray-600 text-[11px]" style={{ color: '#000' }}>{settings.companyAddress1}, {settings.companyAddress2}</p>
                                <p className="text-gray-600 text-[11px]" style={{ color: '#000' }}>Phone: {settings.contactNo} | Email: {settings.gmail}</p>
                                <div className="mt-2 text-gray-600 text-[11px] border-t pt-2">
                                    <p className="font-bold" style={{ color: '#000' }}>Our Bank Details:</p>
                                    <p style={{ color: '#000' }}>{settings.bankName}, {settings.branchName}</p>
                                    <p style={{ color: '#000' }}>A/C: {settings.accountNo} | IFSC: {settings.ifscCode}</p>
                                </div>
                            </div>
                             <div className="text-right">
                                <h1 className="text-3xl font-bold text-gray-800 uppercase mb-1" style={{ color: '#000' }}>RTGS ADVICE</h1>
                                <div className="text-sm text-gray-700">
                                    <div className="grid grid-cols-2 text-left">
                                        {isSameDate && <>
                                            <span className="font-bold pr-2" style={{ color: '#000' }}>Date:</span>
                                            <span style={{ color: '#000' }}>{format(new Date(firstDate), "dd MMM, yyyy")}</span>
                                        </>}
                                        {isSameCheckNo && <>
                                            <span className="font-bold pr-2" style={{ color: '#000' }}>Check/UTR #:</span>
                                            <span style={{ color: '#000' }}>{firstCheckNo}</span>
                                        </>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Information Table */}
                        <table className="w-full text-left mb-4 print-table">
                            <thead className="print-bg-orange">
                                <tr className="bg-gray-800 text-white uppercase text-xs">
                                    <th className="p-2 font-semibold text-center w-[5%]">#</th>
                                    <th className="p-2 font-semibold w-[25%]">Payee Name</th>
                                    <th className="p-2 font-semibold w-[20%]">A/C No.</th>
                                    <th className="p-2 font-semibold w-[15%]">IFSC Code</th>
                                    <th className="p-2 font-semibold w-[20%]">Bank & Branch</th>
                                    <th className="p-2 font-semibold text-right w-[15%]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((payment, index) => (
                                    <tr key={payment.paymentId} className="border-b border-gray-200">
                                        <td className="p-2 text-center border-x border-gray-200" style={{ color: '#000' }}>{index + 1}</td>
                                        <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{toTitleCase(payment.supplierName || '')}</td>
                                        <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.acNo}</td>
                                        <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.ifscCode}</td>
                                        <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.bank}, {toTitleCase(payment.branch || '')}</td>
                                        <td className="p-2 text-right font-semibold border-x border-gray-200" style={{ color: '#000' }}>{formatCurrency(payment.amount)}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 15 - payments.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={6}></td></tr>
                                ))}
                            </tbody>
                             <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td className="p-2 text-right" colSpan={5} style={{ color: '#000' }}>GRAND TOTAL</td>
                                    <td className="p-2 text-right" style={{ color: '#000' }}>{formatCurrency(totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    <div className="flex-grow-0">
                        <div className="border-t border-gray-300 pt-4 mt-4">
                            <div className="flex justify-between items-end">
                                <div className="w-3/5">
                                    <h4 className="font-bold mb-2 text-gray-600 uppercase text-xs" style={{ color: '#000' }}>Notes</h4>
                                    <p className="text-gray-600 text-[10px]" style={{ color: '#000' }}>This is a computer-generated advice and does not require a signature.</p>
                                </div>
                                <div className="w-2/5 text-center">
                                    <div className="h-16"></div>
                                    <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                        <p className="font-bold text-sm" style={{ color: '#000' }}>Authorised Signatory</p>
                                        <p className="text-gray-600 text-xs" style={{ color: '#000' }}>For {settings.companyName}</p>
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
                <Button onClick={onPrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
            </DialogFooter>
        </>
    );
};


"use client";

import React from 'react';
import { Payment, RtgsSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';

interface RtgsReceiptProps {
    payment: Payment;
    settings: RtgsSettings;
    onPrint: () => void;
}

export const RtgsReceipt: React.FC<RtgsReceiptProps> = ({ payment, settings, onPrint }) => {

    if (!payment || !settings) {
        return null; // Return null if essential data is missing
    }

    const totalAmount = payment.rtgsAmount || payment.amount || 0;
    const checkNo = payment.checkNo || payment.utrNo || payment.paymentId.replace('P', '');

    return (
        <>
            <DialogHeader className="p-4 pb-0">
                <DialogTitle className="sr-only">Print RTGS Receipt</DialogTitle>
                <DialogDescription className="sr-only">
                    Preview of the RTGS receipt for payment ID: {payment.paymentId}.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div id="rtgs-receipt-content" className="p-6 bg-white text-black font-sans text-[12px] leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
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
                                color: #000 !important;
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
                            </div>
                            <div className="text-right">
                                <h1 className="text-3xl font-bold text-gray-800 uppercase mb-1" style={{ color: '#000' }}>RTGS ADVICE</h1>
                                <div className="text-sm text-gray-700">
                                    <div className="grid grid-cols-2 text-left">
                                        <span className="font-bold pr-2" style={{ color: '#000' }}>Date:</span>
                                        <span style={{ color: '#000' }}>{format(new Date(payment.date), "dd MMM, yyyy")}</span>
                                        <span className="font-bold pr-2" style={{ color: '#000' }}>Check/UTR #:</span>
                                        <span style={{ color: '#000' }}>{checkNo}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        
                        {/* Our Bank Details */}
                        <div className="border border-gray-200 p-3 rounded-lg mb-4">
                            <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs" style={{ color: '#000' }}>Our Bank Details</h3>
                             <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <div><span className="font-semibold" style={{ color: '#000' }}>Bank:</span> <span style={{ color: '#000' }}>{settings.bankName}, {settings.branchName}</span></div>
                                <div><span className="font-semibold" style={{ color: '#000' }}>A/C No:</span> <span style={{ color: '#000' }}>{settings.accountNo}</span></div>
                                <div><span className="font-semibold" style={{ color: '#000' }}>IFSC:</span> <span style={{ color: '#000' }}>{settings.ifscCode}</span></div>
                            </div>
                        </div>

                        {/* Information Table */}
                         <table className="w-full text-left mb-4 print-table">
                            <thead className="print-bg-orange">
                                <tr className="bg-gray-800 text-white uppercase text-xs">
                                    <th className="p-2 font-semibold w-[25%]">Payee Name</th>
                                    <th className="p-2 font-semibold w-[25%]">Bank Name & Branch</th>
                                    <th className="p-2 font-semibold w-[20%]">A/C No.</th>
                                    <th className="p-2 font-semibold w-[15%]">IFSC Code</th>
                                    <th className="p-2 font-semibold text-right w-[15%]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-200">
                                    <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>
                                        <p style={{ color: '#000' }}>{toTitleCase(payment.supplierName || '')}</p>
                                        <p className="text-gray-500 text-[10px]" style={{ color: '#000' }}>S/O: {toTitleCase(payment.supplierFatherName || '')}</p>
                                    </td>
                                    <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.bankName}, {toTitleCase(payment.bankBranch || '')}</td>
                                    <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.bankAcNo}</td>
                                    <td className="p-2 border-x border-gray-200" style={{ color: '#000' }}>{payment.bankIfsc}</td>
                                    <td className="p-2 text-right font-semibold border-x border-gray-200" style={{ color: '#000' }}>{formatCurrency(totalAmount)}</td>
                                </tr>
                                 {Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={i} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={5}></td></tr>
                                ))}
                            </tbody>
                             <tfoot>
                                <tr className="bg-gray-100 font-bold">
                                    <td className="p-2 text-right" colSpan={4} style={{ color: '#000' }}>TOTAL</td>
                                    <td className="p-2 text-right" style={{ color: '#000' }}>{formatCurrency(totalAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    {/* Footer */}
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
             <DialogFooter className="p-4 pt-0 print:hidden">
                <Button variant="outline" onClick={onPrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </DialogFooter>
        </>
    );
}

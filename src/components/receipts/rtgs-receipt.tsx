
"use client";

import React from 'react';
import { Payment } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Printer } from 'lucide-react';

interface RtgsReceiptProps {
    payment: Payment;
    onPrint: () => void;
}

const companyDetails = {
    name: "JAGDAMBE RICE MILL",
    address: "DEVKALI, BANDA",
    city: "SHAHJAHANPUR, (242042)",
};

const bankDetails = {
    bankName: "BANK OF BARODA",
    ifscCode: "BARB0BANDAX",
    branchName: "BANDA",
    accountNo: "08290500004938",
    contactNo: "9794092767",
    gmail: "jrmdofficial@gmail.com",
};

export const RtgsReceipt: React.FC<RtgsReceiptProps> = ({ payment, onPrint }) => {
    const totalAmount = payment.paidFor?.reduce((sum, item) => sum + item.amount, 0) || 0;
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
                <div id="rtgs-receipt-content" className="p-4 bg-white text-black font-sans text-xs">
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
                             {/* Placeholder for Bank Logo */}
                             <div className="w-24 h-12 bg-gray-200 flex items-center justify-center text-gray-500 text-xs">Bank Logo</div>
                        </div>
                        <div className="w-1/2 text-center">
                            <h1 className="font-bold text-lg">{companyDetails.name}</h1>
                            <p>{companyDetails.address}</p>
                            <p>{companyDetails.city}</p>
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
                                    <tr><td className="font-bold pr-4">BANK NAME</td><td>: {bankDetails.bankName}</td></tr>
                                    <tr><td className="font-bold pr-4">IFSC CODE</td><td>: {bankDetails.ifscCode}</td></tr>
                                    <tr><td className="font-bold pr-4">BRANCH NAME</td><td>: {bankDetails.branchName}</td></tr>
                                    <tr><td className="font-bold pr-4">A/C NO.</td><td>: {bankDetails.accountNo}</td></tr>
                                    <tr><td className="font-bold pr-4">CONTACT NO.</td><td>: {bankDetails.contactNo}</td></tr>
                                    <tr><td className="font-bold pr-4">GMAIL</td><td>: {bankDetails.gmail}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="text-right">
                            <table>
                                <tbody>
                                    <tr><td className="font-bold pr-4">DATE</td><td>: {format(new Date(payment.date), "dd MMMM yyyy")}</td></tr>
                                    <tr><td className="font-bold pr-4">CHECK NO.</td><td>: {checkNo}</td></tr>
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
                                {payment.paidFor?.map((item, index) => (
                                    <tr key={index}>
                                        <td className="border border-black p-1 text-center">{index + 1}</td>
                                        <td className="border border-black p-1">{toTitleCase(item.supplierName || '')}</td>
                                        <td className="border border-black p-1">{item.bankAcNo}</td>
                                        <td className="border border-black p-1">{item.bankIfsc}</td>
                                        <td className="border border-black p-1 text-right">{formatCurrency(item.amount)}</td>
                                        <td className="border border-black p-1">{toTitleCase(item.bankBranch || '')}</td>
                                        <td className="border border-black p-1">{item.bankName}</td>
                                    </tr>
                                ))}
                                {/* Fill empty rows */}
                                {Array.from({ length: 15 - (payment.paidFor?.length || 0) }).map((_, i) => (
                                    <tr key={`empty-${i}`}>
                                        <td className="border border-black p-2 h-7">-</td>
                                        <td className="border border-black">-</td>
                                        <td className="border border-black">-</td>
                                        <td className="border border-black">-</td>
                                        <td className="border border-black">-</td>
                                        <td className="border border-black">-</td>
                                        <td className="border border-black">-</td>
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
                    
                    {/* Footer */}
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
             <DialogFooter className="p-4 pt-0">
                <Button variant="outline" onClick={onPrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </DialogFooter>
        </>
    );
}


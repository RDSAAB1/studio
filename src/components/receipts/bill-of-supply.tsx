
"use client";

import React from 'react';
import { Customer, ReceiptSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface BillOfSupplyProps {
    customer: Customer;
    settings: ReceiptSettings;
}

export const BillOfSupply: React.FC<BillOfSupplyProps> = ({ customer, settings }) => {
    
    // Function to convert number to words
    const numberToWords = (num: number): string => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const number = parseFloat(num.toString().split(".")[0]);
        if (number === 0) return "Zero";
        let str = '';
        if (number < 20) {
            str = a[number];
        } else if (number < 100) {
            str = b[Math.floor(number/10)] + a[number%10];
        } else if (number < 1000) {
            str = a[Math.floor(number/100)] + 'hundred ' + numberToWords(number % 100);
        } else if (number < 100000) {
            str = numberToWords(Math.floor(number/1000)) + 'thousand ' + numberToWords(number % 1000);
        } else if (number < 10000000) {
            str = numberToWords(Math.floor(number/100000)) + 'lakh ' + numberToWords(number % 100000);
        } else {
            str = 'Number too large';
        }
        return toTitleCase(str.trim()) + " Only";
    };

    const totalAmount = Number(customer.amount);

    return (
        <div className="p-4 bg-white text-black font-sans text-[10px] border border-black">
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
                    * {
                        color: #000 !important;
                    }
                }
                `}
            </style>
            
            <div className="text-center font-bold mb-2 text-lg">Bill of Supply</div>
            <div className="text-center text-xs mb-2">(Not a Tax Invoice)</div>

            {/* Header */}
            <table className="w-full mb-2">
                <tbody>
                    <tr>
                        <td className="w-1/2 align-top">
                            <h1 className="font-bold text-base">{settings.companyName}</h1>
                            <p>{settings.address1}, {settings.address2}</p>
                            <p>Phone: {settings.contactNo}</p>
                            <p>Email: {settings.email}</p>
                        </td>
                        <td className="w-1/2 align-top text-right">
                             <p><span className="font-bold">Bill No:</span> {customer.srNo}</p>
                             <p><span className="font-bold">Date:</span> {format(new Date(customer.date), "dd-MMM-yyyy")}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            
             {/* Customer Details */}
            <table className="w-full mb-2 border-collapse border border-black">
                 <thead>
                    <tr className="bg-gray-200">
                        <th className="p-1 text-left">Bill To Party</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1 align-top">
                            <p className="font-bold">{toTitleCase(customer.name)}</p>
                             <p>{toTitleCase(customer.address)}</p>
                             <p>Contact: {customer.contact}</p>
                             {customer.companyName && <p>Company: {toTitleCase(customer.companyName)}</p>}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black mb-2">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="p-1 border border-black">SNo.</th>
                        <th className="p-1 border border-black">Description of Goods</th>
                        <th className="p-1 border border-black">Qty</th>
                        <th className="p-1 border border-black">Rate</th>
                        <th className="p-1 border border-black">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1 border border-black text-center">1</td>
                        <td className="p-1 border border-black">{toTitleCase(customer.variety)}</td>
                        <td className="p-1 border border-black text-right">{Number(customer.netWeight).toFixed(2)} Qtl</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(Number(customer.rate))}</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(totalAmount)}</td>
                    </tr>
                     {/* Empty rows for spacing */}
                    {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i}><td className="p-1 border border-black h-6" colSpan={5}></td></tr>
                    ))}
                </tbody>
                <tfoot>
                     <tr className="font-bold">
                        <td className="p-1 border border-black text-right" colSpan={4}>Total</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>

             {/* Footer */}
             <div className="w-full mb-2">
                <p className="font-bold">Amount in Words:</p>
                <p>{numberToWords(totalAmount)}</p>
             </div>

            <div className="border-t border-black pt-2 mt-16">
                 <div className="flex justify-between items-end">
                     <div className="text-center">
                         <p className="font-bold">Receiver's Seal & Signature</p>
                     </div>
                     <div className="text-center">
                        <p className="font-bold mb-8">For {settings.companyName}</p>
                        <p className="border-t border-black pt-1">Authorised Signatory</p>
                     </div>
                 </div>
            </div>
        </div>
    );
}

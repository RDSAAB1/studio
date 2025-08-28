
"use client";

import React from 'react';
import { Customer, ReceiptSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface TaxInvoiceProps {
    customer: Customer;
    settings: ReceiptSettings;
    invoiceDetails: {
        companyGstin: string;
        customerGstin: string;
        hsnCode: string;
        taxRate: number;
    };
}

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ customer, settings, invoiceDetails }) => {
    const taxRate = invoiceDetails.taxRate || 0;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const hsnCode = invoiceDetails.hsnCode || "N/A";

    const taxableAmount = customer.amount;
    const cgstAmount = (taxableAmount * cgstRate) / 100;
    const sgstAmount = (taxableAmount * sgstRate) / 100;
    const totalTaxAmount = cgstAmount + sgstAmount;
    const totalInvoiceValue = taxableAmount + totalTaxAmount;

    // Function to convert number to words
    const numberToWords = (num: number): string => {
        // Basic implementation, can be replaced with a library
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
                }
                `}
            </style>
            
            <div className="text-center font-bold mb-2">Tax Invoice</div>

            {/* Header */}
            <table className="w-full mb-2">
                <tbody>
                    <tr>
                        <td className="w-1/2 align-top">
                            <h1 className="font-bold text-lg">{settings.companyName}</h1>
                            <p>{settings.address1}, {settings.address2}</p>
                            <p>Email: {settings.email}</p>
                            <p>Phone: {settings.contactNo}</p>
                            <p><span className="font-bold">GSTIN:</span> {invoiceDetails.companyGstin}</p>
                        </td>
                        <td className="w-1/2 align-top text-right">
                             <p><span className="font-bold">Invoice No:</span> {customer.srNo}</p>
                             <p><span className="font-bold">Date:</span> {format(new Date(customer.date), "dd-MMM-yyyy")}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            
             {/* Customer Details */}
            <table className="w-full mb-2 border-collapse border border-black">
                 <thead>
                    <tr className="bg-gray-200">
                        <th className="p-1 text-left border-r border-black">Bill To Party</th>
                        <th className="p-1 text-left">Ship To Party</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="w-1/2 p-1 border-r border-black align-top">
                            <p className="font-bold">{toTitleCase(customer.name)}</p>
                            <p>{toTitleCase(customer.address)}</p>
                            <p><span className="font-bold">GSTIN:</span> {invoiceDetails.customerGstin}</p>
                        </td>
                         <td className="w-1/2 p-1 align-top">
                            <p className="font-bold">{toTitleCase(customer.name)}</p>
                            <p>{toTitleCase(customer.address)}</p>
                             <p><span className="font-bold">GSTIN:</span> {invoiceDetails.customerGstin}</p>
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
                        <th className="p-1 border border-black">HSN/SAC</th>
                        <th className="p-1 border border-black">Qty</th>
                        <th className="p-1 border border-black">Rate</th>
                        <th className="p-1 border border-black">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1 border border-black text-center">1</td>
                        <td className="p-1 border border-black">{toTitleCase(customer.variety)}</td>
                        <td className="p-1 border border-black text-center">{hsnCode}</td>
                        <td className="p-1 border border-black text-right">{Number(customer.netWeight).toFixed(2)} Qtl</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(Number(customer.rate))}</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(Number(customer.amount))}</td>
                    </tr>
                     {/* Empty rows for spacing */}
                    {Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i}><td className="p-1 border border-black h-6" colSpan={6}></td></tr>
                    ))}
                </tbody>
                <tfoot>
                     <tr className="font-bold">
                        <td className="p-1 border border-black text-right" colSpan={5}>Total</td>
                        <td className="p-1 border border-black text-right">{formatCurrency(Number(customer.amount))}</td>
                    </tr>
                </tfoot>
            </table>

             {/* Tax Calculation */}
             <table className="w-full mb-2">
                <tbody>
                    <tr>
                        <td className="w-2/3 align-top">
                           <p className="font-bold">Amount in Words:</p>
                           <p>{numberToWords(totalInvoiceValue)}</p>
                        </td>
                        <td className="w-1/3 align-top">
                           <table className="w-full">
                               <tbody>
                                   <tr><td className="text-right pr-2">Subtotal</td><td className="text-right font-bold">{formatCurrency(taxableAmount)}</td></tr>
                                   <tr><td className="text-right pr-2">CGST @{cgstRate}%</td><td className="text-right font-bold">{formatCurrency(cgstAmount)}</td></tr>
                                   <tr><td className="text-right pr-2">SGST @{sgstRate}%</td><td className="text-right font-bold">{formatCurrency(sgstAmount)}</td></tr>
                                   <tr className="border-t border-black"><td className="text-right pr-2 font-bold text-base">Grand Total</td><td className="text-right font-bold text-base">{formatCurrency(totalInvoiceValue)}</td></tr>
                               </tbody>
                           </table>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Footer & Signature */}
            <div className="border-t border-black pt-2">
                 <p className="font-bold mb-1">Terms & Conditions:</p>
                 <ul className="list-disc list-inside text-xs">
                     <li>Subject to Shahjahanpur Jurisdiction only.</li>
                     <li>Goods once sold will not be taken back.</li>
                 </ul>

                 <div className="flex justify-between items-end mt-8">
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

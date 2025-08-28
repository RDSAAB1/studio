
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
        isGstIncluded: boolean;
    };
}

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ customer, settings, invoiceDetails }) => {
    const taxRate = Number(invoiceDetails.taxRate) || 0;
    const isGstIncluded = invoiceDetails.isGstIncluded;

    let taxableAmount: number;
    let totalInvoiceValue: number;
    let rate = Number(customer.rate) || 0;

    if (isGstIncluded) {
        const baseRate = rate / (1 + (taxRate / 100));
        taxableAmount = Number(customer.netWeight) * baseRate;
        totalInvoiceValue = taxableAmount * (1 + (taxRate / 100));
    } else {
        taxableAmount = Number(customer.netWeight) * rate;
        totalInvoiceValue = taxableAmount * (1 + (taxRate / 100));
    }

    const totalTaxAmount = totalInvoiceValue - taxableAmount;
    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;
    
    const hsnCode = invoiceDetails.hsnCode || "N/A";

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

    return (
        <div className="p-6 bg-white text-black font-sans text-[12px] leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
            <style>
                {`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    html, body {
                        height: 100%;
                        margin: 0;
                        padding: 0;
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
                         <h2 className="font-bold text-2xl mb-1">{settings.companyName}</h2>
                         <p className="text-gray-600 text-[11px]">{settings.address1}, {settings.address2}</p>
                         <p className="text-gray-600 text-[11px]">GSTIN: {invoiceDetails.companyGstin}</p>
                         <p className="text-gray-600 text-[11px]">Phone: {settings.contactNo} | Email: {settings.email}</p>
                    </div>
                     <div className="text-right">
                        <h1 className="text-3xl font-bold text-gray-800 uppercase mb-1">TAX INVOICE</h1>
                        <div className="text-sm text-gray-700">
                            <div className="grid grid-cols-2 text-left">
                                <span className="font-bold pr-2">Invoice #:</span>
                                <span>{customer.srNo}</span>
                                <span className="font-bold pr-2">Date:</span>
                                <span>{format(new Date(customer.date), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Due Date:</span>
                                <span>{format(new Date(customer.dueDate), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span>
                                <span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Bill To / Ship To Section */}
                <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
                    <div className="border border-gray-200 p-3 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Bill To</h3>
                        <p className="font-bold text-base">{toTitleCase(customer.name)}</p>
                        {customer.companyName && <p className="text-sm">{toTitleCase(customer.companyName)}</p>}
                        <p className="text-sm">{toTitleCase(customer.address)}</p>
                        <p className="text-sm">Phone: {customer.contact}</p>
                        <p className="text-sm">GSTIN: {invoiceDetails.customerGstin}</p>
                    </div>
                     <div className="border border-gray-200 p-3 rounded-lg">
                         <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Ship To</h3>
                        <p className="font-bold text-base">{toTitleCase(customer.name)}</p>
                        {customer.companyName && <p className="text-sm">{toTitleCase(customer.companyName)}</p>}
                        <p className="text-sm">{toTitleCase(customer.address)}</p>
                        <p className="text-sm">Phone: {customer.contact}</p>
                        <p className="text-sm">GSTIN: {invoiceDetails.customerGstin}</p>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left mb-4 print-table">
                    <thead>
                        <tr className="bg-gray-800 text-white uppercase text-xs">
                            <th className="p-2 font-semibold text-center w-[5%]">#</th>
                            <th className="p-2 font-semibold w-[45%]">Item & Description</th>
                            <th className="p-2 font-semibold text-center w-[15%]">HSN/SAC</th>
                            <th className="p-2 font-semibold text-center w-[15%]">Qty (Qtl)</th>
                            <th className="p-2 font-semibold text-right w-[10%]">Rate</th>
                            <th className="p-2 font-semibold text-right w-[10%]">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="p-2 text-center border-x border-gray-200">1</td>
                            <td className="p-2 border-x border-gray-200">
                                <p className="font-semibold text-base">{toTitleCase(customer.variety)}</p>
                            </td>
                            <td className="p-2 text-center border-x border-gray-200">{hsnCode}</td>
                            <td className="p-2 text-center border-x border-gray-200">{Number(customer.netWeight).toFixed(2)}</td>
                            <td className="p-2 text-right border-x border-gray-200">{formatCurrency(rate)}</td>
                            <td className="p-2 text-right border-x border-gray-200">{formatCurrency(taxableAmount)}</td>
                        </tr>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={6}></td></tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex-grow-0">
                {/* Totals Section & Amount in Words */}
                <div className="flex justify-between mb-4">
                    <div className="w-3/5 pr-4">
                         <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <p className="font-bold mb-1 uppercase text-gray-500 text-xs">Amount in Words:</p>
                            <p className="font-semibold text-gray-800 text-sm">{numberToWords(totalInvoiceValue)}</p>
                        </div>
                    </div>
                    <div className="w-2/5">
                        <div className="flex justify-between p-2 border-b border-gray-200">
                            <span className="font-semibold text-gray-600 text-sm">Taxable Amount:</span>
                            <span className="font-semibold text-sm">{formatCurrency(taxableAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 border-b border-gray-200">
                            <span className="font-semibold text-gray-600 text-sm">CGST ({taxRate/2}%):</span>
                            <span className="text-sm">{formatCurrency(cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 border-b border-gray-200">
                            <span className="font-semibold text-gray-600 text-sm">SGST ({taxRate/2}%):</span>
                            <span className="text-sm">{formatCurrency(sgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 mt-1 bg-gray-800 text-white font-bold rounded-lg text-lg">
                            <span>Balance Due:</span>
                            <span>{formatCurrency(totalInvoiceValue)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-300 pt-4 mt-4">
                    <div className="flex justify-between items-end">
                        <div className="w-3/5">
                            <h4 className="font-bold mb-2 text-gray-600 uppercase text-xs">Terms & Conditions</h4>
                            <ul className="list-disc list-inside text-gray-600 space-y-1 text-[10px]">
                                <li>Goods once sold will not be taken back or exchanged.</li>
                                <li>Interest @18% p.a. will be charged on all overdue payments.</li>
                                <li>All disputes are subject to Shahjahanpur jurisdiction only.</li>
                                <li>Please check the goods on delivery. No claims will be entertained later.</li>
                            </ul>
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
        </div>
    );
}

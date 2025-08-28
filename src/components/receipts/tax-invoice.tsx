
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
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    
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
        <div className="p-8 bg-white text-black font-sans text-[10px] leading-snug flex flex-col justify-between min-h-[29.7cm]">
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
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                    * {
                        color: #000 !important;
                    }
                    .print-table, .print-table th, .print-table td {
                        border-color: #e5e7eb !important;
                    }
                }
                `}
            </style>
            
            <div className="flex-grow-0">
                {/* Header */}
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-1/2">
                         <h2 className="font-bold text-2xl mb-1">{settings.companyName}</h2>
                         <p className="text-xs text-gray-600">{settings.address1}, {settings.address2}</p>
                         <p className="text-xs text-gray-600">GSTIN: {invoiceDetails.companyGstin}</p>
                         <p className="text-xs text-gray-600">Phone: {settings.contactNo} | Email: {settings.email}</p>
                    </div>
                     <div className="text-right">
                        <h1 className="text-4xl font-bold text-gray-800 uppercase mb-2">TAX INVOICE</h1>
                        <div className="text-xs text-gray-700">
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
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 text-xs">
                    <div className="border border-gray-200 p-2 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 text-[11px] uppercase tracking-wider">Bill To</h3>
                        <p className="font-bold">{toTitleCase(customer.name)}</p>
                        {customer.companyName && <p>{toTitleCase(customer.companyName)}</p>}
                        <p>{toTitleCase(customer.address)}</p>
                        <p>Phone: {customer.contact}</p>
                        <p>GSTIN: {invoiceDetails.customerGstin}</p>
                    </div>
                     <div className="border border-gray-200 p-2 rounded-lg">
                         <h3 className="font-bold text-gray-500 mb-2 text-[11px] uppercase tracking-wider">Ship To</h3>
                        <p className="font-bold">{toTitleCase(customer.name)}</p>
                        {customer.companyName && <p>{toTitleCase(customer.companyName)}</p>}
                        <p>{toTitleCase(customer.address)}</p>
                        <p>Phone: {customer.contact}</p>
                        <p>GSTIN: {invoiceDetails.customerGstin}</p>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left mb-4 text-[10px] print-table">
                    <thead>
                        <tr className="bg-gray-800 text-white uppercase">
                            <th className="p-2 font-semibold text-center">#</th>
                            <th className="p-2 font-semibold">Item & Description</th>
                            <th className="p-2 font-semibold text-center">HSN/SAC</th>
                            <th className="p-2 font-semibold text-center">Qty (Qtl)</th>
                            <th className="p-2 font-semibold text-right">Rate</th>
                            <th className="p-2 font-semibold text-right">Taxable Value</th>
                            <th className="p-2 font-semibold text-center">CGST</th>
                            <th className="p-2 font-semibold text-center">SGST</th>
                            <th className="p-2 font-semibold text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="p-2 text-center border-x border-gray-200">1</td>
                            <td className="p-2 border-x border-gray-200">{toTitleCase(customer.variety)}</td>
                            <td className="p-2 text-center border-x border-gray-200">{hsnCode}</td>
                            <td className="p-2 text-center border-x border-gray-200">{Number(customer.netWeight).toFixed(2)}</td>
                            <td className="p-2 text-right border-x border-gray-200">{formatCurrency(rate)}</td>
                            <td className="p-2 text-right border-x border-gray-200">{formatCurrency(taxableAmount)}</td>
                            <td className="p-2 text-center border-x border-gray-200">{cgstRate.toFixed(1)}%</td>
                            <td className="p-2 text-center border-x border-gray-200">{sgstRate.toFixed(1)}%</td>
                            <td className="p-2 text-right border-x border-gray-200">{formatCurrency(totalInvoiceValue)}</td>
                        </tr>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={9}></td></tr>
                        ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-400">
                        <tr className="font-bold">
                            <td colSpan={5} className="p-2 text-right">Total</td>
                            <td className="p-2 text-right">{formatCurrency(taxableAmount)}</td>
                            <td colSpan={2} className="p-2 text-center">{formatCurrency(totalTaxAmount)}</td>
                            <td className="p-2 text-right">{formatCurrency(totalInvoiceValue)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex-grow-0">
                {/* Totals Section & Amount in Words */}
                <div className="flex justify-between mb-4">
                    <div className="w-3/5 text-xs pr-4">
                         <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                            <p className="font-bold mb-1 uppercase text-gray-500 text-[11px]">Amount in Words:</p>
                            <p className="font-semibold text-gray-800">{numberToWords(totalInvoiceValue)}</p>
                        </div>
                    </div>
                    <div className="w-2/5 text-xs">
                        <div className="flex justify-between p-1 border-b border-gray-200">
                            <span className="font-semibold text-gray-600">Taxable Amount:</span>
                            <span>{formatCurrency(taxableAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1 border-b border-gray-200">
                            <span className="font-semibold text-gray-600">CGST ({cgstRate}%):</span>
                            <span>{formatCurrency(cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1 border-b border-gray-200">
                            <span className="font-semibold text-gray-600">SGST ({sgstRate}%):</span>
                            <span>{formatCurrency(sgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1 border-b border-gray-200">
                            <span className="font-semibold text-gray-600">Total Tax:</span>
                            <span>{formatCurrency(totalTaxAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 mt-1 bg-gray-800 text-white font-bold rounded-lg">
                            <span>Balance Due:</span>
                            <span>{formatCurrency(totalInvoiceValue)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-300 pt-4 mt-8 text-xs">
                    <div className="flex justify-between items-end">
                        <div className="w-3/5">
                            <h4 className="font-bold mb-2 text-gray-600 uppercase text-[11px]">Terms & Conditions</h4>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Goods once sold will not be taken back or exchanged.</li>
                                <li>Interest @18% p.a. will be charged on all overdue payments.</li>
                                <li>All disputes are subject to Shahjahanpur jurisdiction only.</li>
                                <li>Please check the goods on delivery. No claims will be entertained later.</li>
                            </ul>
                        </div>
                        <div className="w-2/5 text-center">
                            <div className="h-12"></div>
                            <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                <p className="font-bold">Authorised Signatory</p>
                                <p className="text-gray-600">For {settings.companyName}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


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
        // If rate includes GST, we need to calculate the base price
        const baseRate = rate / (1 + (taxRate / 100));
        taxableAmount = Number(customer.netWeight) * baseRate;
        totalInvoiceValue = taxableAmount * (1 + (taxRate / 100));
    } else {
        // If rate is exclusive of GST
        taxableAmount = Number(customer.netWeight) * rate;
        totalInvoiceValue = taxableAmount * (1 + (taxRate / 100));
    }

    const totalTaxAmount = totalInvoiceValue - taxableAmount;
    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    
    const hsnCode = invoiceDetails.hsnCode || "N/A";
    const balanceDue = customer.netAmount;

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
                <div className="flex justify-between items-start pb-4 border-b">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{settings.companyName}</h1>
                        <p className="text-xs">{settings.address1}, {settings.address2}</p>
                        <p className="text-xs">GSTIN: {invoiceDetails.companyGstin}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-semibold text-gray-600">TAX INVOICE</h2>
                        <p className="text-xs"><span className="font-bold">Invoice #</span> {customer.srNo}</p>
                        <p className="text-xs"><span className="font-bold">Date:</span> {format(new Date(customer.date), "dd MMM, yyyy")}</p>
                    </div>
                </div>
                
                <div className="flex justify-between mt-4 mb-4 text-xs border-b pb-4">
                    <div className="w-1/2 pr-4">
                        <h3 className="font-bold text-gray-500 mb-1 text-[11px] uppercase tracking-wider">Bill To</h3>
                        <p className="font-bold">{toTitleCase(customer.name)}</p>
                        {customer.companyName && <p>{toTitleCase(customer.companyName)}</p>}
                        <p>{toTitleCase(customer.address)}</p>
                        <p>Phone: {customer.contact}</p>
                        <p>GSTIN: {invoiceDetails.customerGstin}</p>
                    </div>
                    <div className="w-1/2 pl-4">
                        <h3 className="font-bold text-gray-500 mb-1 text-[11px] uppercase tracking-wider">Ship To</h3>
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
                        <tr className="bg-gray-100 text-gray-600 uppercase">
                            <th className="p-2 font-semibold text-center border">#</th>
                            <th className="p-2 font-semibold border">Item & Description</th>
                            <th className="p-2 font-semibold text-center border">HSN/SAC</th>
                            <th className="p-2 font-semibold text-center border">Qty (Qtl)</th>
                            <th className="p-2 font-semibold text-right border">Rate</th>
                            <th className="p-2 font-semibold text-right border">Taxable Value</th>
                            <th className="p-2 font-semibold text-center border">CGST</th>
                            <th className="p-2 font-semibold text-center border">SGST</th>
                            <th className="p-2 font-semibold text-right border">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b">
                            <td className="p-2 text-center border">1</td>
                            <td className="p-2 border">{toTitleCase(customer.variety)}</td>
                            <td className="p-2 text-center border">{hsnCode}</td>
                            <td className="p-2 text-center border">{Number(customer.netWeight).toFixed(2)}</td>
                            <td className="p-2 text-right border">{formatCurrency(rate)}</td>
                            <td className="p-2 text-right border">{formatCurrency(taxableAmount)}</td>
                            <td className="p-2 text-center border">{cgstRate.toFixed(1)}%</td>
                            <td className="p-2 text-center border">{sgstRate.toFixed(1)}%</td>
                            <td className="p-2 text-right border">{formatCurrency(totalInvoiceValue)}</td>
                        </tr>
                        {/* Fill empty rows to cover the page */}
                        {Array.from({ length: 15 }).map((_, i) => (
                            <tr key={i} className="border-b"><td className="p-2 h-6 border" colSpan={9}></td></tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-bold">
                            <td colSpan={5} className="p-2 text-right border">Total</td>
                            <td className="p-2 text-right border">{formatCurrency(taxableAmount)}</td>
                            <td colSpan={2} className="p-2 text-center border">{formatCurrency(totalTaxAmount)}</td>
                            <td className="p-2 text-right border">{formatCurrency(totalInvoiceValue)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex-grow-0">
                {/* Totals Section & Amount in Words */}
                <div className="flex justify-between mb-4">
                    <div className="w-3/5 text-xs">
                        <p className="font-bold mb-1">Amount in Words:</p>
                        <p className="font-semibold text-gray-700">{numberToWords(totalInvoiceValue)}</p>
                    </div>
                    <div className="w-2/5 text-xs">
                        <div className="flex justify-between p-1">
                            <span className="font-semibold text-gray-600">Taxable Amount:</span>
                            <span>{formatCurrency(taxableAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1">
                            <span className="font-semibold text-gray-600">CGST ({cgstRate}%):</span>
                            <span>{formatCurrency(cgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1">
                            <span className="font-semibold text-gray-600">SGST ({sgstRate}%):</span>
                            <span>{formatCurrency(sgstAmount)}</span>
                        </div>
                        <div className="flex justify-between p-1">
                            <span className="font-semibold text-gray-600">Total Tax:</span>
                            <span>{formatCurrency(totalTaxAmount)}</span>
                        </div>
                        <div className="flex justify-between p-2 mt-1 bg-gray-200 font-bold">
                            <span>Invoice Total:</span>
                            <span>{formatCurrency(totalInvoiceValue)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t pt-4 mt-8 text-xs">
                    <div className="flex justify-between items-end">
                        <div className="w-3/5">
                            <h4 className="font-bold mb-1">Terms & Conditions</h4>
                            <p className="text-gray-600">Payment is due within 30 days. Subject to Shahjahanpur Jurisdiction only.</p>
                        </div>
                        <div className="w-2/5 text-center">
                            <div className="font-bold mb-8">For {settings.companyName}</div>
                            <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                <p>Authorised Signatory</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    
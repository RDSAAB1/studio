
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

    if (isGstIncluded) {
        totalInvoiceValue = Number(customer.amount);
        taxableAmount = totalInvoiceValue / (1 + (taxRate / 100));
    } else {
        taxableAmount = Number(customer.amount);
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
        <div className="p-8 bg-white text-black font-sans text-sm">
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
                    * {
                        color: #000 !important;
                    }
                }
                `}
            </style>
            
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800">{settings.companyName}</h1>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-semibold text-gray-600">TAX INVOICE</h2>
                    <p className="text-xs"><span className="font-bold">Invoice #</span> {customer.srNo}</p>
                    <p className="text-xs"><span className="font-bold">Date:</span> {format(new Date(customer.date), "dd MMM, yyyy")}</p>
                    <p className="text-xs"><span className="font-bold">Due Date:</span> {format(new Date(customer.dueDate), "dd MMM, yyyy")}</p>
                </div>
            </div>

            {/* Bill From */}
            <div className="mb-4 text-xs">
                <h3 className="font-bold text-gray-600 mb-2">BILL FROM</h3>
                <p className="font-bold">{settings.companyName}</p>
                <p>{settings.address1}</p>
                <p>{settings.address2}</p>
                <p>Phone: {settings.contactNo}</p>
                <p>Email: {settings.email}</p>
                <p>GSTIN: {invoiceDetails.companyGstin}</p>
            </div>
            
            <div className="flex justify-between mb-8 text-xs border-t pt-4">
                 <div className="w-1/2 pr-4">
                    <h3 className="font-bold text-gray-600 mb-2">BILL TO</h3>
                    <p className="font-bold">{toTitleCase(customer.name)}</p>
                    {customer.companyName && <p>{toTitleCase(customer.companyName)}</p>}
                    <p>{toTitleCase(customer.address)}</p>
                    <p>Phone: {customer.contact}</p>
                    <p>GSTIN: {invoiceDetails.customerGstin}</p>
                </div>
                 <div className="w-1/2 pl-4">
                    <h3 className="font-bold text-gray-600 mb-2">SHIP TO</h3>
                    <p className="font-bold">{toTitleCase(customer.name)}</p>
                    {customer.companyName && <p>{toTitleCase(customer.companyName)}</p>}
                    <p>{toTitleCase(customer.address)}</p>
                    <p>Phone: {customer.contact}</p>
                    <p>GSTIN: {invoiceDetails.customerGstin}</p>
                </div>
            </div>


            {/* Items Table */}
            <table className="w-full text-left mb-8 text-xs">
                <thead>
                    <tr className="bg-gray-700 text-white">
                        <th className="p-2 font-semibold">DESCRIPTION</th>
                        <th className="p-2 font-semibold text-right">QTY (Qtl)</th>
                        <th className="p-2 font-semibold text-right">RATE</th>
                        <th className="p-2 font-semibold text-right">AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="border-b">
                        <td className="p-2">{toTitleCase(customer.variety)} (HSN: {hsnCode})</td>
                        <td className="p-2 text-right">{Number(customer.netWeight).toFixed(2)}</td>
                        <td className="p-2 text-right">{formatCurrency(Number(customer.rate))}</td>
                        <td className="p-2 text-right">{formatCurrency(taxableAmount)}</td>
                    </tr>
                    {/* Fill empty rows to cover the page */}
                    {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i} className="border-b"><td className="p-2 h-6" colSpan={4}></td></tr>
                    ))}
                </tbody>
            </table>

            {/* Totals Section */}
            <div className="flex justify-end mb-8">
                <div className="w-2/5 text-xs">
                    <div className="flex justify-between p-1">
                        <span className="font-semibold text-gray-600">Subtotal:</span>
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
                    <div className="flex justify-between p-2 mt-2 bg-gray-200 font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(totalInvoiceValue)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-100 text-red-700 font-bold">
                        <span>Balance Due:</span>
                        <span>{formatCurrency(Number(balanceDue))}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-end mt-16 text-xs absolute bottom-8 w-[calc(100%-4rem)]">
                <div className="w-3/5">
                    <h4 className="font-bold mb-1">Notes</h4>
                    <p className="text-gray-600 mb-4">Thank you for your business.</p>
                    <h4 className="font-bold mb-1">Terms & Conditions</h4>
                    <p className="text-gray-600">Payment is due within 30 days. Subject to Shahjahanpur Jurisdiction only.</p>
                </div>
                <div className="w-2/5 text-center">
                    <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                        <p>Authorized Signature</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

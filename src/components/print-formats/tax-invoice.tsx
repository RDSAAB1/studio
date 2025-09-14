
"use client";

import React from 'react';
import { Customer, ReceiptSettings, BankAccount } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface TaxInvoiceProps {
    customer: Customer;
    settings: ReceiptSettings & { defaultBank?: BankAccount };
    invoiceDetails: {
        companyGstin: string;
        companyStateName: string;
        companyStateCode: string;
        hsnCode: string;
        taxRate: number;
        isGstIncluded: boolean;
        sixRNo: string;
        gatePassNo: string;
        grNo: string;
        grDate: string;
        transport: string;
        totalAdvance: number;
    };
}

const numberToWords = (num: number): string => {
    const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
    const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
    const number = Math.round(num); // Use rounded number for words
    
    if (number === 0) return "Zero";

    const inWords = (n: number): string => {
        let str = '';
        if (n < 20) {
            str = a[n];
        } else if (n < 100) {
            str = b[Math.floor(n / 10)] + a[n % 10];
        } else if (n < 1000) {
            str = inWords(Math.floor(n / 100)) + 'hundred ' + inWords(n % 100);
        } else if (n < 100000) {
            str = inWords(Math.floor(n / 1000)) + 'thousand ' + inWords(n % 1000);
        } else if (n < 10000000) {
            str = inWords(Math.floor(n / 100000)) + 'lakh ' + inWords(n % 100000);
        } else {
            str = inWords(Math.floor(n / 10000000)) + 'crore ' + inWords(n % 10000000);
        }
        return str;
    };
    
    return toTitleCase(inWords(number).trim()) + " Only";
};

const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) amount = 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ customer, settings, invoiceDetails }) => {
    const taxRate = Number(invoiceDetails.taxRate) || 0;
    const isGstIncluded = invoiceDetails.isGstIncluded;

    let taxableAmount: number;
    let totalInvoiceValue: number;
    let rate = Number(customer.rate) || 0;
    const netWeight = Number(customer.netWeight) || 0;
    
    taxableAmount = Math.round(netWeight * rate);

    const totalTaxAmount = Math.round(taxableAmount * (taxRate / 100));
    totalInvoiceValue = taxableAmount + totalTaxAmount + (invoiceDetails.totalAdvance || 0);
    
    const cgstAmount = Math.round(totalTaxAmount / 2);
    const sgstAmount = Math.round(totalTaxAmount / 2);
    
    const hsnCode = invoiceDetails.hsnCode || "N/A";

    const billToDetails = {
        name: toTitleCase(customer.name),
        companyName: customer.companyName ? toTitleCase(customer.companyName) : '',
        address: toTitleCase(customer.address),
        contact: customer.contact,
        gstin: customer.gstin || 'N/A',
        stateName: toTitleCase(customer.stateName || ''),
        stateCode: customer.stateCode || ''
    };

    const shipToDetails = {
        name: toTitleCase(customer.shippingName || customer.name),
        companyName: toTitleCase(customer.shippingCompanyName || ''),
        address: toTitleCase(customer.shippingAddress || customer.address),
        contact: customer.shippingContact || customer.contact,
        gstin: customer.shippingGstin || customer.gstin || 'N/A',
        stateName: toTitleCase(customer.shippingStateName || customer.stateName || ''),
        stateCode: customer.shippingStateCode || customer.stateCode || ''
    };

    return (
        <div className="p-6 bg-white text-black font-sans text-sm leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
            <style>{`
                @media print {
                    body {
                        background-color: #fff !important;
                    }
                    .printable-area, .printable-area * {
                        background-color: #fff !important; 
                        color: #000 !important; 
                        border-color: #ccc !important;
                    }
                    .print-table thead tr {
                        background-color: #f2f2f2 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
            
            <div className="flex-grow-0">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-1/2">
                         <h2 className="font-bold text-3xl mb-1">{settings.companyName}</h2>
                         <p className="text-gray-600 text-sm">{settings.address1}, {settings.address2}</p>
                         <p className="text-gray-600 text-sm">State: {invoiceDetails.companyStateName} (Code: {invoiceDetails.companyStateCode})</p>
                         <p className="text-gray-600 text-sm">GSTIN: {invoiceDetails.companyGstin}</p>
                         <p className="text-gray-600 text-sm">Phone: {settings.contactNo} | Email: {settings.email}</p>
                    </div>
                     <div className="text-right">
                        <h1 className="text-4xl font-bold text-gray-800 uppercase mb-1">TAX INVOICE</h1>
                        <div className="text-base text-gray-700">
                            <div className="grid grid-cols-2 text-left">
                                <span className="font-bold pr-2">Invoice #:</span><span>{customer.srNo}</span>
                                <span className="font-bold pr-2">Date:</span><span>{format(new Date(customer.date), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span><span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8 mb-6">
                    <div className="border border-gray-200 p-4 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Bill To</h3>
                        <p className="font-bold text-lg">{billToDetails.companyName || billToDetails.name}</p>
                        
                        <p className="text-base">{billToDetails.address}</p>
                        <p className="text-base">State: {billToDetails.stateName} (Code: {billToDetails.stateCode})</p>
                        <p className="text-base">Phone: {billToDetails.contact}</p>
                        <p className="text-base">GSTIN: {billToDetails.gstin}</p>
                    </div>
                     <div className="border border-gray-200 p-4 rounded-lg">
                         <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Ship To</h3>
                        <p className="font-bold text-lg">{shipToDetails.companyName || shipToDetails.name}</p>
                        
                        <p className="text-base">{shipToDetails.address}</p>
                        <p className="text-base">State: {shipToDetails.stateName} (Code: {shipToDetails.stateCode})</p>
                        <p className="text-base">Phone: {shipToDetails.contact}</p>
                        <p className="text-base">GSTIN: {shipToDetails.gstin}</p>
                    </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg">
                    <table className="w-full text-left print-table text-base">
                        <thead className="bg-gray-100">
                            <tr className="uppercase text-xs text-gray-600">
                                <th className="p-3 font-semibold text-center">#</th>
                                <th className="p-3 font-semibold">Item &amp; Description</th>
                                <th className="p-3 font-semibold text-center">HSN/SAC</th>
                                <th className="p-3 font-semibold text-center">UOM</th>
                                <th className="p-3 font-semibold text-center">Qty (Qtl)</th>
                                <th className="p-3 font-semibold text-right">Rate</th>
                                <th className="p-3 font-semibold text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-gray-200">
                                <td className="p-3 text-center">1</td>
                                <td className="p-3">
                                    <p className="font-semibold text-lg">{toTitleCase(customer.variety)}</p>
                                </td>
                                <td className="p-3 text-center">{hsnCode}</td>
                                <td className="p-3 text-center">{customer.bags || 'N/A'} Bags</td>
                                <td className="p-3 text-center">{netWeight.toFixed(2)}</td>
                                <td className="p-3 text-right">{formatCurrency(rate)}</td>
                                <td className="p-3 text-right font-semibold">{formatCurrency(taxableAmount)}</td>
                            </tr>
                        </tbody>
                    </table>
                 </div>
                 
                 <div className="border border-gray-200 p-3 rounded-lg mt-4 text-xs grid grid-cols-4 gap-x-4 gap-y-1">
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">6R No:</span><span>{invoiceDetails.sixRNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">Gate Pass No:</span><span>{invoiceDetails.gatePassNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. No:</span><span>{invoiceDetails.grNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. Date:</span><span>{invoiceDetails.grDate}</span></div>
                    <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-600">Transport:</span><span>{invoiceDetails.transport}</span></div>
                 </div>

            </div>

            <div className="flex-grow-0 mt-6">
                <div className="flex justify-between mb-6">
                    <div className="w-3/5 pr-4 space-y-2">
                         <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <p className="font-bold mb-1 uppercase text-gray-500 text-xs">Amount in Words:</p>
                            <p className="font-semibold text-gray-800 text-base">{numberToWords(totalInvoiceValue)}</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-3">
                            <h4 className="font-bold mb-1 text-gray-600 uppercase text-xs">Bank Details</h4>
                            <div className="text-xs space-y-0.5">
                                <p><span className="font-semibold">Bank:</span> {settings.defaultBank?.bankName || ''}</p>
                                <p><span className="font-semibold">A/C No:</span> {settings.defaultBank?.accountNumber || ''}</p>
                                <p><span className="font-semibold">Branch:</span> {settings.defaultBank?.branchName || ''}</p>
                                <p><span className="font-semibold">IFSC:</span> {settings.defaultBank?.ifscCode || ''}</p>
                            </div>
                        </div>
                    </div>
                    <div className="w-2/5 text-base">
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">Taxable Amount:</span><span className="font-semibold">{formatCurrency(taxableAmount)}</span></div>
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">CGST ({taxRate/2}%):</span><span>{formatCurrency(cgstAmount)}</span></div>
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">SGST ({taxRate/2}%):</span><span>{formatCurrency(sgstAmount)}</span></div>
                         {invoiceDetails.totalAdvance > 0 && <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">Freight/Advance:</span><span>{formatCurrency(invoiceDetails.totalAdvance)}</span></div>}
                        <div className="flex justify-between p-3 mt-1 bg-gray-800 text-white font-bold rounded-lg text-xl">
                            <span>Balance Due:</span><span>{formatCurrency(totalInvoiceValue)}</span>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-300 pt-6 mt-6">
                    <div className="flex justify-between items-end">
                        <div className="w-3/5">
                            <h4 className="font-bold mb-2 text-gray-600 uppercase text-xs">Terms &amp; Conditions</h4>
                            <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
                                <li>Goods once sold will not be taken back or exchanged.</li>
                                <li>Interest @18% p.a. will be charged on all overdue payments.</li>
                                <li>All disputes are subject to Shahjahanpur jurisdiction only.</li>
                                <li>Please check the goods on delivery. No claims will be entertained later.</li>
                            </ul>
                        </div>
                        <div className="w-2/5 text-center">
                            <div className="h-20"></div>
                            <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                <p className="font-bold text-base">Authorised Signatory</p>
                                <p className="text-gray-600">For {settings.companyName}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

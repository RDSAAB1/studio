
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
    };
}

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ customer, settings, invoiceDetails }) => {
    const taxRate = Number(invoiceDetails.taxRate) || 0;
    const isGstIncluded = invoiceDetails.isGstIncluded;

    let taxableAmount: number;
    let totalInvoiceValue: number;
    let rate = Number(customer.rate) || 0;
    const netWeight = Number(customer.netWeight) || 0;

    if (isGstIncluded) {
        const baseRate = rate / (1 + (taxRate / 100));
        taxableAmount = netWeight * baseRate;
    } else {
        taxableAmount = netWeight * rate;
    }

    const totalTaxAmount = taxableAmount * (taxRate / 100);
    totalInvoiceValue = taxableAmount + totalTaxAmount;
    
    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;
    
    const hsnCode = invoiceDetails.hsnCode || "N/A";

    const numberToWords = (num: number): string => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const number = Math.round(num); // Use rounded number for words
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
        companyName: customer.shippingCompanyName || '',
        address: toTitleCase(customer.shippingAddress || customer.address),
        contact: customer.shippingContact || customer.contact,
        gstin: customer.shippingGstin || customer.gstin || 'N/A',
        stateName: toTitleCase(customer.shippingStateName || customer.stateName || ''),
        stateCode: customer.shippingStateCode || customer.stateCode || ''
    };

    return (
        <div className="p-6 bg-white text-black font-sans text-sm leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
            <style>{`@media print {body {background-color: #fff !important;}.printable-area, .printable-area * {background-color: #fff !important; color: #000 !important; border-color: #ccc !important;}.print-bg-gray-800 {background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}}`}</style>
            
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
                                <span className="font-bold pr-2">Due Date:</span><span>{format(new Date(customer.dueDate), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span><span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8 mb-6">
                    <div className="border border-gray-200 p-4 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Bill To</h3>
                        <p className="font-bold text-lg">{billToDetails.name}</p>
                        {billToDetails.companyName && <p className="text-base">{billToDetails.companyName}</p>}
                        <p className="text-base">{billToDetails.address}</p>
                        <p className="text-base">State: {billToDetails.stateName} (Code: {billToDetails.stateCode})</p>
                        <p className="text-base">Phone: {billToDetails.contact}</p>
                        <p className="text-base">GSTIN: {billToDetails.gstin}</p>
                    </div>
                     <div className="border border-gray-200 p-4 rounded-lg">
                         <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Ship To</h3>
                        <p className="font-bold text-lg">{shipToDetails.name}</p>
                        {shipToDetails.companyName && <p className="text-base">{shipToDetails.companyName}</p>}
                        <p className="text-base">{shipToDetails.address}</p>
                        <p className="text-base">State: {shipToDetails.stateName} (Code: {shipToDetails.stateCode})</p>
                        <p className="text-base">Phone: {shipToDetails.contact}</p>
                        <p className="text-base">GSTIN: {shipToDetails.gstin}</p>
                    </div>
                </div>

                 <div className="border border-gray-200 p-3 rounded-lg mb-4 text-xs grid grid-cols-4 gap-x-4 gap-y-1">
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">6R No:</span><span>{invoiceDetails.sixRNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">Gate Pass No:</span><span>{invoiceDetails.gatePassNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. No:</span><span>{invoiceDetails.grNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. Date:</span><span>{invoiceDetails.grDate}</span></div>
                    <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-600">Transport:</span><span>{invoiceDetails.transport}</span></div>
                 </div>
                
                <table className="w-full text-left mb-6 print-table text-base">
                    <thead>
                        <tr className="print-bg-gray-800 bg-gray-800 text-black uppercase text-xs">
                            <th className="p-3 font-semibold text-center w-[5%]">#</th>
                            <th className="p-3 font-semibold w-[35%]">Item & Description</th>
                            <th className="p-3 font-semibold text-center w-[10%]">HSN/SAC</th>
                            <th className="p-3 font-semibold text-center w-[10%]">UOM</th>
                            <th className="p-3 font-semibold text-center w-[10%]">Qty (Qtl)</th>
                            <th className="p-3 font-semibold text-right w-[15%]">Rate</th>
                            <th className="p-3 font-semibold text-right w-[15%]">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="p-3 text-center border-x border-gray-200">1</td>
                            <td className="p-3 border-x border-gray-200"><p className="font-semibold text-lg">{toTitleCase(customer.variety)}</p></td>
                            <td className="p-3 text-center border-x border-gray-200">{hsnCode}</td>
                            <td className="p-3 text-center border-x border-gray-200">{customer.bags || 'N/A'} Bags</td>
                            <td className="p-3 text-center border-x border-gray-200">{netWeight.toFixed(2)}</td>
                            <td className="p-3 text-right border-x border-gray-200">{formatCurrency(rate)}</td>
                            <td className="p-3 text-right border-x border-gray-200 font-semibold">{formatCurrency(taxableAmount)}</td>
                        </tr>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-200"><td className="p-3 h-8 border-x border-gray-200" colSpan={7}></td></tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex-grow-0">
                <div className="flex justify-between mb-6">
                    <div className="w-3/5 pr-4">
                         <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <p className="font-bold mb-1 uppercase text-gray-500 text-xs">Amount in Words:</p>
                            <p className="font-semibold text-gray-800 text-base">{numberToWords(totalInvoiceValue)}</p>
                        </div>
                    </div>
                    <div className="w-2/5 text-base">
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">Taxable Amount:</span><span className="font-semibold">{formatCurrency(taxableAmount)}</span></div>
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">CGST ({taxRate/2}%):</span><span>{formatCurrency(cgstAmount)}</span></div>
                        <div className="flex justify-between p-2 border-b border-gray-200"><span className="font-semibold text-gray-600">SGST ({taxRate/2}%):</span><span>{formatCurrency(sgstAmount)}</span></div>
                        <div className="flex justify-between p-3 mt-1 print-bg-gray-800 bg-gray-800 text-black font-bold rounded-lg text-xl">
                            <span>Balance Due:</span><span>{formatCurrency(totalInvoiceValue)}</span>
                        </div>
                    </div>
                </div>
                <div className="border-t border-gray-300 pt-6 mt-6">
                    <div className="flex justify-between items-end">
                        <div className="w-3/5">
                            <h4 className="font-bold mb-2 text-gray-600 uppercase text-xs">Terms & Conditions</h4>
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


"use client";

import React from 'react';
import { Customer, ReceiptSettings } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface ChallanProps {
    customer: Customer;
    settings: ReceiptSettings;
}

export const Challan: React.FC<ChallanProps> = ({ customer, settings }) => {
    
    return (
        <div className="p-6 bg-white text-black font-sans text-sm leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
             <style>
                {`
                @media print {
                    body {
                        background-color: #fff !important;
                    }
                    .printable-area {
                        background-color: #fff !important;
                        color: #000 !important;
                    }
                    .printable-area * {
                        color: #000 !important;
                        border-color: #e5e7eb !important;
                    }
                    .print-bg-gray-800 {
                        background-color: #f2f2f2 !important; /* Light gray for print */
                        color: #000 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
                `}
            </style>
            
            <div className="flex-grow-0">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="w-1/2">
                        <h2 className="font-bold text-2xl mb-1">{settings.companyName}</h2>
                        <p className="text-gray-600 text-xs">{settings.address1}, {settings.address2}</p>
                        <p className="text-gray-600 text-xs">Phone: {settings.contactNo} | Email: {settings.email}</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-3xl font-bold text-gray-800 uppercase mb-1">DELIVERY CHALLAN</h1>
                        <div className="text-sm text-gray-700">
                            <div className="grid grid-cols-2 text-left">
                                <span className="font-bold pr-2">Challan #:</span>
                                <span>{customer.srNo}</span>
                                <span className="font-bold pr-2">Date:</span>
                                <span>{format(new Date(customer.date), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span>
                                <span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consignor / Consignee Section */}
                <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
                    <div className="border border-gray-200 p-3 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Consignor (From)</h3>
                        <p className="font-bold text-base">{settings.companyName}</p>
                        <p className="text-sm">{settings.address1}</p>
                        <p className="text-sm">{settings.address2}</p>
                    </div>
                    <div className="border border-gray-200 p-3 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Consignee (To)</h3>
                        <p className="font-bold text-base">{toTitleCase(customer.name)}</p>
                        <p className="text-sm">{toTitleCase(customer.address)}</p>
                        <p className="text-sm">Contact: {customer.contact}</p>
                    </div>
                </div>
                
                {/* Items Table */}
                <table className="w-full text-left mb-4 print-table">
                    <thead>
                        <tr className="print-bg-gray-800 bg-gray-800 text-black uppercase text-xs">
                            <th className="p-2 font-semibold text-center w-[5%]">#</th>
                            <th className="p-2 font-semibold w-[65%]">Description of Goods</th>
                            <th className="p-2 font-semibold text-center w-[15%]">Quantity (Qtl)</th>
                            <th className="p-2 font-semibold text-center w-[15%]">No. of Bags</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-200">
                            <td className="p-2 text-center border-x border-gray-200">1</td>
                            <td className="p-2 border-x border-gray-200">
                                <p className="font-semibold text-base">{toTitleCase(customer.variety)}</p>
                            </td>
                            <td className="p-2 text-center border-x border-gray-200">{Number(customer.netWeight).toFixed(2)}</td>
                            <td className="p-2 text-center border-x border-gray-200">{customer.bags || 'N/A'}</td>
                        </tr>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={4}></td></tr>
                        ))}
                    </tbody>
                     <tfoot>
                         <tr className="bg-gray-100 font-bold">
                            <td className="p-2 text-right" colSpan={3}>Total Bags</td>
                            <td className="p-2 text-center">{customer.bags || 'N/A'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex-grow-0">
                 {/* Footer & Signature */}
                <div className="border-t border-gray-300 pt-4 mt-4">
                    <div className="flex justify-between items-end">
                        <div className="w-2/5 text-center">
                            <div className="h-16"></div>
                            <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                <p className="font-bold text-sm">Receiver's Signature</p>
                            </div>
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

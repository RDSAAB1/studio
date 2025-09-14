
"use client";

import React from 'react';
import { Customer, ReceiptSettings } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface ChallanProps {
    customer: Customer;
    settings: ReceiptSettings;
    invoiceDetails: {
        sixRNo: string;
        gatePassNo: string;
        grNo: string;
        grDate: string;
        transport: string;
    };
}

const formatCurrency = (amount: number): string => {
  if (isNaN(amount)) amount = 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
};

export const Challan: React.FC<ChallanProps> = ({ customer, settings, invoiceDetails }) => {
    const totalAmount = Math.round(Number(customer.netWeight) * Number(customer.rate));
    
    return (
        <div className="p-6 bg-white text-black font-sans text-sm leading-normal flex flex-col justify-between min-h-[29.7cm] printable-area">
             <style>{`@media print {body {background-color: #fff !important;}.printable-area, .printable-area * {background-color: #fff !important; color: #000 !important; border-color: #ccc !important;}.print-bg-gray-800 {background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}}`}</style>
            
            <div className="flex-grow-0">
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
                                <span className="font-bold pr-2">Challan #:</span><span>{customer.srNo}</span>
                                <span className="font-bold pr-2">Date:</span><span>{format(new Date(customer.date), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span><span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

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

                 <div className="border border-gray-200 p-3 rounded-lg mb-4 text-xs grid grid-cols-4 gap-x-4 gap-y-1">
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">6R No:</span><span>{invoiceDetails.sixRNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">Gate Pass No:</span><span>{invoiceDetails.gatePassNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. No:</span><span>{invoiceDetails.grNo}</span></div>
                    <div className="flex gap-2"><span className="font-semibold text-gray-600">G.R. Date:</span><span>{invoiceDetails.grDate}</span></div>
                    <div className="flex gap-2 col-span-2"><span className="font-semibold text-gray-600">Transport:</span><span>{invoiceDetails.transport}</span></div>
                 </div>
                
                <table className="w-full text-left mb-4 print-table text-base">
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
                            <td className="p-3 text-center border-x border-gray-200">1006</td>
                            <td className="p-3 text-center border-x border-gray-200">{customer.bags || 'N/A'} Bags</td>
                            <td className="p-3 text-center border-x border-gray-200">{Number(customer.netWeight).toFixed(2)}</td>
                            <td className="p-3 text-right border-x border-gray-200">{formatCurrency(Number(customer.rate))}</td>
                            <td className="p-3 text-right border-x border-gray-200 font-semibold">{formatCurrency(totalAmount)}</td>
                        </tr>
                         {Array.from({ length: 8 }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-200"><td className="p-2 h-6 border-x border-gray-200" colSpan={7}></td></tr>
                        ))}
                    </tbody>
                     <tfoot className="bg-gray-100 font-bold">
                         <tr>
                            <td className="p-2 text-right" colSpan={6}>Total Amount</td>
                            <td className="p-2 text-right">{formatCurrency(totalAmount)}</td>
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


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
            
            <div className="text-center font-bold mb-2 text-lg">Delivery Challan</div>

            {/* Header */}
            <table className="w-full mb-2">
                <tbody>
                    <tr>
                        <td className="w-1/2 align-top">
                            <h1 className="font-bold text-base">{settings.companyName}</h1>
                            <p>{settings.address1}, {settings.address2}</p>
                        </td>
                        <td className="w-1/2 align-top text-right">
                             <p><span className="font-bold">Challan No:</span> {customer.srNo}</p>
                             <p><span className="font-bold">Date:</span> {format(new Date(customer.date), "dd-MMM-yyyy")}</p>
                             <p><span className="font-bold">Vehicle No:</span> {customer.vehicleNo.toUpperCase()}</p>
                        </td>
                    </tr>
                </tbody>
            </table>
            
             {/* Customer Details */}
            <table className="w-full mb-2 border-collapse border border-black">
                 <thead>
                    <tr className="bg-gray-200">
                        <th className="p-1 text-left border-r border-black">Consignor (From)</th>
                        <th className="p-1 text-left">Consignee (To)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="w-1/2 p-1 border-r border-black align-top">
                            <p className="font-bold">{settings.companyName}</p>
                            <p>{settings.address1}</p>
                             <p>{settings.address2}</p>
                        </td>
                         <td className="w-1/2 p-1 align-top">
                            <p className="font-bold">{toTitleCase(customer.name)}</p>
                            <p>{toTitleCase(customer.address)}</p>
                             <p>Contact: {customer.contact}</p>
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
                        <th className="p-1 border border-black">Quantity</th>
                        <th className="p-1 border border-black">No. of Bags</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1 border border-black text-center">1</td>
                        <td className="p-1 border border-black">{toTitleCase(customer.variety)}</td>
                        <td className="p-1 border border-black text-right">{Number(customer.netWeight).toFixed(2)} Qtl</td>
                        <td className="p-1 border border-black text-center">{customer.bags || 'N/A'}</td>
                    </tr>
                     {/* Empty rows for spacing */}
                    {Array.from({ length: 15 }).map((_, i) => (
                        <tr key={i}><td className="p-1 border border-black h-6" colSpan={4}></td></tr>
                    ))}
                </tbody>
                 <tfoot>
                     <tr className="font-bold">
                        <td className="p-1 border border-black text-right" colSpan={3}>Total Bags</td>
                        <td className="p-1 border border-black text-center">{customer.bags || 'N/A'}</td>
                    </tr>
                </tfoot>
            </table>

            {/* Footer & Signature */}
            <div className="border-t border-black pt-2 mt-16">
                 <div className="flex justify-between items-end">
                     <div className="text-center">
                        <p className="font-bold mb-8">Received by</p>
                        <p className="border-t border-black pt-1">Receiver's Seal & Signature</p>
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

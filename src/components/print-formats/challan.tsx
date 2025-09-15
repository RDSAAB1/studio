
"use client";

import React from 'react';
import { Customer, ReceiptSettings } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

interface ChallanProps {
    customer: Customer;
    settings: ReceiptSettings;
    invoiceDetails: {
        companyGstin: string;
        companyStateName: string;
        companyStateCode: string;
        sixRNo: string;
        gatePassNo: string;
        grNo: string;
        grDate: string;
        transport: string;
        totalAdvance: number;
    };
}

export const Challan: React.FC<ChallanProps> = ({ customer, settings, invoiceDetails }) => {
    
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
                        <h1 className="text-4xl font-bold text-gray-800 uppercase mb-1">DELIVERY CHALLAN</h1>
                        <div className="text-base text-gray-700">
                            <div className="grid grid-cols-2 text-left">
                                <span className="font-bold pr-2">Challan #:</span><span>{customer.srNo}</span>
                                <span className="font-bold pr-2">Date:</span><span>{format(new Date(customer.date), "dd MMM, yyyy")}</span>
                                <span className="font-bold pr-2">Vehicle No:</span><span>{customer.vehicleNo.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 mb-6">
                     <div className="border border-gray-200 p-4 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Consignor (From)</h3>
                        <p className="font-bold text-lg">{settings.companyName}</p>
                        <p className="text-base">{settings.address1}, {settings.address2}</p>
                        <p className="text-base">GSTIN: {invoiceDetails.companyGstin}</p>
                    </div>
                    <div className="border border-gray-200 p-4 rounded-lg">
                        <h3 className="font-bold text-gray-500 mb-2 uppercase tracking-wider text-xs">Consignee (To)</h3>
                        <p className="font-bold text-lg">{shipToDetails.companyName || shipToDetails.name}</p>
                        <p className="text-base">{shipToDetails.address}</p>
                        <p className="text-base">GSTIN: {shipToDetails.gstin}</p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left print-table text-base">
                       <thead className="print-bg-gray-800">
                            <tr className="uppercase text-xs text-gray-600">
                                <th className="p-3 font-semibold text-center w-[5%]">#</th>
                                <th className="p-3 font-semibold w-[65%]">Description of Goods</th>
                                <th className="p-3 font-semibold text-center w-[15%]">HSN/SAC</th>
                                <th className="p-3 font-semibold text-center w-[15%]">Quantity (Qtl)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t border-gray-200">
                                <td className="p-3 text-center">1</td>
                                <td className="p-3"><p className="font-semibold text-lg">{toTitleCase(customer.variety)}</p></td>
                                <td className="p-3 text-center">{invoiceDetails.hsnCode}</td>
                                <td className="p-3 text-center">{Number(customer.netWeight).toFixed(2)}</td>
                            </tr>
                        </tbody>
                         <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td colSpan={3} className="p-2 text-right">Total Quantity</td>
                                <td className="p-2 text-center">{Number(customer.netWeight).toFixed(2)} Qtl</td>
                            </tr>
                        </tfoot>
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
                <div className="border-t border-gray-300 pt-6 mt-6">
                    <div className="flex justify-between items-end">
                        <div className="w-2/5 text-center">
                            <div className="h-20"></div>
                            <div className="border-t-2 border-gray-400 w-4/5 mx-auto pt-2">
                                <p className="font-bold text-base">Receiver's Signature</p>
                            </div>
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

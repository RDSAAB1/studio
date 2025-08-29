
"use client";

import { format } from 'date-fns';
import type { Customer, ReceiptSettings, ConsolidatedReceiptData, ReceiptFieldSettings } from '@/lib/definitions';
import { formatCurrency, toTitleCase } from '@/lib/utils';

export const ReceiptPreview = ({ data, settings }: { data: Customer; settings: ReceiptSettings; }) => {
    const { fields } = settings;
    return (
        <div className="text-black bg-white font-sans p-4">
             <style>
                {`
                  @media print {
                    @page {
                      size: A6 landscape;
                      margin: 5mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                    .receipt-container {
                        page-break-after: always;
                    }
                  }
                `}
            </style>
            <div className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2">INVOICE</div>
            
            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-2">
                <div>
                    <div className="bg-red-200 text-center font-bold text-xl p-1 border border-black">
                        {settings.companyName}
                    </div>
                    <div className="border-x border-b border-black p-1 text-sm">
                        <p>{settings.address1}</p>
                        <p>{settings.address2}</p>
                        <p>CONTACT NO:- {settings.contactNo}</p>
                        <p>EMAIL:- {settings.email}</p>
                        <div className="h-10 mt-1 bg-gray-200 flex items-center justify-center">
                            <p className="text-xs text-gray-500">Barcode Placeholder</p>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-center font-bold text-xl p-1 border-t border-r border-black">JRM</div>
                    <div className="border-x border-b border-t border-black p-1">
                        <div className="text-center font-bold underline mb-2">CUSTOMER DETAIL</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {fields.date && <tr><td className="font-bold pr-2">DATE</td><td>{format(new Date(data.date), "dd-MMM-yy")}</td></tr>}
                                {fields.name && <tr><td className="font-bold pr-2">NAME</td><td>{toTitleCase(data.name)}</td></tr>}
                                {fields.contact && <tr><td className="font-bold pr-2">CONTACT</td><td>{data.contact}</td></tr>}
                                {fields.address && <tr><td className="font-bold pr-2">ADDRESS</td><td>{toTitleCase(data.address)}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-sm">
                <thead>
                    <tr className="bg-orange-300 text-black font-bold">
                        {fields.vehicleNo && <td className="border border-black p-1 text-center">VEHICLE</td>}
                        {fields.term && <td className="border border-black p-1 text-center">TERM</td>}
                        {fields.rate && <td className="border border-black p-1 text-center">RATE</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-center">LOAD</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-center">UNLOAD</td>}
                        {fields.weight && <td className="border border-black p-1 text-center">QTY</td>}
                        {fields.amount && <td className="border border-black p-1 text-center">AMOUNT</td>}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {fields.vehicleNo && <td className="border border-black p-1">{data.vehicleNo.toUpperCase()}</td>}
                        {fields.term && <td className="border border-black p-1 text-center">{data.term}</td>}
                        {fields.rate && <td className="border border-black p-1 text-right">{Number(data.rate).toFixed(2)}</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-right">{Number(data.grossWeight).toFixed(2)}</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-right">{Number(data.teirWeight).toFixed(2)}</td>}
                        {fields.weight && <td className="border border-black p-1 text-right">{Number(data.weight).toFixed(2)}</td>}
                        {fields.amount && <td className="border border-black p-1 text-right">{formatCurrency(Number(data.amount))}</td>}
                    </tr>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}><td className="border border-black p-2 h-6" colSpan={Object.values(fields).filter(v => v).length - 4}></td></tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-between items-end mt-2">
                <div className="text-sm">
                    <p className="mt-8 border-t border-black pt-1">Authorized Sign</p>
                </div>
                <div className="text-sm">
                    <table className="w-full border-collapse">
                        <tbody>
                            {fields.dueDate && <tr><td className="font-bold border border-black p-1">DUE DATE</td><td className="border border-black p-1 text-right">{format(new Date(data.dueDate), "dd-MMM-yy")}</td></tr>}
                            {fields.kartaWeight && <tr><td className="font-bold border border-black p-1">KARTA</td><td className="border border-black p-1 text-right">{Number(data.kartaWeight).toFixed(2)}</td></tr>}
                            {fields.netAmount && <tr><td className="font-bold border border-black p-1">NET AMOUNT</td><td className="border border-black p-1 text-right font-bold">{formatCurrency(Number(data.netAmount))}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const ConsolidatedReceiptPreview = ({ data, settings }: { data: ConsolidatedReceiptData; settings: ReceiptSettings }) => {
    const { fields } = settings;
    
    const visibleColumns: (keyof ReceiptFieldSettings)[] = [
        'srNo', 'date', 'variety', 'vehicleNo', 'term', 'rate', 'grossWeight', 
        'teirWeight', 'weight', 'kartaWeight', 'netWeight', 'amount', 'dueDate', 'netAmount'
    ];

    const colspan = visibleColumns.filter(key => fields[key]).length;

    return (
        <div className="text-black bg-white font-sans p-4">
             <style>
                {`
                  @media print {
                    @page {
                      size: A4;
                      margin: 10mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                  }
                `}
            </style>
            <div className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2">CONSOLIDATED INVOICE</div>
            
            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-2">
                <div>
                    <div className="bg-red-200 text-center font-bold text-xl p-1 border border-black">
                        {settings.companyName}
                    </div>
                    <div className="border-x border-b border-black p-1 text-sm">
                        <p>{settings.address1}</p>
                        <p>{settings.address2}</p>
                        <p>CONTACT NO:- {settings.contactNo}</p>
                        <p>EMAIL:- {settings.email}</p>
                    </div>
                </div>

                <div>
                    <div className="text-center font-bold text-xl p-1 border-t border-r border-black">JRM</div>
                     <div className="border-x border-b border-t border-black p-1">
                        <div className="text-center font-bold underline mb-2">CUSTOMER DETAIL</div>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr><td className="font-bold pr-2">DATE</td><td>{data.date}</td></tr>
                                <tr><td className="font-bold pr-2">NAME</td><td>{toTitleCase(data.supplier.name)}</td></tr>
                                <tr><td className="font-bold pr-2">S/O</td><td>{toTitleCase(data.supplier.so)}</td></tr>
                                <tr><td className="font-bold pr-2">CONTACT</td><td>{data.supplier.contact}</td></tr>
                                <tr><td className="font-bold pr-2">ADDRESS</td><td>{toTitleCase(data.supplier.address)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-sm my-4">
                <thead>
                    <tr className="bg-orange-300 text-black font-bold">
                        {fields.srNo && <td className="border border-black p-1 text-center">SR No.</td>}
                        {fields.date && <td className="border border-black p-1 text-center">Date</td>}
                        {fields.variety && <td className="border border-black p-1 text-center">Variety</td>}
                        {fields.vehicleNo && <td className="border border-black p-1 text-center">Vehicle</td>}
                        {fields.term && <td className="border border-black p-1 text-center">Term</td>}
                        {fields.rate && <td className="border border-black p-1 text-center">Rate</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-center">Gross Wt.</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-center">Teir Wt.</td>}
                        {fields.weight && <td className="border border-black p-1 text-center">Weight</td>}
                        {fields.kartaWeight && <td className="border border-black p-1 text-center">Karta Wt.</td>}
                        {fields.netWeight && <td className="border border-black p-1 text-center">Net Wt.</td>}
                        {fields.amount && <td className="border border-black p-1 text-center">Amount</td>}
                        {fields.dueDate && <td className="border border-black p-1 text-center">Due Date</td>}
                        {fields.netAmount && <td className="border border-black p-1 text-center">Net Amt.</td>}
                    </tr>
                </thead>
                <tbody>
                    {data.entries.map(entry => (
                         <tr key={entry.id}>
                            {fields.srNo && <td className="border border-black p-1 text-center">{entry.srNo}</td>}
                            {fields.date && <td className="border border-black p-1 text-center">{format(new Date(entry.date), "dd-MMM-yy")}</td>}
                            {fields.variety && <td className="border border-black p-1 text-center">{toTitleCase(entry.variety)}</td>}
                            {fields.vehicleNo && <td className="border border-black p-1 text-center">{entry.vehicleNo.toUpperCase()}</td>}
                            {fields.term && <td className="border border-black p-1 text-center">{entry.term}</td>}
                            {fields.rate && <td className="border border-black p-1 text-right">{Number(entry.rate).toFixed(2)}</td>}
                            {fields.grossWeight && <td className="border border-black p-1 text-right">{Number(entry.grossWeight).toFixed(2)}</td>}
                            {fields.teirWeight && <td className="border border-black p-1 text-right">{Number(entry.teirWeight).toFixed(2)}</td>}
                            {fields.weight && <td className="border border-black p-1 text-right">{Number(entry.weight).toFixed(2)}</td>}
                            {fields.kartaWeight && <td className="border border-black p-1 text-right">{Number(entry.kartaWeight).toFixed(2)}</td>}
                            {fields.netWeight && <td className="border border-black p-1 text-right">{Number(entry.netWeight).toFixed(2)}</td>}
                            {fields.amount && <td className="border border-black p-1 text-right">{formatCurrency(Number(entry.amount))}</td>}
                            {fields.dueDate && <td className="border border-black p-1 text-center">{format(new Date(entry.dueDate), "dd-MMM-yy")}</td>}
                            {fields.netAmount && <td className="border border-black p-1 text-right font-semibold">{formatCurrency(Number(entry.netAmount))}</td>}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-gray-200">
                        <td colSpan={colspan -1} className="border border-black p-1 text-right">GRAND TOTAL</td>
                        {fields.netAmount && <td className="border border-black p-1 text-right">{formatCurrency(data.totalAmount)}</td>}
                    </tr>
                </tfoot>
            </table>

            <div className="flex justify-between items-end mt-16">
                <div className="text-sm">
                    <p className="mt-8 border-t border-black pt-1">Authorized Sign</p>
                </div>
            </div>
        </div>
    );
};

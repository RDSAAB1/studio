

"use client";

import React from 'react';
import { Customer, ReceiptSettings, BankAccount } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

import { MapPin, Phone, Mail, Hash, Calendar, FileText, Wheat } from 'lucide-react';

interface ChallanProps {
    customer: Customer;
    settings: ReceiptSettings & { defaultBank?: BankAccount };
    invoiceDetails: {
        companyGstin: string;
        companyStateName: string;
        companyStateCode: string;
        hsnCode: string;
        taxRate: number;
        isGstIncluded: boolean;
        nineRNo: string;
        gatePassNo: string;
        grNo: string;
        grDate: string;
        lrNo?: string;
        lrDate?: string;
        transport: string;
        vehicleNo?: string;
        totalAdvance: number;
        showBagWeightColumns?: boolean;
    };
}

const getFinancialYear = (date: Date) => {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const startYear = month <= 3 ? year - 1 : year;
    const endYear = startYear + 1;
    return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

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

export const Challan: React.FC<ChallanProps> = ({ customer, settings, invoiceDetails }) => {
    const taxRate = Number(invoiceDetails.taxRate) || 0;
    const isGstIncluded = invoiceDetails.isGstIncluded;
    const showBagWeightColumns = invoiceDetails.showBagWeightColumns !== false; // Default to true
    const rate = Number(customer.rate) || 0;
    const netWeight = Number(customer.netWeight) || 0;
    const advanceFreight = Number(customer.advanceFreight) || 0;
    const bags = Number(customer.bags) || 0;
    const bagWeightKg = Number(customer.bagWeightKg) || 0;
    const grossWeight = Number(customer.grossWeight) || 0;
    const teirWeight = Number(customer.teirWeight) || 0;
    const weight = grossWeight - teirWeight; // Weight before bag deduction
    const bagWeightQtl = (bags * bagWeightKg) / 100; // Convert kg to quintals
    
    // If bag weight columns are hidden, use weight directly; otherwise use netWeight
    const finalWeight = showBagWeightColumns ? netWeight : weight;
    const tableTotalAmount = finalWeight * rate;

    let taxableAmount: number;
    let totalTaxAmount: number;
    let totalInvoiceValue: number;

    if (isGstIncluded) {
        taxableAmount = tableTotalAmount / (1 + (taxRate / 100));
        totalTaxAmount = tableTotalAmount - taxableAmount;
        totalInvoiceValue = tableTotalAmount + advanceFreight;
    } else {
        taxableAmount = tableTotalAmount;
        totalTaxAmount = taxableAmount * (taxRate / 100);
        totalInvoiceValue = taxableAmount + totalTaxAmount + advanceFreight;
    }

    const cgstAmount = totalTaxAmount / 2;
    const sgstAmount = totalTaxAmount / 2;
    
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
        gstin: (customer.shippingGstin || customer.gstin || 'N/A').toUpperCase(),
        stateName: toTitleCase(customer.shippingStateName || customer.stateName || ''),
        stateCode: customer.shippingStateCode || customer.stateCode || ''
    };

    const formatCleanCurrency = (amount: number) => {
        const value = Math.round(amount);
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="p-6 bg-white text-black font-sans text-xs leading-tight flex flex-col min-h-[29.7cm] printable-area border-[1px] border-gray-300 relative">
            <style>{`
                .printable-area { background-color: #ffffff !important; color: #000000 !important; }
                @media print {
                    body { background-color: #fff !important; }
                    .printable-area { border: none !important; padding: 0 !important; margin: 0 !important; }
                    .printable-area * { color: #000 !important; border-color: #000 !important; }
                    .print-bg-gray { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            
            <div className="flex justify-center mb-2">
                <div className="bg-black text-white px-8 py-1 font-black text-sm tracking-[0.4em] uppercase rounded-sm print-bg-black">
                    DELIVERY CHALLAN
                </div>
            </div>

            {/* Header Section - COMPACT Branding */}
            <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-black p-1.5 rounded-full print-bg-black shrink-0">
                            <Wheat className="text-white w-5 h-5" />
                        </div>
                        <h1 className="font-black text-4xl tracking-tighter uppercase text-black leading-none">JAGDAMBE RICE MILL</h1>
                    </div>
                    
                    <div className="ml-10">
                        <div className="flex items-start gap-1.5 text-[10.5px] font-bold text-gray-800 uppercase leading-snug max-w-[450px] mb-1">
                            <MapPin className="w-3 h-3 mt-0.5 text-gray-400 shrink-0" />
                            <span>Devkali Road, Banda, Shahjahanpur, Near Devkali</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px] font-black text-black uppercase mb-3 ml-4.5">
                            <span className="text-gray-400 font-bold">STATE:</span>
                            <span>Uttar Pradesh (09)</span>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 text-[10.5px] font-black uppercase text-gray-700">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                <span>+91-7880555498</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] font-black text-gray-700">
                                <Mail className="w-3.5 h-3.5 text-gray-400" />
                                <span className="lowercase">JRMDofficial@gmail.com</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Hash className="w-3 h-3 text-black" />
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full px-3 py-0.5 print-bg-gray">
                                    <span className="text-[8px] text-gray-400 font-bold tracking-widest mr-1.5 uppercase">GSTIN/UIN:</span>
                                    <span className="text-[10px] font-black text-black">09AAUFJ1162A1ZG</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-end">
                    <div className="border-l-4 border-black pl-4 py-1.5 bg-gray-50/50 pr-4 rounded-r-md">
                        <div className="mb-2">
                            <div className="flex items-center gap-1.5 text-[8.5px] text-gray-400 tracking-widest font-black uppercase mb-0.5">
                                <FileText className="w-2.5 h-2.5" />
                                <span>DOC NO.</span>
                            </div>
                            <p className="text-lg font-black tracking-tighter text-black leading-none">
                                JRM/{getFinancialYear(new Date(customer.date))}/{String(customer.srNo).padStart(3, '0')}
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-[8.5px] text-gray-400 tracking-widest font-black uppercase mb-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>DATE</span>
                            </div>
                            <p className="text-md font-black text-gray-800 leading-none">
                                {format(new Date(customer.date), "dd-MM-yyyy")}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logistics Grid - Inline Labels & Separate GR/LR */}
            <div 
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: '0.4rem 1.5rem' }}
                className="border-y border-black mb-6 py-3 text-[9px] font-black uppercase"
            >
                {/* Row 1 */}
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">VEHICLE NO:</span>
                    <span className="truncate">{(invoiceDetails.vehicleNo || customer.vehicleNo || 'TRUCK').toUpperCase()}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">TRANSPORT:</span>
                    <span className="truncate">{invoiceDetails.transport || 'N/A'}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">GR NO:</span>
                    <span className="truncate">{invoiceDetails.grNo || 'N/A'}</span>
                </div>

                {/* Row 2 */}
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">GR DATE:</span>
                    <span className="truncate">{invoiceDetails.grDate ? format(new Date(invoiceDetails.grDate), "dd-MM-yyyy") : 'N/A'}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">LR NO:</span>
                    <span className="truncate">{invoiceDetails.lrNo || 'N/A'}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">LR DATE:</span>
                    <span className="truncate">{invoiceDetails.lrDate ? format(new Date(invoiceDetails.lrDate), "dd-MM-yyyy") : 'N/A'}</span>
                </div>

                {/* Row 3 */}
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">GATE PASS NO:</span>
                    <span className="truncate">{invoiceDetails.gatePassNo || 'N/A'}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">9R NUMBER:</span>
                    <span className="truncate">{invoiceDetails.nineRNo || 'N/A'}</span>
                </div>
                <div className="flex gap-1.5 border-b border-gray-50 pb-0.5">
                    <span className="text-gray-400 whitespace-nowrap">STATUS:</span>
                    <span className="truncate">{invoiceDetails.nineRNo ? 'CLEARED' : 'PENDING'}</span>
                </div>

                {/* Row 4 */}
                <div className="flex gap-1.5">
                    <span className="text-gray-400 whitespace-nowrap">POS:</span>
                    <span className="truncate">{customer.stateName || 'UP'} (09)</span>
                </div>
                <div className="flex gap-1.5">
                    <span className="text-gray-400 whitespace-nowrap">CONSIGNOR:</span>
                    <span>UP (09)</span>
                </div>
                <div></div>
            </div>

            {/* Enhanced Recipient Cards - PREMIUM REDESIGN */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-left">
                {/* Billed To Card */}
                <div className="relative border border-gray-200 rounded-sm bg-white overflow-hidden print-bg-white">
                    <div className="bg-gray-50 border-b border-gray-200 px-3 py-1 flex items-center gap-2 print-bg-gray">
                        <FileText className="w-3 h-3 text-black" />
                        <span className="text-[8.5px] font-black text-black uppercase tracking-wider">Recipient (Consignee)</span>
                    </div>
                    
                    <div className="px-3 py-2.5">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1 inline-block tracking-tighter">
                            {billToDetails.companyName || billToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[8.5px] font-bold text-gray-500 uppercase leading-snug mb-3 max-w-[280px]">
                            <MapPin className="w-2.5 h-2.5 mt-0.5 text-gray-400 shrink-0" />
                            <span>{billToDetails.address}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-1 pt-2 border-t border-dashed border-gray-200">
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <Hash className="w-2.5 h-2.5" /> GSTIN/UIN
                                </span>
                                <span className="text-[10px] font-black text-black bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-100 print-bg-gray">
                                    {billToDetails.gstin.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <MapPin className="w-2.5 h-2.5" /> STATE
                                </span>
                                <span className="text-[10px] font-black text-black tabular-nums">
                                    {billToDetails.stateName} ({billToDetails.stateCode})
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <Phone className="w-2.5 h-2.5" /> CONTACT
                                </span>
                                <span className="text-[10px] font-black text-black tabular-nums">
                                    {billToDetails.contact || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shipped To Card */}
                <div className="relative border border-gray-200 rounded-sm bg-white overflow-hidden print-bg-white">
                    <div className="bg-gray-50 border-b border-gray-200 px-3 py-1 flex items-center gap-2 print-bg-gray">
                        <MapPin className="w-3 h-3 text-black" />
                        <span className="text-[8.5px] font-black text-black uppercase tracking-wider">Delivery Destination</span>
                    </div>
                    
                    <div className="px-3 py-2.5">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1 inline-block tracking-tighter">
                            {shipToDetails.companyName || shipToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[8.5px] font-bold text-gray-500 uppercase leading-snug mb-3 max-w-[280px]">
                            <MapPin className="w-2.5 h-2.5 mt-0.5 text-gray-400 shrink-0" />
                            <span>{shipToDetails.address}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-1 pt-2 border-t border-dashed border-gray-200">
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <Hash className="w-2.5 h-2.5" /> GSTIN/UIN
                                </span>
                                <span className="text-[10px] font-black text-black bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-100 print-bg-gray">
                                    {shipToDetails.gstin.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <MapPin className="w-3 h-3 text-black" /> STATE
                                </span>
                                <span className="text-[10px] font-black text-black tabular-nums">
                                    {shipToDetails.stateName} ({shipToDetails.stateCode})
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-0.5">
                                <span className="flex items-center gap-1.5 text-[8.5px] font-black text-gray-400 uppercase tracking-tighter">
                                    <Phone className="w-2.5 h-2.5" /> CONTACT
                                </span>
                                <span className="text-[10px] font-black text-black tabular-nums">
                                    {shipToDetails.contact || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Structure */}
            <div className="flex flex-col mb-4 border-y-2 border-black overflow-hidden scale-[0.98] origin-top">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-gray-100 font-black text-[10px] uppercase tracking-tighter print-bg-gray border-b-2 border-black">
                        <tr>
                            <th className="p-4 w-[8%]">SN</th>
                            <th className="p-4 w-[25%]">Packing Description</th>
                            <th className="p-4 w-[42%] text-left">Description of Goods</th>
                            <th className="p-4 w-[10%]">HSN</th>
                            <th className="p-4 w-[15%]">Weight (QTL)</th>
                        </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold uppercase">
                        <tr className="border-b border-gray-100">
                            <td className="p-5 align-top tabular-nums text-gray-300">01.</td>
                            <td className="p-5 align-top tabular-nums leading-tight">
                                <span className="block text-2xl font-black">{customer.bags || '0'}</span>
                                <span className="text-[9px] uppercase tracking-tighter text-gray-400">Total Bags Loaded</span>
                            </td>
                            <td className="p-5 align-top text-left font-black">
                                <p className="text-xl leading-none mb-2">{customer.variety}</p>
                                <p className="text-[10px] text-gray-400 italic font-medium">"Goods under transit for further supply"</p>
                            </td>
                            <td className="p-5 align-top tabular-nums text-gray-400">{hsnCode}</td>
                            <td className="p-5 align-top tabular-nums font-black text-lg bg-gray-50/20">
                                {showBagWeightColumns ? (
                                    <div className="flex flex-col gap-0">
                                        <span className="text-gray-200 text-[11px] line-through">{weight.toFixed(2)}</span>
                                        <span className="text-red-400 text-[10px] italic mt-[-2px]">-{bagWeightQtl.toFixed(2)}</span>
                                        <div className="h-[1px] bg-gray-100 w-full my-1"></div>
                                        <span className="font-black text-2xl">{netWeight.toFixed(2)} QTL</span>
                                    </div>
                                ) : (
                                    <span className="font-black text-2xl">{netWeight.toFixed(2)} QTL</span>
                                )}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot className="bg-gray-50/50 font-black text-[14px] print-bg-gray border-t-2 border-black">
                        <tr>
                            <td colSpan={4} className="p-4 text-right uppercase tracking-[0.3em] text-gray-400">Net Weight Assessment:</td>
                            <td className="p-4 text-center tabular-nums text-black bg-black/5">{netWeight.toFixed(2)} QTL</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Challan Footer / Declaration */}
            <div className="grid grid-cols-12 gap-6 mb-8 items-start">
                <div className="col-span-12 p-6 bg-gray-100 rounded-xl border-l-[10px] border-black print-bg-gray">
                    <h4 className="font-black text-[10px] uppercase tracking-[0.4em] text-gray-400 mb-2">Legal Declaration:</h4>
                    <p className="text-[11px] font-bold italic leading-relaxed text-gray-700 uppercase">
                        "We hereby certify that the goods described in this delivery challan are being transported for supply/usage and the particulars are true and correct. The recipient is requested to verify the seals and weight at the time of delivery."
                    </p>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-12 items-end pt-10 border-t-4 border-black border-double">
                <div className="space-y-4">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-snug">
                        <p>Transit Authorization: Cleared</p>
                        <p>Gate Pass Reference: {invoiceDetails.gatePassNo || 'N/A'}</p>
                        <p>Jurisdiction: Shahjahanpur (UP)</p>
                    </div>
                </div>
                <div className="text-center">
                    <div className="border-t-4 border-black pt-4">
                        <p className="font-black text-2xl uppercase tracking-tighter text-black leading-none italic">Authorised Signatory</p>
                        <p className="font-black text-[11px] text-gray-400 uppercase tracking-widest mt-2">FOR JAGDAMBE RICE MILL</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

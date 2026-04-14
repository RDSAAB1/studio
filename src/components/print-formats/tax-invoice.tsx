

"use client";

import React from 'react';
import { Customer, ReceiptSettings, BankAccount } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

import { MapPin, Phone, Mail, Building, Hash, Calendar, FileText, Wheat, Globe, Truck } from 'lucide-react';

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

export const TaxInvoice: React.FC<TaxInvoiceProps> = ({ customer, settings, invoiceDetails }) => {
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
        <div className="p-6 pt-2 bg-white text-black font-sans text-xs leading-tight flex flex-col min-h-[29.7cm] printable-area border-[1px] border-gray-300 relative" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .printable-area { border: none !important; padding: 0 !important; margin: 0 !important; }
                    .print-bg-black { background-color: #000000 !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
                    .print-bg-gray { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; }
                    .print-bg-slate { background-color: #1e293b !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
            
            {/* Compact Slate Document Title */}
            <div className="w-full flex justify-center mb-4">
                <div className="bg-slate-100 border-2 border-slate-900 px-8 py-1 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-base font-black uppercase tracking-[0.3em] text-slate-900 leading-none">
                        TAX INVOICE
                    </span>
                </div>
            </div>

            {/* Optimized Visual Header */}
            <div className="flex justify-between items-end mb-10 pt-2">
                {/* Left: Branding & Identity */}
                <div className="flex flex-col">
                    <h1 className="font-black text-4xl tracking-widest uppercase text-slate-900 leading-none mb-4">
                        {settings.companyName || "JAGDAMBE RICE MILL"}
                    </h1>

                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                            <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                {settings.companyAddress1 || "DEVKALI ROAD, BANDA, SHAJAHANPUR"}
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <Building className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                            <span className="text-[12px] font-black text-slate-950 uppercase leading-none tracking-tight">
                                {String(settings.companyStateName || "UTTAR PRADESH").toUpperCase()} (09)
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <Phone className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                            <span className="text-[14px] font-black text-slate-950 leading-none tracking-tight">
                                +91-{settings.contactNo || "7880555498"}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <Mail className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                            <span className="text-[14px] font-black text-slate-950 leading-none">
                                {settings.gmail || "JRMDofficial@gmail.com"}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mt-1">
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-4 py-2 rounded-full print-bg-gray shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">GSTIN/UIN:</span>
                                <span className="text-[13px] font-black text-slate-950 tabular-nums leading-none uppercase">
                                    {settings.companyGstin || "09AAUFJ1162A1ZG"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Modern Metadata Stack */}
                <div className="flex flex-col gap-3 items-end pb-1">
                    <div className="flex items-center gap-3">
                        <FileText className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                        <span className="text-[15px] font-black text-slate-950 tabular-nums tracking-widest uppercase leading-none">
                            JRM/{getFinancialYear(new Date(customer.date))}/{String(customer.srNo).padStart(4, '0')}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 stroke-2" />
                        <span className="text-[15px] font-black text-slate-950 tabular-nums leading-none tracking-tight">{format(new Date(customer.date), "dd-MM-yyyy")}</span>
                    </div>
                </div>
            </div>



            {/* Logistics Grid - A4 OPTIMIZED */}
            {/* Elite Logistics Matrix */}
            <div className="border-y-2 border-slate-900 py-3 mb-8">
                <div className="grid grid-cols-3 gap-x-12 gap-y-1.5 text-left">
                    {/* Row 1 */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">9R NUMBER:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{String(invoiceDetails.nineRNo || 'N/A').toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">LR NO:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{String(invoiceDetails.lrNo || 'N/A').toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">GR NO:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{String(invoiceDetails.grNo || 'N/A').toUpperCase()}</span>
                    </div>

                    {/* Row 2 */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">GATE PASS NO:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{String(invoiceDetails.gatePassNo || 'N/A').toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">LR DATE:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{invoiceDetails.lrDate ? format(new Date(invoiceDetails.lrDate), "dd-MM-yyyy") : 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">GR DATE:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{invoiceDetails.grDate ? format(new Date(invoiceDetails.grDate), "dd-MM-yyyy") : 'N/A'}</span>
                    </div>

                    {/* Row 3: Expansive Logistics Row */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">VEHICLE NO:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{(invoiceDetails.vehicleNo || customer.vehicleNo || 'N/A').toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                        <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">TRANSPORT:</span>
                        <span className="text-[11.5px] font-black text-slate-950 uppercase truncate">{String(invoiceDetails.transport || 'N/A').toUpperCase()}</span>
                    </div>
                </div>
            </div>


            {/* Symmetrical Billing Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Billed To Card */}
                <div className="relative border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm flex flex-col print:shadow-none print:border-slate-300">
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center gap-2 print-bg-gray">
                        <FileText className="w-4.5 h-4.5 text-slate-900" />
                        <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-widest">Billed To (Receiver)</span>
                    </div>
                    
                    <div className="px-3 py-4 flex-1 text-left">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1.5 tracking-tighter">
                            {billToDetails.companyName || billToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[10.5px] font-bold text-slate-500 uppercase leading-snug mb-5 min-h-[2.5rem]">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                            <span className="max-w-[280px]">{billToDetails.address}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">GSTIN/UIN</span>
                                <span className="text-[10px] font-black text-slate-950 tabular-nums leading-none tracking-tight underline decoration-slate-100">{billToDetails.gstin.toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-3">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">STATE & CODE</span>
                                <span className="text-[8.5px] font-black text-slate-900 leading-tight uppercase italic">{billToDetails.stateName} ({billToDetails.stateCode || "09"})</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-3">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">CONTACT</span>
                                <span className="text-[8.5px] font-black text-slate-900 leading-tight tabular-nums italic">{billToDetails.contact || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shipped To Card */}
                <div className="relative border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm flex flex-col print:shadow-none print:border-slate-300">
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center gap-2 print-bg-gray">
                        <Truck className="w-4.5 h-4.5 text-slate-900" />
                        <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-widest">Shipped To (Consignee)</span>
                    </div>
                    
                    <div className="px-3 py-4 flex-1 text-left">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1.5 tracking-tighter">
                            {shipToDetails.companyName || shipToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[10.5px] font-bold text-slate-500 uppercase leading-snug mb-5 min-h-[2.5rem]">
                            <MapPin className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                            <span className="max-w-[280px]">{shipToDetails.address}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-50 pt-3">
                            <div className="flex flex-col">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">GSTIN/UIN</span>
                                <span className="text-[10px] font-black text-slate-950 tabular-nums leading-none tracking-tight underline decoration-slate-100">{shipToDetails.gstin.toUpperCase()}</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-3">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">STATE & CODE</span>
                                <span className="text-[8.5px] font-black text-slate-900 leading-tight uppercase italic">{shipToDetails.stateName} ({shipToDetails.stateCode || "09"})</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-100 pl-3">
                                <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none mb-1.5 tracking-tighter">CONTACT</span>
                                <span className="text-[8.5px] font-black text-slate-900 leading-tight tabular-nums italic">{shipToDetails.contact || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Optimized GST Table - ELITE Corporate Styling */}
            <div className="flex flex-col mb-6 border-t-4 border-b-2 border-slate-900 overflow-hidden print:border-black">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-slate-50 text-slate-900 print:!bg-slate-50 print:!text-black border-b-2 border-slate-900">
                        <tr className="text-[9px] font-black uppercase tracking-widest">
                            <th className="py-2.5 px-2 border-r border-slate-200">SN</th>
                            <th className="py-2.5 px-4 border-r border-slate-200 text-left">Item Description</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Packaging</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">HSN</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Quantity Detail</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Rate</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Taxable</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">CGST</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">SGST</th>
                            <th className="py-2.5 px-2">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-black/10">
                         <tr className="text-[10px] font-medium text-slate-900 group border-b border-slate-100">
                            <td className="py-2.5 px-3 font-black border-r border-slate-50 italic">1.</td>
                            <td className="py-2.5 px-3 text-left border-r border-slate-50">
                                <div className="font-black text-[13px] text-slate-950 leading-none uppercase tracking-tight">{customer.variety}</div>
                                <div className="text-[7.5px] font-bold text-slate-400 mt-1 uppercase tracking-wider">High Grade Premium Processing</div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-50">
                                <div className="font-black text-md">{bags}</div>
                                <div className="text-[7px] font-bold text-slate-400">({bagWeightKg} KG)</div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-50 font-black">{hsnCode}</td>
                            <td className="py-2.5 px-3 border-r border-slate-50">
                                <div className="font-black text-slate-400 text-[8px] mb-0.5">NET WEIGHT</div>
                                <div className="font-black text-md">{netWeight.toFixed(2)} QTL</div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-50 font-black tabular-nums">{formatCleanCurrency(rate / (isGstIncluded ? (1 + (taxRate/100)) : 1))}</td>
                            <td className="py-2.5 px-3 border-r border-slate-50 font-black tabular-nums">{formatCleanCurrency(taxableAmount)}</td>
                            <td className="py-2.5 px-3 border-r border-slate-50 tabular-nums">
                                <div className="font-black">{formatCleanCurrency(cgstAmount)}</div>
                                <div className="text-[7px] font-bold text-slate-400">({(taxRate / 2).toFixed(1)}%)</div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-50 tabular-nums">
                                <div className="font-black">{formatCleanCurrency(sgstAmount)}</div>
                                <div className="text-[7px] font-bold text-slate-400">({(taxRate / 2).toFixed(1)}%)</div>
                            </td>
                            <td className="py-2.5 px-3 font-black tabular-nums bg-slate-50/50 print:bg-transparent">{formatCleanCurrency(tableTotalAmount)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 text-slate-950 font-black uppercase text-[10px] tracking-widest print:!bg-slate-50 print:!text-black border-t-2 border-slate-900">
                            <td colSpan={6} className="p-2.5 text-right border-r border-slate-200 uppercase tracking-widest opacity-80 italic">Summary Recapitulation</td>
                            <td className="p-2.5 text-right border-r border-slate-200 tabular-nums font-black text-slate-950 underline decoration-slate-200 underline-offset-4">{formatCleanCurrency(taxableAmount)}</td>
                            <td className="p-2.5 border-r border-slate-200 tabular-nums font-black text-slate-950">{formatCleanCurrency(cgstAmount)}</td>
                            <td className="p-2.5 border-r border-slate-200 tabular-nums font-black text-slate-950">{formatCleanCurrency(sgstAmount)}</td>
                            <td className="p-2.5 text-right bg-slate-100 text-slate-950 font-black tabular-nums pr-4 border-l-2 border-slate-900">{formatCleanCurrency(tableTotalAmount)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* PHASE 1: FULL-WIDTH SETTLEMENT LAYER */}
            <div className="mb-6">
                <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 grid grid-cols-4 gap-8 print:border-slate-200 shadow-sm print-bg-gray">
                    <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Beneficiary Bank</span>
                        <span className="text-[11px] font-black text-slate-900 uppercase truncate underline decoration-slate-100 decoration-2 underline-offset-4">{settings.defaultBank?.bankName || settings.bankName}</span>
                    </div>
                    <div className="flex flex-col gap-1 border-l border-slate-100 pl-6">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Number</span>
                        <span className="text-[13px] font-black text-slate-950 tabular-nums leading-none">{settings.defaultBank?.accountNumber || settings.accountNo}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-100 pl-6">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IFSC Designation</span>
                        <span className="text-[11px] font-black text-slate-900 tabular-nums tracking-tighter">{settings.defaultBank?.ifscCode || settings.ifscCode}</span>
                    </div>
                    <div className="flex flex-col border-l border-slate-100 pl-6">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Account Nature</span>
                        <span className="text-[10px] font-black text-slate-900 uppercase italic">Business Current</span>
                    </div>
                </div>
            </div>

            {/* PHASE 2: SPLIT ARCHITECTURE (TERMS & TOTALS) */}
            <div className="grid grid-cols-12 gap-8 items-start mb-8">
                 {/* Left: Words & Terms */}
                 <div className="col-span-8 flex flex-col gap-4">
                     <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-inner">
                        <div className="flex items-center gap-4 mb-3 opacity-60">
                             <Wheat className="w-5 h-5 text-slate-400" />
                             <div className="h-px flex-1 bg-slate-200"></div>
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Amount In Words</span>
                        <p className="text-[12px] font-black uppercase text-slate-950 italic tracking-tight leading-tight">
                            {numberToWords(totalInvoiceValue).replace(/only/gi, '').trim()} ONLY
                        </p>
                        
                        <div className="mt-4 pt-4 border-t border-slate-100">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">GST In Words</span>
                             <p className="text-[9px] font-black text-slate-900 uppercase italic leading-none truncate">
                                {(cgstAmount + sgstAmount) > 0 ? (numberToWords(cgstAmount + sgstAmount).replace(/only/gi, '').trim() + " ONLY") : "ZERO TAXATION APPLICABLE"}
                             </p>
                        </div>
                     </div>

                     <div className="text-[10px] font-bold text-slate-500 uppercase space-y-1.5 italic border-l-4 border-slate-900 pl-5 py-2">
                        <p className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div> WE DECLARED THAT THIS INVOICE SHOWS THE ACTUAL PRICE OF THE GOODS DESCRIBED AND THAT PARTICULARS ARE TRUE AND CORRECT.</p>
                        <p className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div> SUBJECT TO SHAHJAHANPUR JURISDICTION.</p>
                     </div>
                 </div>

                 {/* Right: Monumental Totals & Signatory */}
                 <div className="col-span-4 flex flex-col pt-1">
                     <div className="flex flex-col gap-2 mb-6">
                         <div className="flex justify-between items-center px-4 py-1.5 border-b border-slate-100">
                             <span className="text-[9px] font-black text-slate-400 uppercase">Gross Taxable Total</span>
                             <span className="text-[13px] font-black text-slate-900 tabular-nums">{formatCleanCurrency(taxableAmount)}</span>
                         </div>
                         <div className="flex justify-between items-center px-4 py-1.5 border-b border-slate-100">
                             <span className="text-[9px] font-black text-slate-500 uppercase italic">CGST Output Tax</span>
                             <span className="text-[11px] font-black text-slate-950 tabular-nums">{formatCleanCurrency(cgstAmount)}</span>
                         </div>
                         <div className="flex justify-between items-center px-4 py-1.5 border-b border-slate-100">
                             <span className="text-[9px] font-black text-slate-500 uppercase italic">SGST Output Tax</span>
                             <span className="text-[11px] font-black text-slate-950 tabular-nums">{formatCleanCurrency(sgstAmount)}</span>
                         </div>
                         {advanceFreight > 0 && <div className="flex justify-between items-center px-4 py-1.5 bg-red-50 text-red-700">
                             <span className="text-[9px] font-black uppercase">Less: Advance Value</span>
                             <span className="text-[12px] font-black">-{formatCleanCurrency(advanceFreight)}</span>
                         </div>}
                         <div className="mt-2 p-5 bg-white border-y-4 border-slate-900 flex flex-col items-end shadow-md">
                             <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 leading-none italic">Final Net Payable</span>
                             <div className="text-3xl font-black text-slate-950 italic tracking-tighter tabular-nums leading-none">
                                {formatCleanCurrency(totalInvoiceValue)}
                             </div>
                         </div>
                     </div>

                     <div className="mt-auto pt-8 border-t-2 border-slate-900 text-center relative self-end w-full max-w-[240px]">
                         <p className="font-black text-[9px] text-slate-400 uppercase tracking-widest mb-2 leading-none">FOR {String(settings.companyName || "JAGDAMBE RICE MILL").toUpperCase()}</p>
                         <p className="font-black text-[16px] uppercase tracking-tighter text-slate-950 italic">Authorised Signatory</p>
                     </div>
                 </div>
            </div>



            <div className="mt-8 pt-4 border-t border-slate-100 print:border-black/5 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight italic leading-none">
                    This is a computer generated invoice.
                </p>
            </div>
        </div>
    );
};



"use client";

import React from 'react';
import { Customer, ReceiptSettings, BankAccount } from '@/lib/definitions';
import { toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';

import { MapPin, Phone, Mail, Building2, Hash, Calendar, FileText, Wheat, Globe, Truck } from 'lucide-react';

interface BillOfSupplyProps {
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


export const BillOfSupply: React.FC<BillOfSupplyProps> = ({ customer, settings, invoiceDetails }) => {
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

    const totalBagWeight = (bags * bagWeightKg) / 100;

    return (
        <div className="p-6 pt-2 bg-white text-black font-sans text-xs leading-tight flex flex-col min-h-[29.7cm] printable-area border-[1px] border-gray-300 relative" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <style>{`
                @media print {
                    body { background-color: #fff !important; }
                    .printable-area { border: none !important; padding: 0 !important; margin: 0 !important; }
                    .print-bg-black { background-color: #000000 !important; color: #ffffff !important; -webkit-print-color-adjust: exact; }
                    .print-bg-gray { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>
            
            {/* Compact Slate Document Title */}
            <div className="w-full flex justify-center mb-4">
                <div className="bg-slate-100 border-2 border-slate-900 px-8 py-1 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-base font-black uppercase tracking-[0.3em] text-slate-900 leading-none">
                        BILL OF SUPPLY
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
                            <Building2 className="w-3.5 h-3.5 text-slate-400 stroke-2" />
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



            {/* Elite Logistics Matrix */}
            <div className="border-y-2 border-slate-900 py-3 mb-4">
                <div className="grid grid-cols-3 gap-x-12 gap-y-1.5">
                    {/* Column 1: Primary Document Identifiers */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">9R NUMBER:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{String(invoiceDetails.nineRNo || 'N/A').toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">GATE PASS NO:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{String(invoiceDetails.gatePassNo || 'N/A').toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">VEHICLE NO:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{(invoiceDetails.vehicleNo || customer.vehicleNo || 'N/A').toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Column 2: Logistics & Transportation */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">LR NO:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{String(invoiceDetails.lrNo || 'N/A').toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">LR DATE:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{invoiceDetails.lrDate ? format(new Date(invoiceDetails.lrDate), "dd-MM-yyyy") : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">TRANSPORT:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{String(invoiceDetails.transport || 'N/A').toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Column 3: Regulatory Tracking */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">GR NO:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{String(invoiceDetails.grNo || 'N/A').toUpperCase()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase">GR DATE:</span>
                            <span className="text-[11.5px] font-black text-slate-950 uppercase">{invoiceDetails.grDate ? format(new Date(invoiceDetails.grDate), "dd-MM-yyyy") : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>


            {/* Symmetrical Billing Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Billed To Card */}
                <div className="relative border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm flex flex-col print:shadow-none print:border-slate-300">
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-1.5 flex items-center gap-2 print-bg-gray">
                        <FileText className="w-4 h-4 text-slate-900" />
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Billed To (Receiver)</span>
                    </div>
                    
                    <div className="px-3 py-4 flex-1 text-left">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1.5 tracking-tighter">
                            {billToDetails.companyName || billToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[9.5px] font-bold text-slate-500 uppercase leading-snug mb-5 min-h-[2.5rem]">
                            <MapPin className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
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
                    <div className="bg-slate-50 border-b border-slate-100 px-3 py-1.5 flex items-center gap-2 print-bg-gray">
                        <Truck className="w-4 h-4 text-slate-900" />
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Shipped To (Consignee)</span>
                    </div>
                    
                    <div className="px-3 py-4 flex-1 text-left">
                        <h2 className="text-xl font-black uppercase text-black leading-none mb-1.5 tracking-tighter">
                            {shipToDetails.companyName || shipToDetails.name}
                        </h2>
                        <div className="flex items-start gap-1.5 text-[9.5px] font-bold text-slate-500 uppercase leading-snug mb-5 min-h-[2.5rem]">
                            <MapPin className="w-3 h-3 mt-0.5 text-slate-400 shrink-0" />
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

            {/* Optimized Supply Table - ELITE Corporate Styling */}
            <div className="flex flex-col mb-6 border-t-4 border-b-2 border-slate-900 overflow-hidden print:border-black">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-slate-50 text-slate-900 print:!bg-slate-50 print:!text-black border-b-2 border-slate-900">
                        <tr className="text-[9px] font-black uppercase tracking-widest italic">
                            <th className="py-2.5 px-2 border-r border-slate-200">SN</th>
                            <th className="py-2.5 px-4 border-r border-slate-200 text-left">Description of Goods</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Packaging</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">HSN</th>
                            <th className="py-2.5 px-2 border-r border-slate-200">Weight (QTL)</th>
                            <th className="py-2.5 px-2">Net Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-black/10">
                         <tr className="text-[11px] font-medium text-slate-900 group">
                            <td className="py-2.5 px-4 font-black border-r border-slate-50 italic">01.</td>
                            <td className="py-2.5 px-4 text-left border-r border-slate-50">
                                <div className="font-black text-[13px] text-slate-950 leading-none uppercase tracking-tight">{customer.variety}</div>
                                <div className="text-[7.5px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Exempted Supply - Quality Processed</div>
                            </td>
                            <td className="py-2.5 px-4 border-r border-slate-50">
                                <div className="font-black text-2xl">{customer.bags || '0'}</div>
                                <div className="text-[7px] font-bold text-slate-400 uppercase">Large Bags PKG</div>
                            </td>
                            <td className="p-4 border-r border-slate-50 font-black italic">{hsnCode}</td>
                            <td className="py-2.5 px-4 border-r border-slate-50">
                                 <div className="font-black text-lg tabular-nums">{netWeight.toFixed(2)} QTL</div>
                            </td>
                            <td className="py-2.5 px-4 font-black tabular-nums bg-slate-50/50 print:bg-transparent text-right pr-6">{formatCleanCurrency(tableTotalAmount)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 text-slate-900 font-black uppercase text-[10px] tracking-widest print:!bg-slate-50 print:!text-black border-t-2 border-slate-900">
                            <td colSpan={5} className="p-2.5 text-right border-r border-slate-200 uppercase tracking-widest opacity-60">Subtotal Assignment</td>
                            <td className="p-2.5 text-right bg-slate-100 text-slate-950 font-black tabular-nums pr-6 border-l-2 border-slate-900">{formatCleanCurrency(tableTotalAmount)}</td>
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
                                No Tax Applicable (Exempted Supply)
                             </p>
                        </div>
                     </div>

                     <div className="text-[10px] font-bold text-slate-500 uppercase space-y-1.5 italic border-l-4 border-slate-900 pl-5 py-2">
                        <p className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div> 1. Certified that the actual price of the goods is described above.</p>
                        <p className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div> 2. Subject to Shajahanpur (UP) Jurisdiction only.</p>
                     </div>
                 </div>

                 {/* Right: Monumental Totals & Signatory */}
                 <div className="col-span-4 flex flex-col pt-1">
                     <div className="flex flex-col gap-2 mb-6">
                         <div className="flex justify-between items-center px-4 py-1.5 border-b border-slate-100">
                             <span className="text-[9px] font-black text-slate-400 uppercase">Gross Supply Total</span>
                             <span className="text-[13px] font-black text-slate-900 tabular-nums">{formatCleanCurrency(taxableAmount)}</span>
                         </div>
                         <div className="flex justify-between items-center px-4 py-1.5 border-b border-slate-100">
                             <span className="text-[9px] font-black text-slate-500 uppercase italic">Add: Adjustments</span>
                             <span className="text-[11px] font-black text-slate-950 tabular-nums">{formatCleanCurrency(0)}</span>
                         </div>
                         {advanceFreight > 0 && <div className="flex justify-between items-center px-4 py-1.5 bg-red-50 text-red-700">
                             <span className="text-[9px] font-black uppercase">Less: Advance Value</span>
                             <span className="text-[12px] font-black">-{formatCleanCurrency(advanceFreight)}</span>
                         </div>}
                         <div className="mt-2 p-5 bg-white border-y-4 border-slate-900 flex flex-col items-end shadow-md">
                             <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 leading-none italic">Total Net Value</span>
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



            <div className="grid grid-cols-2 gap-12 items-end text-left mb-10">
                <div className="p-4 bg-slate-50 border-l-4 border-slate-900 rounded-r-lg">
                    <div className="space-y-2">
                        <p className="text-[9.5px] font-black text-slate-950 uppercase italic leading-tight">
                            WE DECLARED THAT THIS INVOICE SHOWS THE ACTUAL PRICE OF THE GOODS DESCRIBED AND THAT PARTICULARS ARE TRUE AND CORRECT.
                        </p>
                        <p className="text-[8.5px] font-black text-slate-500 uppercase italic">
                            SUBJECT TO SHAHJAHANPUR JURISDICTION.
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-col items-center">
                    <div className="w-full max-w-[260px] relative">
                        {/* Seal Accent */}
                        <div className="absolute -top-12 -right-6 w-24 h-24 border-4 border-slate-100 rounded-full opacity-20 flex items-center justify-center rotate-12">
                             <div className="text-[8px] font-black text-slate-200 uppercase text-center tracking-tighter">Official Seal<br/>Not Required</div>
                        </div>
                        <div className="border-t-4 border-slate-900 pt-5 text-center relative">
                            <p className="font-black text-[11px] text-slate-400 uppercase tracking-[0.3em] mb-3">FOR {String(settings.companyName || "JAGDAMBE RICE MILL").toUpperCase()}</p>
                            <p className="font-black text-lg uppercase tracking-tighter text-slate-950 leading-none italic">Authorised Signatory</p>
                        </div>
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

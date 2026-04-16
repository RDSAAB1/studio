

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Customer, RtgsSettings } from '@/lib/definitions';
import { getRtgsSettings } from '@/lib/firestore';
import { useGlobalData } from '@/contexts/global-data-context';
import { useToast } from '@/hooks/use-toast';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { printHtmlContent } from '@/lib/electron-print';
import { Loader2, Search, Printer, Calendar as CalendarIcon, Weight, CircleDollarSign, TrendingUp, HandCoins, Scale, Percent, Wheat, Sigma } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { CustomDropdown } from '@/components/ui/custom-dropdown';

const escapeHtml = (value?: string | null) => {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const CategorySummaryCard = ({ title, data, icon }: { title: string; data: { label: string; value: string; isHighlighted?: boolean }[]; icon: React.ReactNode }) => (
    <Card className="flex-1 bg-card/60 border-primary/30 shadow-md print:border print:shadow-none">
        <CardHeader className="p-2 flex flex-row items-center space-x-2">
             <div className="bg-primary/10 text-primary p-1.5 rounded-md">{icon}</div>
             <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-1">
             <div className="space-y-1">
                {data.map((item, index) => (
                    <div key={index} className="flex justify-between items-baseline text-xs">
                        <p className="text-muted-foreground">{item.label}</p>
                        <p className={cn("font-mono font-semibold", item.isHighlighted && "text-primary font-bold text-sm")}>{item.value}</p>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);


export default function DailySupplierReportClient() {
    // Use global data store - NO duplicate listeners
    const globalData = useGlobalData();
    const suppliers = globalData.suppliers;
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVariety, setSelectedVariety] = useState<string | null>('all');
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const fetchedSettings = await getRtgsSettings();
            setSettings(fetchedSettings);
        }
        fetchSettings();
        // Use global data store - NO duplicate listeners
    }, []);
    
    const varietyOptions = useMemo(() => {
        if (!suppliers || !dateRange?.from) return [{ value: 'all', label: 'All Varieties' }];
        
        const varieties = new Set(suppliers.filter(s => {
            const rowDate = new Date(s.date);
            const start = startOfDay(dateRange.from!);
            const end = endOfDay(dateRange.to || dateRange.from!);
            return isWithinInterval(rowDate, { start, end });
        }).map(s => toTitleCase(s.variety)));
        
        const sortedVarieties = Array.from(varieties).sort();
        return [{ value: 'all', label: 'All Varieties' }, ...sortedVarieties.map(v => ({ value: v, label: v }))];
    }, [suppliers, dateRange]);

    const filteredSuppliers = useMemo(() => {
        if (!suppliers || !dateRange?.from) return [];
        
        const filtered = suppliers.filter(s => {
            const rowDate = new Date(s.date);
            const start = startOfDay(dateRange.from!);
            const end = endOfDay(dateRange.to || dateRange.from!);
            
            const dateMatch = isWithinInterval(rowDate, { start, end });
            const nameMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const varietyMatch = !selectedVariety || selectedVariety === 'all' || s.variety.toLowerCase() === selectedVariety.toLowerCase();
            return dateMatch && nameMatch && varietyMatch;
        });
        
        return filtered.sort((a, b) => {
            const aNum = parseInt(String(a.srNo).replace(/\D/g, '')) || 0;
            const bNum = parseInt(String(b.srNo).replace(/\D/g, '')) || 0;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.srNo).localeCompare(String(b.srNo));
        });
    }, [suppliers, dateRange, searchTerm, selectedVariety]);

    const summary = useMemo(() => {
        const initialSummary = { 
            gross: 0, 
            tier: 0, 
            total: 0, 
            kartaWeight: 0, 
            net: 0, 
            labour: 0, 
            kartaAmount: 0, 
            afterKartaAmount: 0, 
            cdAmount: 0, 
            finalNet: 0, 
            kanta: 0, 
            amount: 0, 
            netAmount: 0, 
            originalNetAmount: 0, 
            rate: 0, 
            minRate: 0, 
            maxRate: 0, 
            kartaPercentage: 0, 
            totalEntries: 0 
        };
        
        if(filteredSuppliers.length === 0) return initialSummary;
        
        const newSummary = filteredSuppliers.reduce((acc, s) => {
            acc.gross += (Number(s.grossWeight) || 0);
            acc.tier += (Number(s.teirWeight) || 0);
            acc.total += (Number(s.weight) || 0);
            acc.kartaWeight += (Number(s.kartaWeight) || 0);
            acc.net += (Number(s.netWeight) || 0);
            acc.labour += (Number(s.labouryAmount) || 0);
            acc.kartaAmount += (Number(s.kartaAmount) || 0);
            const afterKarta = (Number(s.amount) || 0) - (Number(s.kartaAmount) || 0);
            const cd = afterKarta * 0.01;
            acc.afterKartaAmount += afterKarta;
            acc.cdAmount += cd;
            acc.finalNet += (afterKarta - cd - (Number(s.labouryAmount) || 0) - (Number(s.kanta) || 0));
            acc.kanta += (Number(s.kanta) || 0);
            acc.amount += (Number(s.amount) || 0);
            acc.originalNetAmount += (Number(s.originalNetAmount) || 0);
            acc.netAmount += (Number(s.netAmount) || 0);
            acc.kartaPercentage += (Number(s.kartaPercentage) || 0);
            return acc;
        }, initialSummary);

        newSummary.totalEntries = filteredSuppliers.length;

        const validRates = filteredSuppliers.map(s => s.rate).filter(rate => rate > 0);
        newSummary.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        newSummary.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;
        
        if (newSummary.total > 0) {
            newSummary.rate = newSummary.amount / newSummary.total;
        }
        if (filteredSuppliers.length > 0) {
            newSummary.kartaPercentage = newSummary.kartaPercentage / filteredSuppliers.length;
        }

        return newSummary;
    }, [filteredSuppliers]);
    
    const varietySummary = useMemo(() => {
        const summaryByVariety: { [key: string]: { netWeight: number; netAmount: number; rate: number; count: number } } = {};
        
        filteredSuppliers.forEach(s => {
            const varietyKey = toTitleCase(s.variety);
            if (!summaryByVariety[varietyKey]) {
                summaryByVariety[varietyKey] = { netWeight: 0, netAmount: 0, rate: 0, count: 0 };
            }
            summaryByVariety[varietyKey].netWeight += s.netWeight;
            summaryByVariety[varietyKey].netAmount += Number(s.netAmount);
            summaryByVariety[varietyKey].count += 1;
        });

        Object.keys(summaryByVariety).forEach(key => {
            const varietyData = summaryByVariety[key];
            if (varietyData.netWeight > 0) {
                 const totalAmountForVariety = filteredSuppliers.filter(s=> toTitleCase(s.variety) === key).reduce((sum, s) => sum + s.amount, 0);
                 varietyData.rate = totalAmountForVariety / (filteredSuppliers.filter(s=> toTitleCase(s.variety) === key).reduce((sum, s) => sum + s.weight, 0));
            }
        });

        return Object.entries(summaryByVariety).map(([variety, data]) => ({ variety, ...data }));
    }, [filteredSuppliers]);

    const handlePrint = async () => {
        if (!settings || !filteredSuppliers.length) {
            toast({ variant: 'destructive', title: 'Error', description: 'No data to print or settings not loaded.' });
            return;
        }

        const dateTitle = dateRange?.from ? (
            dateRange.to ? `${format(dateRange.from, "dd-MMM-yyyy")} to ${format(dateRange.to, "dd-MMM-yyyy")}` : format(dateRange.from, "dd-MMM-yyyy")
        ) : "";

        const userCompany = globalData.receiptSettings;
        const companyName = settings?.companyName || userCompany?.name || 'Company Name';

        // Construct professional report HTML
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Supplier Report - ${dateTitle}</title>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; margin: 0; padding: 15px; color: #000; line-height: 1.2; letter-spacing: -0.01em; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2.5px solid #1a365d; padding-bottom: 8px; }
                    .header-left { text-align: left; }
                    .header-left h1 { margin: 0; font-size: 26px; color: #1a365d; letter-spacing: -0.02em; font-weight: 900; line-height: 1; }
                    .header-left p { margin: 4px 0 0 0; font-size: 10px; color: #444; font-weight: 700; }
                    .header-right { text-align: right; font-size: 9px; color: #666; font-weight: 500; line-height: 1.3; }
                    
                    .summary-section { margin-bottom: 12px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }
                    .summary-box { border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; overflow: hidden; }
                    .summary-box h4 { margin: 0; font-size: 8px; color: #fff; font-weight: 800; padding: 3px 6px; text-transform: uppercase; background: #1a365d; }
                    .summary-box-content { padding: 4px 6px; }
                    .flex-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; margin-bottom: 1px; }
                    .flex-row span:first-child { color: #555; font-size: 8.5px; font-weight: 600; }
                    .flex-row span:last-child { font-weight: 800; color: #000; }

                    .main-table { width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #1e293b; table-layout: fixed; line-height: 1.1; }
                    .main-table th, .main-table td { border: 0.5px solid #cbd5e1; padding: 3px 2px; text-align: right; overflow: hidden; white-space: nowrap; }
                    .main-table th { background: #1a365d; color: #fff; text-align: center; font-weight: 700; font-size: 8.5px; border: 0.5px solid #1a365d; vertical-align: middle; }
                    .main-table td { background: #fff; color: #000; font-weight: 500; }
                    .main-table td:nth-child(3), .main-table td:nth-child(4) { text-align: left; white-space: normal; }
                    .main-table td:nth-child(1), .main-table td:nth-child(2) { text-align: center; background: #f8fafc; }
                    
                    .cell-stack { display: flex; flex-direction: column; gap: 0px; }
                    .primary-val { font-weight: 800; color: #111; }
                    .secondary-val { font-size: 8px; color: #64748b; font-weight: 600; }
                    .text-financial { color: #15803d; font-weight: 800; }
                    .text-rate { color: #92400e; font-weight: 800; }
                    .text-supp { color: #1e40af; font-weight: 900; font-size: 11px; }
                    .bg-total { background: #cbd5e1 !important; color: #1a365d !important; font-weight: 900 !important; }
                    .bg-total td { background: #cbd5e1 !important; border-top: 1.5px solid #1a365d !important; }
                    
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        @page { size: landscape; margin: 0.5cm; margin-top: 2.0cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        <h1>${escapeHtml(companyName)}</h1>
                        <p>${escapeHtml(toTitleCase(selectedVariety || 'All Varieties'))} Report | ${dateTitle}</p>
                    </div>
                    <div class="header-right">
                        ${userCompany?.address ? `<div>${escapeHtml(userCompany.address)}</div>` : ''}
                        ${userCompany?.phone ? `<div>Ph: ${escapeHtml(userCompany.phone)}</div>` : ''}
                        ${userCompany?.email ? `<div>Email: ${escapeHtml(userCompany.email)}</div>` : ''}
                    </div>
                </div>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th style="width: 4%">SR</th>
                            <th style="width: 6%">Date / T</th>
                            <th style="width: 11%">Supplier / Father</th>
                            <th style="width: 8%">Vehicle / Address</th>
                            <th style="width: 5%">Gr/Tr</th>
                            <th style="width: 4%">Fn</th>
                            <th style="width: 3%">Kt</th>
                            <th style="width: 5.5%">NetWt</th>
                            <th style="width: 6%">Rate</th>
                            <th style="width: 6.5%">Amnt</th>
                            <th style="width: 4%">KtA</th>
                            <th style="width: 6%">Af.Kt</th>
                            <th style="width: 3.5%">Lb</th>
                            <th style="width: 3.5%">Kn</th>
                            <th style="width: 6.5%">Pay</th>
                            <th style="width: 4%">CD</th>
                            <th style="width: 9.5%">Final Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredSuppliers.map(s => {
                            const afterKartaAmount = s.amount - s.kartaAmount;
                            const cdAmount = afterKartaAmount * 0.01;
                            const finalNet = s.amount - s.kartaAmount - cdAmount - s.labouryAmount - s.kanta;
                            return `
                                <tr>
                                    <td>${s.srNo}</td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="primary-val">${format(new Date(s.date), "dd-MMM")}</span>
                                            <span class="secondary-val">${s.term}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="text-supp">${escapeHtml(toTitleCase(s.name))}</span>
                                            <span class="secondary-val">S/O: ${escapeHtml(toTitleCase(s.so || ''))}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="primary-val" style="font-size:9px">${escapeHtml((s.vehicleNo || '').toUpperCase())}</span>
                                            <span class="secondary-val">${escapeHtml(s.address || '')}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span style="font-weight:700">${s.grossWeight.toFixed(2)}</span>
                                            <span class="secondary-val">${s.teirWeight.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td>${s.weight.toFixed(2)}</td>
                                    <td>${s.kartaWeight.toFixed(2)}</td>
                                    <td style="font-weight:900; color:#000">${s.netWeight.toFixed(2)}</td>
                                    <td class="text-rate">${Math.round(s.rate)}</td>
                                    <td class="text-rate">${Math.round(s.amount).toLocaleString()}</td>
                                    <td>${Math.round(s.kartaAmount)}</td>
                                    <td>${Math.round(afterKartaAmount).toLocaleString()}</td>
                                    <td>${Math.round(s.labouryAmount)}</td>
                                    <td>${Math.round(s.kanta)}</td>
                                    <td class="text-financial">${Math.round(Number(s.netAmount)).toLocaleString()}</td>
                                    <td>${Math.round(cdAmount)}</td>
                                    <td class="text-financial" style="font-weight:900; font-size:11.5px">₹${Math.round(finalNet).toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                         <tr class="bg-total">
                                    <td colspan="4" style="text-align:center; font-size: 12px;">TOTALS (${summary.totalEntries} Entries)</td>
                                    <td>
                                        <div class="cell-stack">
                                            <span>${summary.gross.toFixed(2)}</span>
                                            <span class="secondary-val">${summary.tier.toFixed(2)}</span>
                                        </div>
                                    </td>
                                    <td>${summary.total.toFixed(2)}</td>
                                    <td>${summary.kartaWeight.toFixed(2)}</td>
                                    <td style="color:#000">${summary.net.toFixed(2)}</td>
                                    <td>
                                        <div class="cell-stack text-rate" style="font-size:8.5px">
                                            <span>Avg: ₹${Math.round(summary.rate)}</span>
                                            <span class="secondary-val">R: ${Math.round(summary.minRate)}-${Math.round(summary.maxRate)}</span>
                                        </div>
                                    </td>
                                    <td class="text-rate">₹${Math.round(summary.amount).toLocaleString()}</td>
                                    <td>₹${Math.round(summary.kartaAmount).toLocaleString()}</td>
                                    <td>₹${Math.round(summary.amount - summary.kartaAmount).toLocaleString()}</td>
                                    <td>₹${Math.round(summary.labour).toLocaleString()}</td>
                                    <td>₹${Math.round(summary.kanta).toLocaleString()}</td>
                                    <td class="text-financial">₹${Math.round(summary.netAmount).toLocaleString()}</td>
                                    <td>₹${Math.round(summary.cdAmount).toLocaleString()}</td>
                                    <td class="text-financial" style="font-size: 12.5px;">₹${Math.round(summary.finalNet).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                
                <div style="margin-top: 30px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 10px; color: #888; text-align: center;">
                    Daily Supplier Report - Generated on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;

        await printHtmlContent(printContent);
    };


    return (
        <div className="space-y-4">
             <div ref={printRef}>
                <Card className="print-no-border">
                    <CardContent className="p-4 flex flex-col gap-0">
                         <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center no-print mb-4">
                            <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                             <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                             <CustomDropdown options={varietyOptions} value={selectedVariety} onChange={setSelectedVariety} placeholder="Filter by variety..." />
                        </div>
                        
                         <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-2 print:flex print-summary-container mb-4">
                           <CategorySummaryCard title="Total Entries" icon={<Sigma size={16}/>} data={[
                                { label: 'Parchi', value: `${summary.totalEntries}` },
                           ]}/>
                           <CategorySummaryCard title="Gross & Tier" icon={<Weight size={16}/>} data={[
                                { label: 'Gross', value: `${summary.gross.toFixed(2)}` },
                                { label: 'Tier', value: `${summary.tier.toFixed(2)}` },
                           ]}/>
                           <CategorySummaryCard title="Final & Net Wt." icon={<Scale size={16}/>} data={[
                                { label: 'Final Wt.', value: `${summary.total.toFixed(2)}`, isHighlighted: true },
                                { label: 'Karta Wt.', value: `-${summary.kartaWeight.toFixed(2)}` },
                                { label: 'Net Wt.', value: `${summary.net.toFixed(2)}`, isHighlighted: true },
                           ]}/>
                           <CategorySummaryCard title="Rate & Amount" icon={<TrendingUp size={16}/>} data={[
                                { label: 'Avg Rate', value: formatCurrency(summary.rate) },
                                { label: 'Min Rate', value: formatCurrency(summary.minRate) },
                                { label: 'Max Rate', value: formatCurrency(summary.maxRate) },
                                { label: 'Total Amt', value: formatCurrency(summary.amount), isHighlighted: true },
                           ]}/>
                           <CategorySummaryCard title="Karta Deduction" icon={<Percent size={16}/>} data={[
                                { label: 'Avg %', value: `${summary.kartaPercentage.toFixed(2)}%` },
                                { label: 'Total Amt', value: formatCurrency(summary.kartaAmount) },
                           ]}/>
                             <CategorySummaryCard title="Other Deductions" icon={<HandCoins size={16}/>} data={[
                                { label: 'Labour Amt', value: formatCurrency(summary.labour) },
                                { label: 'Kanta Amt', value: formatCurrency(summary.kanta) },
                           ]}/>
                           <CategorySummaryCard title="Final Settlement" icon={<TrendingUp size={16}/>} data={[
                                { label: 'After Karta', value: formatCurrency(summary.afterKartaAmount) },
                                { label: 'Net Payable', value: formatCurrency(summary.netAmount), isHighlighted: true },
                                { label: 'CD Amt', value: formatCurrency(summary.cdAmount) },
                                { label: 'Final Net', value: formatCurrency(summary.finalNet), isHighlighted: true },
                           ]}/>
                           <CategorySummaryCard title="Payment Status" icon={<CircleDollarSign size={16}/>} data={[
                                { label: 'Total Original', value: formatCurrency(summary.originalNetAmount) },
                                { label: 'Total Paid', value: formatCurrency(summary.originalNetAmount - summary.netAmount) },
                           ]}/>
                        </div>
                        
                        {varietySummary.length > 1 && (
                            <div className="mb-4">
                                <Separator />
                                <h3 className="text-sm font-semibold no-print my-2">Variety-wise Summary</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 no-print">
                                    {varietySummary.map(({ variety, netWeight, netAmount, rate, count }) => (
                                        <Card key={variety}>
                                            <CardHeader className="p-2 pb-1">
                                                <CardTitle className="text-sm flex items-center gap-2"><Wheat size={14}/>{variety}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 text-xs space-y-1">
                                                <div className="flex justify-between"><span className="text-muted-foreground">Entries</span><span>{count}</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Net Wt.</span><span>{netWeight.toFixed(2)} Qtl</span></div>
                                                <div className="flex justify-between"><span className="text-muted-foreground">Net Amt.</span><span>{formatCurrency(netAmount)}</span></div>
                                                <div className="flex justify-between font-semibold"><span className="text-muted-foreground">Avg. Rate</span><span>{formatCurrency(rate || 0)}</span></div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}
                        

                        <div className="relative border rounded-lg overflow-auto max-h-[600px] w-full">
                            <table className="w-full text-xs border-collapse border-0 border-spacing-0 m-0 p-0">
                                <thead className="sticky top-0 z-20 bg-muted m-0 p-0">
                                    <tr className="text-primary bg-muted">
                                        <th className="p-2 text-left border-b border-r bg-muted">SR</th>
                                        <th className="p-2 text-left border-b border-r bg-muted">Date</th>
                                        <th className="p-2 text-left border-b border-r bg-muted">Term</th>
                                        <th className="p-2 text-left border-b border-r bg-muted">Name</th>
                                        <th className="p-2 text-left border-b border-r bg-muted">S/O</th>
                                        <th className="p-2 text-left border-b border-r bg-muted">Vehicle</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Gross</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Teir</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Final</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Karta</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Net</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Rate</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Amount</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Karta Amt</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">After Karta</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Laboury</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Kanta</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">Net Payable</th>
                                        <th className="p-2 text-right border-b border-r bg-muted">CD Amt</th>
                                        <th className="p-2 text-right border-b bg-muted">Final Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map((s) => {
                                        const afterKartaAmount = s.amount - s.kartaAmount;
                                        const cdAmount = afterKartaAmount * 0.01;
                                        const finalNet = s.amount - s.kartaAmount - cdAmount - s.labouryAmount - s.kanta;
                                        return (
                                        <tr key={s.id} className="hover:bg-muted/50 whitespace-nowrap h-[29px] border-b">
                                            <td className="p-2 border-r font-bold">{s.srNo}</td>
                                            <td className="p-2 border-r">{format(new Date(s.date), "dd-MMM")}</td>
                                            <td className="p-2 border-r text-center">{s.term}</td>
                                            <td className="p-2 border-r">{toTitleCase(s.name)}</td>
                                            <td className="p-2 border-r">{toTitleCase(s.so)}</td>
                                            <td className="p-2 border-r">{s.vehicleNo.toUpperCase()}</td>
                                            <td className="p-2 border-r text-right">{s.grossWeight.toFixed(2)}</td>
                                            <td className="p-2 border-r text-right">{s.teirWeight.toFixed(2)}</td>
                                            <td className="p-2 border-r text-right font-semibold">{s.weight.toFixed(2)}</td>
                                            <td className="p-2 border-r text-right">{s.kartaWeight.toFixed(2)}</td>
                                            <td className="p-2 border-r text-right font-bold text-blue-600">{s.netWeight.toFixed(2)}</td>
                                            <td className="p-2 border-r text-right">{formatCurrency(s.rate)}</td>
                                            <td className="p-2 border-r text-right">{formatCurrency(s.amount)}</td>
                                            <td className="p-2 border-r text-right text-red-600">{formatCurrency(s.kartaAmount)}</td>
                                            <td className="p-2 border-r text-right font-semibold text-blue-700">{formatCurrency(afterKartaAmount)}</td>
                                            <td className="p-2 border-r text-right text-red-600">{formatCurrency(s.labouryAmount)}</td>
                                            <td className="p-2 border-r text-right text-red-600">{formatCurrency(s.kanta)}</td>
                                            <td className="p-2 border-r text-right font-bold text-sm">{formatCurrency(Number(s.netAmount))}</td>
                                            <td className="p-2 border-r text-right text-orange-600">{formatCurrency(cdAmount)}</td>
                                            <td className="p-2 text-right font-bold text-emerald-600">{formatCurrency(finalNet)}</td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
             </div>
             <div className="flex justify-end mt-4 no-print">
                 <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
             </div>
        </div>
    );
}


    

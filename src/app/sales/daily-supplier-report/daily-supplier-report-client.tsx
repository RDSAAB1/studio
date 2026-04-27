

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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [isDetailedMode, setIsDetailedMode] = useState(false);
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
        if (!suppliers || !fromDate) return [{ value: 'all', label: 'All Varieties' }];
        
        const varieties = new Set(suppliers.filter(s => {
            const rowDate = new Date(s.date);
            const start = startOfDay(fromDate);
            const end = endOfDay(toDate || fromDate);
            return isWithinInterval(rowDate, { start, end });
        }).map(s => toTitleCase(s.variety)));
        
        const sortedVarieties = Array.from(varieties).sort();
        return [{ value: 'all', label: 'All Varieties' }, ...sortedVarieties.map(v => ({ value: v, label: v }))];
    }, [suppliers, fromDate, toDate]);

    const filteredSuppliers = useMemo(() => {
        if (!suppliers || !fromDate) return [];
        
        const filtered = suppliers.filter(s => {
            const rowDate = new Date(s.date);
            const start = startOfDay(fromDate);
            const end = endOfDay(toDate || fromDate);
            
            const dateMatch = isWithinInterval(rowDate, { start, end });
            const nameMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            const varietyMatch = !selectedVariety || selectedVariety === 'all' || s.variety.toLowerCase() === selectedVariety.toLowerCase();
            return dateMatch && nameMatch && varietyMatch;
        });
        
        return filtered.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            
            const aNum = parseInt(String(a.srNo).replace(/\D/g, '')) || 0;
            const bNum = parseInt(String(b.srNo).replace(/\D/g, '')) || 0;
            if (aNum !== bNum) return aNum - bNum;
            return String(a.srNo).localeCompare(String(b.srNo));
        });
    }, [suppliers, fromDate, toDate, searchTerm, selectedVariety]);

    const displayRows = useMemo(() => {
        if (isDetailedMode) return filteredSuppliers;
        
        const grouped: { [key: string]: any } = {};
        filteredSuppliers.forEach(s => {
            const dateKey = format(new Date(s.date), "yyyy-MM-dd");
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    id: dateKey,
                    date: s.date,
                    srNo: 'Σ',
                    term: '-',
                    name: ``,
                    so: '-',
                    vehicleNo: '-',
                    address: '-',
                    grossWeight: 0,
                    teirWeight: 0,
                    weight: 0,
                    kartaWeight: 0,
                    netWeight: 0,
                    rate: 0,
                    amount: 0,
                    kartaAmount: 0,
                    netAmount: 0,
                    labouryAmount: 0,
                    kanta: 0,
                    originalNetAmount: 0,
                    count: 0,
                    isGrouped: true
                };
            }
            grouped[dateKey].grossWeight += (Number(s.grossWeight) || 0);
            grouped[dateKey].teirWeight += (Number(s.teirWeight) || 0);
            grouped[dateKey].weight += (Number(s.weight) || 0);
            grouped[dateKey].kartaWeight += (Number(s.kartaWeight) || 0);
            grouped[dateKey].netWeight += (Number(s.netWeight) || 0);
            grouped[dateKey].amount += (Number(s.amount) || 0);
            grouped[dateKey].kartaAmount += (Number(s.kartaAmount) || 0);
            grouped[dateKey].netAmount += (Number(s.netAmount) || 0);
            grouped[dateKey].labouryAmount += (Number(s.labouryAmount) || 0);
            grouped[dateKey].kanta += (Number(s.kanta) || 0);
            grouped[dateKey].originalNetAmount += (Number(s.originalNetAmount) || 0);
            grouped[dateKey].count += 1;
        });
        
        return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((row: any) => {
            if (row.weight > 0) {
                row.rate = row.amount / row.weight;
            }
            row.name = `${row.count} Entries`;
            return row;
        });
    }, [filteredSuppliers, isDetailedMode]);

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

        const dateTitle = fromDate ? (
            toDate ? `${format(fromDate, "dd-MMM-yyyy")} to ${format(toDate, "dd-MMM-yyyy")}` : format(fromDate, "dd-MMM-yyyy")
        ) : "";

        const userCompany = globalData.receiptSettings;
        const companyName = settings?.companyName || userCompany?.name || 'Company Name';

        // Construct professional report HTML
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Supplier Report - ${dateTitle}</title>
                <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'IBM Plex Sans', sans-serif !important; margin: 0; padding: 15px; color: #334155; line-height: 1.2; letter-spacing: -0.01em; font-weight: 400; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2px solid #475569; padding-bottom: 8px; }
                    .header-left { text-align: left; }
                    .header-left h1 { margin: 0; font-size: 24px; color: #1e293b; letter-spacing: -0.02em; font-weight: 700; line-height: 1; }
                    .header-left p { margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; }
                    .header-right { text-align: right; font-size: 9px; color: #64748b; font-weight: 500; line-height: 1.3; }
                    
                    .summary-section { margin-bottom: 12px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px; }
                    .summary-box { border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; overflow: hidden; }
                    .summary-box h4 { margin: 0; font-size: 8.5px; color: #1e293b; font-weight: 700; padding: 3px 6px; text-transform: uppercase; background: #e2e8f0; border-bottom: 1px solid #cbd5e1; }
                    .summary-box-content { padding: 4px 6px; }
                    .flex-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; margin-bottom: 1px; }
                    .flex-row span:first-child { color: #64748b; font-size: 8.5px; font-weight: 500; }
                    .flex-row span:last-child { font-weight: 600; color: #0f172a; }

                    .main-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 0.5px solid #94a3b8; table-layout: fixed; line-height: 1.1; }
                    .main-table th, .main-table td { border: 0.5px solid #cbd5e1; padding: 3px 2px; text-align: right; overflow: hidden; white-space: nowrap; }
                    .main-table th { background: #f1f5f9; color: #1e293b; text-align: center; font-weight: 600; font-size: 9.5px; border: 0.5px solid #94a3b8; vertical-align: middle; }
                    .main-table td { background: #fff; color: #334155; font-weight: 400; }
                    .main-table td:nth-child(${isDetailedMode ? '3' : '3'}), .main-table td:nth-child(${isDetailedMode ? '4' : '4'}) { text-align: left; white-space: normal; }
                    .main-table td:nth-child(1), .main-table td:nth-child(2) { text-align: center; }
                    
                    .cell-stack { display: flex; flex-direction: column; gap: 0px; }
                    .primary-val { font-weight: 400; color: #0f172a; }
                    .secondary-val { font-size: 8px; color: #64748b; font-weight: 400; }
                    .text-financial { color: #166534; font-weight: 600; }
                    .text-rate { color: #92400e; font-weight: 600; }
                    .text-supp { color: #1e3a8a; font-weight: 400; font-size: 10.5px; }
                    .bg-total { background: #f1f5f9 !important; color: #1e293b !important; font-weight: 600 !important; }
                    .bg-total td { background: #f1f5f9 !important; border-top: 1.5px solid #475569 !important; }
                    
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
                            <th style="width: 7%">${isDetailedMode ? 'Date / T' : 'Date'}</th>
                            <th style="width: ${isDetailedMode ? '14%' : '18%'}">${isDetailedMode ? 'Supplier / Father' : 'Entries'}</th>
                            ${isDetailedMode ? `
                            <th style="width: 10%">Vehicle / Address</th>
                            <th style="width: 6%">Gr/Tr</th>
                            ` : ''}
                            <th style="width: 6%">Fn</th>
                            <th style="width: 4%">Kt</th>
                            <th style="width: 7%">NetWt</th>
                            <th style="width: 7%">Rate</th>
                            <th style="width: 8%">Amnt</th>
                            <th style="width: 5%">KtA</th>
                            <th style="width: 8%">Af.Kt</th>
                            <th style="width: 5%">Lb</th>
                            <th style="width: 5%">Kn</th>
                            <th style="width: 8%">Pay</th>
                            <th style="width: 5%">CD</th>
                            <th style="width: 11%">Final Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayRows.map(s => {
                            const afterKartaAmount = s.amount - s.kartaAmount;
                            const cdAmount = afterKartaAmount * 0.01;
                            const finalNet = s.amount - s.kartaAmount - cdAmount - s.labouryAmount - s.kanta;
                            return `
                                <tr>
                                    <td>${s.srNo}</td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="primary-val" style="font-weight: 400 !important;">${format(new Date(s.date), "dd-MMM")}</span>
                                            ${isDetailedMode ? `<span class="secondary-val">${s.term}</span>` : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="text-supp" style="font-weight: 400 !important;">${escapeHtml(toTitleCase(s.name))}</span>
                                            <span class="secondary-val">${s.isGrouped ? '' : `S/O: ${escapeHtml(toTitleCase(s.so || ''))}`}</span>
                                        </div>
                                    </td>
                                    ${isDetailedMode ? `
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
                                    ` : ''}
                                    <td>${s.weight.toFixed(2)}</td>
                                    <td>${s.kartaWeight.toFixed(2)}</td>
                                    <td style="font-weight:700; color:#1e293b">${s.netWeight.toFixed(2)}</td>
                                    <td class="text-rate">${Math.round(s.rate).toLocaleString('en-IN')}</td>
                                    <td class="text-rate">${Math.round(s.amount).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(s.kartaAmount).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(afterKartaAmount).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(s.labouryAmount).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(s.kanta).toLocaleString('en-IN')}</td>
                                    <td class="text-financial">${Math.round(Number(s.netAmount)).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(cdAmount).toLocaleString('en-IN')}</td>
                                    <td class="text-financial" style="font-weight:700; font-size: 11px">₹${Math.round(finalNet).toLocaleString('en-IN')}</td>
                                </tr>
                            `;
                        }).join('')}
                         <tr class="bg-total">
                                    <td colspan="${isDetailedMode ? '4' : '3'}" style="text-align:center; font-size: 11px;">TOTALS (${summary.totalEntries.toLocaleString('en-IN')} Entries)</td>
                                    ${isDetailedMode ? `
                                    <td>
                                        <div class="cell-stack">
                                            <span>${summary.gross.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                            <span class="secondary-val">${summary.tier.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </td>
                                    ` : ''}
                                    <td>${summary.total.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td>${summary.kartaWeight.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td style="color:#1e293b; font-weight:700">${summary.net.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td>
                                        <div class="cell-stack text-rate" style="font-size:8.5px">
                                            <span>Avg: ₹${Math.round(summary.rate).toLocaleString('en-IN')}</span>
                                            <span class="secondary-val">R: ${Math.round(summary.minRate).toLocaleString('en-IN')}-${Math.round(summary.maxRate).toLocaleString('en-IN')}</span>
                                        </div>
                                    </td>
                                    <td class="text-rate">₹${Math.round(summary.amount).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(summary.kartaAmount).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(summary.amount - summary.kartaAmount).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(summary.labour).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(summary.kanta).toLocaleString('en-IN')}</td>
                                    <td class="text-financial">₹${Math.round(summary.netAmount).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(summary.cdAmount).toLocaleString('en-IN')}</td>
                                    <td class="text-financial" style="font-size: 12.5px; font-weight: 700;">₹${Math.round(summary.finalNet).toLocaleString('en-IN')}</td>
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
                        <div className="flex flex-wrap gap-2 items-end no-print mb-4 bg-slate-50/50 p-2 rounded-lg border border-slate-200/60">
                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">From Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("h-7 w-[120px] justify-start text-left font-normal text-[10px] px-2", !fromDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-1 h-3 w-3" />
                                            {fromDate ? format(fromDate, "dd-MMM-yyyy") : <span>From</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-0.5">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">To Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("h-7 w-[120px] justify-start text-left font-normal text-[10px] px-2", !toDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-1 h-3 w-3" />
                                            {toDate ? format(toDate, "dd-MMM-yyyy") : <span>To</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>

                             <div className="space-y-0.5">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Search Name</Label>
                                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-[240px] h-7 text-[10px]" />
                             </div>

                             <div className="space-y-0.5">
                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Variety</Label>
                                <CustomDropdown options={varietyOptions} value={selectedVariety} onChange={setSelectedVariety} placeholder="Variety" />
                             </div>

                             <div className="flex items-center space-x-2 h-7 mb-0.5 px-2 bg-white border rounded-md shadow-sm">
                                <Switch id="detailed-mode" checked={isDetailedMode} onCheckedChange={setIsDetailedMode} className="scale-75" />
                                <Label htmlFor="detailed-mode" className="text-[10px] font-bold uppercase cursor-pointer text-slate-600">Detailed</Label>
                             </div>

                             <div className="flex-grow"></div>

                             <Button onClick={handlePrint} size="sm" className="h-7 text-[10px] font-bold uppercase tracking-tight px-3 bg-indigo-600 hover:bg-indigo-700">
                                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print Report
                             </Button>
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
                                        {isDetailedMode && <th className="p-2 text-left border-b border-r bg-muted">Term</th>}
                                        <th className="p-2 text-left border-b border-r bg-muted">{isDetailedMode ? 'Name' : 'Entries'}</th>
                                        {isDetailedMode && (
                                            <>
                                                <th className="p-2 text-left border-b border-r bg-muted">S/O</th>
                                                <th className="p-2 text-left border-b border-r bg-muted">Vehicle</th>
                                                <th className="p-2 text-right border-b border-r bg-muted">Gross</th>
                                                <th className="p-2 text-right border-b border-r bg-muted">Teir</th>
                                            </>
                                        )}
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
                                    {displayRows.map((s, index) => {
                                        const afterKartaAmount = s.amount - s.kartaAmount;
                                        const cdAmount = afterKartaAmount * 0.01;
                                        const finalNet = s.amount - s.kartaAmount - cdAmount - s.labouryAmount - s.kanta;
                                        return (
                                        <tr key={s.id || index} className={cn("hover:bg-muted/50 whitespace-nowrap h-[29px] border-b", s.isGrouped && "bg-slate-50/50 font-medium")}>
                                            <td className="p-2 border-r font-bold">{s.srNo}</td>
                                            <td className="p-2 border-r">{format(new Date(s.date), "dd-MMM")}</td>
                                            {isDetailedMode && <td className="p-2 border-r text-center">{s.term}</td>}
                                            <td className={cn("p-2 border-r", s.isGrouped && "text-blue-700 font-bold")}>{toTitleCase(s.name)}</td>
                                            {isDetailedMode && (
                                                <>
                                                    <td className="p-2 border-r">{toTitleCase(s.so || '-')}</td>
                                                    <td className="p-2 border-r">{s.vehicleNo.toUpperCase()}</td>
                                                    <td className="p-2 border-r text-right">{s.grossWeight.toFixed(2)}</td>
                                                    <td className="p-2 border-r text-right">{s.teirWeight.toFixed(2)}</td>
                                                </>
                                            )}
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
        </div>
    );
}


    

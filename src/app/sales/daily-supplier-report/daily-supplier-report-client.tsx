

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
            if (aNum !== bNum) return bNum - aNum;
            return String(b.srNo).localeCompare(String(a.srNo));
        });
    }, [suppliers, dateRange, searchTerm, selectedVariety]);

    const summary = useMemo(() => {
        const initialSummary = { gross: 0, tier: 0, total: 0, karta: 0, net: 0, labour: 0, kartaAmount: 0, afterKartaAmount: 0, cdAmount: 0, finalNet: 0, kanta: 0, amount: 0, netAmount: 0, originalNetAmount: 0, rate: 0, minRate: 0, maxRate: 0, kartaPercentage: 0, totalEntries: 0 };
        
        if(filteredSuppliers.length === 0) return initialSummary;
        
        const newSummary = filteredSuppliers.reduce((acc, s) => {
            acc.gross += s.grossWeight;
            acc.tier += s.teirWeight;
            acc.total += s.weight;
            acc.karta += s.kartaWeight;
            acc.net += s.netWeight;
            acc.labour += s.labouryAmount;
            acc.kartaAmount += s.kartaAmount;
            const afterKarta = s.amount - s.kartaAmount;
            const cd = afterKarta * 0.01;
            acc.afterKartaAmount += afterKarta;
            acc.cdAmount += cd;
            acc.finalNet += (afterKarta - cd - s.labouryAmount - s.kanta);
            acc.kanta += s.kanta;
            acc.amount += s.amount;
            acc.originalNetAmount += s.originalNetAmount;
            acc.netAmount += Number(s.netAmount);
            acc.kartaPercentage += s.kartaPercentage;
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
        const node = printRef.current;
        if (!node || !settings) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the content to print.' });
            return;
        }

        const dateTitle = dateRange?.from ? (
            dateRange.to ? `${format(dateRange.from, "dd-MMM-yyyy")} to ${format(dateRange.to, "dd-MMM-yyyy")}` : format(dateRange.from, "dd-MMM-yyyy")
        ) : "";

        const printContent = `
            <div class="printable-area p-4">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 20px;">${escapeHtml(toTitleCase(settings.companyName))}</h2>
                    <p style="margin: 5px 0; font-size: 14px;">Supplier Report - ${dateTitle}</p>
                </div>
                <div class="report-content">
                    ${node.innerHTML}
                </div>
            </div>
        `;

        const printStyles = `
            @page { size: landscape; margin: 10mm; }
            .no-print { display: none !important; }
            .print-summary-container { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; margin-bottom: 20px !important; }
            .print-summary-container > div { flex: 1 !important; min-width: 150px !important; border: 1px solid #ccc !important; padding: 8px !important; border-radius: 4px !important; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #eee; padding: 4px; text-align: left; background: transparent !important; }
            th { background-color: #f7f7f7 !important; font-weight: bold; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .max-h-\\[600px\\] { max-height: none !important; height: auto !important; overflow: visible !important; }
            .sticky { position: static !important; }
            .border { border: 1px solid #eee !important; }
            .rounded-lg { border-radius: 8px !important; }
            .bg-card\\/60 { background-color: transparent !important; }
            .shadow-md { box-shadow: none !important; }
        `;

        await printHtmlContent(printContent, printStyles);
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
                                { label: 'Karta Wt.', value: `-${summary.karta.toFixed(2)}` },
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


    

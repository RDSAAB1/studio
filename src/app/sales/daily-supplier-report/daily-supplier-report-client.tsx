

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Customer, RtgsSettings } from '@/lib/definitions';
import { getRtgsSettings, getSuppliersRealtime } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Loader2, Search, Printer, Calendar as CalendarIcon, Weight, CircleDollarSign, TrendingUp, HandCoins, Scale, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const fetchedSettings = await getRtgsSettings();
            setSettings(fetchedSettings);
        }
        fetchSettings();
        
        const unsubscribe = getSuppliersRealtime(setSuppliers, (error) => {
            console.error(error);
            setLoading(false);
        });
        
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if(suppliers.length > 0 || !loading) {
            setLoading(false);
        }
    }, [suppliers, loading]);

    const filteredSuppliers = useMemo(() => {
        if (!suppliers) return [];
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const filtered = suppliers.filter(s => {
            const supplierDate = format(new Date(s.date), 'yyyy-MM-dd');
            const nameMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            return supplierDate === dateStr && nameMatch;
        });
        // Sort by srNo in descending order
        return filtered.sort((a, b) => {
            const numA = parseInt(a.srNo.substring(1), 10);
            const numB = parseInt(b.srNo.substring(1), 10);
            return numB - numA;
        });
    }, [suppliers, selectedDate, searchTerm]);

    const summary = useMemo(() => {
        const initialSummary = { gross: 0, tier: 0, total: 0, karta: 0, net: 0, labour: 0, kartaAmount: 0, kanta: 0, amount: 0, netAmount: 0, rate: 0, kartaPercentage: 0 };
        const newSummary = filteredSuppliers.reduce((acc, s) => {
            acc.gross += s.grossWeight;
            acc.tier += s.teirWeight;
            acc.total += s.weight;
            acc.karta += s.kartaWeight;
            acc.net += s.netWeight;
            acc.labour += s.labouryAmount;
            acc.kartaAmount += s.kartaAmount;
            acc.kanta += s.kanta;
            acc.amount += s.amount;
            acc.netAmount += Number(s.netAmount);
            acc.kartaPercentage += s.kartaPercentage;
            return acc;
        }, initialSummary);

        if (newSummary.total > 0) {
            newSummary.rate = newSummary.amount / newSummary.total;
        }
        if (filteredSuppliers.length > 0) {
            newSummary.kartaPercentage = newSummary.kartaPercentage / filteredSuppliers.length;
        }

        return newSummary;
    }, [filteredSuppliers]);

    const handlePrint = () => {
        const node = printRef.current;
        if (!node || !settings) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the content to print.' });
            return;
        }

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print window.' });
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Daily Supplier Report</title>');

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                const style = iframeDoc.createElement('style');
                style.appendChild(iframeDoc.createTextNode(cssText));
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn("Could not copy stylesheet:", e);
            }
        });
        
         const printStyles = iframeDoc.createElement('style');
         printStyles.textContent = `
            @media print {
                @page { size: landscape; margin: 10mm; }
                body { 
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important;
                    background-color: #fff !important;
                }
                .printable-area, .printable-area * {
                    background-color: #fff !important;
                    color: #000 !important;
                    border-color: #ccc !important;
                }
                .print-header { 
                    margin-bottom: 0.5rem; 
                    text-align: center;
                    display: block !important;
                }
                thead {
                    display: table-header-group !important; /* Ensure header repeats on each page */
                    background-color: #e5e7eb !important;
                }
                tbody {
                    display: table-row-group !important;
                }
                tr {
                    page-break-inside: avoid !important;
                }
                .no-print { 
                    display: none !important; 
                }
                .print-summary-container {
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 0.5rem !important;
                }
                .h-\\[60vh\\] {
                    height: auto !important;
                    overflow: visible !important;
                }
                 .scrollbar-hide {
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            }
        `;
        iframeDoc.head.appendChild(printStyles);

        iframeDoc.write('</head><body>');
        
        const printContent = `
            <div class="printable-area p-4">
                <div class="hidden print:block print-header">
                    <h2>${toTitleCase(settings.companyName)} - Daily Supplier Report</h2>
                    <p>Date: ${format(selectedDate, "dd-MMM-yyyy")}</p>
                </div>
                ${node.innerHTML}
            </div>
        `;
        
        iframeDoc.body.innerHTML = printContent;
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };


    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
             <div ref={printRef}>
                <Card className="print-no-border">
                    <CardContent className="p-4 space-y-4">
                         <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center no-print">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus /></PopoverContent>
                            </Popover>
                             <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 print:flex print-summary-container">
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
                           <CategorySummaryCard title="Financial Summary" icon={<CircleDollarSign size={16}/>} data={[
                                { label: 'Total Amt', value: formatCurrency(summary.amount) },
                                { label: 'Net Payable', value: formatCurrency(summary.netAmount), isHighlighted: true },
                           ]}/>
                        </div>
                        

                        <div className="h-[60vh] overflow-auto scrollbar-hide">
                            <table className="w-full text-xs border-collapse border border-gray-300">
                                <thead className="bg-muted font-semibold text-[10px] uppercase whitespace-nowrap sticky top-0 z-10">
                                    <tr className="text-primary">
                                        <th className="border border-gray-300 p-1 text-left">SR</th>
                                        <th className="border border-gray-300 p-1 text-left">Date</th>
                                        <th className="border border-gray-300 p-1 text-left">Term</th>
                                        <th className="border border-gray-300 p-1 text-left">Name</th>
                                        <th className="border border-gray-300 p-1 text-left">S/O</th>
                                        <th className="border border-gray-300 p-1 text-left">Vehicle</th>
                                        <th className="border border-gray-300 p-1 text-right">Gross</th>
                                        <th className="border border-gray-300 p-1 text-right">Teir</th>
                                        <th className="border border-gray-300 p-1 text-right">Final</th>
                                        <th className="border border-gray-300 p-1 text-right">Karta</th>
                                        <th className="border border-gray-300 p-1 text-right">Net</th>
                                        <th className="border border-gray-300 p-1 text-right">Rate</th>
                                        <th className="border border-gray-300 p-1 text-right">Amount</th>
                                        <th className="border border-gray-300 p-1 text-right">Karta Amt</th>
                                        <th className="border border-gray-300 p-1 text-right">Laboury</th>
                                        <th className="border border-gray-300 p-1 text-right">Kanta</th>
                                        <th className="border border-gray-300 p-1 text-right">Net Payable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map((s) => (
                                        <tr key={s.id} className="hover:bg-muted/50 whitespace-nowrap h-[29px]">
                                            <td className="border border-gray-300 p-1 font-bold">{s.srNo}</td>
                                            <td className="border border-gray-300 p-1">{format(new Date(s.date), "dd-MMM")}</td>
                                            <td className="border border-gray-300 p-1 text-center">{s.term}</td>
                                            <td className="border border-gray-300 p-1">{toTitleCase(s.name)}</td>
                                            <td className="border border-gray-300 p-1">{toTitleCase(s.so)}</td>
                                            <td className="border border-gray-300 p-1">{s.vehicleNo.toUpperCase()}</td>
                                            <td className="border border-gray-300 p-1 text-right">{s.grossWeight.toFixed(2)}</td>
                                            <td className="border border-gray-300 p-1 text-right">{s.teirWeight.toFixed(2)}</td>
                                            <td className="border border-gray-300 p-1 text-right font-semibold">{s.weight.toFixed(2)}</td>
                                            <td className="border border-gray-300 p-1 text-right">{s.kartaWeight.toFixed(2)}</td>
                                            <td className="border border-gray-300 p-1 text-right font-bold text-blue-600">{s.netWeight.toFixed(2)}</td>
                                            <td className="border border-gray-300 p-1 text-right">{formatCurrency(s.rate)}</td>
                                            <td className="border border-gray-300 p-1 text-right">{formatCurrency(s.amount)}</td>
                                            <td className="border border-gray-300 p-1 text-right text-red-600">{formatCurrency(s.kartaAmount)}</td>
                                            <td className="border border-gray-300 p-1 text-right text-red-600">{formatCurrency(s.labouryAmount)}</td>
                                            <td className="border border-gray-300 p-1 text-right text-red-600">{formatCurrency(s.kanta)}</td>
                                            <td className="border border-gray-300 p-1 text-right font-bold text-sm">{formatCurrency(Number(s.netAmount))}</td>
                                        </tr>
                                    ))}
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

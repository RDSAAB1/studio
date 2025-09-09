
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Customer } from '@/lib/definitions';
import { getSuppliersRealtime } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Loader2, Search, Printer, Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const SummaryItem = ({ label, value, isCurrency = false, className }: { label: string; value: string | number; isCurrency?: boolean; className?: string }) => (
    <div className={cn("flex justify-between items-baseline", className)}>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-right">{isCurrency ? formatCurrency(Number(value)) : Number(value).toFixed(2)}</p>
    </div>
);

export default function DailySupplierReportClient() {
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = getSuppliersRealtime(
            (data) => {
                setSuppliers(data);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching suppliers:", error);
                toast({ title: "Failed to load supplier data.", variant: "destructive" });
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, [toast]);

    const filteredSuppliers = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return suppliers.filter(s => {
            const supplierDate = format(new Date(s.date), 'yyyy-MM-dd');
            const nameMatch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
            return supplierDate === dateStr && nameMatch;
        });
    }, [suppliers, selectedDate, searchTerm]);

    const summary = useMemo(() => {
        const initialSummary = { gross: 0, tier: 0, total: 0, karta: 0, net: 0, labour: 0, kartaAmount: 0, kanta: 0, amount: 0, netAmount: 0, rate: 0 };
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
            return acc;
        }, initialSummary);

        if (newSummary.total > 0) {
            newSummary.rate = newSummary.amount / newSummary.total;
        }

        return newSummary;
    }, [filteredSuppliers]);

    const handlePrint = () => {
        const node = printRef.current;
        if (!node) return;

        const newWindow = window.open('', '_blank', 'height=800,width=1200');
        if (newWindow) {
            newWindow.document.write('<html><head><title>Daily Supplier Report</title>');
            // Copy styles
            Array.from(document.styleSheets).forEach(styleSheet => {
                try {
                    const css = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                    const styleElement = newWindow.document.createElement('style');
                    styleElement.appendChild(newWindow.document.createTextNode(css));
                    newWindow.document.head.appendChild(styleElement);
                } catch (e) {
                    console.warn("Could not copy stylesheet:", e);
                }
            });
            
             const printStyles = newWindow.document.createElement('style');
             printStyles.textContent = `
                @media print {
                    @page { size: landscape; margin: 10mm; }
                    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .printable-area { background-color: #fff !important; color: #000 !important; }
                    .printable-area * { color: #000 !important; border-color: #ccc !important; }
                    .print-bg-yellow { background-color: #FBBF24 !important; }
                    .print-bg-gray { background-color: #F3F4F6 !important; }
                }
            `;
            newWindow.document.head.appendChild(printStyles);

            newWindow.document.write('</head><body></body></html>');
            newWindow.document.body.innerHTML = `<div class="printable-area p-4">${node.innerHTML}</div>`;
            newWindow.document.close();
            
            setTimeout(() => {
                newWindow.focus();
                newWindow.print();
                newWindow.close();
            }, 500);
        }
    };


    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
             <div ref={printRef}>
                <Card>
                    <CardContent className="p-4 space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div className="flex items-center gap-4 col-span-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                            <div className="md:col-span-2">
                                <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="max-w-sm" />
                            </div>
                        </div>

                         <div className="p-2 border rounded-lg bg-amber-400 text-black">
                            <h3 className="text-center font-bold text-sm mb-2">TODAY TOTAL SUMMARY</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1 text-xs">
                                <SummaryItem label="GROSS" value={summary.gross.toFixed(2)} />
                                <SummaryItem label="TIER" value={summary.tier.toFixed(2)} />

                                <SummaryItem label="TOTAL" value={summary.total.toFixed(2)} />
                                <SummaryItem label="KARTA" value={summary.karta.toFixed(2)} />

                                <SummaryItem label="NET" value={summary.net.toFixed(2)} />
                                <SummaryItem label="LABOUR" value={formatCurrency(summary.labour)} />

                                <SummaryItem label="RATE" value={formatCurrency(summary.rate)} />
                                <SummaryItem label="KARTA" value={formatCurrency(summary.kartaAmount)} />

                                <SummaryItem label="KANTA" value={formatCurrency(summary.kanta)} />
                                <SummaryItem label="AMOUNT" value={formatCurrency(summary.amount)} />
                                
                                <div className="sm:col-span-2 md:col-span-4 lg:col-span-6 border-t border-black mt-1 pt-1">
                                   <SummaryItem label="NET AMT" value={formatCurrency(summary.netAmount)} className="text-base" />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse border border-gray-400">
                                <thead className="bg-amber-400 print-bg-yellow">
                                    <tr>
                                        <th className="border border-gray-400 p-1 text-left">SR NO.</th>
                                        <th className="border border-gray-400 p-1 text-left">TRM</th>
                                        <th className="border border-gray-400 p-1 text-left">NAME</th>
                                        <th className="border border-gray-400 p-1 text-left">S/O</th>
                                        <th className="border border-gray-400 p-1 text-left">ADDRESS</th>
                                        <th className="border border-gray-400 p-1 text-left">CONTACT</th>
                                        <th className="border border-gray-400 p-1 text-right">GROSS</th>
                                        <th className="border border-gray-400 p-1 text-right">TEIR</th>
                                        <th className="border border-gray-400 p-1 text-right">TOTAL</th>
                                        <th className="border border-gray-400 p-1 text-right">KARTA</th>
                                        <th className="border border-gray-400 p-1 text-right">KARTA AMT</th>
                                        <th className="border border-gray-400 p-1 text-right">NET</th>
                                        <th className="border border-gray-400 p-1 text-right">RATE</th>
                                        <th className="border border-gray-400 p-1 text-right">LABOURY</th>
                                        <th className="border border-gray-400 p-1 text-right">KANTA</th>
                                        <th className="border border-gray-400 p-1 text-right">AMOUNT</th>
                                        <th className="border border-gray-400 p-1 text-right">NET AMT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map((s) => (
                                        <tr key={s.id} className="bg-gray-200 print-bg-gray">
                                            <td className="border border-gray-400 p-1">{s.srNo}</td>
                                            <td className="border border-gray-400 p-1">{s.term}</td>
                                            <td className="border border-gray-400 p-1">{toTitleCase(s.name)}</td>
                                            <td className="border border-gray-400 p-1">{toTitleCase(s.so)}</td>
                                            <td className="border border-gray-400 p-1">{toTitleCase(s.address)}</td>
                                            <td className="border border-gray-400 p-1">{s.contact}</td>
                                            <td className="border border-gray-400 p-1 text-right">{s.grossWeight.toFixed(2)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{s.teirWeight.toFixed(2)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{s.weight.toFixed(2)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{s.kartaWeight.toFixed(2)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(s.kartaAmount)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{s.netWeight.toFixed(2)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(s.rate)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(s.labouryAmount)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(s.kanta)}</td>
                                            <td className="border border-gray-400 p-1 text-right">{formatCurrency(s.amount)}</td>
                                            <td className="border border-gray-400 p-1 text-right font-bold">{formatCurrency(Number(s.netAmount))}</td>
                                        </tr>
                                    ))}
                                    {Array.from({ length: Math.max(0, 15 - filteredSuppliers.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-7">
                                            {Array.from({ length: 17 }).map((_, j) => <td key={j} className="border border-gray-400 p-1"></td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
             </div>
             <div className="flex justify-end mt-4">
                 <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
             </div>
        </div>
    );
}

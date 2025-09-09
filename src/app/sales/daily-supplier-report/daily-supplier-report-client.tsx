
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
    <div className={cn("flex justify-between items-baseline p-1", className)}>
        <p className="text-xs text-gray-600">{label}:</p>
        <p className="text-xs font-bold">{isCurrency ? formatCurrency(Number(value)) : Number(value).toFixed(2)}</p>
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
                    .printable-area, .printable-area table, .printable-area tr, .printable-area td, .printable-area th { background-color: #fff !important; color: #000 !important; }
                    .printable-area * { color: #000 !important; border-color: #ccc !important; }
                    .print-bg-amber { background-color: #f2f2f2 !important; }
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

                         <div className="p-2 border rounded-lg bg-white text-black">
                            <h3 className="text-center font-bold text-sm mb-2">TODAY TOTAL SUMMARY</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-x-4 gap-y-1">
                                <SummaryItem label="GROSS" value={summary.gross} />
                                <SummaryItem label="TIER" value={summary.tier} />
                                <SummaryItem label="TOTAL" value={summary.total} />
                                <SummaryItem label="KARTA" value={summary.karta} />
                                <SummaryItem label="NET" value={summary.net} />
                                <SummaryItem label="LABOUR" value={summary.labour} isCurrency />
                                <SummaryItem label="RATE" value={summary.rate} isCurrency />
                                <SummaryItem label="KARTA" value={summary.kartaAmount} isCurrency />
                                <SummaryItem label="KANTA" value={summary.kanta} isCurrency />
                                <SummaryItem label="AMOUNT" value={summary.amount} isCurrency />
                                <SummaryItem label="NET AMT" value={summary.netAmount} isCurrency className="text-base" />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                           <table className="w-full text-sm border-collapse border border-gray-400">
                                <thead>
                                    <tr className="bg-amber-400 print-bg-amber text-black">
                                        <th className="border border-gray-400 p-1 text-left">Info</th>
                                        <th className="border border-gray-400 p-1 text-left">Supplier Info</th>
                                        <th className="border border-gray-400 p-1 text-left">Weight Details</th>
                                        <th className="border border-gray-400 p-1 text-left">Amount</th>
                                        <th className="border border-gray-400 p-1 text-left">Deductions</th>
                                        <th className="border border-gray-400 p-1 text-right">Net Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map((s, index) => (
                                        <tr key={s.id} className={index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                                            <td className="border border-gray-400 p-2 align-top">
                                                <div className="font-bold">{s.srNo}</div>
                                                <div className="text-xs text-gray-600">{format(new Date(s.date), "dd-MMM-yy")}</div>
                                                <div className="text-xs text-gray-600">Term: {s.term} days</div>
                                                <div className="text-xs text-gray-600">Vehicle: {s.vehicleNo.toUpperCase()}</div>
                                            </td>
                                            <td className="border border-gray-400 p-2 align-top">
                                                <div className="font-bold">{toTitleCase(s.name)}</div>
                                                <div className="text-xs text-gray-600">S/O: {toTitleCase(s.so)}</div>
                                                <div className="text-xs text-gray-600">Mob: {s.contact}</div>
                                                <div className="text-xs text-gray-600">{toTitleCase(s.address)}</div>
                                            </td>
                                            <td className="border border-gray-400 p-2 align-top">
                                                <div className="text-xs text-gray-600">Gross: {s.grossWeight.toFixed(2)} | Teir: {s.teirWeight.toFixed(2)}</div>
                                                <div className="font-semibold">Final Wt: {s.weight.toFixed(2)}</div>
                                                <div className="font-semibold text-blue-600">Net Wt: {s.netWeight.toFixed(2)}</div>
                                            </td>
                                            <td className="border border-gray-400 p-2 align-top">
                                                <div className="text-xs text-gray-600">Rate: {formatCurrency(s.rate)}</div>
                                                <div className="font-semibold">Amount: {formatCurrency(s.amount)}</div>
                                            </td>
                                            <td className="border border-gray-400 p-2 align-top">
                                                <div className="text-xs text-gray-600">Karta: {formatCurrency(s.kartaAmount)}</div>
                                                <div className="text-xs text-gray-600">Labour: {formatCurrency(s.labouryAmount)}</div>
                                                <div className="text-xs text-gray-600">Kanta: {formatCurrency(s.kanta)}</div>
                                            </td>
                                            <td className="border border-gray-400 p-2 align-top text-right font-bold text-base">{formatCurrency(Number(s.netAmount))}</td>
                                        </tr>
                                    ))}
                                    {Array.from({ length: Math.max(0, 15 - filteredSuppliers.length) }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-12"><td className="border border-gray-400" colSpan={6}></td></tr>
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

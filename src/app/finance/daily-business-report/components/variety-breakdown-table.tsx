import React from 'react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from "@/lib/utils";
import { Package, Hash, Weight, IndianRupee, Tag, Info } from 'lucide-react';

interface VarietyBreakdownTableProps {
    reportData: any;
}

export const VarietyBreakdownTable: React.FC<VarietyBreakdownTableProps> = ({ reportData }) => {
    const varietyEntries = Object.entries(reportData.varietyDayData || {});
    if (varietyEntries.length === 0) return null;

    const METRICS = [
        { label: 'P', key: 'parchi', format: (v: any) => v },
        { label: 'Gross', key: 'gross', format: (v: any) => v.toFixed(2) },
        { label: 'Tier', key: 'tier', format: (v: any) => v.toFixed(2) },
        { label: 'Final', key: 'finalWt', format: (v: any) => v.toFixed(2) },
        { label: 'Karta', key: 'kartaWt', format: (v: any) => v.toFixed(2), color: 'text-red-500' },
        { label: 'Net Wt', key: 'netWt', format: (v: any) => v.toFixed(2), bold: true, color: 'text-emerald-700' },
        { label: 'Rate', key: 'avgRate', format: (v: any, d: any) => Math.round(d.totalRate / (d.parchi || 1)) },
        { label: 'Amount', key: 'totalAmt', format: (v: any) => Math.round(v).toLocaleString() },
        { label: 'Karta A', key: 'kartaAmt', format: (v: any) => Math.round(v).toLocaleString(), color: 'text-red-500' },
        { label: 'A.KARTA', key: 'afterKartaAmt', format: (v: any) => Math.round(v).toLocaleString(), color: 'text-indigo-600', bold: true },
        { label: 'L/K', key: 'labkan', format: (v: any, d: any) => `${Math.round(d.labAmt)}/${Math.round(d.kanAmt)}` },
        { label: 'NET AMT', key: 'netPayable', format: (v: any) => Math.round(v).toLocaleString() },
        { label: 'CD', key: 'cdAmt', format: (v: any) => Math.round(v).toLocaleString(), color: 'text-orange-600' },
        { label: 'F.NET', key: 'finalNet', format: (v: any) => Math.round(v).toLocaleString(), bold: true, color: 'text-indigo-700' },
        { label: 'Paid', key: 'totalPaid', format: (v: any) => Math.round(v).toLocaleString(), color: 'text-emerald-600' },
    ];

    return (
        <Card className="border-none shadow-lg bg-white overflow-hidden rounded-lg">
            <CardHeader className="bg-[#1e293b] py-1.5 px-3 text-white">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Package size={12} className="text-indigo-400" /> B: Variety Audit Ledger
                    </CardTitle>
                    <span className="text-[8px] font-black opacity-50 uppercase bg-white/10 px-1.5 py-0.5 rounded">Compact Mode</span>
                </div>
            </CardHeader>
            <div className="overflow-x-auto no-scrollbar">
                <Table className="border-collapse">
                    <TableHeader className="bg-slate-100 border-b border-slate-300">
                        <TableRow className="h-6 min-h-0 border-none">
                            <TableHead className="w-[80px] text-[8px] font-black text-slate-500 uppercase border-r border-slate-200 sticky left-0 z-30 bg-slate-100 text-center p-0 h-6 min-h-0">Var.</TableHead>
                            <TableHead className="w-[85px] text-[8px] font-black text-slate-500 uppercase border-r border-slate-200 sticky left-[80px] z-30 bg-slate-100 text-center p-0 h-6 min-h-0">Date</TableHead>
                            {METRICS.map(m => (
                                <TableHead key={m.key} className="text-center text-[8px] font-black text-slate-700 border-r border-slate-200 uppercase px-1 whitespace-nowrap h-6 min-h-0">
                                    {m.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {varietyEntries.map(([variety, days]: [string, any]) => {
                            const sortedDays = [...days].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                            const total = days.reduce((acc: any, d: any) => ({
                                parchi: acc.parchi + d.parchi,
                                gross: acc.gross + d.gross,
                                tier: acc.tier + d.tier,
                                finalWt: acc.finalWt + d.finalWt,
                                kartaWt: acc.kartaWt + d.kartaWt,
                                netWt: acc.netWt + d.netWt,
                                totalAmt: acc.totalAmt + d.totalAmt,
                                kartaAmt: acc.kartaAmt + d.kartaAmt,
                                afterKartaAmt: acc.afterKartaAmt + d.afterKartaAmt,
                                labAmt: acc.labAmt + d.labAmt,
                                kanAmt: acc.kanAmt + d.kanAmt,
                                netPayable: acc.netPayable + d.netPayable,
                                cdAmt: acc.cdAmt + d.cdAmt,
                                finalNet: acc.finalNet + d.finalNet,
                                totalPaid: acc.totalPaid + d.totalPaid,
                                totalRate: acc.totalRate + d.totalRate,
                                count: acc.count + 1
                            }), { 
                                parchi: 0, gross: 0, tier: 0, finalWt: 0, kartaWt: 0, netWt: 0, 
                                totalAmt: 0, kartaAmt: 0, afterKartaAmt: 0, labAmt: 0, kanAmt: 0, 
                                netPayable: 0, cdAmt: 0, finalNet: 0, totalPaid: 0, totalRate: 0, count: 0 
                            });

                            return (
                                <React.Fragment key={variety}>
                                    {sortedDays.map((day, dIdx) => {
                                        const isAlt = dIdx % 2 !== 0;
                                        const bgClass = isAlt ? '!bg-slate-100' : '!bg-white';
                                        return (
                                        <TableRow key={`${variety}-${day.date}`} className={`hover:bg-indigo-50/50 transition-colors h-6 min-h-0 border-b border-slate-200 ${bgClass}`}>
                                            {dIdx === 0 && (
                                                <TableCell 
                                                    rowSpan={sortedDays.length + 1} 
                                                    className="sticky left-0 z-20 !bg-white border-r border-slate-300 font-black text-[8px] text-slate-800 uppercase p-0 text-center align-middle h-auto"
                                                >
                                                    <div className="rotate-180 [writing-mode:vertical-lr] py-1 border-l-2 border-indigo-500 inline-block leading-none">
                                                        {variety}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className={`sticky left-[80px] z-20 border-r border-slate-200 text-[8px] font-bold text-slate-400 uppercase px-1 whitespace-nowrap text-center p-0 leading-none h-6 min-h-0 ${bgClass}`}>
                                                {format(new Date(day.date), 'dd MMM')}
                                            </TableCell>
                                            {METRICS.map(m => (
                                                <TableCell key={m.key} className={cn(
                                                    `text-center text-[9px] font-mono border-r border-slate-200/40 p-0 whitespace-nowrap leading-none h-6 min-h-0 ${bgClass}`,
                                                    m.color,
                                                    m.bold && `font-black ${isAlt ? '!bg-slate-200/80' : '!bg-slate-50'}`
                                                )}>
                                                    {m.format(day[m.key], day)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    )})}
                                    <TableRow className="bg-slate-200 hover:bg-slate-300 transition-colors h-7 min-h-0 border-b border-slate-400">
                                        <TableCell className="sticky left-[80px] z-20 bg-slate-200 border-r border-slate-400 text-[10px] font-black text-indigo-900 uppercase px-1 text-center p-0 leading-none h-7 min-h-0">
                                            TOT
                                        </TableCell>
                                        {METRICS.map(m => (
                                            <TableCell key={m.key} className={cn(
                                                "text-center text-[10px] font-black font-mono border-r border-slate-300 p-0 whitespace-nowrap leading-none h-7 min-h-0",
                                                m.bold ? "text-indigo-950 bg-slate-300/50" : "text-slate-800"
                                            )}>
                                                {m.format(total[m.key], total)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};

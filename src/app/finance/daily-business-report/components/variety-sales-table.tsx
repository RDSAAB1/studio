import React from 'react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Package } from 'lucide-react';
import { cn } from "@/lib/utils";

interface VarietySalesTableProps {
    reportData: any;
}

export const VarietySalesTable: React.FC<VarietySalesTableProps> = ({ reportData }) => {
    const varietyEntries = Object.entries(reportData.varietySaleDayData || {});
    if (varietyEntries.length === 0) return null;

    return (
        <Card className="border-none shadow-lg bg-white overflow-hidden rounded-lg">
            <CardHeader className="bg-[#1e293b] py-3 px-6 text-white">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3">
                        <TrendingUp size={18} className="text-indigo-400" /> B-III: VARIETY SALES AUDIT
                    </CardTitle>
                    <span className="text-[10px] font-black opacity-60 uppercase bg-white/10 px-3 py-1 rounded-full italic tracking-wider">Daily Sale History</span>
                </div>
            </CardHeader>
            <div className="overflow-x-auto overflow-y-auto no-scrollbar max-h-[350px] scroll-smooth relative">
                <Table className="border-collapse relative">
                    <TableHeader className="bg-slate-100 border-b border-slate-300 sticky top-0 z-[60] shadow-sm">
                        <TableRow className="h-10 min-h-0 border-none">
                            <TableHead className="w-[80px] text-[10px] font-black text-slate-500 uppercase border-r border-slate-200 sticky left-0 z-30 bg-slate-100 text-center p-0 h-10">Variety</TableHead>
                            <TableHead className="w-[80px] text-[10px] font-black text-slate-500 uppercase border-r border-slate-200 text-center p-0 h-10">Date</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 border-r border-slate-200 uppercase px-3 h-10">Count</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 border-r border-slate-200 uppercase px-3 h-10">Final Wt</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 border-r border-slate-200 uppercase px-3 h-10">Net Wt</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 border-r border-slate-200 uppercase px-3 h-10">Avg Rate</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 border-r border-slate-200 uppercase px-3 h-10">Gross Amt</TableHead>
                            <TableHead className="text-center text-[10px] font-black text-slate-700 uppercase px-3 h-10">Net Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {varietyEntries.map(([variety, days]: [string, any]) => {
                            const total = days.reduce((acc: any, d: any) => ({
                                finalWt: acc.finalWt + d.finalWt,
                                netWt: acc.netWt + d.netWt,
                                grossAmt: acc.grossAmt + d.grossAmt,
                                netAmt: acc.netAmt + d.netAmt,
                                count: acc.count + d.count,
                                totalRate: acc.totalRate + d.totalRate
                            }), { finalWt: 0, netWt: 0, grossAmt: 0, netAmt: 0, count: 0, totalRate: 0 });

                            return (
                                <React.Fragment key={variety}>
                                    {days.map((day: any, dIdx: number) => {
                                        const isAlt = dIdx % 2 !== 0;
                                        const bgClass = isAlt ? '!bg-slate-100' : '!bg-white';
                                        return (
                                        <TableRow key={`${variety}-${day.date}`} className={`hover:bg-indigo-50/50 transition-colors h-8 min-h-0 border-b border-slate-100 ${bgClass}`}>
                                            {dIdx === 0 && (
                                                <TableCell 
                                                    rowSpan={days.length + 1} 
                                                    className="sticky left-0 z-20 !bg-white border-r border-slate-300 font-black text-[11px] text-slate-800 uppercase p-0 text-center align-middle"
                                                >
                                                    <div className="rotate-180 [writing-mode:vertical-lr] py-3 border-l-2 border-indigo-500 inline-block leading-none tracking-tighter">
                                                        {variety}
                                                    </div>
                                                </TableCell>
                                            )}
                                            <TableCell className={`text-center text-[10px] font-bold text-slate-500 border-r border-slate-100 p-0 h-8 ${bgClass}`}>
                                                {day.date}
                                            </TableCell>
                                            <TableCell className={`text-center text-[11px] font-mono font-bold text-slate-600 border-r border-slate-100 p-0 h-8 ${bgClass}`}>
                                                {day.count}
                                            </TableCell>
                                            <TableCell className={`text-center text-[11px] font-mono font-bold text-slate-600 border-r border-slate-100 p-0 h-8 ${bgClass}`}>
                                                {day.finalWt.toFixed(2)}
                                            </TableCell>
                                            <TableCell className={`text-center text-[12px] font-mono font-black text-indigo-700 border-r border-slate-100 p-0 h-8 ${isAlt ? 'bg-slate-200' : 'bg-slate-50'}`}>
                                                {day.netWt.toFixed(2)}
                                            </TableCell>
                                            <TableCell className={`text-center text-[11px] font-mono font-bold text-slate-700 border-r border-slate-100 p-0 h-8 ${bgClass}`}>
                                                ₹{Math.round(day.avgRate).toLocaleString()}
                                            </TableCell>
                                            <TableCell className={`text-center text-[11px] font-mono font-bold text-slate-700 border-r border-slate-100 p-0 h-8 ${bgClass}`}>
                                                ₹{Math.round(day.grossAmt).toLocaleString()}
                                            </TableCell>
                                            <TableCell className={`text-center text-[12px] font-mono font-black text-indigo-900 p-0 h-8 ${isAlt ? 'bg-slate-200' : 'bg-slate-50'}`}>
                                                ₹{Math.round(day.netAmt).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                    <TableRow className="bg-slate-200 hover:bg-slate-300 transition-colors h-10 min-h-0 border-b border-slate-400">
                                        <TableCell className="text-center text-[11px] font-black text-indigo-900 uppercase p-0 h-10">TOT</TableCell>
                                        <TableCell className="text-center text-[11px] font-black font-mono text-slate-900 border-r border-slate-300 p-0 h-10">{total.count}</TableCell>
                                        <TableCell className="text-center text-[11px] font-black font-mono text-slate-900 border-r border-slate-300 p-0 h-10">{total.finalWt.toFixed(2)}</TableCell>
                                        <TableCell className="text-center text-[13px] font-black font-mono text-indigo-900 border-r border-slate-300 p-0 h-10 bg-slate-300/50">{total.netWt.toFixed(2)}</TableCell>
                                        <TableCell className="text-center text-[11px] font-black font-mono text-slate-900 border-r border-slate-300 p-0 h-10">₹{Math.round(total.totalRate / (total.count || 1)).toLocaleString()}</TableCell>
                                        <TableCell className="text-center text-[11px] font-black font-mono text-slate-900 border-r border-slate-300 p-0 h-10">₹{Math.round(total.grossAmt).toLocaleString()}</TableCell>
                                        <TableCell className="text-center text-[13px] font-black font-mono text-indigo-950 p-0 h-10 bg-slate-300/80">₹{Math.round(total.netAmt).toLocaleString()}</TableCell>
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

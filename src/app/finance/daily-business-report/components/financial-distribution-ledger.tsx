import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from "@/lib/utils";

interface FinancialDistributionLedgerProps {
    reportData: any;
    startDate: Date;
    endDate: Date;
}

export const FinancialDistributionLedger: React.FC<FinancialDistributionLedgerProps> = ({ 
    reportData, 
    startDate, 
    endDate 
}) => {
    const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

    return (
        <Card className="shadow-md border-none bg-white p-0 overflow-hidden">
            <CardHeader className="bg-slate-900 border-b py-3 text-white">
                <div className="flex justify-between items-center w-full">
                    <div>
                        <CardTitle className="text-xs font-black uppercase tracking-widest leading-none">Daily Financial Distribution Ledger</CardTitle>
                        <CardDescription className="text-[10px] mt-1 text-slate-400 uppercase tracking-tighter">Detailed performance breakdown per day</CardDescription>
                    </div>
                    <div className="text-[10px] bg-white/20 px-2 py-1 rounded font-bold uppercase">
                        {isSameDay(startDate, endDate) ? 'Single Day View' : 'Multi-Day View'}
                    </div>
                </div>
            </CardHeader>
            <div className="overflow-auto max-h-[400px]">
                <Table>
                    <TableHeader className="sticky top-0 z-20 shadow-md">
                        <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-3 border-r border-slate-200 min-w-[75px]">Date</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier Cash</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier RTGS</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Gov Dist.</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200 bg-slate-200/50">Total Payments</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-red-700 uppercase text-right px-3 border-r border-slate-200">Expenses</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-emerald-700 uppercase text-right px-3 border-r border-slate-200">Income</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-purple-700 uppercase text-right px-3 border-r border-slate-200">S/E Cash</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-white bg-slate-900 uppercase text-right px-4">Net Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.dayWise.map((d: any, i: number) => {
                            const isAlt = i % 2 !== 0;
                            const bgClass = isAlt ? '!bg-slate-100' : '!bg-white';
                            return (
                                <TableRow key={i} className={`hover:bg-indigo-50 transition-colors border-b border-slate-200 ${bgClass}`}>
                                    <TableCell className={`font-bold text-slate-700 py-3 text-[11px] whitespace-nowrap text-center border-r border-slate-200/50 ${bgClass}`}>{d.date}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-200/50 ${bgClass}`}>{d.supplierCash > 0 ? d.supplierCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-200/50 ${bgClass}`}>{d.supplierRtgs > 0 ? d.supplierRtgs.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-200/50 ${bgClass}`}>{d.govDist > 0 ? d.govDist.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-mono font-bold text-slate-900 border-r border-slate-200/50 ${bgClass}`}>{d.totalPayments > 0 ? d.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-bold text-red-600 border-r border-slate-200/50 ${bgClass}`}>{d.expenses > 0 ? d.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-bold text-emerald-600 border-r border-slate-200/50 ${bgClass}`}>{d.incomes > 0 ? d.incomes.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[11px] font-bold text-purple-700 border-r border-slate-200/50 ${bgClass}`}>{d.seCash > 0 ? d.seCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                    <TableCell className={`text-right py-3 text-[12px] font-mono font-black text-slate-900 ${bgClass}`}>{d.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                </TableRow>
                            );
                        })}
                        <TableRow className="bg-slate-900 text-white hover:bg-slate-800 font-bold border-t-2 border-white/20">
                            <TableCell className="font-black uppercase py-4 text-center text-[11px] px-3">Total Period Distribution</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.supplierCash).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.supplierRtgs).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.govDist).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono font-black text-[12px] border-x border-white/10 px-3">{formatCurrency(reportData.distribution.totalPayments).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] text-red-200 px-3">{formatCurrency(reportData.distribution.expenses).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] text-emerald-200 px-3">{formatCurrency(reportData.distribution.incomes).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono text-[11px] text-purple-200 px-3">{formatCurrency(reportData.distribution.seCash).replace('₹','')}</TableCell>
                            <TableCell className="text-right py-4 font-mono font-black text-[13px] bg-purple-900 border-l border-white/20 px-4">{formatCurrency(reportData.distribution.netTotalBalance)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};

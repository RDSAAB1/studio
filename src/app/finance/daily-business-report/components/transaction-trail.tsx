import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from "@/lib/utils";

interface TransactionTrailProps {
    reportData: any;
}

export const TransactionTrail: React.FC<TransactionTrailProps> = ({ reportData }) => {
    return (
        <Card className="shadow-sm border-none bg-white p-0 overflow-hidden">
            <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                <CardTitle className="text-xs font-black uppercase tracking-widest leading-none flex items-center gap-2">
                    <FileText size={14} className="text-purple-200" /> Consolidated Transaction Trail
                </CardTitle>
                <CardDescription className="text-[10px] mt-1 text-purple-200 uppercase tracking-tighter font-medium">Chronological Business Ledger for the selected period</CardDescription>
            </CardHeader>
            <div className="overflow-auto max-h-[500px]">
                <Table>
                    <TableHeader className="sticky top-0 z-20 shadow-md">
                        <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200 min-w-[80px]">Date</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200">Particulars</TableHead>
                            <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200 min-w-[100px]">Ref ID</TableHead>
                            <TableHead className="text-right text-[11px] font-black h-11 text-red-700 uppercase px-4 border-r border-slate-200 min-w-[120px]">Debit (-)</TableHead>
                            <TableHead className="text-right text-[11px] font-black h-11 text-emerald-700 uppercase px-4 border-r border-slate-200 min-w-[120px]">Credit (+)</TableHead>
                            <TableHead className="text-right text-[11px] font-black h-11 text-white uppercase px-4 bg-[#5c3e7b] min-w-[130px]">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(() => {
                            let runningBalance = 0;
                            return reportData.consolidatedLedger.map((t: any, i: number) => {
                                runningBalance = runningBalance + (t.credit - t.debit);
                                return (
                                    <TableRow key={i} className="hover:bg-white border-b border-slate-100">
                                        <TableCell className="font-bold text-slate-900 py-3 text-[11px] whitespace-nowrap px-4">{format(new Date(t.date), 'dd MMM')}</TableCell>
                                        <TableCell className="py-3 text-[11px] font-medium text-slate-700 px-4">
                                                <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase mr-2 ${
                                                    t.type === 'Purchase'         ? 'bg-red-50 text-red-600' :
                                                    t.type === 'Labour'           ? 'bg-orange-50 text-orange-700' :
                                                    t.type === 'Kanta'            ? 'bg-yellow-50 text-yellow-700' :
                                                    t.type === 'Expense'          ? 'bg-red-50 text-red-600' :
                                                    t.type === 'Supplier Payment' ? 'bg-pink-50 text-pink-700' :
                                                    t.type === 'Transfer Out'     ? 'bg-orange-100 text-orange-800' :
                                                    t.type === 'Transfer In'      ? 'bg-teal-50 text-teal-700' :
                                                    t.type === 'Loan'             ? 'bg-indigo-50 text-indigo-700' :
                                                    t.type === 'P ADJUSTMENT'     ? 'bg-blue-50 text-blue-600' :
                                                    t.type === 'Liquid'           ? 'bg-slate-100 text-slate-600' :
                                                    'bg-emerald-50 text-emerald-600'
                                                }`}>
                                                    {t.type}
                                                </span>
                                                {t.particulars}
                                        </TableCell>
                                        <TableCell className="py-3 text-[10px] font-mono text-slate-400 px-4">{t.id}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-red-600 px-4">
                                            {(t.type === 'Transfer' ? (t.note || 0) : t.debit) > 0 ? formatCurrency(t.type === 'Transfer' ? (t.note || 0) : t.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-emerald-600 px-4">
                                            {(t.type === 'Transfer' ? (t.note || 0) : t.credit) > 0 ? formatCurrency(t.type === 'Transfer' ? (t.note || 0) : t.credit) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right py-3 text-[12px] font-black font-mono px-4 ${runningBalance >= 0 ? 'text-[#5c3e7b]' : 'text-red-700'}`}>
                                            {formatCurrency(runningBalance)}
                                        </TableCell>
                                    </TableRow>
                                );
                            });
                        })()}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
};

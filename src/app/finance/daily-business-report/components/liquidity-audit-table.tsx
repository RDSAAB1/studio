import React, { Fragment } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet } from 'lucide-react';
import { cn } from "@/lib/utils";

interface LiquidityAuditTableProps {
    reportData: any;
    globalData: any;
}

export const LiquidityAuditTable: React.FC<LiquidityAuditTableProps> = ({ reportData, globalData }) => {
    return (
        <Card className="border-none shadow-md bg-white overflow-hidden p-0 rounded-lg">
            <CardHeader className="bg-slate-900 py-1.5 px-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        <Wallet size={12} className="text-indigo-400" /> A: Liquidity Audit Matrix
                    </CardTitle>
                    <span className="text-[8px] font-black opacity-50 uppercase bg-white/10 px-1.5 py-0.5 rounded text-white">Ledger Mode</span>
                </div>
            </CardHeader>
            <div className="overflow-x-auto relative no-scrollbar bg-white border-b border-slate-200">
                <Table className="border-collapse">
                    <TableHeader className="bg-slate-100 border-b border-slate-300">
                        <TableRow className="h-8 border-none !bg-transparent">
                            <TableHead className="w-[60px] text-center font-black text-slate-500 uppercase text-[8px] sticky left-0 z-50 bg-slate-100 border-r border-slate-200 p-0">
                                DATE
                            </TableHead>
                            {['Cash Hand', 'Cash Home', ...globalData.bankAccounts.map((a: any) => a.bankName)].map((name, idx) => (
                                <TableHead key={idx} colSpan={2} className="text-center font-black text-slate-700 uppercase text-[8px] p-0 border-r border-slate-200 last:border-r-0">
                                    <div className="py-0.5 border-b border-slate-200 truncate px-1">{name}</div>
                                    <div className="flex justify-between px-1 text-[7px] font-black text-slate-400">
                                        <span>OP/IN</span>
                                        <span>CL/OUT</span>
                                    </div>
                                </TableHead>
                            ))}
                            <TableHead className="w-[100px] text-right px-2 font-black text-slate-800 uppercase text-[8px] sticky right-0 z-50 bg-slate-100 border-l border-slate-300">
                                GRAND TOTAL
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:nth-child(odd)]:bg-transparent">
                        {reportData.dayWiseLiquidity.map((d: any, i: number) => {
                            const isAlt = i % 2 !== 0;
                            const blockBg = isAlt ? 'bg-slate-100/60' : 'bg-white';
                            
                            return (
                                <Fragment key={i}>
                                    {/* PRIMARY ROW: OPENING / CLOSING */}
                                    <TableRow className="h-5 transition-none hover:bg-indigo-100/40 border-none group/row1 bg-transparent">
                                        <TableCell rowSpan={2} className={cn(
                                            "font-black text-slate-900 p-0 text-[8px] text-center sticky left-0 z-20 border-r-2 border-slate-300 border-b-2 border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)]",
                                            blockBg
                                        )}>
                                            {d.date}
                                        </TableCell>
                                        {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map((id) => {
                                            const m = d.metrics[id] || { opening: 0, closing: 0 };
                                            return (
                                                <Fragment key={`${id}-oc`}>
                                                    <TableCell className={cn("font-mono text-[9px] text-indigo-500 font-bold p-0 px-1.5 text-right border-none leading-none opacity-80 group-hover/row1:opacity-100", blockBg)}>
                                                        {Math.round(m.opening).toLocaleString('en-IN')}
                                                    </TableCell>
                                                    <TableCell className={cn("font-mono text-[9px] text-amber-600 font-black p-0 px-1.5 text-right border-r border-slate-200/60 leading-none", blockBg)}>
                                                        {Math.round(m.closing || 0).toLocaleString('en-IN')}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                        <TableCell rowSpan={2} className={cn(
                                            "px-2 py-0 font-black text-slate-900 font-mono text-[10px] text-right sticky right-0 z-20 border-l-2 border-slate-300 border-b-2 border-slate-300 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]",
                                            blockBg
                                        )}>
                                            <div className="leading-tight text-indigo-900">{Math.round(d.totalClosing).toLocaleString('en-IN')}</div>
                                        </TableCell>
                                    </TableRow>

                                    {/* SECONDARY ROW: INCOME / EXPENSE */}
                                    <TableRow className="h-4 transition-none hover:bg-indigo-100/40 border-b-2 border-slate-300 group/row2 bg-transparent">
                                        {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map((id) => {
                                            const m = d.metrics[id] || { income: 0, expense: 0 };
                                            return (
                                                <Fragment key={`${id}-ie`}>
                                                    <TableCell className={cn("font-sans text-[8.5px] text-emerald-600 font-black p-0 px-1.5 text-right border-none leading-none group-hover/row2:bg-emerald-100/20", blockBg)}>
                                                        {m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : ''}
                                                    </TableCell>
                                                    <TableCell className={cn("font-sans text-[8.5px] text-red-500 font-black p-0 px-1.5 text-right border-r border-slate-200/60 leading-none group-hover/row2:bg-red-100/20", blockBg)}>
                                                        {m.expense > 0 ? '–' + Math.round(m.expense).toLocaleString('en-IN') : ''}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                    </TableRow>
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="bg-slate-900 text-white p-1.5 flex justify-between items-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Audit Reconciliation Footer</span>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-slate-500 uppercase font-black">Opening</span>
                        <span className="text-[10px] font-bold text-slate-300">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[7px] text-indigo-400 uppercase font-black tracking-widest">Grand Total Assets</span>
                        <span className="text-sm font-black text-white">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

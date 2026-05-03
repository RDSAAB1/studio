import React, { Fragment, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, Search } from 'lucide-react';
import { cn } from "@/lib/utils";

interface LiquidityAuditTableProps {
    reportData: any;
    globalData: any;
    onAccountSelect: (acc: { id: string, name: string, accountNumber?: string }) => void;
}

export const LiquidityAuditTable: React.FC<LiquidityAuditTableProps> = ({ reportData, globalData, onAccountSelect }) => {
    const accounts = [
        { id: 'CashInHand', name: 'Cash Hand' },
        { id: 'CashAtHome', name: 'Cash Home' },
        ...globalData.bankAccounts.map((a: any) => ({ id: a.id, name: a.bankName, accountNumber: a.accountNumber }))
    ];

    return (
        <Card className="border-none shadow-md bg-white overflow-hidden p-0 rounded-lg">
            <CardHeader className="bg-slate-900 py-3 px-6">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 text-white">
                        <Wallet size={18} className="text-indigo-400" /> A: LIQUIDITY AUDIT MATRIX
                    </CardTitle>
                    <span className="text-[10px] font-black opacity-60 uppercase bg-white/10 px-3 py-1 rounded-full text-indigo-100 italic tracking-wider">Click any Account Name to view Full Ledger</span>
                </div>
            </CardHeader>
            <div className="overflow-x-auto overflow-y-auto relative no-scrollbar bg-white border-b border-slate-200 max-h-[400px] scroll-smooth">
                <Table className="border-collapse relative">
                    <TableHeader className="bg-slate-100 border-b border-slate-300 sticky top-0 z-[60] shadow-sm">
                        <TableRow className="h-20 border-none !bg-transparent">
                            <TableHead className="w-[100px] text-center font-black text-slate-600 uppercase text-[12px] sticky left-0 z-50 bg-slate-100 border-r border-slate-200 p-0">
                                DATE
                            </TableHead>
                            {accounts.map((acc, idx) => (
                                <TableHead key={idx} colSpan={2} className="text-center font-black text-slate-800 uppercase text-[12px] p-0 border-r border-slate-200 last:border-r-0">
                                    <button 
                                        onClick={() => onAccountSelect(acc)}
                                        className="w-full py-2 border-b-2 border-slate-200 hover:bg-slate-200 hover:text-indigo-700 transition-colors flex flex-col items-center justify-center gap-0.5 group font-black"
                                    >
                                        <div className="flex items-center gap-1.5 text-[14px] tracking-tight">
                                            <Search size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            {acc.name}
                                        </div>
                                        {acc.accountNumber && (
                                            <div className="text-indigo-600 font-mono text-[12px] opacity-90 group-hover:opacity-100 bg-indigo-50/50 px-2 rounded-md border border-indigo-100/50 mt-0.5">
                                                A/C: {acc.accountNumber}
                                            </div>
                                        )}
                                    </button>
                                    <div className="flex justify-between px-4 text-[11px] font-black text-slate-600 py-1.5 tracking-tighter">
                                        <span>OP / IN</span>
                                        <span>CL / OUT</span>
                                    </div>
                                </TableHead>
                            ))}
                            <TableHead className="w-[140px] text-right px-4 font-black text-slate-900 uppercase text-[12px] sticky right-0 z-50 bg-slate-100 border-l border-slate-300">
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
                                    <TableRow className="h-7 transition-none hover:bg-indigo-100/40 border-none group/row1 bg-transparent">
                                        <TableCell rowSpan={2} className={cn(
                                            "font-black text-slate-900 p-0 text-[10px] text-center sticky left-0 z-20 border-r-2 border-slate-300 border-b-2 border-slate-300 shadow-[2px_0_4px_rgba(0,0,0,0.03)]",
                                            blockBg
                                        )}>
                                            {d.date}
                                        </TableCell>
                                        {accounts.map((acc) => {
                                            const m = d.metrics[acc.id] || { opening: 0, closing: 0 };
                                            return (
                                                <Fragment key={`${acc.id}-oc`}>
                                                    <TableCell className={cn("font-mono text-[11px] text-indigo-500 font-bold p-0 px-2 text-right border-none leading-none opacity-80 group-hover/row1:opacity-100", blockBg)}>
                                                        {Math.round(m.opening).toLocaleString('en-IN')}
                                                    </TableCell>
                                                    <TableCell className={cn("font-mono text-[11px] text-amber-600 font-black p-0 px-2 text-right border-r border-slate-200/60 leading-none", blockBg)}>
                                                        {Math.round(m.closing || 0).toLocaleString('en-IN')}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                        <TableCell rowSpan={2} className={cn(
                                            "px-3 py-0 font-black text-slate-900 font-mono text-[12px] text-right sticky right-0 z-20 border-l-2 border-slate-300 border-b-2 border-slate-300 shadow-[-2px_0_4px_rgba(0,0,0,0.03)]",
                                            blockBg
                                        )}>
                                            <div className="leading-tight text-indigo-900">{Math.round(d.totalClosing).toLocaleString('en-IN')}</div>
                                        </TableCell>
                                    </TableRow>

                                    {/* SECONDARY ROW: INCOME / EXPENSE */}
                                    <TableRow className="h-6 transition-none hover:bg-indigo-100/40 border-b-2 border-slate-300 group/row2 bg-transparent">
                                        {accounts.map((acc) => {
                                            const m = d.metrics[acc.id] || { income: 0, expense: 0 };
                                            return (
                                                <Fragment key={`${acc.id}-ie`}>
                                                    <TableCell className={cn("font-sans text-[10px] text-emerald-600 font-black p-0 px-2 text-right border-none leading-none group-hover/row2:bg-emerald-100/20", blockBg)}>
                                                        {m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : ''}
                                                    </TableCell>
                                                    <TableCell className={cn("font-sans text-[10px] text-red-500 font-black p-0 px-2 text-right border-r border-slate-200/60 leading-none group-hover/row2:bg-red-100/20", blockBg)}>
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
            <div className="bg-slate-900 text-white p-2 px-4 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Reconciliation Footer</span>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-slate-500 uppercase font-black">Opening</span>
                        <span className="text-[12px] font-bold text-slate-300">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-indigo-400 uppercase font-black tracking-widest">Grand Total Assets</span>
                        <span className="text-lg font-black text-white">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

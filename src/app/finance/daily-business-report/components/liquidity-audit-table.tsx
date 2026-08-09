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
        <Card className="border border-slate-200/90 shadow-md bg-white overflow-hidden p-0 rounded-lg">
            <CardHeader className="bg-gradient-to-r from-white via-slate-50 to-slate-100/90 border-b border-slate-200 py-3.5 px-6">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-3 text-slate-900">
                        <Wallet size={18} style={{ color: 'var(--header-bg, var(--primary, #d97706))' }} /> A: LIQUIDITY AUDIT MATRIX
                    </CardTitle>
                    <span className="text-[10px] font-bold uppercase bg-slate-200/80 text-slate-700 border border-slate-300/60 px-3 py-1 rounded-full italic tracking-wider">Click any Account Name to view Full Ledger</span>
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
                                        className="w-full py-2 border-b-2 border-slate-200 hover:bg-slate-200 hover:text-amber-700 transition-colors flex flex-col items-center justify-center gap-0.5 group font-black"
                                    >
                                        <div className="flex items-center gap-1.5 text-[14px] tracking-tight">
                                            {acc.name}
                                        </div>
                                        {acc.accountNumber && (
                                            <div className="text-amber-600 font-mono text-[12px] opacity-90 group-hover:opacity-100 bg-amber-50/50 px-2 rounded-md border border-amber-100/50 mt-0.5">
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
                    <TableBody>
                        {reportData.dayWiseLiquidity?.map((row: any, rIdx: number) => {
                            const dateLabel = row?.date || row?.dateDisplay || `Day ${rIdx + 1}`;
                            const totalVal = row?.totalClosing ?? row?.dayTotal ?? 0;
                            return (
                                <Fragment key={rIdx}>
                                    <TableRow className="border-b border-slate-200 hover:bg-slate-50 text-[12px] font-bold text-slate-900">
                                        <TableCell className="text-center font-black text-slate-900 sticky left-0 z-40 bg-white border-r border-slate-200 py-3">
                                            {dateLabel}
                                        </TableCell>
                                        {accounts.map((acc, cIdx) => {
                                            const m = row?.metrics?.[acc.id] || row?.accounts?.[acc.id] || {};
                                            const closing = m.closing || 0;
                                            return (
                                                <TableCell key={cIdx} colSpan={2} className="text-center font-extrabold text-amber-700 border-r border-slate-200 last:border-r-0 py-3">
                                                    {closing > 0 ? Math.round(closing).toLocaleString('en-IN') : '0'}
                                                </TableCell>
                                            );
                                        })}
                                        <TableCell className="text-right px-4 font-black text-slate-900 sticky right-0 z-40 bg-white border-l border-slate-200 py-3">
                                            {Math.round(totalVal).toLocaleString('en-IN')}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-b border-slate-300 bg-slate-50/50 text-[11px] text-slate-600">
                                        <TableCell className="sticky left-0 z-40 bg-slate-50/50 border-r border-slate-200"></TableCell>
                                        {accounts.map((acc, cIdx) => {
                                            const m = row?.metrics?.[acc.id] || row?.accounts?.[acc.id] || {};
                                            const income = m.income || m.receipt || 0;
                                            const expense = m.expense || 0;
                                            return (
                                                <Fragment key={cIdx}>
                                                    <TableCell className="text-right pr-2 text-emerald-700 font-bold border-r border-slate-200/50">
                                                        {income > 0 ? '+' + Math.round(income).toLocaleString('en-IN') : ''}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-2 text-rose-700 font-bold border-r border-slate-200 last:border-r-0">
                                                        {expense > 0 ? '–' + Math.round(expense).toLocaleString('en-IN') : ''}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                        <TableCell className="sticky right-0 z-40 bg-slate-50/50 border-l border-slate-200"></TableCell>
                                    </TableRow>
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 text-slate-900 border-t border-slate-200 p-2.5 px-4 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Audit Reconciliation Footer</span>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-slate-500 uppercase font-black">Opening</span>
                        <span className="text-[12px] font-black text-slate-900">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: 'var(--header-bg, var(--primary, #d97706))' }}>Grand Total Assets</span>
                        <span className="text-lg font-black text-slate-900">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

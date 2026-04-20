import React, { Fragment } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet } from 'lucide-react';

interface LiquidityAuditTableProps {
    reportData: any;
    globalData: any;
}

export const LiquidityAuditTable: React.FC<LiquidityAuditTableProps> = ({ reportData, globalData }) => {
    return (
        <Card className="border-none shadow-md bg-white overflow-hidden p-0 print:shadow-none print:border print:border-slate-300">
            <CardHeader className="bg-[#5c3e7b] py-4 print:bg-[#5c3e7b] !important">
                <CardTitle className="text-sm font-black uppercase tracking-[0.15em] leading-none flex items-center gap-2 text-white print:text-white">
                    <Wallet size={16} className="text-purple-200" /> Section A: Liquidity & Bank Assets Audit Ledger
                </CardTitle>
                <CardDescription className="text-[10px] text-purple-200/80 uppercase tracking-widest mt-1.5 font-bold italic print:text-purple-300">
                    DAILY AUDIT: OPENING | IN(+) | OUT(-) | CLOSING
                </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto border-x border-b border-slate-200 relative no-scrollbar bg-white print:overflow-visible print:border-none">
                <Table className="border-collapse border-slate-200 print:border-slate-300">
                    <TableHeader className="bg-[#5c3e7b] print:bg-[#5c3e7b] !important">
                        <TableRow className="hover:bg-transparent border-none h-14">
                            <TableHead className="w-[85px] text-center font-bold text-white uppercase tracking-tighter text-[11px] sticky left-0 z-50 bg-[#5c3e7b] border-r border-white/10 shadow-[2px_0_0_0_#5c3e7b]">
                                DATE
                            </TableHead>
                            {['Cash Hand', 'Cash Home', ...globalData.bankAccounts.map((a: any) => a.bankName)].map((name, idx) => (
                                <TableHead key={idx} colSpan={2} className="text-center font-extrabold text-white uppercase tracking-[0.1em] text-[11px] p-0 border-r border-white/10 bg-[#5c3e7b] last:border-r-0">
                                    <div className="py-2 border-b border-white/10 opacity-95">{name}</div>
                                    <div className="flex justify-between px-3 py-1.5 text-[8px] font-black text-purple-100 tracking-[0.2em] bg-[#5c3e7b]/50">
                                        <span>OP / IN (+)</span>
                                        <span className="text-white/30 text-[10px]">|</span>
                                        <span>CL / OUT (-)</span>
                                    </div>
                                </TableHead>
                            ))}
                            <TableHead className="text-right px-6 font-black text-white uppercase tracking-[0.15em] text-[11px] sticky right-0 z-50 bg-[#5c3e7b] border-l border-white/20 shadow-[-2px_0_0_0_#5c3e7b]">
                                <div className="leading-tight">GRAND TOTAL</div>
                                <div className="text-[8px] text-purple-300 mt-1 tracking-widest font-bold">DAILY AUDIT</div>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.dayWiseLiquidity.map((d: any, i: number) => {
                            const isAlternateBlock = i % 2 !== 0;
                            const blockBg = isAlternateBlock ? '#f8f9fa' : '#ffffff';
                            const lightLine = '1px solid #e2e8f0';
                            
                            return (
                                <Fragment key={i}>
                                    <TableRow style={{ backgroundColor: blockBg }} className="h-10 transition-none hover:bg-slate-100/50">
                                        <TableCell rowSpan={2} style={{ backgroundColor: blockBg, borderRight: lightLine }} className="font-bold text-slate-900 py-1 text-[12px] text-center sticky left-0 z-20">
                                            {d.date}
                                        </TableCell>
                                        {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map((id) => {
                                            const m = d.metrics[id] || { opening: 0, closing: 0 };
                                            return (
                                                <Fragment key={`${id}-oc`}>
                                                    <TableCell style={{ backgroundColor: 'transparent', borderRight: 'none' }} className="font-mono text-[11px] text-slate-400 px-3 text-right">
                                                        {Math.round(m.opening).toLocaleString('en-IN')}
                                                    </TableCell>
                                                    <TableCell style={{ backgroundColor: 'transparent', borderRight: lightLine }} className="font-mono text-[11px] text-slate-900 font-bold px-3 text-right">
                                                        {Math.round(m.closing || 0).toLocaleString('en-IN')}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                        <TableCell rowSpan={2} style={{ backgroundColor: blockBg, borderLeft: lightLine }} className="px-4 py-0 font-black text-slate-900 font-mono text-[13px] text-right sticky right-0 z-20">
                                            <div className="text-[12px]">{Math.round(d.totalClosing).toLocaleString('en-IN')}</div>
                                            <div className="text-[9px] text-emerald-600 font-bold font-sans">Net: {(Math.round((d.totalIn || 0) - (d.totalOut || 0))).toLocaleString('en-IN')}</div>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow style={{ backgroundColor: blockBg }} className="h-9 transition-none hover:bg-slate-100/50">
                                        {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map((a: any) => a.id)].map((id) => {
                                            const m = d.metrics[id] || { income: 0, expense: 0 };
                                            return (
                                                <Fragment key={`${id}-ie`}>
                                                    <TableCell style={{ backgroundColor: 'transparent', borderRight: 'none' }} className="font-sans text-[11px] text-emerald-700 font-bold px-3 text-right">
                                                        {m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : '–'}
                                                    </TableCell>
                                                    <TableCell style={{ backgroundColor: 'transparent', borderRight: lightLine }} className="font-sans text-[11px] text-red-700 font-bold px-3 text-right">
                                                        {m.expense > 0 ? '–' + Math.round(m.expense).toLocaleString('en-IN') : '–'}
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
            <div className="bg-[#5c3e7b] text-white p-3 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Final Consolidated Assets</span>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-purple-300 uppercase font-black">Opening Period Sum</span>
                        <span className="text-sm font-bold text-purple-100">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="h-8 w-[1px] bg-purple-400/30 mx-2" />
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] text-purple-200 uppercase font-black tracking-widest">Grand Total Value</span>
                        <span className="text-2xl font-black text-white">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};

import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';
import { formatCurrency } from "@/lib/utils";

interface ParallelAuditLedgerProps {
    reportData: any;
}

export const ParallelAuditLedger: React.FC<ParallelAuditLedgerProps> = ({ reportData }) => {
    const pZone = reportData.audit360Zones.find((z: any) => z.key === 'PURCHASE');
    const pRows = pZone?.rows || [];
    const sZone = reportData.audit360Zones.find((z: any) => z.key === 'SALE');
    const adjZone = reportData.audit360Zones.find((z: any) => z.key === 'ADJUSTMENT');
    const expZone = reportData.audit360Zones.find((z: any) => z.key === 'EXPENSE');
    const incZone = reportData.audit360Zones.find((z: any) => z.key === 'INCOME');
    
    const totals = {
        labour: pRows.reduce((s: number, r: any) => s + (r.laboury || 0), 0),
        kanta: pRows.reduce((s: number, r: any) => s + (r.kanta || 0), 0),
        karta: pRows.reduce((s: number, r: any) => s + (r.kartaAmt || 0), 0),
        expenses: expZone?.total || 0,
        incomes: incZone?.total || 0
    };

    const StatBox = ({ label, val, sub, border, bg }: any) => (
        <div className={`relative overflow-hidden ${bg} border-2 ${border} p-3 rounded-2xl shadow-sm transition-all hover:shadow-md group`}>
            <div className="absolute top-0 right-0 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
                <Activity size={40} />
            </div>
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-black text-slate-900 tracking-tight">{val}</p>
            {sub && <p className="text-[7px] font-bold text-slate-500 mt-1 uppercase leading-none">{sub}</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatBox label="Purchase Volume" val={`${(pZone?.stats?.qty || 0).toFixed(2)} QTL`} sub={`${pZone?.stats?.parchi} Active Parchis`} border="border-amber-100" bg="bg-amber-50/30" />
                <StatBox label="Sales Volume" val={`${(sZone?.stats?.qty || 0).toFixed(2)} QTL`} sub="Market Distribution" border="border-emerald-100" bg="bg-emerald-50/30" />
                <StatBox label="Net Adjustments" val={formatCurrency((reportData.audit360Zones.find((z: any) => z.key === 'ADJ_INCOME')?.total || 0) - (reportData.audit360Zones.find((z: any) => z.key === 'ADJ_EXPENSE')?.total || 0))} sub="Income - Expense" border="border-rose-100" bg="bg-rose-50/30" />
                <StatBox label="Operating Expense" val={formatCurrency(totals.expenses)} sub="Business Overhead" border="border-slate-200" bg="bg-slate-50" />
                <StatBox label="Other Income" val={formatCurrency(totals.incomes)} sub="Indirect Revenue" border="border-indigo-100" bg="bg-indigo-50/30" />
                <StatBox label="Operational Ops" val={`L:${Math.round(totals.labour/1000)}k | K:${Math.round(totals.kanta/1000)}k`} sub={`KARTA: ₹${Math.round(totals.karta).toLocaleString()}`} border="border-cyan-100" bg="bg-cyan-50/30" />
            </div>

            <Card className="shadow-none border border-slate-200 bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 border-b py-3 flex flex-row items-center justify-between text-white">
                    <div className="flex flex-col">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em]">Section Z: 360° Parallel Audit Ledger</CardTitle>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Purchase Consolidated Ledger (Independent Parallel Flows)</p>
                    </div>
                </CardHeader>
                
                <div className="overflow-auto border-x bg-white scrollbar-thin scrollbar-thumb-slate-200" style={{ maxHeight: '800px' }}>
                    <Table className="relative w-full border-collapse" style={{ minWidth: '2800px' }}>
                        <TableHeader className="sticky top-0 z-30">
                            <TableRow className="bg-slate-900 text-white border-none h-11">
                                <TableHead colSpan={3} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-amber-600/5 text-amber-500">I. Purchase Ledger</TableHead>
                                <TableHead colSpan={3} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-emerald-600/5 text-emerald-500">II. Sales Pipeline</TableHead>
                                <TableHead colSpan={6} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-slate-800/20 text-slate-300">III. Adjustments</TableHead>
                                <TableHead colSpan={3} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-slate-800/10 text-slate-400">IV. Op Expenses</TableHead>
                                <TableHead colSpan={3} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-indigo-600/5 text-indigo-400">V. Other Incomes</TableHead>
                                <TableHead colSpan={3} className="text-center text-[10px] font-black uppercase bg-cyan-600/5 text-cyan-500">VI. Liquidity Flow</TableHead>
                            </TableRow>
                            <TableRow className="bg-slate-50 border-b border-slate-200">
                                <TableHead className="w-[60px] text-[9px] font-bold border-r px-2 text-center bg-amber-50/10">DATE</TableHead>
                                <TableHead className="w-[12%] text-[9px] font-bold border-r px-3 bg-amber-50/10">PARTICULAR</TableHead>
                                <TableHead className="w-20 text-right px-4 bg-amber-50/30">AMT</TableHead>

                                <TableHead className="w-[60px] text-[9px] font-bold border-r px-2 text-center bg-emerald-50/10">DATE</TableHead>
                                <TableHead className="w-[12%] text-[9px] font-bold border-r px-3 bg-emerald-50/10">PARTICULAR</TableHead>
                                <TableHead className="w-20 text-right px-4 bg-emerald-50/30">AMT</TableHead>

                                <TableHead className="w-[45px] text-[9px] font-bold border-r px-2 text-center text-emerald-800 bg-emerald-50/10">DATE</TableHead>
                                <TableHead className="w-[9%] text-[9px] font-bold border-r px-3 text-emerald-800 bg-emerald-50/10">INCOME</TableHead>
                                <TableHead className="w-16 text-right px-3 bg-emerald-50/30 text-emerald-800">AMT</TableHead>
                                <TableHead className="w-[45px] text-[9px] font-bold border-r px-2 text-center text-rose-800 bg-rose-50/10">DATE</TableHead>
                                <TableHead className="w-[9%] text-[9px] font-bold border-r px-3 text-rose-800 bg-rose-50/10">EXPENSE</TableHead>
                                <TableHead className="w-16 text-right px-3 bg-rose-50/30 text-rose-800">AMT</TableHead>

                                <TableHead className="w-[60px] text-[9px] font-bold border-r px-2 text-center bg-slate-100/30 text-slate-800">DATE</TableHead>
                                <TableHead className="w-[12%] text-[9px] font-bold border-r px-3 bg-slate-100/30 text-slate-800">PARTICULAR</TableHead>
                                <TableHead className="w-20 text-right px-4 bg-slate-100/40 text-slate-800">AMT</TableHead>

                                <TableHead className="w-[60px] text-[9px] font-bold border-r px-2 text-center bg-indigo-50/10 text-indigo-900">DATE</TableHead>
                                <TableHead className="w-[12%] text-[9px] font-bold border-r px-3 bg-indigo-50/10 text-indigo-900">PARTICULAR</TableHead>
                                <TableHead className="w-20 text-right px-4 bg-indigo-50/30 text-indigo-900">AMT</TableHead>

                                <TableHead className="w-[60px] text-[9px] font-bold border-r px-2 text-center bg-cyan-50/10 text-cyan-900">DATE</TableHead>
                                <TableHead className="w-[12%] text-[9px] font-bold border-r px-3 bg-cyan-50/10 text-cyan-900">TRANSACTION</TableHead>
                                <TableHead className="w-20 text-right px-4 bg-cyan-50/30 border-r-0 text-cyan-900">VAL</TableHead>
                            </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                            {(() => {
                                const pRows = reportData.audit360Zones.find((z: any) => z.key === 'PURCHASE')?.rows || [];
                                const sRows = reportData.audit360Zones.find((z: any) => z.key === 'SALE')?.rows || [];
                                const aIncRows = reportData.audit360Zones.find((z: any) => z.key === 'ADJ_INCOME')?.rows || [];
                                const aExpRows = reportData.audit360Zones.find((z: any) => z.key === 'ADJ_EXPENSE')?.rows || [];
                                const eRows = reportData.audit360Zones.find((z: any) => z.key === 'EXPENSE')?.rows || [];
                                const iRows = reportData.audit360Zones.find((z: any) => z.key === 'INCOME')?.rows || [];
                                const cRows = reportData.audit360Zones.find((z: any) => z.key === 'INTERNAL')?.rows || [];

                                // Aggregate Op Expenses and Incomes for the main matrix
                                const geRows = Array.from(eRows.reduce((acc: Map<string, any>, r: any) => {
                                    const dStr = format(new Date(r.date), 'yyyy-MM-dd');
                                    const method = r.paymentMethod || 'Cash';
                                    // If paymentMethod is a large numeric value (e.g. UTR no. stored incorrectly), group as OTHER
                                    const isNumericId = /^\d{10,}$/.test(method);
                                    const groupKey = isNumericId ? 'OTHER' : method;
                                    const key = `${dStr}_${groupKey}`;
                                    const label = isNumericId ? 'TOTAL OTHER EXP' : `TOTAL ${method.toUpperCase()} EXP`;
                                    if (!acc.has(key)) acc.set(key, { ...r, paymentMethod: isNumericId ? 'Other' : method, item: label, amount: 0 });
                                    acc.get(key).amount += r.amount;
                                    return acc;
                                }, new Map<string, any>()).values());

                                const giRows = Array.from(iRows.reduce((acc: Map<string, any>, r: any) => {
                                    const dStr = format(new Date(r.date), 'yyyy-MM-dd');
                                    const key = `${dStr}_${r.paymentMethod || 'Cash'}`;
                                    if (!acc.has(key)) acc.set(key, { ...r, item: `TOTAL ${(r.paymentMethod || 'Cash').toUpperCase()} INC`, amount: 0 });
                                    acc.get(key).amount += r.amount;
                                    return acc;
                                }, new Map<string, any>()).values());

                                const maxRows = Math.max(pRows.length, sRows.length, aIncRows.length, aExpRows.length, geRows.length, giRows.length, cRows.length);
                                
                                if (maxRows === 0) {
                                    return <TableRow><TableCell colSpan={21} className="h-40 text-center italic text-slate-400">No parallel data distributed.</TableCell></TableRow>;
                                }

                                const rows = Array.from({ length: maxRows }).map((_, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/60 border-b border-slate-100 group transition-all duration-200">
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-amber-500/20 text-center align-top w-[60px]">
                                            {pRows[idx] ? (
                                                <span className="text-[9px] font-black text-amber-700 bg-amber-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(pRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="border-r py-1.5 px-3">
                                            {pRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <div className="flex flex-col overflow-hidden leading-tight">
                                                            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                                                                <span className="text-[11px] font-bold text-slate-900">[{pRows[idx].srNo || '0'}]</span>
                                                                <span className="text-[11px] font-semibold text-slate-800 truncate max-w-[120px]">{pRows[idx].name}</span>
                                                                <span className="text-[8px] font-black text-slate-600 px-0.5">S/O</span>
                                                                <span className="text-[11px] font-semibold text-slate-800 truncate max-w-[120px]">{pRows[idx].fatherName || '---'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden mt-0.5">
                                                                <span className="text-[10px] font-bold text-slate-700 uppercase truncate max-w-[120px]">
                                                                    {pRows[idx].address}
                                                                </span>
                                                                <div className="h-2 w-[1px] bg-slate-400" />
                                                                <span className="text-[10px] font-black text-blue-700">₹{pRows[idx].rate}/q</span>
                                                                <div className="h-1 w-1 rounded-full bg-slate-400" />
                                                                <span className="text-[8.5px] font-black text-slate-700">{pRows[idx].details.split('|')[0].trim()}</span>
                                                                <div className="h-1 w-1 rounded-full bg-slate-200" />
                                                                <span className="text-[8.5px] font-bold text-purple-600">L:{pRows[idx].laboury}</span>
                                                                <span className="text-[8.5px] font-bold text-rose-600">K:{pRows[idx].kanta}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="bg-amber-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter">
                                            {pRows[idx] ? Math.round(pRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* II. SALES - DATE */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-emerald-500/20 text-center align-top w-[60px]">
                                            {sRows[idx] ? (
                                                <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(sRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        {/* II. SALES - PARTICULAR + AMT */}
                                        <TableCell className="border-r py-1.5 px-3">
                                            {sRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[10px] font-black text-slate-800 uppercase truncate shrink">{sRows[idx].item}</span>
                                                    <span className="text-[7.5px] text-slate-400 font-bold uppercase truncate shrink-0">{sRows[idx].details}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-emerald-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-emerald-950">
                                            {sRows[idx] ? Math.round(sRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* III. ADJ INCOME - DATE */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-emerald-500/30 text-center align-top w-[45px] bg-emerald-50/5">
                                            {aIncRows[idx] ? (
                                                <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(aIncRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-emerald-100">-</div>}
                                        </TableCell>
                                        {/* III. ADJ INCOME - PARTICULAR + AMT */}
                                        <TableCell className="border-r py-1.5 px-3 bg-emerald-50/5">
                                            {aIncRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[9px] font-black text-emerald-900 uppercase truncate shrink">{aIncRows[idx].item}</span>
                                                    <span className="text-[7.5px] text-emerald-600/70 font-medium truncate shrink-0">{aIncRows[idx].details}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-emerald-50/20 text-right px-3 text-[11px] font-black border-r border-emerald-200/50 font-mono tracking-tighter text-emerald-900">
                                            {aIncRows[idx] ? Math.round(aIncRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* III. ADJ EXPENSE - DATE */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-rose-500/30 text-center align-top w-[45px] bg-rose-50/5">
                                            {aExpRows[idx] ? (
                                                <span className="text-[9px] font-black text-rose-700 bg-rose-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(aExpRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-rose-100">-</div>}
                                        </TableCell>
                                        {/* III. ADJ EXPENSE - PARTICULAR + AMT */}
                                        <TableCell className="border-r py-1.5 px-3 bg-rose-50/5">
                                            {aExpRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[9px] font-black text-rose-900 uppercase truncate shrink">{aExpRows[idx].item}</span>
                                                    <span className="text-[7.5px] text-rose-600/70 font-medium truncate shrink-0">{aExpRows[idx].details}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-rose-50/20 text-right px-3 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-rose-950">
                                            {aExpRows[idx] ? Math.round(aExpRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* IV. OP EXPENSES - DATE (AGGREGATED) */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-slate-400/20 text-center align-top w-[60px]">
                                            {geRows[idx] ? (
                                                <span className="text-[9px] font-black text-slate-700 bg-slate-100/80 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(geRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="border-r py-1.5 px-3">
                                            {geRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[7.5px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded font-mono shrink-0 uppercase">
                                                        {geRows[idx].paymentMethod}
                                                    </span>
                                                    <span className="text-[9px] font-black text-slate-700 uppercase truncate shrink">{geRows[idx].item}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-slate-50 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-slate-600">
                                            {geRows[idx] ? Math.round(geRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* V. OTHER INCOMES - DATE (AGGREGATED) */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-indigo-500/20 text-center align-top w-[60px]">
                                            {giRows[idx] ? (
                                                <span className="text-[9px] font-black text-indigo-700 bg-indigo-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(giRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="border-r py-1.5 px-3">
                                            {giRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[7.5px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded font-mono shrink-0 uppercase">
                                                        {giRows[idx].paymentMethod}
                                                    </span>
                                                    <span className="text-[9px] font-black text-indigo-900 uppercase truncate shrink">{giRows[idx].item}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-indigo-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-indigo-900">
                                            {giRows[idx] ? Math.round(giRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* VI. LIQUIDITY FLOW - DATE */}
                                        <TableCell className="border-r py-1.5 px-2 border-l-4 border-l-cyan-500/20 text-center align-top w-[60px]">
                                            {cRows[idx] ? (
                                                <span className="text-[9px] font-black text-cyan-700 bg-cyan-100/50 px-1 py-0.5 rounded-sm block mx-auto w-max mt-0.5">
                                                    {format(new Date(cRows[idx].date), 'dd/MM')}
                                                </span>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="border-r py-1.5 px-3">
                                            {cRows[idx] ? (
                                                <div className="flex items-center gap-1 min-w-0">
                                                    <span className="text-[8.5px] font-black text-cyan-900 uppercase truncate shrink">{cRows[idx].item}</span>
                                                    <span className="text-[7.5px] text-cyan-300 font-black lowercase shrink-0">{cRows[idx].details}</span>
                                                </div>
                                            ) : ''}
                                        </TableCell>
                                        <TableCell className="bg-cyan-50/10 text-right px-4 text-[11px] font-black font-mono tracking-tighter text-cyan-950">
                                            {cRows[idx] ? Math.round(cRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>
                                    </TableRow>
                                ));

                                const pTot = reportData.audit360Zones.find((z: any) => z.key === 'PURCHASE')?.total || 0;
                                const sTot = reportData.audit360Zones.find((z: any) => z.key === 'SALE')?.total || 0;
                                const aiTot = reportData.audit360Zones.find((z: any) => z.key === 'ADJ_INCOME')?.total || 0;
                                const aeTot = reportData.audit360Zones.find((z: any) => z.key === 'ADJ_EXPENSE')?.total || 0;
                                const eTot = reportData.audit360Zones.find((z: any) => z.key === 'EXPENSE')?.total || 0;
                                const iTot = reportData.audit360Zones.find((z: any) => z.key === 'INCOME')?.total || 0;
                                const cTot = reportData.audit360Zones.find((z: any) => z.key === 'INTERNAL')?.total || 0;

                                rows.push(
                                    <TableRow key="global-totals" className="bg-slate-100/80 hover:bg-slate-200/60 border-t-[3px] border-t-slate-300 font-black sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 tracking-widest border-r">PURCHASE TOTAL</TableCell>
                                        <TableCell className="bg-amber-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-amber-950 font-mono tracking-tighter">
                                            {Math.round(pTot).toLocaleString()}
                                        </TableCell>

                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 border-r">SALES TOTAL</TableCell>
                                        <TableCell className="bg-emerald-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-emerald-950 font-mono tracking-tighter">
                                            {Math.round(sTot).toLocaleString()}
                                        </TableCell>

                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-emerald-700/60 border-r">NET IN</TableCell>
                                        <TableCell className="bg-emerald-100/40 text-right px-4 text-[13px] border-r border-slate-300 text-emerald-900 font-mono tracking-tighter">
                                            {Math.round(aiTot).toLocaleString()}
                                        </TableCell>
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-rose-700/50 border-r">NET EXP</TableCell>
                                        <TableCell className="bg-rose-100/40 text-right px-4 text-[13px] border-r border-slate-300 text-rose-950 font-mono tracking-tighter">
                                            {Math.round(aeTot).toLocaleString()}
                                        </TableCell>

                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 border-r">OP EXP TOTAL</TableCell>
                                        <TableCell className="bg-slate-200/60 text-right px-4 text-[13px] border-r border-slate-300 text-slate-800 font-mono tracking-tighter">
                                            {Math.round(eTot).toLocaleString()}
                                        </TableCell>

                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 border-r">INCOME TOTAL</TableCell>
                                        <TableCell className="bg-indigo-100/40 text-right px-4 text-[13px] border-r border-slate-300 text-indigo-950 font-mono tracking-tighter">
                                            {Math.round(iTot).toLocaleString()}
                                        </TableCell>

                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-slate-500 border-r">FLOW TOTAL</TableCell>
                                        <TableCell className="bg-cyan-100/30 text-right px-4 text-[13px] text-cyan-950 font-mono tracking-tighter">
                                            {Math.round(cTot).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                );

                                return rows;
                            })()}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* ── EXPENSE BREAKDOWN TABLE ── */}
            {(() => {
                const allExpRows: any[] = reportData.audit360Zones.find((z: any) => z.key === 'EXPENSE')?.rows || [];

                const sortById = (a: any, b: any) =>
                    String(a.transactionId || '').localeCompare(String(b.transactionId || ''), undefined, { numeric: true, sensitivity: 'base' });

                const isNumericMethod = (m: string) => /^\d{10,}$/.test(m || '');
                const cashRows   = allExpRows.filter((r: any) => (r.paymentMethod === 'Cash' || !r.paymentMethod) && !isNumericMethod(r.paymentMethod)).sort(sortById);
                const rtgsRows   = allExpRows.filter((r: any) => r.paymentMethod === 'RTGS').sort(sortById);
                const govRows    = allExpRows.filter((r: any) => r.paymentMethod === 'Cheque').sort(sortById);
                const onlineRows = allExpRows.filter((r: any) => r.paymentMethod === 'Online').sort(sortById);
                const otherRows  = allExpRows.filter((r: any) => r.paymentMethod === 'Other' || isNumericMethod(r.paymentMethod)).sort(sortById);

                const cashTot   = cashRows.reduce((s: number, r: any) => s + r.amount, 0);
                const rtgsTot   = rtgsRows.reduce((s: number, r: any) => s + r.amount, 0);
                const govTot    = govRows.reduce((s: number, r: any)  => s + r.amount, 0);
                const onlineTot = onlineRows.reduce((s: number, r: any) => s + r.amount, 0);
                const otherTot  = otherRows.reduce((s: number, r: any) => s + r.amount, 0);

                const maxR = Math.max(cashRows.length, rtgsRows.length, govRows.length, onlineRows.length, otherRows.length, 1);

                const ColHeader = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
                    <TableHead colSpan={3} className={`text-center text-[10px] font-black uppercase border-r border-slate-800 ${bg} ${color}`}>{label}</TableHead>
                );
                const SubHeader = ({ dateColor, partColor, amtBg }: { dateColor: string; partColor: string; amtBg: string }) => (
                    <>
                        <TableHead className={`w-[55px] text-[9px] font-bold border-r px-2 text-center ${dateColor}`}>DATE</TableHead>
                        <TableHead className={`w-[22%] text-[9px] font-bold border-r px-3 ${partColor}`}>PARTICULAR</TableHead>
                        <TableHead className={`w-20 text-right px-4 border-r ${amtBg}`}>AMT</TableHead>
                    </>
                );

                const renderCell = (row: any, dateBg: string, dateTxt: string, nameTxt: string, catTxt: string, numTxt: string, numBg: string) => {
                    return row ? (
                        <>
                            <TableCell className={`border-r py-1.5 px-2 text-center align-middle w-[55px] ${dateBg}`}>
                                <span className={`text-[9px] font-black ${dateTxt} px-1 py-0.5 rounded-sm block mx-auto w-max`}>
                                    {format(new Date(row.date), 'dd/MM')}
                                </span>
                            </TableCell>
                            <TableCell className="border-r py-1.5 px-3">
                                <div className="flex items-center gap-1 min-w-0">
                                    {row.transactionId && (
                                        <span className="text-[8.5px] font-black text-slate-700 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0 tracking-tight">
                                            {row.transactionId}
                                        </span>
                                    )}
                                    {row.details && row.tag !== 'SUP_PAY' && (
                                        <span className="text-[7px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                                            {row.details}
                                        </span>
                                    )}
                                    {row.tag === 'SUP_PAY' && (
                                        <span className="text-[6.5px] font-black bg-amber-400 text-amber-950 px-1 py-0.5 rounded tracking-wider uppercase shrink-0">SUP</span>
                                    )}
                                    <span className={`text-[9px] font-black ${nameTxt} uppercase truncate shrink`}>{row.item}</span>
                                    {row.paymentMethod === 'RTGS' && row.tag === 'SUP_PAY' && (
                                        <div className="flex items-center gap-1.5 ml-1 border-l border-slate-200 pl-1.5 overflow-hidden">
                                            {row.details && (
                                                <span className="text-[7.5px] font-bold text-indigo-600 truncate max-w-[80px]">{row.details}</span>
                                            )}
                                            {row.receiptNo && row.receiptNo !== '—' && (
                                                <span className="text-[7.5px] font-bold text-slate-500 whitespace-nowrap">{row.receiptNo}</span>
                                            )}
                                            {row.checkNo && row.checkNo !== '—' && (
                                                <span className="text-[7.5px] font-bold text-blue-600 whitespace-nowrap">CHQ:{row.checkNo}</span>
                                            )}
                                            {row.receiptName && row.receiptName !== '—' && (
                                                <span className="text-[7.5px] font-medium text-slate-400 italic truncate max-w-[120px]">({row.receiptName})</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className={`${numBg} text-right px-4 text-[11px] font-black border-r font-mono tracking-tighter ${numTxt}`}>
                                {Math.round(row.amount).toLocaleString()}
                            </TableCell>
                        </>
                    ) : (
                        <>
                            <TableCell className={`border-r py-1.5 px-2 text-center ${dateBg} text-slate-200`}>-</TableCell>
                            <TableCell className="border-r py-1.5 px-3" />
                            <TableCell className={`border-r py-1.5 px-4 ${numBg}`} />
                        </>
                    );
                };

                return (
                    <Card className="shadow-none border border-slate-200 bg-white overflow-hidden">
                        <CardHeader className="bg-slate-900 border-b py-3 flex flex-row items-center justify-between text-white">
                            <div className="flex flex-col">
                                <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em]">Section Z-II: Expense Breakdown Ledger</CardTitle>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Parallel Expense Distribution — Cash · RTGS · Gov · Online · Other</p>
                            </div>
                            <div className="flex gap-4 text-right">
                                {[
                                    { label: 'Cash', val: cashTot, color: 'text-orange-400' },
                                    { label: 'RTGS', val: rtgsTot, color: 'text-blue-400' },
                                    { label: 'Gov', val: govTot, color: 'text-purple-400' },
                                    { label: 'Online', val: onlineTot, color: 'text-cyan-400' },
                                    { label: 'Other', val: otherTot, color: 'text-rose-400' },
                                ].map(({ label, val, color }) => (
                                    <div key={label} className="flex flex-col items-end">
                                        <span className="text-[7px] font-bold text-slate-500 uppercase">{label}</span>
                                        <span className={`text-[11px] font-black ${color} font-mono`}>₹{Math.round(val).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </CardHeader>

                        <div className="overflow-auto border-x bg-white scrollbar-thin scrollbar-thumb-slate-200" style={{ maxHeight: '600px' }}>
                            <Table className="relative w-full border-collapse" style={{ minWidth: '2200px' }}>
                                <TableHeader className="sticky top-0 z-30">
                                    <TableRow className="bg-slate-900 text-white border-none h-11">
                                        <ColHeader label="💵 Cash Expense"  color="text-orange-400" bg="bg-orange-600/5" />
                                        <ColHeader label="🏦 RTGS"           color="text-blue-400"   bg="bg-blue-600/5" />
                                        <ColHeader label="🏛️ Gov / Cheque"   color="text-purple-400" bg="bg-purple-600/5" />
                                        <ColHeader label="📱 Online"         color="text-cyan-400"   bg="bg-cyan-600/5" />
                                        <ColHeader label="🔀 Other"          color="text-rose-400"   bg="bg-rose-600/5" />
                                    </TableRow>
                                    <TableRow className="bg-slate-50 border-b border-slate-200">
                                        <SubHeader dateColor="bg-orange-50/30 text-orange-800" partColor="bg-orange-50/10 text-orange-700" amtBg="bg-orange-50/30" />
                                        <SubHeader dateColor="bg-blue-50/30 text-blue-800"     partColor="bg-blue-50/10 text-blue-700"     amtBg="bg-blue-50/30" />
                                        <SubHeader dateColor="bg-purple-50/30 text-purple-800" partColor="bg-purple-50/10 text-purple-700" amtBg="bg-purple-50/30" />
                                        <SubHeader dateColor="bg-cyan-50/30 text-cyan-800"     partColor="bg-cyan-50/10 text-cyan-700"     amtBg="bg-cyan-50/30" />
                                        <SubHeader dateColor="bg-rose-50/30 text-rose-800"    partColor="bg-rose-50/10 text-rose-700"    amtBg="bg-rose-50/30" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from({ length: maxR }).map((_, idx) => (
                                        <TableRow key={idx} className="hover:bg-slate-50/60 border-b border-slate-100 transition-all duration-150">
                                            {renderCell(cashRows[idx],   'bg-orange-50/10', 'text-orange-700 bg-orange-100/60', 'text-orange-900', 'text-orange-500/70', 'text-orange-950', 'bg-orange-50/20')}
                                            {renderCell(rtgsRows[idx],   'bg-blue-50/10',   'text-blue-700 bg-blue-100/60',     'text-blue-900',   'text-blue-500/70',   'text-blue-950',   'bg-blue-50/20')}
                                            {renderCell(govRows[idx],    'bg-purple-50/10', 'text-purple-700 bg-purple-100/60', 'text-purple-900', 'text-purple-500/70', 'text-purple-950', 'bg-purple-50/20')}
                                            {renderCell(onlineRows[idx], 'bg-cyan-50/10',   'text-cyan-700 bg-cyan-100/60',     'text-cyan-900',   'text-cyan-500/70',   'text-cyan-950',   'bg-cyan-50/20')}
                                            {renderCell(otherRows[idx],  'bg-rose-50/10',   'text-rose-700 bg-rose-100/60',     'text-rose-900',   'text-rose-500/70',   'text-rose-950',   'bg-rose-50/20')}
                                        </TableRow>
                                    ))}
                                    {/* Totals Row */}
                                    <TableRow className="bg-slate-100/80 border-t-[3px] border-t-slate-300 font-black sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-orange-700/70 tracking-widest border-r">Cash Total</TableCell>
                                        <TableCell className="bg-orange-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-orange-950 font-mono tracking-tighter">{Math.round(cashTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-blue-700/70 tracking-widest border-r">RTGS Total</TableCell>
                                        <TableCell className="bg-blue-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-blue-950 font-mono tracking-tighter">{Math.round(rtgsTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-purple-700/70 tracking-widest border-r">Gov Total</TableCell>
                                        <TableCell className="bg-purple-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-purple-950 font-mono tracking-tighter">{Math.round(govTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-cyan-700/70 tracking-widest border-r">Online Total</TableCell>
                                        <TableCell className="bg-cyan-100/50 text-right px-4 text-[13px] border-r border-slate-300 text-cyan-950 font-mono tracking-tighter">{Math.round(onlineTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-2 px-3 text-[10px] uppercase text-rose-700/70 tracking-widest border-r">Other Total</TableCell>
                                        <TableCell className="bg-rose-100/50 text-right px-4 text-[13px] text-rose-950 font-mono tracking-tighter">{Math.round(otherTot).toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                );
            })()}
        </div>
    );
};

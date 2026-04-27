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
    const lZone = reportData.audit360Zones.find((z: any) => z.key === 'LOAN');
    
    const totals = {
        labour: pRows.reduce((s: number, r: any) => s + (r.laboury || 0), 0),
        kanta: pRows.reduce((s: number, r: any) => s + (r.kanta || 0), 0),
        karta: pRows.reduce((s: number, r: any) => s + (r.kartaAmt || 0), 0),
        brokerage: pRows.reduce((s: number, r: any) => s + (r.brokerage || 0), 0),
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
            {/* ── SECTION Z-II: EXPENSE BREAKDOWN LEDGER ── */}
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
                    <TableHead colSpan={3} className={`text-center text-[13px] font-black uppercase border-r border-slate-800 ${bg} ${color}`}>{label}</TableHead>
                );
                const SubHeader = ({ dateColor, partColor, amtBg }: { dateColor: string; partColor: string; amtBg: string }) => (
                    <>
                        <TableHead className={`w-[65px] text-[11px] font-bold border-r px-2 text-center ${dateColor}`}>DATE</TableHead>
                        <TableHead className={`w-[22%] text-[11px] font-bold border-r px-3 ${partColor}`}>PARTICULAR</TableHead>
                        <TableHead className={`w-24 text-right text-[11px] font-bold px-4 border-r ${amtBg}`}>AMT</TableHead>
                    </>
                );

                const renderCell = (row: any, dateBg: string, dateTxt: string, nameTxt: string, catTxt: string, numTxt: string, numBg: string) => {
                    return row ? (
                        <>
                            <TableCell className={`border-r py-2 px-2 text-center align-middle w-[65px] ${dateBg}`}>
                                <span className={`text-[11px] font-black ${dateTxt} px-1.5 py-0.5 rounded-sm block mx-auto w-max`}>
                                    {format(new Date(row.date), 'dd/MM')}
                                </span>
                            </TableCell>
                            <TableCell className="border-r py-2 px-3 align-middle">
                                {/* Single line: badges + item name inline, truncated */}
                                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                    {row.transactionId && (
                                        <span className="text-[10px] font-black text-slate-700 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded font-mono shrink-0 tracking-tight">
                                            {row.transactionId}
                                        </span>
                                    )}
                                    {row.tag === 'SUP_PAY' && (
                                        <span className="text-[9px] font-black bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded tracking-wider uppercase shrink-0">SUP</span>
                                    )}
                                    {row.details && row.tag !== 'SUP_PAY' && (
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded uppercase shrink-0">
                                            {row.details}
                                        </span>
                                    )}
                                    <span className={`text-[11px] font-black ${nameTxt} uppercase truncate`} title={row.item}>
                                        {row.item}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className={`${numBg} text-right px-4 text-[13px] font-black border-r font-mono tracking-tighter ${numTxt}`}>
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
                                <CardTitle className="text-[13px] font-black uppercase tracking-[0.2em]">Section Z-II: Expense Breakdown Ledger</CardTitle>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Parallel Expense Distribution — Cash · RTGS · Gov · Online · Other</p>
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
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>
                                        <span className={`text-[13px] font-black ${color} font-mono`}>₹{Math.round(val).toLocaleString()}</span>
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
                                        <TableCell colSpan={2} className="text-right py-3 px-3 text-[11px] uppercase text-orange-700/70 tracking-widest border-r">Cash Total</TableCell>
                                        <TableCell className="bg-orange-100/50 text-right px-4 text-[14px] border-r border-slate-300 text-orange-950 font-mono tracking-tighter">{Math.round(cashTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-3 px-3 text-[11px] uppercase text-blue-700/70 tracking-widest border-r">RTGS Total</TableCell>
                                        <TableCell className="bg-blue-100/50 text-right px-4 text-[14px] border-r border-slate-300 text-blue-950 font-mono tracking-tighter">{Math.round(rtgsTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-3 px-3 text-[11px] uppercase text-purple-700/70 tracking-widest border-r">Gov Total</TableCell>
                                        <TableCell className="bg-purple-100/50 text-right px-4 text-[14px] border-r border-slate-300 text-purple-950 font-mono tracking-tighter">{Math.round(govTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-3 px-3 text-[11px] uppercase text-cyan-700/70 tracking-widest border-r">Online Total</TableCell>
                                        <TableCell className="bg-cyan-100/50 text-right px-4 text-[14px] border-r border-slate-300 text-cyan-950 font-mono tracking-tighter">{Math.round(onlineTot).toLocaleString()}</TableCell>
                                        <TableCell colSpan={2} className="text-right py-3 px-3 text-[11px] uppercase text-rose-700/70 tracking-widest border-r">Other Total</TableCell>
                                        <TableCell className="bg-rose-100/50 text-right px-4 text-[14px] text-rose-950 font-mono tracking-tighter">{Math.round(otherTot).toLocaleString()}</TableCell>
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

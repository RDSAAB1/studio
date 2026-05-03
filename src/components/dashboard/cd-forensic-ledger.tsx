"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { formatCurrency, cn, toTitleCase } from "@/lib/utils";
import { ArrowLeft, Download, Printer, HandCoins, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { printHtmlContent } from "@/lib/electron-print";

interface CDLedgerProps {
    supplierPayments: any[];
    customerPayments: any[];
    onBack: () => void;
}

type ViewMode = 'DETAILED' | 'DATE_WISE';

export const CDForensicLedger: React.FC<CDLedgerProps> = ({ 
    supplierPayments, 
    customerPayments, 
    onBack 
}) => {
    const [viewMode, setViewMode] = React.useState<ViewMode>('DETAILED');

    // 1. Calculate Ledger Data with Running Balance
    const { detailedData, dateWiseData } = useMemo(() => {
        const received = (supplierPayments || [])
            .filter(p => !p.isDeleted && (Number(p.cdAmount) || 0) > 0)
            .map(p => ({
                date: p.date,
                particulars: `CD Received from ${toTitleCase(p.supplierName || 'Supplier')}`,
                id: p.paymentId ? `CD-${p.paymentId}` : 'CD-S',
                debit: 0,
                credit: Number(p.cdAmount) || 0,
                type: 'Income (Received)'
            }));

        const given = (customerPayments || [])
            .filter(p => !p.isDeleted && (Number(p.cdAmount) || 0) > 0)
            .map(p => ({
                date: p.date,
                particulars: `CD Given to ${toTitleCase(p.customerName || 'Customer')}`,
                id: p.paymentId ? `CD-${p.paymentId}` : 'CD-C',
                debit: Number(p.cdAmount) || 0,
                credit: 0,
                type: 'Expense (Given)'
            }));

        // Sort ascending to calculate running balance correctly (Stable sort: Date then ID)
        const sortedAsc = [...received, ...given].sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return a.id.localeCompare(b.id);
        });
        
        let runningBalance = 0;
        const withBalance = sortedAsc.map(t => {
            runningBalance += (t.credit - t.debit);
            return { ...t, balance: runningBalance };
        });

        // Date-wise Grouping
        const groups: Record<string, { date: string, debit: number, credit: number, balance: number }> = {};
        sortedAsc.forEach(t => {
            const dayKey = format(new Date(t.date), 'yyyy-MM-dd');
            if (!groups[dayKey]) {
                groups[dayKey] = { date: dayKey, debit: 0, credit: 0, balance: 0 };
            }
            groups[dayKey].debit += t.debit;
            groups[dayKey].credit += t.credit;
        });

        let dwRunningBalance = 0;
        const dwWithBalance = Object.keys(groups).sort().map(dayKey => {
            const g = groups[dayKey];
            dwRunningBalance += (g.credit - g.debit);
            return { 
                ...g, 
                particulars: `Consolidated CD for ${format(new Date(g.date), 'dd MMM yyyy')}`,
                id: 'DAILY',
                type: 'Date-wise Summary',
                balance: dwRunningBalance 
            };
        });

        return { 
            detailedData: [...withBalance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id)),
            dateWiseData: [...dwWithBalance].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        };
    }, [supplierPayments, customerPayments]);



    const activeData = viewMode === 'DETAILED' ? detailedData : dateWiseData;

    const totals = useMemo(() => {
        const r = detailedData.reduce((s, t) => s + t.credit, 0);
        const g = detailedData.reduce((s, t) => s + t.debit, 0);
        return { received: r, given: g, net: r - g };
    }, [detailedData]);

    const handlePrint = async () => {
        const html = `
            <html>
                <head>
                    <style>
                        @page { size: A4; margin: 10mm; }
                        body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #000; }
                        .header { text-align: center; border-bottom: 2pt solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                        .header h1 { margin: 0; font-size: 18pt; text-transform: uppercase; font-weight: 900; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background: #f0f0f0; border: 1pt solid #000; padding: 8px; font-size: 8pt; text-transform: uppercase; }
                        td { border: 0.5pt solid #ccc; padding: 6px; font-size: 8pt; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .summary-box { margin-top: 20px; padding: 15px; border: 1pt solid #000; background: #fafafa; }
                        .summary-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 10pt; }
                        .net-row { border-top: 1pt solid #000; margin-top: 10px; padding-top: 5px; font-weight: 900; font-size: 12pt; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Cash Discount (CD) ${viewMode === 'DATE_WISE' ? 'Date-wise' : 'Detailed'} Ledger</h1>
                        <p>Forensic Settlement Report | Generated on ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 15%">Date</th>
                                <th style="width: 37%">Particulars</th>
                                <th style="width: 12%">Ref ID</th>
                                <th class="text-right" style="width: 12%">Debit (Out)</th>
                                <th class="text-right" style="width: 12%">Credit (In)</th>
                                <th class="text-right" style="width: 12%">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeData.map(t => `
                                <tr>
                                    <td>${format(new Date(t.date), 'dd-MM-yyyy')}</td>
                                    <td>${t.particulars}</td>
                                    <td>${t.id}</td>
                                    <td class="text-right">${t.debit > 0 ? t.debit.toFixed(2) : '—'}</td>
                                    <td class="text-right">${t.credit > 0 ? t.credit.toFixed(2) : '—'}</td>
                                    <td class="text-right font-bold">${t.balance.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="summary-box" style="display: flex; justify-content: space-between; align-items: center; gap: 15px; padding: 8px;">
                        <div style="flex: 1;">
                            <span style="font-size: 7pt; color: #666; display: block; text-transform: uppercase; font-weight: 800;">Total Received</span>
                            <span style="font-size: 9pt; font-weight: bold;">₹${totals.received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style="flex: 1; border-left: 0.5pt solid #ccc; padding-left: 15px;">
                            <span style="font-size: 7pt; color: #666; display: block; text-transform: uppercase; font-weight: 800;">Total Given</span>
                            <span style="font-size: 9pt; font-weight: bold;">₹${totals.given.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style="flex: 1.2; border-left: 1pt solid #000; padding-left: 15px; background: #f5f5f5; padding: 6px; border-radius: 4px;">
                            <span style="font-size: 7pt; color: #000; display: block; text-transform: uppercase; font-weight: 900;">Net Settlement</span>
                            <span style="font-size: 11pt; font-weight: 900;">₹${totals.net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </body>
            </html>
        `;
        await printHtmlContent(html);
    };




    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack}
                        className="p-3 hover:bg-slate-100 rounded-2xl transition-all group active:scale-95"
                    >
                        <ArrowLeft className="text-slate-600 group-hover:text-slate-900 transition-colors" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <HandCoins className="text-indigo-600" size={24} />
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">CD Forensic Ledger</h2>
                        </div>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-1">
                            <ShieldCheck size={12} className="text-emerald-500" /> Authorized Audit View
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* View Switcher */}
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                        <button 
                            onClick={() => setViewMode('DETAILED')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                viewMode === 'DETAILED' ? "bg-white text-indigo-600 shadow-md" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Detailed
                        </button>
                        <button 
                            onClick={() => setViewMode('DATE_WISE')}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                viewMode === 'DATE_WISE' ? "bg-white text-indigo-600 shadow-md" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Date-wise
                        </button>
                    </div>

                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                        <Printer size={16} /> PRINT
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-3xl border-none shadow-xl shadow-emerald-100/50 bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500" />
                        <div className="relative">
                            <div className="flex items-center gap-2 text-emerald-600 mb-2">
                                <TrendingUp size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">CD Received (Income)</span>
                            </div>
                            <div className="text-3xl font-black text-slate-900 font-mono">
                                {formatCurrency(totals.received)}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Total discounts received from suppliers</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl shadow-red-100/50 bg-white overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform duration-500" />
                        <div className="relative">
                            <div className="flex items-center gap-2 text-red-600 mb-2">
                                <TrendingDown size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">CD Given (Expense)</span>
                            </div>
                            <div className="text-3xl font-black text-slate-900 font-mono">
                                {formatCurrency(totals.given)}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Total discounts granted to customers</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-none shadow-xl shadow-indigo-100/50 bg-slate-900 overflow-hidden group">
                    <CardContent className="p-6 relative">
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full group-hover:scale-110 transition-transform duration-500" />
                        <div className="relative">
                            <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                <HandCoins size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Net Settlement</span>
                            </div>
                            <div className={cn(
                                "text-3xl font-black font-mono",
                                totals.net >= 0 ? "text-emerald-400" : "text-red-400"
                            )}>
                                {formatCurrency(totals.net)}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium">Accumulated discount impact</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Ledger Table */}
            <Card className="rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200/50 bg-white overflow-hidden">
                <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <HandCoins size={20} className="text-white" />
                        </div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                            {viewMode === 'DATE_WISE' ? 'Date-wise Summary Audit' : 'Detailed Audit Trail Ledger'}
                        </h3>
                    </div>
                    <span className="bg-white px-4 py-1.5 rounded-full border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest shadow-sm">
                        {activeData.length} Entries in {viewMode} mode
                    </span>
                </div>
                <div className="overflow-x-auto max-h-[calc(100vh-450px)]">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-white border-b border-slate-100">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="w-[140px] px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</TableHead>
                                <TableHead className="py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Particulars & Transaction Details</TableHead>
                                <TableHead className="w-[140px] py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref ID</TableHead>
                                <TableHead className="text-right w-[140px] py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Debit (Out)</TableHead>
                                <TableHead className="text-right w-[140px] py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Credit (In)</TableHead>
                                <TableHead className="text-right w-[160px] py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest px-8">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeData.map((t, idx) => (
                                <TableRow key={idx} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50 group">
                                    <TableCell className="px-8 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] font-black text-slate-900">{format(new Date(t.date), 'dd MMM yyyy')}</span>
                                            {viewMode === 'DETAILED' && (
                                                <span className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">{format(new Date(t.date), 'HH:mm')}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-1.5 h-8 rounded-full",
                                                t.credit > t.debit ? "bg-emerald-500" : t.debit > t.credit ? "bg-red-500" : "bg-slate-300"
                                            )} />
                                            <div className="flex flex-col">
                                                <span className="text-[13px] font-black text-slate-900">{t.particulars}</span>
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest mt-1",
                                                    t.credit > t.debit ? "text-emerald-600" : t.debit > t.credit ? "text-red-600" : "text-slate-400"
                                                )}>{t.type}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-tighter">
                                            {t.id}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right py-5">
                                        {t.debit > 0 ? (
                                            <span className="text-[13px] font-mono font-black text-red-600 tabular-nums">
                                                ₹{t.debit.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-slate-200">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-5">
                                        {t.credit > 0 ? (
                                            <span className="text-[13px] font-mono font-black text-emerald-600 tabular-nums">
                                                ₹{t.credit.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="text-slate-200">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right py-5 px-8">
                                        <span className="text-[14px] font-mono font-black text-slate-900">
                                            ₹{Math.round(t.balance).toLocaleString('en-IN')}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
};

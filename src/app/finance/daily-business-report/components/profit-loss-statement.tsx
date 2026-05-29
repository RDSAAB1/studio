"use client";

import React, { useMemo } from 'react';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ProfitLossStatementProps {
    reportData: any;
    globalData: any;
    startDate: Date;
    endDate: Date;
}

interface VarietyPurchaseRow {
    variety: string;
    baseAmount: number;
    govExtra: number;
    ledgerCredit: number;
    totalDr: number;
}

interface PnlRow {
    label: string;
    amount: number;
    sub?: string;
}

export const ProfitLossStatement: React.FC<ProfitLossStatementProps> = ({
    reportData,
    globalData,
    startDate,
    endDate,
}) => {
    const pnl = useMemo(() => {
        const startOfDay = (d: any) => new Date(new Date(d).setHours(0, 0, 0, 0));
        const filterStart = startOfDay(startDate);
        const filterEnd = startOfDay(endDate);
        const inRange = (d: any) => {
            const day = startOfDay(d);
            return day >= filterStart && day <= filterEnd;
        };

        const suppliers = (globalData.suppliers || []).filter((s: any) => inRange(s.date));
        const customers = (globalData.customers || []).filter((c: any) => inRange(c.date));
        const supplierPayments = (globalData.supplierPayments || []).filter((p: any) => inRange(p.date) && !p.isDeleted);

        // ─── DEBIT: Per-variety purchase amounts ────────────────────────────
        // Aggregate govExtraAmount and ledgerCredit from supplier payments per supplier
        const paymentExtras: Record<string, { govExtra: number; ledgerCredit: number }> = {};
        supplierPayments.forEach((p: any) => {
            const sid = String(p.supplierId || '');
            if (!paymentExtras[sid]) paymentExtras[sid] = { govExtra: 0, ledgerCredit: 0 };
            paymentExtras[sid].govExtra += Number(p.govExtraAmount) || 0;
            paymentExtras[sid].ledgerCredit += Number(p.ledgerCreditAmount) || 0;
        });

        // Also aggregate by parchiNo as fallback
        supplierPayments.forEach((p: any) => {
            if (p.parchiNo) {
                const key = `parchi:${p.parchiNo}`;
                if (!paymentExtras[key]) paymentExtras[key] = { govExtra: 0, ledgerCredit: 0 };
                paymentExtras[key].govExtra += Number(p.govExtraAmount) || 0;
                paymentExtras[key].ledgerCredit += Number(p.ledgerCreditAmount) || 0;
            }
        });

        const varietyMap: Record<string, VarietyPurchaseRow> = {};
        suppliers.forEach((s: any) => {
            const variety = (s.variety || 'UNKNOWN').toUpperCase().trim();
            if (!varietyMap[variety]) {
                varietyMap[variety] = { variety, baseAmount: 0, govExtra: 0, ledgerCredit: 0, totalDr: 0 };
            }
            const row = varietyMap[variety];
            const baseAmt = Number(s.amount) || 0;
            const sid = String(s.id || '');
            const srNo = String(s.srNo || '');
            const extras = paymentExtras[sid] || paymentExtras[srNo] || { govExtra: 0, ledgerCredit: 0 };

            row.baseAmount += baseAmt;
            row.govExtra += extras.govExtra;
            row.ledgerCredit += extras.ledgerCredit;
        });

        // Remaining govExtra/ledgerCredit not mapped to specific supplier → add to totals (unallocated)
        let unallocatedGovExtra = 0;
        let unallocatedLedgerCredit = 0;
        const usedPaymentKeys = new Set<string>();
        suppliers.forEach((s: any) => {
            usedPaymentKeys.add(String(s.id || ''));
            usedPaymentKeys.add(String(s.srNo || ''));
        });
        Object.entries(paymentExtras).forEach(([key, val]) => {
            if (!usedPaymentKeys.has(key) && !key.startsWith('parchi:')) {
                unallocatedGovExtra += val.govExtra;
                unallocatedLedgerCredit += val.ledgerCredit;
            }
        });

        const varietyRows: VarietyPurchaseRow[] = Object.values(varietyMap).map(r => ({
            ...r,
            totalDr: r.baseAmount + r.govExtra + r.ledgerCredit,
        })).sort((a, b) => b.totalDr - a.totalDr);

        // ─── DEBIT: Transport ────────────────────────────────────────────────
        // transport can be on customer entries as transportationRate × netWeight
        const totalTransport = customers.reduce((sum: number, c: any) => {
            const rate = Number(c.transportationRate) || 0;
            const wt = Number(c.netWeight) || 0;
            const transportAmt = Number(c.transportAmount) || 0;
            return sum + (transportAmt > 0 ? transportAmt : rate * wt);
        }, 0);

        // ─── DEBIT: Karta amount ─────────────────────────────────────────────
        const totalKarta = suppliers.reduce((sum: number, s: any) =>
            sum + (Number(s.kartaAmount) || Number(s.kartaAmt) || 0), 0);

        // ─── DEBIT: Bag weight deduction ─────────────────────────────────────
        // bagWeight deduction is weight of bags × rate, stored as bagWeightDeduction or computed
        const totalBagWtDeduction = suppliers.reduce((sum: number, s: any) => {
            const bagWtDeduct = Number(s.bagWeightDeduction) || Number(s.bagWtDeduction) || 0;
            return sum + bagWtDeduct;
        }, 0);

        // ─── DEBIT: Brokerage ────────────────────────────────────────────────
        const totalBrokerage = suppliers.reduce((sum: number, s: any) =>
            sum + (Number(s.brokerageAmount) || 0), 0);

        // ─── CREDIT: Kanta (weighbridge fees) ───────────────────────────────
        const totalKanta = suppliers.reduce((sum: number, s: any) =>
            sum + (Number(s.kanta) || 0), 0);

        // ─── CREDIT: Customer total amount ───────────────────────────────────
        const totalCustomerAmount = customers.reduce((sum: number, c: any) =>
            sum + (Number(c.amount) || 0), 0);

        // ─── CREDIT: Bag amount ──────────────────────────────────────────────
        const totalBagAmount = customers.reduce((sum: number, c: any) =>
            sum + (Number(c.bagAmount) || 0), 0);

        // ─── CD Account balance ──────────────────────────────────────────────
        // CD balance = total supplier CD received − total customer CD given
        const cdReceived = (globalData.supplierPayments || [])
            .filter((p: any) => !p.isDeleted)
            .reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
        const cdGiven = (globalData.customerPayments || [])
            .filter((p: any) => !p.isDeleted)
            .reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
        const cdNet = cdReceived - cdGiven; // positive = Cr balance (we received more), negative = Dr balance

        // ─── BUILD DR ROWS ───────────────────────────────────────────────────
        const drVarietyTotal = varietyRows.reduce((s, r) => s + r.totalDr, 0);

        const drRows: PnlRow[] = [
            ...varietyRows.map(r => ({
                label: `${r.variety} A/c`,
                amount: r.totalDr,
                sub: [
                    r.baseAmount > 0 ? `Amt: ${formatCurrency(r.baseAmount)}` : '',
                    r.govExtra > 0 ? `Gov Extra: ${formatCurrency(r.govExtra)}` : '',
                    r.ledgerCredit > 0 ? `Ledger Cr: ${formatCurrency(r.ledgerCredit)}` : '',
                ].filter(Boolean).join(' | '),
            })),
            ...(unallocatedGovExtra > 0 || unallocatedLedgerCredit > 0 ? [{
                label: 'Gov Extra / Ledger Credit (Unallocated)',
                amount: unallocatedGovExtra + unallocatedLedgerCredit,
                sub: `Gov Extra: ${formatCurrency(unallocatedGovExtra)} | Ledger Cr: ${formatCurrency(unallocatedLedgerCredit)}`,
            }] : []),
            ...(totalTransport > 0 ? [{ label: 'Transport A/c', amount: totalTransport, sub: 'Transportation charges on sales' }] : []),
            ...(totalKarta > 0 ? [{ label: 'Karta Charges A/c', amount: totalKarta, sub: 'Weighing/karta deductions paid' }] : []),
            ...(totalBagWtDeduction > 0 ? [{ label: 'Bag Weight Deduction A/c', amount: totalBagWtDeduction, sub: 'Weight deducted for bags' }] : []),
            ...(totalBrokerage > 0 ? [{ label: 'Brokerage A/c', amount: totalBrokerage, sub: 'Commission/brokerage on purchases' }] : []),
            ...(cdNet < 0 ? [{ label: 'CD A/c (Net Dr)', amount: Math.abs(cdNet), sub: `Received: ${formatCurrency(cdReceived)} | Given: ${formatCurrency(cdGiven)}` }] : []),
        ];

        const totalDr = drRows.reduce((s, r) => s + r.amount, 0);

        // ─── BUILD CR ROWS ───────────────────────────────────────────────────
        const crRows: PnlRow[] = [
            ...(totalKanta > 0 ? [{ label: 'Kanta A/c', amount: totalKanta, sub: 'Weighbridge fee income from suppliers' }] : []),
            ...(totalCustomerAmount > 0 ? [{ label: 'Sales A/c', amount: totalCustomerAmount, sub: `${customers.length} customer entries` }] : []),
            ...(totalBagAmount > 0 ? [{ label: 'Bag Charges A/c', amount: totalBagAmount, sub: 'Bag charges received from customers' }] : []),
            ...(cdNet > 0 ? [{ label: 'CD A/c (Net Cr)', amount: cdNet, sub: `Received: ${formatCurrency(cdReceived)} | Given: ${formatCurrency(cdGiven)}` }] : []),
        ];

        const totalCr = crRows.reduce((s, r) => s + r.amount, 0);
        const netProfit = totalCr - totalDr;

        return {
            drRows,
            crRows,
            totalDr,
            totalCr,
            netProfit,
            stats: {
                supplierCount: suppliers.length,
                customerCount: customers.length,
                varietyCount: varietyRows.length,
            }
        };
    }, [reportData, globalData, startDate, endDate]);

    const isProfit = pnl.netProfit >= 0;
    const grandTotal = Math.max(pnl.totalDr + (pnl.netProfit < 0 ? 0 : pnl.netProfit),
                                pnl.totalCr + (pnl.netProfit > 0 ? 0 : Math.abs(pnl.netProfit)));

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-black text-sm uppercase tracking-widest">
                            Trading & Profit &amp; Loss Account
                        </h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">
                            {pnl.stats.supplierCount} Purchases · {pnl.stats.customerCount} Sales · {pnl.stats.varietyCount} Varieties
                        </p>
                    </div>
                    <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm",
                        isProfit
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    )}>
                        {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{isProfit ? 'NET PROFIT' : 'NET LOSS'}</span>
                        <span className="ml-1 tabular-nums">{formatCurrency(Math.abs(pnl.netProfit))}</span>
                    </div>
                </div>
            </div>

            {/* Ledger Table */}
            <div className="grid grid-cols-2 divide-x divide-slate-200">
                {/* DR SIDE */}
                <div className="flex flex-col">
                    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">Dr Side (Expenditure)</span>
                        <span className="text-[10px] font-black text-rose-700 tabular-nums">{formatCurrency(pnl.totalDr)}</span>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1">
                        {pnl.drRows.map((row, i) => (
                            <div key={i} className="px-4 py-3 flex items-start justify-between gap-2 hover:bg-rose-50/40 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight truncate">{row.label}</p>
                                    {row.sub && (
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">{row.sub}</p>
                                    )}
                                </div>
                                <p className="text-[12px] font-black text-rose-700 tabular-nums shrink-0 mt-0.5">{formatCurrency(row.amount)}</p>
                            </div>
                        ))}
                        {/* Net Profit goes on Dr side */}
                        {isProfit && (
                            <div className="px-4 py-3 flex items-start justify-between gap-2 bg-emerald-50/60 border-t-2 border-emerald-200">
                                <div>
                                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-tight">Net Profit (Transferred to Capital)</p>
                                    <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">CR - DR = {formatCurrency(pnl.netProfit)}</p>
                                </div>
                                <p className="text-[12px] font-black text-emerald-700 tabular-nums shrink-0">{formatCurrency(pnl.netProfit)}</p>
                            </div>
                        )}
                    </div>
                    {/* DR Total */}
                    <div className="bg-rose-100/80 border-t-2 border-rose-300 px-4 py-3 flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase tracking-widest text-rose-800">Total</span>
                        <span className="text-[13px] font-black text-rose-800 tabular-nums">{formatCurrency(isProfit ? pnl.totalDr + pnl.netProfit : pnl.totalDr)}</span>
                    </div>
                </div>

                {/* CR SIDE */}
                <div className="flex flex-col">
                    <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Cr Side (Income)</span>
                        <span className="text-[10px] font-black text-emerald-700 tabular-nums">{formatCurrency(pnl.totalCr)}</span>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1">
                        {pnl.crRows.map((row, i) => (
                            <div key={i} className="px-4 py-3 flex items-start justify-between gap-2 hover:bg-emerald-50/40 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight truncate">{row.label}</p>
                                    {row.sub && (
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">{row.sub}</p>
                                    )}
                                </div>
                                <p className="text-[12px] font-black text-emerald-700 tabular-nums shrink-0 mt-0.5">{formatCurrency(row.amount)}</p>
                            </div>
                        ))}
                        {/* Net Loss goes on Cr side */}
                        {!isProfit && (
                            <div className="px-4 py-3 flex items-start justify-between gap-2 bg-rose-50/60 border-t-2 border-rose-200">
                                <div>
                                    <p className="text-[11px] font-black text-rose-700 uppercase tracking-tight">Net Loss (Transferred to Capital)</p>
                                    <p className="text-[9px] text-rose-600 font-bold uppercase tracking-wider mt-0.5">DR - CR = {formatCurrency(Math.abs(pnl.netProfit))}</p>
                                </div>
                                <p className="text-[12px] font-black text-rose-700 tabular-nums shrink-0">{formatCurrency(Math.abs(pnl.netProfit))}</p>
                            </div>
                        )}
                    </div>
                    {/* CR Total */}
                    <div className="bg-emerald-100/80 border-t-2 border-emerald-300 px-4 py-3 flex justify-between items-center">
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-800">Total</span>
                        <span className="text-[13px] font-black text-emerald-800 tabular-nums">{formatCurrency(!isProfit ? pnl.totalCr + Math.abs(pnl.netProfit) : pnl.totalCr)}</span>
                    </div>
                </div>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50">
                <div className="px-4 py-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Debit</p>
                    <p className="text-sm font-black text-rose-700 tabular-nums mt-0.5">{formatCurrency(pnl.totalDr)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Credit</p>
                    <p className="text-sm font-black text-emerald-700 tabular-nums mt-0.5">{formatCurrency(pnl.totalCr)}</p>
                </div>
                <div className="px-4 py-3 text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
                    <p className={cn("text-sm font-black tabular-nums mt-0.5", isProfit ? "text-emerald-700" : "text-rose-700")}>
                        {formatCurrency(Math.abs(pnl.netProfit))}
                    </p>
                </div>
            </div>
        </div>
    );
};

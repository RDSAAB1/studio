"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { useGlobalData } from "@/contexts/global-data-context";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { TrendingUp, TrendingDown, Calendar, RefreshCw } from 'lucide-react';
import type { DisplayTransaction } from "../../expense-tracker-client";

interface PnlAccountsProps {
  transactions: DisplayTransaction[];
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

export const PnlAccounts: React.FC<PnlAccountsProps> = ({ transactions }) => {
  const globalData = useGlobalData();
  const [subTab, setSubTab] = useState<'business' | 'ledger'>('business');

  // Setup self-contained date state
  const [startDate, setStartDate] = useState<Date>(() => {
    // Default to start of current month
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  // Date range picker helpers
  const handlePreset = (type: 'today' | 'month' | 'fy' | 'all') => {
    const today = new Date();
    if (type === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'month') {
      setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
      setEndDate(today);
    } else if (type === 'fy') {
      const year = today.getFullYear();
      const month = today.getMonth();
      const fyStartYear = month >= 3 ? year : year - 1;
      setStartDate(new Date(fyStartYear, 3, 1)); // April 1st
      setEndDate(today);
    } else if (type === 'all') {
      setStartDate(new Date("2024-04-01"));
      setEndDate(today);
    }
  };

  // Date range filtering logic
  const isDateInRange = (dateInput: string | Date | undefined | null, start: Date, end: Date) => {
    if (!dateInput) return false;
    let d: Date;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return false;
    // Set hours to zero for accurate day comparison
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return day >= s && day <= e;
  };

  // 1. Business Trading & P&L Calculation
  const businessPnlData = useMemo(() => {
    const suppliers = (globalData.suppliers || []).filter((s: any) => isDateInRange(s.date, startDate, endDate));
    const customers = (globalData.customers || []).filter((c: any) => isDateInRange(c.date, startDate, endDate));
    const supplierPayments = (globalData.supplierPayments || []).filter((p: any) => isDateInRange(p.date, startDate, endDate) && !p.isDeleted);
    const customerPayments = (globalData.customerPayments || []).filter((p: any) => isDateInRange(p.date, startDate, endDate) && !p.isDeleted);

    // --- TRADING DR: Variety purchases ---
    const paymentExtras: Record<string, { govExtra: number; ledgerCredit: number }> = {};
    supplierPayments.forEach((p: any) => {
      const sid = String(p.supplierId || '');
      if (!paymentExtras[sid]) paymentExtras[sid] = { govExtra: 0, ledgerCredit: 0 };
      paymentExtras[sid].govExtra += Number(p.govExtraAmount) || 0;
      paymentExtras[sid].ledgerCredit += Number(p.ledgerCreditAmount) || 0;
    });

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

    // --- TRADING DR: Direct Expenses ---
    const totalTransport = customers.reduce((sum: number, c: any) => {
      const rate = Number(c.transportationRate) || 0;
      const wt = Number(c.netWeight) || 0;
      const transportAmt = Number(c.transportAmount) || 0;
      return sum + (transportAmt > 0 ? transportAmt : rate * wt);
    }, 0);

    const totalKarta = suppliers.reduce((sum: number, s: any) =>
      sum + (Number(s.kartaAmount) || Number(s.kartaAmt) || 0), 0);

    const totalBagWtDeduction = suppliers.reduce((sum: number, s: any) =>
      sum + (Number(s.bagWeightDeduction) || Number(s.bagWtDeduction) || 0), 0);

    const totalBrokerage = suppliers.reduce((sum: number, s: any) =>
      sum + (Number(s.brokerageAmount) || 0), 0);

    // --- TRADING CR: Direct Incomes & Sales ---
    const totalKanta = suppliers.reduce((sum: number, s: any) =>
      sum + (Number(s.kanta) || 0), 0);

    const totalCustomerAmount = customers.reduce((sum: number, c: any) =>
      sum + (Number(c.amount) || 0), 0);

    const totalBagAmount = customers.reduce((sum: number, c: any) =>
      sum + (Number(c.bagAmount) || 0), 0);

    const cdReceived = supplierPayments.reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
    const cdGiven = customerPayments.reduce((s: number, p: any) => s + (Number(p.cdAmount) || 0), 0);
    const cdNet = cdReceived - cdGiven;

    // --- TRADING & P&L: Manual Overheads ---
    // Filter manual expenses/incomes: exclude stock/trading prefixes and Balance Sheet types
    const manualLedgers: Record<string, { name: string; totalIn: number; totalOut: number }> = {};
    const bsEntryTypes = ['CAPITAL', 'LIABILITIES', 'BUILDING', 'MACHINERY', 'BORROW', 'BORROW RETURN', 'LEND', 'LEND RETURN', 'OPENING DR', 'OPENING CR'];
    
    transactions.forEach(t => {
      // Exclude inventory/trading source rows
      if (t.id.startsWith('SUP-') || t.id.startsWith('CUS-') || t.id.startsWith('INV-')) return;
      
      const entryType = (t.entryType || "").toUpperCase().trim();
      const subCategory = (t.subCategory || "").toUpperCase().trim();
      
      // Exclude Balance Sheet and Party Ledger accounts
      if (bsEntryTypes.includes(entryType)) return;
      if (subCategory.includes('PARTY') || (t.category || "").toUpperCase().trim().includes('PARTY')) return;

      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();
      const isCr = txType === 'income';
      const isDr = txType === 'expense';

      if (!isCr && !isDr) return;

      // Group into generic ledger name if it's a target tag
      let ledgerName = "";
      if (entryType === 'SALARY') ledgerName = "Salary Account";
      else if (entryType === 'LABOURY') ledgerName = "Labour Account";
      else if (entryType === 'TRANSPORT') ledgerName = "Transport Account";
      else if (entryType === 'BROKERAGE') ledgerName = "Brokerage Account";
      else if (entryType === 'MISCELLANEOUS') ledgerName = "Miscellaneous Account";
      else if (entryType === 'PAYABLE' || entryType === 'RECEIVABLE' || entryType === 'INTEREST') ledgerName = "Interest Account";
      else ledgerName = toTitleCase((t.payee || "").trim());

      if (!ledgerName) return;

      // Check if transaction is in current date range
      if (!isDateInRange(t.date, startDate, endDate)) return;

      if (!manualLedgers[ledgerName]) {
        manualLedgers[ledgerName] = { name: ledgerName, totalIn: 0, totalOut: 0 };
      }

      if (isCr) {
        manualLedgers[ledgerName].totalIn += amount;
      } else if (isDr) {
        manualLedgers[ledgerName].totalOut += amount;
      }
    });

    // Separate direct manual tags (calculated in Trading A/c) vs indirect manual overheads (P&L A/c)
    const directTags = ["Labour Account", "Transport Account", "Brokerage Account"];
    let manualDirectExpense = 0;
    const indirectDrRows: PnlRow[] = [];
    const indirectCrRows: PnlRow[] = [];

    Object.values(manualLedgers).forEach(acc => {
      const balance = acc.totalIn - acc.totalOut; // Credit - Debit
      
      if (directTags.includes(acc.name)) {
        // Accumulate direct costs from manual tags (debits increase costs)
        if (balance < -0.5) {
          manualDirectExpense += Math.abs(balance);
        }
      } else {
        if (balance < -0.5) {
          indirectDrRows.push({ label: acc.name, amount: Math.abs(balance) });
        } else if (balance > 0.5) {
          indirectCrRows.push({ label: acc.name, amount: balance });
        }
      }
    });

    // --- ASSEMBLE TRADING DR/CR ---
    const tradingDr: PnlRow[] = [
      ...varietyRows.map(r => ({
        label: `${r.variety} Purchase`,
        amount: r.totalDr,
        sub: [
          r.baseAmount > 0 ? `Amt: ${formatCurrency(r.baseAmount)}` : '',
          r.govExtra > 0 ? `Gov Extra: ${formatCurrency(r.govExtra)}` : '',
          r.ledgerCredit > 0 ? `Ledger Cr: ${formatCurrency(r.ledgerCredit)}` : '',
        ].filter(Boolean).join(' | '),
      })),
      ...(unallocatedGovExtra > 0 || unallocatedLedgerCredit > 0 ? [{
        label: 'Gov Extra / Ledger Cr (Unallocated)',
        amount: unallocatedGovExtra + unallocatedLedgerCredit,
        sub: `Gov Extra: ${formatCurrency(unallocatedGovExtra)} | Ledger Cr: ${formatCurrency(unallocatedLedgerCredit)}`,
      }] : []),
      ...(totalTransport > 0 ? [{ label: 'Transport Cost (Sales)', amount: totalTransport }] : []),
      ...(totalKarta > 0 ? [{ label: 'Karta Charges', amount: totalKarta }] : []),
      ...(totalBagWtDeduction > 0 ? [{ label: 'Bag Weight Deduction', amount: totalBagWtDeduction }] : []),
      ...(totalBrokerage > 0 ? [{ label: 'Brokerage (Purchases)', amount: totalBrokerage }] : []),
      ...(manualDirectExpense > 0 ? [{ label: 'Direct Expenses (Labour/Broker/Transport Manual)', amount: manualDirectExpense }] : []),
      ...(cdNet < 0 ? [{ label: 'CD Allowed (Net)', amount: Math.abs(cdNet) }] : []),
    ];

    const tradingCr: PnlRow[] = [
      ...(totalCustomerAmount > 0 ? [{ label: 'Sales Revenue', amount: totalCustomerAmount, sub: `${customers.length} Invoices` }] : []),
      ...(totalBagAmount > 0 ? [{ label: 'Bag Charges Received', amount: totalBagAmount }] : []),
      ...(totalKanta > 0 ? [{ label: 'Kanta (Weighbridge Income)', amount: totalKanta }] : []),
      ...(cdNet > 0 ? [{ label: 'CD Received (Net)', amount: cdNet }] : []),
    ];

    const totalTradingDr = tradingDr.reduce((s, r) => s + r.amount, 0);
    const totalTradingCr = tradingCr.reduce((s, r) => s + r.amount, 0);
    
    // Trading Gross Profit / Loss
    const grossProfit = totalTradingCr - totalTradingDr; // positive = Profit, negative = Loss

    // --- ASSEMBLE INDIRECT P&L ---
    const pnlDr: PnlRow[] = [];
    const pnlCr: PnlRow[] = [];

    if (grossProfit < 0) {
      pnlDr.push({ label: 'Gross Loss b/d (from Trading A/c)', amount: Math.abs(grossProfit) });
    }
    pnlDr.push(...indirectDrRows.sort((a, b) => b.amount - a.amount));

    if (grossProfit > 0) {
      pnlCr.push({ label: 'Gross Profit b/d (from Trading A/c)', amount: grossProfit });
    }
    pnlCr.push(...indirectCrRows.sort((a, b) => b.amount - a.amount));

    const totalPnlDr = pnlDr.reduce((s, r) => s + r.amount, 0);
    const totalPnlCr = pnlCr.reduce((s, r) => s + r.amount, 0);
    const netProfit = totalPnlCr - totalPnlDr;

    return {
      tradingDr,
      tradingCr,
      totalTradingDr,
      totalTradingCr,
      grossProfit,
      pnlDr,
      pnlCr,
      totalPnlDr,
      totalPnlCr,
      netProfit,
      stats: {
        purchasesCount: suppliers.length,
        salesCount: customers.length,
        manualCount: Object.keys(manualLedgers).length,
      }
    };
  }, [globalData, transactions, startDate, endDate]);

  // 2. Master Ledger-wise P&L Calculation (Original View)
  const ledgerPnlData = useMemo(() => {
    const ledgers: Record<string, { name: string; totalIn: number; totalOut: number }> = {};

    transactions.forEach(t => {
      // Exclude inventory source rows
      if (t.id.startsWith('SUP-') || t.id.startsWith('CUS-')) return;

      const subCategory = (t.subCategory || "").toUpperCase().trim();
      const entryType = (t.entryType || "").toUpperCase().trim();

      const isMasterAccount = subCategory === 'MASTER ACCOUNT';
      const isTargetTag = ['SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'MISCELLANEOUS', 'PAYABLE', 'RECEIVABLE', 'INTEREST'].includes(entryType);

      if (!isMasterAccount && !isTargetTag) return;

      let ledgerName = "";
      if (isTargetTag) {
        if (entryType === 'SALARY') ledgerName = "Salary Account";
        else if (entryType === 'LABOURY') ledgerName = "Labour Account";
        else if (entryType === 'TRANSPORT') ledgerName = "Transport Account";
        else if (entryType === 'BROKERAGE') ledgerName = "Brokerage Account";
        else if (entryType === 'MISCELLANEOUS') ledgerName = "Miscellaneous Account";
        else if (entryType === 'PAYABLE' || entryType === 'RECEIVABLE' || entryType === 'INTEREST') ledgerName = "Interest Account";
      } else {
        ledgerName = toTitleCase((t.payee || "").trim());
      }

      if (!ledgerName) return;

      // Filter by date range
      if (!isDateInRange(t.date, startDate, endDate)) return;

      const amount = Number(t.amount) || 0;
      const txType = (t.transactionType || "").toLowerCase();
      const isCr = txType === 'income';
      const isDr = txType === 'expense';

      if (!isCr && !isDr) return;

      if (!ledgers[ledgerName]) {
        ledgers[ledgerName] = { name: ledgerName, totalIn: 0, totalOut: 0 };
      }

      if (isCr) {
        ledgers[ledgerName].totalIn += amount;
      } else if (isDr) {
        ledgers[ledgerName].totalOut += amount;
      }
    });

    const debitSide: { name: string; totalIn: number; totalOut: number; balance: number }[] = [];
    const creditSide: { name: string; totalIn: number; totalOut: number; balance: number }[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    Object.values(ledgers).forEach(acc => {
      const balance = acc.totalIn - acc.totalOut;

      if (balance < -0.5) {
        debitSide.push({ ...acc, balance: Math.abs(balance) });
        totalDebit += Math.abs(balance);
      } else if (balance > 0.5) {
        creditSide.push({ ...acc, balance });
        totalCredit += balance;
      }
    });

    debitSide.sort((a, b) => a.name.localeCompare(b.name));
    creditSide.sort((a, b) => a.name.localeCompare(b.name));

    return {
      debitSide,
      creditSide,
      totalDebit,
      totalCredit,
      netProfit: totalCredit - totalDebit,
    };
  }, [transactions, startDate, endDate]);

  const activeProfit = subTab === 'business' ? businessPnlData.netProfit : ledgerPnlData.netProfit;
  const isProfit = activeProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Date Filter & Preset Controls */}
      <Card className="border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Statement Filter</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Filter profits &amp; losses by date</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">From</span>
              <SmartDatePicker
                value={startDate}
                onChange={(d) => setStartDate(d as Date)}
                returnDate
                className="w-[140px] h-8 text-[11px] bg-slate-50 border-slate-200"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500">To</span>
              <SmartDatePicker
                value={endDate}
                onChange={(d) => setEndDate(d as Date)}
                returnDate
                className="w-[140px] h-8 text-[11px] bg-slate-50 border-slate-200"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-[4px] border border-slate-200">
              <button onClick={() => handlePreset('today')} className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-[2px] transition-colors">Today</button>
              <button onClick={() => handlePreset('month')} className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-[2px] transition-colors">Month</button>
              <button onClick={() => handlePreset('fy')} className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-[2px] transition-colors">FY</button>
              <button onClick={() => handlePreset('all')} className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:bg-white rounded-[2px] transition-colors">All Time</button>
            </div>
          </div>
        </div>
      </Card>

      {/* View Selector Toggle & Quick Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-lg gap-1 shrink-0">
          <button
            onClick={() => setSubTab('business')}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all",
              subTab === 'business'
                ? "bg-purple-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Trading &amp; P&amp;L (Business)
          </button>
          <button
            onClick={() => setSubTab('ledger')}
            className={cn(
              "px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all",
              subTab === 'ledger'
                ? "bg-purple-950 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            Master Ledger P&amp;L
          </button>
        </div>

        {/* Global Net Profit Indicator */}
        <div className={cn(
          "flex items-center gap-2.5 px-4 py-2 rounded-xl border font-black text-xs uppercase shadow-sm leading-none shrink-0",
          isProfit
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200"
        )}>
          {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>Net {isProfit ? 'Profit' : 'Loss'}</span>
          <span className="tabular-nums font-black text-sm">{formatCurrency(Math.abs(activeProfit))}</span>
        </div>
      </div>

      {/* RENDER VIEW 1: TRADING & PROFIT LOSS STATEMENT (BUSINESS) */}
      {subTab === 'business' && (
        <div className="space-y-4">
          {/* TRADING ACCOUNT CARD */}
          <Card className="border border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-purple-950 text-white px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-widest">Trading Account</CardTitle>
                <CardDescription className="text-purple-200 font-bold uppercase text-[10px] mt-0.5">
                  Direct Cost of Sales vs Revenue · {businessPnlData.stats.purchasesCount} Purchases · {businessPnlData.stats.salesCount} Sales
                </CardDescription>
              </div>
              <div className="bg-purple-800 text-purple-100 text-[10px] font-black px-2 py-0.5 rounded border border-purple-700 uppercase tracking-widest">
                Gross GP: {formatCurrency(businessPnlData.grossProfit)}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* DEBIT: Trading Cost of Goods Sold */}
                <div className="flex flex-col min-h-[220px]">
                  <div className="bg-rose-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Dr — Direct Purchases &amp; Expenses</span>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded uppercase">Debit</span>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {businessPnlData.tradingDr.length === 0 ? (
                      <div className="text-center py-12 text-slate-300 font-bold uppercase text-xs">No Direct Debits</div>
                    ) : (
                      businessPnlData.tradingDr.map((item, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-start justify-between gap-2 hover:bg-rose-50/20 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 uppercase truncate">{item.label}</p>
                            {item.sub && <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5 truncate">{item.sub}</p>}
                          </div>
                          <p className="text-xs font-black text-rose-600 tabular-nums shrink-0 mt-0.5">{formatCurrency(item.amount)}</p>
                        </div>
                      ))
                    )}
                    {/* balancing gross profit */}
                    {businessPnlData.grossProfit > 0 && (
                      <div className="px-4 py-2.5 flex items-start justify-between gap-2 bg-emerald-50/50 border-t border-emerald-100">
                        <div>
                          <p className="text-xs font-black text-emerald-700 uppercase">Gross Profit c/o (to P&amp;L)</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">GP = Cr − Dr</p>
                        </div>
                        <p className="text-xs font-black text-emerald-700 tabular-nums shrink-0">{formatCurrency(businessPnlData.grossProfit)}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-rose-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between font-black text-xs text-rose-900 uppercase mt-auto">
                    <span>Total Trading Cost</span>
                    <span>
                      {formatCurrency(
                        businessPnlData.grossProfit > 0
                          ? businessPnlData.totalTradingDr + businessPnlData.grossProfit
                          : businessPnlData.totalTradingDr
                      )}
                    </span>
                  </div>
                </div>

                {/* CREDIT: Trading Sales Revenues */}
                <div className="flex flex-col min-h-[220px]">
                  <div className="bg-emerald-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cr — Direct Sales &amp; Income</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded uppercase">Credit</span>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {businessPnlData.tradingCr.length === 0 ? (
                      <div className="text-center py-12 text-slate-300 font-bold uppercase text-xs">No Direct Credits</div>
                    ) : (
                      businessPnlData.tradingCr.map((item, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-start justify-between gap-2 hover:bg-emerald-50/20 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 uppercase truncate">{item.label}</p>
                            {item.sub && <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5 truncate">{item.sub}</p>}
                          </div>
                          <p className="text-xs font-black text-emerald-600 tabular-nums shrink-0 mt-0.5">{formatCurrency(item.amount)}</p>
                        </div>
                      ))
                    )}
                    {/* balancing gross loss */}
                    {businessPnlData.grossProfit < 0 && (
                      <div className="px-4 py-2.5 flex items-start justify-between gap-2 bg-rose-50/50 border-t border-rose-100">
                        <div>
                          <p className="text-xs font-black text-rose-700 uppercase">Gross Loss c/o (to P&amp;L)</p>
                          <p className="text-[9px] font-bold text-rose-600 uppercase mt-0.5">GL = Dr − Cr</p>
                        </div>
                        <p className="text-xs font-black text-rose-700 tabular-nums shrink-0">{formatCurrency(Math.abs(businessPnlData.grossProfit))}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between font-black text-xs text-emerald-900 uppercase mt-auto">
                    <span>Total Trading Yield</span>
                    <span>
                      {formatCurrency(
                        businessPnlData.grossProfit < 0
                          ? businessPnlData.totalTradingCr + Math.abs(businessPnlData.grossProfit)
                          : businessPnlData.totalTradingCr
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PROFIT & LOSS ACCOUNT CARD */}
          <Card className="border border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-slate-900 text-white px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-widest">Profit &amp; Loss Account</CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase text-[10px] mt-0.5">
                  Overheads, Indirect Expenses &amp; Incomes · {businessPnlData.stats.manualCount} Active Manual Accounts
                </CardDescription>
              </div>
              <div className="bg-slate-800 text-slate-100 text-[10px] font-black px-2 py-0.5 rounded border border-slate-700 uppercase tracking-widest">
                Net Profit: {formatCurrency(businessPnlData.netProfit)}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* DEBIT: P&L Expenses */}
                <div className="flex flex-col min-h-[220px]">
                  <div className="bg-rose-50/50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-rose-800 uppercase tracking-widest">Dr — Indirect Expenses / Overheads</span>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded uppercase">Debit</span>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {businessPnlData.pnlDr.length === 0 ? (
                      <div className="text-center py-12 text-slate-300 font-bold uppercase text-xs">No Indirect Debits</div>
                    ) : (
                      businessPnlData.pnlDr.map((item, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-start justify-between gap-2 hover:bg-rose-50/20 transition-colors">
                          <p className="text-xs font-bold text-slate-800 uppercase truncate">{item.label}</p>
                          <p className="text-xs font-black text-rose-600 tabular-nums shrink-0">{formatCurrency(item.amount)}</p>
                        </div>
                      ))
                    )}
                    {/* balancing net profit */}
                    {businessPnlData.netProfit > 0 && (
                      <div className="px-4 py-2.5 flex items-start justify-between gap-2 bg-emerald-50/60 border-t border-emerald-100 mt-auto">
                        <div>
                          <p className="text-xs font-black text-emerald-700 uppercase">Net Profit Transfer</p>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">Transferred to Capital</p>
                        </div>
                        <p className="text-xs font-black text-emerald-700 tabular-nums shrink-0">{formatCurrency(businessPnlData.netProfit)}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-rose-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between font-black text-xs text-rose-900 uppercase mt-auto">
                    <span>Total P&amp;L Debit</span>
                    <span>
                      {formatCurrency(
                        businessPnlData.netProfit > 0
                          ? businessPnlData.totalPnlDr + businessPnlData.netProfit
                          : businessPnlData.totalPnlDr
                      )}
                    </span>
                  </div>
                </div>

                {/* CREDIT: P&L Incomes */}
                <div className="flex flex-col min-h-[220px]">
                  <div className="bg-emerald-50/50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Cr — Indirect Incomes / Gains</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded uppercase">Credit</span>
                  </div>
                  <div className="divide-y divide-slate-100 flex-1">
                    {businessPnlData.pnlCr.length === 0 ? (
                      <div className="text-center py-12 text-slate-300 font-bold uppercase text-xs">No Indirect Credits</div>
                    ) : (
                      businessPnlData.pnlCr.map((item, idx) => (
                        <div key={idx} className="px-4 py-2.5 flex items-start justify-between gap-2 hover:bg-emerald-50/20 transition-colors">
                          <p className="text-xs font-bold text-slate-800 uppercase truncate">{item.label}</p>
                          <p className="text-xs font-black text-emerald-600 tabular-nums shrink-0">{formatCurrency(item.amount)}</p>
                        </div>
                      ))
                    )}
                    {/* balancing net loss */}
                    {businessPnlData.netProfit < 0 && (
                      <div className="px-4 py-2.5 flex items-start justify-between gap-2 bg-rose-50/60 border-t border-rose-100 mt-auto">
                        <div>
                          <p className="text-xs font-black text-rose-700 uppercase">Net Loss Transfer</p>
                          <p className="text-[9px] font-bold text-rose-600 uppercase mt-0.5">Transferred to Capital</p>
                        </div>
                        <p className="text-xs font-black text-rose-700 tabular-nums shrink-0">{formatCurrency(Math.abs(businessPnlData.netProfit))}</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between font-black text-xs text-emerald-900 uppercase mt-auto">
                    <span>Total P&amp;L Credit</span>
                    <span>
                      {formatCurrency(
                        businessPnlData.netProfit < 0
                          ? businessPnlData.totalPnlCr + Math.abs(businessPnlData.netProfit)
                          : businessPnlData.totalPnlCr
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* RENDER VIEW 2: ORIGINAL MASTER LEDGER P&L VIEW */}
      {subTab === 'ledger' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-rose-50 border-rose-200 shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-black text-rose-800 uppercase tracking-widest leading-none">Total Debits (Dr)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-rose-600 tracking-tighter">{formatCurrency(ledgerPnlData.totalDebit)}</div>
                <p className="text-[10px] font-bold text-rose-400 uppercase mt-1 tracking-wider">{ledgerPnlData.debitSide.length} Ledger(s)</p>
              </CardContent>
            </Card>

            <CardContent className="p-0 bg-white" />

            <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-black text-emerald-800 uppercase tracking-widest leading-none">Total Credits (Cr)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-emerald-600 tracking-tighter">{formatCurrency(ledgerPnlData.totalCredit)}</div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase mt-1 tracking-wider">{ledgerPnlData.creditSide.length} Ledger(s)</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-slate-200 shadow-lg overflow-hidden">
            <CardHeader className="bg-purple-950 text-white border-b border-purple-900 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black uppercase tracking-widest">Master Ledger P&amp;L Statement</CardTitle>
                <CardDescription className="text-xs font-bold text-purple-200 uppercase mt-0.5">
                  Ledger Groupings: Salaries, Labour, Transport, Brokerage, Interest, Miscellaneous
                </CardDescription>
              </div>
              <div className="bg-purple-800 border border-purple-700 text-purple-100 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider">
                {ledgerPnlData.debitSide.length + ledgerPnlData.creditSide.length} Accounts
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* DEBIT SIDE (Dr) */}
                <div className="flex flex-col min-h-[300px]">
                  <div className="bg-rose-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-black text-rose-800 uppercase tracking-widest">Dr — Expenses / Loss</span>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded uppercase">Debit</span>
                  </div>
                  <Table>
                    <TableBody>
                      {ledgerPnlData.debitSide.length === 0 ? (
                        <TableRow>
                          <TableCell className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                            No Debit Ledgers
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerPnlData.debitSide.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-rose-50/20 border-b border-slate-100">
                            <TableCell className="font-bold text-slate-800 text-xs py-2.5 uppercase">{item.name}</TableCell>
                            <TableCell className="text-right font-black text-rose-600 py-2.5 tabular-nums">
                              {formatCurrency(item.balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {/* balancing net profit */}
                      {ledgerPnlData.netProfit > 0 && (
                        <TableRow className="bg-emerald-50/50 hover:bg-emerald-100/50 border-b border-slate-100 mt-auto">
                          <TableCell className="font-black text-emerald-700 text-xs py-3 uppercase">Net Profit Transfer</TableCell>
                          <TableCell className="text-right font-black text-emerald-700 py-3 tabular-nums">
                            {formatCurrency(ledgerPnlData.netProfit)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="mt-auto bg-rose-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-rose-900 uppercase tracking-wider">
                    <span>Total Debit (Net)</span>
                    <span>
                      {formatCurrency(
                        ledgerPnlData.netProfit > 0
                          ? ledgerPnlData.totalDebit + ledgerPnlData.netProfit
                          : ledgerPnlData.totalDebit
                      )}
                    </span>
                  </div>
                </div>

                {/* CREDIT SIDE (Cr) */}
                <div className="flex flex-col min-h-[300px]">
                  <div className="bg-emerald-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest">Cr — Incomes / Gains</span>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded uppercase">Credit</span>
                  </div>
                  <Table>
                    <TableBody>
                      {ledgerPnlData.creditSide.length === 0 ? (
                        <TableRow>
                          <TableCell className="text-center py-16 text-slate-300 font-bold uppercase text-xs">
                            No Credit Ledgers
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerPnlData.creditSide.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-emerald-50/20 border-b border-slate-100">
                            <TableCell className="font-bold text-slate-800 text-xs py-2.5 uppercase">{item.name}</TableCell>
                            <TableCell className="text-right font-black text-emerald-600 py-2.5 tabular-nums">
                              {formatCurrency(item.balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                      {/* balancing net loss */}
                      {ledgerPnlData.netProfit < 0 && (
                        <TableRow className="bg-rose-50/50 hover:bg-rose-100/50 border-b border-slate-100 mt-auto">
                          <TableCell className="font-black text-rose-700 text-xs py-3 uppercase">Net Loss Transfer</TableCell>
                          <TableCell className="text-right font-black text-rose-700 py-3 tabular-nums">
                            {formatCurrency(Math.abs(ledgerPnlData.netProfit))}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="mt-auto bg-emerald-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between font-black text-xs text-emerald-900 uppercase tracking-wider">
                    <span>Total Credit (Net)</span>
                    <span>
                      {formatCurrency(
                        ledgerPnlData.netProfit < 0
                          ? ledgerPnlData.totalCredit + Math.abs(ledgerPnlData.netProfit)
                          : ledgerPnlData.totalCredit
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

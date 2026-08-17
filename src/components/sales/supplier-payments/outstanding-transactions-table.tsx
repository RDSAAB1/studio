"use client";

import React, { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, FileText, Info, Check, X, BookmarkCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, isValid } from "date-fns";

interface OutstandingTransactionsTableProps {
  suppliers: any[];
  onShowDetails?: (entry: any) => void;
  onEditEntry?: (entry: any) => void;
  onPrintRow?: (entry: any) => void;
  onSelectReference?: (parchiNoStr: string, selectedEntries: any[]) => void;
  type?: 'supplier' | 'customer' | 'outsider';
}

const formatDec = (val: any) => {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
};

export function OutstandingTransactionsTable({ suppliers, onShowDetails, onEditEntry, onPrintRow, onSelectReference, type = 'supplier' }: OutstandingTransactionsTableProps) {
  const isSupplier = type === 'supplier';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("all");

  const tabCounts = useMemo(() => {
    const counts = { all: 0, outstanding: 0, running: 0, profitable: 0, paid: 0 };
    if (!Array.isArray(suppliers)) return counts;
    counts.all = suppliers.length;
    for (const t of suppliers) {
      const totalPaid = t.totalPaidForEntry ?? t.totalPaid ?? 0;
      const original = t.originalNetAmount ?? 0;
      const outstanding = Number(t.outstandingForEntry ?? t.netAmount ?? 0);

      if (outstanding < 1) counts.paid += 1;
      else if (outstanding < 200) counts.profitable += 1;
      else if (outstanding >= 200 && totalPaid > 0) counts.running += 1;

      if (totalPaid === 0 && original > 0) counts.outstanding += 1;
    }
    return counts;
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!Array.isArray(suppliers)) return [];
    if (activeTab === "all") return suppliers;
    return suppliers.filter((t) => {
      const totalPaid = t.totalPaidForEntry ?? t.totalPaid ?? 0;
      const original = t.originalNetAmount ?? 0;
      const outstanding = Number(t.outstandingForEntry ?? t.netAmount ?? 0);

      switch (activeTab) {
        case "outstanding":
          return totalPaid === 0 && original > 0;
        case "running":
          return outstanding >= 200 && totalPaid > 0;
        case "profitable":
          return outstanding >= 1 && outstanding < 200;
        case "paid":
          return outstanding < 1;
        default:
          return true;
      }
    });
  }, [suppliers, activeTab]);

  const allRowIds = useMemo(() => {
    return (filteredSuppliers || []).map((curr, idx) => curr.srNo || curr.id || String(idx));
  }, [filteredSuppliers]);

  const isAllSelected = filteredSuppliers && filteredSuppliers.length > 0 && selectedIds.size === filteredSuppliers.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < (filteredSuppliers?.length || 0);

  const calculatedTotals = useMemo(() => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) {
      return {
        grossWt: 0, teirWt: 0, finalWt: 0, netWt: 0,
        baseAmt: 0, kartaAmt: 0, afterKarta: 0, cdAmt: 0,
        kanta: 0, laboury: 0, brokerage: 0, totalPay: 0,
        finalNet: 0, extra: 0, paid: 0, cdPaid: 0,
        outstand: 0, afterCdOutstand: 0, count: 0, isSelectedOnly: false
      };
    }

    const isFilterActive = selectedIds.size > 0;
    const targetRows = isFilterActive
      ? filteredSuppliers.filter((curr, idx) => selectedIds.has(curr.srNo || curr.id || String(idx)))
      : filteredSuppliers;

    const initial = {
      grossWt: 0, teirWt: 0, finalWt: 0, netWt: 0,
      baseAmt: 0, kartaAmt: 0, afterKarta: 0, cdAmt: 0,
      kanta: 0, laboury: 0, brokerage: 0, totalPay: 0,
      finalNet: 0, extra: 0, paid: 0, cdPaid: 0,
      outstand: 0, afterCdOutstand: 0, count: targetRows.length, isSelectedOnly: isFilterActive
    };

    return targetRows.reduce((acc, curr) => {
      const gWt = Number(curr.grossWeight || curr.grossWt || 0);
      const tWt = Number(curr.teirWeight || curr.teirWt || 0);
      const fWt = Number(curr.weight || curr.finalWeight || 0);
      const nWt = Number(curr.netWeight || 0);

      const baseAmt = Number(curr.amount || 0);
      const kartaAmt = Number(curr.kartaAmount || 0);
      const afterKarta = baseAmt - kartaAmt;
      const cdAmt = Number(curr.cdAmount || curr.cd || 0);
      const kanta = Number(curr.kanta || 0);
      const laboury = Number(curr.labouryAmount || 0);
      const brokerage = Number(curr.brokerage || 0);

      const totalPay = baseAmt - laboury - kanta - kartaAmt;
      const finalNet = afterKarta - cdAmt - laboury - kanta;
      const extra = Number(curr.extraAmount || 0);
      const paid = Number(curr.totalPaidForEntry || curr.paid || 0);
      const cdPaid = Number(curr.totalCdForEntry || curr.cdPaid || 0);
      const outstand = Number(curr.outstandingForEntry ?? curr.netAmount ?? 0);
      const afterCdOutstand = finalNet - paid;

      acc.grossWt += gWt;
      acc.teirWt += tWt;
      acc.finalWt += fWt;
      acc.netWt += nWt;

      acc.baseAmt += baseAmt;
      acc.kartaAmt += kartaAmt;
      acc.afterKarta += afterKarta;
      acc.cdAmt += cdAmt;
      acc.kanta += kanta;
      acc.laboury += laboury;
      acc.brokerage += brokerage;

      acc.totalPay += totalPay;
      acc.finalNet += finalNet;
      acc.extra += extra;
      acc.paid += paid;
      acc.cdPaid += cdPaid;
      acc.outstand += outstand;
      acc.afterCdOutstand += afterCdOutstand;

      return acc;
    }, initial);
  }, [filteredSuppliers, selectedIds]);

  const notifySelectionChange = (newSelectedIds: Set<string>) => {
    if (!onSelectReference) return;
    const selectedEntries = (filteredSuppliers || []).filter((curr, idx) => {
      const id = curr.srNo || curr.id || String(idx);
      return newSelectedIds.has(id);
    });
    const srNos = selectedEntries
      .map((curr) => curr.srNo || curr.id)
      .filter(Boolean);
    const parchiStr = srNos.join(", ");
    onSelectReference(parchiStr, selectedEntries);
  };

  const toggleSelectAll = () => {
    let newSet = new Set<string>();
    if (!isAllSelected) {
      newSet = new Set(allRowIds);
    }
    setSelectedIds(newSet);
    notifySelectionChange(newSet);
  };

  const toggleSelectRow = (curr: any, idx: number) => {
    const id = curr.srNo || curr.id || String(idx);
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    notifySelectionChange(newSet);
  };

  const tabButtonBaseClass = "flex-1 flex items-center justify-center gap-2 py-2.5 text-[10.5px] font-black uppercase tracking-wider select-none cursor-pointer border-r border-border last:border-r-0 transition-all duration-150";
  const activeTabClass = "bg-primary text-white";
  const inactiveTabClass = "bg-white text-primary hover:bg-slate-50";
  const countBadgeClass = "px-1.5 py-0.5 rounded-full text-[8.5px] bg-slate-100 text-primary border border-primary/20 font-black min-w-[18px] text-center";
  const activeCountClass = "px-1.5 py-0.5 rounded-full text-[8.5px] bg-white/20 text-white font-black min-w-[18px] text-center";

  return (
    <div className="w-full h-full overflow-hidden flex flex-col rounded-lg border border-[var(--tbl-border-color,#cbd5e1)] bg-card shadow-xs">
      {/* Tabs Filter Bar */}
      <div className="border-b border-border bg-white dark:bg-slate-900">
        <div className="flex w-full">
          <button
            type="button"
            onClick={() => { setActiveTab("all"); setSelectedIds(new Set()); notifySelectionChange(new Set()); }}
            className={`${tabButtonBaseClass} ${activeTab === "all" ? activeTabClass : inactiveTabClass}`}
          >
            <span>All</span>
            <span className={activeTab === "all" ? activeCountClass : countBadgeClass}>{tabCounts.all}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("outstanding"); setSelectedIds(new Set()); notifySelectionChange(new Set()); }}
            className={`${tabButtonBaseClass} ${activeTab === "outstanding" ? activeTabClass : inactiveTabClass}`}
          >
            <span>Pending (Outstanding)</span>
            <span className={activeTab === "outstanding" ? activeCountClass : countBadgeClass}>{tabCounts.outstanding}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("running"); setSelectedIds(new Set()); notifySelectionChange(new Set()); }}
            className={`${tabButtonBaseClass} ${activeTab === "running" ? activeTabClass : inactiveTabClass}`}
          >
            <span>Running</span>
            <span className={activeTab === "running" ? activeCountClass : countBadgeClass}>{tabCounts.running}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("profitable"); setSelectedIds(new Set()); notifySelectionChange(new Set()); }}
            className={`${tabButtonBaseClass} ${activeTab === "profitable" ? activeTabClass : inactiveTabClass}`}
          >
            <span>Profitable</span>
            <span className={activeTab === "profitable" ? activeCountClass : countBadgeClass}>{tabCounts.profitable}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("paid"); setSelectedIds(new Set()); notifySelectionChange(new Set()); }}
            className={`${tabButtonBaseClass} ${activeTab === "paid" ? activeTabClass : inactiveTabClass}`}
          >
            <span>Paid</span>
            <span className={activeTab === "paid" ? activeCountClass : countBadgeClass}>{tabCounts.paid}</span>
          </button>
        </div>
      </div>
      {/* Premium Active Selection Summary Bar Removed */}

      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full relative">
        <table className="w-full text-[8.5px] border-separate border-spacing-0 table-fixed select-none leading-tight">
          <TableHeader className="sticky top-0 z-20">
            <TableRow 
              style={{
                backgroundColor: "var(--tbl-header-bg, #e2e8f0)",
                color: "var(--tbl-header-text, #1e293b)",
                borderColor: "var(--tbl-border-color, #cbd5e1)",
              }}
              className="border-b-2 font-extrabold uppercase whitespace-nowrap"
            >
              {/* Custom Header Selection Checkbox */}
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)" }} className="w-7 px-1 py-0.5 text-center">
                <div 
                  onClick={toggleSelectAll}
                  className={`mx-auto size-4 rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 ${
                    isAllSelected 
                      ? 'bg-amber-600 border-amber-600 text-white shadow-xs scale-105 ring-2 ring-amber-500/25' 
                      : isSomeSelected
                      ? 'bg-amber-100 border-amber-500 text-amber-700'
                      : 'bg-white/80 border-slate-400 hover:border-amber-500 text-transparent'
                  }`}
                  title={isAllSelected ? "Deselect All" : "Select All"}
                >
                  <Check className={`h-3 w-3 stroke-[3] transition-opacity duration-150 ${isAllSelected ? 'opacity-100' : isSomeSelected ? 'opacity-75' : 'opacity-0'}`} />
                </div>
              </TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[7.5px] whitespace-nowrap">SR/DATE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[7.5px] whitespace-nowrap">GROSS/TEIR</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[7.5px] whitespace-nowrap">FINAL</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[7.5px] whitespace-nowrap">NET/RATE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">BASE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">AFTER KARTA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">CD AMT</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">KANTA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">LABOURY</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">BRK.</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">TOT PAY</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">FINAL NET</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">EXTRA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">PAID</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">CD</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">OUTSTAND</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[7.5px] whitespace-nowrap">AFT CD OUT</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-center font-black text-[7.5px] whitespace-nowrap">ACT.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filteredSuppliers || filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={19} className="text-center py-8 text-[10px] text-muted-foreground italic">
                  No outstanding transactions found
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((curr, idx) => {
                const formattedDate = curr.date && isValid(new Date(curr.date)) ? format(new Date(curr.date), 'dd-MMM-yy') : (curr.date || '-');
                const isEven = idx % 2 === 0;
                const rowId = curr.srNo || curr.id || String(idx);
                const isSelected = selectedIds.has(rowId);

                const baseAmt = Number(curr.amount || 0);
                const kartaAmt = Number(curr.kartaAmount || 0);
                const afterKarta = baseAmt - kartaAmt;
                const cdAmt = Number(curr.cdAmount || curr.cd || 0);
                const kanta = Number(curr.kanta || 0);
                const laboury = Number(curr.labouryAmount || 0);
                const brokerage = Number(curr.brokerage || 0);
                const totalPay = baseAmt - laboury - kanta - kartaAmt;
                const finalNet = afterKarta - cdAmt - laboury - kanta;
                const extra = Number(curr.extraAmount || 0);
                const paid = Number(curr.totalPaidForEntry || curr.paid || 0);
                const cdPaid = Number(curr.totalCdForEntry || curr.cdPaid || 0);
                const outstand = Number(curr.outstandingForEntry ?? curr.netAmount ?? 0);
                const afterCdOutstand = finalNet - paid;

                return (
                  <TableRow 
                    key={rowId}
                    onClick={() => toggleSelectRow(curr, idx)}
                    style={{
                      backgroundColor: isSelected
                        ? "#fffbeb"
                        : isEven 
                        ? "var(--tbl-row-even-bg, #ffffff)" 
                        : "var(--tbl-row-odd-bg, #f8fafc)",
                    }}
                    className={`border-b transition-all duration-150 text-[9px] whitespace-nowrap cursor-pointer group ${
                      isSelected 
                        ? 'border-l-4 border-l-amber-500 font-semibold shadow-[inset_0_1px_3px_rgba(245,158,11,0.08)]' 
                        : 'hover:bg-[var(--tbl-row-hover-bg,#f1f5f9)]'
                    }`}
                  >
                    {/* Custom Row Checkbox Cell */}
                    <TableCell className="w-7 px-1 py-0.5 text-center" onClick={(e) => { e.stopPropagation(); toggleSelectRow(curr, idx); }}>
                      <div 
                        className={`mx-auto size-4 rounded-md border flex items-center justify-center transition-all duration-200 ${
                          isSelected 
                            ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-600 text-white shadow-xs scale-110 ring-2 ring-amber-400/30' 
                            : 'bg-white border-slate-300 group-hover:border-amber-400 text-transparent hover:scale-105'
                        }`}
                      >
                        <Check className={`h-3 w-3 stroke-[3] transition-opacity duration-150 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                      </div>
                    </TableCell>

                    <TableCell className="px-1.5 py-1 font-bold text-slate-900">
                      <div className={`flex items-center gap-1 ${isSelected ? 'text-amber-950 font-black' : ''}`}>
                        {isSelected && <BookmarkCheck className="h-3 w-3 text-amber-600 shrink-0" />}
                        <span>{curr.srNo || curr.id}</span>
                      </div>
                      <div className="text-[8px] text-slate-500">{formattedDate}</div>
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-slate-700">
                      <div>G:{formatDec(curr.grossWeight || curr.grossWt)}</div>
                      <div className="text-[8px] text-slate-500">T:{formatDec(curr.teirWeight || curr.teirWt)}</div>
                    </TableCell>
                    <TableCell className="px-1.5 py-1 font-semibold text-slate-900">
                      {formatDec(curr.weight || curr.finalWeight)}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-slate-700">
                      <div>{formatDec(curr.netWeight)}</div>
                      <div className="text-[8px] text-amber-700 font-semibold">@{formatDec(curr.rate)}</div>
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-semibold text-slate-800">{formatCurrency(baseAmt)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-semibold text-blue-700">{formatCurrency(afterKarta)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-semibold text-amber-700">{cdAmt > 0 ? formatCurrency(cdAmt) : '-'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right text-slate-700">{kanta > 0 ? `₹${formatDec(kanta)}` : '₹0'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right text-slate-700">{laboury > 0 ? `₹${formatDec(laboury)}` : '₹0'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right text-slate-700">{brokerage > 0 ? `₹${formatDec(brokerage)}` : '₹0'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-bold text-slate-900">{formatCurrency(totalPay)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-bold text-emerald-700">{formatCurrency(finalNet)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right text-slate-700">{extra !== 0 ? formatCurrency(extra) : '-'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-bold text-red-600">-{formatCurrency(paid)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right text-emerald-700">{cdPaid > 0 ? `-${formatCurrency(cdPaid)}` : '₹0'}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-black text-slate-900">{formatCurrency(outstand)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-black text-amber-800">{formatCurrency(afterCdOutstand)}</TableCell>
                    <TableCell className="px-1.5 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {onEditEntry && (
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-slate-600 hover:text-amber-700" onClick={() => onEditEntry(curr)} title="Edit">
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        )}
                        {onShowDetails && (
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-slate-600 hover:text-blue-700" onClick={() => onShowDetails(curr)} title="Details">
                            <Info className="h-2.5 w-2.5" />
                          </Button>
                        )}
                        {onPrintRow && (
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-slate-600 hover:text-purple-700" onClick={() => onPrintRow(curr)} title="Print">
                            <FileText className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>

          {/* Sticky Table Total Footer for all numeric columns */}
          {filteredSuppliers && filteredSuppliers.length > 0 && (
            <TableFooter className="sticky bottom-0 z-20 shadow-md">
              <TableRow className="text-white font-extrabold text-[8.5px] whitespace-nowrap hover:bg-transparent">
                <TableCell className="sticky bottom-0 z-20 w-7 px-1 py-1 text-center bg-primary text-white font-bold border-t border-slate-700/50">
                  Σ
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-left font-black text-white uppercase tracking-tight bg-primary border-t border-slate-700/50">
                  <div>TOTAL</div>
                  <div className="text-[7.5px] text-slate-200 font-normal">
                    {calculatedTotals.isSelectedOnly ? `(${calculatedTotals.count} SEL)` : `(${calculatedTotals.count} ROWS)`}
                  </div>
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-slate-100 bg-primary border-t border-slate-700/50">
                  <div>G:{formatDec(calculatedTotals.grossWt)}</div>
                  <div className="text-[7.5px] text-slate-300">T:{formatDec(calculatedTotals.teirWt)}</div>
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 font-bold text-white bg-primary border-t border-slate-700/50">
                  {formatDec(calculatedTotals.finalWt)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-white bg-primary font-semibold border-t border-slate-700/50">
                  {formatDec(calculatedTotals.netWt)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-bold text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.baseAmt)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-bold text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.afterKarta)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-semibold text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.cdAmt > 0 ? formatCurrency(calculatedTotals.cdAmt) : '-'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.kanta > 0 ? `₹${formatDec(calculatedTotals.kanta)}` : '₹0'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.laboury > 0 ? `₹${formatDec(calculatedTotals.laboury)}` : '₹0'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.brokerage > 0 ? `₹${formatDec(calculatedTotals.brokerage)}` : '₹0'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-extrabold text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.totalPay)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-black text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.finalNet)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.extra !== 0 ? formatCurrency(calculatedTotals.extra) : '-'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-bold text-white bg-primary border-t border-slate-700/50">
                  -{formatCurrency(calculatedTotals.paid)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right text-white bg-primary border-t border-slate-700/50">
                  {calculatedTotals.cdPaid > 0 ? `-${formatCurrency(calculatedTotals.cdPaid)}` : '₹0'}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-black text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.outstand)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-right font-black text-white bg-primary border-t border-slate-700/50">
                  {formatCurrency(calculatedTotals.afterCdOutstand)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 px-1.5 py-1 text-center text-white bg-primary border-t border-slate-700/50">
                  -
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </table>
      </div>
    </div>
  );
}



"use client";

import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, FileText, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, isValid } from "date-fns";

interface OutstandingTransactionsTableProps {
  suppliers: any[];
  onShowDetails?: (entry: any) => void;
  onEditEntry?: (entry: any) => void;
  onPrintRow?: (entry: any) => void;
  type?: 'supplier' | 'customer' | 'outsider';
}

const formatDec = (val: any) => {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
};

export function OutstandingTransactionsTable({ suppliers, onShowDetails, onEditEntry, onPrintRow, type = 'supplier' }: OutstandingTransactionsTableProps) {
  const isSupplier = type === 'supplier';

  return (
    <div className="w-full h-full overflow-hidden flex flex-col rounded-lg border border-[var(--tbl-border-color,#cbd5e1)] bg-card shadow-xs">
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
        <Table className="w-full text-[8.5px] border-collapse table-fixed">
          <TableHeader className="sticky top-0 z-20">
            <TableRow 
              style={{
                backgroundColor: "var(--tbl-header-bg, #e2e8f0)",
                color: "var(--tbl-header-text, #1e293b)",
                borderColor: "var(--tbl-border-color, #cbd5e1)",
              }}
              className="border-b-2 font-extrabold uppercase whitespace-nowrap"
            >
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[8px] truncate">SR/DATE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[8px] truncate">GROSS/TEIR</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[8px] truncate">FINAL</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-left font-black text-[8px] truncate">NET/RATE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">BASE</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">AFTER KARTA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">CD AMT</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">KANTA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">LABOURY</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">BRK.</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">TOT PAY</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">FINAL NET</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">EXTRA</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">PAID</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">CD</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">OUTSTAND</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-right font-black text-[8px] truncate">AFT CD OUT</TableHead>
              <TableHead style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }} className="px-0.5 py-0.5 text-center font-black text-[8px] truncate">ACT.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!suppliers || suppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={18} className="text-center py-8 text-[10px] text-muted-foreground italic">
                  No outstanding transactions found
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((curr, idx) => {
                const formattedDate = curr.date && isValid(new Date(curr.date)) ? format(new Date(curr.date), 'dd-MMM-yy') : (curr.date || '-');
                const isEven = idx % 2 === 0;

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
                    key={curr.id || curr.srNo || idx}
                    style={{
                      backgroundColor: isEven 
                        ? "var(--tbl-row-even-bg, #ffffff)" 
                        : "var(--tbl-row-odd-bg, #f8fafc)",
                      borderColor: "var(--tbl-border-color, #e2e8f0)",
                    }}
                    className="border-b transition-colors hover:bg-[var(--tbl-row-hover-bg,#f1f5f9)] text-[9px] whitespace-nowrap"
                  >
                    <TableCell className="px-1.5 py-1 font-bold text-slate-900">
                      <div>{curr.srNo || curr.id}</div>
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
                    <TableCell className="px-1.5 py-1 text-center">
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
        </Table>
      </div>
    </div>
  );
}

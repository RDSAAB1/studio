"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { Payment } from "@/lib/definitions";

interface RtgsOutsiderTableProps {
  payments: Payment[];
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
}

export function RtgsOutsiderTable({ payments, onEdit, onDelete }: RtgsOutsiderTableProps) {
  const sortedPayments = React.useMemo(() => {
    if (!Array.isArray(payments)) return [];
    return [...payments].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [payments]);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col rounded-md border border-[var(--tbl-border-color,#cbd5e1)] bg-card">
      <div className="flex-1 overflow-auto">
        <Table className="w-full text-[10px] border-collapse">
          <TableHeader className="sticky top-0 z-20">
            <TableRow 
              style={{
                backgroundColor: "var(--tbl-header-bg, #e2e8f0)",
                color: "var(--tbl-header-text, #1e293b)",
                borderColor: "var(--tbl-border-color, #cbd5e1)",
              }}
              className="border-b-2 font-extrabold uppercase"
            >
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[8%]"
              >
                ID
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[10%]"
              >
                Date
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[14%]"
              >
                Holder
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[16%]"
              >
                Bank / IFSC
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[8%]"
              >
                Check
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-left font-black text-[10px] w-[20%]"
              >
                Paid For
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-right font-black text-[10px] w-[10%]"
              >
                Paid
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-right font-black text-[10px] w-[8%]"
              >
                CD
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-2 py-1 text-center font-black text-[10px] w-[6%]"
              >
                Act.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-6 text-[10px] text-muted-foreground italic">
                  No RTGS outsider payments found
                </TableCell>
              </TableRow>
            ) : (
              sortedPayments.map((p, idx) => {
                const formattedDate = p.date && isValid(new Date(p.date)) ? format(new Date(p.date), 'dd-MMM-yyyy') : (p.date || '-');
                const isEven = idx % 2 === 0;
                
                return (
                  <TableRow 
                    key={p.id || p.paymentId || idx}
                    style={{
                      backgroundColor: isEven 
                        ? "var(--tbl-row-even-bg, #ffffff)" 
                        : "var(--tbl-row-odd-bg, #f8fafc)",
                      borderColor: "var(--tbl-border-color, #e2e8f0)",
                    }}
                    className="border-b transition-colors hover:bg-[var(--tbl-row-hover-bg,#f1f5f9)]"
                  >
                    <TableCell className="px-2 py-1 font-bold text-slate-800">
                      {p.paymentId || p.rtgsSrNo || p.id}
                    </TableCell>
                    <TableCell className="px-2 py-1 font-medium text-slate-700 whitespace-nowrap">
                      {formattedDate}
                    </TableCell>
                    <TableCell className="px-2 py-1 font-semibold text-slate-900">
                      {p.supplierName || (p as any).supplierDetails?.name || (p as any).accountHolderName || '-'}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-slate-700">
                      <div className="font-semibold text-slate-900">{p.bank || (p as any).bankName || '-'}</div>
                      <div className="text-[9px] text-slate-500 font-mono">{p.ifscCode || '-'}</div>
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono text-slate-800">
                      {p.checkNo || (p as any).checkNumber || '-'}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-slate-700 max-w-[150px] truncate" title={(p as any).paidFor || p.parchiNo || '-'}>
                      {(p as any).paidFor || p.parchiNo || '-'}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-black text-slate-900">
                      {formatCurrency(Number(p.amount) || 0)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-semibold text-slate-700">
                      {formatCurrency(Number((p as any).cdAmount) || 0)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => onEdit(p)}
                            title="Edit Payment"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDelete(p)}
                            title="Delete Payment"
                          >
                            <Trash2 className="h-3 w-3" />
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

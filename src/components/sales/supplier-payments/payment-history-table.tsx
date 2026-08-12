"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { Payment } from "@/lib/definitions";

interface PaymentHistoryTableProps {
  payments: Payment[];
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
}

export function PaymentHistoryTable({ payments, onEdit, onDelete }: PaymentHistoryTableProps) {
  const sortedPayments = React.useMemo(() => {
    if (!Array.isArray(payments)) return [];
    return [...payments].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [payments]);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col rounded-lg border border-[var(--tbl-border-color,#cbd5e1)] bg-card shadow-xs">
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full">
        <Table className="w-full text-[10px] border-collapse table-fixed">
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
                className="px-1 py-1 text-left font-black text-[9px] w-[10%] whitespace-nowrap"
              >
                ID
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-left font-black text-[9px] w-[12%] whitespace-nowrap"
              >
                Date
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-left font-black text-[9px] w-[24%] whitespace-nowrap"
              >
                Account Holder
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-left font-black text-[9px] w-[20%] whitespace-nowrap"
              >
                Paid For
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-right font-black text-[9px] w-[9%] whitespace-nowrap"
              >
                Extra
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-right font-black text-[9px] w-[13%] whitespace-nowrap"
              >
                Paid
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-right font-black text-[9px] w-[6%] whitespace-nowrap"
              >
                CD
              </TableHead>
              <TableHead 
                style={{ backgroundColor: "var(--tbl-header-bg, #e2e8f0)", color: "var(--tbl-header-text, #1e293b)" }}
                className="px-1 py-1 text-center font-black text-[9px] w-[6%] whitespace-nowrap"
              >
                Act.
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-[10px] text-muted-foreground italic">
                  No payment history found
                </TableCell>
              </TableRow>
            ) : (
              sortedPayments.map((p, idx) => {
                const formattedDate = p.date && isValid(new Date(p.date)) ? format(new Date(p.date), 'dd-MMM-yy') : (p.date || '-');
                const isEven = idx % 2 === 0;
                const paidForText = Array.isArray(p.paidFor) 
                  ? p.paidFor.map((pf: any) => pf.parchiNo || pf.srNo || pf.id).filter(Boolean).join(', ')
                  : (p.parchiNo || '-');

                return (
                  <TableRow 
                    key={p.id || p.paymentId || idx}
                    style={{
                      backgroundColor: isEven 
                        ? "var(--tbl-row-even-bg, #ffffff)" 
                        : "var(--tbl-row-odd-bg, #f8fafc)",
                      borderColor: "var(--tbl-border-color, #e2e8f0)",
                    }}
                    className="border-b transition-colors hover:bg-[var(--tbl-row-hover-bg,#f1f5f9)] text-[10px]"
                  >
                    <TableCell className="px-1.5 py-1 font-bold text-slate-800 font-mono truncate">
                      {p.paymentId || p.id}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 font-medium text-slate-700 whitespace-nowrap">
                      {formattedDate}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 font-bold text-slate-900 truncate" title={p.supplierName || (p as any).supplierDetails?.name || (p as any).accountHolderName || '-'}>
                      {p.supplierName || (p as any).supplierDetails?.name || (p as any).accountHolderName || '-'}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-slate-700 truncate" title={paidForText}>
                      {paidForText}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-medium text-slate-700">
                      {Number((p as any).extraAmount || 0) > 0 ? formatCurrency(Number((p as any).extraAmount)) : '-'}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-semibold text-emerald-600">
                      {formatCurrency(Number(p.amount) || 0)}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-right font-semibold text-slate-700">
                      {Number((p as any).cdAmount || p.cd || 0) > 0 ? formatCurrency(Number((p as any).cdAmount || p.cd)) : '-'}
                    </TableCell>
                    <TableCell className="px-1.5 py-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-slate-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => onEdit(p)}
                            title="Edit"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 text-slate-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDelete(p)}
                            title="Delete"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
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

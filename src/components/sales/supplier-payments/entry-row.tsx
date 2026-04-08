"use client";

import React from "react";
import { format, isValid } from "date-fns";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Pencil, Info, ChevronUp, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TransactionRowProps {
  entry: any;
  selectedIds: Set<string>;
  handleRowSelect: (id: string) => void;
  rowHeightClass: string;
  isHighlighted: boolean;
  checkboxClass: string;
  entrySrClass: string;
  entryMetaClass: string;
  amountMainClass: string;
  amountSubClass: string;
  outstandingTextClass: string;
  isCustomer: boolean;
  paymentBreakdown: any[];
  shouldShowBreakdown: boolean;
  toggleExpanded: (id: string) => void;
  onEditEntry?: (entry: any) => void;
  onShowDetails: (entry: any) => void;
  actionBtnClass?: string;
  actionIconClass?: string;
}

export const TransactionRow = React.memo(({
  entry,
  selectedIds,
  handleRowSelect,
  rowHeightClass,
  isHighlighted,
  checkboxClass,
  entrySrClass,
  entryMetaClass,
  amountMainClass,
  amountSubClass,
  outstandingTextClass,
  isCustomer,
  paymentBreakdown,
  shouldShowBreakdown,
  toggleExpanded,
  onEditEntry,
  onShowDetails,
  actionBtnClass,
  actionIconClass
}: TransactionRowProps) => {
  const outstanding = Number(entry.outstandingForEntry ?? entry.netAmount ?? 0);
  const hasOutstanding = outstanding > 0.01;
  const isNegative = outstanding < -0.01;
  const entryKey = String(entry.id || entry.srNo);

  return (
    <TableRow
      id={`transaction-row-${entry.id}`}
      data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
      className={`${rowHeightClass} border-b border-slate-200/70 text-slate-900 odd:bg-slate-50/60 hover:bg-violet-50/60 transition-colors ${
        selectedIds?.has(entry.id) ? 'bg-violet-100/40' : ''
      } ${isHighlighted ? 'bg-violet-100/60 ring-2 ring-violet-500/40' : ''}`}
    >
      <TableCell className="py-0 px-1 align-middle">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={selectedIds?.has(entry.id)}
            onCheckedChange={() => handleRowSelect(entry.id)}
            className={checkboxClass}
          />
        </div>
      </TableCell>
      <TableCell className="py-0 px-1.5 align-middle">
        <div className={`font-mono ${entrySrClass} font-bold leading-tight`}>{entry.srNo}</div>
      </TableCell>
      <TableCell className="py-0 px-1.5 align-middle">
        <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight`}>
          {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountMainClass} font-bold leading-tight text-slate-900`}>
          {formatCurrency(
            entry.adjustedOriginal !== undefined
              ? entry.adjustedOriginal
              : entry.originalNetAmount
          )}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
          {(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry) !== 0
            ? formatCurrency(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry)
            : '-'}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountMainClass} font-semibold leading-tight text-rose-700`}>
          - {formatCurrency(entry.totalPaidForEntry || entry.totalPaid || 0)}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountSubClass} font-semibold leading-tight text-rose-700`}>
          - {formatCurrency(entry.totalCdForEntry || entry.totalCd || 0)}
        </div>
      </TableCell>
      <TableCell
        className={`text-right px-2 py-0 ${outstandingTextClass} font-extrabold align-middle rounded-md ${
          isNegative
            ? 'text-rose-700 bg-rose-500/10 border border-rose-500/20'
            : hasOutstanding
              ? 'text-emerald-700 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-slate-500 bg-slate-500/5 border border-slate-200/70'
        }`}
      >
        {formatCurrency(outstanding)}
      </TableCell>
      {isCustomer && (
        <TableCell className="text-right py-0 px-1.5 align-middle">
          <div className={`${amountSubClass} font-semibold leading-tight ${Number(entry.advanceFreight || 0) > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            {Number(entry.advanceFreight || 0) > 0 ? formatCurrency(Number(entry.advanceFreight)) : '-'}
          </div>
        </TableCell>
      )}
      <TableCell className="text-center py-0 px-1 align-middle">
        <div className="flex items-center justify-center gap-1">
          {paymentBreakdown.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className={`${actionBtnClass || "h-4 w-4"} hover:bg-primary/10 hover:text-primary`}
              onClick={() => toggleExpanded(entryKey)}
              title={shouldShowBreakdown ? "Hide Payments" : "Show Payments"}
            >
              {shouldShowBreakdown ? (
                <ChevronUp className={actionIconClass || "h-2.5 w-2.5"} />
              ) : (
                <ChevronDown className={actionIconClass || "h-2.5 w-2.5"} />
              )}
            </Button>
          )}
          {onEditEntry && (
            <Button 
                variant="ghost" 
                size="icon" 
                className={`${actionBtnClass || "h-4 w-4"} hover:bg-primary/10 hover:text-primary`} 
                onClick={() => onEditEntry(entry)}
                title="Edit Entry"
            >
                <Pencil className={actionIconClass || "h-2.5 w-2.5"} />
            </Button>
          )}
          <Button 
              variant="ghost" 
              size="icon" 
              className={`${actionBtnClass || "h-4 w-4"} hover:bg-primary/10 hover:text-primary`} 
              onClick={() => onShowDetails(entry)} 
              title="View Details"
          >
              <Info className={actionIconClass || "h-2.5 w-2.5"} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

TransactionRow.displayName = "TransactionRow";

interface PaymentBreakdownRowProps {
  payment: any;
  idx: number;
  entryMetaClass: string;
  amountMainClass: string;
  amountSubClass: string;
  outstandingTextClass: string;
  compact: boolean;
}

export const PaymentBreakdownRow = React.memo(({
  payment,
  idx,
  entryMetaClass,
  amountMainClass,
  amountSubClass,
  outstandingTextClass,
  compact
}: PaymentBreakdownRowProps) => {
  const paymentDate = payment.date && isValid(new Date(payment.date))
    ? format(new Date(payment.date), "dd-MMM-yy")
    : 'N/A';

  return (
    <TableRow key={`payment-${idx}`} className="bg-slate-50/60">
      <TableCell className="py-0 px-1 align-middle" />
      <TableCell className="py-0 px-1.5 align-middle">
        <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight ${compact ? "text-[8px]" : "text-[9px]"}`}>
          Payment: {payment.paymentId || 'N/A'}
          {payment.receiptType ? ` (${payment.receiptType})` : ''}
        </div>
      </TableCell>
      <TableCell className="py-0 px-1.5 align-middle">
        <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight ${compact ? "text-[8px]" : "text-[9px]"}`}>
          {paymentDate}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountMainClass} font-bold leading-tight text-slate-400`}>-</div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountSubClass} font-semibold leading-tight text-slate-400`}>-</div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
          {formatCurrency(payment.amount || 0)}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
          {formatCurrency(payment.cdAmount || 0)}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-2 align-middle">
        <div className={`${outstandingTextClass} font-extrabold leading-tight text-slate-400`}>-</div>
      </TableCell>
      <TableCell className="text-center py-0 px-1 align-middle" />
    </TableRow>
  );
});

PaymentBreakdownRow.displayName = "PaymentBreakdownRow";

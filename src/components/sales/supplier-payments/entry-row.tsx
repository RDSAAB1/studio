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
  isDetailed: boolean;
  paymentBreakdown: any[];
  shouldShowBreakdown: boolean;
  toggleExpanded: (id: string) => void;
  onEditEntry?: (entry: any) => void;
  onShowDetails: (entry: any) => void;
  actionBtnClass?: string;
  actionIconClass?: string;
  type?: 'supplier' | 'customer' | 'outsider';
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
  isDetailed,
  paymentBreakdown,
  shouldShowBreakdown,
  toggleExpanded,
  onEditEntry,
  onShowDetails,
  actionBtnClass,
  actionIconClass,
  type
}: TransactionRowProps) => {
  const outstanding = Number(entry.outstandingForEntry ?? entry.netAmount ?? 0);
  const hasOutstanding = outstanding > 0.01;
  const isNegative = outstanding < -0.01;
  const entryKey = String(entry.id || entry.srNo);

  const avgBagWt = entry.weight && entry.bags ? (entry.weight / entry.bags) * 100 : 0;
  const totalBagWtQtl = (Number(entry.bags || 0) * Number(entry.bagWeightKg || 0)) / 100;
  const totalReceivable = (Number(entry.originalNetAmount) || 0) + (Number(entry.advanceFreight) || 0);

  if (isDetailed) {
    const isSupplier = type === 'supplier';
    return (
      <TableRow
        id={`transaction-row-${entry.id}`}
        data-state={selectedIds?.has(entry.id) ? 'selected' : ''}
        className={`border-b border-slate-200/70 text-slate-900 odd:bg-slate-50/60 hover:bg-violet-50/60 transition-colors ${
          selectedIds?.has(entry.id) ? 'bg-violet-100/40' : ''
        } ${isHighlighted ? 'bg-violet-100/60 ring-2 ring-violet-500/40' : ''}`}
      >
        <TableCell className="py-1 px-1 align-middle text-center">
          <Checkbox
            checked={selectedIds?.has(entry.id)}
            onCheckedChange={() => handleRowSelect(entry.id)}
            className={checkboxClass}
          />
        </TableCell>
        <TableCell className="py-1 px-1.5 align-middle">
          <div className="flex flex-col">
            <span className={`font-mono ${entrySrClass} font-bold`}>{entry.srNo}</span>
            <span className={`${entryMetaClass} text-muted-foreground font-medium`}>
              {entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-1 px-1.5 align-middle">
          <div className="flex flex-col">
            <span className={`${entryMetaClass} font-bold`}>G:{Number(entry.grossWeight || entry.grossWt || 0).toFixed(1)}</span>
            <span className={`${entryMetaClass} text-muted-foreground`}>T:{Number(entry.teirWeight || entry.teirWt || 0).toFixed(1)}</span>
          </div>
        </TableCell>
        <TableCell className="py-1 px-1.5 align-middle">
          <div className="flex flex-col">
            <span className={`${entryMetaClass} font-bold`}>{Number(entry.weight || 0).toFixed(1)}</span>
            <span className={`${entryMetaClass} text-rose-600`}>
              {isSupplier ? `K:${Number(entry.kartaWeight || 0).toFixed(2)}` : `${Number(entry.kartaWeight || 0).toFixed(2)} / ${totalBagWtQtl.toFixed(2)}`}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-1 px-1.5 align-middle">
          <div className="flex flex-col">
            <span className={`${entryMetaClass} font-bold`}>{Number(entry.netWeight || 0).toFixed(2)}</span>
            <span className={`${entryMetaClass} text-primary font-bold`}>@ {formatCurrency(entry.rate || 0)}</span>
          </div>
        </TableCell>
        {!isSupplier && (
          <TableCell className="py-1 px-1.5 align-middle">
            <div className="flex flex-col">
              <span className={`${entryMetaClass} font-bold`}>{entry.bags || 0}</span>
              <span className={`${entryMetaClass} text-muted-foreground`}>{avgBagWt.toFixed(2)}kg</span>
            </div>
          </TableCell>
        )}
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <span className={`${amountMainClass} font-bold`}>{formatCurrency(entry.amount || 0)}</span>
        </TableCell>
        {isSupplier ? (
          <>
            <TableCell className="py-1 px-1.5 text-right align-middle">
              <span className={`${entryMetaClass} font-bold`}>{formatCurrency(entry.kanta || 0)}</span>
            </TableCell>
            <TableCell className="py-1 px-1.5 text-right align-middle">
              <span className={`${entryMetaClass} font-bold`}>{formatCurrency(entry.labouryAmount || 0)}</span>
            </TableCell>
          </>
        ) : (
          <TableCell className="py-1 px-1.5 text-right align-middle">
            <div className="flex flex-col">
              <span className={`${entryMetaClass} text-rose-600 font-bold`}>B:-{formatCurrency(entry.bagWeightDeductionAmount || 0)}</span>
              <span className={`${entryMetaClass} text-rose-600 font-bold`}>K:-{formatCurrency(entry.kartaAmount || 0)}</span>
            </div>
          </TableCell>
        )}
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <div className="flex flex-col">
            <span className={`${amountMainClass} font-bold text-primary`}>{formatCurrency(entry.finalAmount || 0)}</span>
            <span className={`${entryMetaClass} text-slate-500`}>
              B:-{formatCurrency(entry.brokerage || 0)} C:-{formatCurrency(entry.cd || 0)}
            </span>
          </div>
        </TableCell>
        {!isSupplier && (
          <TableCell className="py-1 px-1.5 text-right align-middle">
            <span className={`${entryMetaClass} font-bold`}>+ {formatCurrency(entry.transportAmount || 0)}</span>
          </TableCell>
        )}
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <div className="flex flex-col">
            <span className={`${amountMainClass} font-black text-slate-900`}>{formatCurrency(totalReceivable)}</span>
          </div>
        </TableCell>
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <div className={`${entryMetaClass} font-semibold text-slate-600`}>
            {(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry ?? 0) !== 0
              ? `${type === 'customer' ? '-' : ''}${formatCurrency(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry)}`
              : '-'}
          </div>
        </TableCell>
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <div className="flex flex-col">
            <span className={`${amountMainClass} font-bold ${type === 'customer' ? 'text-emerald-700' : 'text-rose-700'}`}>
              {type === 'customer' ? '' : '- '}{formatCurrency(entry.totalPaidForEntry || 0)}
            </span>
          </div>
        </TableCell>
        {type === 'customer' && (
          <TableCell className="py-1 px-1.5 text-right align-middle">
            <div className="flex flex-col text-[10px] font-extrabold leading-tight">
              {(entry.ledgerCreditForEntry || 0) > 0 && (
                <span className="text-emerald-600">Cr: -{formatCurrency(entry.ledgerCreditForEntry)}</span>
              )}
              {(entry.ledgerDebitForEntry || 0) > 0 && (
                <span className="text-rose-600">Dr: +{formatCurrency(entry.ledgerDebitForEntry)}</span>
              )}
              {!(entry.ledgerCreditForEntry || 0) && !(entry.ledgerDebitForEntry || 0) && (
                <span className="text-slate-400 font-medium">-</span>
              )}
            </div>
          </TableCell>
        )}
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <span className={`${entryMetaClass} font-bold text-rose-600`}>- {formatCurrency(entry.totalCdForEntry || 0)}</span>
        </TableCell>
        <TableCell className="py-1 px-1.5 text-right align-middle">
          <div className="flex flex-col">
            <span className={`${outstandingTextClass} font-black ${hasOutstanding ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-500'}`}>
              {formatCurrency(outstanding)}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-center py-1 px-1 align-middle">
          <div className="flex items-center justify-center gap-1">
            {paymentBreakdown.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={`${actionBtnClass || "h-4 w-4"} hover:bg-primary/10 hover:text-primary`}
                onClick={() => toggleExpanded(entryKey)}
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
              >
                  <Pencil className={actionIconClass || "h-2.5 w-2.5"} />
              </Button>
            )}
            <Button 
                variant="ghost" 
                size="icon" 
                className={`${actionBtnClass || "h-4 w-4"} hover:bg-primary/10 hover:text-primary`} 
                onClick={() => onShowDetails(entry)} 
            >
                <Info className={actionIconClass || "h-2.5 w-2.5"} />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

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
            ? `${type === 'customer' ? '-' : ''}${formatCurrency(entry.totalExtraForEntry ?? entry.totalGovExtraForEntry)}`
            : '-'}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className="flex flex-col items-end">
          <div className={`${amountMainClass} font-semibold leading-tight ${type === 'customer' ? 'text-emerald-700' : 'text-rose-700'}`}>
            {type === 'customer' ? '' : '- '}{formatCurrency(entry.totalPaidForEntry || entry.totalPaid || 0)}
          </div>
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
  isDetailed?: boolean;
  type?: 'supplier' | 'customer' | 'outsider';
}

export const PaymentBreakdownRow = React.memo(({
  payment,
  idx,
  entryMetaClass,
  amountMainClass,
  amountSubClass,
  outstandingTextClass,
  compact,
  isDetailed = false,
  type
}: PaymentBreakdownRowProps) => {
  const paymentDate = payment.date && isValid(new Date(payment.date))
    ? format(new Date(payment.date), "dd-MMM-yy")
    : 'N/A';

  if (isDetailed) {
    const isCustomer = type === 'customer';
    if (isCustomer) {
      return (
        <TableRow key={`payment-${idx}`} className="bg-slate-50/60">
          <TableCell className="py-0 px-1 align-middle" /> {/* 1 */}
          <TableCell className="py-0 px-1.5 align-middle"> {/* 2 */}
            <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight text-[10px]`}>
              {payment.paymentId || 'N/A'} {payment.receiptType ? `(${payment.receiptType})` : ''}
            </div>
          </TableCell>
          <TableCell className="py-0 px-1.5 align-middle"> {/* 3 */}
            <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight text-[10px]`}>
              {paymentDate}
            </div>
          </TableCell>
          <TableCell colSpan={9} className="py-0 px-1.5 align-middle" /> {/* 4-12 (Colspan 9) */}
          <TableCell className="text-right py-0 px-1.5 align-middle"> {/* 13: Received */}
            <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
              {formatCurrency(payment.shareAmount !== undefined ? payment.shareAmount : (payment.amount || 0))}
            </div>
          </TableCell>
          <TableCell className="text-right py-0 px-1.5 align-middle"> {/* 14: Ledger Impact */}
            <span className="text-slate-400 font-medium">-</span>
          </TableCell>
          <TableCell className="text-right py-0 px-1.5 align-middle"> {/* 15: CD */}
            <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
              {formatCurrency(payment.shareCd !== undefined ? payment.shareCd : (payment.cdAmount || 0))}
            </div>
          </TableCell>
          <TableCell className="text-right py-0 px-2 align-middle" /> {/* 16: Outstanding */}
          <TableCell className="text-center py-0 px-1 align-middle" /> {/* 17: Actions */}
        </TableRow>
      );
    } else {
      return (
        <TableRow key={`payment-${idx}`} className="bg-slate-50/60">
          <TableCell className="py-0 px-1 align-middle" /> {/* 1 */}
          <TableCell className="py-0 px-1.5 align-middle"> {/* 2 */}
            <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight text-[10px]`}>
              {payment.paymentId || 'N/A'} {payment.receiptType ? `(${payment.receiptType})` : ''}
            </div>
          </TableCell>
          <TableCell className="py-0 px-1.5 align-middle"> {/* 3 */}
            <div className={`${entryMetaClass} text-muted-foreground font-medium leading-tight text-[10px]`}>
              {paymentDate}
            </div>
          </TableCell>
          <TableCell colSpan={8} className="py-0 px-1.5 align-middle" /> {/* 4-11 (Colspan 8) */}
          <TableCell className="text-right py-0 px-1.5 align-middle"> {/* 12: Paid */}
            <div className={`${amountMainClass} font-semibold leading-tight text-slate-900`}>
              {formatCurrency(payment.shareAmount !== undefined ? payment.shareAmount : (payment.amount || 0))}
            </div>
          </TableCell>
          <TableCell className="text-right py-0 px-1.5 align-middle"> {/* 13: CD */}
            <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
              {formatCurrency(payment.shareCd !== undefined ? payment.shareCd : (payment.cdAmount || 0))}
            </div>
          </TableCell>
          <TableCell className="text-right py-0 px-2 align-middle" /> {/* 14: Outstanding */}
          <TableCell className="text-center py-0 px-1 align-middle" /> {/* 15: Actions */}
        </TableRow>
      );
    }
  }

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
          {formatCurrency(payment.shareAmount !== undefined ? payment.shareAmount : (payment.amount || 0))}
        </div>
      </TableCell>
      <TableCell className="text-right py-0 px-1.5 align-middle">
        <div className={`${amountSubClass} font-semibold leading-tight text-slate-600`}>
          {formatCurrency(payment.shareCd !== undefined ? payment.shareCd : (payment.cdAmount || 0))}
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

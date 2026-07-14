"use client";

import { TableHead, TableRow, TableHeader, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortKey, SortDirection } from "./hooks/use-transaction-management";
import { cn } from "@/lib/utils";

interface TransactionTableHeaderProps {
  selectedIdsSize: number;
  totalFilteredSize: number;
  handleSelectAll: (checked: boolean) => void;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  requestSort: (key: SortKey) => void;
  isDetailed: boolean;
  compact: boolean;
  headTextClass: string;
  checkboxClass: string;
  type?: 'supplier' | 'customer' | 'outsider';
}

export function TransactionTableHeader({
  selectedIdsSize,
  totalFilteredSize,
  handleSelectAll,
  sortKey,
  sortDirection,
  requestSort,
  isDetailed,
  compact,
  headTextClass,
  checkboxClass,
  type
}: TransactionTableHeaderProps) {
  const headSortButtonClass = `flex w-full items-center gap-1.5 hover:text-primary transition-colors py-1`;
  const headCellBaseClass = `${headTextClass} font-extrabold`;

  const SortIndicator = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 opacity-80" />
    ) : (
      <ArrowDown className="h-3 w-3 opacity-80" />
    );
  };

  if (isDetailed) {
    const isSupplier = type === 'supplier';
    return (
      <TableHeader className="table-header-compact z-40 sticky top-0 shadow-md">
        {/* Main Header Row */}
        <TableRow className="bg-primary !bg-primary border-b border-primary-foreground/20">
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} align-middle text-center w-[30px] !text-primary-foreground sticky top-0 bg-primary z-50`}>
            <Checkbox
              checked={selectedIdsSize > 0 && selectedIdsSize === totalFilteredSize}
              onCheckedChange={handleSelectAll}
              className={`${checkboxClass} border-primary-foreground/50`}
            />
          </TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[72px] !text-primary-foreground sticky top-0 bg-primary z-50`}>SR No/Date</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[68px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Gross/Teir</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>
            {isSupplier ? 'Final' : 'Final/Bag'}
          </TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[72px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Net Wt/Rate</TableHead>
          {!isSupplier && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[62px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Bags/Avg</TableHead>
          )}
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Base Amt</TableHead>
          {isSupplier ? (
            <>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>After Karta</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[60px] !text-primary-foreground sticky top-0 bg-primary z-50`}>CD Amt</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[55px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Kanta</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[55px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Laboury</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[70px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Brokerage</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Total Pay.</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[85px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Final Net</TableHead>
            </>
          ) : (
            <>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Bag Ded</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[90px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Final Amt Brk/CD</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[62px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Transport</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Total Rec.</TableHead>
            </>
          )}
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} text-right align-middle w-[46px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Extra</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[70px] !text-primary-foreground sticky top-0 bg-primary z-50`}>
            {type === 'customer' ? 'Received' : 'Paid'}
          </TableHead>
          {type === 'customer' && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[80px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Ledger Impact</TableHead>
          )}
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[58px] !text-primary-foreground sticky top-0 bg-primary z-50`}>CD</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[72px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Outstanding</TableHead>
          {isSupplier && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[95px] !text-primary-foreground sticky top-0 bg-primary z-50`}>After CD Outstanding</TableHead>
          )}
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} text-center align-middle w-[60px] !text-primary-foreground sticky top-0 bg-primary z-50`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
    );
  }

  return (
    <TableHeader className="table-header-compact z-20">
      <TableRow className="border-b-0">
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle text-center`}>
          <Checkbox
            checked={selectedIdsSize > 0 && selectedIdsSize === totalFilteredSize}
            onCheckedChange={handleSelectAll}
            className={checkboxClass}
          />
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>
          <button type="button" className={`${headSortButtonClass} whitespace-nowrap`} onClick={() => requestSort("entry")}>
            <SortIndicator columnKey="entry" />
            <span>Entry</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} align-middle`}>
          <button type="button" className={`${headSortButtonClass} whitespace-nowrap`} onClick={() => requestSort("date")}>
            <SortIndicator columnKey="date" />
            <span>Date</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`}>
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("original")}>
            <SortIndicator columnKey="original" />
            <span>Original</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Income/Credit">
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("extra")}>
            <SortIndicator columnKey="extra" />
            <span>Extra</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title={type === 'customer' ? "Income/Credit – Total Received" : "Expense/Debit – Total Paid"}>
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("paid")}>
            <SortIndicator columnKey="paid" />
            <span>{type === 'customer' ? 'Received' : 'Paid'}</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Expense/Debit">
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("cd")}>
            <SortIndicator columnKey="cd" />
            <span>CD</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Net balance">
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("outstanding")}>
            <SortIndicator columnKey="outstanding" />
            <span>Outstanding</span>
          </button>
        </TableHead>
        <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center align-middle`}>Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}

interface TransactionTableTotalsProps {
  totals: any;
  avgRate: number;
  avgBagWt: number;
  isSupplier: boolean;
  type?: 'supplier' | 'customer' | 'outsider';
}

export function TransactionTableTotals({
  totals,
  avgRate,
  avgBagWt,
  isSupplier,
  type
}: TransactionTableTotalsProps) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  if (!totals) return null;

  return (
    <TableRow className="bg-[#4c1d95] !bg-[#4c1d95] text-primary-foreground !text-primary-foreground font-bold shadow-xl border-t border-white/20 hover:!bg-[#4c1d95] transition-all">
      {/* 1. Checkbox/Label */}
      <TableCell className="py-1.5 px-1 text-center border-r border-white/10">
        <span className="text-[10px] font-black tracking-tighter">TOTAL</span>
      </TableCell>

      {/* 2. SR No/Date */}
      <TableCell className="py-1.5 px-1.5 border-r border-white/10">
        <span className="text-[10px] opacity-90">Summary</span>
      </TableCell>

      {/* 3. Gross/Teir */}
      <TableCell className="py-1.5 px-1.5 border-r border-white/10">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px]"><span className="text-white/60 text-[8px] mr-1 font-bold">G:</span>{Number(totals.grossWt || 0).toFixed(1)}</span>
          <span className="text-white/80 font-medium text-[10px]"><span className="text-white/60 text-[8px] mr-1 font-bold">T:</span>{Number(totals.teirWt || 0).toFixed(1)}</span>
        </div>
      </TableCell>

      {/* 4. Weight/Karta */}
      <TableCell className="py-1.5 px-1.5 border-r border-white/10">
        <div className="flex flex-col leading-tight text-[10px]">
          <span className="text-white font-bold">{Number(totals.weight || 0).toFixed(1)}</span>
          <span className="text-rose-300 font-medium">{Number(totals.kartaWeight || 0).toFixed(2)}</span>
        </div>
      </TableCell>

      {/* 5. Net Wt/Rate */}
      <TableCell className="py-1.5 px-1.5 border-r border-white/10">
        <div className="flex flex-col leading-tight text-[10px]">
          <span className="text-white font-black">{Number(totals.netWeight || 0).toFixed(2)}</span>
          <span className="text-emerald-300 font-medium">@{avgRate.toFixed(0)}</span>
        </div>
      </TableCell>

      {/* 6. Bags Info */}
      {!isSupplier && (
        <TableCell className="py-1.5 px-1.5 border-r border-white/10">
          <div className="flex flex-col leading-tight text-[10px]">
            <span className="text-white font-bold">{totals.bags}</span>
            <span className="text-white/80 font-medium">{avgBagWt.toFixed(2)}kg</span>
          </div>
        </TableCell>
      )}

      {/* 7. Base Amount */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 font-bold text-[11px]">
        {formatCurrency(totals.amount)}
      </TableCell>

      {/* 8. Deductions / Core Fields */}
      {isSupplier ? (
        <>
          {/* After Karta */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px]">
            {formatCurrency(totals.afterKartaAmt || 0)}
          </TableCell>
          {/* CD Amt */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px] text-rose-300">
            {formatCurrency(totals.cdAmt || 0)}
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px]">
            {formatCurrency(totals.totalKanta || 0)}
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px]">
            {formatCurrency(totals.totalLabouryAmount || 0)}
          </TableCell>
          {/* Brokerage */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px]">
            {formatCurrency(totals.brokerage || 0)}
          </TableCell>
          {/* Total Pay. */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[11px] font-bold">
            {formatCurrency(totals.totalReceivable || 0)}
          </TableCell>
          {/* Final Net */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[11px] font-black text-emerald-300">
            {formatCurrency(totals.finalNet || 0)}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10">
            <div className="flex flex-col leading-tight text-[9px]">
              <span className="text-rose-300 font-medium flex items-center justify-end gap-1"><span className="text-white/70 text-[7px] font-bold">B:</span>{formatCurrency(totals.bagWeightDeductionAmount)}</span>
              <span className="text-rose-300 font-medium flex items-center justify-end gap-1"><span className="text-white/70 text-[7px] font-bold">K:</span>{formatCurrency(totals.kartaAmount)}</span>
            </div>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10">
            <div className="flex flex-col leading-none gap-1.5">
              <span className="text-emerald-300 font-black text-[11px]">{formatCurrency(totals.finalAmount)}</span>
              <div className="flex items-center justify-end gap-2 text-[8px] text-white/70 font-bold">
                 <span>B: {formatCurrency(totals.brokerage)}</span>
                 <span>C: {formatCurrency(totals.cd)}</span>
              </div>
            </div>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10">
            <span className="text-[10px] font-bold">+ {formatCurrency(totals.transportAmount)}</span>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right font-black border-r border-white/10 text-[11px]">
            {formatCurrency(totals.totalReceivable)}
          </TableCell>
        </>
      )}
 
      {/* 12. Spacer */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 opacity-40">-</TableCell>
 
      {/* 13. Paid Amount */}
      <TableCell className={cn("py-1.5 px-1.5 text-right border-r border-white/10 text-[11px] font-black", type === 'customer' ? "text-emerald-300" : "text-rose-300")}>
        {type === 'customer' ? '' : '- '}{formatCurrency(totals.paid)}
      </TableCell>
 
      {/* 13b. Ledger Impact spacer (only for customer) */}
      {type === 'customer' && (
        <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 opacity-40">-</TableCell>
      )}
 
      {/* 14. CD Paid */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-white/10 text-[10px] text-rose-300">
        - {formatCurrency(totals.cdPaid)}
      </TableCell>
 
      {/* 15. Outstanding */}
      <TableCell className="py-1.5 px-2 text-right border-r border-white/10 text-[11px] font-black text-emerald-400">
        {formatCurrency(totals.outstanding)}
      </TableCell>
 
      {/* 15b. After CD Outstanding (only for supplier) */}
      {isSupplier && (
        <TableCell className="py-1.5 px-2 text-right border-l-2 border-white/20 text-[13px] font-black text-amber-300 bg-amber-950/20">
          {formatCurrency(totals.afterCdOutstanding)}
        </TableCell>
      )}
 
      {/* 16. Final Spacer */}
      <TableCell className="py-1.5 px-1 text-center opacity-40">-</TableCell>
    </TableRow>
  );
}

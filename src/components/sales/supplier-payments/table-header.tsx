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
        <TableRow className="border-b">
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} align-middle text-center w-[30px] sticky top-0 z-50`}>
            <Checkbox
              checked={selectedIdsSize > 0 && selectedIdsSize === totalFilteredSize}
              onCheckedChange={handleSelectAll}
              className={`${checkboxClass}`}
            />
          </TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[72px] sticky top-0 z-50`}>SR No/Date</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[68px] sticky top-0 z-50`}>Gross/Teir</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[78px] sticky top-0 z-50`}>
            {isSupplier ? 'Final' : 'Final/Bag'}
          </TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[72px] sticky top-0 z-50`}>Net Wt/Rate</TableHead>
          {!isSupplier && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} align-middle w-[62px] sticky top-0 z-50`}>Bags/Avg</TableHead>
          )}
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] sticky top-0 z-50`}>Base Amt</TableHead>
          {isSupplier ? (
            <>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] sticky top-0 z-50`}>After Karta</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[60px] sticky top-0 z-50`}>CD Amt</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[55px] sticky top-0 z-50`}>Kanta</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[55px] sticky top-0 z-50`}>Laboury</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[70px] sticky top-0 z-50`}>Brokerage</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] sticky top-0 z-50`}>Total Pay.</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[85px] sticky top-0 z-50`}>Final Net</TableHead>
            </>
          ) : (
            <>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] sticky top-0 z-50`}>Bag Ded</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[90px] sticky top-0 z-50`}>Final Amt Brk/CD</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[62px] sticky top-0 z-50`}>Transport</TableHead>
              <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[78px] sticky top-0 z-50`}>Total Rec.</TableHead>
            </>
          )}
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} text-right align-middle w-[46px] sticky top-0 z-50`}>Extra</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[70px] sticky top-0 z-50`}>
            {type === 'customer' ? 'Received' : 'Paid'}
          </TableHead>
          {type === 'customer' && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[80px] sticky top-0 z-50`}>Ledger Impact</TableHead>
          )}
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[58px] sticky top-0 z-50`}>CD</TableHead>
          <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[72px] sticky top-0 z-50`}>Outstanding</TableHead>
          {isSupplier && (
            <TableHead className={`py-0 px-1 ${headCellBaseClass} text-right align-middle w-[95px] sticky top-0 z-50`}>After CD Outstanding</TableHead>
          )}
          <TableHead className={`py-0 px-0.5 ${headCellBaseClass} text-center align-middle w-[60px] sticky top-0 z-50`}>Actions</TableHead>
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
    <TableRow className="font-black border-t">
      {/* 1. Checkbox/Label */}
      <TableCell className="py-1.5 px-1 text-center">
        <span className="text-[10px] font-black tracking-tighter uppercase">TOTAL</span>
      </TableCell>
      {/* 2. SR No/Date */}
      <TableCell className="py-1.5 px-1.5">
        <span className="text-[10px] font-black">Summary</span>
      </TableCell>

      {/* 3. Gross/Teir */}
      <TableCell className="py-1.5 px-1.5">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-black"><span className="text-[8px] mr-1 font-bold">G:</span>{Number(totals.grossWt || 0).toFixed(1)}</span>
          <span className="font-bold text-[10px]"><span className="text-[8px] mr-1 font-bold">T:</span>{Number(totals.teirWt || 0).toFixed(1)}</span>
        </div>
      </TableCell>

      {/* 4. Weight/Karta */}
      <TableCell className="py-1.5 px-1.5 border-r border-[#d48810]/60">
        <div className="flex flex-col leading-tight text-[10px]">
          <span className="text-white font-black">{Number(totals.weight || 0).toFixed(1)}</span>
          <span className="text-rose-300 font-extrabold">{Number(totals.kartaWeight || 0).toFixed(2)}</span>
        </div>
      </TableCell>

      {/* 5. Net Wt/Rate */}
      <TableCell className="py-1.5 px-1.5 border-r border-[#d48810]/60">
        <div className="flex flex-col leading-tight text-[10px]">
          <span className="text-white font-black">{Number(totals.netWeight || 0).toFixed(2)}</span>
          <span className="text-emerald-300 font-extrabold">@{avgRate.toFixed(0)}</span>
        </div>
      </TableCell>

      {/* 6. Bags Info */}
      {!isSupplier && (
        <TableCell className="py-1.5 px-1.5 border-r border-[#d48810]/60">
          <div className="flex flex-col leading-tight text-[10px]">
            <span className="text-white font-black">{totals.bags}</span>
            <span className="text-white/90 font-bold">{avgBagWt.toFixed(2)}kg</span>
          </div>
        </TableCell>
      )}

      {/* 7. Base Amount */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 font-black text-[11px] text-white">
        {formatCurrency(totals.amount)}
      </TableCell>

      {/* 8. Deductions / Core Fields */}
      {isSupplier ? (
        <>
          {/* After Karta */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-cyan-200 font-black">
            {formatCurrency(totals.afterKartaAmt || 0)}
          </TableCell>
          {/* CD Amt */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-rose-300 font-black">
            {formatCurrency(totals.cdAmt || 0)}
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-white font-bold">
            {formatCurrency(totals.totalKanta || 0)}
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-white font-bold">
            {formatCurrency(totals.totalLabouryAmount || 0)}
          </TableCell>
          {/* Brokerage */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-white font-bold">
            {formatCurrency(totals.brokerage || 0)}
          </TableCell>
          {/* Total Pay. */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[11px] font-black text-amber-100">
            {formatCurrency(totals.totalReceivable || 0)}
          </TableCell>
          {/* Final Net */}
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[11px] font-black text-emerald-300">
            {formatCurrency(totals.finalNet || 0)}
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60">
            <div className="flex flex-col leading-tight text-[9px]">
              <span className="text-rose-300 font-bold flex items-center justify-end gap-1"><span className="text-amber-100 text-[7px] font-bold">B:</span>{formatCurrency(totals.bagWeightDeductionAmount)}</span>
              <span className="text-rose-300 font-bold flex items-center justify-end gap-1"><span className="text-amber-100 text-[7px] font-bold">K:</span>{formatCurrency(totals.kartaAmount)}</span>
            </div>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60">
            <div className="flex flex-col leading-none gap-1.5">
              <span className="text-emerald-300 font-black text-[11px]">{formatCurrency(totals.finalAmount)}</span>
              <div className="flex items-center justify-end gap-2 text-[8px] text-amber-100 font-bold">
                 <span>B: {formatCurrency(totals.brokerage)}</span>
                 <span>C: {formatCurrency(totals.cd)}</span>
              </div>
            </div>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60">
            <span className="text-[10px] font-bold text-white">+ {formatCurrency(totals.transportAmount)}</span>
          </TableCell>
          <TableCell className="py-1.5 px-1.5 text-right font-black border-r border-[#d48810]/60 text-[11px] text-white">
            {formatCurrency(totals.totalReceivable)}
          </TableCell>
        </>
      )}

      {/* 12. Spacer */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 opacity-60 text-white">-</TableCell>

      {/* 13. Paid Amount */}
      <TableCell className={cn("py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[11px] font-black text-rose-300")}>
        {type === 'customer' ? '' : '- '}{formatCurrency(totals.paid)}
      </TableCell>

      {/* 13b. Ledger Impact spacer (only for customer) */}
      {type === 'customer' && (
        <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 opacity-60 text-white">-</TableCell>
      )}

      {/* 14. CD Paid */}
      <TableCell className="py-1.5 px-1.5 text-right border-r border-[#d48810]/60 text-[10px] text-rose-300 font-black">
        - {formatCurrency(totals.cdPaid)}
      </TableCell>

      {/* 15. Outstanding */}
      <TableCell className="py-1.5 px-2 text-right border-r border-[#d48810]/60 text-[11px] font-black text-emerald-300">
        {formatCurrency(totals.outstanding)}
      </TableCell>

      {/* 15b. After CD Outstanding (only for supplier) */}
      {isSupplier && (
        <TableCell className="py-1.5 px-2 text-right border-l-2 border-[#d48810]/60 text-[13px] font-black text-amber-200">
          {formatCurrency(totals.afterCdOutstanding)}
        </TableCell>
      )}

      {/* 16. Final Spacer */}
      <TableCell className="py-1.5 px-1 text-center opacity-60 text-white">-</TableCell>
    </TableRow>
  );
}

"use client";

import { TableHead, TableRow, TableHeader } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortKey, SortDirection } from "./hooks/use-transaction-management";

interface TransactionTableHeaderProps {
  selectedIdsSize: number;
  totalFilteredSize: number;
  handleSelectAll: (checked: boolean) => void;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  requestSort: (key: SortKey) => void;
  isCustomer: boolean;
  compact: boolean;
  headTextClass: string;
  checkboxClass: string;
}

export function TransactionTableHeader({
  selectedIdsSize,
  totalFilteredSize,
  handleSelectAll,
  sortKey,
  sortDirection,
  requestSort,
  isCustomer,
  compact,
  headTextClass,
  checkboxClass
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
        <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Expense/Debit – Total Paid">
          <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("paid")}>
            <SortIndicator columnKey="paid" />
            <span>Paid</span>
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
        {isCustomer && (
          <TableHead className={`py-0 px-1.5 ${headCellBaseClass} text-right align-middle`} title="Advance Freight taken">
            <button type="button" className={`${headSortButtonClass} justify-end`} onClick={() => requestSort("advanceFreight")}>
              <SortIndicator columnKey="advanceFreight" />
              <span>Adv. Freight</span>
            </button>
          </TableHead>
        )}
        <TableHead className={`py-0 px-1 ${headCellBaseClass} text-center align-middle`}>Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}

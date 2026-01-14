"use client";

import React, { memo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";
import { Pen, Trash, ArrowUpDown } from "lucide-react";
import type { Income, Expense } from "@/lib/definitions";

export type DisplayTransaction = (Income | Expense) & { id: string };

interface ExpenseTrackerTableProps {
  runningLedger: DisplayTransaction[];
  allSelected: boolean;
  someSelected: boolean;
  toggleSelectAll: (checked: boolean) => void;
  requestSort: (key: keyof DisplayTransaction) => void;
  selectedTransactionIds: Set<string>;
  toggleTransactionSelection: (id: string, checked: boolean) => void;
  getDisplayId: (tx: DisplayTransaction) => string;
  handleEdit: (tx: DisplayTransaction) => void;
  handleDelete: (tx: DisplayTransaction) => void;
}

export const ExpenseTrackerTable = memo(function ExpenseTrackerTable({
  runningLedger,
  allSelected,
  someSelected,
  toggleSelectAll,
  requestSort,
  selectedTransactionIds,
  toggleTransactionSelection,
  getDisplayId,
  handleEdit,
  handleDelete,
}: ExpenseTrackerTableProps) {
  // Use length and a stable reference to avoid infinite loops
  const ledgerLength = runningLedger.length;
  const { visibleItems, hasMore, scrollRef } = useInfiniteScroll(runningLedger, {
    totalItems: ledgerLength,
    initialLoad: 30,
    loadMore: 30,
    threshold: 5,
    enabled: ledgerLength > 30,
  });

  const visibleTransactions = runningLedger.slice(0, visibleItems);

  return (
    <div className="flex flex-col -mt-px">
      <div className="overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader className="bg-muted/50 sticky top-0 z-10 border-t border-muted">
          <TableRow>
            <TableHead className="w-[36px] text-center text-xs py-2">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(value) => toggleSelectAll(value === true)}
                aria-label="Select all transactions"
              />
            </TableHead>
            <TableHead className="cursor-pointer text-xs py-2" onClick={() => requestSort('transactionId')}>ID <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
            <TableHead className="cursor-pointer text-xs py-2" onClick={() => requestSort('date')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1"/> </TableHead>
            <TableHead className="text-xs py-2">Description</TableHead>
            <TableHead className="text-right text-xs py-2">Debit</TableHead>
            <TableHead className="text-right text-xs py-2">Credit</TableHead>
            <TableHead className="text-right text-xs py-2">Running Balance</TableHead>
            <TableHead className="text-center text-xs py-2">Actions</TableHead>
          </TableRow>
          </TableHeader>
        </Table>
      </div>
      <ScrollArea ref={scrollRef} className="h-[380px]">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
          <TableBody>
          {visibleTransactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="text-center py-1.5">
                <Checkbox
                  checked={selectedTransactionIds.has(transaction.id)}
                  onCheckedChange={(value) => toggleTransactionSelection(transaction.id, value === true)}
                  aria-label={`Select transaction ${getDisplayId(transaction)}`}
                />
              </TableCell>
              <TableCell className="font-mono text-xs py-1.5">{getDisplayId(transaction)}</TableCell>
              <TableCell className="text-xs py-1.5">{format(new Date(transaction.date), "dd-MMM-yy")}</TableCell>
              <TableCell className="text-xs py-1.5">{transaction.description || toTitleCase(transaction.payee)}</TableCell>
              <TableCell className="text-right text-rose-600 font-medium text-xs py-1.5">{transaction.transactionType === 'Expense' ? formatCurrency(transaction.amount) : '-'}</TableCell>
              <TableCell className="text-right text-emerald-600 font-medium text-xs py-1.5">{transaction.transactionType === 'Income' ? formatCurrency(transaction.amount) : '-'}</TableCell>
              <TableCell className={cn("text-right font-semibold text-xs py-1.5", transaction.runningBalance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {formatCurrency(transaction.runningBalance)}
              </TableCell>
              <TableCell className="text-center py-1.5">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(transaction)}><Pen className="h-3 w-3" /></Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6"><Trash className="h-3 w-3 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the transaction for "{toTitleCase(transaction.payee)}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(transaction)}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
          {/* NO LOADING - Data loads instantly, infinite scroll works in background */}
          {!hasMore && runningLedger.length > 30 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-2 text-xs text-muted-foreground">
                Showing all {runningLedger.length} transactions
              </TableCell>
            </TableRow>
          )}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Only re-render if the actual data changed, not just array reference
  if (prevProps.runningLedger.length !== nextProps.runningLedger.length) {
    return false; // Re-render if length changed
  }
  
  // Check if IDs are the same (shallow comparison)
  const prevIds = prevProps.runningLedger.map(tx => tx.id).join(',');
  const nextIds = nextProps.runningLedger.map(tx => tx.id).join(',');
  if (prevIds !== nextIds) {
    return false; // Re-render if IDs changed
  }
  
  // Check other props
  if (
    prevProps.allSelected !== nextProps.allSelected ||
    prevProps.someSelected !== nextProps.someSelected ||
    prevProps.selectedTransactionIds.size !== nextProps.selectedTransactionIds.size
  ) {
    return false; // Re-render if selection state changed
  }
  
  // Check if selected IDs are the same
  const prevSelected = Array.from(prevProps.selectedTransactionIds).sort().join(',');
  const nextSelected = Array.from(nextProps.selectedTransactionIds).sort().join(',');
  if (prevSelected !== nextSelected) {
    return false; // Re-render if selection changed
  }
  
  return true; // Don't re-render, props are effectively the same
});


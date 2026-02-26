
import React from "react";
import { format } from "date-fns";
import { 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DisplayTransaction } from "../expense-tracker-client";
import { cn } from "@/lib/utils";

interface TransactionTableProps {
  transactions: DisplayTransaction[];
  onEdit: (transaction: DisplayTransaction) => void;
  onDelete: (transaction: DisplayTransaction) => void;
  totalExpenseCount?: number | null;
}

export function TransactionTable({ 
  transactions, 
  onEdit, 
  onDelete,
  totalExpenseCount
}: TransactionTableProps) {
  
  // Calculate running balance and sort
  const transactionsWithBalance = React.useMemo(() => {
    // First sort by date ascending (oldest first) to calculate balance correctly
    const sortedAsc = [...transactions].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    let runningBalance = 0;
    const withBalance = sortedAsc.map(t => {
      if (t.transactionType === 'Income') {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      return { ...t, balance: runningBalance };
    });

    // Then reverse to show newest first
    return withBalance.reverse();
  }, [transactions]);

  // Calculate counts
  const counts = React.useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.transactionType === 'Income') acc.income++;
      else acc.expense++;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <p>No transactions found.</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] overflow-hidden flex flex-col h-full">
      {/* Dark Top Bar */}
      <div className="bg-primary/20 text-slate-900 px-4 py-2 flex justify-between items-center shrink-0 border-b border-primary/30">
        <div className="font-bold text-sm">Transaction History</div>
        <div className="flex gap-6 text-xs font-medium">
            <div className="flex items-center gap-1">
            <span className="text-slate-600">Total:</span>
            <span className="text-slate-900">{transactions.length}</span>
            </div>
            <div className="flex items-center gap-1">
            <span className="text-slate-600">Income:</span>
            <span className="text-primary">{counts.income}</span>
            </div>
            <div className="flex items-center gap-1">
            <span className="text-slate-600">Expense:</span>
            <span className="text-rose-600">{counts.expense}</span>
            </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
          <table className="w-full text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[34%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-primary/15 backdrop-blur-[14px]">
              <TableRow className="border-none h-7">
                <TableHead className="h-7 px-2 py-1 font-bold text-slate-900 text-xs">S.No</TableHead>
                <TableHead className="h-7 px-2 py-1 font-bold text-slate-900 text-xs">Date</TableHead>
                <TableHead className="h-7 px-2 py-1 font-bold text-slate-900 text-xs">ID</TableHead>
                <TableHead className="h-7 px-2 py-1 font-bold text-slate-900 text-xs">Payee / Description</TableHead>
                <TableHead className="text-right h-7 px-2 py-1 font-bold text-slate-900 text-xs">Income</TableHead>
                <TableHead className="text-right h-7 px-2 py-1 font-bold text-slate-900 text-xs">Expense</TableHead>
                <TableHead className="text-right h-7 px-2 py-1 font-bold text-slate-900 text-xs">Balance</TableHead>
                <TableHead className="text-right h-7 px-2 py-1 font-bold text-slate-900 text-xs pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionsWithBalance.map((transaction, index) => (
                <TableRow 
                  key={transaction.id} 
                  className="group border-none odd:bg-slate-50/60 even:bg-white hover:bg-primary/10 transition-colors h-7"
                >
                  <TableCell className="font-medium text-slate-600 px-2 py-1 text-[11px]">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap px-2 py-1 text-slate-800 text-[11px]">
                    {format(new Date(transaction.date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium text-slate-600 px-2 py-1 text-[11px]">
                    {transaction.transactionId}
                  </TableCell>
                  <TableCell className="px-2 py-1">
                    <div className="flex flex-col text-slate-900">
                      <span className="font-bold text-xs truncate">{transaction.payee}</span>
                      {transaction.description && (
                        <span className="text-[10px] text-slate-600 mt-0.5 truncate">
                          {transaction.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-[11px] px-2 py-1 text-primary">
                    {transaction.transactionType === 'Income' ? formatCurrency(transaction.amount) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-[11px] px-2 py-1 text-[#dc2626]">
                    {transaction.transactionType === 'Expense' ? formatCurrency(transaction.amount) : '-'}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-bold text-[11px] px-2 py-1",
                    transaction.balance >= 0 ? "text-primary" : "text-rose-700"
                  )}>
                    {formatCurrency(Math.abs(transaction.balance))}
                  </TableCell>
                  <TableCell className="text-right px-2 py-1">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full text-slate-700 hover:bg-primary/10 hover:text-primary"
                        onClick={() => onEdit(transaction)}
                      >
                        <Edit className="h-3 w-3" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => onDelete(transaction)}
                      >
                        <Trash className="h-3 w-3" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}

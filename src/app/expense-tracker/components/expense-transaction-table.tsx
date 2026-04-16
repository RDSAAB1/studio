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
  selectedAccount?: string | null;
}

// Memoized Row component to prevent unnecessary re-renders
const TransactionRow = React.memo(({ 
  transaction, 
  index, 
  onEdit, 
  onDelete 
}: { 
  transaction: DisplayTransaction & { balance: number };
  index: number;
  onEdit: (t: any) => void;
  onDelete: (t: any) => void;
}) => (
  <TableRow 
    className="group border-none odd:bg-slate-50/60 even:bg-white hover:bg-primary/10 transition-colors h-6 sm:h-7"
  >
    <TableCell className="font-medium text-slate-600 px-1 sm:px-2 py-0.5 sm:py-1 text-[9px] min-[400px]:text-[10px] sm:text-[11px]">
      {index + 1}
    </TableCell>
    <TableCell className="font-medium whitespace-nowrap px-1 sm:px-2 py-0.5 sm:py-1 text-slate-800 text-[9px] min-[400px]:text-[10px] sm:text-[11px]">
      {format(new Date(transaction.date), "dd MMM yyyy")}
    </TableCell>
    <TableCell className="font-medium text-slate-600 px-1 sm:px-2 py-0.5 sm:py-1 text-[9px] min-[400px]:text-[10px] sm:text-[11px]">
      {transaction.transactionId}
    </TableCell>
    <TableCell className="px-1 sm:px-2 py-0.5 sm:py-1">
      <div className="flex flex-col text-slate-900">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="font-bold text-[10px] sm:text-xs truncate">{transaction.payee}</span>
          {(transaction as any).isInternal && (
            <span className="px-1 py-0 bg-violet-100 text-violet-700 text-[7px] sm:text-[8px] font-bold rounded uppercase leading-none border border-violet-200">
              Adjust
            </span>
          )}
        </div>
        {transaction.description && (
          <span className="text-[9px] sm:text-[10px] text-slate-600 mt-0 sm:mt-0.5 truncate">
            {transaction.description}
          </span>
        )}
      </div>
    </TableCell>
    <TableCell className="text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1 text-primary">
      {transaction.transactionType === 'Income' ? formatCurrency(transaction.amount) : '-'}
    </TableCell>
    <TableCell className="text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1 text-[#dc2626]">
      {transaction.transactionType === 'Expense' ? formatCurrency(transaction.amount) : '-'}
    </TableCell>
    <TableCell className={cn(
      "text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1",
      transaction.balance >= 0 ? "text-primary" : "text-rose-700"
    )}>
      {formatCurrency(Math.abs(transaction.balance))}
    </TableCell>
    <TableCell className="text-right px-1 sm:px-2 py-0.5 sm:py-1">
      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full text-slate-700 hover:bg-primary/10 hover:text-primary"
          onClick={() => onEdit(transaction)}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full text-slate-700 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => onDelete(transaction)}
        >
          <Trash className="h-3 w-3" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
));

TransactionRow.displayName = "TransactionRow";

export function TransactionTable({ 
  transactions, 
  onEdit, 
  onDelete,
  totalExpenseCount,
  selectedAccount
}: TransactionTableProps) {
  const [displayCount, setDisplayCount] = React.useState(100);
  
  // Calculate running balance and sort
  const transactionsWithBalance = React.useMemo(() => {
    // First sort by date ascending (oldest first) to calculate balance correctly
    const sortedAsc = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // Secondary sort to maintain stable order for entries on same day
      return (a.transactionId || '').localeCompare(b.transactionId || '');
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

  // Sliced for display
  const visibleTransactions = React.useMemo(() => {
    return transactionsWithBalance.slice(0, displayCount);
  }, [transactionsWithBalance, displayCount]);

  // Calculate counts accurately from full set
  const counts = React.useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.transactionType === 'Income') acc.income++;
      else acc.expense++;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  return (
    <div className="w-full rounded-[14px] border border-white/60 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-[12px] transition-all duration-300 hover:shadow-[0_12px_45px_0_rgba(31,38,135,0.12)] border-b-[3px] border-b-primary/20 overflow-hidden flex flex-col h-full">
      {/* Dark Top Bar */}
      <div className="bg-primary/20 text-slate-900 px-2 sm:px-4 py-1.5 sm:py-2 flex justify-between items-center shrink-0 border-b border-primary/30">
        <div className="font-bold text-[11px] sm:text-sm">Transaction History</div>
        <div className="flex gap-2 sm:gap-6 text-[9.5px] min-[400px]:text-[10px] sm:text-xs font-medium">
            <div className="flex items-center gap-1">
            <span className="text-slate-600">Show:</span>
            <span className="text-slate-900">{visibleTransactions.length}/{transactions.length}</span>
            </div>
            <div className="flex items-center gap-1">
            <span className="text-slate-600">In:</span>
            <span className="text-primary">{counts.income}</span>
            </div>
            <div className="flex items-center gap-1">
            <span className="text-slate-600">Ex:</span>
            <span className="text-rose-600">{counts.expense}</span>
            </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
          <table className="w-full min-w-[800px] text-xs text-left table-fixed">
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
            <TableHeader className="table-header-compact">
              <TableRow className="border-none h-6 sm:h-7">
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">S.No</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">Date</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">ID</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">Payee / Description</TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs text-primary">
                  {selectedAccount ? 'Credit' : 'Income'}
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs text-[#dc2626]">
                  {selectedAccount ? 'Debit' : 'Expense'}
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">
                  {selectedAccount ? 'Net' : 'Running'}
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs pr-2 sm:pr-4 min-w-[50px]">Act</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow className="border-none hover:bg-transparent">
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {visibleTransactions.map((transaction, index) => (
                    <TransactionRow 
                      key={transaction.id}
                      transaction={transaction as any}
                      index={index}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                  {transactions.length > displayCount && (
                    <TableRow className="hover:bg-transparent border-none">
                      <TableCell colSpan={8} className="text-center py-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-7 px-4 border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => setDisplayCount(prev => prev + 200)}
                        >
                          Load Previous Transactions ({transactions.length - displayCount} more)
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
import { Checkbox } from "@/components/ui/checkbox";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
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
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onBulkDelete: () => void;
  onBulkShift: (targetPayee: string) => void;
  onBulkChangeDescription: () => void;
  accountOptions: { value: string; label: string }[];
}

// Memoized Row component to prevent unnecessary re-renders
const TransactionRow = React.memo(({ 
  transaction, 
  index, 
  onEdit, 
  onDelete,
  isSelected,
  onSelectChange
}: { 
  transaction: DisplayTransaction & { balance: number; isCredit: boolean };
  index: number;
  onEdit: (t: any) => void;
  onDelete: (t: any) => void;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
}) => (
  <TableRow 
    className="group border-none odd:bg-slate-50/60 even:bg-white hover:bg-primary/10 transition-colors h-6 sm:h-7"
  >
    <TableCell className="px-1 sm:px-2 py-0.5 sm:py-1 w-8">
      <Checkbox 
        checked={isSelected}
        onCheckedChange={(checked) => onSelectChange(!!checked)}
      />
    </TableCell>
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
          {(() => {
            const entryType = (transaction as any).entryType || (transaction.transactionType === 'Income' ? 'Income' : 'Expense');
            const tagLabels: Record<string, string> = {
              Income: 'INCOME',
              Expense: 'EXPENSE',
              Buy: 'PURCHASE',
              Sale: 'SALE',
              Loss: 'LOSS',
              Use: 'USE',
              Adjustment: 'ADJUST',
              Lend: 'LEND',
              Borrow: 'BORROW',
              'Lend Return': 'LEND RET',
              'Borrow Return': 'BORR RET',
              'Interest Received': 'INT REC',
              'Interest Paid': 'INT PAID'
            };
            const tagStyles: Record<string, string> = {
              Income: 'bg-blue-50 text-blue-600 border-blue-100',
              Expense: 'bg-rose-50 text-rose-600 border-rose-100',
              Buy: 'bg-rose-50 text-rose-600 border-rose-100',
              Sale: 'bg-emerald-50 text-emerald-600 border-emerald-100',
              Loss: 'bg-red-50 text-red-600 border-red-100',
              Use: 'bg-amber-50 text-amber-600 border-amber-100',
              Adjustment: 'bg-slate-50 text-slate-600 border-slate-100',
              Lend: 'bg-rose-50 text-rose-600 border-rose-100',
              Borrow: 'bg-emerald-50 text-emerald-600 border-emerald-100',
              'Lend Return': 'bg-emerald-50 text-emerald-700 border-emerald-200',
              'Borrow Return': 'bg-rose-50 text-rose-700 border-rose-200',
              'Interest Received': 'bg-cyan-50 text-cyan-700 border-cyan-200',
              'Interest Paid': 'bg-rose-50 text-rose-700 border-rose-200',
              Salary: 'bg-rose-50 text-rose-600 border-rose-100',
              Laboury: 'bg-rose-50 text-rose-600 border-rose-100',
              Transport: 'bg-rose-50 text-rose-600 border-rose-100',
              Brokerage: 'bg-rose-50 text-rose-600 border-rose-100'
            };
            
            const label = tagLabels[entryType] || entryType.toUpperCase();
            const style = tagStyles[entryType] || 'bg-slate-50 text-slate-600 border-slate-100';

            return (
              <span className={cn("px-1 py-0 text-[7px] sm:text-[8px] font-black rounded uppercase leading-none border shadow-sm", style)}>
                {label}
              </span>
            );
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px] text-slate-600 mt-0 sm:mt-0.5 truncate">
          {transaction.description && <span>{transaction.description}</span>}
          {(transaction as any).variety && (
             <span className="font-bold text-slate-700 ml-1">
               {(transaction as any).variety} 
               {(transaction as any).quantity > 0 && ` (${(transaction as any).quantity} Bags)`}
               {(transaction as any).rate > 0 && ` @ ₹${(transaction as any).rate}`}
             </span>
          )}
        </div>
      </div>
    </TableCell>
    <TableCell className="text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1 text-primary">
      {transaction.isCredit ? formatCurrency(transaction.amount) : '-'}
    </TableCell>
    <TableCell className="text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1 text-[#dc2626]">
      {!transaction.isCredit ? formatCurrency(transaction.amount) : '-'}
    </TableCell>
    <TableCell className={cn(
      "text-right font-bold text-[9px] min-[400px]:text-[10px] sm:text-[11px] px-1 sm:px-2 py-0.5 sm:py-1 tabular-nums",
      transaction.balance >= 0 ? "text-blue-700" : "text-amber-700"
    )}>
      {formatCurrency(Math.abs(transaction.balance))} {transaction.balance >= 0 ? 'Cr' : 'Dr'}
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
  selectedAccount,
  selectedIds,
  setSelectedIds,
  onBulkDelete,
  onBulkShift,
  onBulkChangeDescription,
  accountOptions
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
      const rawType = ((t as any).entryType || t.transactionType || "").toUpperCase();
      const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'PAYABLE', 'LIABILITIES'].includes(rawType);
      
      if (isCredit) {
        runningBalance += t.amount;
      } else {
        runningBalance -= t.amount;
      }
      return { ...t, balance: runningBalance, isCredit };
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
      const rawType = ((t as any).entryType || t.transactionType || "").toUpperCase();
      const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'PAYABLE', 'LIABILITIES'].includes(rawType);
      
      if (isCredit) acc.income++;
      else acc.expense++;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  return (
    <div className="w-full rounded-[14px] border border-white/60 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-[12px] transition-all duration-300 hover:shadow-[0_12px_45px_0_rgba(31,38,135,0.12)] border-b-[3px] border-b-primary/20 overflow-hidden flex flex-col h-full">
      {/* Dark Top Bar / Bulk Actions Header */}
      <div className="bg-primary/20 text-slate-900 px-2 sm:px-4 py-1.5 sm:py-2 flex justify-between items-center shrink-0 border-b border-primary/30 min-h-[38px]">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-2 w-full justify-between">
            <div className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wider">
              {selectedIds.size} Selected
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[180px] shrink-0 h-7">
                <CustomDropdown
                  options={accountOptions}
                  value=""
                  onChange={(val) => {
                    if (val) {
                      onBulkShift(val);
                    }
                  }}
                  placeholder="Shift to Account..."
                  inputClassName="h-7 text-[10px] w-[180px] bg-white border-slate-300 shadow-none text-slate-800"
                  triggerOnChangeOnType={false}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-black px-2.5 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 uppercase tracking-wider leading-none shadow-sm"
                onClick={onBulkChangeDescription}
              >
                Change Desc
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-[10px] font-black px-3 uppercase tracking-wider leading-none shadow-sm"
                onClick={onBulkDelete}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-black px-2 bg-white border-slate-300 text-slate-700 hover:bg-slate-50 uppercase tracking-wider leading-none"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="bg-white overflow-hidden flex-1 flex flex-col">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
          <table className="w-full min-w-[800px] text-xs text-left table-fixed">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[6%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[30%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader className="table-header-compact">
              <TableRow className="border-none h-6 sm:h-7">
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1">
                  <Checkbox 
                    checked={visibleTransactions.length > 0 && visibleTransactions.every(t => selectedIds.has(t.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds(new Set(visibleTransactions.map(t => t.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">S.No</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">Date</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">ID</TableHead>
                <TableHead className="h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">Payee / Description</TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs text-emerald-700">
                  Credit (Rec)
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs text-rose-700">
                  Debit (Paid)
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs">
                  Balance
                </TableHead>
                <TableHead className="text-right h-6 sm:h-7 px-1 sm:px-2 py-0.5 sm:py-1 font-bold text-slate-900 text-[10px] sm:text-xs pr-2 sm:pr-4 min-w-[50px]">Act</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow className="border-none hover:bg-transparent">
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                      isSelected={selectedIds.has(transaction.id)}
                      onSelectChange={(checked) => {
                        const newSet = new Set(selectedIds);
                        if (checked) {
                          newSet.add(transaction.id);
                        } else {
                          newSet.delete(transaction.id);
                        }
                        setSelectedIds(newSet);
                      }}
                    />
                  ))}
                  {transactions.length > displayCount && (
                    <TableRow className="hover:bg-transparent border-none">
                      <TableCell colSpan={9} className="text-center py-4">
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

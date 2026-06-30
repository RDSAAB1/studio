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
import { Edit, Trash, Info, ChevronDown, ChevronRight, Link2 } from "lucide-react";
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
  onShowInfo?: (transaction: DisplayTransaction) => void;
  /** Map: supplier receipt srNo (uppercase) -> linked payment transactions */
  supplierPaymentMap?: Map<string, DisplayTransaction[]>;
}

function getEntryTagInfo(entryType: string) {
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
    'Interest Paid': 'INT PAID',
    'Supplier Payment': 'SUP PAY',
    'Supplier Refund': 'SUP REF',
    'Customer Payment': 'CUS PAY',
    'Customer Refund': 'CUS REF',
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
    Brokerage: 'bg-rose-50 text-rose-600 border-rose-100',
    'Supplier Payment': 'bg-violet-50 text-violet-700 border-violet-200',
    'Supplier Refund': 'bg-cyan-50 text-cyan-700 border-cyan-200',
    'Customer Payment': 'bg-teal-50 text-teal-700 border-teal-200',
    'Customer Refund': 'bg-orange-50 text-orange-700 border-orange-200',
  };
  const label = tagLabels[entryType] || entryType.toUpperCase();
  const style = tagStyles[entryType] || 'bg-slate-50 text-slate-600 border-slate-100';
  return { label, style };
}

// Normal transaction row
const TransactionRow = React.memo(({ 
  transaction, 
  index, 
  onEdit, 
  onDelete,
  isSelected,
  onSelectChange,
  onShowInfo,
  hasLinkedPayments,
  isExpanded,
  onToggleExpand,
}: { 
  transaction: DisplayTransaction & { balance: number; isCredit: boolean };
  index: number;
  onEdit: (t: any) => void;
  onDelete: (t: any) => void;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onShowInfo?: (t: any) => void;
  hasLinkedPayments?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) => {
  const entryType = (transaction as any).entryType || (transaction.transactionType === 'Income' ? 'Income' : 'Expense');
  const { label, style } = getEntryTagInfo(entryType);
  const isSup = transaction.id.startsWith('SUP-');
  const canExpand = hasLinkedPayments;

  return (
    <TableRow 
      className={cn(
        "group border-none transition-colors h-6 sm:h-7",
        isSup && hasLinkedPayments
          ? "bg-violet-50/60 hover:bg-violet-100/60"
          : "odd:bg-slate-50/60 even:bg-white hover:bg-primary/10"
      )}
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
            {/* Expand/collapse toggle for linked payments or stock details */}
            {canExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="shrink-0 flex items-center justify-center w-4 h-4 rounded text-violet-600 hover:bg-violet-100 transition-colors"
                title={isExpanded ? "Hide details" : "Show details"}
              >
                {isExpanded
                  ? <ChevronDown className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
              </button>
            )}
            <span className="font-bold text-[10px] sm:text-xs truncate">{transaction.payee}</span>
            <span className={cn("px-1 py-0 text-[7px] sm:text-[8px] font-black rounded uppercase leading-none border shadow-sm", style)}>
              {label}
            </span>
            {isSup && hasLinkedPayments && (
              <span className="ml-0.5 px-1 py-0 text-[7px] font-black rounded uppercase leading-none border bg-violet-100 text-violet-700 border-violet-200 flex items-center gap-0.5">
                <Link2 className="h-2 w-2 inline" />
                {isExpanded ? "LINKED" : "PAYMENTS"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[9px] sm:text-[10px] text-slate-600 mt-0 sm:mt-0.5 truncate">
            {transaction.description && <span>{transaction.description}</span>}
            {(transaction as any).variety && (
               <span className="font-bold text-slate-700 ml-1">
                 {(transaction as any).variety} 
                 {(transaction as any).quantity > 0 && ` (${(transaction as any).quantity} ${(transaction as any).unit || (transaction.id.startsWith('SUP-') ? 'Qtl' : 'Bag')})`}
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
        <div className="flex justify-end gap-1 items-center">
          {(transaction.customerPaymentRef || (transaction as any).customerRef) ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
              onClick={() => onShowInfo && onShowInfo(transaction)}
              title="View Details"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </div>
      </TableCell>
    </TableRow>
  );
});
TransactionRow.displayName = "TransactionRow";

// Linked supplier payment sub-row
const LinkedPaymentRow = React.memo(({ 
  payment, 
  isLast,
  onShowInfo,
}: { 
  payment: DisplayTransaction;
  isLast: boolean;
  onShowInfo?: (t: any) => void;
}) => {
  const rawType = ((payment as any).entryType || payment.transactionType || "").toUpperCase();
  const isCredit = ['INCOME', 'SUPPLIER REFUND'].includes(rawType);
  const amt = Math.abs(Number(payment.amount || 0));
  const method = (payment as any).paymentMethod || '';
  const date = payment.date ? format(new Date(payment.date), "dd MMM yy") : '';
  const category = (payment as any).category || '';

  return (
    <TableRow className="border-none bg-violet-50/40 hover:bg-violet-100/50 transition-colors h-6">
      {/* indent spacer */}
      <TableCell className="px-1 py-0.5 w-8" />
      <TableCell className="py-0.5 px-1">
        {/* Tree connector */}
        <div className="flex items-center justify-center h-full">
          <div className={cn(
            "w-3 border-l-2 border-b-2 border-violet-300 rounded-bl-sm",
            isLast ? "h-3" : "h-3"
          )} />
        </div>
      </TableCell>
      <TableCell className="font-medium whitespace-nowrap px-1 py-0.5 text-violet-700 text-[8px] sm:text-[9px]">
        {date}
      </TableCell>
      <TableCell className="font-medium text-violet-600 px-1 py-0.5 text-[8px] sm:text-[9px]">
        {payment.transactionId}
      </TableCell>
      <TableCell className="px-2 py-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[9px] sm:text-[10px] text-violet-800">{payment.payee}</span>
              <span className="px-1 py-0 text-[7px] font-black rounded uppercase leading-none border bg-violet-100 text-violet-700 border-violet-200">
                {category.toUpperCase() || 'PAYMENT'}
              </span>
              {method && (
                <span className="px-1 py-0 text-[7px] font-black rounded uppercase leading-none border bg-slate-100 text-slate-600 border-slate-200">
                  {method}
                </span>
              )}
            </div>
            {payment.description && (
              <span className="text-[8px] text-violet-500 truncate">{payment.description}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right font-bold text-[9px] px-1 py-0.5 text-primary">
        {isCredit ? formatCurrency(amt) : '-'}
      </TableCell>
      <TableCell className="text-right font-bold text-[9px] px-1 py-0.5 text-[#dc2626]">
        {!isCredit ? formatCurrency(amt) : '-'}
      </TableCell>
      <TableCell className="py-0.5" />
      <TableCell className="text-right px-1 py-0.5">
        {(payment.customerPaymentRef) ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-full text-violet-500 hover:bg-violet-100 hover:text-violet-700 shrink-0"
            onClick={() => onShowInfo && onShowInfo(payment)}
            title="View Payment Details"
          >
            <Info className="h-3 w-3" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
});
LinkedPaymentRow.displayName = "LinkedPaymentRow";


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
  accountOptions,
  onShowInfo,
  supplierPaymentMap,
}: TransactionTableProps) {
  const [displayCount, setDisplayCount] = React.useState(100);
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  
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
                  {visibleTransactions.map((transaction, index) => {
                    const isSup = transaction.id.startsWith('SUP-');
                    // For SUP- rows, find linked payments by matching the srNo
                    // transactionId format is "P-{srNo}"
                    let linkedPayments: DisplayTransaction[] = [];
                    if (isSup && supplierPaymentMap) {
                      const txId = (transaction as any).transactionId || '';
                      // Extract srNo from "P-{srNo}"
                      const srNo = txId.startsWith('P-') ? txId.slice(2).trim().toUpperCase() : txId.trim().toUpperCase();
                      linkedPayments = supplierPaymentMap.get(srNo) || [];
                    }
                    const hasLinked = isSup && linkedPayments.length > 0;
                    const isExpanded = expandedRows.has(transaction.id);

                    return (
                      <React.Fragment key={transaction.id}>
                        <TransactionRow 
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
                          onShowInfo={onShowInfo}
                          hasLinkedPayments={hasLinked}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleExpand(transaction.id)}
                        />
                        {/* Linked payment sub-rows */}
                        {hasLinked && isExpanded && linkedPayments.map((pay, pIdx) => (
                          <LinkedPaymentRow
                            key={pay.id}
                            payment={pay}
                            isLast={pIdx === linkedPayments.length - 1}
                            onShowInfo={onShowInfo}
                          />
                        ))}
                      </React.Fragment>
                    );
                  })}
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

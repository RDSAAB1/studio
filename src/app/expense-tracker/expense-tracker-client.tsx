

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory, Project, FundTransaction, Loan, BankAccount, Income, Expense } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, formatTransactionId } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { getIncomeCategories, getExpenseCategories, addCategory, updateCategoryName, deleteCategory, addSubCategory, deleteSubCategory, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getExpensesRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getProjectsRealtime } from "@/lib/firestore";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; 


import { Pen, PlusCircle, Save, Trash, Calendar as CalendarIcon, Tag, User, Wallet, Info, FileText, ArrowUpDown, TrendingUp, Hash, Percent, RefreshCw, Briefcase, UserCircle, FilePlus, List, BarChart, CircleDollarSign, Landmark, Building2, SunMoon, Layers3, FolderTree, ArrowLeftRight, Settings, SlidersHorizontal, Calculator, HandCoins } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, addMonths } from "date-fns"

// Zod Schema for form validation
const transactionFormSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string().optional(),
  date: z.date(),
  transactionType: z.enum(["Income", "Expense"]),
  category: z.string().min(1, "Category is required."),
  subCategory: z.string().min(1, "Sub-category is required."),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  payee: z.string().min(1, "Payee/Payer is required."),
  paymentMethod: z.string().min(1, "Payment method is required."),
  bankAccountId: z.string().optional(),
  status: z.string().min(1, "Status is required."),
  description: z.string().optional(),
  taxAmount: z.coerce.number().optional(),
  expenseType: z.enum(["Personal", "Business"]).optional(),
  isRecurring: z.boolean(),
  recurringFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  nextDueDate: z.date().optional(),
  mill: z.string().optional(), 
  expenseNature: z.enum(["Permanent", "Seasonal"]).optional(),
  isCalculated: z.boolean(),
  quantity: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  projectId: z.string().optional(),
  loanId: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// This combines both income and expense for the list display
type DisplayTransaction = (Income | Expense) & { id: string };

const getInitialFormState = (nextTxId: string): TransactionFormValues => {
  const staticDate = new Date();
  staticDate.setHours(0, 0, 0, 0);

  return {
    date: staticDate,
    transactionType: 'Expense',
    category: '',
    subCategory: '',
    amount: 0,
    payee: '',
    description: '',
    paymentMethod: 'Cash',
    status: 'Paid',
    transactionId: nextTxId,
    taxAmount: 0,
    expenseType: 'Business',
    isRecurring: false,
    recurringFrequency: 'monthly',
    isCalculated: false,
    quantity: 0,
    rate: 0,
    projectId: 'none',
  };
};

const SectionCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <Card className={cn("bg-card/60 backdrop-blur-sm border-white/10", className)}>
        {children}
    </Card>
);

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function IncomeExpenseClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("form");
  const [sortConfig, setSortConfig = useState<{ key: keyof DisplayTransaction; direction: 'ascending' | 'descending' } | null>(null);
  
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);

    useEffect(() => {
        const unsubIncome = getIncomeRealtime(setIncome, console.error);
        const unsubExpenses = getExpensesRealtime(setExpenses, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubProjects = getProjectsRealtime(setProjects, console.error);

        return () => {
            unsubIncome(); unsubExpenses(); unsubFunds(); unsubLoans(); unsubAccounts(); unsubProjects();
        }
    }, []);

  useEffect(() => {
    if(income !== undefined && expenses !== undefined) {
      setLoading(false);
    }
  }, [income, expenses])

  const allTransactions: DisplayTransaction[] = useMemo(() => [...(income || []), ...(expenses || [])], [income, expenses]);

  const getNextTransactionId = useCallback((type: 'Income' | 'Expense') => {
      const prefix = type === 'Income' ? 'IN' : 'EX';
      const relevantTransactions = allTransactions.filter(t => t.transactionType === type && t.transactionId);
      if (!relevantTransactions || relevantTransactions.length === 0) {
          return formatTransactionId(1, prefix);
      }
      
      const lastNum = relevantTransactions.reduce((max, t) => {
          const numMatch = t.transactionId?.match(/^(?:IN|EX)(\d+)$/);
          if (numMatch && numMatch[1]) {
            const num = parseInt(numMatch[1], 10);
            return num > max ? num : max;
          }
          return max;
      }, 0);

      return formatTransactionId(lastNum + 1, prefix);
  }, [allTransactions]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getInitialFormState(getNextTransactionId('Expense')),
  });

  const {
    watch,
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setFocus,
    formState: { errors },
  } = form;
  
  const selectedTransactionType = watch('transactionType');
  const selectedPaymentMethod = watch('paymentMethod');
  const selectedExpenseNature = watch('expenseNature');
  const selectedCategory = watch('category');
  const selectedSubCategory = watch('subCategory');
  const quantity = watch('quantity');
  const rate = watch('rate');


  useEffect(() => {
      if (!isEditing) {
          setValue('transactionId', getNextTransactionId(selectedTransactionType));
      }
  }, [selectedTransactionType, isEditing, setValue, getNextTransactionId]);

  const handleTransactionIdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let value = e.target.value.trim();
      const prefix = selectedTransactionType === 'Income' ? 'IN' : 'EX';
      if (value && !isNaN(parseInt(value)) && isFinite(Number(value))) {
          value = formatTransactionId(parseInt(value), prefix);
          setValue('transactionId', value);
      }
      const foundTransaction = allTransactions.find(t => t.transactionId === value);
      if (foundTransaction) {
          handleEdit(foundTransaction);
      }
  };


  const handleNew = useCallback(() => {
    setIsEditing(null); 
    const nextId = getNextTransactionId(selectedTransactionType);
    reset(getInitialFormState(nextId));
    setIsAdvanced(false);
    setIsCalculated(false);
    setIsRecurring(false);
    setActiveTab("form");
  }, [reset, getNextTransactionId, selectedTransactionType]);

  useEffect(() => {
    const loanId = searchParams.get('loanId');
    if (loanId && loans.length > 0) {
      handleNew(); // Reset the form first
      setActiveTab("form");

      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        setValue('transactionType', 'Expense');
        setValue('amount', Number(searchParams.get('amount') || 0));
        setValue('payee', toTitleCase(searchParams.get('payee') || ''));
        setValue('description', searchParams.get('description') || '');
        setValue('expenseNature', 'Permanent'); 
      }
    }
  }, [searchParams, loans, setValue, handleNew]);

  const availableCategories = useMemo(() => {
    if (selectedTransactionType === 'Income') {
        return incomeCategories;
    }
    if (selectedTransactionType === 'Expense' && selectedExpenseNature) {
        return expenseCategories.filter(c => c.nature === selectedExpenseNature);
    }
    return [];
  }, [selectedTransactionType, selectedExpenseNature, incomeCategories, expenseCategories]);
  
  useEffect(() => {
      const loanId = searchParams.get('loanId');
      if (loanId && availableCategories.some(c => c.name === 'Interest & Loan Payments')) {
          const loan = loans.find(l => l.id === loanId);
          if (loan) {
              setValue('category', 'Interest & Loan Payments');
              setTimeout(() => {
                  setValue('subCategory', loan.loanName);
              }, 50);
          }
      }
  }, [availableCategories, searchParams, loans, setValue]);

  
  useEffect(() => {
    if (selectedCategory === 'Interest & Loan Payments' && selectedSubCategory) {
        const matchingLoans = loans.filter(l => l.loanName === selectedSubCategory);
        if (matchingLoans.length > 0) {
              setValue('loanId', matchingLoans[0].id);
        } else {
            setValue('loanId', '');
        }
    } else {
        setValue('loanId', '');
    }
  }, [selectedCategory, selectedSubCategory, loans, setValue]);

  useEffect(() => {
    if (isCalculated) {
      const calculatedAmount = (quantity || 0) * (rate || 0);
      setValue('amount', calculatedAmount);
    }
  }, [quantity, rate, isCalculated, setValue]);

  const availableSubCategories = useMemo(() => {
    if (selectedCategory === 'Interest & Loan Payments') {
        const uniqueLoanNames = Array.from(new Set(loans.map(l => l.loanName)));
        return uniqueLoanNames;
    }
    const categoryObj = availableCategories.find(c => c.name === selectedCategory);
    return categoryObj?.subCategories || [];
  }, [selectedCategory, availableCategories, loans]);

  useEffect(() => {
    const unsubIncomeCats = getIncomeCategories(setIncomeCategories, console.error);
    const unsubExpenseCats = getExpenseCategories(setExpenseCategories, console.error);
    
    return () => {
      unsubIncomeCats();
      unsubExpenseCats();
    };
  }, []);
  
    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        (bankAccounts || []).forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);

        (fundTransactions || []).forEach(t => {
             if (balances.has(t.source)) {
                balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            }
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        allTransactions.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) {
                if (t.transactionType === 'Income') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
                } else if (t.transactionType === 'Expense') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
                }
            }
        });
        
        return { balances };
    }, [fundTransactions, allTransactions, bankAccounts]);


  useEffect(() => {
    setValue('category', '');
    setValue('subCategory', '');
  }, [selectedTransactionType, selectedExpenseNature, setValue]);

  useEffect(() => {
    setValue('subCategory', '');
  }, [selectedCategory, setValue]);

  const handleEdit = (transaction: DisplayTransaction) => {
    setIsEditing(transaction.id);
    let subCategoryToSet = transaction.subCategory;
    
    if (transaction.category === 'Interest & Loan Payments' && transaction.loanId) {
        const loan = loans.find(l => l.id === transaction.loanId);
        if (loan) subCategoryToSet = loan.loanName;
    }
    
    reset({
      ...transaction,
      date: new Date(transaction.date), 
      taxAmount: transaction.taxAmount || 0,
      quantity: transaction.quantity || 0,
      rate: transaction.rate || 0,
      isCalculated: transaction.isCalculated || false,
      nextDueDate: transaction.nextDueDate ? new Date(transaction.nextDueDate) : undefined,
      subCategory: subCategoryToSet,
    });
    setIsAdvanced(!!(transaction.status || transaction.taxAmount || transaction.expenseType || transaction.mill || transaction.projectId));
    setIsCalculated(transaction.isCalculated || false);
    setIsRecurring(transaction.isRecurring || false);
    setActiveTab("form");
  };

  const handleDelete = async (transaction: DisplayTransaction) => {
    try {
      if (transaction.transactionType === 'Income') {
        await deleteIncome(transaction.id);
      } else {
        await deleteExpense(transaction.id);
      }
      toast({ title: "Transaction deleted.", variant: "success" });
      if (isEditing === transaction.id) handleNew();
    } catch (error) {
      console.error("Error deleting transaction: ", error);
      toast({ title: "Failed to delete transaction.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    if (values.transactionType === 'Expense') {
        const balanceKey = values.bankAccountId || (values.paymentMethod === 'Cash' ? 'CashInHand' : '');
        const availableBalance = financialState.balances.get(balanceKey) || 0;
        
        let amountToCheck = values.amount;
        if (isEditing) {
            const originalTx = allTransactions.find(tx => tx.id === isEditing);
            // If the account hasn't changed, we adjust the check amount.
            // If it has changed, we must check the full amount against the new account.
            if (originalTx && (originalTx.bankAccountId || 'CashInHand') === (values.bankAccountId || 'CashInHand')) {
                 amountToCheck = values.amount - originalTx.amount;
            }
        }
        
        if (amountToCheck > availableBalance) {
            const accountName = bankAccounts.find(acc => acc.id === balanceKey)?.accountHolderName || 'Cash in Hand';
            toast({
                title: "Insufficient Balance",
                description: `This transaction exceeds the available balance in ${accountName}.`,
                variant: "destructive"
            });
            return;
        }
    }
  
    setLoading(true);
    try {
      const transactionData: Partial<TransactionFormValues> = {
        ...values,
        date: format(values.date, "yyyy-MM-dd"), 
        payee: toTitleCase(values.payee),
        mill: toTitleCase(values.mill || ''),
        projectId: values.projectId === 'none' ? '' : values.projectId,
      };

      if (values.isRecurring && values.nextDueDate) {
          transactionData.nextDueDate = format(values.nextDueDate, "yyyy-MM-dd");
      } else {
          delete transactionData.nextDueDate;
      }

      if (values.paymentMethod === 'Cash') {
          delete transactionData.bankAccountId;
      }

      if (isEditing) {
        if (values.transactionType === 'Income') {
            await updateIncome(isEditing, transactionData as Omit<Income, 'id'>);
        } else {
            await updateExpense(isEditing, transactionData as Omit<Expense, 'id'>);
        }
        toast({ title: "Transaction updated.", variant: "success" });
      } else {
        if (values.transactionType === 'Income') {
            await addIncome(transactionData as Omit<Income, 'id'>);
        } else {
            await addExpense(transactionData as Omit<Expense, 'id'>);
        }
        toast({ title: "Transaction saved.", variant: "success" });
        
        if (transactionData.loanId) {
            const loanToUpdate = loans.find(l => l.id === transactionData.loanId);
            if (loanToUpdate && loanToUpdate.nextEmiDueDate) {
                const newDueDate = addMonths(new Date(loanToUpdate.nextEmiDueDate), 1);
                await updateLoan(loanToUpdate.id, { nextEmiDueDate: format(newDueDate, 'yyyy-MM-dd')});
            }
        }
      }
      
      handleNew();
    } catch (error) {
        console.error("Error saving transaction: ", error);
        toast({ title: "Failed to save transaction.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (event.altKey) {
            event.preventDefault();
            switch (event.key.toLowerCase()) {
                case 's':
                    handleSubmit(onSubmit)();
                    break;
                case 'n':
                    handleNew();
                    break;
                case 'd':
                    if (isEditing) {
                        const tx = allTransactions.find(t => t.id === isEditing);
                        if (tx) handleDelete(tx);
                    }
                    break;
                case 't':
                    setActiveTab(prev => prev === 'form' ? 'history' : 'form');
                    break;
            }
        }
    }, [handleSubmit, onSubmit, handleNew, isEditing, allTransactions, handleDelete]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);


  const requestSort = (key: keyof DisplayTransaction) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedTransactions = useMemo(() => {
    let sortableItems = [...allTransactions];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';
            if (valA &lt; valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA &gt; valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    return sortableItems;
  }, [allTransactions, sortConfig]);
  
  const { totalIncome, totalExpense, netProfitLoss, totalTransactions } = useMemo(() => {
    const incomeTotal = (income || []).reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = (expenses || []).reduce((sum, t) => sum + t.amount, 0);
    return {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      netProfitLoss: incomeTotal - expenseTotal,
      totalTransactions: allTransactions.length,
    };
  }, [income, expenses, allTransactions]);
  
    const handlePayeeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const payeeName = toTitleCase(e.target.value.trim());
        if (!payeeName) return;

        const latestTransaction = allTransactions
            .filter(t => toTitleCase(t.payee) === payeeName)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        if (latestTransaction) {
            if (latestTransaction.transactionType === 'Expense') {
                setValue('expenseNature', latestTransaction.expenseNature);
                 setTimeout(() => {
                    setValue('category', latestTransaction.category);
                    setTimeout(() => {
                        setValue('subCategory', latestTransaction.subCategory);
                    }, 50);
                }, 50);
            }
            toast({ title: 'Auto-filled!', description: `Details for ${payeeName} loaded.` });
        }
    };

    const handlePayeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, selectionStart, selectionEnd } = e.target;
        const capitalizedValue = toTitleCase(value);
        setValue('payee', capitalizedValue);
        // This is a trick to maintain cursor position after programmatic change
        requestAnimationFrame(() => {
            e.target.setSelectionRange(selectionStart, selectionEnd);
        });
    };

  if(loading) {
    return &lt;div&gt;Loading...&lt;/div&gt;
  }

  return (
    &lt;div className="space-y-6"&gt;
      &lt;SectionCard&gt;
          &lt;CardHeader&gt;
              &lt;CardTitle className="flex items-center gap-2"&gt;&lt;TrendingUp className="h-5 w-5 text-primary"/&gt;Transactions Overview&lt;/CardTitle&gt;
              &lt;CardDescription&gt;A summary of your recorded income and expenses.&lt;/CardDescription&gt;
          &lt;/CardHeader&gt;
          &lt;CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"&gt;
              &lt;StatCard title="Total Income" value={formatCurrency(totalIncome)} icon=&lt;CircleDollarSign /&gt; colorClass="text-green-500"/&gt;
              &lt;StatCard title="Total Expense" value={formatCurrency(totalExpense)} icon=&lt;CircleDollarSign /&gt; colorClass="text-red-500"/&gt;
              &lt;StatCard title="Net Profit/Loss" value={formatCurrency(netProfitLoss)} icon=&lt;BarChart /&gt; colorClass={netProfitLoss &gt;= 0 ? "text-green-500" : "text-red-500"}/&gt;
              &lt;StatCard title="Total Transactions" value={String(totalTransactions)} icon=&lt;Hash /&gt; /&gt;
          &lt;/CardContent&gt;
      &lt;/SectionCard&gt;
      
      &lt;Tabs value={activeTab} onValueChange={setActiveTab} className="w-full"&gt;
        &lt;div className="flex flex-col sm:flex-row justify-between items-center gap-2"&gt;
          &lt;TabsList className="w-full sm:w-auto"&gt;
            &lt;TabsTrigger value="form" className="flex-1 sm:flex-initial"&gt;&lt;FilePlus className="mr-2 h-4 w-4"/&gt;{isEditing ? 'Edit Transaction' : 'Add New Transaction'}&lt;/TabsTrigger&gt;
            &lt;TabsTrigger value="history" className="flex-1 sm:flex-initial"&gt;&lt;List className="mr-2 h-4 w-4"/&gt;Transaction History&lt;/TabsTrigger&gt;
          &lt;/TabsList&gt;
          &lt;div className="w-full sm:w-auto flex items-center gap-2"&gt;
            &lt;Button onClick={() =&gt; setIsCategoryManagerOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto"&gt;&lt;Settings className="mr-2 h-4 w-4" /&gt;Manage Categories&lt;/Button&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        &lt;TabsContent value="history" className="mt-4"&gt;
          &lt;SectionCard&gt;
            &lt;CardContent className="p-0"&gt;
              &lt;div className="overflow-x-auto"&gt;
                &lt;Table&gt;
                  &lt;TableHeader&gt;
                    &lt;TableRow&gt;
                      &lt;TableHead className="cursor-pointer" onClick={() =&gt; requestSort('date')}&gt;Date &lt;ArrowUpDown className="inline h-3 w-3 ml-1"/&gt; &lt;/TableHead&gt;
                      &lt;TableHead&gt;Type&lt;/TableHead&gt;
                      &lt;TableHead className="cursor-pointer" onClick={() =&gt; requestSort('category')}&gt;Category &lt;ArrowUpDown className="inline h-3 w-3 ml-1"/&gt;&lt;/TableHead&gt;
                      &lt;TableHead&gt;Sub-Category&lt;/TableHead&gt;
                      &lt;TableHead className="text-right"&gt;Amount&lt;/TableHead&gt;
                      &lt;TableHead&gt;Payee/Payer&lt;/TableHead&gt;
                       &lt;TableHead&gt;Mill&lt;/TableHead&gt;
                      &lt;TableHead className="text-center"&gt;Actions&lt;/TableHead&gt;
                    &lt;/TableRow&gt;
                  &lt;/TableHeader&gt;
                  &lt;TableBody&gt;
                    {sortedTransactions.map((transaction) =&gt; (
                      &lt;TableRow key={transaction.id}&gt;
                        &lt;TableCell&gt;{format(new Date(transaction.date), "dd-MMM-yy")}&lt;/TableCell&gt;
                        &lt;TableCell&gt;&lt;Badge variant={transaction.transactionType === 'Income' ? 'default' : 'destructive'} className={transaction.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80'}&gt;{transaction.transactionType}&lt;/Badge&gt;&lt;/TableCell&gt;
                        &lt;TableCell&gt;{transaction.category}&lt;/TableCell&gt;
                        &lt;TableCell&gt;{transaction.subCategory}&lt;/TableCell&gt;
                        &lt;TableCell className={cn("text-right font-medium", transaction.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}&gt;{formatCurrency(transaction.amount)}&lt;/TableCell&gt;
                        &lt;TableCell&gt;{transaction.payee}&lt;/TableCell&gt;
                        &lt;TableCell&gt;{transaction.mill}&lt;/TableCell&gt;
                        &lt;TableCell className="text-center"&gt;
                          &lt;Button variant="ghost" size="icon" className="h-7 w-7" onClick={() =&gt; handleEdit(transaction)}&gt;&lt;Pen className="h-4 w-4" /&gt;&lt;/Button&gt;
                          &lt;AlertDialog&gt;
                            &lt;AlertDialogTrigger asChild&gt;
                              &lt;Button variant="ghost" size="icon" className="h-7 w-7"&gt;&lt;Trash className="h-4 w-4 text-destructive" /&gt;&lt;/Button&gt;
                            &lt;/AlertDialogTrigger&gt;
                            &lt;AlertDialogContent&gt;
                              &lt;AlertDialogHeader&gt;
                                &lt;AlertDialogTitle&gt;Are you sure?&lt;/AlertDialogTitle&gt;
                                &lt;AlertDialogDescription&gt;
                                  This will permanently delete the transaction for "{toTitleCase(transaction.payee)}".
                                &lt;/AlertDialogDescription&gt;
                              &lt;/AlertDialogHeader&gt;
                              &lt;AlertDialogFooter&gt;
                                &lt;AlertDialogCancel&gt;Cancel&lt;/AlertDialogCancel&gt;
                                &lt;AlertDialogAction onClick={() =&gt; handleDelete(transaction)}&gt;Continue&lt;/AlertDialogAction&gt;
                              &lt;/AlertDialogFooter&gt;
                            &lt;/AlertDialogContent&gt;
                          &lt;/AlertDialog&gt;
                        &lt;/TableCell&gt;
                      &lt;/TableRow&gt;
                    ))}
                  &lt;/TableBody&gt;
                &lt;/Table&gt;
              &lt;/div&gt;
            &lt;/CardContent&gt;
          &lt;/SectionCard&gt;
        &lt;/TabsContent&gt;
        &lt;TabsContent value="form" className="mt-4"&gt;
           &lt;SectionCard&gt;
              &lt;CardContent className="p-6"&gt;
                 &lt;form onSubmit={handleSubmit(onSubmit)} className="space-y-4"&gt;
                    &lt;div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"&gt;
                      
                      &lt;Controller name="transactionType" control={control} render={({ field }) =&gt; (
                          &lt;div className="space-y-2"&gt;
                            &lt;Label className="text-xs"&gt;Transaction Type&lt;/Label&gt;
                            &lt;RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"&gt;
                              &lt;div className="flex items-center space-x-2"&gt;
                                &lt;RadioGroupItem value="Income" id="type-income" /&gt;
                                &lt;Label htmlFor="type-income" className="font-normal text-sm flex items-center gap-2"&gt;Income&lt;/Label&gt;
                              &lt;/div&gt;
                              &lt;div className="flex items-center space-x-2"&gt;
                                &lt;RadioGroupItem value="Expense" id="type-expense" /&gt;
                                &lt;Label htmlFor="type-expense" className="font-normal text-sm flex items-center gap-2"&gt;Expense&lt;/Label&gt;
                              &lt;/div&gt;
                            &lt;/RadioGroup&gt;
                          &lt;/div&gt;
                      )} /&gt;
                      
                      &lt;Controller name="date" control={control} render={({ field }) =&gt; (
                          &lt;div className="space-y-1"&gt;
                            &lt;Label className="text-xs"&gt;Date&lt;/Label&gt;
                            &lt;Popover&gt;
                                &lt;PopoverTrigger asChild&gt;
                                    &lt;Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value &amp;&amp; "text-muted-foreground")}&gt;
                                        &lt;CalendarIcon className="mr-2 h-4 w-4" /&gt;
                                        {field.value ? format(field.value, "PPP") : &lt;span&gt;Pick a date&lt;/span&gt;}
                                    &lt;/Button&gt;
                                &lt;/PopoverTrigger&gt;
                                &lt;PopoverContent className="w-auto p-0 z-[51]"&gt;
                                    &lt;CalendarComponent mode="single" selected={field.value} onSelect={(date) =&gt; field.onChange(date || new Date())} initialFocus /&gt;
                                &lt;/PopoverContent&gt;
                            &lt;/Popover&gt;
                          &lt;/div&gt;
                      )} /&gt;

                      &lt;div className="space-y-1"&gt;
                          &lt;Label htmlFor="amount" className="text-xs"&gt;Amount&lt;/Label&gt;
                          &lt;InputWithIcon icon=&lt;Wallet className="h-4 w-4 text-muted-foreground" /&gt;&gt;
                              &lt;Controller name="amount" control={control} render={({ field }) =&gt; &lt;Input id="amount" type="number" {...field} className="h-9 text-sm pl-10" readOnly={isCalculated}/&gt;} /&gt;
                          &lt;/InputWithIcon&gt;
                          {errors.amount &amp;&amp; &lt;p className="text-xs text-destructive mt-1"&gt;{errors.amount.message}&lt;/p&gt;}
                      &lt;/div&gt;
                       
                        {selectedTransactionType === 'Expense' &amp;&amp; (
                            &lt;Controller name="expenseNature" control={control} render={({ field }) =&gt; (
                              &lt;div className="space-y-1"&gt;
                                &lt;Label className="text-xs"&gt;Expense Nature&lt;/Label&gt;
                                &lt;CustomDropdown options={[{value: "Permanent", label: "Permanent"}, {value: "Seasonal", label: "Seasonal"}]} value={field.value} onChange={field.onChange} placeholder="Select Nature" /&gt;
                              &lt;/div&gt;
                            )} /&gt;
                        )}

                        &lt;Controller name="category" control={control} render={({ field }) =&gt; (
                          &lt;div className="space-y-1"&gt;
                            &lt;Label className="text-xs"&gt;Category&lt;/Label&gt;
                            &lt;CustomDropdown options={availableCategories.map(cat =&gt; ({ value: cat.name, label: cat.name }))} value={field.value} onChange={field.onChange} placeholder="Select Category" /&gt;
                            {errors.category &amp;&amp; &lt;p className="text-xs text-destructive mt-1"&gt;{errors.category.message}&lt;/p&gt;}
                          &lt;/div&gt;
                        )} /&gt;

                        &lt;Controller name="subCategory" control={control} render={({ field }) =&gt; (
                          &lt;div className="space-y-1"&gt;
                            &lt;Label className="text-xs"&gt;Sub-Category&lt;/Label&gt;
                            &lt;CustomDropdown options={availableSubCategories.map(subCat =&gt; ({ value: subCat, label: subCat }))} value={field.value} onChange={field.onChange} placeholder="Select Sub-Category" /&gt;
                            {errors.subCategory &amp;&amp; &lt;p className="text-xs text-destructive mt-1"&gt;{errors.subCategory.message}&lt;/p&gt;}
                          &lt;/div&gt;
                        )} /&gt;

                      &lt;div className="space-y-1"&gt;
                          &lt;Label htmlFor="payee" className="text-xs"&gt;
                            {selectedTransactionType === 'Income' ? 'Payer (Received From)' : 'Payee (Paid To)'}
                          &lt;/Label&gt;
                           &lt;InputWithIcon icon=&lt;User className="h-4 w-4 text-muted-foreground" /&gt;&gt;
                               &lt;Controller name="payee" control={control} render={({ field }) =&gt; &lt;Input id="payee" {...field} onChange={handlePayeeChange} onBlur={handlePayeeBlur} className="h-8 text-sm pl-10" /&gt; } /&gt;
                           &lt;/InputWithIcon&gt;
                          {errors.payee &amp;&amp; &lt;p className="text-xs text-destructive mt-1"&gt;{errors.payee.message}&lt;/p&gt;}
                      &lt;/div&gt;
                      
                        &lt;div className="space-y-1"&gt;
                            &lt;Label htmlFor="paymentMethod" className="text-xs"&gt;Payment Method&lt;/Label&gt;
                            &lt;CustomDropdown
                                options={[
                                    { value: "Cash", label: "Cash" },
                                    ...bankAccounts.map(acc =&gt; ({ value: acc.id, label: `${acc.bankName} (...${acc.accountNumber.slice(-4)})` }))
                                ]}
                                value={selectedPaymentMethod === 'Cash' ? 'Cash' : bankAccounts.find(acc =&gt; acc.id === watch('bankAccountId'))?.id}
                                onChange={(value) =&gt; {
                                    if (value === 'Cash') {
                                        setValue('paymentMethod', 'Cash');
                                        setValue('bankAccountId', undefined);
                                    } else {
                                        const account = bankAccounts.find(acc =&gt; acc.id === value);
                                        setValue('paymentMethod', account?.bankName || '');
                                        setValue('bankAccountId', value);
                                    }
                                }}
                                placeholder="Select Payment Method"
                            /&gt;
                        &lt;/div&gt;

                        &lt;div className="space-y-1"&gt;
                            &lt;Label htmlFor="transactionId" className="text-xs"&gt;Transaction ID&lt;/Label&gt;
                            &lt;InputWithIcon icon=&lt;FileText className="h-4 w-4 text-muted-foreground" /&gt;&gt;
                                &lt;Input id="transactionId" {...register("transactionId")} onBlur={handleTransactionIdBlur} className="h-8 text-sm pl-10" /&gt;
                            &lt;/InputWithIcon&gt;
                        &lt;/div&gt;
                    &lt;/div&gt;

                    {isAdvanced &amp;&amp; (
                        &lt;div className="border-t pt-4 mt-4"&gt;
                            &lt;h3 className="text-sm font-semibold mb-2"&gt;Advanced Options&lt;/h3&gt;
                            &lt;div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"&gt;
                                
                                &lt;div className="space-y-1"&gt;
                                    &lt;Label htmlFor="status" className="text-xs"&gt;Status&lt;/Label&gt;
                                    &lt;Controller
                                        name="status"
                                        control={control}
                                        render={({ field }) =&gt; (
                                            &lt;CustomDropdown
                                                options={[
                                                    { value: "Paid", label: "Paid" },
                                                    { value: "Pending", label: "Pending" },
                                                    { value: "Overdue", label: "Overdue" }
                                                ]}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select Status"
                                            /&gt;
                                        )}
                                    /&gt;
                                &lt;/div&gt;

                                &lt;div className="space-y-1"&gt;
                                    &lt;Label htmlFor="taxAmount" className="text-xs"&gt;Tax Amount&lt;/Label&gt;
                                    &lt;Controller
                                        name="taxAmount"
                                        control={control}
                                        render={({ field }) =&gt; (
                                            &lt;InputWithIcon icon=&lt;Percent className="h-4 w-4 text-muted-foreground" /&gt;&gt;
                                                &lt;Input id="taxAmount" type="number" {...field} className="h-8 text-sm pl-10" /&gt;
                                            &lt;/InputWithIcon&gt;
                                        )}
                                    /&gt;
                                &lt;/div&gt;

                                {selectedTransactionType === 'Expense' &amp;&amp; (
                                    &lt;Controller
                                        name="expenseType"
                                        control={control}
                                        render={({ field }) =&gt; (
                                            &lt;div className="space-y-1"&gt;
                                                &lt;Label className="text-xs"&gt;Expense Type&lt;/Label&gt;
                                                &lt;CustomDropdown
                                                    options={[
                                                        { value: "Personal", label: "Personal" },
                                                        { value: "Business", label: "Business" }
                                                    ]}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Select Expense Type"
                                                /&gt;
                                            &lt;/div&gt;
                                        )}
                                    /&gt;
                                )}

                                &lt;div className="space-y-1"&gt;
                                    &lt;Label htmlFor="mill" className="text-xs"&gt;Mill&lt;/Label&gt;
                                    &lt;Controller
                                        name="mill"
                                        control={control}
                                        render={({ field }) =&gt; (
                                            &lt;InputWithIcon icon=&lt;Landmark className="h-4 w-4 text-muted-foreground" /&gt;&gt;
                                                &lt;Input id="mill" {...field} className="h-8 text-sm pl-10" /&gt;
                                            &lt;/InputWithIcon&gt;
                                        )}
                                    /&gt;
                                &lt;/div&gt;
                                
                                &lt;div className="space-y-1"&gt;
                                    &lt;Label className="text-xs"&gt;Project&lt;/Label&gt;
                                    &lt;Controller
                                        name="projectId"
                                        control={control}
                                        render={({ field }) =&gt; (
                                            &lt;CustomDropdown
                                                options={[
                                                    { value: 'none', label: 'None' },
                                                    ...projects.map(project =&gt; ({ value: project.id, label: project.name }))
                                                ]}
                                                value={field.value || 'none'}
                                                onChange={field.onChange}
                                                placeholder="Select Project"
                                            /&gt;
                                        )}
                                    /&gt;
                                &lt;/div&gt;
                            &lt;/div&gt;
                        &lt;/div&gt;
                    )}
                    
                    {isCalculated &amp;&amp; (
                      &lt;div className="border-t pt-4 mt-4"&gt;
                        &lt;h3 className="text-sm font-semibold mb-2"&gt;Calculation&lt;/h3&gt;
                          &lt;div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"&gt;
                            &lt;div className="space-y-1"&gt;
                                &lt;Label htmlFor="quantity" className="text-xs"&gt;Quantity&lt;/Label&gt;
                                &lt;Controller name="quantity" control={control} render={({ field }) =&gt; &lt;Input id="quantity" type="number" {...field} className="h-8 text-sm" /&gt;} /&gt;
                            &lt;/div&gt;

                            &lt;div className="space-y-1"&gt;
                                &lt;Label htmlFor="rate" className="text-xs"&gt;Rate&lt;/Label&gt;
                                &lt;Controller name="rate" control={control} render={({ field }) =&gt; &lt;Input id="rate" type="number" {...field} className="h-8 text-sm" /&gt;} /&gt;
                            &lt;/div&gt;
                          &lt;/div&gt;
                      &lt;/div&gt;
                    )}

                    {isRecurring &amp;&amp; (
                      &lt;div className="border-t pt-4 mt-4"&gt;
                        &lt;h3 className="text-sm font-semibold mb-2"&gt;Recurring Details&lt;/h3&gt;
                          &lt;div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"&gt;
                              &lt;Controller name="recurringFrequency" control={control} render={({ field }) =&gt; (
                                  &lt;div className="space-y-1"&gt;
                                      &lt;Label className="text-xs"&gt;Frequency&lt;/Label&gt;
                                      &lt;CustomDropdown
                                          options={[
                                              { value: "daily", label: "Daily" },
                                              { value: "weekly", label: "Weekly" },
                                              { value: "monthly", label: "Monthly" },
                                              { value: "yearly", label: "Yearly" }
                                          ]}
                                          value={field.value}
                                          onChange={field.onChange}
                                          placeholder="Select Frequency"
                                      /&gt;
                                  &lt;/div&gt;
                              )} /&gt;

                              &lt;Controller name="nextDueDate" control={control} render={({ field }) =&gt; (
                                  &lt;div className="space-y-1"&gt;
                                      &lt;Label className="text-xs"&gt;Next Due Date&lt;/Label&gt;
                                      &lt;Popover&gt;
                                          &lt;PopoverTrigger asChild&gt;
                                              &lt;Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value &amp;&amp; "text-muted-foreground")}&gt;
                                                  &lt;CalendarIcon className="mr-2 h-4 w-4" /&gt;
                                                  {field.value ? format(field.value, "PPP") : &lt;span&gt;Pick a date&lt;/span&gt;}
                                              &lt;/Button&gt;
                                          &lt;/PopoverTrigger&gt;
                                          &lt;PopoverContent className="w-auto p-0 z-[51]"&gt;
                                              &lt;CalendarComponent mode="single" selected={field.value} onSelect={(date) =&gt; field.onChange(date || new Date())} initialFocus /&gt;
                                          &lt;/PopoverContent&gt;
                                      &lt;/Popover&gt;
                                  &lt;/div&gt;
                              )} /&gt;
                          &lt;/div&gt;
                      &lt;/div&gt;
                    )}
                    
                    &lt;div className="space-y-2"&gt;
                      &lt;Label htmlFor="description" className="text-xs"&gt;Description&lt;/Label&gt;
                      &lt;Controller name="description" control={control} render={({ field }) =&gt; &lt;Textarea id="description" placeholder="Brief description of the transaction..." className="h-16 text-sm" {...field} /&gt;} /&gt;
                    &lt;/div&gt;

                    &lt;div className="flex justify-between items-center"&gt;
                      &lt;div className="flex items-center space-x-2"&gt;
                          &lt;Switch id="isAdvanced" checked={isAdvanced} onCheckedChange={setIsAdvanced} /&gt;
                          &lt;Label htmlFor="isAdvanced" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"&gt;
                              Advanced
                          &lt;/Label&gt;
                      &lt;/div&gt;
                      &lt;div className="flex items-center space-x-2"&gt;
                          &lt;Switch id="isCalculated" checked={isCalculated} onCheckedChange={setIsCalculated} /&gt;
                          &lt;Label htmlFor="isCalculated" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"&gt;
                              Calculate
                          &lt;/Label&gt;
                      &lt;/div&gt;
                      &lt;div className="flex items-center space-x-2"&gt;
                          &lt;Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} /&gt;
                          &lt;Label htmlFor="isRecurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"&gt;
                              Recurring
                          &lt;/Label&gt;
                      &lt;/div&gt;
                      &lt;div className="flex space-x-2"&gt;
                        &lt;Button type="button" variant="ghost" onClick={handleNew}&gt;&lt;RefreshCw className="mr-2 h-4 w-4" /&gt;New&lt;/Button&gt;
                        &lt;Button type="submit" disabled={loading}&gt;&lt;Save className="mr-2 h-4 w-4" /&gt;{isEditing ? 'Update' : 'Save'}&lt;/Button&gt;
                      &lt;/div&gt;
                    &lt;/div&gt;
                 &lt;/form&gt;
              &lt;/CardContent&gt;
           &lt;/SectionCard&gt;
        &lt;/TabsContent&gt;
      &lt;/Tabs&gt;
      &lt;CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onAddCategory={addCategory}
        onUpdateCategoryName={updateCategoryName}
        onDeleteCategory={deleteCategory}
        onAddSubCategory={addSubCategory}
        onDeleteSubCategory={deleteSubCategory}
      /&gt;
    &lt;/div&gt;
  );
}

    
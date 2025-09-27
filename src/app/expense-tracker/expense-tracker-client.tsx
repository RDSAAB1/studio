
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { getIncomeCategories, getExpenseCategories, addCategory, updateCategoryName, deleteCategory, addSubCategory, deleteSubCategory, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getExpensesRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getProjectsRealtime } from "@/lib/firestore";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; 


import { Loader2, Pen, PlusCircle, Save, Trash, Calendar as CalendarIcon, Tag, User, Wallet, Info, FileText, ArrowUpDown, TrendingUp, Hash, Percent, RefreshCw, Briefcase, UserCircle, FilePlus, List, BarChart, CircleDollarSign, Landmark, Building2, SunMoon, Layers3, FolderTree, ArrowLeftRight, Settings, SlidersHorizontal, Calculator, HandCoins } from "lucide-react";
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

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("form");
  const [sortConfig, setSortConfig] = useState<{ key: keyof DisplayTransaction; direction: 'ascending' | 'descending' } | null>(null);
  
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  
  const [isPayeePopoverOpen, setIsPayeePopoverOpen] = useState(false);

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
      setIsPageLoading(false);
    }
  }, [income, expenses])

  const allTransactions: DisplayTransaction[] = useMemo(() => {
      const combined = [...(income || []), ...(expenses || [])];
      return combined.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [income, expenses]);

  const uniquePayees = useMemo(() => {
      const payees = new Set((allTransactions || []).map(t => toTitleCase(t.payee)));
      return Array.from(payees).sort();
  }, [allTransactions]);

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
    const nextId = getNextTransactionId('Expense');
    reset(getInitialFormState(nextId));
    setValue('transactionType', 'Expense');
    setIsAdvanced(false);
    setIsCalculated(false);
    setIsRecurring(false);
    setActiveTab("form");
  }, [reset, getNextTransactionId, setValue]);

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
  
    setIsSubmitting(true);
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
        setIsSubmitting(false);
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
            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
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
  
  const handleAutoFill = useCallback((payeeName: string) => {
    const trimmedPayeeName = toTitleCase(payeeName.trim());
    if (!trimmedPayeeName) return;

    const latestTransaction = allTransactions
        .filter(t => toTitleCase(t.payee) === trimmedPayeeName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    if (latestTransaction && latestTransaction.transactionType === 'Expense' && latestTransaction.expenseNature) {
        setValue('expenseNature', latestTransaction.expenseNature);
        setTimeout(() => {
            setValue('category', latestTransaction.category);
            setTimeout(() => {
                setValue('subCategory', latestTransaction.subCategory);
            }, 50);
        }, 50);
        toast({ title: 'Auto-filled!', description: `Details for ${trimmedPayeeName} loaded.` });
    }
  }, [allTransactions, setValue, toast]);
    
  const getDisplayId = (transaction: DisplayTransaction): string => {
      if (transaction.category === 'Supplier Payments') {
          const paymentIdMatch = transaction.description?.match(/Payment (\S+)/);
          return paymentIdMatch?.[1] || transaction.transactionId || 'N/A';
      }
      return transaction.transactionId || 'N/A';
  };

  if(isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <SectionCard>
          <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Transactions Overview</CardTitle>
              <CardDescription>A summary of your recorded income and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Income" value={formatCurrency(totalIncome)} icon={<CircleDollarSign />} colorClass="text-green-500"/>
              <StatCard title="Total Expense" value={formatCurrency(totalExpense)} icon={<CircleDollarSign />} colorClass="text-red-500"/>
              <StatCard title="Net Profit/Loss" value={formatCurrency(netProfitLoss)} icon={<BarChart />} colorClass={netProfitLoss >= 0 ? "text-green-500" : "text-red-500"}/>
              <StatCard title="Total Transactions" value={String(totalTransactions)} icon={<Hash />} />
          </CardContent>
      </SectionCard>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="form" className="flex-1 sm:flex-initial"><FilePlus className="mr-2 h-4 w-4"/>{isEditing ? 'Edit Transaction' : 'Add New Transaction'}</TabsTrigger>
            <TabsTrigger value="history" className="flex-1 sm:flex-initial"><List className="mr-2 h-4 w-4"/>Transaction History</TabsTrigger>
          </TabsList>
          <div className="w-full sm:w-auto flex items-center gap-2">
            <Button onClick={() => setIsCategoryManagerOpen(true)} size="sm" variant="outline" className="w-full sm:w-auto"><Settings className="mr-2 h-4 w-4" />Manage Categories</Button>
          </div>
        </div>
        <TabsContent value="history" className="mt-4">
          <SectionCard>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1"/> </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => requestSort('category')}>Category <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                      <TableHead>Sub-Category</TableHead>
                      <TableHead>Payee/Payer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                       <TableHead>Mill</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), "dd-MMM-yy")}</TableCell>
                        <TableCell className="font-mono text-xs">{getDisplayId(transaction)}</TableCell>
                        <TableCell><Badge variant={transaction.transactionType === 'Income' ? 'default' : 'destructive'} className={transaction.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80'}>{transaction.transactionType}</Badge></TableCell>
                        <TableCell>{transaction.category}</TableCell>
                        <TableCell>{transaction.subCategory}</TableCell>
                        <TableCell>{transaction.payee}</TableCell>
                        <TableCell className={cn("text-right font-medium", transaction.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell>{transaction.mill}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(transaction)}><Pen className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Trash className="h-4 w-4 text-destructive" /></Button>
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
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </SectionCard>
        </TabsContent>
        <TabsContent value="form" className="mt-4">
           <SectionCard>
              <CardContent className="p-6">
                 <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      
                      <Controller name="transactionType" control={control} render={({ field }) => (
                          <div className="space-y-2">
                            <Label className="text-xs">Transaction Type</Label>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Income" id="type-income" />
                                <Label htmlFor="type-income" className="font-normal text-sm flex items-center gap-2">Income</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Expense" id="type-expense" />
                                <Label htmlFor="type-expense" className="font-normal text-sm flex items-center gap-2">Expense</Label>
                              </div>
                            </RadioGroup>
                          </div>
                      )} />
                      
                      <Controller name="date" control={control} render={({ field }) => (
                          <div className="space-y-1">
                            <Label className="text-xs">Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[51]">
                                    <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus />
                                </PopoverContent>
                            </Popover>
                          </div>
                      )} />
                      
                      <div className="space-y-1">
                          <Label htmlFor="transactionId" className="text-xs">Transaction ID</Label>
                          <InputWithIcon icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                              <Input id="transactionId" {...register("transactionId")} onBlur={handleTransactionIdBlur} className="h-8 text-sm pl-10" />
                          </InputWithIcon>
                      </div>
                      
                      <div className="space-y-1">
                          <Label htmlFor="amount" className="text-xs">Amount</Label>
                          <InputWithIcon icon={<Wallet className="h-4 w-4 text-muted-foreground" />}>
                              <Controller name="amount" control={control} render={({ field }) => <Input id="amount" type="number" {...field} className="h-9 text-sm pl-10" readOnly={isCalculated}/>} />
                          </InputWithIcon>
                          {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount.message}</p>}
                      </div>
                      
                       <div className="space-y-1">
                            <Label htmlFor="payee" className="text-xs">
                                {selectedTransactionType === 'Income' ? 'Payer (Received From)' : 'Payee (Paid To)'}
                            </Label>
                            <CustomDropdown
                                options={uniquePayees.map(p => ({ value: p, label: p }))}
                                value={watch('payee')}
                                onChange={(value) => {
                                    setValue('payee', toTitleCase(value || ''));
                                    if (value) handleAutoFill(value);
                                }}
                                onAdd={(newValue) => {
                                  setValue('payee', toTitleCase(newValue));
                                }}
                                placeholder="Search or add payee..."
                            />
                           {errors.payee && <p className="text-xs text-destructive mt-1">{errors.payee.message}</p>}
                       </div>

                       
                        {selectedTransactionType === 'Expense' && (
                            <Controller name="expenseNature" control={control} render={({ field }) => (
                              <div className="space-y-1">
                                <Label className="text-xs">Expense Nature</Label>
                                <CustomDropdown options={[{value: "Permanent", label: "Permanent"}, {value: "Seasonal", label: "Seasonal"}]} value={field.value} onChange={field.onChange} placeholder="Select Nature" />
                              </div>
                            )} />
                        )}

                        <Controller name="category" control={control} render={({ field }) => (
                          <div className="space-y-1">
                            <Label className="text-xs">Category</Label>
                            <CustomDropdown options={availableCategories.map(cat => ({ value: cat.name, label: cat.name }))} value={field.value} onChange={field.onChange} placeholder="Select Category" />
                            {errors.category && <p className="text-xs text-destructive mt-1">{errors.category.message}</p>}
                          </div>
                        )} />

                        <Controller name="subCategory" control={control} render={({ field }) => (
                          <div className="space-y-1">
                            <Label className="text-xs">Sub-Category</Label>
                            <CustomDropdown options={availableSubCategories.map(subCat => ({ value: subCat, label: subCat }))} value={field.value} onChange={field.onChange} placeholder="Select Sub-Category" />
                            {errors.subCategory && <p className="text-xs text-destructive mt-1">{errors.subCategory.message}</p>}
                          </div>
                        )} />
                      
                        <div className="space-y-1">
                            <Label htmlFor="paymentMethod" className="text-xs">Payment Method</Label>
                            <CustomDropdown
                                options={[
                                    { value: "Cash", label: "Cash" },
                                    ...bankAccounts.map(acc => ({ value: acc.id, label: `${acc.bankName} (...${acc.accountNumber.slice(-4)})` }))
                                ]}
                                value={selectedPaymentMethod === 'Cash' ? 'Cash' : bankAccounts.find(acc => acc.id === watch('bankAccountId'))?.id}
                                onChange={(value) => {
                                    if (value === 'Cash') {
                                        setValue('paymentMethod', 'Cash');
                                        setValue('bankAccountId', undefined);
                                    } else {
                                        const account = bankAccounts.find(acc => acc.id === value);
                                        setValue('paymentMethod', account?.bankName || '');
                                        setValue('bankAccountId', value);
                                    }
                                }}
                                placeholder="Select Payment Method"
                            />
                        </div>

                    </div>

                    {isAdvanced && (
                        <div className="border-t pt-4 mt-4">
                            <h3 className="text-sm font-semibold mb-2">Advanced Options</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                
                                <div className="space-y-1">
                                    <Label htmlFor="status" className="text-xs">Status</Label>
                                    <Controller
                                        name="status"
                                        control={control}
                                        render={({ field }) => (
                                            <CustomDropdown
                                                options={[
                                                    { value: "Paid", label: "Paid" },
                                                    { value: "Pending", label: "Pending" },
                                                    { value: "Overdue", label: "Overdue" }
                                                ]}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select Status"
                                            />
                                        )}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="taxAmount" className="text-xs">Tax Amount</Label>
                                    <Controller
                                        name="taxAmount"
                                        control={control}
                                        render={({ field }) => (
                                            <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                                <Input id="taxAmount" type="number" {...field} className="h-8 text-sm pl-10" />
                                            </InputWithIcon>
                                        )}
                                    />
                                </div>

                                {selectedTransactionType === 'Expense' && (
                                    <Controller
                                        name="expenseType"
                                        control={control}
                                        render={({ field }) => (
                                            <div className="space-y-1">
                                                <Label className="text-xs">Expense Type</Label>
                                                <CustomDropdown
                                                    options={[
                                                        { value: "Personal", label: "Personal" },
                                                        { value: "Business", label: "Business" }
                                                    ]}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Select Expense Type"
                                                />
                                            </div>
                                        )}
                                    />
                                )}

                                <div className="space-y-1">
                                    <Label htmlFor="mill" className="text-xs">Mill</Label>
                                    <Controller
                                        name="mill"
                                        control={control}
                                        render={({ field }) => (
                                            <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                                <Input id="mill" {...field} className="h-8 text-sm pl-10" />
                                            </InputWithIcon>
                                        )}
                                    />
                                </div>
                                
                                <div className="space-y-1">
                                    <Label className="text-xs">Project</Label>
                                    <Controller
                                        name="projectId"
                                        control={control}
                                        render={({ field }) => (
                                            <CustomDropdown
                                                options={[
                                                    { value: 'none', label: 'None' },
                                                    ...projects.map(project => ({ value: project.id, label: project.name }))
                                                ]}
                                                value={field.value || 'none'}
                                                onChange={field.onChange}
                                                placeholder="Select Project"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {isCalculated && (
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-sm font-semibold mb-2">Calculation</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                                <Controller name="quantity" control={control} render={({ field }) => <Input id="quantity" type="number" {...field} className="h-8 text-sm" />} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="rate" className="text-xs">Rate</Label>
                                <Controller name="rate" control={control} render={({ field }) => <Input id="rate" type="number" {...field} className="h-8 text-sm" />} />
                            </div>
                          </div>
                      </div>
                    )}

                    {isRecurring && (
                      <div className="border-t pt-4 mt-4">
                        <h3 className="text-sm font-semibold mb-2">Recurring Details</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <Controller name="recurringFrequency" control={control} render={({ field }) => (
                                  <div className="space-y-1">
                                      <Label className="text-xs">Frequency</Label>
                                      <CustomDropdown
                                          options={[
                                              { value: "daily", label: "Daily" },
                                              { value: "weekly", label: "Weekly" },
                                              { value: "monthly", label: "Monthly" },
                                              { value: "yearly", label: "Yearly" }
                                          ]}
                                          value={field.value}
                                          onChange={field.onChange}
                                          placeholder="Select Frequency"
                                      />
                                  </div>
                              )} />

                              <Controller name="nextDueDate" control={control} render={({ field }) => (
                                  <div className="space-y-1">
                                      <Label className="text-xs">Next Due Date</Label>
                                      <Popover>
                                          <PopoverTrigger asChild>
                                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value && "text-muted-foreground")}>
                                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                              </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0 z-[51]">
                                              <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus />
                                          </PopoverContent>
                                      </Popover>
                                  </div>
                              )} />
                          </div>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-xs">Description</Label>
                      <Controller name="description" control={control} render={({ field }) => <Textarea id="description" placeholder="Brief description of the transaction..." className="h-16 text-sm" {...field} />} />
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                          <Switch id="isAdvanced" checked={isAdvanced} onCheckedChange={setIsAdvanced} />
                          <Label htmlFor="isAdvanced" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                              Advanced
                          </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <Switch id="isCalculated" checked={isCalculated} onCheckedChange={setIsCalculated} />
                          <Label htmlFor="isCalculated" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                              Calculate
                          </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
                          <Label htmlFor="isRecurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                              Recurring
                          </Label>
                      </div>
                      <div className="flex space-x-2">
                        <Button type="button" variant="ghost" onClick={handleNew}><RefreshCw className="mr-2 h-4 w-4" />New</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isEditing ? 'Update' : 'Save'}
                        </Button>
                      </div>
                    </div>
                 </form>
              </CardContent>
           </SectionCard>
        </TabsContent>
      </Tabs>
      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onAddCategory={addCategory}
        onUpdateCategoryName={updateCategoryName}
        onDeleteCategory={deleteCategory}
        onAddSubCategory={addSubCategory}
        onDeleteSubCategory={deleteSubCategory}
      />
    </div>
  );
}



"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory, Project, FundTransaction, Loan, BankAccount, Income, Expense, Payment, PayeeProfile } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, generateReadableId } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { getIncomeCategories, getExpenseCategories, addCategory, updateCategoryName, deleteCategory, addSubCategory, deleteSubCategory, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getExpensesRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getProjectsRealtime, getPaymentsRealtime, getPayeeProfilesRealtime } from "@/lib/firestore";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase"; 


import { Loader2, Pen, PlusCircle, Save, Trash, Calendar as CalendarIcon, FileText, ArrowUpDown, Percent, RefreshCw, Landmark, Settings, Printer } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, addMonths } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

// Zod Schema for form validation
const transactionFormSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string().optional(),
  date: z.date(),
  transactionType: z.enum(["Income", "Expense"]),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  incomeAmount: z.coerce.number().optional(),
  expenseAmount: z.coerce.number().optional(),
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
  expenseNature: z.string().optional(),
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
  // Use persistent date from localStorage, fallback to today
  let persistentDate = new Date();
  if (typeof window !== 'undefined') {
    const savedDate = localStorage.getItem('incomeExpenseDate');
    if (savedDate) {
      persistentDate = new Date(savedDate);
    }
  }
  
  return {
    date: persistentDate,
    transactionType: 'Expense',
    category: '',
    subCategory: '',
    amount: 0,
    incomeAmount: 0,
    expenseAmount: 0,
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


const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

const SummaryMetricsCard = ({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; tone?: string; subtext?: string }>;
}) => (
  <Card>
    <CardContent className="p-2 sm:p-3">
      <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "flex-1 min-w-[140px] sm:pl-0",
              index !== 0 && "sm:border-l sm:border-border/40 sm:pl-4"
            )}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              {metric.label}
            </div>
            <div className={cn("mt-0.5 text-base font-semibold text-foreground", metric.tone)}>
              {metric.value}
            </div>
            {metric.subtext && (
              <div className="text-[11px] text-muted-foreground mt-0.5">{metric.subtext}</div>
            )}
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

export default function IncomeExpenseClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();

  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DisplayTransaction | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof DisplayTransaction; direction: 'ascending' | 'descending' }>({
    key: 'transactionId',
    direction: 'descending',
  });
  
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const [payeeProfiles, setPayeeProfiles] = useState<Map<string, PayeeProfile>>(new Map());
  const [lastAmountSource, setLastAmountSource] = useState<'income' | 'expense' | null>(null);

    useEffect(() => {
        const unsubIncome = getIncomeRealtime(setIncome, console.error);
        const unsubExpenses = getExpensesRealtime(setExpenses, console.error);
        const unsubPayments = getPaymentsRealtime(setPayments, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubProjects = getProjectsRealtime(setProjects, console.error);

        return () => {
            unsubIncome(); unsubExpenses(); unsubFunds(); unsubLoans(); unsubAccounts(); unsubProjects(); unsubPayments();
        }
    }, []);

  useEffect(() => {
    if(income !== undefined && expenses !== undefined) {
      setIsPageLoading(false);
    }
  }, [income, expenses])

  const allTransactions: DisplayTransaction[] = useMemo(() => {
      if (!income || !expenses) return [];
      const combined = [...income, ...expenses];
      return combined.sort((a, b) => (b.transactionId || '').localeCompare(a.transactionId || ''));
  }, [income, expenses]);

  const uniquePayees = useMemo(() => {
      const payees = new Set((allTransactions || []).map(t => toTitleCase(t.payee)));
      return Array.from(payees).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
      if (!selectedAccount) return allTransactions;
      return allTransactions.filter(
          (transaction) => toTitleCase(transaction.payee) === selectedAccount
      );
  }, [allTransactions, selectedAccount]);

  const accountOptions = useMemo(() => {
      const names = new Set<string>();
      payeeProfiles.forEach((_profile, name) => names.add(toTitleCase(name)));
      uniquePayees.forEach(name => names.add(toTitleCase(name)));

      return Array.from(names)
          .sort((a, b) => a.localeCompare(b))
          .map(name => {
              const profile = payeeProfiles.get(name) || payeeProfiles.get(toTitleCase(name));
              const labelParts = [name];
              if (profile?.category) {
                  labelParts.push(profile.subCategory ? `${profile.category} › ${profile.subCategory}` : profile.category);
              }
              if (profile?.contact) {
                  labelParts.push(profile.contact);
              }
              return {
                  value: name,
                  label: labelParts.join(' | '),
                  data: {
                      name,
                      category: profile?.category,
                      subCategory: profile?.subCategory,
                      contact: profile?.contact,
                      address: profile?.address,
                  },
              };
          });
  }, [payeeProfiles, uniquePayees]);

  const getNextTransactionId = useCallback((type: 'Income' | 'Expense') => {
      const prefix = type === 'Income' ? 'IN' : 'EX';
      
      // Check transactions
      const relevantTransactions = allTransactions.filter(t => t.transactionId?.startsWith(prefix));
      let lastNum = relevantTransactions.reduce((max, t) => {
          const numMatch = t.transactionId?.match(/^(IN|EX)(\d+)$/);
          if (numMatch && numMatch[2]) {
              const num = parseInt(numMatch[2], 10);
              return num > max ? num : max;
          }
          return max;
      }, 0);
      
      // For Expenses, also check supplier payments (they use EX prefix too!)
      if (type === 'Expense' && payments && payments.length > 0) {
          const paymentLastNum = payments.reduce((max, p) => {
              if (p.paymentId?.startsWith('EX')) {
                  const numMatch = p.paymentId?.match(/^EX(\d+)$/);
                  if (numMatch && numMatch[1]) {
                      const num = parseInt(numMatch[1], 10);
                      return num > max ? num : max;
                  }
              }
              return max;
          }, 0);
          lastNum = Math.max(lastNum, paymentLastNum);
      }
      
      return generateReadableId(prefix, lastNum, 5);
  }, [allTransactions, payments]);

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
  const incomeAmountValue = watch('incomeAmount');
  const expenseAmountValue = watch('expenseAmount');
  const payeeValue = watch('payee');

  const selectedAccountProfile = useMemo(() => {
      if (!payeeValue) return undefined;
      return payeeProfiles.get(toTitleCase(payeeValue));
  }, [payeeValue, payeeProfiles]);

  const summaryDetails = useMemo(() => {
      const displayName = selectedAccountProfile?.name || selectedAccount || 'Select an account';
      const fallbackNature = filteredTransactions.find(tx => (tx as any).expenseNature)?.expenseNature;
      const fallbackCategory = filteredTransactions.find(tx => tx.category)?.category;
      const fallbackSubCategory = filteredTransactions.find(tx => tx.subCategory)?.subCategory;

      const normalize = (value: string | undefined | null) => {
          if (!value) return '—';
          return toTitleCase(value);
      };

      return {
          name: displayName,
          contact: selectedAccountProfile?.contact || '—',
          address: selectedAccountProfile?.address || '—',
          nature: normalize(selectedAccountProfile?.nature || fallbackNature || undefined),
          category: normalize(selectedAccountProfile?.category || fallbackCategory || undefined),
          subCategory: normalize(selectedAccountProfile?.subCategory || fallbackSubCategory || undefined),
      };
  }, [selectedAccountProfile, selectedAccount, filteredTransactions]);

  const applyAccountProfile = useCallback((accountName: string | null) => {
      const normalized = accountName ? toTitleCase(accountName) : '';
      const profile = normalized ? payeeProfiles.get(normalized) : undefined;

      setValue('expenseNature', profile?.nature || '', { shouldValidate: false });
      setValue('category', profile?.category || '', { shouldValidate: false });
      setValue('subCategory', profile?.subCategory || '', { shouldValidate: false });
  }, [payeeProfiles, setValue]);

  useEffect(() => {
      if (payeeValue) {
          applyAccountProfile(payeeValue);
      } else {
          applyAccountProfile(null);
      }
  }, [payeeValue, applyAccountProfile]);

  useEffect(() => {
      const incomeValue = Number(incomeAmountValue || 0);
      const expenseValue = Number(expenseAmountValue || 0);

      if (lastAmountSource === 'income') {
          if (incomeValue > 0) {
              if (expenseValue !== 0) {
                  setValue('expenseAmount', 0, { shouldValidate: false });
              }
              setValue('transactionType', 'Income', { shouldValidate: false });
              setValue('amount', incomeValue, { shouldValidate: false });
          } else if (expenseValue > 0) {
              setLastAmountSource('expense');
          } else {
              setValue('amount', 0, { shouldValidate: false });
          }
          return;
      }

      if (lastAmountSource === 'expense') {
          if (expenseValue > 0) {
              if (incomeValue !== 0) {
                  setValue('incomeAmount', 0, { shouldValidate: false });
              }
              setValue('transactionType', 'Expense', { shouldValidate: false });
              setValue('amount', expenseValue, { shouldValidate: false });
          } else if (incomeValue > 0) {
              setLastAmountSource('income');
          } else {
              setValue('amount', 0, { shouldValidate: false });
          }
          return;
      }

      if (incomeValue > 0 && expenseValue <= 0) {
          setLastAmountSource('income');
          setValue('transactionType', 'Income', { shouldValidate: false });
          setValue('amount', incomeValue, { shouldValidate: false });
      } else if (expenseValue > 0 && incomeValue <= 0) {
          setLastAmountSource('expense');
          setValue('transactionType', 'Expense', { shouldValidate: false });
          setValue('amount', expenseValue, { shouldValidate: false });
      } else if (incomeValue <= 0 && expenseValue <= 0) {
          setValue('amount', 0, { shouldValidate: false });
      }
  }, [incomeAmountValue, expenseAmountValue, lastAmountSource, setValue]);

  // Save date to localStorage when it changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'date' && value.date && typeof window !== 'undefined') {
        localStorage.setItem('incomeExpenseDate', value.date.toISOString());
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

    useEffect(() => {
        if (!editingTransaction) {
            const nextId = getNextTransactionId(selectedTransactionType);
            setValue('transactionId', nextId);
        }
    }, [selectedTransactionType, editingTransaction, getNextTransactionId, setValue, payments, expenses]);


  const handleTransactionIdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let value = e.target.value.trim();
      if (!value) return;

      const prefix = selectedTransactionType === 'Income' ? 'IN' : 'EX';
      if (value && !isNaN(parseInt(value)) && isFinite(Number(value))) {
          value = generateReadableId(prefix, parseInt(value) - 1, 5);
          setValue('transactionId', value);
      }
      const foundTransaction = allTransactions.find(t => t.transactionId === value);
      if (foundTransaction) {
          handleEdit(foundTransaction);
      } else if (prefix === 'EX') {
          const foundPayment = payments.find(p => p.paymentId === value);
          if (foundPayment) {
              toast({ title: 'ID Occupied', description: `This ID is used for a supplier payment to: ${foundPayment.supplierName}`, variant: 'destructive'});
          }
      }
  };


  const handleAutoFill = useCallback((payeeName: string) => {
    applyAccountProfile(payeeName);

    if (!uniquePayees.includes(payeeName)) return;

    const trimmedPayeeName = toTitleCase(payeeName.trim());
    if (!trimmedPayeeName) return;

    const latestTransaction = allTransactions
        .filter(t => toTitleCase(t.payee) === trimmedPayeeName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    if (latestTransaction && latestTransaction.transactionType === 'Expense' && latestTransaction.expenseNature) {
        setTimeout(() => {
            setValue('expenseNature', latestTransaction.expenseNature, { shouldValidate: false });
            setTimeout(() => {
                setValue('category', latestTransaction.category, { shouldValidate: false });
                setTimeout(() => {
                     setValue('subCategory', latestTransaction.subCategory, { shouldValidate: false });
                }, 50);
            }, 50);
        }, 0);
        toast({ title: 'Auto-filled!', description: `Details for ${trimmedPayeeName} loaded.` });
    }
  }, [allTransactions, applyAccountProfile, setValue, toast, uniquePayees]);

  const handleNew = useCallback(() => {
    setEditingTransaction(null);
    const nextId = getNextTransactionId('Expense');
    reset(getInitialFormState(nextId));
    setIsAdvanced(false);
    setIsCalculated(false);
    setIsRecurring(false);
    setLastAmountSource(null);
    if (selectedAccount) {
        setValue('payee', selectedAccount, { shouldValidate: true });
        handleAutoFill(selectedAccount);
    } else {
        setValue('payee', '', { shouldValidate: true });
    }
  }, [reset, getNextTransactionId, selectedAccount, setValue, handleAutoFill]);

  const handleEdit = useCallback((transaction: DisplayTransaction) => {
      setEditingTransaction(transaction);
  }, []);

  const handleAddNewAccount = useCallback(() => {
      router.push('/expense-tracker/payee-profile?create=1');
  }, [router]);

  useEffect(() => {
      if (selectedAccount) {
          setValue('payee', selectedAccount, { shouldValidate: true });
          handleAutoFill(selectedAccount);
      } else {
          setValue('payee', '', { shouldValidate: true });
      }
  }, [selectedAccount, handleAutoFill, setValue]);


  useEffect(() => {
    if (!editingTransaction) return;

    const transaction = editingTransaction;
    setSelectedAccount(toTitleCase(transaction.payee));
    reset({
        ...transaction,
        date: new Date(transaction.date),
        taxAmount: transaction.taxAmount || 0,
        quantity: transaction.quantity || 0,
        rate: transaction.rate || 0,
        isCalculated: transaction.isCalculated || false,
        nextDueDate: transaction.nextDueDate ? new Date(transaction.nextDueDate) : undefined,
        incomeAmount: transaction.transactionType === 'Income' ? transaction.amount : 0,
        expenseAmount: transaction.transactionType === 'Expense' ? transaction.amount : 0,
    });
    setLastAmountSource(transaction.transactionType === 'Income' ? 'income' : 'expense');
    
    setTimeout(() => {
        if (transaction.expenseNature) {
            setValue('expenseNature', transaction.expenseNature);
        }
        setTimeout(() => {
            setValue('category', transaction.category);
             setTimeout(() => {
                const subCategoryToSet = (transaction.category === 'Interest & Loan Payments' && transaction.loanId)
                    ? loans.find(l => l.id === transaction.loanId)?.loanName || transaction.subCategory
                    : transaction.subCategory;
                if (subCategoryToSet) {
                    setValue('subCategory', subCategoryToSet);
                }
            }, 50);
        }, 50);
    }, 50);
    
    setIsAdvanced(!!(transaction.status || transaction.taxAmount || transaction.expenseType || transaction.mill || transaction.projectId));
    setIsCalculated(transaction.isCalculated || false);
    setIsRecurring(transaction.isRecurring || false);
  }, [editingTransaction, loans, setValue, reset]);

  useEffect(() => {
    const loanId = searchParams.get('loanId');
    if (loanId && loans.length > 0) {
      handleNew(); // Reset the form first

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
      setValue('amount', calculatedAmount, { shouldValidate: false });
      setValue('expenseAmount', calculatedAmount, { shouldValidate: false });
      setValue('incomeAmount', 0, { shouldValidate: false });
      setLastAmountSource(calculatedAmount > 0 ? 'expense' : null);
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

  useEffect(() => {
    const unsubscribe = getPayeeProfilesRealtime((profiles) => {
        const mappedProfiles = new Map<string, PayeeProfile>();
        profiles.forEach(profile => {
            if (!profile?.name) return;
            mappedProfiles.set(toTitleCase(profile.name), profile);
        });
        setPayeeProfiles(mappedProfiles);
    }, console.error);

    return () => unsubscribe();
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


  const handleDelete = async (transaction: DisplayTransaction) => {
    try {
      if (transaction.transactionType === 'Income') {
        await deleteIncome(transaction.id);
      } else {
        await deleteExpense(transaction.id);
      }
      toast({ title: "Transaction deleted.", variant: "success" });
      if (editingTransaction?.id === transaction.id) handleNew();
    } catch (error) {
      console.error("Error deleting transaction: ", error);
      toast({ title: "Failed to delete transaction.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: TransactionFormValues) => {
    const incomeValue = Number(values.incomeAmount || 0);
    const expenseValue = Number(values.expenseAmount || 0);

    if (incomeValue > 0 && expenseValue > 0) {
        toast({ title: "Invalid Amounts", description: "Please enter either income or expense amount, not both.", variant: "destructive" });
        return;
    }

    if (incomeValue <= 0 && expenseValue <= 0) {
        toast({ title: "Amount Required", description: "Please enter an amount for income or expense.", variant: "destructive" });
        return;
    }

    const activeType: "Income" | "Expense" = incomeValue > 0 ? "Income" : "Expense";
    const activeAmount = incomeValue > 0 ? incomeValue : expenseValue;

    if (activeAmount <= 0) {
        toast({ title: "Amount Required", description: "Amount must be greater than zero.", variant: "destructive" });
        return;
    }

    if (activeType === 'Expense') {
        const balanceKey = values.bankAccountId || (values.paymentMethod === 'Cash' ? 'CashInHand' : '');
        const availableBalance = financialState.balances.get(balanceKey) || 0;
        
        let amountToCheck = activeAmount;
        if (editingTransaction) {
            const originalTx = allTransactions.find(tx => tx.id === editingTransaction.id);
            if (originalTx && (originalTx.bankAccountId || 'CashInHand') === (values.bankAccountId || 'CashInHand')) {
                 amountToCheck = activeAmount - originalTx.amount;
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
  
    // Validate transaction ID is unique (not editing)
    if (!editingTransaction && values.transactionId) {
        const idExists = allTransactions.some(t => t.transactionId === values.transactionId);
        const paymentIdExists = activeType === 'Expense' && payments.some(p => p.paymentId === values.transactionId);
        
        if (idExists) {
            toast({
                title: "ID Already Exists",
                description: `Transaction ID ${values.transactionId} already exists. Cannot save.`,
                variant: "destructive"
            });
            return;
        }
        
        if (paymentIdExists) {
            toast({
                title: "ID Already Exists",
                description: `ID ${values.transactionId} is already used for a supplier payment. Cannot save.`,
                variant: "destructive"
            });
            return;
        }
    }
  
    setIsSubmitting(true);
    try {
      const { incomeAmount, expenseAmount, ...baseValues } = values;
      const transactionData: Partial<TransactionFormValues> = {
        ...baseValues,
        transactionType: activeType,
        amount: activeAmount,
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

      if (editingTransaction) {
        if (activeType === 'Income') {
            await updateIncome(editingTransaction.id, transactionData as Omit<Income, 'id'>);
        } else {
            await updateExpense(editingTransaction.id, transactionData as Omit<Expense, 'id'>);
        }
        toast({ title: "Transaction updated.", variant: "success" });
      } else {
        if (activeType === 'Income') {
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
                    if (editingTransaction) {
                        const tx = allTransactions.find(t => t.id === editingTransaction.id);
                        if (tx) handleDelete(tx);
                    }
                    break;
            }
        }
    }, [handleSubmit, onSubmit, handleNew, editingTransaction, allTransactions, handleDelete]);

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
    const sortableItems = [...filteredTransactions];
        sortableItems.sort((a, b) => {
            const valA = a[sortConfig.key] || '';
            const valB = b[sortConfig.key] || '';

      if (sortConfig.key === 'transactionId') {
        return sortConfig.direction === 'ascending'
          ? String(valA).localeCompare(String(valB), undefined, { numeric: true })
          : String(valB).localeCompare(String(valA), undefined, { numeric: true });
      }

      if (sortConfig.key === 'date') {
        const timeA = new Date(String(valA)).getTime();
        const timeB = new Date(String(valB)).getTime();
        return sortConfig.direction === 'ascending' ? timeA - timeB : timeB - timeA;
      }

            if (valA < valB) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (valA > valB) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    return sortableItems;
  }, [filteredTransactions, sortConfig]);

  const runningLedger = useMemo(() => {
    let balance = 0;
    return sortedTransactions.map(transaction => {
      const delta = transaction.transactionType === 'Income' ? transaction.amount : -transaction.amount;
      balance += delta;
      return {
        ...transaction,
        runningBalance: balance,
      };
    });
  }, [sortedTransactions]);

  useEffect(() => {
    setSelectedTransactionIds(prev => {
      const next = new Set<string>();
      runningLedger.forEach((tx) => {
        if (prev.has(tx.id)) {
          next.add(tx.id);
        }
      });
      return next;
    });
  }, [runningLedger]);

  const allSelected = runningLedger.length > 0 && selectedTransactionIds.size === runningLedger.length;
  const someSelected = selectedTransactionIds.size > 0 && !allSelected;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactionIds(new Set(runningLedger.map((tx) => tx.id)));
    } else {
      setSelectedTransactionIds(new Set());
    }
  };

  const toggleTransactionSelection = (id: string, checked: boolean) => {
    setSelectedTransactionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkDateUpdate = async () => {
    if (!bulkDate) {
      toast({ title: "Select date", description: "Choose a date to apply.", variant: "destructive" });
      return;
    }
    if (selectedTransactionIds.size === 0) {
      toast({ title: "No transactions selected", description: "Select at least one transaction.", variant: "destructive" });
      return;
    }
    setIsBulkUpdating(true);
    try {
      const updates: Promise<void>[] = [];
      const isoDate = bulkDate;
      selectedTransactionIds.forEach((id) => {
        const tx = runningLedger.find((item) => item.id === id);
        if (!tx) return;
        if (tx.transactionType === "Income") {
          updates.push(updateIncome(id, { date: isoDate }));
        } else {
          updates.push(updateExpense(id, { date: isoDate }));
        }
      });
      await Promise.all(updates);
      toast({
        title: "Date updated",
        description: `Updated ${selectedTransactionIds.size} transaction${selectedTransactionIds.size > 1 ? "s" : ""}.`,
      });
      setSelectedTransactionIds(new Set());
    } catch (error) {
      console.error("Bulk date update failed:", error);
      toast({
        title: "Failed to update dates",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getDisplayId = (transaction: DisplayTransaction): string => {
    if (transaction.category === 'Supplier Payments') {
        const paymentIdMatch = transaction.description?.match(/Payment (\S+)/);
        return paymentIdMatch?.[1] || transaction.transactionId || 'N/A';
    }
    if (transaction.category === 'Customer Payment') {
        const paymentIdMatch = transaction.description?.match(/Payment (\S+)/);
        return paymentIdMatch?.[1] || transaction.transactionId || 'N/A';
    }
    return transaction.transactionId || 'N/A';
  };

  const handlePrintStatement = useCallback((accountName: string | null, ledger: Array<DisplayTransaction & { runningBalance: number }>) => {
    if (typeof window === 'undefined') return;
    if (!ledger.length) {
      toast({ title: 'No transactions to print', description: 'Please add a transaction before printing the statement.' });
      return;
    }

    const title = accountName ? `${accountName} Account Statement` : 'Account Statement';
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = ledger.map(tx => {
      const isIncome = tx.transactionType === 'Income';
      const credit = isIncome ? tx.amount : 0;
      const debit = isIncome ? 0 : tx.amount;
      totalCredit += credit;
      totalDebit += debit;
      return `
        <tr>
          <td>${format(new Date(tx.date), 'dd-MMM-yyyy')}</td>
          <td>${getDisplayId(tx)}</td>
          <td>${toTitleCase(tx.description || tx.payee || '')}</td>
          <td class="debit">${debit ? formatCurrency(debit) : '-'}</td>
          <td class="credit">${credit ? formatCurrency(credit) : '-'}</td>
          <td class="balance">${formatCurrency(tx.runningBalance)}</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 32px; color: #111827; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 13px; }
    th { background: #f3f4f6; text-transform: uppercase; letter-spacing: 0.04em; font-size: 12px; }
    td.debit { color: #dc2626; text-align: right; }
    td.credit { color: #16a34a; text-align: right; }
    td.balance { font-weight: 600; text-align: right; }
    tfoot td { font-weight: 600; background: #f9fafb; }
    .footer { margin-top: 24px; font-size: 12px; color: #6b7280; text-align: right; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    Generated on ${format(new Date(), 'dd MMMM yyyy, hh:mm a')}
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>ID</th>
        <th>Description</th>
        <th style="text-align:right">Debit</th>
        <th style="text-align:right">Credit</th>
        <th style="text-align:right">Running Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3">Totals</td>
        <td style="text-align:right">${formatCurrency(totalDebit)}</td>
        <td style="text-align:right">${formatCurrency(totalCredit)}</td>
        <td style="text-align:right">${formatCurrency(ledger[ledger.length - 1].runningBalance)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="footer">Generated by Income & Expense Tracker</div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast({ title: 'Popup blocked', description: 'Allow popups to print the statement.' });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [toast]);
  
  const { totalIncome, totalExpense, netProfitLoss, totalTransactions } = useMemo(() => {
    const incomeTotal = filteredTransactions
      .filter((t) => t.transactionType === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = filteredTransactions
      .filter((t) => t.transactionType === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      netProfitLoss: incomeTotal - expenseTotal,
      totalTransactions: filteredTransactions.length,
    };
  }, [filteredTransactions]);
    
  if(isPageLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="grid gap-3 sm:grid-cols-[minmax(220px,320px)_auto] sm:items-end">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Account / Payee
              </p>
              <CustomDropdown
                options={accountOptions}
                value={selectedAccount}
                onChange={(value) => {
                    const normalized = value ? toTitleCase(value) : null;
                    setSelectedAccount(normalized);
                }}
                onAdd={(newValue) => {
                    const normalized = toTitleCase(newValue);
                    setSelectedAccount(normalized);
                    setValue('payee', normalized, { shouldValidate: true });
                }}
                placeholder="Search or select an account..."
              />
            </div>
            <div className="space-y-1 sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                New Account
              </p>
              <Button onClick={handleAddNewAccount} size="sm" variant="outline" className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,300px)_1fr]">
        <Card className="h-full">
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">{summaryDetails.name}</h2>
              <dl className="space-y-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <dt className="font-medium text-foreground/70">Contact</dt>
                  <dd>{summaryDetails.contact}</dd>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <dt className="font-medium text-foreground/70">Address</dt>
                  <dd>{summaryDetails.address}</dd>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <dt className="font-medium text-foreground/70">Nature</dt>
                  <dd>{summaryDetails.nature}</dd>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <dt className="font-medium text-foreground/70">Category</dt>
                  <dd>{summaryDetails.category}</dd>
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <dt className="font-medium text-foreground/70">Sub Cat.</dt>
                  <dd>{summaryDetails.subCategory}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3 rounded-lg border border-muted-foreground/20 bg-muted/40 px-3 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Income</span>
                <span className="text-sm font-semibold text-emerald-600">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Expense</span>
                <span className="text-sm font-semibold text-rose-600">{formatCurrency(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Net Balance</span>
                <span className={cn("text-sm font-semibold", netProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                  {formatCurrency(netProfitLoss)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transactions</span>
                <span className="text-sm font-semibold text-indigo-600">{totalTransactions}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register('payee')} />
              {errors.payee && <p className="text-xs text-destructive">{errors.payee.message}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal h-9 text-sm',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[51]">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => field.onChange(date || new Date())}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                />

                <div className="space-y-1">
                  <Label htmlFor="transactionId" className="text-xs">
                    Transaction ID
                  </Label>
                  <InputWithIcon icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                    <Input
                      id="transactionId"
                      {...register("transactionId")}
                      onBlur={handleTransactionIdBlur}
                      className="h-8 text-sm pl-10"
                    />
                  </InputWithIcon>
                </div>

                {selectedAccountProfile && (
                  <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 rounded-md border border-muted-foreground/10 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground/70">Nature:</span>
                      {selectedAccountProfile.nature || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground/70">Category:</span>
                      {selectedAccountProfile.category || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-foreground/70">Sub Category:</span>
                      {selectedAccountProfile.subCategory || '—'}
                    </span>
                    {selectedAccountProfile.contact && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-foreground/70">Contact:</span>
                        {selectedAccountProfile.contact}
                      </span>
                    )}
                  </div>
                )}

                <Controller
                  name="incomeAmount"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label className="text-xs text-emerald-700">Credit Amount (Income)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value === undefined || field.value === null || Number(field.value) === 0 ? '' : field.value}
                        onChange={(e) => {
                          setLastAmountSource('income');
                          const value = e.target.value;
                          field.onChange(value === '' ? '' : Number(value));
                        }}
                        className="h-9 text-sm border-emerald-200 focus-visible:ring-emerald-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="expenseAmount"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label className="text-xs text-rose-700">Debit Amount (Expense)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value === undefined || field.value === null || Number(field.value) === 0 ? '' : field.value}
                        onChange={(e) => {
                          setLastAmountSource('expense');
                          const value = e.target.value;
                          field.onChange(value === '' ? '' : Number(value));
                        }}
                        className="h-9 text-sm border-rose-200 focus-visible:ring-rose-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                />

                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Label className="text-xs">Payment Method</Label>
                      <CustomDropdown
                        options={[
                          { value: 'Cash', label: 'Cash' },
                          ...bankAccounts.map((acc) => ({
                            value: acc.id,
                            label: `${acc.bankName} (...${acc.accountNumber.slice(-4)})`,
                          })),
                        ]}
                        value={field.value === 'Cash' ? 'Cash' : bankAccounts.find((acc) => acc.id === watch('bankAccountId'))?.id}
                        onChange={(value) => {
                          if (value === 'Cash') {
                            setValue('paymentMethod', 'Cash');
                            setValue('bankAccountId', undefined);
                          } else {
                            const account = bankAccounts.find((acc) => acc.id === value);
                            setValue('paymentMethod', account?.bankName || '');
                            setValue('bankAccountId', value);
                          }
                          field.onChange(value);
                        }}
                        placeholder="Select Payment Method"
                      />
                    </div>
                  )}
                />

                {errors.amount && (
                  <div className="sm:col-span-2 lg:col-span-3 text-xs text-destructive">
                    {errors.amount.message}
                  </div>
                )}
              </div>

              <input type="hidden" {...register('amount', { valueAsNumber: true })} />

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
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !field.value && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch id="isAdvanced" checked={isAdvanced} onCheckedChange={setIsAdvanced} />
                  <Label htmlFor="isAdvanced" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                      Advanced
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="isCalculated" checked={isCalculated} onCheckedChange={setIsCalculated} />
                  <Label htmlFor="isCalculated" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                      Calculate
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="isRecurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
                  <Label htmlFor="isRecurring" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                      Recurring
                  </Label>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button type="button" variant="ghost" onClick={handleNew}><RefreshCw className="mr-2 h-4 w-4" />New</Button>
                  <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingTransaction ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Transaction History</CardTitle>
            <CardDescription>Debit, credit, and running balance for the selected account.</CardDescription>
          </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {selectedTransactionIds.size > 0 && (
                <>
                  <SmartDatePicker
                    value={bulkDate}
                    onChange={(next) => setBulkDate(next || "")}
                    placeholder="Select date"
                    inputClassName="h-9 text-sm"
                    buttonClassName="h-9 w-9"
                  />
                  <Button
                    size="sm"
                    onClick={handleBulkDateUpdate}
                    disabled={isBulkUpdating || !bulkDate}
                  >
                    {isBulkUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Apply Date ({selectedTransactionIds.size})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTransactionIds(new Set())}
                  >
                    Clear Selection
                  </Button>
                </>
              )}
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => handlePrintStatement(selectedAccount, runningLedger)}
          >
            <Printer className="mr-2 h-4 w-4" /> Print Statement
          </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px] text-center">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(value) => toggleSelectAll(value === true)}
                      aria-label="Select all transactions"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('transactionId')}>ID <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => requestSort('date')}>Date <ArrowUpDown className="inline h-3 w-3 ml-1"/> </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runningLedger.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={selectedTransactionIds.has(transaction.id)}
                        onCheckedChange={(value) => toggleTransactionSelection(transaction.id, value === true)}
                        aria-label={`Select transaction ${getDisplayId(transaction)}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{getDisplayId(transaction)}</TableCell>
                    <TableCell>{format(new Date(transaction.date), "dd-MMM-yy")}</TableCell>
                    <TableCell>{transaction.description || toTitleCase(transaction.payee)}</TableCell>
                    <TableCell className="text-right text-rose-600 font-medium">{transaction.transactionType === 'Expense' ? formatCurrency(transaction.amount) : '-'}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">{transaction.transactionType === 'Income' ? formatCurrency(transaction.amount) : '-'}</TableCell>
                    <TableCell className={cn("text-right font-semibold", transaction.runningBalance >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                      {formatCurrency(transaction.runningBalance)}
                    </TableCell>
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
      </Card>

      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
      />
    </div>
  );
}

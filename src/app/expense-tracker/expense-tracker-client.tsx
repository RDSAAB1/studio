

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory, Project, FundTransaction, Loan, BankAccount, Income, Expense, Payment, Account } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, generateReadableId } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller, useWatch } from "react-hook-form";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { ExpenseTrackerTable, type DisplayTransaction } from "./components/expense-tracker-table";
import { SummaryMetricsCard } from "./components/summary-metrics-card";
import { TransactionForm } from "./components/transaction-form";
import { useCategoryManager } from "./hooks/use-category-manager";
import { useAccountManager } from "./hooks/use-account-manager";
import { getIncomeCategories, getExpenseCategories, getAllIncomeCategories, getAllExpenseCategories, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getProjectsRealtime, getPaymentsRealtime, getAllIncomes } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";
import { ErrorBoundary } from "@/components/error-boundary"; 


import { Loader2, Pen, Save, Trash, FileText, ArrowUpDown, Percent, RefreshCw, Landmark, Settings, Printer, PlusCircle, Edit, X } from "lucide-react";
import { format, addMonths, parse, isValid } from "date-fns"
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
  cdAmount: z.coerce.number().optional(),
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
    cdAmount: 0,
    expenseType: 'Business',
    isRecurring: false,
    recurringFrequency: 'monthly',
    isCalculated: false,
    quantity: 0,
    rate: 0,
    projectId: 'none',
  };
};



export default function IncomeExpenseClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();

  // ✅ Use global data context - NO duplicate listeners
  const globalData = useGlobalData();

  // ✅ FIX: Initialize state from globalData immediately to prevent data loss on remount
  const [income, setIncome] = useState<Income[]>(globalData.incomes);
  const [expenses, setExpenses] = useState<Expense[]>(globalData.expenses);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>(globalData.fundTransactions);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(globalData.bankAccounts);
  const [projects, setProjects] = useState<Project[]>([]);

  // NO PAGE LOADING - Data loads initially, then only CRUD updates
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DisplayTransaction | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof DisplayTransaction; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'descending', // Newest first by default
  });
  
  // Category management hook
  const {
    incomeCategories,
    expenseCategories,
    setIncomeCategories,
    setExpenseCategories,
    isCategoryManagerOpen,
    setIsCategoryManagerOpen,
    refreshCategories,
    handleAddCategory,
    handleUpdateCategoryName,
    handleDeleteCategory,
    handleAddSubCategory,
    handleDeleteSubCategory,
  } = useCategoryManager();
  
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState<string>("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  
  const [lastAmountSource, setLastAmountSource] = useState<'income' | 'expense' | null>(null);

    // ✅ OPTIMIZED: Only sync when data actually changes (not just reference)
    const prevExpensesRef = React.useRef(globalData.expenses);
    const prevFundTransactionsRef = React.useRef(globalData.fundTransactions);
    const prevBankAccountsRef = React.useRef(globalData.bankAccounts);
    
    useEffect(() => {
        // ✅ FIX: Always sync from globalData on mount and when it changes
        // This ensures data is available even after page navigation
        setExpenses(globalData.expenses);
        setFundTransactions(globalData.fundTransactions);
        setBankAccounts(globalData.bankAccounts);
        setIncome(globalData.incomes); // ✅ FIX: Also sync incomes from globalData
        
        // Update refs
        prevExpensesRef.current = globalData.expenses;
        prevFundTransactionsRef.current = globalData.fundTransactions;
        prevBankAccountsRef.current = globalData.bankAccounts;
    }, [globalData.expenses, globalData.fundTransactions, globalData.bankAccounts, globalData.incomes]);
    
    useEffect(() => {
        // First, fetch ALL income transactions for payee extraction (expenses already from global)
        const fetchAllTransactions = async () => {
            try {
                const allIncomes = await getAllIncomes();
                setIncome(allIncomes);
            } catch (error) {
                // Silent fail
            }
        };

        fetchAllTransactions();

        // Then set up realtime listeners for updates (only for data not in global context)
        const unsubIncome = getIncomeRealtime((data) => {
            setIncome(data);
        }, () => {});
        const unsubPayments = getPaymentsRealtime(setPayments, () => {});
        const unsubLoans = getLoansRealtime(setLoans, () => {});
        const unsubProjects = getProjectsRealtime(setProjects, () => {});

        return () => {
            unsubIncome(); unsubLoans(); unsubProjects(); unsubPayments();
        }
    }, []); // Only run once on mount

  // NO PAGE LOADING - Components render immediately

  const allTransactions: DisplayTransaction[] = useMemo(() => {

      // Handle empty arrays - income and expenses might be [] initially
      const incomeArray = income || [];
      const expensesArray = expenses || [];
      
      // Don't return early - even if empty, we should process them
      const combined = [...incomeArray, ...expensesArray];
      const sorted = combined.sort((a, b) => (b.transactionId || '').localeCompare(a.transactionId || ''));
      
      // Check payees in transactions
      const transactionsWithPayees = sorted.filter(t => t.payee && typeof t.payee === 'string' && t.payee.trim() !== '');
      const uniquePayeesFromTransactions = [...new Set(transactionsWithPayees.map(t => toTitleCase(t.payee.trim())))];

      return sorted;
  }, [income, expenses]);

  const uniquePayees = useMemo(() => {
      if (!allTransactions || allTransactions.length === 0) {

          return [];
      }
      
      // Extract all payees from transactions
      const allPayees = allTransactions
          .map(t => t.payee)
          .filter(p => p && typeof p === 'string' && p.trim() !== '');

      const payees = new Set(allPayees.map(p => toTitleCase(p.trim())));
      const uniqueList = Array.from(payees).sort();

      return uniqueList;
  }, [allTransactions]);

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
  
  // Store handleAutoFill in a ref so it can be updated
  const handleAutoFillRef = useRef<((payeeName: string) => void) | undefined>(undefined);
  
  // Account management hook (initialized after form, handleAutoFill will be set via ref)
  const {
    selectedAccount,
    setSelectedAccount,
    isAddAccountOpen,
    setIsAddAccountOpen,
    isEditAccountOpen,
    setIsEditAccountOpen,
    isDeleteAccountOpen,
    setIsDeleteAccountOpen,
    newAccount,
    setNewAccount,
    editAccount,
    setEditAccount,
    accounts,
    handleAddAccount,
    handleSaveNewAccount,
    handleEditAccount,
    handleSaveEditAccount,
    handleDeleteAccount,
  } = useAccountManager({
    setValue,
    setIsSubmitting,
    handleAutoFill: (payeeName: string) => {
      if (handleAutoFillRef.current) {
        handleAutoFillRef.current(payeeName);
      }
    },
  });
  
  // These useMemo hooks depend on account manager hook, so they must come after it
  const filteredTransactions = useMemo(() => {
      if (!selectedAccount) return allTransactions;
      return allTransactions.filter(
          (transaction) => toTitleCase(transaction.payee) === selectedAccount
      );
  }, [allTransactions, selectedAccount]);

  const accountOptions = useMemo(() => {
      const names = new Set<string>();
      
      // Add payees from transactions (income/expense)
      uniquePayees.forEach(name => {
          const normalized = toTitleCase(name.trim());
          if (normalized) names.add(normalized);
      });

      // Add accounts from accounts Map (includes newly created accounts)
      accounts.forEach((account, accountName) => {
          if (account?.name) {
              const normalized = toTitleCase(account.name.trim());
              if (normalized) names.add(normalized);
          }
      });

      const options = Array.from(names)
          .sort((a, b) => a.localeCompare(b))
          .map(name => ({
              value: name,
              label: name,
          }));


      return options;
  }, [uniquePayees, accounts]);
  
  // Use useWatch to efficiently watch multiple fields at once (single subscription)
  const watchedValues = useWatch({
    control: form.control,
    name: ['transactionType', 'paymentMethod', 'expenseNature', 'category', 'subCategory', 'quantity', 'rate', 'incomeAmount', 'expenseAmount', 'payee']
  });

  const [
    selectedTransactionType,
    selectedPaymentMethod,
    selectedExpenseNature,
    selectedCategory,
    selectedSubCategory,
    quantity,
    rate,
    incomeAmountValue,
    expenseAmountValue,
    payeeValue
  ] = watchedValues;


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
      
      // If user entered just a number, format it with prefix
      // If user entered a full ID (with prefix), preserve it as-is
      if (value && !isNaN(parseInt(value)) && isFinite(Number(value)) && !value.match(/^(IN|EX)\d+$/i)) {
          // Only format if it's a plain number without prefix
          value = generateReadableId(prefix, parseInt(value) - 1, 5);
          setValue('transactionId', value);
      } else if (value) {
          // Preserve the value as user entered it (could be full ID like IN00001)
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
        // Removed unnecessary toast message
    }
  }, [allTransactions, setValue, toast, uniquePayees]);

  // Update the ref when handleAutoFill changes
  useEffect(() => {
    handleAutoFillRef.current = handleAutoFill;
  }, [handleAutoFill]);

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


  useEffect(() => {
    if (!editingTransaction) return;

    const transaction = editingTransaction;
    setSelectedAccount(toTitleCase(transaction.payee));
    reset({
        ...transaction,
        date: new Date(transaction.date),
        taxAmount: transaction.taxAmount || 0,
        cdAmount: (transaction as any).cdAmount || 0,
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
    
    // When editing, always turn on advanced option so user can see and edit all fields
    // Check if any advanced fields have values (status always exists, so this will be true)
    const hasAdvancedFields = 
      transaction.status !== undefined || // Status always exists
      (transaction.taxAmount !== undefined && transaction.taxAmount !== null) || // Tax amount field exists
      ((transaction as any).cdAmount !== undefined && (transaction as any).cdAmount !== null) || // CD amount field exists
      transaction.expenseType !== undefined || // Expense type field exists
      (transaction.mill !== undefined && transaction.mill !== null) || // Mill field exists
      (transaction.projectId !== undefined && transaction.projectId !== null); // Project field exists
    
    // When editing, turn on advanced - this ensures user can see all options
    setIsAdvanced(hasAdvancedFields || true); // Always true when editing
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
    // Load all categories initially
    const loadAllCategories = async () => {
      try {
        await refreshCategories();
      } catch (error) {
        // Error handled by hook
      }
    };
    loadAllCategories();

    // Then set up realtime listeners for updates
    const unsubIncomeCats = getIncomeCategories((newCats) => {
      setIncomeCategories(prev => {
        // Merge new categories with existing ones
        const existingMap = new Map(prev.map(c => [c.id, c]));
        newCats.forEach(cat => existingMap.set(cat.id, cat));
        return Array.from(existingMap.values());
      });
    }, () => {});
    const unsubExpenseCats = getExpenseCategories((newCats) => {
      setExpenseCategories(prev => {
        // Merge new categories with existing ones
        const existingMap = new Map(prev.map(c => [c.id, c]));
        newCats.forEach(cat => existingMap.set(cat.id, cat));
        return Array.from(existingMap.values());
      });
    }, () => {});
    
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
        // For new transactions, preserve user-entered transactionId if provided, otherwise let the function generate one
        // transactionId is already validated for uniqueness above, so we can safely pass it
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

  // Helper function to parse dates consistently (same as in runningLedger)
  const parseDateForSort = (dateStr: string): number => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    
    // First try ISO format (yyyy-MM-dd) - this is how dates are stored in database
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      const isoDate = new Date(dateStr + 'T00:00:00');
      if (!isNaN(isoDate.getTime())) {
        return isoDate.getTime();
      }
    }
    
    // Try date-fns parse for other formats
    const formats = ['dd-MMM-yy', 'dd-MMM-yyyy', 'dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd'];
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (isValid(parsed)) {
          return parsed.getTime();
        }
      } catch {
        continue;
      }
    }
    
    // Fallback to native Date parsing
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.getTime();
    }
    
    return 0;
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
        // Use consistent date parsing for accurate date-wise sorting
        const timeA = parseDateForSort(String(valA));
        const timeB = parseDateForSort(String(valB));
        
        if (timeA !== timeB) {
          return sortConfig.direction === 'ascending' ? timeA - timeB : timeB - timeA;
        }
        
        // If dates are same, sort by createdAt (oldest first if ascending, newest first if descending)
        if (a.createdAt && b.createdAt) {
          const createdAtCompare = a.createdAt.localeCompare(b.createdAt);
          if (createdAtCompare !== 0) {
            return sortConfig.direction === 'ascending' ? createdAtCompare : -createdAtCompare;
          }
        }
        
        // Final fallback: sort by transactionId
        const idA = (a.transactionId || '').toUpperCase();
        const idB = (b.transactionId || '').toUpperCase();
        const idCompare = idA.localeCompare(idB);
        return sortConfig.direction === 'ascending' ? idCompare : -idCompare;
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
    // Since transactions are displayed newest first, we need to calculate balance from oldest to newest
    // Use filteredTransactions (all transactions for selected account) for calculation, not sortedTransactions
    // This ensures we calculate balance for ALL transactions, not just the sorted/displayed ones
    
    // Create a copy and sort by date (oldest first) for balance calculation
    // Dates are stored in ISO format (yyyy-MM-dd) in the database
    const parseDate = (dateStr: string): number => {
      if (!dateStr || typeof dateStr !== 'string') return 0;
      
      // First try ISO format (yyyy-MM-dd) - this is how dates are stored in database
      // Example: "2025-08-14" or "2025-12-10"
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const isoDate = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues
        if (!isNaN(isoDate.getTime())) {
          return isoDate.getTime();
        }
      }
      
      // Try date-fns parse for other possible formats
      const formats = ['dd-MMM-yy', 'dd-MMM-yyyy', 'dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd'];
      for (const fmt of formats) {
        try {
          const parsed = parse(dateStr, fmt, new Date());
          if (isValid(parsed)) {
            return parsed.getTime();
          }
        } catch {
          continue;
        }
      }
      
      // Fallback to native Date parsing
      const fallbackDate = new Date(dateStr);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.getTime();
      }
      
      // If all parsing fails, return 0 (will be sorted last)

      return 0;
    };
    
    // Use filteredTransactions for calculation to ensure we have ALL transactions
    // Important: We must use ALL transactions for the selected account, sorted chronologically by DATE
    // Date-wise sorting: Sort by date first (oldest to newest), then by createdAt, then by transactionId
    const sortedForCalculation = [...filteredTransactions].sort((a, b) => {
      // PRIMARY SORT: By date field (date-wise sorting - oldest first)
      const timeA = parseDate(a.date);
      const timeB = parseDate(b.date);
      
      // If both dates parsed successfully, sort by date
      if (timeA > 0 && timeB > 0) {
        if (timeA !== timeB) {
          return timeA - timeB; // Oldest date first
        }
        // Dates are equal, continue to secondary sort
      } else if (timeA > 0) {
        // Only A has valid date, A comes first
        return -1;
      } else if (timeB > 0) {
        // Only B has valid date, B comes first
        return 1;
      }
      // Both dates failed to parse, continue to secondary sort
      
      // SECONDARY SORT: By createdAt (oldest first) for transactions on same date
      // This ensures correct chronological order when dates are the same
      if (a.createdAt && b.createdAt) {
        const createdAtCompare = a.createdAt.localeCompare(b.createdAt);
        if (createdAtCompare !== 0) {
          return createdAtCompare; // Oldest createdAt first
        }
      } else if (a.createdAt) {
        return -1; // A has createdAt, A comes first
      } else if (b.createdAt) {
        return 1; // B has createdAt, B comes first
      }
      
      // TERTIARY SORT: By transactionId (ascending) for consistent order
      // This ensures same date, same createdAt transactions are in consistent order
      const idA = (a.transactionId || '').toUpperCase();
      const idB = (b.transactionId || '').toUpperCase();
      return idA.localeCompare(idB);
    });
    
    // Calculate running balance from oldest to newest (chronological order)
    // Starting balance is 0, then accumulate: Income adds, Expense subtracts
    let balance = 0;
    const withBalances = sortedForCalculation.map((transaction) => {
      // Ensure we correctly identify Income vs Expense (case-insensitive check)
      const txType = String(transaction.transactionType || '').trim();
      const isIncome = txType.toLowerCase() === 'income';
      const amount = Number(transaction.amount) || 0;
      const delta = isIncome ? amount : -amount;
      balance += delta;
      
      return {
        ...transaction,
        runningBalance: Math.round(balance * 100) / 100,
      };
    });
    
    // Create a map of balances by transaction ID for quick lookup
    const balanceMap = new Map(withBalances.map(tx => [tx.id, tx.runningBalance]));
    
    // Return transactions in the display order (sortedTransactions order) with correct balances
    // This ensures balance is calculated in real-time whenever transactions or sorting changes
    return sortedTransactions.map(transaction => {
      const calculatedBalance = balanceMap.get(transaction.id);
      if (calculatedBalance === undefined) {
        // Fallback: if balance not found, calculate it on the fly (shouldn't happen normally)
        return {
          ...transaction,
          runningBalance: 0,
        };
      }
      return {
        ...transaction,
        runningBalance: calculatedBalance,
      };
    });
  }, [sortedTransactions, filteredTransactions]);

  // Track previous runningLedger IDs to avoid unnecessary state updates
  const prevRunningLedgerIdsRef = useRef<string>('');
  const isUpdatingRef = useRef(false);
  
  // Create a stable ID string for comparison (sorted for consistency)
  const runningLedgerIds = useMemo(() => {
    const ids = runningLedger.map(tx => tx.id).sort().join(',');
    return ids;
  }, [runningLedger]);
  
  // Store runningLedger in a ref to access it in useEffect without dependency
  const runningLedgerRef = useRef(runningLedger);
  runningLedgerRef.current = runningLedger;

  useEffect(() => {
    // Prevent infinite loops by checking if we're already updating
    if (isUpdatingRef.current) {
      return;
    }
    
    // Only update if the IDs actually changed
    const currentIds = runningLedgerIds;
    if (prevRunningLedgerIdsRef.current === currentIds) {
      return;
    }
    prevRunningLedgerIdsRef.current = currentIds;
    
    isUpdatingRef.current = true;
    setSelectedTransactionIds(prev => {
      const next = new Set<string>();
      runningLedgerRef.current.forEach((tx) => {
        if (prev.has(tx.id)) {
          next.add(tx.id);
        }
      });
      
      // Only update if the Set actually changed
      if (next.size === prev.size && Array.from(next).every(id => prev.has(id))) {
        isUpdatingRef.current = false;
        return prev; // Return same reference to avoid re-render
      }
      
      isUpdatingRef.current = false;
      return next;
    });
  }, [runningLedgerIds]);

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
    
    // Calculate final running balance
    // Mathematically, final balance = Total Income - Total Expense
    // This should match the running balance of the newest transaction in the ledger
    const finalRunningBalance = incomeTotal - expenseTotal;
    
    return {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      netProfitLoss: finalRunningBalance,
      totalTransactions: filteredTransactions.length,
    };
  }, [filteredTransactions, runningLedger]);
    
  // NO PAGE LOADING - Always render immediately

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap min-w-[100px]">
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
            <div className="flex items-center gap-2">
              <Button onClick={handleAddAccount} size="sm" variant="outline" className="whitespace-nowrap" title="Add New Account">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Account
              </Button>
              {selectedAccount && (
                <>
                  <Button onClick={handleEditAccount} size="sm" variant="outline" className="whitespace-nowrap" title="Edit Account Name">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button onClick={() => setIsDeleteAccountOpen(true)} size="sm" variant="outline" className="whitespace-nowrap text-destructive hover:text-destructive" title="Delete Account">
                    <X className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
              <Button onClick={() => setIsCategoryManagerOpen(true)} size="sm" variant="outline" className="whitespace-nowrap" title="Manage Categories & Subcategories">
                <Settings className="mr-2 h-4 w-4" />
                Categories
              </Button>
            </div>
            {selectedAccount && (
              <Button
                size="sm"
                variant="outline"
                className="whitespace-nowrap"
                onClick={() => handlePrintStatement(selectedAccount, runningLedger)}
              >
                <Printer className="mr-2 h-4 w-4" /> Print Statement
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-[minmax(350px,400px)_1.8fr]">
        <Card className="h-full max-h-[600px] overflow-y-auto">
          <CardContent className="space-y-2 pt-3 pb-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Total Income</span>
                <span className="text-xs font-semibold text-emerald-600">{formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Total Expense</span>
                <span className="text-xs font-semibold text-rose-600">{formatCurrency(totalExpense)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Net Balance</span>
                <span className={cn("text-xs font-semibold", netProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                {formatCurrency(netProfitLoss)}
              </span>
            </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Transactions</span>
                <span className="text-xs font-semibold text-indigo-600">{totalTransactions}</span>
            </div>
          </div>

            <div className="border-t pt-2 mt-2">
              <TransactionForm
                form={form}
                onSubmit={handleSubmit(onSubmit)}
                handleNew={handleNew}
                handleTransactionIdBlur={handleTransactionIdBlur}
                isSubmitting={isSubmitting}
                editingTransaction={editingTransaction}
                isAdvanced={isAdvanced}
                setIsAdvanced={setIsAdvanced}
                isCalculated={isCalculated}
                setIsCalculated={setIsCalculated}
                isRecurring={isRecurring}
                setIsRecurring={setIsRecurring}
                setLastAmountSource={setLastAmountSource}
                bankAccounts={bankAccounts}
                projects={projects}
                selectedTransactionType={selectedTransactionType}
                errors={errors}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-0 p-0">
            {(() => {
              const accountName = selectedAccount;
              
              // Only show if we have account selected
              if (!accountName) return null;
              
              // Get account details from accounts map
              const account = accounts.get(accountName);
              
              // Get details from transactions
              const accountTransactions = filteredTransactions.filter(
                tx => toTitleCase(tx.payee) === accountName
              );
              
              // Get nature from account or transactions
              const nature = account?.nature || accountTransactions.find(tx => (tx as any).expenseNature)?.expenseNature || null;
              
              // Get category from account or transactions
              const category = account?.category || accountTransactions.find(tx => tx.category)?.category || null;
              
              // Get subCategory from account or transactions
              const subCategory = account?.subCategory || accountTransactions.find(tx => tx.subCategory)?.subCategory || null;
              
              return (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Name</p>
                    <p className="text-xs text-foreground">{accountName || '—'}</p>
                  </div>
                  {account?.contact && (
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Contact</p>
                      <p className="text-xs text-foreground">{account.contact}</p>
                    </div>
                  )}
                  {account?.address && (
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Address</p>
                      <p className="text-xs text-foreground">{account.address}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Nature</p>
                    <p className="text-xs text-foreground">{nature ? toTitleCase(nature) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Category</p>
                    <p className="text-xs text-foreground">{category ? toTitleCase(category) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Sub Category</p>
                    <p className="text-xs text-foreground">{subCategory ? toTitleCase(subCategory) : '—'}</p>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-2 pb-0">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {selectedTransactionIds.size > 0 && (
                  <>
                    <SmartDatePicker
                      value={bulkDate}
                      onChange={(next) => setBulkDate(typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : "")}
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ExpenseTrackerTable 
              runningLedger={runningLedger}
              allSelected={allSelected}
              someSelected={someSelected}
              toggleSelectAll={toggleSelectAll}
              requestSort={requestSort}
              selectedTransactionIds={selectedTransactionIds}
              toggleTransactionSelection={toggleTransactionSelection}
              getDisplayId={getDisplayId}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add Account Dialog */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-emerald-950 border-emerald-800">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-emerald-800">
            <DialogTitle className="text-lg font-semibold text-white">Add New Account</DialogTitle>
            <DialogDescription className="text-sm text-emerald-300 mt-1">
              Enter account details for auto-fill in transactions
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-2 max-h-[calc(90vh-200px)] overflow-y-auto bg-emerald-950">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountName" className="text-xs text-emerald-200">
                    Account Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="newAccountName"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="Enter account name..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountContact" className="text-xs text-emerald-200">Contact No.</Label>
                  <Input
                    id="newAccountContact"
                    value={newAccount.contact}
                    onChange={(e) => setNewAccount({ ...newAccount, contact: e.target.value })}
                    placeholder="Enter contact number..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountNature" className="text-xs text-emerald-200">Nature</Label>
                  <div className="bg-emerald-900 border border-emerald-500 rounded-md">
                    <CustomDropdown
                      options={[
                        { value: 'Permanent', label: 'Permanent' },
                        { value: 'Seasonal', label: 'Seasonal' },
                      ]}
                      value={newAccount.nature || null}
                      onChange={(value) => {
                        setNewAccount({ ...newAccount, nature: value as 'Permanent' | 'Seasonal' | '', category: '', subCategory: '' });
                      }}
                      placeholder="Select nature..."
                      maxRows={5}
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountAddress" className="text-xs text-emerald-200">Address</Label>
                  <Input
                    id="newAccountAddress"
                    value={newAccount.address}
                    onChange={(e) => setNewAccount({ ...newAccount, address: e.target.value })}
                    placeholder="Enter address..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
                {newAccount.nature && (
                  <>
                    <div className="space-y-0.5">
                      <Label htmlFor="newAccountCategory" className="text-xs text-emerald-200">Category</Label>
                      <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!newAccount.nature ? 'opacity-50 pointer-events-none' : ''}`}>
                        <CustomDropdown
                          options={newAccount.nature 
                            ? expenseCategories
                                .filter(cat => cat.nature === newAccount.nature)
                                .map(cat => ({ value: cat.name, label: cat.name }))
                            : []
                          }
                          value={newAccount.category || null}
                          onChange={(value) => {
                            setNewAccount({ ...newAccount, category: value || '', subCategory: '' });
                          }}
                          placeholder="Select category..."
                          maxRows={5}
                          showScrollbar={true}
                        />
                      </div>
                    </div>
                    {newAccount.category && (
                      <div className="space-y-0.5">
                        <Label htmlFor="newAccountSubCategory" className="text-xs text-emerald-200">Sub Category</Label>
                        <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!newAccount.category ? 'opacity-50 pointer-events-none' : ''}`}>
                          <CustomDropdown
                            options={newAccount.category
                              ? (expenseCategories.find(cat => cat.name === newAccount.category)?.subCategories || 
                                 incomeCategories.find(cat => cat.name === newAccount.category)?.subCategories || [])
                                  .map(sub => ({ value: sub, label: sub }))
                              : []
                            }
                            value={newAccount.subCategory || null}
                            onChange={(value) => {
                              setNewAccount({ ...newAccount, subCategory: value || '' });
                            }}
                            placeholder="Select sub category..."
                            maxRows={5}
                            showScrollbar={true}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-emerald-800 bg-emerald-950">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddAccountOpen(false)}
              className="border-emerald-600 text-emerald-200 hover:bg-emerald-900"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveNewAccount}
              disabled={isSubmitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
          <CardHeader className="flex flex-col gap-0 p-0">
            {(() => {
              const accountName = selectedAccount;
              
              // Only show if we have account selected
              if (!accountName) return null;
              
              // Get account details from accounts map
              const account = accounts.get(accountName);
              
              // Get details from transactions
              const accountTransactions = filteredTransactions.filter(
                tx => toTitleCase(tx.payee) === accountName
              );
              
              // Get nature from account or transactions
              const nature = account?.nature || accountTransactions.find(tx => (tx as any).expenseNature)?.expenseNature || null;
              
              // Get category from account or transactions
              const category = account?.category || accountTransactions.find(tx => tx.category)?.category || null;
              
              // Get subCategory from account or transactions
              const subCategory = account?.subCategory || accountTransactions.find(tx => tx.subCategory)?.subCategory || null;
              
              return (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Name</p>
                    <p className="text-xs text-foreground">{accountName || '—'}</p>
                  </div>
                  {account?.contact && (
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Contact</p>
                      <p className="text-xs text-foreground">{account.contact}</p>
                    </div>
                  )}
                  {account?.address && (
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Address</p>
                      <p className="text-xs text-foreground">{account.address}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Nature</p>
                    <p className="text-xs text-foreground">{nature ? toTitleCase(nature) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Category</p>
                    <p className="text-xs text-foreground">{category ? toTitleCase(category) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold whitespace-nowrap">Sub Category</p>
                    <p className="text-xs text-foreground">{subCategory ? toTitleCase(subCategory) : '—'}</p>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 pt-2 pb-0">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {selectedTransactionIds.size > 0 && (
                  <>
                    <SmartDatePicker
                      value={bulkDate}
                      onChange={(next) => setBulkDate(typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : "")}
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
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ExpenseTrackerTable 
              runningLedger={runningLedger}
              allSelected={allSelected}
              someSelected={someSelected}
              toggleSelectAll={toggleSelectAll}
              requestSort={requestSort}
              selectedTransactionIds={selectedTransactionIds}
              toggleTransactionSelection={toggleTransactionSelection}
              getDisplayId={getDisplayId}
              handleEdit={handleEdit}
              handleDelete={handleDelete}
            />
          </CardContent>
        </Card>

      {/* Add Account Dialog */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-emerald-950 border-emerald-800">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-emerald-800">
            <DialogTitle className="text-lg font-semibold text-white">Add New Account</DialogTitle>
            <DialogDescription className="text-sm text-emerald-300 mt-1">
              Enter account details for auto-fill in transactions
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-2 max-h-[calc(90vh-200px)] overflow-y-auto bg-emerald-950">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountName" className="text-xs text-emerald-200">
                    Account Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="newAccountName"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="Enter account name..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountContact" className="text-xs text-emerald-200">Contact No.</Label>
                  <Input
                    id="newAccountContact"
                    value={newAccount.contact}
                    onChange={(e) => setNewAccount({ ...newAccount, contact: e.target.value })}
                    placeholder="Enter contact number..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountNature" className="text-xs text-emerald-200">Nature</Label>
                  <div className="bg-emerald-900 border border-emerald-500 rounded-md">
                    <CustomDropdown
                      options={[
                        { value: 'Permanent', label: 'Permanent' },
                        { value: 'Seasonal', label: 'Seasonal' },
                      ]}
                      value={newAccount.nature || null}
                      onChange={(value) => {
                        setNewAccount({ ...newAccount, nature: value as 'Permanent' | 'Seasonal' | '', category: '', subCategory: '' });
                      }}
                      placeholder="Select nature..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountAddress" className="text-xs text-emerald-200">Address</Label>
                  <Input
                    id="newAccountAddress"
                    value={newAccount.address}
                    onChange={(e) => setNewAccount({ ...newAccount, address: e.target.value })}
                    placeholder="Enter address..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountCategory" className="text-xs text-emerald-200">Category</Label>
                  <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!newAccount.nature ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CustomDropdown
                      options={newAccount.nature 
                        ? expenseCategories
                            .filter(cat => cat.nature === newAccount.nature)
                            .map(cat => ({ value: cat.name, label: cat.name }))
                        : []
                      }
                      value={newAccount.category || null}
                      onChange={(value) => {
                        setNewAccount({ ...newAccount, category: value || '', subCategory: '' });
                      }}
                      placeholder="Select category..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="newAccountSubCategory" className="text-xs text-emerald-200">Sub Category</Label>
                  <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!newAccount.category ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CustomDropdown
                      options={newAccount.category
                        ? (expenseCategories.find(cat => cat.name === newAccount.category)?.subCategories || 
                           incomeCategories.find(cat => cat.name === newAccount.category)?.subCategories || [])
                            .map(sub => ({ value: sub, label: sub }))
                        : []
                      }
                      value={newAccount.subCategory || null}
                      onChange={(value) => {
                        setNewAccount({ ...newAccount, subCategory: value || '' });
                      }}
                      placeholder="Select sub category..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-emerald-800 bg-emerald-950">
            <Button variant="outline" onClick={() => setIsAddAccountOpen(false)} disabled={isSubmitting} className="h-9 border-emerald-700 text-emerald-200 hover:bg-emerald-900 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleSaveNewAccount} disabled={!newAccount.name.trim() || isSubmitting} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 bg-emerald-950 border-emerald-800">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-emerald-800">
            <DialogTitle className="text-lg font-semibold text-white">Edit Account</DialogTitle>
            <DialogDescription className="text-sm text-emerald-300 mt-1">
              Update account details. Changing name will update all related transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5 space-y-2 max-h-[calc(90vh-200px)] overflow-y-auto bg-emerald-950">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountName" className="text-xs text-emerald-200">
                    Account Name <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    id="editAccountName"
                    value={editAccount.name}
                    onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })}
                    placeholder="Enter account name..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountContact" className="text-xs text-emerald-200">Contact No.</Label>
                  <Input
                    id="editAccountContact"
                    value={editAccount.contact}
                    onChange={(e) => setEditAccount({ ...editAccount, contact: e.target.value })}
                    placeholder="Enter contact number..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountNature" className="text-xs text-emerald-200">Nature</Label>
                  <div className="bg-emerald-900 border border-emerald-500 rounded-md">
                    <CustomDropdown
                      options={[
                        { value: 'Permanent', label: 'Permanent' },
                        { value: 'Seasonal', label: 'Seasonal' },
                      ]}
                      value={editAccount.nature || null}
                      onChange={(value) => {
                        setEditAccount({ ...editAccount, nature: value as 'Permanent' | 'Seasonal' | '', category: '', subCategory: '' });
                      }}
                      placeholder="Select nature..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountAddress" className="text-xs text-emerald-200">Address</Label>
                  <Input
                    id="editAccountAddress"
                    value={editAccount.address}
                    onChange={(e) => setEditAccount({ ...editAccount, address: e.target.value })}
                    placeholder="Enter address..."
                    className="h-7 text-xs bg-emerald-900 border-emerald-500 text-white placeholder:text-emerald-400 focus-visible:border-emerald-400 focus-visible:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountCategory" className="text-xs text-emerald-200">Category</Label>
                  <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!editAccount.nature ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CustomDropdown
                      options={editAccount.nature 
                        ? expenseCategories
                            .filter(cat => cat.nature === editAccount.nature)
                            .map(cat => ({ value: cat.name, label: cat.name }))
                        : []
                      }
                      value={editAccount.category || null}
                      onChange={(value) => {
                        setEditAccount({ ...editAccount, category: value || '', subCategory: '' });
                      }}
                      placeholder="Select category..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="editAccountSubCategory" className="text-xs text-emerald-200">Sub Category</Label>
                  <div className={`bg-emerald-900 border border-emerald-500 rounded-md ${!editAccount.category ? 'opacity-50 pointer-events-none' : ''}`}>
                    <CustomDropdown
                      options={editAccount.category
                        ? (expenseCategories.find(cat => cat.name === editAccount.category)?.subCategories || 
                           incomeCategories.find(cat => cat.name === editAccount.category)?.subCategories || [])
                            .map(sub => ({ value: sub, label: sub }))
                        : []
                      }
                      value={editAccount.subCategory || null}
                      onChange={(value) => {
                        setEditAccount({ ...editAccount, subCategory: value || '' });
                      }}
                      placeholder="Select sub category..."
                      maxRows={5}
                      showScrollbar={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-emerald-800 bg-emerald-950">
            <Button variant="outline" onClick={() => setIsEditAccountOpen(false)} disabled={isSubmitting} className="h-9 border-emerald-700 text-emerald-200 hover:bg-emerald-900 hover:text-white">
              Cancel
            </Button>
            <Button onClick={handleSaveEditAccount} disabled={!editAccount.name.trim() || isSubmitting} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account "{selectedAccount}"? This will permanently delete all income and expense transactions associated with this account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onAddCategory={handleAddCategory}
        onUpdateCategoryName={handleUpdateCategoryName}
        onDeleteCategory={handleDeleteCategory}
        onAddSubCategory={handleAddSubCategory}
        onDeleteSubCategory={handleDeleteSubCategory}
      />
      </div>
    </ErrorBoundary>
  );
}

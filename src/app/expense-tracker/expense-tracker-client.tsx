

"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory, Project, FundTransaction, Loan, BankAccount, Income, Expense, Payment, Account } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, generateReadableId, getUserFriendlyErrorMessage } from "@/lib/utils";
import { logError } from "@/lib/error-logger";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { SummaryMetricsCard } from "./components/summary-metrics-card";
import { TransactionForm } from "./components/transaction-form";
import { TransactionTable } from "./components/transaction-table";
import { useCategoryManager } from "./hooks/use-category-manager";

export type DisplayTransaction = (Income | Expense) & { id: string };
import { useAccountManager } from "./hooks/use-account-manager";
import { getIncomeCategories, getExpenseCategories, getAllIncomeCategories, getAllExpenseCategories, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getProjectsRealtime, getPaymentsRealtime, getAllIncomes, getTotalExpenseCount } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";
import { ErrorBoundary } from "@/components/error-boundary"; 


import { Loader2, Pen, Save, Trash, FileText, Percent, RefreshCw, Landmark, Settings, Printer, PlusCircle, Edit, X, User, Calculator } from "lucide-react";
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
  mill: z.string().optional(), 
  expenseNature: z.string().optional(),
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
  const [totalExpenseCount, setTotalExpenseCount] = useState<number | null>(null);

  // NO PAGE LOADING - Data loads initially, then only CRUD updates
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DisplayTransaction | null>(null);
  
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
        setPayments(globalData.supplierPayments); // ✅ FIX: Sync payments from globalData
        
        // Update refs
        prevExpensesRef.current = globalData.expenses;
        prevFundTransactionsRef.current = globalData.fundTransactions;
        prevBankAccountsRef.current = globalData.bankAccounts;
    }, [globalData.expenses, globalData.fundTransactions, globalData.bankAccounts, globalData.incomes, globalData.supplierPayments]);
    
    // Fetch total expense count from Firestore
    useEffect(() => {
        const fetchCount = async () => {
            const count = await getTotalExpenseCount();
            setTotalExpenseCount(count);
        };
        fetchCount();
    }, [expenses]); // Re-fetch when local expenses change to keep it sync

    useEffect(() => {
        // Then set up realtime listeners for updates (only for data NOT in global context)
        // Note: incomes, expenses, payments are handled by globalData
        
        const unsubLoans = getLoansRealtime(setLoans, () => {});
        const unsubProjects = getProjectsRealtime(setProjects, () => {});

        return () => {
             unsubLoans(); unsubProjects();
        }
    }, []); // Only run once on mount

  // NO PAGE LOADING - Components render immediately

  const allTransactions: DisplayTransaction[] = useMemo(() => {

      // Handle empty arrays - income and expenses might be [] initially
      const incomeArray = income || [];
      const expensesArray = expenses || [];
      
      // Don't return early - even if empty, we should process them
      const combined = [...incomeArray, ...expensesArray];
      
      // Filter out deleted transactions
      const activeTransactions = combined.filter(t => !t.isDeleted);
      
      const sorted = activeTransactions.sort((a, b) => (b.transactionId || '').localeCompare(a.transactionId || ''));
      
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

  // Memoize the last ID numbers to avoid re-scanning the entire array on every render
  const lastIncomeIdNumber = useMemo(() => {
      const prefix = 'IN';
      const relevantTransactions = allTransactions.filter(t => t.transactionId?.startsWith(prefix));
      return relevantTransactions.reduce((max, t) => {
          const numMatch = t.transactionId?.match(/^IN(\d+)$/);
          if (numMatch && numMatch[1]) {
              const num = parseInt(numMatch[1], 10);
              return num > max ? num : max;
          }
          return max;
      }, 0);
  }, [allTransactions]);

  const lastExpenseIdNumber = useMemo(() => {
      const prefix = 'EX';
      const relevantTransactions = allTransactions.filter(t => t.transactionId?.startsWith(prefix));
      let lastNum = relevantTransactions.reduce((max, t) => {
          const numMatch = t.transactionId?.match(/^EX(\d+)$/);
          if (numMatch && numMatch[1]) {
              const num = parseInt(numMatch[1], 10);
              return num > max ? num : max;
          }
          return max;
      }, 0);

      // Check payments
      if (payments && payments.length > 0) {
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
      return lastNum;
  }, [allTransactions, payments]);

  const getNextTransactionId = useCallback((type: 'Income' | 'Expense') => {
      const prefix = type === 'Income' ? 'IN' : 'EX';
      const lastNum = type === 'Income' ? lastIncomeIdNumber : lastExpenseIdNumber;
      return generateReadableId(prefix, lastNum, 5);
  }, [lastIncomeIdNumber, lastExpenseIdNumber]);

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
  
  // Watch form fields (avoids useWatch to prevent conditional-hook issues with dynamic import / Strict Mode)
  const watchedValues = form.watch(['transactionType', 'paymentMethod', 'expenseNature', 'category', 'subCategory', 'incomeAmount', 'expenseAmount', 'payee']);

  const [
    selectedTransactionType,
    selectedPaymentMethod,
    selectedExpenseNature,
    selectedCategory,
    selectedSubCategory,
    incomeAmountValue,
    expenseAmountValue,
    payeeValue
  ] = (watchedValues ?? []) as [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
    number | undefined,
    number | undefined,
    string | undefined
  ];


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
            const nextId = getNextTransactionId(selectedTransactionType === 'Income' ? 'Income' : 'Expense');
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

  const handleDeleteTransaction = useCallback(async (transaction: DisplayTransaction) => {
    if (!window.confirm(`Are you sure you want to delete this ${transaction.transactionType}?`)) {
      return;
    }
    
    try {
      if (transaction.transactionType === 'Income') {
        await deleteIncome(transaction.id);
      } else {
        await deleteExpense(transaction.id);
      }
      toast({ title: "Transaction deleted", variant: "success" });
      
      // If we deleted the editing transaction, clear the form
      if (editingTransaction?.id === transaction.id) {
          handleNew();
      }
    } catch (error) {
      logError(error, "expense-tracker-client: deleteTransaction", "medium");
      toast({
        title: "Error deleting transaction",
        description: getUserFriendlyErrorMessage(error, "transaction"),
        variant: "destructive",
      });
    }
  }, [editingTransaction, handleNew, toast]);


  useEffect(() => {
    if (!editingTransaction) return;

    const transaction = editingTransaction;
    setSelectedAccount(toTitleCase(transaction.payee));
    reset({
        ...transaction,
        date: new Date(transaction.date),
        taxAmount: transaction.taxAmount || 0,
        cdAmount: (transaction as any).cdAmount || 0,
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
            const accountName = bankAccounts.find(acc => acc.id === balanceKey)?.accountHolderName || 'Cash In Hand';
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
      const transactionData: Partial<Omit<Transaction, 'id'>> = {
        ...baseValues,
        transactionType: activeType,
        amount: activeAmount,
        date: format(values.date, "yyyy-MM-dd"),
        payee: toTitleCase(values.payee),
        mill: toTitleCase(values.mill || ''),
        projectId: values.projectId === 'none' ? '' : values.projectId,
        paymentMethod: values.paymentMethod as Transaction['paymentMethod'],
        status: values.status as Transaction['status'],
        expenseType: values.expenseType as Transaction['expenseType'],
        expenseNature: values.expenseNature as Transaction['expenseNature'],
        bankAccountId: values.paymentMethod === 'Cash' ? undefined : values.bankAccountId,
      };

      if (editingTransaction) {
        if (activeType === 'Income') {
            await updateIncome(editingTransaction.id, transactionData as Partial<Omit<Income, 'id'>>);
        } else {
            await updateExpense(editingTransaction.id, transactionData as Partial<Omit<Expense, 'id'>>);
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
        const message = error instanceof Error ? error.message : "Transaction could not be saved.";
        toast({ title: "Failed to save transaction", description: message, variant: "destructive" });
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


  const runningLedger = useMemo(() => {
    // Since transactions are displayed newest first, we need to calculate balance from oldest to newest
    // Use filteredTransactions (all transactions for selected account) for calculation
    
    // Create a copy and sort by date (oldest first) for balance calculation
    // Dates are stored in ISO format (yyyy-MM-dd) in the database
    const parseDate = (dateStr: string): number => {
      if (!dateStr || typeof dateStr !== 'string') return 0;
      
      // First try ISO format (yyyy-MM-dd) - this is how dates are stored in database
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const isoDate = new Date(dateStr + 'T00:00:00'); 
        if (!isNaN(isoDate.getTime())) {
          return isoDate.getTime();
        }
      }
      
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
      
      const fallbackDate = new Date(dateStr);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate.getTime();
      }
      
      return 0;
    };
    
    // Use filteredTransactions for calculation to ensure we have ALL transactions
    const sortedForCalculation = [...filteredTransactions].sort((a, b) => {
      // PRIMARY SORT: By date field (date-wise sorting - oldest first)
      const timeA = parseDate(a.date);
      const timeB = parseDate(b.date);
      
      if (timeA > 0 && timeB > 0) {
        if (timeA !== timeB) {
          return timeA - timeB; 
        }
      } else if (timeA > 0) {
        return -1;
      } else if (timeB > 0) {
        return 1;
      }
      
      // SECONDARY SORT: By createdAt (oldest first)
      if (a.createdAt && b.createdAt) {
        const createdAtCompare = a.createdAt.localeCompare(b.createdAt);
        if (createdAtCompare !== 0) {
          return createdAtCompare;
        }
      } else if (a.createdAt) {
        return -1;
      } else if (b.createdAt) {
        return 1;
      }
      
      // TERTIARY SORT: By transactionId (ascending)
      const idA = (a.transactionId || '').toUpperCase();
      const idB = (b.transactionId || '').toUpperCase();
      return idA.localeCompare(idB);
    });
    
    // Calculate running balance from oldest to newest
    let balance = 0;
    const withBalances = sortedForCalculation.map((transaction) => {
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
    
    // Create a map of balances by transaction ID
    const balanceMap = new Map(withBalances.map(tx => [tx.id, tx.runningBalance]));
    
    // Return transactions in the display order (Newest First - default filteredTransactions order)
    return filteredTransactions.map(transaction => {
      const calculatedBalance = balanceMap.get(transaction.id);
      return {
        ...transaction,
        runningBalance: calculatedBalance !== undefined ? calculatedBalance : 0,
      };
    });
  }, [filteredTransactions]);

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
      <div className="space-y-3">
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center gap-2">
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

      <div className="rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className="px-2.5 py-1.5 border-b sm:border-b-0 border-slate-200/80">
            <div className="text-[10px] font-semibold text-slate-500">Total Income</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums leading-5">{formatCurrency(totalIncome)}</div>
          </div>
          <div className="px-2.5 py-1.5 border-b sm:border-b-0 border-slate-200/80 sm:border-l border-slate-200/80">
            <div className="text-[10px] font-semibold text-slate-500">Total Expense</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums leading-5">{formatCurrency(totalExpense)}</div>
          </div>
          <div className="px-2.5 py-1.5 sm:border-l border-slate-200/80">
            <div className="text-[10px] font-semibold text-slate-500">Net Balance</div>
            <div className={cn(
              "text-[13px] font-bold tabular-nums leading-5",
              netProfitLoss >= 0 ? "text-primary" : "text-rose-700"
            )}>
              {formatCurrency(netProfitLoss)}
            </div>
          </div>
          <div className="px-2.5 py-1.5 sm:border-l border-slate-200/80">
            <div className="text-[10px] font-semibold text-slate-500">Transactions</div>
            <div className="text-[13px] font-bold text-slate-900 tabular-nums leading-5">{totalTransactions}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] h-auto items-start">
        <div className="min-w-0 flex flex-col gap-2">
          <Card className="rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] flex flex-col min-h-0">
            <CardContent className="space-y-1 p-2.5 flex-1 overflow-auto">
              <TransactionForm
                form={form}
                onSubmit={handleSubmit(onSubmit)}
                handleNew={handleNew}
                handleTransactionIdBlur={handleTransactionIdBlur}
                isSubmitting={isSubmitting}
                editingTransaction={editingTransaction}
                setLastAmountSource={setLastAmountSource}
                bankAccounts={bankAccounts}
                projects={projects}
                selectedTransactionType={selectedTransactionType === 'Income' ? 'Income' : 'Expense'}
                errors={errors}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[12px] border border-slate-200/80 bg-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.10)] backdrop-blur-[14px] flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col gap-1.5 p-2.5 overflow-auto">
              {selectedAccount && (() => {
                const accountName = selectedAccount;
                const account = accounts.get(accountName);
                const accountTransactions = filteredTransactions.filter(
                  tx => toTitleCase(tx.payee) === accountName
                );
                const nature = account?.nature || accountTransactions.find(tx => (tx as any).expenseNature)?.expenseNature || null;
                const category = account?.category || accountTransactions.find(tx => tx.category)?.category || null;
                const subCategory = account?.subCategory || accountTransactions.find(tx => tx.subCategory)?.subCategory || null;
                
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-200/80">
                      <User className="h-3.5 w-3.5 text-slate-600" />
                      <h3 className="font-semibold text-sm text-slate-900">Account Details</h3>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                        <span className="text-slate-600 font-medium">Name</span>
                        <span className="text-slate-900 font-bold truncate" title={accountName}>{accountName}</span>
                      </div>
                      {account?.contact && (
                        <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                          <span className="text-slate-600 font-medium">Contact</span>
                          <span className="text-slate-900 font-bold truncate" title={account.contact}>{account.contact}</span>
                        </div>
                      )}
                      {account?.address && (
                        <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                          <span className="text-slate-600 font-medium">Address</span>
                          <span className="text-slate-900 font-bold truncate" title={account.address}>{account.address}</span>
                        </div>
                      )}
                      <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                        <span className="text-slate-600 font-medium">Nature</span>
                        <span className="text-slate-900 font-bold truncate">{nature ? toTitleCase(nature) : '—'}</span>
                      </div>
                      <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                        <span className="text-slate-600 font-medium">Category</span>
                        <span className="text-slate-900 font-bold truncate">{category ? toTitleCase(category) : '—'}</span>
                      </div>
                      <div className="h-7 flex items-center justify-between px-2.5 text-xs bg-white/70 border border-slate-200/80 rounded-lg shrink-0 backdrop-blur-[14px]">
                        <span className="text-slate-600 font-medium">Sub Category</span>
                        <span className="text-slate-900 font-bold truncate">{subCategory ? toTitleCase(subCategory) : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 h-[430px]">
          <TransactionTable 
            transactions={filteredTransactions} 
            onEdit={handleEdit}
            onDelete={handleDeleteTransaction}
            totalExpenseCount={totalExpenseCount}
          />
        </div>
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
                {/* Bulk actions removed */}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">

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



"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Transaction, IncomeCategory, ExpenseCategory, FundTransaction, Loan, BankAccount, Income, Expense, Payment, Account } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency, generateReadableId, getUserFriendlyErrorMessage } from "@/lib/utils";
import { logError } from "@/lib/error-logger";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { confirm } from "@/lib/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm, Controller } from "react-hook-form";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { SummaryMetricsCard } from "./components/summary-metrics-card";
import { TransactionForm } from "./components/transaction-form";
import { TransactionTable } from "./components/expense-transaction-table";
import { useCategoryManager } from "./hooks/use-category-manager";

export type DisplayTransaction = (Income | Expense) & { id: string };
import { useAccountManager } from "./hooks/use-account-manager";
import { getIncomeCategories, getExpenseCategories, getAllIncomeCategories, getAllExpenseCategories, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getPaymentsRealtime, getAllIncomes, getTotalExpenseCount } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";
import { ErrorBoundary } from "@/components/error-boundary"; 
import { printHtmlContent } from "@/lib/electron-print";


import { Loader2, Pen, Save, Trash, FileText, Percent, RefreshCw, Landmark, Settings, Printer, PlusCircle, Edit, X, User, Calculator, ChevronLeft, ChevronRight, MoreVertical, History as HistoryIcon, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
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
  loanId: z.string().optional(),
  isInternal: z.boolean().optional(),
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
    isInternal: false,
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

        return () => {
             unsubLoans();
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

  const { uniquePayees, lastIncomeIdNumber, lastExpenseIdNumber } = useMemo(() => {
      const payees = new Set<string>();
      let maxIn = 0;
      let maxEx = 0;
      
      const inRegex = /^IN(\d+)$/;
      const exRegex = /^EX(\d+)$/;

      allTransactions.forEach(t => {
          // Payee extraction
          if (t.payee && typeof t.payee === 'string') {
              const trimmed = t.payee.trim();
              if (trimmed) payees.add(toTitleCase(trimmed));
          }

          // ID tracking
          const txId = t.transactionId || '';
          if (txId.startsWith('IN')) {
              const match = txId.match(inRegex);
              if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxIn) maxIn = num;
              }
          } else if (txId.startsWith('EX')) {
              const match = txId.match(exRegex);
              if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxEx) maxEx = num;
              }
          }
      });

      // Also check payments for EX IDs
      if (payments && payments.length > 0) {
          payments.forEach(p => {
              const pid = p.paymentId || '';
              if (pid.startsWith('EX')) {
                  const match = pid.match(exRegex);
                  if (match) {
                      const num = parseInt(match[1], 10);
                      if (num > maxEx) maxEx = num;
                  }
              }
          });
      }

      return {
          uniquePayees: Array.from(payees).sort(),
          lastIncomeIdNumber: maxIn,
          lastExpenseIdNumber: maxEx
      };
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
    const isConfirmed = await confirm(`Are you sure you want to delete this ${transaction.transactionType}?`, {
      title: "Confirm Deletion",
      variant: "destructive",
      confirmText: "Delete",
      cancelText: "Cancel"
    });
    
    if (!isConfirmed) return;
    
    try {
      if (transaction.transactionType === 'Income') {
        await deleteIncome(transaction.id);
      } else {
        await deleteExpense(transaction.id);
      }
      toast({ title: "Transaction deleted", variant: "success" });
      
      // Always call handleNew() after deletion to reset focus and clear state
      // even if we weren't explicitly editing that exact row, it's safer for UX
      handleNew();
    } catch (error) {
      logError(error, "expense-tracker-client: deleteTransaction", "medium");
      toast({
        title: "Error deleting transaction",
        description: getUserFriendlyErrorMessage(error, "transaction"),
        variant: "destructive",
      });
    }
  }, [handleNew, toast]);


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
            if (t.isInternal) return; // ✅ Skip internal/adjustment entries for bank balance
            
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
    // Skip balance check for internal entries
    if (activeType === 'Expense' && !values.isInternal) {
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
            const existing = allTransactions.find(t => t.transactionId === values.transactionId);
            const accountSuffix = existing ? ` for ${existing.payee}` : "";
            toast({
                title: "ID Already Exists",
                description: `Transaction ID ${values.transactionId} already exists${accountSuffix}. It might be hidden by your current filters.`,
                variant: 'destructive',
                action: existing ? (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            setSelectedAccount(null);
                            // Setting search would be good but requires state
                            // For now, at least clear the account filter
                            toast({ title: "Account filter cleared", description: "Search for the ID in the table below." });
                        }}
                    >
                        Find It
                    </Button>
                ) : undefined
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
        status: values.status as Transaction['status'],
        expenseType: values.expenseType as Transaction['expenseType'],
        expenseNature: values.expenseNature as Transaction['expenseNature'],
        isInternal: values.isInternal,
        bankAccountId: (values.isInternal || values.paymentMethod === 'Cash') ? undefined : values.bankAccountId,
        paymentMethod: values.isInternal ? 'Other' : (values.paymentMethod as Transaction['paymentMethod']),
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

    printHtmlContent(html);
  }, [toast]);
  
  const { totalIncome, totalExpense, netProfitLoss, totalTransactions } = useMemo(() => {
    // 💡 Accounting Logic: 
    // If NO account is selected (Overall View), exclude internal entries to show real cash flow.
    // If an account IS selected, include everything for ledger balancing.
    const totalsTransactions = selectedAccount 
        ? filteredTransactions 
        : filteredTransactions.filter(t => !t.isInternal);

    const incomeTotal = totalsTransactions
      .filter((t) => t.transactionType === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = totalsTransactions
      .filter((t) => t.transactionType === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate final running balance
    const finalRunningBalance = incomeTotal - expenseTotal;
    
    return {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      netProfitLoss: finalRunningBalance,
      totalTransactions: totalsTransactions.length,
    };
  }, [filteredTransactions, selectedAccount]);
    
  // ⌨️ KEYBOARD NAVIGATION (ARROW KEYS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowLeft') {
        const currentIndex = accountOptions.findIndex(o => o.value === selectedAccount);
        if (currentIndex > 0) {
          setSelectedAccount(accountOptions[currentIndex - 1].value);
        } else if (accountOptions.length > 0) {
          setSelectedAccount(accountOptions[accountOptions.length - 1].value);
        }
      } else if (e.key === 'ArrowRight') {
        const currentIndex = accountOptions.findIndex(o => o.value === selectedAccount);
        if (currentIndex !== -1 && currentIndex < accountOptions.length - 1) {
          setSelectedAccount(accountOptions[currentIndex + 1].value);
        } else if (accountOptions.length > 0) {
          setSelectedAccount(accountOptions[0].value);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAccount, accountOptions]);

  return (
    <ErrorBoundary>
      <div className="space-y-4">
      {/* 🔮 PREMIUM COMFORT-COMPACT DASHBOARD */}
      <div className="w-full relative rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden mb-3 transition-all duration-300">
        <div className="absolute left-0 top-0 w-1.5 h-full bg-purple-600" />
        
        <div className="p-2.5 space-y-2.5">
          {/* Row 1: Balanced Identity & Metadata Layout (Dark Purple Theme) */}
          <div className="flex flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              {/* Profile Avatar (Dark Purple Theme) */}
              <div className="shrink-0 mt-0.5">
                <div className="h-11 w-11 bg-purple-950 text-white rounded-[4px] flex items-center justify-center font-black text-lg shadow-sm border border-purple-800 transition-all">
                   {selectedAccount ? selectedAccount.charAt(0).toUpperCase() : <Calculator className="h-5 w-5" />}
                </div>
              </div>
              
              {/* Search & Metadata Stack (Equal Width) */}
              <div className="flex flex-col min-w-0">
                <div className="w-[350px] shrink-0 h-8">
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
                    placeholder="Search Account..."
                    inputClassName="rounded-[4px] border-purple-800 focus:ring-purple-500 h-8 text-xs shadow-none bg-purple-50/5 text-purple-900"
                  />
                </div>

                {selectedAccount && (() => {
                  const account = accounts.get(selectedAccount);
                  const nature = account?.nature || (filteredTransactions.find(tx => toTitleCase(tx.payee) === selectedAccount) as any)?.expenseNature;
                  const category = account?.category;
                  const subCategory = (account as any)?.subCategory;
                  
                  return (
                    <div className="w-[350px] mt-1 px-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-bold uppercase tracking-tight overflow-hidden leading-tight">
                      <div className="flex items-center gap-3">
                         {nature && <span className="flex items-center gap-0.5"><span className="text-purple-600 font-extrabold">NATURE:</span> <span className="text-slate-900 font-black">{toTitleCase(nature)}</span></span>}
                         {category && <span className="flex items-center gap-0.5"><span className="text-purple-600 font-extrabold">CAT:</span> <span className="text-slate-900 font-black">{toTitleCase(category)}</span></span>}
                         {subCategory && <span className="flex items-center gap-0.5"><span className="text-purple-400 font-extrabold">SUB:</span> <span className="text-slate-900 font-black">{toTitleCase(subCategory)}</span></span>}
                      </div>

                      <div className="flex items-center gap-3 border-l border-slate-200 pl-3">
                        {account?.contact && <span className="flex items-center gap-0.5"><span className="text-slate-400 font-black">TEL:</span> <span className="text-slate-700 font-extrabold">{account.contact}</span></span>}
                        {account?.address && <span className="flex items-center gap-0.5"><span className="text-slate-400 font-black">LOC:</span> <span className="text-slate-700 font-extrabold truncate max-w-[120px]">{account.address}</span></span>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Actions Toolbar (Dark Purple Theme) */}
            <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                <div className="flex items-center bg-purple-950 p-0.5 rounded-[4px] border border-purple-800 shadow-sm h-8">
                  <Button onClick={() => {
                    const currentIndex = accountOptions.findIndex(o => o.value === selectedAccount);
                    if (currentIndex > 0) setSelectedAccount(accountOptions[currentIndex - 1].value);
                    else if (accountOptions.length > 0) setSelectedAccount(accountOptions[accountOptions.length - 1].value);
                  }} size="icon" variant="ghost" className="h-[26px] w-[26px] text-purple-200 hover:bg-purple-800 rounded-[4px] transition-all"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="px-2 text-[9px] font-black text-white tabular-nums min-w-[32px] text-center">{selectedAccount ? `${accountOptions.findIndex(o => o.value === selectedAccount) + 1}/${accountOptions.length}` : "ALL"}</span>
                  <Button onClick={() => {
                    const currentIndex = accountOptions.findIndex(o => o.value === selectedAccount);
                    if (currentIndex !== -1 && currentIndex < accountOptions.length - 1) setSelectedAccount(accountOptions[currentIndex + 1].value);
                    else if (accountOptions.length > 0) setSelectedAccount(accountOptions[0].value);
                  }} size="icon" variant="ghost" className="h-[26px] w-[26px] text-purple-200 hover:bg-purple-800 rounded-[4px] transition-all"><ChevronRight className="h-4 w-4" /></Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-8 rounded-[4px] border-purple-800 bg-purple-950 text-white font-bold text-[10px] px-3 gap-1.5 border hover:bg-purple-900 transition-colors shadow-sm uppercase tracking-widest leading-none">
                       MENU <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-xl rounded-md py-1 p-1 outline-none">
                    <DropdownMenuItem onClick={handleAddAccount} className="text-[10px] font-bold text-slate-700 focus:bg-purple-600 focus:text-white px-3 h-8 cursor-pointer rounded-[4px] outline-none border-0 mb-0.5">NEW ACCOUNT</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsCategoryManagerOpen(true)} className="text-[10px] font-bold text-slate-700 focus:bg-purple-600 focus:text-white px-3 h-8 cursor-pointer rounded-[4px] outline-none border-0 mb-0.5">MANAGE CATEGORIES</DropdownMenuItem>
                    {selectedAccount && (
                      <>
                        <DropdownMenuItem onClick={handleEditAccount} className="text-[10px] font-bold text-slate-700 focus:bg-purple-600 focus:text-white px-3 h-8 cursor-pointer rounded-[4px] outline-none border-0 mb-0.5">EDIT DETAILS</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handlePrintStatement(selectedAccount, runningLedger)} className="text-[10px] font-bold text-slate-700 focus:bg-purple-600 focus:text-white px-3 h-8 cursor-pointer rounded-[4px] outline-none border-0 mb-0.5">PRINT LEDGER</DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-slate-50" />
                        <DropdownMenuItem onClick={() => setIsDeleteAccountOpen(true)} className="text-[10px] font-bold text-rose-600 focus:bg-rose-600 focus:text-white h-8 border-0 outline-none px-3 cursor-pointer rounded-[4px]">DELETE ACCOUNT</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Compact Metrics (Dark Purple Theme) */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-purple-950 border border-purple-800 rounded-[4px] p-1.5 flex items-center justify-between group transition-all shadow-sm">
               <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest leading-none">TOTAL CREDIT</p>
                  <p className="text-xs font-black text-white tabular-nums truncate">{formatCurrency(totalIncome)}</p>
               </div>
               <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500/40" />
            </div>

            <div className="bg-purple-950 border border-purple-800 rounded-[4px] p-1.5 flex items-center justify-between group transition-all shadow-sm">
               <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest leading-none">TOTAL DEBIT</p>
                  <p className="text-xs font-black text-white tabular-nums truncate">{formatCurrency(totalExpense)}</p>
               </div>
               <ArrowDownCircle className="h-3.5 w-3.5 text-rose-500/40" />
            </div>

            <div className="bg-purple-600 border border-purple-500 rounded-[4px] p-1.5 flex items-center justify-between shadow-md">
               <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold text-purple-100 uppercase tracking-widest leading-none">NET BALANCE</p>
                  <p className="text-xs font-black text-white tabular-nums truncate">{formatCurrency(netProfitLoss)}</p>
               </div>
               <Landmark className="h-3.5 w-3.5 text-white/40" />
            </div>

            <div className="bg-purple-950 border border-purple-800 rounded-[4px] p-1.5 flex items-center justify-between group transition-all shadow-sm">
               <div className="space-y-0.5 min-w-0">
                  <p className="text-[9px] font-bold text-purple-300 uppercase tracking-widest leading-none">TXNS COUNT</p>
                  <p className="text-xs font-black text-white tabular-nums truncate">{totalTransactions}</p>
               </div>
               <HistoryIcon className="h-3.5 w-3.5 text-purple-400/40" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] h-auto items-start">
        <div className="min-w-0 flex flex-col gap-2">
          <Card className="rounded-[14px] border border-white/60 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-[12px] transition-all duration-300 hover:shadow-[0_12px_45px_0_rgba(31,38,135,0.12)] hover:translate-y-[-2px] border-b-[3px] border-b-primary/20 flex flex-col min-h-0">
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
                selectedTransactionType={selectedTransactionType === 'Income' ? 'Income' : 'Expense'}
                errors={errors}
              />
            </CardContent>
          </Card>


        </div>

        <div className="min-w-0 h-[430px]">
          <TransactionTable 
            transactions={filteredTransactions} 
            onEdit={handleEdit}
            onDelete={handleDeleteTransaction}
            totalExpenseCount={totalExpenseCount}
            selectedAccount={selectedAccount}
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

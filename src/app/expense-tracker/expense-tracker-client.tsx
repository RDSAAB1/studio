

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SummaryMetricsCard } from "./components/summary-metrics-card";
import { TransactionForm } from "./components/transaction-form";
import { TransactionTable } from "./components/expense-transaction-table";
import { OptionsManagerDialog } from "@/components/sales/options-manager-dialog";

import { VarietyAccounts } from "./components/accounts/variety-accounts";
import { ReceiptsAccounts } from "./components/accounts/receipts-accounts";
import { TagAccounts } from "./components/accounts/tag-accounts";
import { LedgerAccounts } from "./components/accounts/ledger-accounts";
import { PnlAccounts } from "./components/accounts/pnl-accounts";
import { BalanceSheetAccounts } from "./components/accounts/balance-sheet-accounts";
import { TrialBalanceAccounts } from "./components/accounts/trial-balance-accounts";
import { PrintSupplierStatementDialog } from "@/components/supplier/print-supplier-statement-dialog";
import { SupplierPurchaseDialog } from "./components/supplier-purchase-dialog";
import { CustomerSaleDialog } from "./components/customer-sale-dialog";
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";

export type DisplayTransaction = (Income | Expense) & { id: string; customerPaymentRef?: any };
import { db } from "@/lib/database";
import { useLiveQuery } from "@/lib/use-live-query";
import { useAccountManager, validateAndExtractGST } from "./hooks/use-account-manager";
import { getIncomeCategories, getExpenseCategories, getAllIncomeCategories, getAllExpenseCategories, addIncome, addExpense, deleteIncome, deleteExpense, updateLoan, updateIncome, updateExpense, getIncomeRealtime, getFundTransactionsRealtime, getLoansRealtime, getBankAccountsRealtime, getPaymentsRealtime, getAllIncomes, getTotalExpenseCount, getOptionsRealtime, addOption, updateOption, deleteOption } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc, deleteDoc, addDoc } from "firebase/firestore";
import { firestoreDB } from "@/lib/firebase";
import { ErrorBoundary } from "@/components/error-boundary";
import { printHtmlContent } from "@/lib/electron-print";


import { Loader2, Pen, Save, Trash, FileText, Percent, RefreshCw, Landmark, Settings, Printer, PlusCircle, Edit, X, User, Calculator, ChevronLeft, ChevronRight, MoreVertical, History as HistoryIcon, ArrowUpCircle, ArrowDownCircle, Info } from "lucide-react";
import { format, addMonths, parse, isValid } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

// Zod Schema for form validation
const transactionFormSchema = z.object({
  id: z.string().optional(),
  transactionId: z.string().optional(),
  date: z.preprocess((arg) => {
    if (typeof arg === "string" || arg instanceof Date) return new Date(arg);
    return arg;
  }, z.date({ invalid_type_error: "Invalid Date" })),
  transactionType: z.enum(["Income", "Expense"]),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  amount: z.coerce.number().min(0, "Amount cannot be negative."),
  entryType: z.enum(["Income", "Expense", "Buy", "Sale", "Loss", "Use", "Extra Receive", "Lend", "Borrow", "Lend Return", "Borrow Return", "Receivable", "Payable", "Salary", "Laboury", "Transport", "Brokerage", "Capital", "Liabilities", "Building", "Machinery", "Miscellaneous", "Opening Dr", "Opening Cr"]),
  rate: z.coerce.number().optional(),
  quantity: z.coerce.number().optional(),
  variety: z.string().optional(),
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
}).superRefine((data, ctx) => {
  const stockOnlyTypes = ['Loss', 'Use', 'Extra Receive'];
  if (!stockOnlyTypes.includes(data.entryType) && data.amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Amount must be greater than 0 for this transaction type.",
      path: ["amount"],
    });
  }
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
    entryType: 'Expense',
    rate: 0,
    quantity: 0,
    variety: '',
    payee: '',
    description: '',
    paymentMethod: 'Cash',
    status: 'Paid',
    transactionId: nextTxId,
    taxAmount: 0,
    cdAmount: 0,
    expenseType: 'Business',
    isInternal: false,
    bankAccountId: '',
  };
};



import { AddAccountForm } from "./components/accounts/add-account-form";

interface EditAccountFormProps {
  initialAccount: any;
  onSave: (data: any) => void;
  onClose: () => void;
  isSearchingGST: boolean;
  handleSearchGST: (val: string) => void;
  searchedGSTDetails: any;
  isSubmitting: boolean;
  isSearchingPAN?: boolean;
  handleSearchPAN?: (val: string) => void;
  handlePastePANText?: (text: string, isEdit: boolean) => void;
  searchedFirms?: any[];
  handleSelectFirm?: (firm: any, isEdit: boolean) => void;
}

function EditAccountForm({
  initialAccount,
  onSave,
  onClose,
  isSearchingGST,
  handleSearchGST,
  searchedGSTDetails,
  isSubmitting,
  isSearchingPAN = false,
  handleSearchPAN,
  handlePastePANText,
  searchedFirms = [],
  handleSelectFirm,
}: EditAccountFormProps) {
  const [editAccount, setEditAccount] = useState(initialAccount);

  useEffect(() => {
    setEditAccount(initialAccount);
  }, [initialAccount]);

  return (
    <>
      <div className="px-6 py-3.5 space-y-2.5 max-h-[calc(90vh-200px)] overflow-y-auto bg-popover">
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">Account Type</Label>
            <div className="flex gap-1.5">
              {[
                { value: 'PARTY LEDGER', label: 'Party Account' },
                { value: 'MASTER ACCOUNT', label: 'Master Account' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditAccount({
                    ...editAccount,
                    subCategory: opt.value,
                    category: opt.value,
                    nature: 'Indirect Expense',
                    accountingTag: 'Indirect Expense'
                  })}
                  className={`flex-1 h-8 text-[9px] font-bold uppercase rounded border transition-all ${
                    editAccount.subCategory === opt.value
                      ? 'bg-primary border-primary text-white shadow-sm'
                      : 'bg-card border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="editAccountName" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Account Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="editAccountName"
                value={editAccount.name}
                onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value.toUpperCase() })}
                placeholder="Enter account name..."
                className="h-8.5 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="editAccountContact" className="text-xs font-bold text-foreground uppercase tracking-wider">Contact No.</Label>
              <Input
                id="editAccountContact"
                value={editAccount.contact}
                onChange={(e) => setEditAccount({ ...editAccount, contact: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Enter contact number..."
                maxLength={10}
                className="h-8.5 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="editAccountAddress" className="text-xs font-bold text-foreground uppercase tracking-wider">Address</Label>
            <Input
              id="editAccountAddress"
              value={editAccount.address}
              onChange={(e) => setEditAccount({ ...editAccount, address: e.target.value.toUpperCase() })}
              placeholder="Enter address..."
              className="h-8.5 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex gap-1.5">
              {[
                { value: 'fatherName', label: 'Father Name' },
                { value: 'gst', label: 'GST' },
                { value: 'pan', label: 'PAN Card' },
                { value: 'other', label: 'Other' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditAccount({ ...editAccount, extraFieldType: opt.value as any })}
                  className={`flex-1 h-8 text-[10px] font-bold uppercase rounded border transition-all ${
                    editAccount.extraFieldType === opt.value
                      ? 'bg-primary border-primary text-white shadow-sm'
                      : 'bg-card border-border text-foreground hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 items-end">
              <div className="flex-1">
                <Input
                  id="editAccountExtraValue"
                  type="text"
                  value={editAccount.extraFieldValue || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (editAccount.extraFieldType === 'gst') {
                      setEditAccount({ ...editAccount, extraFieldValue: val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) });
                    } else if (editAccount.extraFieldType === 'pan') {
                      setEditAccount({ ...editAccount, extraFieldValue: val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) });
                    } else {
                      setEditAccount({ ...editAccount, extraFieldValue: val.toUpperCase() });
                    }
                  }}
                  maxLength={editAccount.extraFieldType === 'gst' ? 15 : (editAccount.extraFieldType === 'pan' ? 10 : undefined)}
                  placeholder={editAccount.extraFieldType === 'gst' ? 'Enter GST...' : (editAccount.extraFieldType === 'pan' ? 'Enter PAN...' : (editAccount.extraFieldType === 'other' ? 'Enter Details...' : 'Enter Father Name...'))}
                  className="h-8.5 text-xs bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>
              {editAccount.extraFieldType === 'gst' && (
                <Button
                  type="button"
                  onClick={() => handleSearchGST(editAccount.extraFieldValue)}
                  disabled={editAccount.extraFieldValue.trim().length !== 15 || isSearchingGST}
                  className="h-8 px-4 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                >
                  {isSearchingGST ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "SEARCH ON CLEARTAX"}
                </Button>
              )}
              {editAccount.extraFieldType === 'pan' && (
                <Button
                  type="button"
                  onClick={() => {
                    const panVal = (editAccount.extraFieldValue || "").trim().toUpperCase();
                    if (panVal.length === 10) {
                      handleSearchPAN && handleSearchPAN(panVal);
                    }
                  }}
                  disabled={editAccount.extraFieldValue.trim().length !== 10 || isSearchingPAN}
                  className="h-8 px-4 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-[10px] tracking-wider uppercase rounded shadow shrink-0"
                >
                  {isSearchingPAN ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "SEARCH PAN"}
                </Button>
              )}
            </div>
            {editAccount.extraFieldType === 'gst' && (() => {
              const res = validateAndExtractGST(editAccount.extraFieldValue);
              if (res.isValid && res.pan) {
                return (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] text-emerald-800 font-bold space-y-0.5 animate-fadeIn">
                    <div><span className="text-emerald-600">PAN CARD NO:</span> {String(res.pan).toUpperCase()}</div>
                    <div><span className="text-emerald-600">STATE CODE:</span> {res.stateCode}</div>
                    <div><span className="text-emerald-600">STATE NAME:</span> {res.stateName}</div>
                  </div>
                );
              } else if (editAccount.extraFieldValue.trim().length > 0) {
                return (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-md text-[10px] text-rose-800 font-bold">
                    {res.error || "GST number is incomplete or invalid"}
                  </div>
                );
              }
              return null;
            })()}

            {editAccount.extraFieldType === 'pan' && (() => {
              const panRegex = new RegExp("^[A-Z]{5}[0-9]{4}[A-Z]{1}$");
              const val = editAccount.extraFieldValue.trim().toUpperCase();
              if (val.length === 10 && panRegex.test(val)) {
                return (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-100 rounded-md text-[10px] text-emerald-800 font-bold space-y-0.5 animate-fadeIn">
                    <div><span className="text-emerald-600">PAN FORMAT:</span> VALID PAN NUMBER</div>
                  </div>
                );
              } else if (val.length > 0) {
                return (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-100 rounded-md text-[10px] text-rose-800 font-bold">
                    Invalid PAN format (Example: ABCDE1234F)
                  </div>
                );
              }
              return null;
            })()}

            {editAccount.extraFieldType === 'pan' && isSearchingPAN && (
              <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 shrink-0" />
                <span className="text-[10px] font-black text-purple-700 uppercase tracking-wide">Searching LegalDev in background...</span>
              </div>
            )}

            {editAccount.extraFieldType === 'pan' && searchedFirms.length > 1 && (
              <div className="mt-2.5 space-y-1.5 animate-fadeIn">
                <Label className="text-[10px] font-black text-purple-700 uppercase tracking-widest block">
                  Select Firm / Branch ({searchedFirms.length} found):
                </Label>
                <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-purple-50/50 border border-purple-200/50 rounded-xl">
                  {searchedFirms.map((firm) => {
                    const isSelected = searchedGSTDetails?.gstin === firm.gstin;
                    return (
                      <button
                        key={firm.gstin}
                        type="button"
                        onClick={() => handleSelectFirm && handleSelectFirm(firm, true)}
                        className={`text-left p-2 rounded-lg border-2 text-xs font-bold transition-all flex flex-col space-y-0.5 ${
                          isSelected
                            ? 'bg-[#3b0764] border-[#3b0764] text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-between w-full items-center">
                          <span className={isSelected ? 'text-white font-black' : 'text-slate-900 font-extrabold'}>
                            {firm.businessName}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {firm.gstin}
                          </span>
                        </div>
                        <div className={`text-[9px] truncate ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                          {firm.address}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(editAccount.extraFieldType === 'gst' || editAccount.extraFieldType === 'pan') && searchedGSTDetails && (
              <div className="mt-2.5 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl space-y-2 text-xs font-bold text-slate-800 shadow-inner animate-fadeIn">
                <div className="text-[10px] font-black uppercase text-purple-700 tracking-wider pb-1 border-b border-purple-200/60 flex items-center justify-between">
                  <span>Import Success</span>
                  <Badge variant="outline" className="bg-emerald-600 hover:bg-emerald-600 text-white border-0 font-black text-[9px] px-2 py-0.5 rounded">DETAILS APPLIED</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div><span className="text-slate-400 font-medium text-[9px]">BUSINESS NAME:</span> <div className="text-purple-950 font-black uppercase">{searchedGSTDetails.businessName}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">GSTIN NUMBER:</span> <div className="text-purple-950 font-black uppercase">{searchedGSTDetails.gstin}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">PAN NUMBER:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.pan}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">STATE CODE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.stateCode || (searchedGSTDetails.gstin || "").slice(0, 2)}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">STATE NAME:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.stateName || "UTTAR PRADESH"}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">ADDRESS:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.address}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">ENTITY TYPE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.entityType}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">NATURE OF BUSINESS:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.natureOfBusiness}</div></div>
                  <div><span className="text-slate-400 font-medium text-[9px]">REGISTRATION DATE:</span> <div className="text-slate-950 font-black uppercase">{searchedGSTDetails.registrationDate || "N/A"}</div></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <DialogFooter className="px-6 py-3 border-t border-border bg-card/50">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-10 border-border text-foreground hover:bg-muted">
          Cancel
        </Button>
        <Button
          onClick={() => onSave(editAccount)}
          disabled={!editAccount.name.trim() || isSubmitting}
          className="h-12 px-8 bg-[#3b0764] hover:bg-[#2e054f] !text-white font-black text-lg shadow-xl disabled:bg-slate-300 disabled:!text-slate-500 transition-all"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          SAVE CHANGES
        </Button>
      </DialogFooter>
    </>
  );
}

export default function IncomeExpenseClient() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const router = useRouter();

  // ✅ Use global data context - NO duplicate listeners
  const globalData = useGlobalData();
  const allDbSuppliers = useLiveQuery(() => db?.suppliers.toArray() || Promise.resolve([]), []) || [];

  // Track the last auto-generated ID and type switches to prevent overwrites
  const lastAutoGenIdRef = useRef<string>('');
  const lastEntryTypeRef = useRef<string>('');
  const lastPaymentMethodRef = useRef<string>('');

  // ✅ FIX: Initialize state from globalData immediately to prevent data loss on remount
  const [income, setIncome] = useState<Income[]>(globalData.incomes);
  const [expenses, setExpenses] = useState<Expense[]>(globalData.expenses);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>(globalData.fundTransactions);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(globalData.bankAccounts);
  const [totalExpenseCount, setTotalExpenseCount] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchDescription, setSearchDescription] = useState("");
  const [isBulkDescDialogOpen, setIsBulkDescDialogOpen] = useState(false);
  const [bulkDescription, setBulkDescription] = useState("");
  const [infoPayment, setInfoPayment] = useState<any>(null);
  const [infoCustomer, setInfoCustomer] = useState<any>(null);

  // NO PAGE LOADING - Data loads initially, then only CRUD updates
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<DisplayTransaction | null>(null);
  const [dbVarieties, setDbVarieties] = useState<{ id: string, name: string }[]>([]);

  useEffect(() => {
    const unsub = getOptionsRealtime("varieties", (data) => {
      setDbVarieties(data);
      setVarietyOptions(data);
    }, (err) => {
      console.error("Error fetching varieties:", err);
    });
    return () => unsub();
  }, []);



  const [lastAmountSource, setLastAmountSource] = useState<'income' | 'expense' | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<string>("entry");
  const [isVarietyManagerOpen, setIsVarietyManagerOpen] = useState(false);
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);

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

    const unsubLoans = getLoansRealtime(setLoans, () => { });

    return () => {
      unsubLoans();
    }
  }, []); // Only run once on mount

  // NO PAGE LOADING - Components render immediately

  const allTransactions: DisplayTransaction[] = useMemo(() => {
    const incomeArray = income || [];
    const expensesArray = expenses || [];
    const suppliersArray = globalData.suppliers || [];
    const customersArray = globalData.customers || [];
    const customerPaymentsArray = globalData.customerPayments || [];

    // Build a lookup map: customerId -> customer name for customer payments
    const customerNameMap = new Map<string, string>();
    customersArray.forEach(c => {
      if (c.id) customerNameMap.set(c.id, c.name || '');
    });

    // Standardize transactions from incomes/expenses
    const standardTransactions = [...incomeArray, ...expensesArray]
      .filter(t => !t.isDeleted);


    // Standardize transactions from Main Supplier Parchi module (Purchases)
    // Only show receipts that are party receipts
    const supplierTransactions: DisplayTransaction[] = suppliersArray
      .filter(s => !!s.isPartyReceipt)
      .map(s => ({
        id: `SUP-${s.id}`,
        transactionId: `P-${s.srNo}`,
        date: s.date,
        transactionType: 'Expense',
        entryType: 'Buy',
        category: 'Procurement',
        payee: s.name,
        variety: s.variety,
        quantity: Number(s.netWeight || s.weight || 0),
        amount: Number(s.amount || 0) - Number(s.kartaAmount || 0),
        rate: Number(s.rate || 0),
        status: 'Paid',
        paymentMethod: 'Other',
        description: `Parchi Purchase: ${s.variety}`,
        isInternal: false,
        isPartyReceipt: true
      } as any));

    // Standardize transactions from Main Customer Invoice module (Sales)
    const customerTransactions: DisplayTransaction[] = customersArray.map(c => {
      const finalWt = Number(c.weight || c.grossWeight || 0);
      const rate = Number(c.rate || 0);
      const baseAmount = Math.round(finalWt * rate);
      const kAmt = Number(c.kartaAmount) || 0;
      const bDeduction = Number(c.bagWeightDeductionAmount) || 0;
      const finalAmt = Math.round(baseAmount - kAmt - bDeduction);

      const baseAmt = Number(c.amount) || baseAmount;
      const cdRate = Number(c.cdRate || 0);
      const cdAmt = cdRate > 0 
        ? Math.round(baseAmt * cdRate / 100)
        : Number(c.cdAmount || c.cd || 0);
      const brkAmt = Number(c.weight || 0) * Number(c.brokerageRate || c.brokerage || 0);
      const transAmt = Number(c.transportAmount || 0);
      const kantaAmt = Number(c.kanta || 0);
      const bagAmt = Number(c.bagAmount || 0);
      const advFreight = Number(c.advanceFreight || 0);

      const totalRec = Math.round(finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + advFreight);

      return {
        id: `CUS-${c.id}`,
        transactionId: `S-${c.srNo}`,
        date: c.date,
        transactionType: 'Income',
        entryType: 'Sale',
        category: 'Sales Revenue',
        payee: c.name,
        variety: c.variety,
        quantity: Number(c.netWeight || c.weight || 0),
        amount: totalRec,
        rate: rate,
        status: 'Paid',
        paymentMethod: 'Other',
        description: `Invoice Sale: ${c.variety} (Total Rec)`,
        isInternal: false,
        customerRef: c
      } as DisplayTransaction;
    });

    // Standardize Customer Payment transactions (receipts received from customers)
    const customerPaymentTransactions: DisplayTransaction[] = customerPaymentsArray
      .filter(cp => !cp.isDeleted)
      .flatMap(cp => {
        const srNo = cp.paidFor?.[0]?.srNo;
        let customerName = 'Unknown Customer';
        if (srNo) {
          const matchCustomer = customersArray.find(c => String(c.srNo) === String(srNo));
          if (matchCustomer && matchCustomer.name) {
            customerName = matchCustomer.name;
          }
        }
        if (customerName === 'Unknown Customer') {
          customerName = customerNameMap.get(cp.customerId) || cp.customerId || 'Unknown Customer';
        }

        const entries: DisplayTransaction[] = [];

        const isDebit = cp.drCr === 'Debit';
        const txType = isDebit ? ('Expense' as const) : ('Income' as const);
        const entryType = isDebit ? ('Expense' as const) : ('Income' as const);
        const category = isDebit ? 'Customer Refund' : 'Customer Payment';

        // 1. Main payment transaction
        entries.push({
          id: `CUSPAY-${cp.id}`,
          transactionId: cp.paymentId || `CP-${cp.id}`,
          date: cp.date,
          transactionType: txType,
          entryType: entryType,
          category: category,
          payee: customerName,
          amount: Math.abs(Number(cp.amount || 0)),
          status: 'Paid' as const,
          paymentMethod: (cp.paymentMethod === 'Online' ? 'Online' : 'Cash') as any,
          description: `${isDebit ? 'Customer Refund' : 'Customer Payment'}: ${cp.paymentId || cp.id}${cp.notes ? ` - ${cp.notes}` : ''}`,
          isInternal: false,
          customerPaymentRef: cp
        } as unknown as DisplayTransaction);

        // 2. CD amount transaction
        if (cp.cdAmount && Number(cp.cdAmount) > 0) {
          entries.push({
            id: `CUSPAY-CD-${cp.id}`,
            transactionId: cp.paymentId || `CP-${cp.id}`,
            date: cp.date,
            transactionType: txType,
            entryType: entryType,
            category: isDebit ? 'Customer Refund CD' : 'Customer CD',
            payee: customerName,
            amount: Number(cp.cdAmount),
            status: 'Paid' as const,
            paymentMethod: 'Other' as any,
            description: `Cash Discount (CD) for ${isDebit ? 'Customer Refund' : 'Customer Payment'}: ${cp.paymentId || cp.id}`,
            isInternal: false,
            customerPaymentRef: cp
          } as unknown as DisplayTransaction);
        }

        return entries;
      });

    // Helper: safely parse paidFor (handles both Array and JSON string)
    const getSafePaidFor = (sp: any): any[] => {
      if (!sp || !sp.paidFor) return [];
      if (Array.isArray(sp.paidFor)) return sp.paidFor;
      if (typeof sp.paidFor === 'string') {
        try {
          const parsed = JSON.parse(sp.paidFor);
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      }
      return [];
    };

    // Standardize Supplier Payment transactions (payments made to suppliers).
    // Like customer payments: ALL non-deleted payments are included.
    const supplierPaymentTransactions: DisplayTransaction[] = (payments || [])
      .filter(sp => !sp.isDeleted)
      .flatMap(sp => {
        const entries: DisplayTransaction[] = [];
        const paidForArr = getSafePaidFor(sp);
        
        let payeeName = 'Unknown Supplier';
        let isLinkedToPartyReceipt = false;
        
        // 1. Try to find the supplier name by looking up the linked receipt from paidFor or parchiNo (linked by receipt srNo)
        let linkedSrNo = '';
        if (paidForArr.length > 0) {
          linkedSrNo = String(paidForArr[0]?.srNo || '').trim();
        } else if ((sp as any).parchiNo) {
          linkedSrNo = String((sp as any).parchiNo).trim();
        }

        if (linkedSrNo) {
          const linkedSrNoNum = Number(linkedSrNo);
          
          const matchSup = allDbSuppliers.find((s: any) => {
            const sSrNo = String(s.srNo || '').trim();
            if (sSrNo === linkedSrNo) return true;
            const sSrNoNum = Number(sSrNo);
            if (!isNaN(linkedSrNoNum) && !isNaN(sSrNoNum) && sSrNoNum === linkedSrNoNum) return true;
            return false;
          });
          
          if (matchSup) {
            if (matchSup.isPartyReceipt) {
              isLinkedToPartyReceipt = true;
              payeeName = matchSup.name || payeeName;
            }
          } else {
            // fallback to globalData.suppliers (sliced)
            const matchSup2 = suppliersArray.find((s: any) => {
              const sSrNo = String(s.srNo || '').trim();
              if (sSrNo === linkedSrNo) return true;
              const sSrNoNum = Number(sSrNo);
              if (!isNaN(linkedSrNoNum) && !isNaN(sSrNoNum) && sSrNoNum === linkedSrNoNum) return true;
              return false;
            });
            if (matchSup2 && matchSup2.isPartyReceipt) {
              isLinkedToPartyReceipt = true;
              payeeName = matchSup2.name || payeeName;
            }
          }
        }
        
        // Only include this payment transaction if it is linked to a party receipt
        if (!isLinkedToPartyReceipt) {
          return [];
        }

        const isCredit = sp.drCr === 'Credit';
        const txType = isCredit ? ('Income' as const) : ('Expense' as const);
        const entryType = isCredit ? ('Income' as const) : ('Expense' as const);
        const category = isCredit ? 'Supplier Refund' : 'Supplier Payment';

        entries.push({
          id: `SUPPAY-${sp.id}`,
          transactionId: sp.paymentId || `SP-${sp.id}`,
          date: sp.date,
          transactionType: txType,
          entryType: entryType,
          category: category,
          payee: payeeName,
          amount: Math.abs(Number(sp.amount || 0)),
          status: 'Paid' as const,
          paymentMethod: (sp.paymentMethod === 'Online' ? 'Online' : 'Cash') as any,
          description: `${isCredit ? 'Supplier Refund' : 'Supplier Payment'}: ${sp.paymentId || sp.id}${sp.notes ? ` - ${sp.notes}` : ''}`,
          isInternal: false,
          customerPaymentRef: sp
        } as unknown as DisplayTransaction);

        if (sp.cdAmount && Number(sp.cdAmount) > 0) {
          entries.push({
            id: `SUPPAY-CD-${sp.id}`,
            transactionId: sp.paymentId || `SP-${sp.id}`,
            date: sp.date,
            transactionType: txType,
            entryType: entryType,
            category: isCredit ? 'Supplier Refund CD' : 'Supplier CD',
            payee: payeeName,
            amount: Number(sp.cdAmount),
            status: 'Paid' as const,
            paymentMethod: 'Other' as any,
            description: `Cash Discount (CD) for ${isCredit ? 'Supplier Refund' : 'Supplier Payment'}: ${sp.paymentId || sp.id}`,
            isInternal: false,
            customerPaymentRef: sp
          } as unknown as DisplayTransaction);
        }

        return entries;
      });

    const combined = [...standardTransactions, ...supplierTransactions, ...customerTransactions, ...customerPaymentTransactions, ...supplierPaymentTransactions];

    const sorted = combined.sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      return (b.transactionId || '').localeCompare(a.transactionId || '');
    });

    return sorted;
  }, [income, expenses, globalData.suppliers, globalData.customers, globalData.customerPayments, payments, allDbSuppliers]);

  const allStockTransactions: DisplayTransaction[] = useMemo(() => {
    const incomeArray = income || [];
    const expensesArray = expenses || [];
    const suppliersArray = globalData.suppliers || [];
    const customersArray = globalData.customers || [];
    const customerPaymentsArray = globalData.customerPayments || [];

    const customerNameMap = new Map<string, string>();
    customersArray.forEach(c => {
      if (c.id) customerNameMap.set(c.id, c.name || '');
    });

    const standardTransactions = [...incomeArray, ...expensesArray]
      .filter(t => !t.isDeleted);

    const supplierTransactions: DisplayTransaction[] = suppliersArray
      .map(s => ({
        id: `SUP-${s.id}`,
        transactionId: `P-${s.srNo}`,
        date: s.date,
        transactionType: 'Expense',
        entryType: 'Buy',
        category: 'Procurement',
        payee: s.name,
        variety: s.variety,
        quantity: Number(s.netWeight || s.weight || 0),
        amount: Number(s.amount || 0) - Number(s.kartaAmount || 0),
        rate: Number(s.rate || 0),
        status: 'Paid',
        paymentMethod: 'Other',
        description: `Parchi Purchase: ${s.variety}`,
        isInternal: false,
        isPartyReceipt: !!s.isPartyReceipt
      } as any));

    const customerTransactions: DisplayTransaction[] = customersArray.map(c => {
      const finalWt = Number(c.weight || c.grossWeight || 0);
      const rate = Number(c.rate || 0);
      const baseAmount = Math.round(finalWt * rate);
      const kAmt = Number(c.kartaAmount) || 0;
      const bDeduction = Number(c.bagWeightDeductionAmount) || 0;
      const finalAmt = Math.round(baseAmount - kAmt - bDeduction);

      const baseAmt = Number(c.amount) || baseAmount;
      const cdRate = Number(c.cdRate || 0);
      const cdAmt = cdRate > 0 
        ? Math.round(baseAmt * cdRate / 100)
        : Number(c.cdAmount || c.cd || 0);
      const brkAmt = Number(c.weight || 0) * Number(c.brokerageRate || c.brokerage || 0);
      const transAmt = Number(c.transportAmount || 0);
      const kantaAmt = Number(c.kanta || 0);
      const bagAmt = Number(c.bagAmount || 0);
      const advFreight = Number(c.advanceFreight || 0);

      const totalRec = Math.round(finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + advFreight);

      return {
        id: `CUS-${c.id}`,
        transactionId: `S-${c.srNo}`,
        date: c.date,
        transactionType: 'Income',
        entryType: 'Sale',
        category: 'Sales Revenue',
        payee: c.name,
        variety: c.variety,
        quantity: Number(c.netWeight || c.weight || 0),
        amount: totalRec,
        rate: rate,
        status: 'Paid',
        paymentMethod: 'Other',
        description: `Invoice Sale: ${c.variety} (Total Rec)`,
        isInternal: false,
        customerRef: c
      } as DisplayTransaction;
    });

    const customerPaymentTransactions: DisplayTransaction[] = customerPaymentsArray
      .filter(cp => !cp.isDeleted)
      .flatMap(cp => {
        const srNo = cp.paidFor?.[0]?.srNo;
        let customerName = 'Unknown Customer';
        if (srNo) {
          const matchCustomer = customersArray.find(c => String(c.srNo) === String(srNo));
          if (matchCustomer && matchCustomer.name) {
            customerName = matchCustomer.name;
          }
        }
        if (customerName === 'Unknown Customer') {
          customerName = customerNameMap.get(cp.customerId) || cp.customerId || 'Unknown Customer';
        }

        const entries: DisplayTransaction[] = [];
        const isDebit = cp.drCr === 'Debit';
        const txType = isDebit ? ('Expense' as const) : ('Income' as const);
        const entryType = isDebit ? ('Expense' as const) : ('Income' as const);
        const category = isDebit ? 'Customer Refund' : 'Customer Payment';

        entries.push({
          id: `CUSPAY-${cp.id}`,
          transactionId: cp.paymentId || `CP-${cp.id}`,
          date: cp.date,
          transactionType: txType,
          entryType: entryType,
          category: category,
          payee: customerName,
          amount: Math.abs(Number(cp.amount || 0)),
          status: 'Paid' as const,
          paymentMethod: (cp.paymentMethod === 'Online' ? 'Online' : 'Cash') as any,
          description: `${isDebit ? 'Customer Refund' : 'Customer Payment'}: ${cp.paymentId || cp.id}${cp.notes ? ` - ${cp.notes}` : ''}`,
          isInternal: false,
          customerPaymentRef: cp
        } as unknown as DisplayTransaction);

        if (cp.cdAmount && Number(cp.cdAmount) > 0) {
          entries.push({
            id: `CUSPAY-CD-${cp.id}`,
            transactionId: cp.paymentId || `CP-${cp.id}`,
            date: cp.date,
            transactionType: txType,
            entryType: entryType,
            category: isDebit ? 'Customer Refund CD' : 'Customer CD',
            payee: customerName,
            amount: Number(cp.cdAmount),
            status: 'Paid' as const,
            paymentMethod: 'Other' as any,
            description: `Cash Discount (CD) for ${isDebit ? 'Customer Refund' : 'Customer Payment'}: ${cp.paymentId || cp.id}`,
            isInternal: false,
            customerPaymentRef: cp
          } as unknown as DisplayTransaction);
        }

        return entries;
      });

    const getSafePaidFor = (sp: any): any[] => {
      if (!sp || !sp.paidFor) return [];
      if (Array.isArray(sp.paidFor)) return sp.paidFor;
      if (typeof sp.paidFor === 'string') {
        try {
          const parsed = JSON.parse(sp.paidFor);
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      }
      return [];
    };

    const supplierPaymentTransactions: DisplayTransaction[] = (payments || [])
      .filter(sp => !sp.isDeleted)
      .flatMap(sp => {
        const entries: DisplayTransaction[] = [];
        const paidForArr = getSafePaidFor(sp);
        
        let payeeName = 'Unknown Supplier';
        let isLinkedToPartyReceipt = false;
        
        let linkedSrNo = '';
        if (paidForArr.length > 0) {
          linkedSrNo = String(paidForArr[0]?.srNo || '').trim();
        } else if ((sp as any).parchiNo) {
          linkedSrNo = String((sp as any).parchiNo).trim();
        }

        if (linkedSrNo) {
          const linkedSrNoNum = Number(linkedSrNo);
          
          const matchSup = allDbSuppliers.find((s: any) => {
            const sSrNo = String(s.srNo || '').trim();
            if (sSrNo === linkedSrNo) return true;
            const sSrNoNum = Number(sSrNo);
            if (!isNaN(linkedSrNoNum) && !isNaN(sSrNoNum) && sSrNoNum === linkedSrNoNum) return true;
            return false;
          });
          
          if (matchSup) {
            if (matchSup.isPartyReceipt) {
              isLinkedToPartyReceipt = true;
              payeeName = matchSup.name || payeeName;
            }
          } else {
            const matchSup2 = suppliersArray.find((s: any) => {
              const sSrNo = String(s.srNo || '').trim();
              if (sSrNo === linkedSrNo) return true;
              const sSrNoNum = Number(sSrNo);
              if (!isNaN(linkedSrNoNum) && !isNaN(sSrNoNum) && sSrNoNum === linkedSrNoNum) return true;
              return false;
            });
            if (matchSup2 && matchSup2.isPartyReceipt) {
              isLinkedToPartyReceipt = true;
              payeeName = matchSup2.name || payeeName;
            }
          }
        }
        
        if (!isLinkedToPartyReceipt) {
          return [];
        }

        const isCredit = sp.drCr === 'Credit';
        const txType = isCredit ? ('Income' as const) : ('Expense' as const);
        const entryType = isCredit ? ('Income' as const) : ('Expense' as const);
        const category = isCredit ? 'Supplier Refund' : 'Supplier Payment';

        entries.push({
          id: `SUPPAY-${sp.id}`,
          transactionId: sp.paymentId || `SP-${sp.id}`,
          date: sp.date,
          transactionType: txType,
          entryType: entryType,
          category: category,
          payee: payeeName,
          amount: Math.abs(Number(sp.amount || 0)),
          status: 'Paid' as const,
          paymentMethod: (sp.paymentMethod === 'Online' ? 'Online' : 'Cash') as any,
          description: `${isCredit ? 'Supplier Refund' : 'Supplier Payment'}: ${sp.paymentId || sp.id}${sp.notes ? ` - ${sp.notes}` : ''}`,
          isInternal: false,
          customerPaymentRef: sp
        } as unknown as DisplayTransaction);

        if (sp.cdAmount && Number(sp.cdAmount) > 0) {
          entries.push({
            id: `SUPPAY-CD-${sp.id}`,
            transactionId: sp.paymentId || `SP-${sp.id}`,
            date: sp.date,
            transactionType: txType,
            entryType: entryType,
            category: isCredit ? 'Supplier Refund CD' : 'Supplier CD',
            payee: payeeName,
            amount: Number(sp.cdAmount),
            status: 'Paid' as const,
            paymentMethod: 'Other' as any,
            description: `Cash Discount (CD) for ${isCredit ? 'Supplier Refund' : 'Supplier Payment'}: ${sp.paymentId || sp.id}`,
            isInternal: false,
            customerPaymentRef: sp
          } as unknown as DisplayTransaction);
        }

        return entries;
      });

    const combined = [...standardTransactions, ...supplierTransactions, ...customerTransactions, ...customerPaymentTransactions, ...supplierPaymentTransactions];

    const sorted = combined.sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      return (b.transactionId || '').localeCompare(a.transactionId || '');
    });

    return sorted;
  }, [income, expenses, globalData.suppliers, globalData.customers, globalData.customerPayments, payments, allDbSuppliers]);

  // Build a map: supplier receipt srNo -> list of linked payment transactions.
  // ALL payments linked to ANY supplier receipt are shown as sub-rows (no party filter).
  const supplierPaymentMap = useMemo(() => {
    const map = new Map<string, DisplayTransaction[]>();

    // Helper: parse paidFor safely (handles Array or JSON string)
    const parsePaidFor = (sp: any): any[] => {
      if (!sp.paidFor) return [];
      if (Array.isArray(sp.paidFor)) return sp.paidFor;
      if (typeof sp.paidFor === 'string') {
        try { const p = JSON.parse(sp.paidFor); return Array.isArray(p) ? p : []; } catch { return []; }
      }
      return [];
    };

    (payments || []).forEach((sp: any) => {
      if (sp.isDeleted) return;
      const paidForArr = parsePaidFor(sp);
      if (paidForArr.length === 0) return;

      const isCredit = sp.drCr === 'Credit';
      const txType = isCredit ? 'Income' : 'Expense';
      const category = isCredit ? 'Supplier Refund' : 'Supplier Payment';

      // Resolve supplier name from allDbSuppliers (full list)
      const firstSrNo = String(paidForArr[0]?.srNo || '').trim();
      let payeeName = sp.supplierName || 'Unknown Supplier';
      const matchedSupplier = (allDbSuppliers as any[]).find(s =>
        String(s.srNo).trim() === firstSrNo || String(s.srNo).trim().toUpperCase() === firstSrNo.toUpperCase()
      );
      if (matchedSupplier?.name) payeeName = matchedSupplier.name;

      // Build the main payment DisplayTransaction
      const mainPayTx: any = {
        id: `SUPPAY-${sp.id}`,
        transactionId: sp.paymentId || `SP-${sp.id}`,
        date: sp.date,
        transactionType: txType,
        entryType: txType,
        category,
        payee: payeeName,
        amount: Math.abs(Number(sp.amount || 0)),
        status: 'Paid',
        paymentMethod: sp.paymentMethod === 'Online' ? 'Online' : 'Cash',
        description: `${category}: ${sp.paymentId || sp.id}${sp.notes ? ` - ${sp.notes}` : ''}`,
        isInternal: false,
        customerPaymentRef: sp,
      };

      // CD transaction if applicable
      const cdPayTx: any = (sp.cdAmount && Number(sp.cdAmount) > 0) ? {
        ...mainPayTx,
        id: `SUPPAY-CD-${sp.id}`,
        amount: Number(sp.cdAmount),
        category: isCredit ? 'Supplier Refund CD' : 'Supplier CD',
        paymentMethod: 'Other',
        description: `Cash Discount (CD): ${sp.paymentId || sp.id}`,
      } : null;

      // Add payment under each receipt's srNo in the map (no party filter)
      paidForArr.forEach((pf: any) => {
        const srNo = String(pf.srNo || '').trim().toUpperCase();
        if (!srNo) return;
        const existing = map.get(srNo) || [];
        if (!existing.find(e => e.id === mainPayTx.id)) existing.push(mainPayTx);
        if (cdPayTx && !existing.find(e => e.id === cdPayTx.id)) existing.push(cdPayTx);
        map.set(srNo, existing);
      });
    });

    return map;
  }, [payments, allDbSuppliers]);

  // Show ALL transactions. Supplier entries and payments show like customer entries/payments.
  const visibleTransactions = useMemo(() => {
    return allTransactions;
  }, [allTransactions]);

  const { uniquePayees, uniqueVarieties, maxIds } = useMemo(() => {
    const payees = new Set<string>();
    const varieties = new Set<string>();
    const maxIds: Record<string, number> = {
      Income: 0,
      Expense: 0,
      ExpenseOnline: 0,
      Buy: 0,
      Sale: 0,
      Loss: 0,
      Use: 0,
      Adjustment: 0,
      Lend: 0,
      Borrow: 0,
      'Lend Return': 0,
      'Borrow Return': 0,
      Receivable: 0,
      Payable: 0,
      'Extra Receive': 0,
      Salary: 0,
      Laboury: 0,
      Transport: 0,
      Brokerage: 0,
      Capital: 0,
      Liabilities: 0,
      Building: 0,
      Machinery: 0,
      Miscellaneous: 0,
      'Opening Dr': 0,
      'Opening Cr': 0
    };

    const regexes = {
      Income: /^IN(\d+)$/,
      Expense: /^EX(\d+)$/,
      ExpenseOnline: /^OB(\d+)$/,
      Buy: /^B(\d+)$/,
      Sale: /^S(\d+)$/,
      Loss: /^L(\d+)$/,
      Use: /^IT(\d+)$/,
      Adjustment: /^A(\d+)$/,
      Lend: /^LD(\d+)$/,
      Borrow: /^BW(\d+)$/,
      'Lend Return': /^LR(\d+)$/,
      'Borrow Return': /^BR(\d+)$/,
      Receivable: /^RC(\d+)$/,
      Payable: /^PY(\d+)$/,
      'Extra Receive': /^ER(\d+)$/,
      Salary: /^SL(\d+)$/,
      Laboury: /^LY(\d+)$/,
      Transport: /^TS(\d+)$/,
      Brokerage: /^BJ(\d+)$/,
      Capital: /^CP(\d+)$/,
      Liabilities: /^LI(\d+)$/,
      Building: /^BD(\d+)$/,
      Machinery: /^MY(\d+)$/,
      Miscellaneous: /^MC(\d+)$/,
      'Opening Dr': /^OD(\d+)$/,
      'Opening Cr': /^OC(\d+)$/
    };

    // 1. Get unique payees ONLY from visible manual entries
    visibleTransactions.forEach(t => {
      if (t.payee && typeof t.payee === 'string') {
        const trimmed = t.payee.trim();
        if (trimmed) payees.add(toTitleCase(trimmed));
      }
    });

    // 2. Get unique varieties and max IDs from ALL transactions (including external ones for stock intelligence)
    allTransactions.forEach(t => {
      if (t.variety && typeof t.variety === 'string') {
        const trimmed = t.variety.trim();
        if (trimmed) varieties.add(toTitleCase(trimmed));
      }

      const txId = t.transactionId || '';

      Object.entries(regexes).forEach(([type, regex]) => {
        const match = txId.match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIds[type as keyof typeof maxIds]) maxIds[type as keyof typeof maxIds] = num;
        }
      });
    });

    if (payments && payments.length > 0) {
      payments.forEach(p => {
        const pid = p.paymentId || '';
        const match = pid.match(regexes.Expense);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxIds.Expense) maxIds.Expense = num;
        }
        const matchOb = pid.match(regexes.ExpenseOnline);
        if (matchOb) {
          const num = parseInt(matchOb[1], 10);
          if (num > maxIds.ExpenseOnline) maxIds.ExpenseOnline = num;
        }
      });
    }

    dbVarieties.forEach(v => {
      if (v.name && typeof v.name === 'string') {
        const trimmed = v.name.trim();
        if (trimmed) varieties.add(toTitleCase(trimmed));
      }
    });

    return {
      uniquePayees: Array.from(payees).sort(),
      uniqueVarieties: Array.from(varieties).sort(),
      maxIds
    };
  }, [allTransactions, payments, dbVarieties]);

  const getNextTransactionId = useCallback((type: string, paymentMethod: string = 'Cash') => {
    let activeType = type;
    if (type === 'Expense' && paymentMethod !== 'Cash') {
      activeType = 'ExpenseOnline';
    }
    const prefixes: Record<string, string> = {
      Income: 'IN',
      Expense: 'EX',
      ExpenseOnline: 'OB',
      Buy: 'B',
      Sale: 'S',
      Loss: 'L',
      Use: 'IT',
      Adjustment: 'A',
      Lend: 'LD',
      Borrow: 'BW',
      'Lend Return': 'LR',
      'Borrow Return': 'BR',
      Receivable: 'RC',
      Payable: 'PY',
      'Extra Receive': 'ER',
      Salary: 'SL',
      Laboury: 'LY',
      Transport: 'TS',
      Brokerage: 'BJ',
      Capital: 'CP',
      Liabilities: 'LI',
      Building: 'BD',
      Machinery: 'MY',
      Miscellaneous: 'MC',
      'Opening Dr': 'OD',
      'Opening Cr': 'OC'
    };
    const prefix = prefixes[activeType] || 'TR';
    const lastNum = maxIds[activeType as keyof typeof maxIds] || 0;
    return generateReadableId(prefix, lastNum, 4);
  }, [maxIds]);

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
    isSearchingGST,
    isSearchingPAN,
    searchedGSTDetails,
    setSearchedGSTDetails,
    searchedFirms,
    setSearchedFirms,
    handleSearchGST,
    handleSearchPAN,
    handlePasteGSTText,
    handlePastePANText,
    handleSelectFirm,
    handleCancelGSTSearch,
  } = useAccountManager({
    setValue,
    setIsSubmitting,
    handleAutoFill: (payeeName: string) => {
      if (handleAutoFillRef.current) {
        handleAutoFillRef.current(payeeName);
      }
    },
  });



  // Sync selectedAccount to form's payee field whenever it changes from the top search
  // selectedAccount is synced to form 'payee' field inside useAccountManager

  const filteredTransactions = useMemo(() => {
    let txs = visibleTransactions;
    if (selectedAccount) {
      txs = txs.filter((transaction) => toTitleCase(transaction.payee) === selectedAccount);
    }
    if (searchDescription.trim()) {
      const query = searchDescription.toLowerCase();
      txs = txs.filter((transaction) => 
        (transaction.description || '').toLowerCase().includes(query) ||
        (transaction.transactionId || '').toLowerCase().includes(query) ||
        (transaction.variety || '').toLowerCase().includes(query)
      );
    }
    return txs;
  }, [visibleTransactions, selectedAccount, searchDescription]);

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

    // Add customer names from customer entries so they appear in Select Party
    (globalData.customers || []).forEach(c => {
      if (c.name && c.name.trim()) {
        const normalized = toTitleCase(c.name.trim());
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
  }, [uniquePayees, accounts, globalData.customers]);

  // Watch necessary form fields for logic dependencies (avoids full-form watch to optimize performance)
  const [selectedEntryType, selectedExpenseNature, selectedCategory, selectedSubCategory, selectedPaymentMethod] = form.watch(['entryType', 'expenseNature', 'category', 'subCategory', 'paymentMethod']);

  // Save date to localStorage when it changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'date' && value.date && typeof window !== 'undefined') {
        const dateObj = value.date instanceof Date ? value.date : new Date(value.date);
        if (!isNaN(dateObj.getTime())) {
          localStorage.setItem('incomeExpenseDate', dateObj.toISOString());
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Auto-calculate amount for stock transactions (Qty * Rate)
  const watchedQty = watch('quantity');
  const watchedRate = watch('rate');
  const watchedEntryType = watch('entryType');

  useEffect(() => {
    const isStockType = ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'].includes(watchedEntryType || '');
    if (isStockType && watchedQty && watchedRate) {
      const calculatedAmount = Number(watchedQty) * Number(watchedRate);
      if (!isNaN(calculatedAmount) && calculatedAmount > 0) {
        setValue('amount', calculatedAmount, { shouldValidate: true });
      }
    }
  }, [watchedQty, watchedRate, watchedEntryType, setValue]);

  // Initial date sync from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('incomeExpenseDate');
      if (savedDate) {
        const parsed = new Date(savedDate);
        if (!isNaN(parsed.getTime())) {
          setValue('date', parsed);
        }
      }
    }
  }, [setValue]);

  useEffect(() => {
    if (!editingTransaction) {
      const nextId = getNextTransactionId(selectedEntryType || 'Expense', selectedPaymentMethod || 'Cash');
      const currentId = form.getValues('transactionId');
      
      const entryTypeChanged = (selectedEntryType || 'Expense') !== lastEntryTypeRef.current;
      const paymentMethodChanged = (selectedPaymentMethod || 'Cash') !== lastPaymentMethodRef.current;
      
      // Update the ID field if either the entry type or payment method changed (explicit user switch),
      // or if the current ID matches the last auto-generated ID (meaning user hasn't edited it).
      if (entryTypeChanged || paymentMethodChanged || !currentId || currentId === lastAutoGenIdRef.current) {
        setValue('transactionId', nextId);
        lastAutoGenIdRef.current = nextId;
      }
      
      lastEntryTypeRef.current = selectedEntryType || 'Expense';
      lastPaymentMethodRef.current = selectedPaymentMethod || 'Cash';
    }
  }, [selectedEntryType, selectedPaymentMethod, editingTransaction, getNextTransactionId, setValue, payments, expenses]);


  const handleTransactionIdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let value = e.target.value.trim();
    if (!value) return;

    const prefixes: Record<string, string> = {
      Income: 'IN',
      Expense: 'EX',
      ExpenseOnline: 'OB',
      Buy: 'B',
      Sale: 'S',
      Loss: 'L',
      Use: 'IT',
      Lend: 'LD',
      Borrow: 'BW',
      'Lend Return': 'LR',
      'Borrow Return': 'BR',
      Receivable: 'RC',
      Payable: 'PY',
      'Extra Receive': 'ER',
      Salary: 'SL',
      Laboury: 'LY',
      Transport: 'TS',
      Brokerage: 'BJ',
      Capital: 'CP',
      Liabilities: 'LI',
      Building: 'BD',
      Machinery: 'MY',
      Miscellaneous: 'MC',
      'Opening Dr': 'OD',
      'Opening Cr': 'OC'
    };
    let activeType = selectedEntryType || 'Expense';
    if (activeType === 'Expense' && (selectedPaymentMethod || 'Cash') !== 'Cash') {
      activeType = 'ExpenseOnline';
    }
    const prefix = prefixes[activeType] || 'EX';

    if (value && !isNaN(parseInt(value)) && isFinite(Number(value)) && !value.match(/^[a-zA-Z]+\d+$/i)) {
      value = generateReadableId(prefix, parseInt(value) - 1, 4);
      setValue('transactionId', value);
    } else if (value) {
      setValue('transactionId', value);
    }

    const foundTransaction = allTransactions.find(t => t.transactionId === value);
    if (foundTransaction) {
      handleEdit(foundTransaction);
    } else if (prefix === 'EX' || prefix === 'OB') {
      const foundPayment = payments.find(p => p.paymentId === value);
      if (foundPayment) {
        toast({ title: 'ID Occupied', description: `This ID is used for a supplier payment to: ${foundPayment.supplierName}`, variant: 'destructive' });
      }
    }
  };


  const handleAutoFill = useCallback((payeeName: string) => {
    const trimmedPayeeName = toTitleCase(payeeName.trim());
    if (!trimmedPayeeName) return;

    // 1. PRIORITY 1: Check Account Master for Default Rules
    const account = accounts.get(trimmedPayeeName);
    if (account) {
      if (account.defaultEntryType) {
        setValue('entryType', account.defaultEntryType, { shouldValidate: true });
      }
      if (account.accountingTag || account.nature) {
        setValue('expenseNature', (account.accountingTag || account.nature) as any, { shouldValidate: false });
      }
      if (account.category) {
        setValue('category', account.category, { shouldValidate: false });
      }
      if (account.subCategory) {
        setValue('subCategory', account.subCategory, { shouldValidate: false });
      }

      // If we found master rules, we can stop here or optionally still check history for variety/rate
      if (account.defaultEntryType) return;
    }

    // 2. PRIORITY 2: Fallback to Latest Transaction History
    const latestTransaction = allTransactions
      .filter(t => toTitleCase(t.payee) === trimmedPayeeName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (latestTransaction) {
      setTimeout(() => {
        if (latestTransaction.entryType) {
          const isStockType = ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'].includes(latestTransaction.entryType);
          if (!isStockType) {
            setValue('entryType', latestTransaction.entryType, { shouldValidate: true });
          } else {
            setValue('entryType', latestTransaction.transactionType === 'Income' ? 'Income' : 'Expense', { shouldValidate: true });
          }
        }
        if (latestTransaction.expenseNature) setValue('expenseNature', latestTransaction.expenseNature, { shouldValidate: false });

        setTimeout(() => {
          if (latestTransaction.category) setValue('category', latestTransaction.category, { shouldValidate: false });
          if (latestTransaction.variety) setValue('variety', latestTransaction.variety, { shouldValidate: false });
          if (latestTransaction.rate) setValue('rate', latestTransaction.rate, { shouldValidate: false });

          setTimeout(() => {
            if (latestTransaction.subCategory) setValue('subCategory', latestTransaction.subCategory, { shouldValidate: false });
          }, 50);
        }, 50);
      }, 0);
    }
  }, [allTransactions, accounts, setValue, toast]);

  // Update the ref when handleAutoFill changes
  useEffect(() => {
    handleAutoFillRef.current = handleAutoFill;
  }, [handleAutoFill]);

  const handleNew = useCallback(() => {
    setEditingTransaction(null);
    const nextId = getNextTransactionId('Expense');
    lastAutoGenIdRef.current = nextId;
    lastEntryTypeRef.current = 'Expense';
    lastPaymentMethodRef.current = 'Cash';

    // Fetch latest persistent date
    let persistentDate = new Date();
    if (typeof window !== 'undefined') {
      const savedDate = localStorage.getItem('incomeExpenseDate');
      if (savedDate) {
        const parsed = new Date(savedDate);
        if (!isNaN(parsed.getTime())) persistentDate = parsed;
      }
    }

    reset(getInitialFormState(nextId));

    // Forcefully set the date and other key fields to ensure sync
    setValue('date', persistentDate);

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

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const isConfirmed = await confirm(`Are you sure you want to delete the ${selectedIds.size} selected transaction(s)?`, {
      title: "Confirm Bulk Deletion",
      variant: "destructive",
      confirmText: "Delete All",
      cancelText: "Cancel"
    });
    
    if (!isConfirmed) return;
    
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of selectedIds) {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) continue;
        
        try {
          if (tx.transactionType === 'Income') {
            await deleteIncome(tx.id);
          } else {
            await deleteExpense(tx.id);
          }
          successCount++;
        } catch (err) {
          console.error(`Error deleting transaction ${id}:`, err);
          failCount++;
        }
      }
      
      toast({
        title: "Bulk Deletion Completed",
        description: `Successfully deleted ${successCount} transactions.${failCount > 0 ? ` Failed to delete ${failCount} transactions.` : ""}`,
        variant: failCount > 0 ? "destructive" : "success"
      });
      setSelectedIds(new Set());
      handleNew();
    } catch (error) {
      logError(error, "expense-tracker-client: handleBulkDelete", "medium");
      toast({
        title: "Error running bulk deletion",
        description: getUserFriendlyErrorMessage(error, "transaction"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, allTransactions, handleNew, toast]);

  const handleBulkShift = useCallback(async (targetPayee: string) => {
    if (selectedIds.size === 0) return;
    const isConfirmed = await confirm(`Are you sure you want to shift ${selectedIds.size} selected transaction(s) to account "${targetPayee}"?`, {
      title: "Confirm Bulk Shift",
      variant: "default",
      confirmText: "Shift",
      cancelText: "Cancel"
    });
    
    if (!isConfirmed) return;
    
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of selectedIds) {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) continue;
        
        try {
          if (tx.transactionType === 'Income') {
            await updateIncome(tx.id, { payee: toTitleCase(targetPayee) });
          } else {
            await updateExpense(tx.id, { payee: toTitleCase(targetPayee) });
          }
          successCount++;
        } catch (err) {
          console.error(`Error shifting transaction ${id}:`, err);
          failCount++;
        }
      }
      
      toast({
        title: "Bulk Shift Completed",
        description: `Successfully shifted ${successCount} transactions to "${targetPayee}".${failCount > 0 ? ` Failed to shift ${failCount} transactions.` : ""}`,
        variant: failCount > 0 ? "destructive" : "success"
      });
      setSelectedIds(new Set());
      handleNew();
    } catch (error) {
      logError(error, "expense-tracker-client: handleBulkShift", "medium");
      toast({
        title: "Error running bulk shift",
        description: getUserFriendlyErrorMessage(error, "transaction"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, allTransactions, handleNew, toast]);

  const handleBulkSaveDescription = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const id of selectedIds) {
        const tx = allTransactions.find(t => t.id === id);
        if (!tx) continue;
        
        try {
          if (tx.transactionType === 'Income') {
            await updateIncome(tx.id, { description: bulkDescription });
          } else {
            await updateExpense(tx.id, { description: bulkDescription });
          }
          successCount++;
        } catch (err) {
          console.error(`Error updating description for transaction ${id}:`, err);
          failCount++;
        }
      }
      
      toast({
        title: "Bulk Description Update Completed",
        description: `Successfully updated ${successCount} transactions.${failCount > 0 ? ` Failed to update ${failCount} transactions.` : ""}`,
        variant: failCount > 0 ? "destructive" : "success"
      });
      setSelectedIds(new Set());
      setBulkDescription("");
      setIsBulkDescDialogOpen(false);
      handleNew();
    } catch (error) {
      logError(error, "expense-tracker-client: handleBulkSaveDescription", "medium");
      toast({
        title: "Error updating descriptions",
        description: getUserFriendlyErrorMessage(error, "transaction"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, allTransactions, bulkDescription, handleNew, toast]);


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
      rate: transaction.rate || 0,
      quantity: transaction.quantity || 0,
      variety: transaction.variety || '',
      description: transaction.description || '',
      category: transaction.category || '',
      subCategory: transaction.subCategory || '',
      paymentMethod: transaction.paymentMethod || 'Cash',
      status: transaction.status || 'Paid',
      entryType: transaction.entryType || (transaction.transactionType as any) || 'Expense',
      isInternal: transaction.isInternal || false,
      bankAccountId: transaction.bankAccountId || '',
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
        setValue('entryType', 'Expense');
        setValue('amount', Number(searchParams.get('amount') || 0));
        setValue('payee', toTitleCase(searchParams.get('payee') || ''));
        setValue('description', searchParams.get('description') || '');
        setValue('expenseNature', 'Permanent');
      }
    }
  }, [searchParams, loans, setValue, handleNew]);




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
    const activeAmount = Number(values.amount || 0);
    const activeEntryType = values.entryType;
    const stockOnlyTypes = ['Loss', 'Use', 'Extra Receive'];
    const isStockOnly = stockOnlyTypes.includes(activeEntryType);

    if (activeAmount <= 0 && !isStockOnly) {
      toast({ title: "Amount Required", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }

    const activeType = ['Income', 'Sale', 'Borrow', 'Lend Return', 'Interest Received', 'Extra Receive', 'Credit Adjust', 'Opening Cr'].includes(activeEntryType) ? 'Income' : 'Expense';
    const isInternal = (['Buy', 'Sale'].includes(activeEntryType) ? values.paymentMethod === 'Other' : ['Loss', 'Use', 'Debit Adjust', 'Credit Adjust', 'Opening Dr', 'Opening Cr'].includes(activeEntryType)) || values.isInternal;

    // Skip balance check for internal entries
    if (activeType === 'Expense' && !isInternal) {
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
      // Logic to clear fields based on active tab to avoid saving irrelevant data
      const isStockType = ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'].includes(activeEntryType);

      const transactionData: Partial<Omit<Transaction, 'id'>> = {
        ...values,
        transactionType: activeType,
        entryType: activeEntryType,
        amount: activeAmount,
        // Only save stock fields if the entry type belongs to the stock group
        rate: isStockType ? Number(values.rate || 0) : 0,
        quantity: isStockType ? Number(values.quantity || 0) : 0,
        variety: isStockType ? (values.variety || '') : '',
        date: format(values.date, "yyyy-MM-dd"),
        payee: toTitleCase(values.payee),
        mill: toTitleCase(values.mill || ''),
        status: values.status as Transaction['status'],
        expenseType: values.expenseType as Transaction['expenseType'],
        expenseNature: values.expenseNature as Transaction['expenseNature'],
        isInternal: isInternal,
        bankAccountId: (isInternal || values.paymentMethod === 'Cash') ? undefined : values.bankAccountId,
        paymentMethod: isInternal ? 'Other' : (values.paymentMethod as Transaction['paymentMethod']),
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
            await updateLoan(loanToUpdate.id, { nextEmiDueDate: format(newDueDate, 'yyyy-MM-dd') });
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
      const rawType = ((transaction as any).entryType || transaction.transactionType || "").toUpperCase();
      const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'PAYABLE', 'LIABILITIES', 'OPENING CR'].includes(rawType);
      const amount = Number(transaction.amount) || 0;
      const delta = isCredit ? amount : -amount;
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

    const chronologicalLedger = [...ledger].reverse();

    const stockTypes = ["BUY", "SALE", "LOSS", "USE", "EXTRA RECEIVE"];
    const stockTransactions = chronologicalLedger.filter((t) => {
      const type = ((t.entryType || t.transactionType || "") as string).toUpperCase();
      return stockTypes.includes(type) || (t as any).variety;
    });

    let stockTableHtml = '';
    if (stockTransactions.length > 0) {
      let totalStockDebit = 0;
      let totalStockCredit = 0;
      let totalStockQtyCredit = 0;
      let totalStockQtyDebit = 0;

      const stockRows = stockTransactions.map(tx => {
        const rawType = ((tx as any).entryType || tx.transactionType || "").toUpperCase();
        const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE'].includes(rawType);
        const qty = tx.quantity || 0;
        const amount = tx.amount || 0;

        if (isCredit) {
          totalStockCredit += amount;
          totalStockQtyCredit += qty;
        } else {
          totalStockDebit += amount;
          totalStockQtyDebit += qty;
        }

        const qtyCreditHtml = isCredit && qty > 0 ? qty.toLocaleString() : '-';
        const qtyDebitHtml = !isCredit && qty > 0 ? qty.toLocaleString() : '-';
        const amtCreditHtml = isCredit ? formatCurrency(amount) : '-';
        const amtDebitHtml = !isCredit ? formatCurrency(amount) : '-';

        return `
          <tr>
            <td>${getDisplayId(tx)}</td>
            <td style="white-space: nowrap;">${format(new Date(tx.date), 'dd-MMM-yyyy')}</td>
            <td>${toTitleCase(tx.variety || '') || '-'}</td>
            <td style="text-align:right">${tx.rate || '-'}</td>
            <td style="text-align:right">${qtyCreditHtml}</td>
            <td style="text-align:right">${qtyDebitHtml}</td>
            <td>${(tx as any).unit || (tx.id.startsWith('SUP-') ? 'Qtl' : 'Bag')}</td>
            <td style="text-align:right">${amtCreditHtml}</td>
            <td style="text-align:right">${amtDebitHtml}</td>
          </tr>
        `;
      }).join('');

      stockTableHtml = `
        <h2 style="font-size: 16px; margin-top: 32px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.04em;">Stock Entries Details</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Variety</th>
              <th style="text-align:right">Rate</th>
              <th style="text-align:right; color: #16a34a;">Qty (CR)</th>
              <th style="text-align:right; color: #dc2626;">Qty (DR)</th>
              <th>Unit</th>
              <th style="text-align:right; color: #16a34a;">Credit (Rec)</th>
              <th style="text-align:right; color: #dc2626;">Debit (Paid)</th>
            </tr>
          </thead>
          <tbody>
            ${stockRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">Totals</td>
              <td style="text-align:right">${totalStockQtyCredit ? totalStockQtyCredit.toLocaleString() : '-'}</td>
              <td style="text-align:right">${totalStockQtyDebit ? totalStockQtyDebit.toLocaleString() : '-'}</td>
              <td></td>
              <td style="text-align:right">${formatCurrency(totalStockCredit)}</td>
              <td style="text-align:right">${formatCurrency(totalStockDebit)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    const rows = chronologicalLedger.map(tx => {
      const rawType = ((tx as any).entryType || tx.transactionType || "").toUpperCase();
      const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'PAYABLE', 'LIABILITIES', 'OPENING CR'].includes(rawType);

      const credit = isCredit ? tx.amount : 0;
      const debit = isCredit ? 0 : tx.amount;
      totalCredit += credit;
      totalDebit += debit;
      return `
        <tr>
          <td style="white-space: nowrap;">${format(new Date(tx.date), 'dd-MMM-yyyy')}</td>
          <td>${getDisplayId(tx)}</td>
          <td>
            ${toTitleCase(tx.description || tx.payee || '')}
            ${(tx as any).variety ? `<br/><span style="font-size:11px;color:#4b5563;font-weight:600;">${(tx as any).variety} ${(tx as any).quantity > 0 ? `(${(tx as any).quantity} Bags)` : ''} ${(tx as any).rate > 0 ? `@ ₹${(tx as any).rate}` : ''}</span>` : ''}
          </td>
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
        <th style="white-space: nowrap;">Date</th>
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
        <td style="text-align:right">${formatCurrency(chronologicalLedger[chronologicalLedger.length - 1].runningBalance)}</td>
      </tr>
    </tfoot>
  </table>
  
  ${stockTableHtml}
  
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

    let creditTotal = 0;
    let debitTotal = 0;

    totalsTransactions.forEach((t) => {
      const rawType = ((t as any).entryType || t.transactionType || "").toUpperCase();
      const isCredit = ['BUY', 'INCOME', 'EXTRA RECEIVE', 'LEND RETURN', 'BORROW', 'SALARY', 'LABOURY', 'TRANSPORT', 'BROKERAGE', 'CAPITAL', 'BUILDING', 'MACHINERY', 'MISCELLANEOUS', 'PAYABLE', 'LIABILITIES'].includes(rawType);
      if (isCredit) creditTotal += t.amount;
      else debitTotal += t.amount;
    });

    // Calculate final running balance (Credit - Debit to match Ledger logic)
    const finalRunningBalance = creditTotal - debitTotal;

    return {
      totalIncome: creditTotal,
      totalExpense: debitTotal,
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
        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-slate-100/80 p-1 h-11 border border-slate-200 flex flex-wrap max-w-full overflow-x-auto gap-0.5">
              <TabsTrigger value="entry" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Entry
              </TabsTrigger>
              <TabsTrigger value="variety" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Variety (Stock)
              </TabsTrigger>
              <TabsTrigger value="receipts" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Stock Receipts
              </TabsTrigger>
              <TabsTrigger value="tags" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Tag Accounts
              </TabsTrigger>
              <TabsTrigger value="ledger" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Party Ledgers
              </TabsTrigger>
              <TabsTrigger value="pnl" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                P&L Statement
              </TabsTrigger>
              <TabsTrigger value="balanceSheet" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="trialBalance" className="px-4 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                Trial Balance
              </TabsTrigger>
            </TabsList>
            {activeMainTab === 'entry' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNew}
                  className="h-9 px-4 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider text-[10px]"
                >
                  <PlusCircle className="h-3.5 w-3.5 mr-2" />
                  New Entry
                </Button>
                {/* Existing action buttons can stay here or be moved */}
              </div>
            )}
          </div>

          <TabsContent value="entry" className="mt-0 space-y-4">
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
                      <div className="flex flex-row items-center gap-3">
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
                        <div className="w-[250px] shrink-0 h-8">
                          <Input
                            type="text"
                            placeholder="Search Description..."
                            value={searchDescription}
                            onChange={(e) => setSearchDescription(e.target.value)}
                            className="rounded-[4px] border-purple-800 focus-visible:ring-purple-500 h-8 text-xs shadow-none bg-purple-50/5 text-purple-900"
                          />
                        </div>
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

            <div className="grid gap-2 md:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[450px_minmax(0,1fr)] h-auto items-start mb-6">
              <div className="min-w-0">
                <Card className="rounded-[14px] border border-white/60 bg-white/70 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] backdrop-blur-[12px] h-[430px] flex flex-col overflow-hidden">
                  <CardContent className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                    <TransactionForm
                      form={form}
                      onSubmit={handleSubmit(onSubmit)}
                      handleNew={handleNew}
                      handleTransactionIdBlur={handleTransactionIdBlur}
                      isSubmitting={isSubmitting}
                      editingTransaction={editingTransaction}
                      setLastAmountSource={setLastAmountSource}
                      bankAccounts={bankAccounts}
                      uniqueVarieties={uniqueVarieties}
                      accountOptions={accountOptions}
                      selectedTransactionType={['Income', 'Sale'].includes(selectedEntryType || '') ? 'Income' : 'Expense'}
                      onManageVarieties={() => setIsVarietyManagerOpen(true)}
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
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  onBulkDelete={handleBulkDelete}
                  onBulkShift={handleBulkShift}
                  onBulkChangeDescription={() => setIsBulkDescDialogOpen(true)}
                  accountOptions={accountOptions}
                  supplierPaymentMap={supplierPaymentMap}
                  onShowInfo={(t) => {
                    if (t.customerPaymentRef) {
                      setInfoPayment(t.customerPaymentRef);
                    } else if (t.customerRef) {
                      setInfoCustomer(t.customerRef);
                    }
                  }}
                />
              </div>
            </div>

            <ReceiptsAccounts 
              transactions={filteredTransactions} 
              onEdit={handleEdit} 
              onDelete={handleDeleteTransaction} 
            />
          </TabsContent>

          <TabsContent value="variety" className="mt-0">
            <VarietyAccounts transactions={allStockTransactions} dbVarieties={dbVarieties} />
          </TabsContent>

          <TabsContent value="receipts" className="mt-0">
            <ReceiptsAccounts 
              transactions={allStockTransactions} 
              onEdit={handleEdit} 
              onDelete={handleDeleteTransaction} 
            />
          </TabsContent>

          <TabsContent value="tags" className="mt-0">
            <TagAccounts transactions={visibleTransactions} />
          </TabsContent>

          <TabsContent value="ledger" className="mt-0">
            <LedgerAccounts transactions={allTransactions} />
          </TabsContent>

          <TabsContent value="pnl" className="mt-0">
            <PnlAccounts transactions={allTransactions} />
          </TabsContent>

          <TabsContent value="balanceSheet" className="mt-0">
            <BalanceSheetAccounts transactions={allTransactions} />
          </TabsContent>

          <TabsContent value="trialBalance" className="mt-0">
            <TrialBalanceAccounts transactions={allTransactions} />
          </TabsContent>
        </Tabs>




        {/* Add Account Dialog */}
        <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogContent className="max-w-2xl p-0 gap-0 bg-white border-2 border-slate-300 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-xl overflow-hidden">
            <DialogHeader className="px-6 pt-5 pb-4 border-b border-primary/20 bg-[#3b0764] shadow-md">
              <DialogTitle className="text-xl font-black !text-white tracking-tight uppercase">Add New Account</DialogTitle>
            </DialogHeader>
            <AddAccountForm
              initialAccount={newAccount}
              onSave={handleSaveNewAccount}
              onClose={() => setIsAddAccountOpen(false)}
              isSearchingGST={isSearchingGST}
              handleSearchGST={handleSearchGST}
              searchedGSTDetails={searchedGSTDetails}
              isSubmitting={isSubmitting}
              isSearchingPAN={isSearchingPAN}
              handleSearchPAN={handleSearchPAN}
              handlePastePANText={handlePastePANText}
              searchedFirms={searchedFirms}
              handleSelectFirm={handleSelectFirm}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Account Dialog */}
        <Dialog open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}>
          <DialogContent className="max-w-2xl p-0 gap-0 bg-popover border-border shadow-2xl">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-primary/20 bg-primary shadow-sm">
              <DialogTitle className="text-xl font-extrabold !text-white tracking-tight">Edit Account</DialogTitle>
              <DialogDescription className="text-sm font-medium !text-white/90 mt-1">
                Update account details. Changing name will update all related transactions.
              </DialogDescription>
            </DialogHeader>
            <EditAccountForm
              initialAccount={editAccount}
              onSave={handleSaveEditAccount}
              onClose={() => setIsEditAccountOpen(false)}
              isSearchingGST={isSearchingGST}
              handleSearchGST={handleSearchGST}
              searchedGSTDetails={searchedGSTDetails}
              isSubmitting={isSubmitting}
              isSearchingPAN={isSearchingPAN}
              handleSearchPAN={handleSearchPAN}
              handlePastePANText={handlePastePANText}
              searchedFirms={searchedFirms}
              handleSelectFirm={handleSelectFirm}
            />
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

        {/* CategoryManagerDialog removed */}

        <Dialog open={isBulkDescDialogOpen} onOpenChange={setIsBulkDescDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-popover border-border text-foreground shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold uppercase tracking-tight text-foreground">Update Description in Bulk</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Enter a new description for the {selectedIds.size} selected transaction(s).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bulkDescription" className="text-xs font-bold uppercase tracking-wider text-foreground">New Description</Label>
                <Textarea
                  id="bulkDescription"
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                  placeholder="Enter description here..."
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20 text-sm"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsBulkDescDialogOpen(false)} disabled={isSubmitting} className="h-9 border-border text-foreground">
                Cancel
              </Button>
              <Button onClick={handleBulkSaveDescription} disabled={isSubmitting} className="h-9 bg-primary hover:bg-primary/95 text-primary-foreground font-bold">
                Update Description
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <OptionsManagerDialog
          isOpen={isVarietyManagerOpen}
          setIsOpen={setIsVarietyManagerOpen}
          type="variety"
          options={varietyOptions}
          onAdd={(collectionName, optionData) => addOption(collectionName, optionData)}
          onUpdate={(collectionName, id, optionData) => updateOption(collectionName, id, optionData)}
          onDelete={(collectionName, id, name) => deleteOption(collectionName, id, name)}
        />

        <SupplierPurchaseDialog trigger={<button id="trigger-supplier-purchase" className="hidden" type="button" />} />
        <CustomerSaleDialog trigger={<button id="trigger-customer-sale" className="hidden" type="button" />} />

        {/* Customer Payment Details Info Dialog */}
        <Dialog open={!!infoPayment} onOpenChange={(open) => !open && setInfoPayment(null)}>
          <DialogContent className="sm:max-w-[550px] bg-white border-slate-200 text-slate-900 shadow-2xl rounded-2xl overflow-hidden p-0">
            <DialogHeader className="px-6 py-4 bg-slate-50 border-b border-slate-100">
              <div>
                <DialogTitle className="text-base font-extrabold uppercase tracking-tight text-slate-800">
                  Receipt Details
                </DialogTitle>
                <DialogDescription className="text-[10px] text-slate-500 uppercase font-black tracking-wider mt-0.5">
                  {infoPayment?.paymentId || infoPayment?.id || 'N/A'}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-4">
              {/* Main Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Paid Amount</div>
                  <div className="text-xl font-black text-emerald-600 mt-1">
                    {formatCurrency(infoPayment?.amount || 0)}
                  </div>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Cash Discount (CD)</div>
                  <div className="text-xl font-black text-blue-600 mt-1">
                    {formatCurrency(infoPayment?.cdAmount || 0)}
                  </div>
                </div>
              </div>

              {/* Basic Fields Table */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="font-bold text-slate-800">{
                    infoPayment ? (
                      (() => {
                        const srNo = infoPayment.paidFor?.[0]?.srNo;
                        if (srNo) {
                          const cMatch = (globalData.customers || []).find(c => String(c.srNo) === String(srNo));
                          if (cMatch?.name) return cMatch.name;
                        }
                        const cMatchById = (globalData.customers || []).find(c => c.id === infoPayment.customerId);
                        return cMatchById?.name || infoPayment.customerId || 'Unknown Customer';
                      })()
                    ) : ''
                  }</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500 font-medium">Date:</span>
                  <span className="font-bold text-slate-800">
                    {infoPayment?.date ? format(new Date(infoPayment.date), "dd-MMM-yyyy") : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/50">
                  <span className="text-slate-500 font-medium">Payment Mode:</span>
                  <span className="font-bold text-slate-800">{infoPayment?.paymentMethod || 'Cash'}</span>
                </div>
                {infoPayment?.notes && (
                  <div className="flex flex-col py-1">
                    <span className="text-slate-500 font-medium">Notes:</span>
                    <span className="text-slate-700 mt-1 bg-white p-2 rounded border border-slate-200/50 max-h-20 overflow-y-auto">
                      {infoPayment.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Adjusted Invoices details */}
              {infoPayment?.paidFor && infoPayment.paidFor.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Adjusted Bills / Receipts</div>
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="p-2">Bill/Receipt No.</th>
                          <th className="p-2 text-right">Cash Received</th>
                          <th className="p-2 text-right">CD Applied</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {infoPayment.paidFor.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-700">{item.srNo || 'N/A'}</td>
                            <td className="p-2 text-right font-semibold text-emerald-600">{formatCurrency(item.amount || 0)}</td>
                            <td className="p-2 text-right font-semibold text-blue-600">{formatCurrency(item.cdAmount || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <Button variant="outline" onClick={() => setInfoPayment(null)} className="h-9 border-slate-200 text-slate-700 hover:bg-slate-100">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Customer Details Dialog (for Sales) */}
        <CustomerDetailsDialog
          customer={infoCustomer}
          onOpenChange={() => setInfoCustomer(null)}
          onPrint={(cust) => {
            console.log("Print customer from expense tracker:", cust);
            toast({
              title: "Print Requested",
              description: `Printing invoice for SR No: ${cust.srNo}`,
            });
          }}
          paymentHistory={globalData.customerPayments || []}
        />
      </div>
    </ErrorBoundary>
  );
}

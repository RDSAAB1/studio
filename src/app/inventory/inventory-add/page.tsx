"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  Plus, 
  Save, 
  RotateCcw, 
  Search, 
  Trash2, 
  Edit, 
  History, 
  Scale, 
  IndianRupee, 
  ListChecks, 
  Wallet, 
  Settings, 
  ArrowDownLeft, 
  ArrowUpRight,
  RefreshCw,
  User,
  Loader2,
  FileText
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

import { db } from "@/lib/database";
const hasDb = () => typeof window !== 'undefined';
const generateId = () => Math.random().toString(36).substring(2, 11);
import { InventoryAddEntry, OptionItem, LedgerAccount, LedgerEntry } from "@/lib/definitions";
import { 
  getOptionsRealtime, 
  addOption, 
  updateOption, 
  deleteOption,
  getLedgerAccountsRealtime,
  createLedgerAccount,
  getLedgerEntriesRealtime,
  addExpense,
  deleteExpense,
  addIncome,
  deleteIncome
} from "@/lib/firestore";
import { 
  generateLedgerEntryId,
  queueLedgerEntriesUpsert,
  queueLedgerEntryDelete 
} from "@/lib/ledger-sync";
import { recalculateBalances } from "@/app/sales/ledger/utils";
import { useGlobalData } from "@/contexts/global-data-context";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { OptionsManagerDialog } from "@/components/sales/options-manager-dialog";

function toTitleCase(str: string) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export default function InventoryAddPage() {
  const { bankAccounts, incomes, expenses } = useGlobalData();
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [isVarietyDialogOpen, setIsVarietyDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("stock");

  const [form, setForm] = useState({
    date: new Date(),
    transactionType: 'BUY' as 'BUY' | 'SALE' | 'USE' | 'LOSS',
    name: "",
    ledgerAccountId: "",
    variety: "",
    rate: 0,
    bagsQuantity: 0,
    bagsWeight: 0,
    quantity: 0,
    amount: 0,
    paymentMethod: 'Cash' as any,
    paidAmount: 0,
    bankAccountId: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    date: new Date(),
    type: 'GIVE' as 'GIVE' | 'RECEIVE',
    amount: 0,
    ledgerAccountId: "",
    name: "",
    paymentMethod: 'Cash' as any,
    bankAccountId: 'CashInHand',
    remarks: ""
  });

  const unifiedPaymentOptions = useMemo(() => {
    const options = [
      { id: 'CashInHand', name: 'CASH IN HAND' },
    ];
    bankAccounts.forEach(acc => {
      options.push({
        id: acc.id,
        name: `${acc.accountHolderName} (...${acc.accountNumber?.slice(-4)})`
      });
    });
    return options;
  }, [bankAccounts]);

  const handlePaymentMethodSelection = (val: string, isPaymentForm: boolean) => {
    let newPaymentMethod = '';
    let newBankAccountId = '';

    if (val === 'CashInHand') {
      newPaymentMethod = 'Cash';
      newBankAccountId = 'CashInHand';
    } else if (['RTGS', 'Gov.', 'Ledger'].includes(val)) {
      newPaymentMethod = val;
      newBankAccountId = '';
    } else {
      newPaymentMethod = 'Online';
      newBankAccountId = val;
    }

    if (isPaymentForm) {
      setPaymentForm(f => ({ ...f, paymentMethod: newPaymentMethod as any, bankAccountId: newBankAccountId }));
    } else {
      setForm(f => ({ ...f, paymentMethod: newPaymentMethod as any, bankAccountId: newBankAccountId }));
    }
  };

  const getSelectValue = (pm: string, baId: string) => {
    if (pm === 'Cash') return 'CashInHand';
    if (pm === 'Online' && baId) return baId;
    if (['RTGS', 'Gov.', 'Ledger'].includes(pm)) return pm;
    return 'CashInHand';
  };

  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  useEffect(() => {
    const unsubVarieties = getOptionsRealtime("varieties", setVarietyOptions, () => {});
    const unsubLedger = getLedgerAccountsRealtime(setLedgerAccounts, () => {});
    return () => { unsubVarieties(); unsubLedger(); };
  }, []);

  useEffect(() => {
    if (!selectedLedgerAccountId) {
      setLedgerEntries([]);
      return;
    }
    setIsLedgerLoading(true);
    const unsub = getLedgerEntriesRealtime(
      (data) => {
        setLedgerEntries(data);
        setIsLedgerLoading(false);
      },
      () => setIsLedgerLoading(false),
      selectedLedgerAccountId
    );
    return () => unsub();
  }, [selectedLedgerAccountId]);

  const entries = useLiveQuery(async () => {
    if (!hasDb()) return [];
    try { return await db!.inventoryAddEntries.toArray(); } catch { return []; }
  }, []);

  const activeLedgerEntries = useMemo(() => {
    return recalculateBalances(ledgerEntries).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      const idA = parseInt(a.id.replace(/\D/g, '')) || 0;
      const idB = parseInt(b.id.replace(/\D/g, '')) || 0;
      return idB - idA;
    });
  }, [ledgerEntries]);

  const transactionsForSelectedParty = useMemo(() => {
    if (!paymentForm.name) return [];
    return (entries || []).filter(e => e.name.toUpperCase() === paymentForm.name.toUpperCase());
  }, [entries, paymentForm.name]);

  const partySummary = useMemo(() => {
    const billAmount = transactionsForSelectedParty.reduce((sum, e) => sum + e.amount, 0);
    const paidAmount = activeLedgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const balance = activeLedgerEntries[0]?.runningBalance ?? 0;
    return { billAmount, paidAmount, balance };
  }, [transactionsForSelectedParty, activeLedgerEntries]);

  const filteredEntries = useMemo(() => {
    const list = entries ?? [];
    if (varietyFilter === "all") return list;
    return list.filter((e) => toTitleCase(e.variety) === toTitleCase(varietyFilter));
  }, [entries, varietyFilter]);

  const summaryByVariety = useMemo(() => {
    const list = entries ?? [];
    const map = new Map<string, any>();
    for (const e of list) {
      const key = toTitleCase(e.variety) || "Unknown";
      const prev = map.get(key) ?? { buyQty: 0, saleQty: 0, useQty: 0, lossQty: 0, netQty: 0, amount: 0 };
      const qty = e.quantity || 0;
      if (e.transactionType === 'BUY') { prev.buyQty += qty; prev.netQty += qty; }
      else if (e.transactionType === 'SALE') { prev.saleQty += qty; prev.netQty -= qty; }
      else if (e.transactionType === 'USE') { prev.useQty += qty; prev.netQty -= qty; }
      else if (e.transactionType === 'LOSS') { prev.lossQty += qty; prev.netQty -= qty; }
      map.set(key, prev);
    }
    return Array.from(map.entries()).map(([variety, data]) => ({ variety, ...data }));
  }, [entries]);

  const globalTotals = useMemo(() => {
    const list = entries ?? [];
    return list.reduce((acc, e) => {
      if (e.transactionType === 'BUY') acc.buy += e.quantity;
      else if (e.transactionType === 'SALE') acc.sale += e.quantity;
      else if (e.transactionType === 'USE' || e.transactionType === 'LOSS') acc.loss += e.quantity;
      return acc;
    }, { buy: 0, sale: 0, loss: 0 });
  }, [entries]);

  const nameDropdownOptions = useMemo(() => {
    const names = new Set<string>();
    entries?.forEach(e => names.add(e.name.toUpperCase()));
    incomes?.forEach(i => names.add(i.payee.toUpperCase()));
    expenses?.forEach(e => names.add(e.payee.toUpperCase()));
    return Array.from(names).sort().map(n => ({ value: n, label: n }));
  }, [entries, incomes, expenses]);

  const handleClear = () => {
    setForm({
      date: new Date(),
      transactionType: 'BUY',
      name: "",
      ledgerAccountId: "",
      variety: "",
      rate: 0,
      bagsQuantity: 0,
      bagsWeight: 0,
      quantity: 0,
      amount: 0,
      paymentMethod: 'Cash',
      paidAmount: 0,
      bankAccountId: '',
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.variety?.trim()) { toast({ title: "Variety select karein", variant: "destructive" }); return; }
    if (form.quantity <= 0) { toast({ title: "Quantity 0 se zyada honi chahiye", variant: "destructive" }); return; }

    const dateStr = format(form.date, "yyyy-MM-dd");
    let expenseTransactionId, incomeTransactionId, ledgerEntryId;

    let finalAccountId = form.ledgerAccountId;
    if (!finalAccountId && form.name.trim()) {
      const existing = ledgerAccounts.find(a => a.name.toUpperCase() === form.name.trim().toUpperCase());
      if (existing) finalAccountId = existing.id;
      else if (form.transactionType === 'BUY' || form.transactionType === 'SALE') {
        const newAcc = await createLedgerAccount({ name: form.name.trim(), address: "", contact: "" });
        finalAccountId = newAcc.id;
      }
    }

    if (finalAccountId && (form.transactionType === 'BUY' || form.transactionType === 'SALE')) {
      const isBuy = form.transactionType === 'BUY';
      const entryId = generateLedgerEntryId();
      const particulars = `${form.transactionType === 'BUY' ? 'Purchase' : 'Sale'}: ${form.variety.toUpperCase()} (${form.quantity.toFixed(2)} Qtl @ ₹${form.rate.toFixed(2)})`;
      const newEntry: LedgerEntry = {
        id: entryId, accountId: finalAccountId, date: dateStr, particulars,
        debit: isBuy ? 0 : form.amount, credit: isBuy ? form.amount : 0, balance: 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        remarks: `Inventory Entry ID: ${editingId || 'new'}`
      };
      const entriesToSync = [newEntry];
      if (form.paidAmount > 0) {
        entriesToSync.push({
          id: generateLedgerEntryId(), accountId: finalAccountId, date: dateStr,
          particulars: `Payment for ${form.variety}`, debit: isBuy ? form.paidAmount : 0,
          credit: isBuy ? 0 : form.paidAmount, balance: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          remarks: `Payment via ${form.paymentMethod}`
        });
      }
      await queueLedgerEntriesUpsert(entriesToSync);
      ledgerEntryId = entryId;
    }

    if (form.paidAmount > 0) {
      if (form.transactionType === 'BUY') {
        const expense = await addExpense({
          transactionId: "", date: dateStr, transactionType: 'Expense', category: "Inventory Purchase",
          subCategory: form.variety, amount: form.paidAmount, payee: form.name || "Variety Supplier",
          paymentMethod: form.paymentMethod, bankAccountId: form.bankAccountId, status: 'Paid',
          description: `Auto-generated from Inventory BUY: ${form.variety}`, createdAt: new Date().toISOString(),
        });
        expenseTransactionId = expense.id;
      } else if (form.transactionType === 'SALE') {
        const income = await addIncome({
          transactionId: "", date: dateStr, transactionType: 'Income', category: "Inventory Sale",
          subCategory: form.variety, amount: form.paidAmount, payee: form.name || "Variety Customer",
          paymentMethod: form.paymentMethod, bankAccountId: form.bankAccountId, status: 'Paid',
          description: `Auto-generated from Inventory SALE: ${form.variety}`, createdAt: new Date().toISOString(),
        });
        incomeTransactionId = income.id;
      }
    }

    const entry: InventoryAddEntry = {
      id: editingId ?? generateId(),
      date: dateStr,
      transactionType: form.transactionType,
      name: form.name.trim(),
      ledgerAccountId: finalAccountId,
      variety: form.variety.trim(),
      rate: form.rate,
      bagsQuantity: form.bagsQuantity,
      bagsWeight: form.bagsWeight,
      quantity: form.quantity,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      paidAmount: form.paidAmount,
      bankAccountId: form.bankAccountId,
      expenseTransactionId,
      incomeTransactionId,
      ledgerEntryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db!.inventoryAddEntries.put(entry);
    toast({ title: editingId ? "Entry update ho gayi" : "Entry save ho gayi", variant: "success" });
    handleClear();
  };

  const handleStandalonePayment = async () => {
    if (!paymentForm.ledgerAccountId && !paymentForm.name) { toast({ title: "Party select karein", variant: "destructive" }); return; }
    if (paymentForm.amount <= 0) { toast({ title: "Amount 0 se zyada honi chahiye", variant: "destructive" }); return; }

    let finalAccId = paymentForm.ledgerAccountId;
    if (!finalAccId && paymentForm.name) {
      const existing = ledgerAccounts.find(a => a.name.toUpperCase() === paymentForm.name.toUpperCase());
      if (existing) finalAccId = existing.id;
      else {
        const newAcc = await createLedgerAccount({ name: paymentForm.name, address: "", contact: "" });
        finalAccId = newAcc.id;
      }
    }

    const dateStr = format(paymentForm.date, "yyyy-MM-dd");
    const isGive = paymentForm.type === 'GIVE';

    const entry: LedgerEntry = {
      id: generateLedgerEntryId(), accountId: finalAccId, date: dateStr,
      particulars: `Payment (${paymentForm.type}): ${paymentForm.remarks || 'Settlement'}`,
      debit: isGive ? paymentForm.amount : 0, credit: isGive ? 0 : paymentForm.amount, balance: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await queueLedgerEntriesUpsert([entry]);

    if (isGive) {
      await addExpense({
        transactionId: "", date: dateStr, transactionType: 'Expense', category: "Payment to Party",
        subCategory: paymentForm.name, amount: paymentForm.amount, payee: paymentForm.name,
        paymentMethod: paymentForm.paymentMethod, bankAccountId: paymentForm.bankAccountId, status: 'Paid',
        description: paymentForm.remarks, createdAt: new Date().toISOString(),
      });
    } else {
      await addIncome({
        transactionId: "", date: dateStr, transactionType: 'Income', category: "Payment from Party",
        subCategory: paymentForm.name, amount: paymentForm.amount, payee: paymentForm.name,
        paymentMethod: paymentForm.paymentMethod, bankAccountId: paymentForm.bankAccountId, status: 'Paid',
        description: paymentForm.remarks, createdAt: new Date().toISOString(),
      });
    }

    toast({ title: "Payment record ho gayi", variant: "success" });
    setPaymentForm(f => ({ ...f, amount: 0, remarks: "" }));
  };

  const handleAddOption = async (collectionName: string, optionData: Partial<OptionItem>) => {
    try {
      await addOption(collectionName, optionData);
      toast({ title: "Success", description: "Variety added successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdateOption = async (collectionName: string, id: string, optionData: Partial<OptionItem>) => {
    try {
      await updateOption(collectionName, id, optionData);
      toast({ title: "Success", description: "Variety updated successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteOption = async (id: string, name: string) => {
    try {
      await deleteOption("varieties", id, name);
      toast({ title: "Success", description: "Variety deleted successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleSave(); }
      if (e.altKey && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); handleClear(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleClear]);

  return (
    <div className="space-y-6 pb-20 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-emerald-600 uppercase">Total Stock In (Buy)</span>
            <span className="text-2xl font-black text-emerald-700">{globalTotals.buy.toFixed(2)} Qtl</span>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-blue-600 uppercase">Total Stock Out (Sale)</span>
            <span className="text-2xl font-black text-blue-700">{globalTotals.sale.toFixed(2)} Qtl</span>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-primary uppercase">Net Stock Available</span>
            <span className="text-2xl font-black text-primary">{(globalTotals.buy - globalTotals.sale - globalTotals.loss).toFixed(2)} Qtl</span>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="stock" className="rounded-lg px-8 py-2 font-black uppercase tracking-tight data-[state=active]:bg-primary data-[state=active]:text-white">
            <ListChecks className="mr-2 h-4 w-4" /> Stock Entry
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-lg px-8 py-2 font-black uppercase tracking-tight data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Wallet className="mr-2 h-4 w-4" /> Payments & Ledger
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stock" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card className="border-2 border-primary/10 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/80 border-b border-primary/10 py-3 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[12px] font-black uppercase flex items-center gap-2 tracking-wider">
                      <Plus className="h-4 w-4 text-primary" /> Stock Movement Entry
                    </CardTitle>
                    <Badge variant="outline" className="font-black bg-white border-primary/20 text-primary uppercase text-[9px]">ERP Mode: Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Core Details */}
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                          <History className="h-3 w-3" /> Transaction Type
                        </Label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                          {(['BUY', 'SALE', 'USE', 'LOSS'] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => setForm(f => ({ ...f, transactionType: type }))}
                              className={cn(
                                "py-2 px-1 text-[10px] font-black uppercase rounded-md transition-all",
                                form.transactionType === type 
                                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-200" 
                                  : "text-slate-500 hover:text-slate-800"
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Plus className="h-3 w-3" /> Entry Date
                          </Label>
                          <div className="relative">
                            <SmartDatePicker 
                              date={form.date} 
                              onChange={(d) => d && setForm(f => ({ ...f, date: d }))} 
                              className="h-10 font-black text-xs border-slate-200 focus:border-primary/50" 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Scale className="h-3 w-3" /> Variety
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <CustomDropdown
                                options={varietyOptions}
                                value={form.variety}
                                onChange={(v) => setForm(f => ({ ...f, variety: v }))}
                                placeholder="Select Variety"
                                onManageOptions={() => setIsVarietyDialogOpen(true)}
                                className="h-10 font-black text-xs border-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                          <User className="h-3 w-3" /> Party Name / Ledger
                        </Label>
                        <CustomDropdown
                          options={nameDropdownOptions}
                          value={form.name}
                          onChange={(v) => {
                            const acc = ledgerAccounts.find(a => a.name.toUpperCase() === v.toUpperCase());
                            setForm(f => ({ ...f, name: v, ledgerAccountId: acc?.id || "" }));
                          }}
                          placeholder="Search or Select Party"
                          allowCustom={true}
                          className="h-11 font-black text-sm border-slate-200"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rate (per Qtl)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                            <Input 
                              type="number" 
                              value={form.rate || ""} 
                              onChange={e => {
                                const val = Number(e.target.value) || 0;
                                setForm(f => ({ ...f, rate: val, amount: val * f.quantity }));
                              }} 
                              className="h-10 pl-7 font-black text-xs border-slate-200" 
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Quantity (Qtl)</Label>
                          <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">QTL</span>
                            <Input 
                              type="number" 
                              value={form.quantity || ""} 
                              onChange={e => {
                                const val = Number(e.target.value) || 0;
                                setForm(f => ({ ...f, quantity: val, amount: f.rate * val }));
                              }} 
                              className="h-10 pr-10 font-black text-xs border-slate-200" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Financials & Settlement */}
                    <div className="space-y-5 bg-slate-50/50 p-5 rounded-xl border border-slate-100 shadow-inner">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-black text-primary uppercase tracking-widest">Calculated Total Bill</Label>
                        <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-2xl font-black text-primary opacity-50">₹</span>
                          </div>
                          <Input 
                            type="number" 
                            value={form.amount || ""} 
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              setForm(f => ({ ...f, amount: val, quantity: f.rate > 0 ? val / f.rate : f.quantity }));
                            }} 
                            className="h-16 pl-10 font-black text-4xl bg-white border-primary/20 text-primary shadow-sm group-hover:border-primary/40 transition-all" 
                          />
                          <div className="absolute top-1/2 -translate-y-1/2 right-4 pointer-events-none">
                            <Badge className="bg-primary/10 text-primary border-none font-black text-[10px]">AUTO-SYNC</Badge>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-slate-200" />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Instant Settlement</Label>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] border-emerald-200 text-emerald-600 bg-emerald-50">OPTIONAL</Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                            <Input 
                              type="number" 
                              placeholder="Paid Amount"
                              value={form.paidAmount || ""} 
                              onChange={e => setForm(f => ({ ...f, paidAmount: Number(e.target.value) || 0 }))} 
                              className="h-10 pl-7 font-black text-xs border-emerald-100 focus:border-emerald-500 bg-white" 
                            />
                          </div>

                          {form.paidAmount > 0 && (
                            <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-1">
                              <Select value={getSelectValue(form.paymentMethod, form.bankAccountId)} onValueChange={(v) => handlePaymentMethodSelection(v, false)}>
                                <SelectTrigger className="h-9 text-[10px] font-black uppercase border-emerald-100">
                                  <SelectValue placeholder="Payment Method" />
                                </SelectTrigger>
                                <SelectContent>
                                  {unifiedPaymentOptions.map(o => (
                                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-4 px-6 flex gap-4">
                  <Button 
                    onClick={handleSave} 
                    size="lg"
                    className="flex-1 h-14 font-black uppercase shadow-xl hover:shadow-primary/20 transition-all text-sm tracking-widest gap-3"
                  >
                    <Save className="h-5 w-5" /> 
                    {editingId ? "Update Transaction" : "Commit Transaction"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleClear} 
                    size="lg"
                    className="w-40 h-14 font-black uppercase border-2 text-slate-600 hover:bg-slate-100 tracking-widest gap-3"
                  >
                    <RotateCcw className="h-5 w-5" /> Clear
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <Card className="h-full border-2 border-slate-200 shadow-xl overflow-hidden flex flex-col bg-white">
                <CardHeader className="bg-slate-50 border-b py-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[12px] font-black uppercase flex items-center gap-2 tracking-wider text-slate-700">
                      <History className="h-4 w-4 text-primary" /> Variety Inventory Pulse
                    </CardTitle>
                    <RefreshCw className="h-3 w-3 text-slate-400 animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-[520px]">
                    <div className="divide-y divide-slate-100">
                      {summaryByVariety.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-20" />
                          <span className="text-[10px] font-black uppercase">Scanning Inventory...</span>
                        </div>
                      ) : summaryByVariety.map(s => (
                        <div 
                          key={s.variety} 
                          className="p-5 hover:bg-primary/[0.03] cursor-pointer transition-colors group" 
                          onClick={() => setForm(f => ({ ...f, variety: s.variety }))}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 group-hover:text-primary transition-colors">{s.variety}</h4>
                              <p className="text-[9px] font-black text-muted-foreground uppercase mt-0.5">NET STOCK STATUS</p>
                            </div>
                            <div className="text-right">
                              <span className={cn(
                                "text-lg font-black tracking-tighter",
                                s.netQty > 0 ? "text-emerald-600" : s.netQty < 0 ? "text-red-600" : "text-slate-400"
                              )}>
                                {s.netQty.toFixed(2)}
                              </span>
                              <span className="text-[9px] font-black text-muted-foreground ml-1 uppercase">Qtl</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2">
                            <div className="bg-emerald-50/50 rounded-md p-2 border border-emerald-100/50">
                              <p className="text-[8px] font-black text-emerald-600 uppercase mb-1">Buy</p>
                              <p className="text-[10px] font-black text-emerald-700">{s.buyQty.toFixed(1)}</p>
                            </div>
                            <div className="bg-blue-50/50 rounded-md p-2 border border-blue-100/50">
                              <p className="text-[8px] font-black text-blue-600 uppercase mb-1">Sale</p>
                              <p className="text-[10px] font-black text-blue-700">{s.saleQty.toFixed(1)}</p>
                            </div>
                            <div className="bg-orange-50/50 rounded-md p-2 border border-orange-100/50">
                              <p className="text-[8px] font-black text-orange-600 uppercase mb-1">Use</p>
                              <p className="text-[10px] font-black text-orange-700">{s.useQty.toFixed(1)}</p>
                            </div>
                            <div className="bg-rose-50/50 rounded-md p-2 border border-rose-100/50">
                              <p className="text-[8px] font-black text-rose-600 uppercase mb-1">Loss</p>
                              <p className="text-[10px] font-black text-rose-700">{s.lossQty.toFixed(1)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-2 border-slate-200 shadow-xl overflow-hidden mt-8">
            <CardHeader className="bg-slate-50 border-b py-3 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase">Recent Entries History</CardTitle>
              <Select value={varietyFilter} onValueChange={setVarietyFilter}>
                <SelectTrigger className="h-7 w-[120px] text-[10px] font-black"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL ITEMS</SelectItem>
                  {summaryByVariety.map(s => <SelectItem key={s.variety} value={s.variety}>{s.variety}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-100/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Party</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Variety</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Qty</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.slice().reverse().map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-[11px] font-medium">{format(new Date(e.date), "dd/MM/yy")}</TableCell>
                      <TableCell className="text-xs font-bold uppercase">{e.name || "—"}</TableCell>
                      <TableCell className="text-xs font-black uppercase text-primary">{e.variety}</TableCell>
                      <TableCell className="text-right text-xs font-black">{e.quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs font-black">₹{e.amount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          {paymentForm.name && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <Card className="border-l-4 border-l-rose-500 bg-white shadow-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-lg"><IndianRupee className="h-4 w-4 text-rose-600" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Bill Value</p>
                      <p className="text-xl font-black text-slate-800">₹{partySummary.billAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500 bg-white shadow-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg"><Wallet className="h-4 w-4 text-emerald-600" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Settled</p>
                      <p className="text-xl font-black text-slate-800">₹{partySummary.paidAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary bg-primary/[0.02] shadow-xl md:col-span-2">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Scale className="h-6 w-6 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest">Net Outstanding Balance</p>
                      <p className={`text-3xl font-black tracking-tighter ${partySummary.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ₹{Math.abs(partySummary.balance).toLocaleString()}
                        <span className="text-xs ml-2 uppercase font-black">{(partySummary.balance >= 0 ? 'Debit (DR)' : 'Credit (CR)')}</span>
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-primary text-white border-none font-black text-[10px] px-3 py-1.5 shadow-sm">FORENSIC VERIFIED</Badge>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card className="border-2 border-primary/10 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b py-3 px-5">
                  <CardTitle className="text-[12px] font-black uppercase flex items-center gap-2 tracking-wider">
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> Financial Settlement
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Target Party</Label>
                    <CustomDropdown
                      options={nameDropdownOptions}
                      value={paymentForm.name}
                      onChange={(v) => {
                        const acc = ledgerAccounts.find(a => a.name.toUpperCase() === v.toUpperCase());
                        if (acc) { setPaymentForm(f => ({ ...f, name: acc.name.toUpperCase(), ledgerAccountId: acc.id })); setSelectedLedgerAccountId(acc.id); }
                        else { setPaymentForm(f => ({ ...f, name: (v || "").toUpperCase(), ledgerAccountId: "" })); setSelectedLedgerAccountId(null); }
                      }}
                      placeholder="Search Party..."
                      className="h-11 font-black text-sm border-slate-200"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Settlement Date</Label>
                      <SmartDatePicker 
                        value={paymentForm.date} 
                        onChange={v => setPaymentForm(f => ({ ...f, date: v as Date }))} 
                        className="h-10 font-black text-xs" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Entry Type</Label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 h-10">
                        {(['GIVE', 'RECEIVE'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setPaymentForm(f => ({ ...f, type }))}
                            className={cn(
                              "text-[9px] font-black uppercase rounded transition-all",
                              paymentForm.type === type 
                                ? "bg-white text-primary shadow-sm" 
                                : "text-slate-500"
                            )}
                          >
                            {type === 'GIVE' ? 'Dr (Pay)' : 'Cr (Rec)'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-black uppercase text-primary tracking-widest">Settlement Amount</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-primary opacity-50">₹</span>
                      <Input 
                        type="number" 
                        value={paymentForm.amount || ""} 
                        onChange={e => setPaymentForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} 
                        className="h-16 pl-10 text-4xl font-black border-primary/20 bg-primary/[0.02] text-primary focus:ring-primary/20" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Payment Method</Label>
                      <Select value={getSelectValue(paymentForm.paymentMethod, paymentForm.bankAccountId)} onValueChange={v => handlePaymentMethodSelection(v, true)}>
                        <SelectTrigger className="h-10 text-[10px] font-black uppercase border-slate-200">
                          <SelectValue placeholder="Select Method..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unifiedPaymentOptions.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Reference/Remarks</Label>
                    <Input 
                      placeholder="e.g. UTR No, Chq No, Note"
                      value={paymentForm.remarks} 
                      onChange={e => setPaymentForm(f => ({ ...f, remarks: e.target.value }))} 
                      className="h-10 text-xs font-bold border-slate-200" 
                    />
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t p-4 px-6">
                  <Button 
                    onClick={handleStandalonePayment} 
                    className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-sm font-black shadow-xl tracking-widest gap-3 uppercase"
                  >
                    <Save className="h-5 w-5" /> Save Settlement
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <Card className="border-2 border-slate-200 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b py-3 px-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-[12px] font-black uppercase flex items-center gap-2 tracking-wider text-slate-700">
                    <History className="h-4 w-4 text-primary" /> Forensic Account Ledger
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white font-black text-[9px]">{ledgerEntries.length} ENTRIES</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-100/80 border-b text-[10px] uppercase font-black text-slate-600">
                        <tr>
                          <th className="px-5 py-3 text-left border-r border-slate-200 w-24">Date</th>
                          <th className="px-5 py-3 text-left border-r border-slate-200">Particulars</th>
                          <th className="px-5 py-3 text-right border-r border-slate-200 w-28 bg-rose-50/30 text-rose-700">Debit (Dr)</th>
                          <th className="px-5 py-3 text-right border-r border-slate-200 w-28 bg-emerald-50/30 text-emerald-700">Credit (Cr)</th>
                          <th className="px-5 py-3 text-right w-32 bg-slate-50">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeLedgerEntries.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                              <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                              <p className="text-[10px] font-black uppercase">No Ledger Data Found for Party</p>
                            </td>
                          </tr>
                        ) : activeLedgerEntries.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-2.5 font-medium text-slate-500 border-r border-slate-100">{format(new Date(e.date), "dd/MM/yy")}</td>
                            <td className="px-5 py-2.5">
                              <div className="font-black text-slate-700 leading-tight">{e.particulars.split('(')[0]}</div>
                              {e.particulars.includes('(') && (
                                <div className="text-[9px] font-bold text-muted-foreground uppercase">{e.particulars.split('(')[1].replace(')', '')}</div>
                              )}
                              {e.remarks && <div className="text-[8px] font-medium text-slate-400 mt-0.5 italic">{e.remarks}</div>}
                            </td>
                            <td className="px-5 py-2.5 text-right font-black text-rose-600 border-r border-slate-100 bg-rose-50/10">
                              {e.debit > 0 ? e.debit.toLocaleString() : "—"}
                            </td>
                            <td className="px-5 py-2.5 text-right font-black text-emerald-600 border-r border-slate-100 bg-emerald-50/10">
                              {e.credit > 0 ? e.credit.toLocaleString() : "—"}
                            </td>
                            <td className="px-5 py-2.5 text-right font-black text-slate-800 bg-slate-50/30">
                              {Math.abs(e.balance).toLocaleString()}
                              <span className="text-[8px] ml-1 opacity-50 font-black">{e.balance >= 0 ? 'DR' : 'CR'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <OptionsManagerDialog
        isOpen={isVarietyDialogOpen}
        setIsOpen={setIsVarietyDialogOpen}
        type="variety"
        options={varietyOptions}
        onAdd={handleAddOption}
        onUpdate={handleUpdateOption}
        onDelete={handleDeleteOption}
      />
    </div>
  );
}

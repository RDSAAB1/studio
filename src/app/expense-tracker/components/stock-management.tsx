"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from 'next/navigation';
import { useGlobalData } from "@/contexts/global-data-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { useToast } from "@/hooks/use-toast";
import { confirm } from "@/lib/confirm-dialog";
import { format, parse, isValid } from "date-fns";
import { Loader2, Save, Trash2, Edit2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { toTitleCase, formatCurrency, cn } from "@/lib/utils";
import { addIncome, addExpense, deleteIncome, deleteExpense, updateIncome, updateExpense, getOptionsRealtime } from "@/lib/firestore";
import type { Income, Expense, OptionItem } from "@/lib/definitions";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/database";

export type DisplayTransaction = (Income | Expense) & { id: string; unit?: string; isPartyReceipt?: boolean };

type EntryTypeKey = 'Buy' | 'Sale' | 'Use' | 'Extra Receive' | 'Loss';

const TABS: { key: EntryTypeKey; label: string }[] = [
  { key: 'Buy', label: 'PURCHASE' },
  { key: 'Sale', label: 'SALE' },
  { key: 'Use', label: 'USE' },
  { key: 'Extra Receive', label: 'EXTRA' },
  { key: 'Loss', label: 'LOSS' },
];

export default function StockManagementClient() {
  const { toast } = useToast();
  const globalData = useGlobalData();

  // Active Type Tab
  const [activeTab, setActiveTab] = useState<EntryTypeKey>('Buy');

  // Form State
  const [selectedDate, setSelectedDate] = useState<Date | string>(new Date());
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("VARDANA");
  const [rate, setRate] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [selectedUnit, setSelectedUnit] = useState("Bag");
  const [isPartyReceipt, setIsPartyReceipt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Variety lists
  const [dbVarieties, setDbVarieties] = useState<{ id: string, name: string }[]>([]);
  const [varietyOptions, setVarietyOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const unsub = getOptionsRealtime("varieties", (data) => {
      setDbVarieties(data);
      setVarietyOptions(data.map(v => ({ value: v.name, label: v.name })));
    }, (err) => {
      console.error("Error fetching varieties:", err);
    });
    return () => unsub();
  }, []);

  // Filter stock transactions
  const stockTypes = ['Buy', 'Sale', 'Loss', 'Use', 'Extra Receive'];
  
  const allStockTransactions: DisplayTransaction[] = useMemo(() => {
    const incomeArray = globalData.incomes || [];
    const expensesArray = globalData.expenses || [];
    const filtered = [...incomeArray, ...expensesArray]
      .filter(t => !t.isDeleted && stockTypes.includes(t.entryType || ''))
      .map(t => ({
        ...t,
        unit: (t as any).unit || "Bag",
        isPartyReceipt: true,
      }));

    return filtered.sort((a, b) => {
      const dateComp = (b.date || '').localeCompare(a.date || '');
      if (dateComp !== 0) return dateComp;
      return (b.transactionId || '').localeCompare(a.transactionId || '');
    });
  }, [globalData.incomes, globalData.expenses]);

  // Filter list by active sub-tab (Purchase, Sale, Use, Extra, Loss)
  const filteredStockTransactions = useMemo(() => {
    return allStockTransactions.filter(t => t.entryType === activeTab);
  }, [allStockTransactions, activeTab]);

  // Serial Number Logic (starts with ST-)
  const nextSrNo = useMemo(() => {
    if (editingId) {
      const editingTx = allStockTransactions.find(t => t.id === editingId);
      if (editingTx) return editingTx.transactionId || "ST-0001";
    }
    const stockTxs = allStockTransactions.filter(t => t.transactionId && t.transactionId.startsWith("ST-"));
    if (stockTxs.length === 0) return "ST-0001";
    let maxNum = 0;
    stockTxs.forEach(t => {
      const numPart = t.transactionId.replace("ST-", "");
      const num = parseInt(numPart);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `ST-${String(maxNum + 1).padStart(4, "0")}`;
  }, [allStockTransactions, editingId]);

  // Load accounts from Dexie
  const allAccounts = useLiveQuery(() => db?.accounts.toArray()) || [];

  // Party Options from global ledger accounts & existing transaction names
  const partyOptions = useMemo(() => {
    const names = new Set<string>();
    allAccounts.forEach(acc => {
      if (acc.name) names.add(toTitleCase(acc.name.trim()));
    });
    allStockTransactions.forEach(t => {
      if (t.payee) names.add(toTitleCase(t.payee.trim()));
    });
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        value: name,
        label: name,
      }));
  }, [allStockTransactions, allAccounts]);

  // Variety Dropdown Options
  const finalVarietyOptions = useMemo(() => {
    const items = new Set<string>();
    items.add("VARDANA");
    varietyOptions.forEach(opt => {
      if (opt.value) items.add(opt.value);
    });
    allStockTransactions.forEach(t => {
      if (t.variety) items.add(t.variety);
    });
    return Array.from(items)
      .sort((a, b) => a.localeCompare(b))
      .map(v => ({ value: v, label: v }));
  }, [varietyOptions, allStockTransactions]);

  // Total Amount Calculation
  const totalAmount = useMemo(() => {
    const r = Number(rate) || 0;
    const q = Number(quantity) || 0;
    return Math.round(r * q * 100) / 100;
  }, [rate, quantity]);

  // Reset form helper
  const handleReset = useCallback(() => {
    setEditingId(null);
    setRate("");
    setQuantity("");
    setIsPartyReceipt(false);
    setSelectedParty("");
    setSelectedDate(new Date());
  }, []);

  // Save / Update logic
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) {
      toast({ title: "Error", description: "Please select a party", variant: "destructive" });
      return;
    }
    if (!selectedVariety) {
      toast({ title: "Error", description: "Please select a variety", variant: "destructive" });
      return;
    }
    if (!rate || Number(rate) <= 0) {
      toast({ title: "Error", description: "Please enter a valid rate", variant: "destructive" });
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      toast({ title: "Error", description: "Please enter a valid quantity", variant: "destructive" });
      return;
    }

    const formattedDate = selectedDate instanceof Date 
      ? format(selectedDate, "yyyy-MM-dd") 
      : selectedDate;

    // Map active Tab to backend Transaction Type
    // Buy / Use / Loss -> Expense
    // Sale / Extra Receive -> Income
    const txType = ['Sale', 'Extra Receive'].includes(activeTab) ? 'Income' : 'Expense';
    const isInternal = ['Loss', 'Use'].includes(activeTab);

    setIsSaving(true);
    try {
      const entryData = {
        transactionId: nextSrNo,
        date: formattedDate,
        transactionType: txType,
        entryType: activeTab,
        category: 'Inventory',
        subCategory: 'Stock Management',
        amount: totalAmount,
        rate: Number(rate),
        quantity: Number(quantity),
        variety: selectedVariety,
        payee: toTitleCase(selectedParty),
        unit: selectedUnit,
        isPartyReceipt: true,
        isInternal: isInternal,
        status: 'Paid' as const,
        paymentMethod: 'Other' as const,
        description: `Stock ${activeTab}: ${selectedVariety} (${quantity} ${selectedUnit} @ ${rate})`,
      };

      if (editingId) {
        // Since editing might switch transactionType (e.g. Purchase to Sale),
        // we might need to delete old one if type changed, or update directly.
        const existingTx = allStockTransactions.find(t => t.id === editingId);
        if (existingTx && existingTx.transactionType !== txType) {
          // Delete old one
          if (existingTx.transactionType === 'Income') {
            await deleteIncome(editingId);
          } else {
            await deleteExpense(editingId);
          }
          // Add new one
          if (txType === 'Income') {
            await addIncome(entryData as any);
          } else {
            await addExpense(entryData as any);
          }
        } else {
          // Update directly
          if (txType === 'Income') {
            await updateIncome(editingId, entryData as any);
          } else {
            await updateExpense(editingId, entryData as any);
          }
        }
        toast({ title: "Success", description: "Stock entry updated successfully" });
      } else {
        if (txType === 'Income') {
          await addIncome(entryData as any);
        } else {
          await addExpense(entryData as any);
        }
        toast({ title: "Success", description: "Stock entry added successfully" });
      }

      handleReset();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save stock entry", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Edit action
  const handleEdit = (record: DisplayTransaction) => {
    setEditingId(record.id);
    setSelectedDate(record.date || new Date());
    setSelectedParty(record.payee || "");
    setSelectedVariety(record.variety || "VARDANA");
    setRate(record.rate || "");
    setQuantity(record.quantity || "");
    setSelectedUnit(record.unit || "Bag");
    setIsPartyReceipt(!!record.isPartyReceipt);
    setActiveTab(record.entryType as EntryTypeKey || 'Buy');
  };

  // Delete action
  const handleDelete = async (record: DisplayTransaction) => {
    const isConfirmed = await confirm(`Are you sure you want to delete stock entry ${record.transactionId}?`, {
      title: "Confirm Deletion",
      variant: "destructive",
      confirmText: "Delete",
      cancelText: "Cancel"
    });

    if (!isConfirmed) return;

    try {
      if (record.transactionType === 'Income') {
        await deleteIncome(record.id);
      } else {
        await deleteExpense(record.id);
      }
      toast({ title: "Success", description: "Stock entry deleted successfully" });
      if (editingId === record.id) {
        handleReset();
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
    }
  };

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Entry Type Sub-Tabs */}
        <div className="flex gap-2">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (!editingId) {
                    handleReset();
                  }
                }}
                className={cn(
                  "px-4 py-1.5 text-xs font-black rounded-md tracking-wider transition-all shadow-sm uppercase border",
                  active
                    ? "bg-purple-950 text-white border-purple-950"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form panel */}
        <Card className="border-slate-200 shadow-sm bg-slate-100/70 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-slate-200/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
              {editingId ? "Edit Stock Entry" : "New Stock Entry"}
            </CardTitle>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Sr No: <span className="text-purple-700 font-extrabold text-sm">{nextSrNo}</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                {/* DATE */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</Label>
                  <SmartDatePicker
                    value={selectedDate}
                    onChange={(val) => setSelectedDate(val instanceof Date ? val : String(val))}
                    className="h-9 w-full bg-white border border-slate-200 text-black font-bold focus-visible:ring-purple-500 rounded-md"
                  />
                </div>

                {/* SELECT PARTY */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Party</Label>
                    <button
                      type="button"
                      onClick={() => {
                        const btn = document.querySelector('[title="Add New Party/Account (Global)"]') as HTMLButtonElement | null;
                        if (btn) btn.click();
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 hover:text-purple-950 transition-colors uppercase"
                    >
                      + Add Party
                    </button>
                  </div>
                  <CustomDropdown
                    options={partyOptions}
                    value={selectedParty}
                    onChange={setSelectedParty}
                    placeholder="Choose party..."
                    searchPlaceholder="Search Party..."
                    showSearch={true}
                    className="bg-white border-slate-200"
                  />
                </div>

                {/* VARIETY */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Variety</Label>
                  <CustomDropdown
                    options={finalVarietyOptions}
                    value={selectedVariety}
                    onChange={setSelectedVariety}
                    placeholder="Select variety..."
                    searchPlaceholder="Search variety..."
                    showSearch={true}
                    className="bg-white border-slate-200"
                  />
                </div>

                {/* RATE */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="h-9 text-xs bg-white border border-slate-200 text-black font-bold focus-visible:ring-purple-500"
                    required
                  />
                </div>

                {/* QUANTITY */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Quantity</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="0"
                    className="h-9 text-xs bg-white border border-slate-200 text-black font-bold focus-visible:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                {/* UNIT */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</Label>
                  <CustomDropdown
                    options={[
                      { value: "Kg", label: "Kg" },
                      { value: "Bag", label: "Bag" },
                      { value: "Qtl", label: "Qtl" },
                      { value: "Piece", label: "Piece" },
                    ]}
                    value={selectedUnit}
                    onChange={setSelectedUnit}
                    placeholder="Select unit..."
                    className="bg-white border-slate-200"
                  />
                </div>

                {/* TOTAL AMOUNT */}
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Amount</Label>
                  <Input
                    type="text"
                    value={totalAmount}
                    disabled
                    className="h-9 text-xs bg-slate-100 border border-slate-200 text-purple-950 font-black cursor-not-allowed shadow-inner"
                  />
                </div>
                {/* Spacer */}
                <div className="hidden md:block"></div>

                {/* SAVE BUTTONS */}
                <div className="md:col-span-2 flex gap-2 pt-5">
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleReset}
                      className="h-9 w-full border-slate-300 text-slate-700 font-bold bg-white"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="h-9 w-full bg-purple-950 hover:bg-purple-900 text-white font-black text-xs uppercase tracking-wider rounded shadow-md"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                    {editingId ? "Update" : "Save Entry"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Stock List Table */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Stock Entries list ({filteredStockTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-4">Sr No</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Party</th>
                  <th className="py-2.5 px-4">Variety</th>
                  <th className="py-2.5 px-4 text-right">Rate</th>
                  <th className="py-2.5 px-4 text-right">Quantity</th>
                  <th className="py-2.5 px-4">Unit</th>
                  <th className="py-2.5 px-4 text-right">Total Amount</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStockTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                      No stock entries recorded
                    </td>
                  </tr>
                ) : (
                  filteredStockTransactions.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors">
                      <td className="py-2.5 px-4 font-black text-purple-700">{record.transactionId}</td>
                      <td className="py-2.5 px-4">{record.date}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{record.payee}</td>
                      <td className="py-2.5 px-4">{record.variety}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{record.rate}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{record.quantity}</td>
                      <td className="py-2.5 px-4">{record.unit}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-purple-950 font-mono">{formatCurrency(record.amount)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(record)}
                            className="h-7 px-2 text-purple-700 hover:text-purple-900 hover:bg-purple-50"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(record)}
                            className="h-7 px-2 text-rose-600 hover:text-rose-900 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

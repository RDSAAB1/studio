"use client";

import { useState, useMemo, useEffect } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from "dexie-react-hooks";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/database";
import { addSupplier, deleteSupplier, updateSupplier, getOptionsRealtime } from "@/lib/firestore";
import type { Customer } from "@/lib/definitions";
import { format } from "date-fns";

export function StockPurchaseTab() {
  const { toast } = useToast();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Load varieties options in real-time
  const [varietyOptions, setVarietyOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    const unsub = getOptionsRealtime(
      "varieties",
      (options) => {
        setVarietyOptions(
          options.map((opt) => ({ value: opt.name, label: opt.name }))
        );
      },
      (err) => console.error(err)
    );
    return () => unsub();
  }, []);

  // Load all suppliers to calculate serial number and show table
  const allSuppliers = useLiveQuery(() => db?.suppliers.toArray()) || [];
  
  // Filter stock suppliers (where serial starts with ST-)
  const stockSuppliers = useMemo(() => {
    return allSuppliers.filter(s => s.srNo && s.srNo.startsWith("ST-"))
      .sort((a, b) => (b.srNo || "").localeCompare(a.srNo || ""));
  }, [allSuppliers]);

  // Load accounts for party dropdown
  const allAccounts = useLiveQuery(() => db?.accounts.toArray()) || [];
  const partyOptions = useMemo(() => {
    return allAccounts
      .map(acc => ({ value: acc.name, label: acc.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allAccounts]);

  // Form State
  const [selectedDate, setSelectedDate] = useState<Date | string>(todayStr);
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedVariety, setSelectedVariety] = useState("VARDANA");
  const [rate, setRate] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [selectedUnit, setSelectedUnit] = useState("BAG");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [isPartyReceipt, setIsPartyReceipt] = useState(false);

  // Calculate Next Serial Number
  const nextSrNo = useMemo(() => {
    if (isEditingId) {
      const editingRecord = stockSuppliers.find(s => s.id === isEditingId);
      return editingRecord?.srNo || "ST-0001";
    }
    if (stockSuppliers.length === 0) return "ST-0001";
    let maxNum = 0;
    stockSuppliers.forEach(s => {
      const numPart = s.srNo.replace("ST-", "");
      const num = parseInt(numPart);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return `ST-${String(maxNum + 1).padStart(4, "0")}`;
  }, [stockSuppliers, isEditingId]);

  // Calculate Total Amount
  const totalAmount = useMemo(() => {
    const r = Number(rate) || 0;
    const q = Number(quantity) || 0;
    return Math.round(r * q * 100) / 100;
  }, [rate, quantity]);

  // Handle Save
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

    setIsSaving(true);
    try {
      const documentId = isEditingId || nextSrNo;
      const entryData: Customer = {
        id: documentId,
        srNo: nextSrNo,
        date: formattedDate,
        name: selectedParty,
        variety: selectedVariety,
        rate: Number(rate),
        grossWeight: Number(quantity),
        teirWeight: 0,
        weight: Number(quantity),
        kartaPercentage: 0,
        kartaWeight: 0,
        kartaAmount: 0,
        netWeight: Number(quantity),
        labouryRate: 0,
        labouryAmount: 0,
        brokerageRate: 0,
        brokerageAmount: 0,
        kanta: 0,
        amount: totalAmount,
        netAmount: totalAmount,
        originalNetAmount: totalAmount,
        paymentType: "Full",
        receiptType: "Cash",
        term: "0",
        dueDate: formattedDate,
        customerId: `cust_${Date.now()}`,
        so: "",
        address: "",
        contact: "",
        vehicleNo: "",
        unit: selectedUnit,
        isPartyReceipt: isPartyReceipt,
      };

      if (isEditingId) {
        await updateSupplier(isEditingId, entryData);
        toast({ title: "Success", description: "Stock entry updated successfully" });
      } else {
        await addSupplier(entryData);
        toast({ title: "Success", description: "Stock entry added successfully" });
      }

      // Reset Form
      setRate("");
      setQuantity("");
      setIsPartyReceipt(false);
      setIsEditingId(null);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save stock entry", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (record: Customer) => {
    setIsEditingId(record.id);
    setSelectedDate(record.date || todayStr);
    setSelectedParty(record.name || "");
    setSelectedVariety(record.variety || "VARDANA");
    setRate(record.rate || "");
    setQuantity(record.grossWeight || "");
    setSelectedUnit(record.unit || "BAG");
    setIsPartyReceipt(!!record.isPartyReceipt);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this stock entry?")) {
      try {
        await deleteSupplier(id);
        toast({ title: "Success", description: "Stock entry deleted successfully" });
        if (isEditingId === id) {
          setIsEditingId(null);
          setRate("");
          setQuantity("");
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete stock entry", variant: "destructive" });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm bg-white/70 backdrop-blur-md">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-black text-slate-800 uppercase tracking-wider">
            {isEditingId ? `Edit Stock Entry (${nextSrNo})` : "New Stock Entry"}
          </CardTitle>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Sr No: <span className="text-purple-700 font-extrabold text-sm">{nextSrNo}</span>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date</Label>
              <SmartDatePicker
                value={selectedDate}
                onChange={(val) => setSelectedDate(val instanceof Date ? val : String(val))}
                className="h-9 w-full bg-slate-50 border border-slate-200 text-black font-bold focus-visible:ring-purple-500"
              />
            </div>

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
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Variety</Label>
              <CustomDropdown
                options={varietyOptions}
                value={selectedVariety}
                onChange={setSelectedVariety}
                placeholder="Select variety..."
                searchPlaceholder="Search variety..."
                showSearch={true}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Rate</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
                placeholder="0.00"
                className="h-9 text-xs bg-slate-50 border border-slate-200 text-black font-bold focus-visible:ring-purple-500"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Quantity</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : parseInt(e.target.value))}
                placeholder="0"
                className="h-9 text-xs bg-slate-50 border border-slate-200 text-black font-bold focus-visible:ring-purple-500"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unit</Label>
              <CustomDropdown
                options={[
                  { value: "KG", label: "Kg" },
                  { value: "BAG", label: "Bag" },
                  { value: "QTL", label: "Qtl" },
                  { value: "PIECE", label: "Piece" },
                ]}
                value={selectedUnit}
                onChange={setSelectedUnit}
                placeholder="Select unit..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Total Amount</Label>
              <Input
                type="text"
                value={totalAmount}
                disabled
                className="h-9 text-xs bg-slate-100 border border-slate-200 text-purple-950 font-black cursor-not-allowed shadow-inner"
              />
            </div>

            <div className="flex items-center space-x-2 pb-2 h-9">
              <Switch
                id="stock-is-party-receipt"
                checked={isPartyReceipt}
                onCheckedChange={setIsPartyReceipt}
              />
              <Label htmlFor="stock-is-party-receipt" className="text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer select-none">
                Party Receipt
              </Label>
            </div>

            <div className="flex gap-2">
              {isEditingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingId(null);
                    setRate("");
                    setQuantity("");
                  }}
                  className="h-9 w-full border-slate-300 text-slate-700 font-bold"
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
                {isEditingId ? "Update" : "Save Entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Stock List Table */}
      <Card className="border-slate-200 shadow-sm bg-white/70 backdrop-blur-md">
        <CardHeader className="pb-2 border-b border-slate-100">
          <CardTitle className="text-base font-black text-slate-800 uppercase tracking-wider">
            Stock Entries list ({stockSuppliers.length})
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
              {stockSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    No stock entries recorded
                  </td>
                </tr>
              ) : (
                stockSuppliers.map((record) => (
                  <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors">
                    <td className="py-2.5 px-4 font-black text-purple-700">{record.srNo}</td>
                    <td className="py-2.5 px-4">{record.date}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{record.name}</td>
                    <td className="py-2.5 px-4">{record.variety}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{record.rate}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{record.grossWeight}</td>
                    <td className="py-2.5 px-4">{record.unit}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-purple-950 font-mono">{record.netAmount}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(record)}
                          className="h-7 px-2 text-purple-700 hover:text-purple-900 hover:bg-purple-50"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(record.id)}
                          className="h-7 px-2 text-rose-600 hover:text-rose-900 hover:bg-rose-50"
                        >
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
  );
}

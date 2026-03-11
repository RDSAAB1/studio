"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/database";
import { getOptionsRealtime } from "@/lib/firestore";

const hasDb = () => typeof window !== "undefined" && db;
import type { InventoryAddEntry, OptionItem } from "@/lib/definitions";
import { format } from "date-fns";
import { toTitleCase } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Settings } from "lucide-react";
import { OptionsManagerDialog } from "@/components/sales/options-manager-dialog";
import { Save, RotateCcw, Edit, Trash2, Loader2 } from "lucide-react";

const generateId = () => `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export default function InventoryAddPage() {
  const { toast } = useToast();
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [isVarietyDialogOpen, setIsVarietyDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [varietyFilter, setVarietyFilter] = useState<string>("all");

  const [form, setForm] = useState({
    date: new Date(),
    variety: "",
    rate: 0,
    bagsQuantity: 0,
    bagsWeight: 0,
  });

  const quantity = useMemo(
    () => form.bagsQuantity * form.bagsWeight,
    [form.bagsQuantity, form.bagsWeight]
  );
  const amount = useMemo(
    () => form.rate * form.bagsQuantity,
    [form.rate, form.bagsQuantity]
  );

  useEffect(() => {
    const unsub = getOptionsRealtime("varieties", setVarietyOptions, () => {});
    return () => unsub();
  }, []);

  const entries = useLiveQuery(
    async () => {
      if (!hasDb()) return [];
      try {
        return await db!.inventoryAddEntries.toArray();
      } catch {
        return [];
      }
    },
    []
  );

  const filteredEntries = useMemo(() => {
    const list = entries ?? [];
    if (varietyFilter === "all") return list;
    return list.filter(
      (e) => toTitleCase(e.variety) === toTitleCase(varietyFilter)
    );
  }, [entries, varietyFilter]);

  const summaryByVariety = useMemo(() => {
    const list = entries ?? [];
    const map = new Map<
      string,
      { bags: number; weight: number; quantity: number; amount: number }
    >();
    for (const e of list) {
      const key = toTitleCase(e.variety) || "Unknown";
      const prev = map.get(key) ?? {
        bags: 0,
        weight: 0,
        quantity: 0,
        amount: 0,
      };
      map.set(key, {
        bags: prev.bags + e.bagsQuantity,
        weight: prev.weight + e.bagsWeight * e.bagsQuantity,
        quantity: prev.quantity + e.quantity,
        amount: prev.amount + e.amount,
      });
    }
    return Array.from(map.entries()).map(([variety, data]) => ({
      variety,
      ...data,
    }));
  }, [entries]);

  const handleSave = async () => {
    if (!form.variety?.trim()) {
      toast({ title: "Variety select karein", variant: "destructive" });
      return;
    }
    if (form.bagsQuantity <= 0 || form.bagsWeight <= 0) {
      toast({
        title: "Bags Quantity aur Bags Weight 0 se zyada hona chahiye",
        variant: "destructive",
      });
      return;
    }

    const dateStr = format(form.date, "yyyy-MM-dd");
    const entry: InventoryAddEntry = {
      id: editingId ?? generateId(),
      date: dateStr,
      variety: form.variety.trim(),
      rate: form.rate,
      bagsQuantity: form.bagsQuantity,
      bagsWeight: form.bagsWeight,
      quantity,
      amount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (!hasDb()) throw new Error("Database not ready");
      await db!.inventoryAddEntries.put(entry);
      toast({ title: editingId ? "Entry update ho gayi" : "Entry save ho gayi", variant: "success" });
      handleClear();
    } catch (err) {
      toast({ title: "Save fail", variant: "destructive" });
    }
  };

  const handleClear = () => {
    setForm({
      date: new Date(),
      variety: "",
      rate: 0,
      bagsQuantity: 0,
      bagsWeight: 0,
    });
    setEditingId(null);
  };

  const handleEdit = (entry: InventoryAddEntry) => {
    setForm({
      date: new Date(entry.date),
      variety: entry.variety,
      rate: entry.rate,
      bagsQuantity: entry.bagsQuantity,
      bagsWeight: entry.bagsWeight,
    });
    setEditingId(entry.id);
  };

  const handleDelete = async (id: string) => {
    const { confirm } = await import("@/lib/confirm-dialog");
    const ok = await confirm("Kya aap is entry ko delete karna chahte hain?", {
      title: "Delete Confirm",
      variant: "destructive",
      confirmText: "Delete",
    });
    if (ok) {
      try {
        if (!hasDb()) throw new Error("Database not ready");
        await db!.inventoryAddEntries.delete(id);
        toast({ title: "Entry delete ho gayi", variant: "success" });
        if (editingId === id) handleClear();
      } catch {
        toast({ title: "Delete fail", variant: "destructive" });
      }
    }
  };

  const handleAddOption = async (
    collectionName: string,
    optionData: { name: string }
  ) => {
    const { addOption } = await import("@/lib/firestore");
    try {
      await addOption(collectionName, optionData);
    } catch {
      toast({ title: "Variety add fail", variant: "destructive" });
    }
  };

  const handleUpdateOption = async (
    collectionName: string,
    id: string,
    optionData: { name: string }
  ) => {
    const { updateOption } = await import("@/lib/firestore");
    try {
      await updateOption(collectionName, id, optionData);
    } catch {
      toast({ title: "Variety update fail", variant: "destructive" });
    }
  };

  const handleDeleteOption = async (
    collectionName: string,
    id: string,
    name: string
  ) => {
    const { deleteOption } = await import("@/lib/firestore");
    try {
      await deleteOption(collectionName, id, name);
    } catch {
      toast({ title: "Variety delete fail", variant: "destructive" });
    }
  };

  const varietyList = useMemo(
    () => [...new Set((entries ?? []).map((e) => toTitleCase(e.variety)))].sort(),
    [entries]
  );

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Inventory Add</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <SmartDatePicker
                value={form.date}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    date: v instanceof Date ? v : new Date(v || ""),
                  }))
                }
                placeholder="Select date"
                inputClassName="h-9 text-sm"
                buttonClassName="h-9 w-9"
                returnDate
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-2">
                Variety
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsVarietyDialogOpen(true)}
                  className="h-5 w-5 shrink-0"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </Label>
              <CustomDropdown
                options={varietyOptions.map((v) => ({
                  value: v.name,
                  label: String(v.name).toUpperCase(),
                }))}
                value={form.variety}
                onChange={(v) => setForm((f) => ({ ...f, variety: v || "" }))}
                onAdd={(n) => handleAddOption("varieties", { name: n })}
                placeholder="Select variety..."
                maxRows={5}
                showScrollbar
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Rate</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.rate || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rate: Number(e.target.value) || 0 }))
                }
                placeholder="Rate"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bags Quantity</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={form.bagsQuantity || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bagsQuantity: Number(e.target.value) || 0,
                  }))
                }
                placeholder="Bags"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Bags Weight</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.bagsWeight || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    bagsWeight: Number(e.target.value) || 0,
                  }))
                }
                placeholder="Bags Weight"
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Quantity (auto)</Label>
              <Input
                type="text"
                value={quantity.toFixed(2)}
                readOnly
                className="h-9 bg-muted"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Amount (auto)</Label>
              <Input
                type="text"
                value={amount.toFixed(2)}
                readOnly
                className="h-9 bg-muted"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Entries</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Variety Filter:</Label>
            <Select value={varietyFilter} onValueChange={setVarietyFilter}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All varieties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All varieties</SelectItem>
                {varietyList.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Bags Qty</TableHead>
                  <TableHead className="text-right">Bags Wt</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries === undefined && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {filteredEntries?.length === 0 && entries !== undefined && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center h-24">
                      Koi entry nahi.
                    </TableCell>
                  </TableRow>
                )}
                {filteredEntries?.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{format(new Date(e.date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{toTitleCase(e.variety)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {e.rate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {e.bagsQuantity}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {e.bagsWeight.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {e.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ₹{e.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(e)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary (Variety Wise)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {summaryByVariety.map((s) => (
              <Card key={s.variety} className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.variety}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Bags:</span>
                    <span className="font-medium">{s.bags}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Weight:</span>
                    <span className="font-medium">{s.weight.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-medium">{s.quantity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span className="font-medium">₹{s.amount.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

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

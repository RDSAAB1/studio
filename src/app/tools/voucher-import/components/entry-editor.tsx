"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, RefreshCw } from "lucide-react";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import type { CombinedEntry } from "../types";

interface EntryEditorProps {
  entry: CombinedEntry;
  onFieldChange: (field: keyof CombinedEntry, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export const EntryEditor: React.FC<EntryEditorProps> = ({
  entry,
  onFieldChange,
  onSave,
  onCancel,
  isSaving,
}) => {
  if (!entry.id) return null;

  return (
    <Card className="border-0 shadow-2xl bg-card ring-1 ring-border/50">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center justify-between">
          Record Correction
          <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md">ID: {entry.voucherNo || "TEMP"}</span>
        </CardTitle>
        <CardDescription className="text-xs">
          Modify the parsed fields below and save to update Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 grid gap-6 md:grid-cols-4">
        {/* Farmer Info */}
        <div className="md:col-span-2 grid gap-4 p-4 rounded-xl bg-muted/20 border border-border/30">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pb-2 border-b border-border/30">Producer Profile</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Farmer Name</Label>
              <Input value={entry.sellerName} onChange={(e) => onFieldChange("sellerName", e.target.value)} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Father's Name</Label>
              <Input value={entry.fatherName || ""} onChange={(e) => onFieldChange("fatherName", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Village / Address</Label>
              <Input value={entry.village || ""} onChange={(e) => onFieldChange("village", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mobile No</Label>
              <Input value={entry.mobile || ""} onChange={(e) => onFieldChange("mobile", e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>
        </div>

        {/* Transaction Info */}
        <div className="md:col-span-2 grid gap-4 p-4 rounded-xl bg-muted/20 border border-border/30">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pb-2 border-b border-border/30">Contract Details</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">6R Date</Label>
              <SmartDatePicker value={entry.purchaseDate} onChange={(next) => onFieldChange("purchaseDate", next)} inputClassName="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">6R Number</Label>
              <Input value={entry.voucherNo || ""} onChange={(e) => onFieldChange("voucherNo", e.target.value)} className="h-8 text-xs font-black uppercase" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gata / Khasra No</Label>
              <Input value={entry.khasraNo || ""} onChange={(e) => onFieldChange("khasraNo", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity (Qtl)</Label>
              <Input type="number" value={entry.quantityQtl} onChange={(e) => onFieldChange("quantityQtl", parseFloat(e.target.value))} className="h-8 text-xs font-bold" />
            </div>
          </div>
        </div>

        {/* Financial Info */}
        <div className="md:col-span-4 grid gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary pb-2 border-b border-primary/20">Settlement & Disbursement</h4>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate</Label>
              <Input type="number" value={entry.ratePerQtl} onChange={(e) => onFieldChange("ratePerQtl", parseFloat(e.target.value))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gross Amt</Label>
              <Input type="number" value={entry.grossAmount} onChange={(e) => onFieldChange("grossAmount", parseFloat(e.target.value))} className="h-8 text-xs font-black" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Mandi Fee</Label>
              <Input type="number" value={entry.totalCharges} onChange={(e) => onFieldChange("totalCharges", parseFloat(e.target.value))} className="h-8 text-xs font-bold text-blue-600" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Date</Label>
              <SmartDatePicker value={entry.paymentDate} onChange={(next) => onFieldChange("paymentDate", next)} inputClassName="h-8 text-xs" />
            </div>
             <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account Number</Label>
              <Input value={entry.bankAccount || ""} onChange={(e) => onFieldChange("bankAccount", e.target.value)} className="h-8 text-xs font-bold" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">IFSC Code</Label>
              <Input value={entry.ifsc || ""} onChange={(e) => onFieldChange("ifsc", e.target.value.toUpperCase())} className="h-8 text-xs uppercase" />
            </div>
             <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">UTR / Transaction Ref</Label>
              <Input value={entry.transactionNumber || ""} onChange={(e) => onFieldChange("transactionNumber", e.target.value)} className="h-8 text-xs font-bold" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-3 bg-muted/30 pt-4 pb-4">
        <Button variant="ghost" onClick={onCancel} className="text-xs font-bold uppercase tracking-widest h-8" disabled={isSaving}>Discard</Button>
        <Button onClick={onSave} className="h-9 px-8 text-xs font-black uppercase tracking-widest shadow-blue-500/20 shadow-lg" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Updating..." : "Commit Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
};

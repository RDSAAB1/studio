"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import type { LedgerAccount } from "@/lib/definitions";
import { format } from "date-fns";

interface EntryFormData {
  date: string;
  particulars: string;
  debit: string;
  credit: string;
}

interface EntryFormProps {
  entryForm: EntryFormData;
  onEntryFormChange: (form: EntryFormData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  activeAccount: LedgerAccount | null;
  saving: boolean;
  accounts: LedgerAccount[];
  activeAccountId: string | null;
  linkAccountId: string;
  onLinkAccountChange: (value: string) => void;
  linkMode: "mirror" | "same";
  onLinkModeChange: (mode: "mirror" | "same") => void;
}

export const EntryForm: React.FC<EntryFormProps> = ({
  entryForm,
  onEntryFormChange,
  onSubmit,
  activeAccount,
  saving,
  accounts,
  activeAccountId,
  linkAccountId,
  onLinkAccountChange,
  linkMode,
  onLinkModeChange,
}) => {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="space-y-1">
        <Label htmlFor="entryDate" className="text-[11px] font-medium">Date</Label>
        <SmartDatePicker
          id="entryDate"
          value={entryForm.date}
          onChange={(next) => onEntryFormChange({ ...entryForm, date: typeof next === 'string' ? next : next ? format(next, 'yyyy-MM-dd') : entryForm.date })}
          disabled={!activeAccount || saving}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="entryParticulars" className="text-[11px] font-medium">Particulars</Label>
        <Input
          id="entryParticulars"
          type="text"
          value={entryForm.particulars}
          onChange={(event) =>
            onEntryFormChange({
              ...entryForm,
              particulars: event.target.value.toUpperCase(),
            })
          }
          placeholder="Narration"
          disabled={!activeAccount || saving}
          className="h-7 text-[11px] uppercase"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="entryDebit" className="text-[11px] font-medium">Debit (₹)</Label>
        <Input
          id="entryDebit"
          type="number"
          min="0"
          step="0.01"
          value={entryForm.debit}
          onChange={(event) =>
            onEntryFormChange({ ...entryForm, debit: event.target.value })
          }
          disabled={!activeAccount || saving}
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="entryCredit" className="text-[11px] font-medium">Credit (₹)</Label>
        <Input
          id="entryCredit"
          type="number"
          min="0"
          step="0.01"
          value={entryForm.credit}
          onChange={(event) =>
            onEntryFormChange({ ...entryForm, credit: event.target.value })
          }
          disabled={!activeAccount || saving}
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="linkAccountId" className="text-[11px] font-medium">Linked Account (optional)</Label>
        <div className="flex flex-col gap-2">
          <select
            id="linkAccountId"
            name="linkAccountId"
            value={linkAccountId}
            onChange={(event) => onLinkAccountChange(event.target.value)}
            disabled={!activeAccount || saving || accounts.length <= 1}
            className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">None</option>
            {accounts
              .filter((account) => account.id !== activeAccountId)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>

          {linkAccountId && (
            <div className="flex items-center justify-center gap-2 rounded border border-border bg-muted/40 px-3 py-1.5 text-[11px]">
              <SegmentedSwitch
                checked={linkMode === "same"}
                onCheckedChange={(checked) => onLinkModeChange(checked ? "same" : "mirror")}
                leftLabel="Opposite"
                rightLabel="Same"
                className="w-32"
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={!activeAccount || saving} className="h-8 px-4 text-sm disabled:opacity-60">
          Add Entry
        </Button>
      </div>
    </form>
  );
};

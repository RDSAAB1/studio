"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LedgerAccountInput } from "@/lib/definitions";

interface AccountFormProps {
  newAccount: LedgerAccountInput;
  onAccountChange: (account: LedgerAccountInput) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
  saving: boolean;
  isEdit?: boolean;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  newAccount,
  onAccountChange,
  onSubmit,
  onCancel,
  saving,
  isEdit = false,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card shadow-sm p-4 md:grid-cols-5 animate-in fade-in duration-200"
    >
      <div className="space-y-1">
        <Label htmlFor="accountName" className="text-sm font-medium">Account Name</Label>
        <Input
          id="accountName"
          name="accountName"
          type="text"
          required
          value={newAccount.name}
          onChange={(event) =>
            onAccountChange({ ...newAccount, name: event.target.value })
          }
          placeholder="Enter account name"
          disabled={saving}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="accountAddress" className="text-sm font-medium">Address</Label>
        <Input
          id="accountAddress"
          name="accountAddress"
          type="text"
          value={newAccount.address || ""}
          onChange={(event) =>
            onAccountChange({ ...newAccount, address: event.target.value })
          }
          placeholder="Enter address"
          disabled={saving}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="accountContact" className="text-sm font-medium">Contact Number</Label>
        <Input
          id="accountContact"
          name="accountContact"
          type="text"
          value={newAccount.contact || ""}
          onChange={(event) =>
            onAccountChange({ ...newAccount, contact: event.target.value })
          }
          placeholder="Enter contact number"
          disabled={saving}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="openingBalance" className="text-sm font-medium">Opening Balance (₹)</Label>
        <Input
          id="openingBalance"
          name="openingBalance"
          type="number"
          min="0"
          step="0.01"
          value={newAccount.openingBalance === 0 ? "" : newAccount.openingBalance || ""}
          onChange={(event) =>
            onAccountChange({ ...newAccount, openingBalance: Number(event.target.value) || 0 })
          }
          placeholder="0.00"
          disabled={saving}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="openingBalanceType" className="text-sm font-medium">Balance Type</Label>
        <select
          id="openingBalanceType"
          name="openingBalanceType"
          value={newAccount.openingBalanceType || "Debit"}
          onChange={(event) =>
            onAccountChange({ ...newAccount, openingBalanceType: event.target.value as 'Debit' | 'Credit' })
          }
          disabled={saving}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="Debit">Debit (Dr)</option>
          <option value="Credit">Credit (Cr)</option>
        </select>
      </div>
      <div className="md:col-span-5 flex justify-end gap-3 border-t border-border/50 pt-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {isEdit ? "Save Changes" : "Create Account"}
        </Button>
      </div>
    </form>
  );
};


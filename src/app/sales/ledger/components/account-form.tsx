"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LedgerAccountInput } from "@/lib/definitions";

interface AccountFormProps {
  newAccount: LedgerAccountInput;
  onAccountChange: (account: LedgerAccountInput) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  newAccount,
  onAccountChange,
  onSubmit,
  onCancel,
  saving,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card shadow-sm p-4 md:grid-cols-3"
    >
      <div className="space-y-1">
        <Label className="text-sm font-medium">Account Name</Label>
        <Input
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
        <Label className="text-sm font-medium">Address</Label>
        <Input
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
        <Label className="text-sm font-medium">Contact Number</Label>
        <Input
          type="text"
          value={newAccount.contact || ""}
          onChange={(event) =>
            onAccountChange({ ...newAccount, contact: event.target.value })
          }
          placeholder="Enter contact number"
          disabled={saving}
        />
      </div>
      <div className="md:col-span-3 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>Create Account</Button>
      </div>
    </form>
  );
};


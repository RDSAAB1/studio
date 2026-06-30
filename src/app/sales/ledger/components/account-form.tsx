"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LedgerAccountInput } from "@/lib/definitions";
import { statesAndCodes } from "@/lib/data";

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
  const handleGstinChange = (val: string) => {
    const cleanGst = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
    
    // Validate GST format
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
    let pan = newAccount.pan || "";
    let stateCode = newAccount.stateCode || "";
    let stateName = newAccount.stateName || "";
    
    if (cleanGst.length === 15 && gstRegex.test(cleanGst)) {
      stateCode = cleanGst.slice(0, 2);
      pan = cleanGst.slice(2, 12);
      const state = statesAndCodes.find((s) => s.code === stateCode);
      if (state) {
        stateName = state.name;
      }
    }
    
    onAccountChange({
      ...newAccount,
      gstin: cleanGst,
      pan,
      stateCode,
      stateName
    });
  };

  const handleStateNameChange = (val: string) => {
    const state = statesAndCodes.find((s) => s.name === val);
    const stateCode = state ? state.code : "";
    onAccountChange({
      ...newAccount,
      stateName: val,
      stateCode
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-border bg-card shadow-sm p-4 animate-in fade-in duration-200 space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="accountName" className="text-sm font-medium">Account Name <span className="text-rose-500">*</span></Label>
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
          <Label htmlFor="fatherName" className="text-sm font-medium">Father Name</Label>
          <Input
            id="fatherName"
            name="fatherName"
            type="text"
            value={newAccount.fatherName || ""}
            onChange={(event) =>
              onAccountChange({ ...newAccount, fatherName: event.target.value })
            }
            placeholder="Enter father's name"
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
          <Label htmlFor="accountGstin" className="text-sm font-medium">GSTIN</Label>
          <Input
            id="accountGstin"
            name="accountGstin"
            type="text"
            maxLength={15}
            value={newAccount.gstin || ""}
            onChange={(event) => handleGstinChange(event.target.value)}
            placeholder="Enter GSTIN"
            disabled={saving}
            className="uppercase font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="ledgerStateName" className="text-sm font-medium">State Name</Label>
          <select
            id="ledgerStateName"
            name="ledgerStateName"
            value={newAccount.stateName || ""}
            onChange={(event) => handleStateNameChange(event.target.value)}
            disabled={saving}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select State</option>
            {statesAndCodes.map((s) => (
              <option key={s.code} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ledgerStateCode" className="text-sm font-medium">State Code</Label>
          <Input
            id="ledgerStateCode"
            name="ledgerStateCode"
            type="text"
            readOnly
            value={newAccount.stateCode || ""}
            placeholder="Code"
            className="bg-muted font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ledgerPan" className="text-sm font-medium">PAN Card No.</Label>
          <Input
            id="ledgerPan"
            name="ledgerPan"
            type="text"
            readOnly
            value={newAccount.pan || ""}
            placeholder="PAN"
            className="bg-muted font-mono"
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
      </div>

      <div className="flex justify-end gap-3 border-t border-border/50 pt-3">
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

"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

interface LedgerHeaderProps {
  accountDropdownOptions: Array<{ value: string; label: string; data: any }>;
  activeAccountId: string | null;
  onAccountChange: (value: string | null) => void;
  accountsLength: number;
  showAccountForm: boolean;
  onToggleAccountForm: () => void;
  saving: boolean;
  onPrintLedger: () => void;
  activeAccount: any;
}

export const LedgerHeader: React.FC<LedgerHeaderProps> = ({
  accountDropdownOptions,
  activeAccountId,
  onAccountChange,
  accountsLength,
  showAccountForm,
  onToggleAccountForm,
  saving,
  onPrintLedger,
  activeAccount,
}) => {
  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div
        className={`flex min-w-[300px] flex-1 flex-col flex-shrink-0 ${
          accountsLength === 0 ? "opacity-80" : ""
        }`}
      >
        <CustomDropdown
          options={accountDropdownOptions}
          value={activeAccountId}
          onChange={onAccountChange}
          placeholder="Search account by name, address or contact"
          noItemsPlaceholder={accountsLength === 0 ? "No accounts available. Create one to begin." : "No matching account found."}
          inputClassName="h-10"
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
      <Button
        variant={showAccountForm ? "secondary" : "default"}
        onClick={onToggleAccountForm}
        disabled={saving}
          className="h-10 whitespace-nowrap"
      >
        {showAccountForm ? "Close" : "Open New Account"}
      </Button>
        <Button 
          onClick={onPrintLedger} 
          disabled={!activeAccount} 
          className="h-10 disabled:opacity-60 whitespace-nowrap"
        >
        Print Ledger
      </Button>
      </div>
    </div>
  );
};


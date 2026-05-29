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
  onEditAccount: () => void;
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
  onEditAccount,
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
          searchType="all"
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {activeAccount && !showAccountForm && (
          <Button
            variant="outline"
            onClick={onEditAccount}
            disabled={saving}
            className="h-10 border-primary/20 hover:bg-primary/5 text-primary font-bold whitespace-nowrap animate-in fade-in zoom-in duration-200"
          >
            Edit Account
          </Button>
        )}
        <Button
          variant={showAccountForm ? "secondary" : "default"}
          onClick={onToggleAccountForm}
          disabled={saving}
          className="h-10 font-bold whitespace-nowrap"
        >
          {showAccountForm ? "Close" : "Open New Account"}
        </Button>
        <Button 
          onClick={onPrintLedger} 
          disabled={!activeAccount} 
          className="h-10 disabled:opacity-60 whitespace-nowrap font-bold"
        >
          Print Ledger
        </Button>
      </div>
    </div>
  );
};


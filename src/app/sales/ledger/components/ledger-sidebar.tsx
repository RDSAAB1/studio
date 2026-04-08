import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Plus } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import type { LedgerAccount } from "@/lib/definitions";

interface LedgerSidebarProps {
  accounts: LedgerAccount[];
  activeAccountId: string | null;
  onAccountSelect: (id: string) => void;
  onShowAccountForm: () => void;
  accountDropdownOptions: any[];
}

export const LedgerSidebar: React.FC<LedgerSidebarProps> = ({
  accounts,
  activeAccountId,
  onAccountSelect,
  onShowAccountForm,
  accountDropdownOptions,
}) => {
  return (
    <Card className="h-full border-0 bg-transparent shadow-none">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight">Accounts</CardTitle>
          <Button onClick={onShowAccountForm} variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-4">
          <CustomDropdown
            options={accountDropdownOptions}
            value={activeAccountId || ""}
            onChange={onAccountSelect}
            placeholder="Search accounts..."
            className="w-full"
          />
          
          <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => onAccountSelect(account.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  activeAccountId === account.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="font-semibold text-sm truncate">{toTitleCase(account.name)}</div>
                {account.address && (
                  <div className={`text-[10px] truncate opacity-70 ${activeAccountId === account.id ? "text-primary-foreground" : "text-muted-foreground"}`}>
                    {account.address}
                  </div>
                )}
              </button>
            ))}
            {accounts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm italic">
                No accounts found.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

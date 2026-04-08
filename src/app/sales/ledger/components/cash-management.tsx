import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { CASH_DENOMINATIONS, formatCurrency } from "../utils";
import type { LedgerCashAccount } from "@/lib/definitions";

interface CashManagementProps {
  activeCashAccount: LedgerCashAccount | null;
  cashSummary: any;
  onUpdateCount: (denom: number, index: number, val: string) => void;
  onAddRow: (denom: number) => void;
  onRemoveRow: (denom: number, index: number) => void;
  onReset: () => void;
  onDelete: (id: string) => void;
}

export const CashManagement: React.FC<CashManagementProps> = ({
  activeCashAccount,
  cashSummary,
  onUpdateCount,
  onAddRow,
  onRemoveRow,
  onReset,
  onDelete,
}) => {
  if (!activeCashAccount) return null;

  return (
    <Card className="h-full border-0 bg-transparent shadow-none">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold tracking-tight">
            {activeCashAccount.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={onReset} variant="outline" size="sm" className="h-8 gap-2">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
            <Button onClick={() => onDelete(activeCashAccount.id)} variant="ghost" size="sm" className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CASH_DENOMINATIONS.map((denomination) => {
            const key = denomination.toString();
            const counts = activeCashAccount.noteGroups[key] || [0];
            const stats = cashSummary.denominationTotals[key] || { totalNotes: 0, amount: 0 };

            return (
              <Card key={denomination} className="border border-border/50 bg-card/30 overflow-hidden">
                <CardHeader className="py-3 px-4 bg-accent/20 flex flex-row items-center justify-between border-b border-border/50">
                    <span className="font-bold text-lg">₹{denomination}</span>
                    <Button onClick={() => onAddRow(denomination)} variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    {counts.map((count, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        <Input
                          type="number"
                          value={count || ""}
                          onChange={(e) => onUpdateCount(denomination, index, e.target.value)}
                          className="h-8 text-right font-medium focus:ring-1 focus:ring-primary"
                          placeholder="0"
                        />
                        {counts.length > 1 && (
                          <Button
                            onClick={() => onRemoveRow(denomination, index)}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) || <div className="w-7 h-7" />}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{stats.totalNotes} notes</span>
                    <span className="text-foreground">₹{formatCurrency(stats.amount)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        <Card className="bg-primary/5 border-primary/20 shadow-inner">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest mb-1">Total Notes</p>
                <p className="text-3xl font-black">{cashSummary.totalNotes}</p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-xs font-semibold text-primary/70 uppercase tracking-widest mb-1">Total Amount</p>
                <p className="text-3xl font-black text-primary">₹{formatCurrency(cashSummary.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

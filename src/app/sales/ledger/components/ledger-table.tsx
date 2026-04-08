import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { formatCurrency } from "../utils";
import type { LedgerEntry } from "@/lib/definitions";

interface LedgerTableProps {
  displayEntries: LedgerEntry[];
  editingEntryId: string | null;
  editForm: any;
  setEditForm: (val: any) => void;
  onEdit: (entry: LedgerEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  displayEntries,
  editingEntryId,
  editForm,
  setEditForm,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}) => {
  if (displayEntries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground italic border-2 border-dashed border-border/50 rounded-xl">
        No entries found for this period.
      </div>
    );
  }

  // Helper to group entries by date
  const groups: { date: string; entries: LedgerEntry[] }[] = [];
  let currentGroup: { date: string; entries: LedgerEntry[] } | null = null;
  displayEntries.forEach((entry) => {
    if (!currentGroup || currentGroup.date !== entry.date) {
      currentGroup = { date: entry.date, entries: [] };
      groups.push(currentGroup);
    }
    currentGroup.entries.push(entry);
  });

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border/50">
              <th className="px-4 py-3 text-left font-bold w-[120px]">Date</th>
              <th className="px-4 py-3 text-left font-bold">Particulars</th>
              <th className="px-4 py-3 text-right font-bold w-[130px]">Debit (₹)</th>
              <th className="px-4 py-3 text-right font-bold w-[130px]">Credit (₹)</th>
              <th className="px-4 py-3 text-right font-bold w-[150px]">Balance (₹)</th>
              <th className="px-4 py-3 text-right font-bold w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.date}>
                <tr className="bg-accent/10 border-b border-border/30">
                  <td colSpan={6} className="px-4 py-1.5 font-bold text-xs uppercase tracking-wider text-primary/70">
                    {group.date ? new Date(group.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "No Date"}
                  </td>
                </tr>
                {group.entries.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  const balance = (entry as any).runningBalance ?? entry.balance;

                  return (
                    <tr key={entry.id} className="hover:bg-accent/5 transition-colors border-b border-border/30 last:border-0 group">
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {entry.date ? new Date(entry.date).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Input
                            value={editForm.particulars}
                            onChange={(e) => setEditForm({ ...editForm, particulars: e.target.value })}
                            className="h-8 py-1"
                            autoFocus
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium">{entry.particulars}</span>
                            {entry.remarks && <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{entry.remarks}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editForm.debit}
                            onChange={(e) => setEditForm({ ...editForm, debit: e.target.value })}
                            className="h-8 text-right py-1"
                          />
                        ) : (
                          <span className={entry.debit > 0 ? "text-emerald-500 font-bold" : "text-muted-foreground/30"}>
                            {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editForm.credit}
                            onChange={(e) => setEditForm({ ...editForm, credit: e.target.value })}
                            className="h-8 text-right py-1"
                          />
                        ) : (
                          <span className={entry.credit > 0 ? "text-rose-500 font-bold" : "text-muted-foreground/30"}>
                            {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-black tracking-tight">
                        ₹{formatCurrency(balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button onClick={() => onSaveEdit(entry.id)} variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button onClick={onCancelEdit} variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button onClick={() => onEdit(entry)} variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button onClick={() => onDelete(entry.id)} variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

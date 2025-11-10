
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export const OutstandingEntriesDialog = ({ isOpen, onOpenChange, customerName, entries, selectedIds, onSelect, onSelectAll, onConfirm, onCancel }: any) => {
    const [bulkSrInput, setBulkSrInput] = useState("");
    const [lastBulkResult, setLastBulkResult] = useState<{ matched: number; missing: string[] }>({ matched: 0, missing: [] });

    const normalizeSrNo = (raw: string) => {
        const token = (raw || "").trim().toUpperCase();
        if (!token) return "";
        if (/^S\d+$/.test(token)) {
            const n = token.slice(1);
            return `S${n.padStart(5, '0')}`;
        }
        if (/^\d+$/.test(token)) {
            return `S${token.padStart(5, '0')}`;
        }
        return token;
    };

    const handleBulkAdd = () => {
        const tokens = bulkSrInput.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
        if (tokens.length === 0) {
            setLastBulkResult({ matched: 0, missing: [] });
            return;
        }
        let matched = 0;
        const missing: string[] = [];
        const srToEntry = new Map<string, any>();
        for (const entry of entries) {
            srToEntry.set(String(entry.srNo || '').toUpperCase(), entry);
        }
        for (const raw of tokens) {
            const norm = normalizeSrNo(raw);
            const entry = srToEntry.get(norm);
            if (entry) {
                if (!selectedIds.has(entry.id)) {
                    onSelect(entry.id); // add only if not already selected
                }
                matched += 1;
            } else {
                missing.push(raw);
            }
        }
        setLastBulkResult({ matched, missing });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Outstanding Entries {customerName ? `for ${customerName}` : ''}</DialogTitle>
                    <DialogDescription>
                        Select the entries you want to pay for. You can also paste multiple receipt numbers below (comma or space separated), e.g. "12, 45 S00078 91".
                    </DialogDescription>
                </DialogHeader>
                <div className="px-1 pb-3">
                    <div className="flex gap-2 items-center">
                        <input
                            className="flex-1 h-8 rounded border px-2 text-sm"
                            placeholder="Add by Receipt No (e.g. 12, 45, S00078)"
                            value={bulkSrInput}
                            onChange={(e) => setBulkSrInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleBulkAdd(); } }}
                        />
                        <Button size="sm" variant="outline" onClick={handleBulkAdd}>Add</Button>
                    </div>
                    {(lastBulkResult.matched > 0 || lastBulkResult.missing.length > 0) && (
                        <div className="mt-1 text-xs text-muted-foreground">
                            {lastBulkResult.matched > 0 && <span>Selected {lastBulkResult.matched} receipt(s).</span>}
                            {lastBulkResult.missing.length > 0 && (
                                <span className="ml-2">Not found: {lastBulkResult.missing.join(', ')}</span>
                            )}
                        </div>
                    )}
                </div>
                <ScrollArea className="max-h-[60vh]">
                    <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><Checkbox onCheckedChange={onSelectAll} checked={entries.length > 0 && selectedIds.size === entries.length} /></TableHead>
                        <TableHead>SR No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {entries.map((entry: any) => (
                        <TableRow key={entry.id} data-state={selectedIds.has(entry.id) ? "selected" : ""} onClick={() => onSelect(entry.id)} className="cursor-pointer">
                            <TableCell><Checkbox checked={selectedIds.has(entry.id)} onCheckedChange={() => onSelect(entry.id)} /></TableCell>
                            <TableCell>{entry.srNo}</TableCell>
                            <TableCell>{entry.name}</TableCell>
                            <TableCell>{format(new Date(entry.date), "dd-MMM-yy")}</TableCell>
                            <TableCell>{format(new Date(entry.dueDate), "dd-MMM-yy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                        </TableRow>
                    ))}
                     {entries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                                No outstanding entries found.
                            </TableCell>
                        </TableRow>
                     )}
                    </TableBody>
                </Table>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                    <Button onClick={onConfirm}>Confirm Selection</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

    
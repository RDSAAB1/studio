
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export const OutstandingEntriesDialog = ({ isOpen, onOpenChange, customerName, entries, selectedIds, onSelect, onSelectAll, onConfirm, onCancel }: any) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Outstanding Entries for {customerName}</DialogTitle>
                    <DialogDescription>Select the entries you want to pay for.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><Checkbox onCheckedChange={onSelectAll} checked={entries.length > 0 && selectedIds.size === entries.length} /></TableHead>
                        <TableHead>SR No</TableHead>
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
                            <TableCell>{format(new Date(entry.date), "dd-MMM-yy")}</TableCell>
                            <TableCell>{format(new Date(entry.dueDate), "dd-MMM-yy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                        </TableRow>
                    ))}
                     {entries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
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

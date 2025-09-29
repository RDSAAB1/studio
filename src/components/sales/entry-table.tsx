
"use client";

import { memo } from "react";
import type { Customer } from "@/lib/definitions";
import { format } from "date-fns";
import { toTitleCase, formatCurrency } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Info, Pen, Printer, Trash } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";


export const EntryTable = memo(function EntryTable({ entries, onEdit, onDelete, onShowDetails, selectedIds, onSelectionChange, onPrintRow, entryType = 'Supplier' }: any) {
    
    const handleSelectAll = (checked: boolean) => {
        const allEntryIds = entries.map((c: Customer) => c.id);
        onSelectionChange(checked ? new Set(allEntryIds) : new Set());
    };

    const handleRowSelect = (id: string) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
        } else {
            newSelectedIds.add(id);
        }
        onSelectionChange(newSelectedIds);
    };

    return (
        <Card>
            <CardContent className="p-0">
                <ScrollArea className="h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-3 py-2 text-xs w-10">
                                        <Checkbox
                                        checked={selectedIds.size > 0 && selectedIds.size === entries.length}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all rows"
                                    />
                                </TableHead>
                                <TableHead className="px-3 py-2 text-xs">SR No.</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Date</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Name</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Variety</TableHead>
                                <TableHead className="px-3 py-2 text-xs">Net Weight</TableHead>
                                <TableHead className="text-right px-3 py-2 text-xs">Net Amount</TableHead>
                                <TableHead className="text-center px-3 py-2 text-xs">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry: Customer) => (
                                <TableRow key={entry.id} className="h-12" data-state={selectedIds.has(entry.id) ? 'selected' : ''}>
                                    <TableCell className="px-3 py-1">
                                        <Checkbox
                                            checked={selectedIds.has(entry.id)}
                                            onCheckedChange={() => handleRowSelect(entry.id)}
                                            aria-label={`Select row ${entry.srNo}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono px-3 py-1 text-sm">{entry.srNo}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{format(new Date(entry.date), "dd-MMM-yy")}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{toTitleCase(entry.name)}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{toTitleCase(entry.variety)}</TableCell>
                                    <TableCell className="px-3 py-1 text-sm">{Number(entry.netWeight).toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-semibold px-3 py-1 text-sm">{formatCurrency(Number(entry.netAmount))}</TableCell>
                                    <TableCell className="text-center px-3 py-1">
                                        <div className="flex justify-center items-center gap-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                <Info className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry.id)}>
                                                <Pen className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrintRow && onPrintRow(entry)}>
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                    <Trash className="h-4 w-4 text-destructive" />
                                                </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete the entry for {toTitleCase(entry.name)} (SR No: {entry.srNo}).
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(entry.id)}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    );
});

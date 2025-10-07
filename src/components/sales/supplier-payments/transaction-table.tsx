
"use client";

import React from 'react';
import { format, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, CheckSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Checkbox } from '@/components/ui/checkbox';

export const TransactionTable = ({ suppliers, onShowDetails, selectedIds, onSelectionChange }: any) => {
    
    const handleSelectAll = (checked: boolean) => {
        const allEntryIds = suppliers.filter((s:any) => parseFloat(String(s.netAmount)) > 0).map((c: any) => c.id);
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

    const outstandingSuppliers = suppliers.filter((s:any) => parseFloat(String(s.netAmount)) > 0);

    return (
        <Card className="mt-3">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Outstanding Entries</CardTitle></CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-40">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="p-2 text-xs w-10">
                                        <Checkbox
                                            checked={(selectedIds?.size ?? 0) > 0 && selectedIds.size === outstandingSuppliers.length}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="p-2 text-xs">SR No</TableHead>
                                    <TableHead className="p-2 text-xs">Date</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Original Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Paid Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">CD Amt</TableHead>
                                    <TableHead className="p-2 text-xs text-right">Outstanding</TableHead>
                                    <TableHead className="p-2 text-xs text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliers.map((entry: any) => (
                                    <TableRow key={entry.id} data-state={selectedIds?.has(entry.id) ? 'selected' : ''}>
                                        <TableCell className="p-2">
                                            <Checkbox 
                                                checked={selectedIds?.has(entry.id)} 
                                                onCheckedChange={() => handleRowSelect(entry.id)}
                                                disabled={Number(entry.netAmount) < 1}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs p-2">{entry.srNo}</TableCell>
                                        <TableCell className="p-2 text-xs">{entry.date && isValid(new Date(entry.date)) ? format(new Date(entry.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                        <TableCell className="text-right p-2 text-xs">{formatCurrency(entry.originalNetAmount)}</TableCell>
                                        <TableCell className="text-right p-2 text-xs text-green-600">{formatCurrency(entry.totalPaid || 0)}</TableCell>
                                        <TableCell className="text-right p-2 text-xs text-blue-600">{formatCurrency(entry.totalCd || 0)}</TableCell>
                                        <TableCell className="text-right p-2 text-xs font-semibold">{formatCurrency(Number(entry.netAmount))}</TableCell>
                                        <TableCell className="text-center p-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {suppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground h-24">No transactions found for this supplier.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


"use client";

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const TransactionTable = ({ suppliers, onShowDetails }: any) => {
    return (
        <Card className="mt-3">
            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">All Transactions</CardTitle></CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-96">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="p-2 text-xs">SR No</TableHead>
                                    <TableHead className="p-2 text-xs">Date</TableHead>
                                    <TableHead className="p-2 text-xs">Original Amt</TableHead>
                                    <TableHead className="p-2 text-xs">Outstanding</TableHead>
                                    <TableHead className="p-2 text-xs">Status</TableHead>
                                    <TableHead className="p-2 text-xs text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliers.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono text-xs p-2">{entry.srNo}</TableCell>
                                        <TableCell className="p-2 text-xs">{format(new Date(entry.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="text-right p-2 text-xs">{formatCurrency(entry.originalNetAmount)}</TableCell>
                                        <TableCell className="text-right p-2 text-xs">{formatCurrency(Number(entry.netAmount))}</TableCell>
                                        <TableCell className="p-2 text-xs"><Badge variant={Number(entry.netAmount) < 1 ? 'default' : 'destructive'}>{Number(entry.netAmount) < 1 ? "Paid" : "Outstanding"}</Badge></TableCell>
                                        <TableCell className="text-center p-0">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(entry)}>
                                                <Info className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {suppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground h-24">No transactions found for this supplier.</TableCell>
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

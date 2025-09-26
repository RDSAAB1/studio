
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Expense } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { getExpensesRealtime } from '@/lib/firestore';
import { format } from 'date-fns';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Loader2 } from "lucide-react";

interface PayeeSummary {
    name: string;
    totalPaid: number;
    transactionCount: number;
    transactions: Expense[];
}

export default function PayeeProfileClient() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [selectedPayee, setSelectedPayee] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const unsubExpenses = getExpensesRealtime(setExpenses, console.error);
        return () => unsubExpenses();
    }, []);

    const payeeSummaryMap = useMemo(() => {
        const summary = new Map<string, PayeeSummary>();

        expenses.forEach(expense => {
            const payeeName = toTitleCase(expense.payee);
            if (!summary.has(payeeName)) {
                summary.set(payeeName, {
                    name: payeeName,
                    totalPaid: 0,
                    transactionCount: 0,
                    transactions: [],
                });
            }
            const data = summary.get(payeeName)!;
            data.totalPaid += expense.amount;
            data.transactionCount += 1;
            data.transactions.push(expense);
        });
        
        // Sort transactions for each payee by date
        summary.forEach(data => {
            data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        });

        return summary;
    }, [expenses]);
    
    const payeeOptions = useMemo(() => {
        return Array.from(payeeSummaryMap.keys()).sort().map(name => ({
            value: name,
            label: name
        }));
    }, [payeeSummaryMap]);

    const selectedPayeeData = selectedPayee ? payeeSummaryMap.get(selectedPayee) : null;

    if (!isClient) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-semibold">Select Payee Profile</h3>
                    </div>
                    <div className="w-full sm:w-[300px]">
                        <CustomDropdown
                            options={payeeOptions}
                            value={selectedPayee}
                            onChange={(value: string | null) => setSelectedPayee(value)}
                            placeholder="Search and select a payee..."
                        />
                    </div>
                </CardContent>
            </Card>

            {selectedPayeeData ? (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{selectedPayeeData.name}</CardTitle>
                            <CardDescription>
                                A summary of all payments made to this payee.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Amount Paid</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(selectedPayeeData.totalPaid)}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">Total Transactions</p>
                                <p className="text-2xl font-bold">{selectedPayeeData.transactionCount}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-96">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedPayeeData.transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{format(new Date(tx.date), 'dd-MMM-yyyy')}</TableCell>
                                                <TableCell>{tx.category} / {tx.subCategory}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                 <Card className="flex items-center justify-center h-64">
                    <CardContent className="text-center text-muted-foreground">
                        <p>Please select a payee to view their transaction details.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
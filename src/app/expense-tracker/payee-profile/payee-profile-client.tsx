
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Expense } from "@/lib/definitions";
import { toTitleCase, formatCurrency } from "@/lib/utils";
import { getExpensesRealtime, updateExpensePayee, deleteExpensesForPayee } from '@/lib/firestore';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Loader2, Pen, Trash2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPayeeName, setEditingPayeeName] = useState('');
    const { toast } = useToast();

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
    
    const handleEditPayee = (payeeName: string) => {
        setEditingPayeeName(payeeName);
        setIsEditModalOpen(true);
    };

    const handleSavePayeeName = async () => {
        if (!selectedPayee || !editingPayeeName || selectedPayee === editingPayeeName) {
            setIsEditModalOpen(false);
            return;
        }

        try {
            await updateExpensePayee(selectedPayee, editingPayeeName);
            toast({ title: 'Payee Updated', description: `"${selectedPayee}" has been renamed to "${editingPayeeName}".`, variant: 'success' });
            setSelectedPayee(editingPayeeName); // Update the selection to the new name
        } catch (error) {
            console.error("Error updating payee name:", error);
            toast({ title: 'Error', description: 'Failed to update payee name.', variant: 'destructive' });
        } finally {
            setIsEditModalOpen(false);
        }
    };

    const handleDeletePayee = async (payeeName: string) => {
        try {
            await deleteExpensesForPayee(payeeName);
            toast({ title: 'Payee Deleted', description: `All transactions for "${payeeName}" have been deleted.`, variant: 'success' });
            if (selectedPayee === payeeName) {
                setSelectedPayee(null); // Clear selection if the deleted payee was selected
            }
        } catch (error) {
            console.error("Error deleting payee transactions:", error);
            toast({ title: 'Error', description: 'Failed to delete payee transactions.', variant: 'destructive' });
        }
    };


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
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle>{selectedPayeeData.name}</CardTitle>
                                    <CardDescription>
                                        A summary of all payments made to this payee.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPayee(selectedPayeeData.name)}>
                                        <Pen className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete all {selectedPayeeData.transactionCount} transactions for "{selectedPayeeData.name}". This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeletePayee(selectedPayeeData.name)}>Delete All</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
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
            
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Payee Name</DialogTitle>
                        <DialogDescription>
                            This will update the payee name across all associated transactions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label htmlFor="payee-name">New Payee Name</Label>
                        <Input
                            id="payee-name"
                            value={editingPayeeName}
                            onChange={(e) => setEditingPayeeName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSavePayeeName}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

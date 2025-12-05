
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Transaction } from "@/lib/definitions";
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";
import { getIncomeAndExpensesRealtime, updateExpensePayee, deleteExpensesForPayee, updateIncomePayee, deleteIncomesForPayee, deleteIncome, deleteExpense, getPayeeProfilesRealtime, upsertPayeeProfile, deletePayeeProfile, getIncomeCategories, getExpenseCategories, getAllIncomeCategories, getAllExpenseCategories, addCategory, updateCategoryName, deleteCategory, addSubCategory, deleteSubCategory } from '@/lib/firestore';
import type { PayeeProfile, IncomeCategory, ExpenseCategory } from '@/lib/firestore';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Loader2, Pen, Trash2, PlusCircle, Settings } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { CategoryManagerDialog } from '../category-manager-dialog';

type PayeeTransaction = Transaction & {
    runningBalance: number;
    signedAmount: number;
};

interface PayeeSummary {
    name: string;
    totalIncome: number;
    totalExpense: number;
    netAmount: number;
    transactionCount: number;
    transactions: PayeeTransaction[];
    categories: string[];
    rawTransactions: Transaction[];
    profile?: PayeeProfile;
}

const MetricTile = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="rounded-md border border-muted-foreground/10 bg-background p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-xl font-semibold leading-tight", tone)}>{value}</p>
    </div>
);

// Payee Transaction Table with Infinite Scroll
const PayeeTransactionTable = ({ 
    transactions,
    onEditTransaction,
    onDeleteTransaction
}: { 
    transactions: PayeeTransaction[];
    onEditTransaction: (tx: Transaction) => void;
    onDeleteTransaction: (tx: Transaction) => void;
}) => {
    const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(transactions, {
        totalItems: transactions.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: transactions.length > 30,
    });

    const visibleTransactions = transactions.slice(0, visibleItems);

    const formatSignedCurrency = (value: number) => {
        const formatted = formatCurrency(Math.abs(value));
        return value >= 0 ? formatted : `-${formatted}`;
    };

    const resolveDescription = (tx: Transaction) => {
        const raw =
            (tx.description && tx.description.trim()) ||
            (typeof (tx as any).notes === 'string' && (tx as any).notes.trim()) ||
            (typeof (tx as any).narration === 'string' && (tx as any).narration.trim()) ||
            '';
        return raw || '-';
    };

    return (
        <ScrollArea ref={scrollRef} className="h-96">
            <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>SR No.</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Running Balance</TableHead>
                        <TableHead className="text-right w-20">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleTransactions.map(tx => (
                        <TableRow key={tx.id}>
                            <TableCell>{format(new Date(tx.date), 'dd-MMM-yyyy')}</TableCell>
                            <TableCell className="font-mono text-xs">{tx.transactionId || '-'}</TableCell>
                            <TableCell className="max-w-[320px]">
                                {resolveDescription(tx)}
                            </TableCell>
                            <TableCell className={cn(
                                "text-right font-semibold",
                                tx.transactionType === 'Expense' ? "text-rose-600" : "text-muted-foreground"
                            )}>
                                {tx.transactionType === 'Expense' ? formatCurrency(tx.amount) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                                "text-right font-semibold",
                                tx.transactionType === 'Income' ? "text-emerald-600" : "text-muted-foreground"
                            )}>
                                {tx.transactionType === 'Income' ? formatCurrency(tx.amount) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                                "text-right font-semibold",
                                tx.runningBalance >= 0 ? "text-emerald-700" : "text-rose-600"
                            )}>
                                {formatSignedCurrency(tx.runningBalance)}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => onEditTransaction(tx)}>
                                    <Pen className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                                    onClick={() => onDeleteTransaction(tx)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {isLoading && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading more transactions...</span>
                            </TableCell>
                        </TableRow>
                    )}
                    {!hasMore && transactions.length > 30 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-2 text-xs text-muted-foreground">
                                Showing all {transactions.length} transactions
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            </div>
        </ScrollArea>
    );
};

interface PayeeProfileClientProps {
    autoOpenNewAccount?: boolean;
    onAutoOpenHandled?: () => void;
    onAccountSaved?: (accountName: string) => void;
    externalSelectedPayee?: string | null;
    onSelectedPayeeChange?: (value: string | null) => void;
    onRequestManageCategories?: () => void;
}

export default function PayeeProfileClient({
    autoOpenNewAccount = false,
    onAutoOpenHandled,
    onAccountSaved,
    externalSelectedPayee = null,
    onSelectedPayeeChange,
    onRequestManageCategories,
}: PayeeProfileClientProps) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [selectedPayee, setSelectedPayee] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPayeeName, setEditingPayeeName] = useState('');
    const [editingPayeeContact, setEditingPayeeContact] = useState('');
    const [editingPayeeAddress, setEditingPayeeAddress] = useState('');
    const [editingPayeeNature, setEditingPayeeNature] = useState('');
    const [editingPayeeCategory, setEditingPayeeCategory] = useState('');
    const [editingPayeeSubCategory, setEditingPayeeSubCategory] = useState('');
    const [payeeProfiles, setPayeeProfiles] = useState<Map<string, PayeeProfile>>(new Map());
    const [editingAccountBaselineName, setEditingAccountBaselineName] = useState<string | null>(null);
    const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setIsClient(true);
        const unsubTransactions = getIncomeAndExpensesRealtime(setTransactions, console.error);
        return () => unsubTransactions();
    }, []);

    useEffect(() => {
        const unsubscribe = getPayeeProfilesRealtime((profiles) => {
            const map = new Map<string, PayeeProfile>();
            profiles.forEach(profile => {
                if (!profile?.name) return;
                map.set(toTitleCase(profile.name), profile);
            });
            setPayeeProfiles(map);
        }, console.error);
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Load all categories initially
        const loadAllCategories = async () => {
            try {
                const [incomeCats, expenseCats] = await Promise.all([
                    getAllIncomeCategories(),
                    getAllExpenseCategories()
                ]);
                setIncomeCategories(incomeCats);
                setExpenseCategories(expenseCats);
            } catch (error) {
                console.error('Error loading categories:', error);
            }
        };
        loadAllCategories();

        // Then set up realtime listeners for updates
        const unsubIncomeCats = getIncomeCategories((newCats) => {
            setIncomeCategories(prev => {
                // Merge new categories with existing ones
                const existingMap = new Map(prev.map(c => [c.id, c]));
                newCats.forEach(cat => existingMap.set(cat.id, cat));
                return Array.from(existingMap.values());
            });
        }, console.error);
        const unsubExpenseCats = getExpenseCategories((newCats) => {
            setExpenseCategories(prev => {
                // Merge new categories with existing ones
                const existingMap = new Map(prev.map(c => [c.id, c]));
                newCats.forEach(cat => existingMap.set(cat.id, cat));
                return Array.from(existingMap.values());
            });
        }, console.error);
        return () => {
            unsubIncomeCats();
            unsubExpenseCats();
        };
    }, []);

    useEffect(() => {
        if (externalSelectedPayee === undefined) return;
        if (externalSelectedPayee) {
            setSelectedPayee(toTitleCase(externalSelectedPayee));
        } else {
            setSelectedPayee(null);
        }
    }, [externalSelectedPayee]);

    const payeeSummaryMap = useMemo(() => {
        type BuilderSummary = {
            name: string;
            totalIncome: number;
            totalExpense: number;
            transactionCount: number;
            transactions: Transaction[];
            categorySet: Set<string>;
        };

        const builder = new Map<string, BuilderSummary>();

        transactions.forEach(tx => {
            const payeeName = toTitleCase(tx.payee);
            if (!payeeName) return;

            if (!builder.has(payeeName)) {
                builder.set(payeeName, {
                    name: payeeName,
                    totalIncome: 0,
                    totalExpense: 0,
                    transactionCount: 0,
                    transactions: [],
                    categorySet: new Set<string>(),
                });
            }

            const data = builder.get(payeeName)!;
            if (tx.transactionType === 'Income') {
                data.totalIncome += tx.amount;
            } else {
                data.totalExpense += tx.amount;
            }
            data.transactionCount += 1;
            data.transactions.push(tx);
            if (tx.category) {
                data.categorySet.add(tx.category);
            }
        });
        
        const finalMap = new Map<string, PayeeSummary>();

        builder.forEach((data, name) => {
            const sortedAsc = [...data.transactions].sort((a, b) => {
                const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (a.transactionId || '').localeCompare(b.transactionId || '');
            });

            let running = 0;
            const enrichedAsc: PayeeTransaction[] = sortedAsc.map(tx => {
                const signedAmount = tx.transactionType === 'Income' ? tx.amount : -tx.amount;
                running += signedAmount;
                return {
                    ...tx,
                    signedAmount,
                    runningBalance: running,
                };
            });

            const transactionsDesc = [...enrichedAsc].sort((a, b) => {
                const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return (b.transactionId || '').localeCompare(a.transactionId || '');
        });

            const profile = payeeProfiles.get(name);
            finalMap.set(name, {
                name,
                totalIncome: data.totalIncome,
                totalExpense: data.totalExpense,
                netAmount: running,
                transactionCount: data.transactionCount,
                transactions: transactionsDesc,
                categories: Array.from(data.categorySet).sort(),
                rawTransactions: [...data.transactions],
                profile,
            });
        });

        return finalMap;
    }, [transactions, payeeProfiles]);

    const natureOptions = useMemo(() => {
        const set = new Set<string>();
        // Add natures from expense categories
        expenseCategories.forEach(cat => {
            if (cat.nature) set.add(toTitleCase(cat.nature));
        });
        // Add natures from transactions
        transactions.forEach(tx => {
            const nature = (tx as any).expenseNature;
            if (nature) set.add(toTitleCase(nature));
        });
        // Add natures from payee profiles
        payeeProfiles.forEach(profile => {
            if (profile.nature) set.add(toTitleCase(profile.nature));
        });
        return Array.from(set).sort().map(value => ({ value, label: value }));
    }, [transactions, payeeProfiles, expenseCategories]);

    const categoryOptions = useMemo(() => {
        const set = new Set<string>();
        // Add categories from income categories
        incomeCategories.forEach(cat => {
            if (cat.name) set.add(toTitleCase(cat.name));
        });
        // Add categories from expense categories
        expenseCategories.forEach(cat => {
            if (cat.name) set.add(toTitleCase(cat.name));
        });
        // Add categories from transactions
        transactions.forEach(tx => {
            if (tx.category) set.add(toTitleCase(tx.category));
        });
        // Add categories from payee profiles
        payeeProfiles.forEach(profile => {
            if (profile.category) set.add(toTitleCase(profile.category));
        });
        return Array.from(set).sort().map(value => ({ value, label: value }));
    }, [transactions, payeeProfiles, incomeCategories, expenseCategories]);

    const subCategoryOptions = useMemo(() => {
        const normalizedCategory = toTitleCase(editingPayeeCategory || '');
        if (!normalizedCategory) return [];
        const set = new Set<string>();
        // Add subcategories from income categories
        incomeCategories.forEach(cat => {
            if (toTitleCase(cat.name) === normalizedCategory && cat.subCategories) {
                cat.subCategories.forEach(subCat => {
                    if (subCat) set.add(toTitleCase(subCat));
                });
            }
        });
        // Add subcategories from expense categories
        expenseCategories.forEach(cat => {
            if (toTitleCase(cat.name) === normalizedCategory && cat.subCategories) {
                cat.subCategories.forEach(subCat => {
                    if (subCat) set.add(toTitleCase(subCat));
                });
            }
        });
        // Add subcategories from transactions
        transactions.forEach(tx => {
            if (toTitleCase(tx.category) === normalizedCategory && tx.subCategory) {
                set.add(toTitleCase(tx.subCategory));
            }
        });
        // Add subcategories from payee profiles
        payeeProfiles.forEach(profile => {
            if (profile.category && toTitleCase(profile.category) === normalizedCategory && profile.subCategory) {
                set.add(toTitleCase(profile.subCategory));
            }
        });
        return Array.from(set).sort().map(value => ({ value, label: value }));
    }, [transactions, payeeProfiles, editingPayeeCategory, incomeCategories, expenseCategories]);
    const handleEditTransaction = (tx: Transaction) => {
        toast({
            title: 'Edit Transaction',
            description: 'Editing directly from this view is not available yet. Please use the main income/expense form.',
        });
    };

    const handleDeleteTransaction = async (tx: Transaction) => {
        try {
            if (!tx?.id) return;
            if (tx.transactionType === 'Income') {
                await deleteIncome(tx.id);
            } else {
                await deleteExpense(tx.id);
            }
            toast({ title: 'Transaction deleted', variant: 'success' });
        } catch (error) {
            console.error("Failed to delete transaction:", error);
            toast({ title: 'Delete failed', description: 'Unable to delete this record right now.', variant: 'destructive' });
        }
    };

    
    const payeeOptions = useMemo(() => {
        return Array.from(payeeSummaryMap.keys()).sort().map(name => ({
            value: name,
            label: name
        }));
    }, [payeeSummaryMap]);

    const selectedPayeeData = selectedPayee ? payeeSummaryMap.get(selectedPayee) : null;
    const selectedPayeeProfile = selectedPayeeData?.profile;

    const formatSignedCurrency = (value: number) => {
        const formatted = formatCurrency(Math.abs(value));
        return value >= 0 ? formatted : `-${formatted}`;
    };

const resolveDescription = (tx: Transaction) => {
    const raw =
        (tx.description && tx.description.trim()) ||
        (typeof (tx as any).notes === 'string' && (tx as any).notes.trim()) ||
        (typeof (tx as any).narration === 'string' && (tx as any).narration.trim()) ||
        '';
    return raw || '-';
};

    const handleEditPayee = useCallback((payeeName: string, summary?: PayeeSummary) => {
        const normalizedName = toTitleCase(payeeName);
        const profile = summary?.profile || payeeProfiles.get(normalizedName);
        const defaultCategory =
            profile?.category ||
            summary?.rawTransactions.find(tx => tx.category)?.category ||
            summary?.categories?.[0] ||
            '';
        const defaultSubCategory =
            profile?.subCategory ||
            summary?.rawTransactions.find(tx => tx.subCategory)?.subCategory ||
            '';
        const defaultNature =
            profile?.nature ||
            summary?.rawTransactions.find(tx => (tx as any).expenseNature)?.expenseNature ||
            '';

        setEditingPayeeName(normalizedName);
        setEditingPayeeContact(profile?.contact || '');
        setEditingPayeeAddress(profile?.address || '');
        setEditingPayeeNature(defaultNature || '');
        setEditingPayeeCategory(defaultCategory || '');
        setEditingPayeeSubCategory(defaultSubCategory || '');
        setEditingAccountBaselineName(normalizedName);
        setIsEditModalOpen(true);
    }, [payeeProfiles]);

    const handleAddPayee = useCallback(() => {
        setEditingAccountBaselineName(null);
        setEditingPayeeName('');
        setEditingPayeeContact('');
        setEditingPayeeAddress('');
        setEditingPayeeNature('');
        setEditingPayeeCategory('');
        setEditingPayeeSubCategory('');
        setIsEditModalOpen(true);
    }, []);

    useEffect(() => {
        if (autoOpenNewAccount) {
            handleAddPayee();
            onAutoOpenHandled?.();
        }
    }, [autoOpenNewAccount, handleAddPayee, onAutoOpenHandled]);

    const handleSavePayeeName = async () => {
        const formattedNewName = toTitleCase(editingPayeeName.trim());
        if (!formattedNewName) {
            setIsEditModalOpen(false);
            return;
        }

        const previousName = editingAccountBaselineName;

        try {
            if (previousName && formattedNewName !== previousName) {
                await Promise.all([
                    updateExpensePayee(previousName, formattedNewName),
                    updateIncomePayee(previousName, formattedNewName),
                ]);
            }

            await upsertPayeeProfile({
                name: formattedNewName,
                contact: editingPayeeContact.trim() || undefined,
                address: editingPayeeAddress.trim() || undefined,
                nature: editingPayeeNature.trim() ? toTitleCase(editingPayeeNature.trim()) : undefined,
                category: editingPayeeCategory.trim() ? toTitleCase(editingPayeeCategory.trim()) : undefined,
                subCategory: editingPayeeSubCategory.trim() ? toTitleCase(editingPayeeSubCategory.trim()) : undefined,
            }, previousName);

            toast({
                title: 'Profile Updated',
                description: `Saved details for "${formattedNewName}".`,
                variant: 'success'
            });
            setSelectedPayee(formattedNewName);
            setEditingPayeeName(formattedNewName);
            setEditingAccountBaselineName(formattedNewName);
            onAccountSaved?.(formattedNewName);
            onSelectedPayeeChange?.(formattedNewName);
        } catch (error) {
            console.error("Error updating payee profile:", error);
            toast({ title: 'Error', description: 'Failed to update payee profile.', variant: 'destructive' });
        } finally {
            setIsEditModalOpen(false);
        }
    };

    const handleDeletePayee = async (payeeName: string) => {
        try {
            await Promise.all([
                deleteExpensesForPayee(payeeName),
                deleteIncomesForPayee(payeeName),
                deletePayeeProfile(payeeName),
            ]);
            toast({ title: 'Payee Deleted', description: `All transactions for "${payeeName}" have been deleted.`, variant: 'success' });
            if (selectedPayee === payeeName) {
                setSelectedPayee(null); // Clear selection if the deleted payee was selected
                onSelectedPayeeChange?.(null);
            }
        } catch (error) {
            console.error("Error deleting payee transactions:", error);
            toast({ title: 'Error', description: 'Failed to delete payee transactions.', variant: 'destructive' });
        }
    };


    const [showProfilesList, setShowProfilesList] = useState(false);

    if (!isClient) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }
    
    const isExternallyControlled = typeof onSelectedPayeeChange === 'function';

    return (
        <div className="space-y-6">
            {!isExternallyControlled && (
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
                                onChange={(value: string | null) => {
                                    setSelectedPayee(value);
                                    onSelectedPayeeChange?.(value);
                                }}
                                placeholder="Search and select a payee..."
                            />
                        </div>
                        <div className="w-full sm:w-auto flex items-center gap-2">
                            <Button onClick={handleAddPayee} size="sm" variant="outline" className="w-full sm:w-auto">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Account
                            </Button>
                            <Button 
                                onClick={() => setShowProfilesList(!showProfilesList)} 
                                size="sm" 
                                variant={showProfilesList ? "default" : "outline"}
                                className="w-full sm:w-auto"
                            >
                                <Users className="mr-2 h-4 w-4" />
                                {showProfilesList ? "Hide Profiles" : "All Profiles"}
                            </Button>
                            {onRequestManageCategories && (
                                <Button
                                    onClick={onRequestManageCategories}
                                    size="sm"
                                    variant="ghost"
                                    className="w-full sm:w-auto"
                                >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Manage Categories
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {showProfilesList && (
                <Card>
                    <CardHeader>
                        <CardTitle>All Payee Profiles</CardTitle>
                        <CardDescription>Manage all payee profiles. Edit or delete profiles from here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[400px]">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Address</TableHead>
                                        <TableHead>Nature</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Sub Category</TableHead>
                                        <TableHead className="text-right">Transactions</TableHead>
                                        <TableHead className="text-right">Net Balance</TableHead>
                                        <TableHead className="text-right w-24">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from(payeeSummaryMap.values())
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((summary) => (
                                            <TableRow key={summary.name}>
                                                <TableCell className="font-medium">{summary.name}</TableCell>
                                                <TableCell>{summary.profile?.contact || '—'}</TableCell>
                                                <TableCell className="max-w-[200px] truncate">
                                                    {summary.profile?.address || '—'}
                                                </TableCell>
                                                <TableCell>{summary.profile?.nature || '—'}</TableCell>
                                                <TableCell>{summary.profile?.category || '—'}</TableCell>
                                                <TableCell>{summary.profile?.subCategory || '—'}</TableCell>
                                                <TableCell className="text-right">{summary.transactionCount}</TableCell>
                                                <TableCell className={cn(
                                                    "text-right font-semibold",
                                                    summary.netAmount >= 0 ? "text-emerald-700" : "text-rose-600"
                                                )}>
                                                    {formatSignedCurrency(summary.netAmount)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                handleEditPayee(summary.name, summary);
                                                                setShowProfilesList(false);
                                                            }}
                                                            title="Edit Profile"
                                                        >
                                                            <Pen className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    title="Delete Profile"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will permanently delete all {summary.transactionCount} transactions for "{summary.name}" and remove the profile. This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction 
                                                                        onClick={() => {
                                                                            handleDeletePayee(summary.name);
                                                                            if (selectedPayee === summary.name) {
                                                                                setSelectedPayee(null);
                                                                            }
                                                                        }}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Delete All
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    {payeeSummaryMap.size === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                                No payee profiles found. Add a new profile to get started.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {selectedPayeeData ? (
                <div className="space-y-6">
                    {(() => {
                        const lastTransactionDate = selectedPayeeData.transactions[0]?.date;
                        const lastActivity = lastTransactionDate ? format(new Date(lastTransactionDate), 'dd-MMM-yyyy') : '—';

                        return (
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div className="space-y-1.5">
                                    <CardTitle className="text-lg font-semibold">{selectedPayeeData.name}</CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">Consolidated ledger summary</CardDescription>
                                    {(selectedPayeeProfile?.contact || selectedPayeeProfile?.address || selectedPayeeProfile?.nature || selectedPayeeProfile?.category || selectedPayeeProfile?.subCategory) && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground/90">
                                            {selectedPayeeProfile?.contact && (
                                                <span><span className="font-medium text-foreground/70">Contact:</span> {selectedPayeeProfile.contact}</span>
                                            )}
                                            {selectedPayeeProfile?.address && (
                                                <span><span className="font-medium text-foreground/70">Address:</span> {selectedPayeeProfile.address}</span>
                                            )}
                                            {(selectedPayeeProfile?.category || selectedPayeeProfile?.subCategory) && (
                                                <span>
                                                    <span className="font-medium text-foreground/70">Category:</span>{' '}
                                                    {selectedPayeeProfile?.category || '—'}
                                                    {selectedPayeeProfile?.subCategory ? ` / ${selectedPayeeProfile.subCategory}` : ''}
                                                </span>
                                            )}
                                            {selectedPayeeProfile?.nature && (
                                                <span><span className="font-medium text-foreground/70">Nature:</span> {selectedPayeeProfile.nature}</span>
                                            )}
                                        </div>
                                    )}
                                    {!selectedPayeeProfile && !!selectedPayeeData.categories.length && (
                                        <p className="text-xs text-muted-foreground/80">
                                            Categories spotted: {selectedPayeeData.categories.slice(0, 4).join(', ')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPayee(selectedPayeeData.name, selectedPayeeData)}>
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
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                            <MetricTile label="Credit (Income)" value={formatCurrency(selectedPayeeData.totalIncome)} tone="text-emerald-700" />
                            <MetricTile label="Debit (Expense)" value={formatCurrency(selectedPayeeData.totalExpense)} tone="text-rose-700" />
                            <MetricTile label="Net Balance" value={formatSignedCurrency(selectedPayeeData.netAmount)} tone={selectedPayeeData.netAmount >= 0 ? "text-emerald-700" : "text-rose-700"} />
                            <MetricTile label="Ledger Entries" value={`${selectedPayeeData.transactionCount}`} />
                            <MetricTile label="Last Activity" value={lastActivity} />
                        </CardContent>
                    </Card>
                        );
                    })()}

                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PayeeTransactionTable 
                                transactions={selectedPayeeData.transactions}
                                onEditTransaction={handleEditTransaction}
                                onDeleteTransaction={handleDeleteTransaction}
                            />
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
            <DialogContent className="max-w-[900px]">
                <DialogHeader className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1">
                            <DialogTitle>Edit Payee Details</DialogTitle>
                            <DialogDescription>
                                Update profile information for this payee. Name changes will be reflected across all linked transactions.
                            </DialogDescription>
                        </div>
                        {onRequestManageCategories && (
                            <Button
                                onClick={onRequestManageCategories}
                                size="sm"
                                variant="outline"
                                className="h-8 px-3"
                            >
                                <Settings className="mr-2 h-4 w-4" />
                                Manage Categories
                            </Button>
                        )}
                    </div>
                </DialogHeader>
                    <div className="py-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="payee-name">Name</Label>
                        <Input
                            id="payee-name"
                            value={editingPayeeName}
                            onChange={(e) => setEditingPayeeName(e.target.value)}
                        />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="payee-contact">Contact Number</Label>
                                <Input
                                    id="payee-contact"
                                    value={editingPayeeContact}
                                    onChange={(e) => setEditingPayeeContact(e.target.value)}
                                    placeholder="e.g. 9876543210"
                                />
                            </div>
                            <div className="flex flex-col gap-2 lg:col-span-1">
                                <Label htmlFor="payee-address">Address</Label>
                                <Input
                                    id="payee-address"
                                    value={editingPayeeAddress}
                                    onChange={(e) => setEditingPayeeAddress(e.target.value)}
                                    placeholder="Address or location details"
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <Label>Nature</Label>
                                <CustomDropdown
                                    options={natureOptions}
                                    value={editingPayeeNature ? toTitleCase(editingPayeeNature) : null}
                                    onChange={(value) => setEditingPayeeNature(value || '')}
                                    placeholder="Select nature"
                                    allowClear
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>Category</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsCategoryManagerOpen(true)}
                                        className="h-6 w-6 p-0"
                                        title="Manage Categories & Subcategories"
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </div>
                                <CustomDropdown
                                    options={categoryOptions}
                                    value={editingPayeeCategory ? toTitleCase(editingPayeeCategory) : null}
                                    onChange={(value) => {
                                        setEditingPayeeCategory(value || '');
                                        if (!value) {
                                            setEditingPayeeSubCategory('');
                                        }
                                    }}
                                    placeholder="Select category"
                                    allowClear
                                />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex flex-col gap-2">
                                <Label>Sub Category</Label>
                                <CustomDropdown
                                    options={subCategoryOptions}
                                    value={editingPayeeSubCategory ? toTitleCase(editingPayeeSubCategory) : null}
                                    onChange={(value) => setEditingPayeeSubCategory(value || '')}
                                    placeholder="Select sub category"
                                    disabled={!editingPayeeCategory}
                                    allowClear
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSavePayeeName}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CategoryManagerDialog
                isOpen={isCategoryManagerOpen}
                onOpenChange={setIsCategoryManagerOpen}
                incomeCategories={incomeCategories}
                expenseCategories={expenseCategories}
                onAddCategory={async (collection, category) => {
                    await addCategory(collection, category);
                    // Immediately refresh categories
                    const [incomeCats, expenseCats] = await Promise.all([
                        getAllIncomeCategories(),
                        getAllExpenseCategories()
                    ]);
                    setIncomeCategories(incomeCats);
                    setExpenseCategories(expenseCats);
                    toast({ title: 'Category added', variant: 'success' });
                }}
                onUpdateCategoryName={async (collection, id, name) => {
                    await updateCategoryName(collection, id, name);
                    // Immediately refresh categories
                    const [incomeCats, expenseCats] = await Promise.all([
                        getAllIncomeCategories(),
                        getAllExpenseCategories()
                    ]);
                    setIncomeCategories(incomeCats);
                    setExpenseCategories(expenseCats);
                    toast({ title: 'Category updated', variant: 'success' });
                }}
                onDeleteCategory={async (collection, id) => {
                    await deleteCategory(collection, id);
                    // Immediately refresh categories
                    const [incomeCats, expenseCats] = await Promise.all([
                        getAllIncomeCategories(),
                        getAllExpenseCategories()
                    ]);
                    setIncomeCategories(incomeCats);
                    setExpenseCategories(expenseCats);
                    toast({ title: 'Category deleted', variant: 'success' });
                }}
                onAddSubCategory={async (collection, categoryId, subCategoryName) => {
                    await addSubCategory(collection, categoryId, subCategoryName);
                    // Immediately refresh categories
                    const [incomeCats, expenseCats] = await Promise.all([
                        getAllIncomeCategories(),
                        getAllExpenseCategories()
                    ]);
                    setIncomeCategories(incomeCats);
                    setExpenseCategories(expenseCats);
                    toast({ title: 'Subcategory added', variant: 'success' });
                }}
                onDeleteSubCategory={async (collection, categoryId, subCategoryName) => {
                    await deleteSubCategory(collection, categoryId, subCategoryName);
                    // Immediately refresh categories
                    const [incomeCats, expenseCats] = await Promise.all([
                        getAllIncomeCategories(),
                        getAllExpenseCategories()
                    ]);
                    setIncomeCategories(incomeCats);
                    setExpenseCategories(expenseCats);
                    toast({ title: 'Subcategory deleted', variant: 'success' });
                }}
            />

        </div>
    );
}

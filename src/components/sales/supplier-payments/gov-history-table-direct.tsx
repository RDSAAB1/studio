"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Info, Trash2, Pen, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import type { Payment, Customer } from "@/lib/definitions";

interface GovHistoryTableDirectProps {
    onShowDetails: (payment: Payment) => void;
    onEdit: (payment: Payment) => void;
    onDelete: (payment: Payment) => void;
    suppliers?: Customer[];
}

export const GovHistoryTableDirect: React.FC<GovHistoryTableDirectProps> = ({
    onShowDetails,
    onEdit,
    onDelete,
    suppliers = []
}) => {
    const [govPayments, setGovPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    console.log('GovHistoryTableDirect: Component rendered, refreshKey:', refreshKey);

    // Load directly from IndexedDB
    useEffect(() => {
        const loadGovPayments = async () => {
            try {
                setIsLoading(true);
                const { db } = await import('@/lib/database');
                
                if (!db) {
                    const errorMsg = 'Database not available';
                    console.warn(errorMsg);
                    setError(errorMsg);
                    setIsLoading(false);
                    return;
                }
                
                if (!db.governmentFinalizedPayments) {
                    const errorMsg = 'governmentFinalizedPayments table not found';
                    console.warn(errorMsg);
                    setError(errorMsg);
                    setIsLoading(false);
                    return;
                }
                
                setError(null);
                
                // Check all payment tables to find where RT00393 is
                console.log('Checking all payment tables...');
                
                // Check governmentFinalizedPayments
                try {
                    const testPayment = await db.governmentFinalizedPayments.get('RT00393');
                    console.log('RT00393 in governmentFinalizedPayments:', testPayment);
                } catch (testError) {
                    console.warn('RT00393 not in governmentFinalizedPayments:', testError);
                }
                
                // Check regular payments table
                try {
                    const testPayment2 = await db.payments.get('RT00393');
                    console.log('RT00393 in payments table:', testPayment2);
                } catch (testError2) {
                    console.warn('RT00393 not in payments table:', testError2);
                }
                
                // Check customerPayments table
                try {
                    const testPayment3 = await (db as any).customerPayments?.get('RT00393');
                    console.log('RT00393 in customerPayments table:', testPayment3);
                } catch (testError3) {
                    console.warn('RT00393 not in customerPayments table:', testError3);
                }
                
                // Get counts from all tables
                const govCount = await db.governmentFinalizedPayments.count();
                const regularCount = await db.payments.count();
                const customerCount = await (db as any).customerPayments?.count() || 0;
                
                console.log('Counts - Gov:', govCount, 'Regular:', regularCount, 'Customer:', customerCount);
                
                // Get all payments from governmentFinalizedPayments (no ordering)
                const allGovPayments = await db.governmentFinalizedPayments.toArray();
                console.log('All gov payments (no ordering):', allGovPayments.length);
                if (allGovPayments.length > 0) {
                    console.log('First gov payment:', allGovPayments[0]);
                    console.log('All gov payment IDs:', allGovPayments.map(p => p.id || p.paymentId));
                }
                
                // Also check regular payments for gov payments
                const allRegularPayments = await db.payments.toArray();
                const govInRegular = allRegularPayments.filter(p => 
                    (p.receiptType || '').toLowerCase() === 'gov.' ||
                    (p as any).govQuantity !== undefined ||
                    (p as any).govRate !== undefined
                );
                console.log('Gov payments found in regular payments table:', govInRegular.length);
                if (govInRegular.length > 0) {
                    console.log('First gov payment in regular table:', govInRegular[0]);
                }
                
                // Load ALL payments from governmentFinalizedPayments table - NO FILTERING
                // Show all entries regardless of any conditions
                // Sort by ID only in component (not by date, not in IndexedDB query)
                let payments: Payment[] = [];
                try {
                    // Get all without any ordering - we'll sort by ID in component
                    payments = await db.governmentFinalizedPayments.toArray();
                    console.log('Loaded ALL gov payments from IndexedDB (will sort by ID in component):', payments.length);
                } catch (error) {
                    console.error('Error loading gov payments from IndexedDB:', error);
                    payments = [];
                }
                
                // If IndexedDB is empty, load from Firestore as fallback
                if (payments.length === 0) {
                    console.log('IndexedDB is empty, loading from Firestore...');
                    try {
                        const { collection, getDocs, query, orderBy: firestoreOrderBy } = await import('firebase/firestore');
                        const { firestoreDB } = await import('@/lib/firebase');
                        const governmentFinalizedPaymentsCollection = collection(firestoreDB, 'governmentFinalizedPayments');
                        
                        // Get all payments from Firestore
                        // Load all - will be sorted by ID in component (ONLY ID sorting, no date sorting)
                        const firestoreQuery = query(
                            governmentFinalizedPaymentsCollection
                            // No orderBy - we'll sort by ID in component to match Firebase lexicographic sorting
                        );
                        const snapshot = await getDocs(firestoreQuery);
                        payments = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })) as Payment[];
                        
                        console.log('Loaded ALL gov payments from Firestore:', payments.length);
                        
                        // Save to IndexedDB for future use
                        if (payments.length > 0 && db.governmentFinalizedPayments) {
                            try {
                                await db.governmentFinalizedPayments.bulkPut(payments);
                                console.log('Saved payments to IndexedDB');
                            } catch (saveError) {
                                console.warn('Failed to save to IndexedDB:', saveError);
                            }
                        }
                    } catch (firestoreError) {
                        console.error('Error loading from Firestore:', firestoreError);
                    }
                }
                
                console.log('Total gov payments loaded (IndexedDB + Firestore):', payments.length);
                if (payments.length > 0) {
                    console.log('Sample payment:', payments[0]);
                    console.log('Payment IDs:', payments.map(p => p.id || p.paymentId).slice(0, 10));
                }
                
                // Show ALL payments from governmentFinalizedPayments - NO FILTERING
                // Force set receiptType for all payments
                const paymentsWithType = payments.map(p => ({
                    ...p,
                    receiptType: 'Gov.' as const
                })) as Payment[];
                
                console.log('Setting ALL gov payments (no filtering):', paymentsWithType.length);
                if (paymentsWithType.length > 0) {
                    console.log('First payment:', paymentsWithType[0]);
                    console.log('All payment IDs:', paymentsWithType.map(p => p.id || p.paymentId));
                }
                
                setGovPayments(paymentsWithType);
                console.log('Set gov payments state:', paymentsWithType.length);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error loading gov payments';
                console.error('Error loading gov payments from IndexedDB:', error);
                setError(errorMsg);
            } finally {
                setIsLoading(false);
            }
        };

        loadGovPayments();

        // Listen for IndexedDB updates
        const handlePaymentUpdate = () => {
            setRefreshKey(prev => prev + 1);
            loadGovPayments();
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('indexeddb:payment:updated', handlePaymentUpdate);
            window.addEventListener('indexeddb:payment:deleted', handlePaymentUpdate);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('indexeddb:payment:updated', handlePaymentUpdate);
                window.removeEventListener('indexeddb:payment:deleted', handlePaymentUpdate);
            }
        };
    }, [refreshKey]); // Only depend on refreshKey to avoid infinite loops

    // Sort payments by ID in ascending order - prefix first, then number
    // ONLY ID sorting - no date or other sorting
    const sortedPayments = useMemo(() => {
        const sorted = [...govPayments].sort((a, b) => {
            try {
                const idA = String(a.id || a.paymentId || '').trim().replace(/\s+/g, '');
                const idB = String(b.id || b.paymentId || '').trim().replace(/\s+/g, '');
                
                // Handle empty IDs
                if (!idA && !idB) return 0;
                if (!idA) return 1;
                if (!idB) return -1;
                
                // Parse ID into prefix and number parts
                // Handles: E832, EX00039, EX00138.1, P00081, RT00393, etc.
                const parseId = (id: string): { prefix: string; number: number; decimal: number } => {
                    // Clean the ID - remove any non-alphanumeric characters except dots
                    const cleanId = id.replace(/[^A-Za-z0-9.]/g, '');
                    
                    // Try to match: prefix (letters) + number + optional decimal
                    const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
                    if (match) {
                        const prefix = match[1] || '';
                        const numberStr = match[2] || '0';
                        const decimalStr = match[3] || '0';
                        
                        return {
                            prefix: prefix,
                            number: parseInt(numberStr, 10) || 0,
                            decimal: decimalStr ? parseInt(decimalStr, 10) : 0
                        };
                    }
                    // If no match, treat entire ID as prefix
                    return { prefix: cleanId || id, number: 0, decimal: 0 };
                };
                
                const parsedA = parseId(idA);
                const parsedB = parseId(idB);
                
                // First compare prefixes alphabetically
                const prefixCompare = parsedA.prefix.localeCompare(parsedB.prefix);
                if (prefixCompare !== 0) return prefixCompare;
                
                // If prefixes are same, compare numbers numerically
                if (parsedA.number !== parsedB.number) {
                    return parsedA.number - parsedB.number;
                }
                
                // If numbers are same, compare decimal parts
                return parsedA.decimal - parsedB.decimal;
            } catch (error) {
                console.error('Error sorting payment:', error, a, b);
                return 0;
            }
        });
        return sorted;
    }, [govPayments]);

    // Infinite scroll pagination
    // Show all payments if 30 or less, otherwise use pagination
    const { visibleItems, hasMore, isLoading: scrollLoading, scrollRef } = useInfiniteScroll(sortedPayments, {
        totalItems: sortedPayments.length,
        initialLoad: sortedPayments.length <= 30 ? sortedPayments.length : 30, // Show all if 30 or less
        loadMore: 30,
        threshold: 5,
        enabled: sortedPayments.length > 30, // Only enable pagination if more than 30
    });

    const visiblePayments = sortedPayments.slice(0, visibleItems);
    
    console.log('Rendering - govPayments:', govPayments.length, 'sortedPayments:', sortedPayments.length, 'visibleItems:', visibleItems, 'visiblePayments:', visiblePayments.length);

    // Helper function to get receipt holder name
    const getReceiptHolderName = useMemo(() => {
        return (payment: Payment) => {
            if (payment.parchiName) return payment.parchiName;
            if (payment.paidFor && payment.paidFor.length > 0) {
                const firstPaidFor = payment.paidFor[0];
                if (firstPaidFor.supplierName) return firstPaidFor.supplierName;
                if (suppliers && firstPaidFor.srNo) {
                    const supplier = suppliers.find((s: Customer) => s.srNo === firstPaidFor.srNo);
                    if (supplier) return supplier.name;
                }
            }
            return payment.parchiNo || '';
        };
    }, [suppliers]);

    // Helper function to get receipt numbers
    const getReceiptNumbers = useMemo(() => {
        return (payment: Payment) => {
            if (payment.parchiNo) {
                return payment.parchiNo;
            }
            if (payment.paidFor && payment.paidFor.length > 0) {
                const srNos = payment.paidFor.map((pf) => pf.srNo).filter(Boolean);
                if (srNos.length > 0) {
                    return srNos.join(', ');
                }
            }
            return '';
        };
    }, []);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Gov. History (Direct from IndexedDB)</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    console.log('Final render - govPayments.length:', govPayments.length, 'sortedPayments.length:', sortedPayments.length, 'visiblePayments.length:', visiblePayments.length, 'visibleItems:', visibleItems);
    
    return (
        <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                    Gov. History (Direct from IndexedDB)
                    <span className="ml-2 text-sm text-muted-foreground">
                        ({sortedPayments.length} {sortedPayments.length === 1 ? 'payment' : 'payments'})
                    </span>
                </CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setRefreshKey(prev => prev + 1);
                    }}
                    className="h-7 text-xs"
                >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {error && (
                    <div className="p-4 bg-destructive/10 text-destructive text-xs">
                        Error: {error}
                    </div>
                )}
                <ScrollArea ref={scrollRef} className="h-96">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead className="w-[200px]">Supplier</TableHead>
                                    <TableHead className="w-[150px]">Receipt No.</TableHead>
                                    <TableHead className="text-right w-[120px]">Amount</TableHead>
                                    <TableHead className="w-[100px]">Quantity</TableHead>
                                    <TableHead className="w-[100px]">Rate</TableHead>
                                    <TableHead className="text-right w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visiblePayments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            {isLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                            ) : (
                                                <div className="space-y-1">
                                                    <div>No gov payments found in IndexedDB</div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Check if payments exist in governmentFinalizedPayments table
                                                    </div>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visiblePayments.map((payment) => {
                                        const receiptHolderName = getReceiptHolderName(payment);
                                        const receiptNumbers = getReceiptNumbers(payment);
                                        const govQuantity = (payment as any).govQuantity || 0;
                                        const govRate = (payment as any).govRate || 0;

                                        return (
                                            <TableRow key={payment.id || payment.paymentId}>
                                                <TableCell className="font-mono text-xs">
                                                    {payment.id || payment.paymentId || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {receiptHolderName || '-'}
                                                </TableCell>
                                                <TableCell className="text-xs font-mono">
                                                    {receiptNumbers || '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-semibold">
                                                    {formatCurrency(payment.amount || 0)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {govQuantity > 0 ? `${govQuantity.toFixed(2)} qtl` : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {govRate > 0 ? formatCurrency(govRate) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onShowDetails(payment)}
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <Info className="h-3 w-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onEdit(payment)}
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <Pen className="h-3 w-3" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to delete payment {payment.id || payment.paymentId}? This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => onDelete(payment)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                        {scrollLoading && hasMore && (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


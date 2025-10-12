"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { fixRtgsPaymentIds } from '@/scripts/fix-rtgs-payment-ids';
import { fixTransactionIdMismatch } from '@/scripts/fix-transaction-id-mismatch';

export default function MigrationsPage() {
    const [isRunning1, setIsRunning1] = useState(false);
    const [result1, setResult1] = useState<{ success: boolean; count?: number; skipped?: number; error?: any } | null>(null);
    
    const [isRunning2, setIsRunning2] = useState(false);
    const [result2, setResult2] = useState<{ success: boolean; count?: number; error?: any } | null>(null);

    const handleFixRtgsPaymentIds = async () => {
        setIsRunning1(true);
        setResult1(null);
        
        try {
            const res = await fixRtgsPaymentIds();
            setResult1(res);
        } catch (error) {
            setResult1({ success: false, error });
        } finally {
            setIsRunning1(false);
        }
    };
    
    const handleFixTransactionIdMismatch = async () => {
        setIsRunning2(true);
        setResult2(null);
        
        try {
            const res = await fixTransactionIdMismatch();
            setResult2(res);
        } catch (error) {
            setResult2({ success: false, error });
        } finally {
            setIsRunning2(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Database Migrations</h1>
                <p className="text-muted-foreground mt-2">Run data fixes and migrations</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fix RTGS Payment IDs</CardTitle>
                    <CardDescription>
                        Updates paymentId field to match rtgsSrNo for all RTGS payments.
                        This fixes the issue where RTGS payment IDs were showing incorrectly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFixRtgsPaymentIds} 
                        disabled={isRunning1}
                        className="w-full sm:w-auto"
                    >
                        {isRunning1 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning1 ? 'Running Migration...' : 'Run Migration'}
                    </Button>

                    {result1 && (
                        <div className={`p-4 rounded-lg border ${result1.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result1.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result1.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result1.success ? 'Migration Completed Successfully!' : 'Migration Failed'}
                                    </p>
                                    {result1.success && result1.count !== undefined && (
                                        <div className="text-sm text-green-700 mt-1">
                                            {result1.count === 0 ? (
                                                <p>No payments needed updating - all RTGS payments are already correct!</p>
                                            ) : (
                                                <>
                                                    <p>✅ Updated {result1.count} RTGS payment{result1.count > 1 ? 's' : ''}</p>
                                                    {result1.skipped && result1.skipped > 0 && (
                                                        <p className="text-amber-700 mt-1">⚠️ Skipped {result1.skipped} payment{result1.skipped > 1 ? 's' : ''} (missing rtgsSrNo)</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {!result1.success && result1.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result1.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900 font-medium">⚠️ Important Notes:</p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                            <li>This migration is safe to run multiple times</li>
                            <li>It only updates RTGS payments where paymentId doesn't match rtgsSrNo</li>
                            <li>Check the browser console for detailed logs</li>
                            <li>Refresh the payments page after running to see updated data</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Fix Transaction ID Mismatches</CardTitle>
                    <CardDescription>
                        Fixes expenses/incomes where the transactionId field doesn't match the document ID.
                        This resolves "already exists" errors and ghost entries in history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFixTransactionIdMismatch} 
                        disabled={isRunning2}
                        className="w-full sm:w-auto"
                    >
                        {isRunning2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning2 ? 'Running Migration...' : 'Run Migration'}
                    </Button>

                    {result2 && (
                        <div className={`p-4 rounded-lg border ${result2.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result2.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result2.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result2.success ? 'Migration Completed Successfully!' : 'Migration Failed'}
                                    </p>
                                    {result2.success && result2.count !== undefined && (
                                        <div className="text-sm text-green-700 mt-1">
                                            {result2.count === 0 ? (
                                                <p>No mismatches found - all transaction IDs are correct!</p>
                                            ) : (
                                                <p>✅ Fixed {result2.count} transaction ID mismatch{result2.count > 1 ? 'es' : ''}</p>
                                            )}
                                        </div>
                                    )}
                                    {!result2.success && result2.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result2.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900 font-medium">⚠️ Important Notes:</p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                            <li>Fixes entries where document ID ≠ transactionId field</li>
                            <li>Updates transactionId field to match document ID</li>
                            <li>Resolves "ID already exists" errors</li>
                            <li>Makes ghost entries visible in history</li>
                            <li>Safe to run multiple times</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { fixRtgsPaymentIds } from '@/scripts/fix-rtgs-payment-ids';
import { fixTransactionIdMismatch } from '@/scripts/fix-transaction-id-mismatch';

export default function MigrationsPage() {
    const [isRunning1, setIsRunning1] = useState(false);
    const [result1, setResult1] = useState<{ success: boolean; count?: number; skipped?: number; error?: any } | null>(null);
    
    const [isRunning2, setIsRunning2] = useState(false);
    const [result2, setResult2] = useState<{ success: boolean; count?: number; error?: any } | null>(null);

    const handleFixRtgsPaymentIds = async () => {
        setIsRunning1(true);
        setResult1(null);
        
        try {
            const res = await fixRtgsPaymentIds();
            setResult1(res);
        } catch (error) {
            setResult1({ success: false, error });
        } finally {
            setIsRunning1(false);
        }
    };
    
    const handleFixTransactionIdMismatch = async () => {
        setIsRunning2(true);
        setResult2(null);
        
        try {
            const res = await fixTransactionIdMismatch();
            setResult2(res);
        } catch (error) {
            setResult2({ success: false, error });
        } finally {
            setIsRunning2(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Database Migrations</h1>
                <p className="text-muted-foreground mt-2">Run data fixes and migrations</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Fix RTGS Payment IDs</CardTitle>
                    <CardDescription>
                        Updates paymentId field to match rtgsSrNo for all RTGS payments.
                        This fixes the issue where RTGS payment IDs were showing incorrectly.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFixRtgsPaymentIds} 
                        disabled={isRunning1}
                        className="w-full sm:w-auto"
                    >
                        {isRunning1 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning1 ? 'Running Migration...' : 'Run Migration'}
                    </Button>

                    {result1 && (
                        <div className={`p-4 rounded-lg border ${result1.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result1.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result1.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result1.success ? 'Migration Completed Successfully!' : 'Migration Failed'}
                                    </p>
                                    {result1.success && result1.count !== undefined && (
                                        <div className="text-sm text-green-700 mt-1">
                                            {result1.count === 0 ? (
                                                <p>No payments needed updating - all RTGS payments are already correct!</p>
                                            ) : (
                                                <>
                                                    <p>✅ Updated {result1.count} RTGS payment{result1.count > 1 ? 's' : ''}</p>
                                                    {result1.skipped && result1.skipped > 0 && (
                                                        <p className="text-amber-700 mt-1">⚠️ Skipped {result1.skipped} payment{result1.skipped > 1 ? 's' : ''} (missing rtgsSrNo)</p>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {!result1.success && result1.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result1.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900 font-medium">⚠️ Important Notes:</p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                            <li>This migration is safe to run multiple times</li>
                            <li>It only updates RTGS payments where paymentId doesn't match rtgsSrNo</li>
                            <li>Check the browser console for detailed logs</li>
                            <li>Refresh the payments page after running to see updated data</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Fix Transaction ID Mismatches</CardTitle>
                    <CardDescription>
                        Fixes expenses/incomes where the transactionId field doesn't match the document ID.
                        This resolves "already exists" errors and ghost entries in history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFixTransactionIdMismatch} 
                        disabled={isRunning2}
                        className="w-full sm:w-auto"
                    >
                        {isRunning2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning2 ? 'Running Migration...' : 'Run Migration'}
                    </Button>

                    {result2 && (
                        <div className={`p-4 rounded-lg border ${result2.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result2.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result2.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result2.success ? 'Migration Completed Successfully!' : 'Migration Failed'}
                                    </p>
                                    {result2.success && result2.count !== undefined && (
                                        <div className="text-sm text-green-700 mt-1">
                                            {result2.count === 0 ? (
                                                <p>No mismatches found - all transaction IDs are correct!</p>
                                            ) : (
                                                <p>✅ Fixed {result2.count} transaction ID mismatch{result2.count > 1 ? 'es' : ''}</p>
                                            )}
                                        </div>
                                    )}
                                    {!result2.success && result2.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result2.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900 font-medium">⚠️ Important Notes:</p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                            <li>Fixes entries where document ID ≠ transactionId field</li>
                            <li>Updates transactionId field to match document ID</li>
                            <li>Resolves "ID already exists" errors</li>
                            <li>Makes ghost entries visible in history</li>
                            <li>Safe to run multiple times</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}



"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { fixRtgsPaymentIds } from '@/scripts/fix-rtgs-payment-ids';
import { fixTransactionIdMismatch } from '@/scripts/fix-transaction-id-mismatch';
import { checkSupplierSerialDuplicates } from '@/scripts/check-supplier-serial-duplicates';
import { fixSupplierSerialDuplicates } from '@/scripts/fix-supplier-serial-duplicates';

export default function MigrationsPage() {
    const [isRunning1, setIsRunning1] = useState(false);
    const [result1, setResult1] = useState<{ success: boolean; count?: number; renamed?: number; duplicatesFixed?: number; skipped?: number; error?: any } | null>(null);
    
    const [isRunning2, setIsRunning2] = useState(false);
    const [result2, setResult2] = useState<{ success: boolean; count?: number; error?: any } | null>(null);
    
    const [isRunning3, setIsRunning3] = useState(false);
    const [result3, setResult3] = useState<{ success: boolean; analysis?: any; error?: any } | null>(null);
    
    const [isRunning4, setIsRunning4] = useState(false);
    const [result4, setResult4] = useState<{ success: boolean; fixedSrNos?: number; fixedIds?: number; errors?: string[]; summary?: string; error?: any } | null>(null);

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
    
    const handleCheckSupplierDuplicates = async () => {
        setIsRunning3(true);
        setResult3(null);
        
        try {
            const analysis = await checkSupplierSerialDuplicates();
            setResult3({ success: true, analysis });
        } catch (error) {
            setResult3({ success: false, error });
        } finally {
            setIsRunning3(false);
        }
    };
    
    const handleFixSupplierDuplicates = async () => {
        setIsRunning4(true);
        setResult4(null);
        
        try {
            const result = await fixSupplierSerialDuplicates();
            setResult4(result);
        } catch (error) {
            setResult4({ success: false, error });
        } finally {
            setIsRunning4(false);
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
                                                    {result1.renamed && result1.renamed > 0 && (
                                                        <p className="text-green-700 mt-1">✅ Renamed {result1.renamed} document{result1.renamed > 1 ? 's' : ''} (R##### → RT#####)</p>
                                                    )}
                                                    {result1.duplicatesFixed && result1.duplicatesFixed > 0 && (
                                                        <p className="text-green-700 mt-1">✅ Fixed {result1.duplicatesFixed} duplicate ID{result1.duplicatesFixed > 1 ? 's' : ''}</p>
                                                    )}
                                                    {result1.skipped && result1.skipped > 0 && (
                                                        <p className="text-amber-700 mt-1">⚠️ Skipped {result1.skipped} payment{result1.skipped > 1 ? 's' : ''} (invalid format)</p>
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
                            <li>Fixes IDs starting with "R" to "RT" format (e.g., R00001 → RT00001)</li>
                            <li>Detects and fixes duplicate RTGS IDs by assigning unique sequential IDs</li>
                            <li>Renames document IDs to match corrected paymentId and rtgsSrNo</li>
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

            <Card>
                <CardHeader>
                    <CardTitle>Check Supplier Serial Number Duplicates</CardTitle>
                    <CardDescription>
                        Analyze all suppliers to find duplicate srNo or id values that cause ConstraintError in bulkPut operations.
                        This will show you exactly which records have duplicate values.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleCheckSupplierDuplicates} 
                        disabled={isRunning3}
                        className="w-full sm:w-auto"
                    >
                        {isRunning3 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning3 ? 'Analyzing...' : 'Check for Duplicates'}
                    </Button>

                    {result3 && (
                        <div className={`p-4 rounded-lg border ${result3.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result3.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result3.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result3.success ? 'Analysis Completed!' : 'Analysis Failed'}
                                    </p>
                                    {result3.success && result3.analysis && (
                                        <div className="text-sm text-green-700 mt-1">
                                            <p className="font-medium">{result3.analysis.summary}</p>
                                            {Object.keys(result3.analysis.duplicateSrNos).length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-red-700 font-medium">🚨 Duplicate Serial Numbers Found:</p>
                                                    {Object.entries(result3.analysis.duplicateSrNos).slice(0, 3).map(([srNo, records]: [string, any[]]) => (
                                                        <p key={srNo} className="text-xs">• {srNo}: {records.length} records</p>
                                                    ))}
                                                    {Object.keys(result3.analysis.duplicateSrNos).length > 3 && (
                                                        <p className="text-xs">... and {Object.keys(result3.analysis.duplicateSrNos).length - 3} more</p>
                                                    )}
                                                </div>
                                            )}
                                            {Object.keys(result3.analysis.duplicateIds).length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-red-700 font-medium">🚨 Duplicate IDs Found:</p>
                                                    {Object.entries(result3.analysis.duplicateIds).slice(0, 3).map(([id, records]: [string, any[]]) => (
                                                        <p key={id} className="text-xs">• {id}: {records.length} records</p>
                                                    ))}
                                                    {Object.keys(result3.analysis.duplicateIds).length > 3 && (
                                                        <p className="text-xs">... and {Object.keys(result3.analysis.duplicateIds).length - 3} more</p>
                                                    )}
                                                </div>
                                            )}
                                            <p className="text-xs mt-2 text-amber-700">Check browser console for detailed analysis</p>
                                        </div>
                                    )}
                                    {!result3.success && result3.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result3.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900 font-medium">ℹ️ What this does:</p>
                        <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                            <li>Scans all suppliers in the database</li>
                            <li>Identifies duplicate srNo values</li>
                            <li>Identifies duplicate id values</li>
                            <li>Shows empty/missing values</li>
                            <li>Provides detailed console logs</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Fix Supplier Serial Number Duplicates</CardTitle>
                    <CardDescription>
                        Automatically fix duplicate srNo and id values by generating unique values.
                        Run the check first to see what will be fixed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFixSupplierDuplicates} 
                        disabled={isRunning4}
                        className="w-full sm:w-auto"
                    >
                        {isRunning4 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isRunning4 ? 'Fixing Duplicates...' : 'Fix Duplicates'}
                    </Button>

                    {result4 && (
                        <div className={`p-4 rounded-lg border ${result4.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-3">
                                {result4.success ? (
                                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className={`font-semibold ${result4.success ? 'text-green-900' : 'text-red-900'}`}>
                                        {result4.success ? 'Fix Completed Successfully!' : 'Fix Failed'}
                                    </p>
                                    {result4.success && (
                                        <div className="text-sm text-green-700 mt-1">
                                            <p className="font-medium">{result4.summary}</p>
                                            {result4.fixedSrNos! > 0 && (
                                                <p>✅ Fixed {result4.fixedSrNos} duplicate serial numbers</p>
                                            )}
                                            {result4.fixedIds! > 0 && (
                                                <p>✅ Fixed {result4.fixedIds} duplicate IDs</p>
                                            )}
                                            {result4.errors && result4.errors.length > 0 && (
                                                <div className="mt-2">
                                                    <p className="text-red-700 font-medium">⚠️ Errors:</p>
                                                    {result4.errors.slice(0, 3).map((error, index) => (
                                                        <p key={index} className="text-xs text-red-600">• {error}</p>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-xs mt-2 text-amber-700">Check browser console for detailed logs</p>
                                        </div>
                                    )}
                                    {!result4.success && result4.error && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Error: {result4.error.message || 'Unknown error occurred'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-900 font-medium">⚠️ Important Notes:</p>
                        <ul className="text-sm text-amber-800 mt-2 space-y-1 list-disc list-inside">
                            <li>Run the check first to see what will be fixed</li>
                            <li>This will modify your supplier data</li>
                            <li>Creates unique srNo/ID values for duplicates</li>
                            <li>Safe to run multiple times</li>
                            <li>Check browser console for detailed logs</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


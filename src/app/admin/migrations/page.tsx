"use client";

import { useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import {
    getAllSuppliers,
    getAllCustomers,
    getAllPayments,
    getAllCustomerPayments,
    fetchLedgerAccounts,
    fetchAllLedgerEntries,
    fetchLedgerCashAccounts,
    fetchMandiReports,
    bulkUpsertSuppliers,
    bulkUpsertCustomers,
    bulkUpsertPayments,
    bulkUpsertCustomerPayments,
    bulkUpsertLedgerAccounts,
    bulkUpsertLedgerEntries,
    bulkUpsertLedgerCashAccounts,
    bulkUpsertMandiReports,
} from '@/lib/firestore';
import { calculateSupplierEntry } from '@/lib/utils';
import { syncAllData } from '@/lib/database';
import type { Customer, Payment, CustomerPayment, LedgerAccount, LedgerEntry, LedgerCashAccount, MandiReport } from '@/lib/definitions';
import { fixRtgsPaymentIds } from '@/scripts/fix-rtgs-payment-ids';
import { fixTransactionIdMismatch } from '@/scripts/fix-transaction-id-mismatch';
import { checkSupplierSerialDuplicates } from '@/scripts/check-supplier-serial-duplicates';
import { fixSupplierSerialDuplicates } from '@/scripts/fix-supplier-serial-duplicates';

const serializeRecord = (record: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    Object.entries(record).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }
        if (Array.isArray(value) || (value && typeof value === 'object')) {
            try {
                result[key] = JSON.stringify(value);
            } catch {
                result[key] = String(value);
            }
        } else {
            result[key] = value;
        }
    });
    return result;
};

const parseMaybeJson = (value: unknown) => {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }
    return value;
};

const deserializeRow = (row: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    Object.entries(row).forEach(([key, value]) => {
        result[key] = parseMaybeJson(value);
    });
    return result;
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        const numeric = Number(value.replace(/,/g, ''));
        return Number.isFinite(numeric) ? numeric : 0;
    }
    return 0;
};

const ensureId = (value: unknown): string => {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeSupplier = (raw: Record<string, any>): Customer => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id);
    if (!base.srNo && typeof base.paymentId === 'string') {
        base.srNo = base.paymentId;
    }
    base.grossWeight = toNumber(base.grossWeight);
    base.teirWeight = toNumber(base.teirWeight);
    base.kartaPercentage = Number(base.kartaPercentage) || 0;
    base.rate = Number(base.rate) || 0;
    base.labouryRate = Number(base.labouryRate) || 0;
    base.kanta = Number(base.kanta) || 0;
    const computed = calculateSupplierEntry({
        grossWeight: base.grossWeight,
        teirWeight: base.teirWeight,
        kartaPercentage: base.kartaPercentage,
        rate: base.rate,
        labouryRate: base.labouryRate,
        kanta: base.kanta,
    });
    base.weight = computed.weight;
    base.kartaWeight = computed.kartaWeight;
    base.kartaAmount = computed.kartaAmount;
    base.netWeight = computed.netWeight;
    base.amount = computed.amount;
    base.labouryAmount = computed.labouryAmount;
    base.originalNetAmount = computed.originalNetAmount;
    base.netAmount = computed.netAmount;
    if (!base.date) {
        base.date = new Date().toISOString().split('T')[0];
    }
    if (!base.dueDate) {
        base.dueDate = base.date;
    }
    return base as Customer;
};

const normalizePayment = (raw: Record<string, any>): Payment => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id || base.paymentId);
    base.amount = toNumber(base.amount);
    if (base.cdAmount !== undefined) base.cdAmount = toNumber(base.cdAmount);
    if (base.quantity !== undefined) base.quantity = toNumber(base.quantity);
    if (base.rate !== undefined) base.rate = toNumber(base.rate);
    if (base.rtgsAmount !== undefined) base.rtgsAmount = toNumber(base.rtgsAmount);
    if (!Array.isArray(base.paidFor)) {
        base.paidFor = [];
    }
    return base as Payment;
};

const normalizeCustomerPayment = (raw: Record<string, any>): CustomerPayment => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id || base.paymentId);
    base.amount = toNumber(base.amount);
    if (!Array.isArray(base.paidFor)) {
        base.paidFor = [];
    }
    return base as CustomerPayment;
};

const normalizeLedgerAccount = (raw: Record<string, any>): LedgerAccount => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id);
    base.name = base.name || 'Account';
    base.createdAt = base.createdAt || new Date().toISOString();
    base.updatedAt = base.updatedAt || base.createdAt;
    return base as LedgerAccount;
};

const normalizeLedgerEntry = (raw: Record<string, any>): LedgerEntry => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id);
    base.accountId = base.accountId || '';
    base.date = base.date || new Date().toISOString().split('T')[0];
    base.particulars = base.particulars || '-';
    base.debit = toNumber(base.debit);
    base.credit = toNumber(base.credit);
    base.balance = toNumber(base.balance);
    base.createdAt = base.createdAt || new Date().toISOString();
    base.updatedAt = base.updatedAt || base.createdAt;
    if (base.linkStrategy !== 'mirror' && base.linkStrategy !== 'same') {
        base.linkStrategy = undefined;
    }
    return base as LedgerEntry;
};

const normalizeLedgerCashAccount = (raw: Record<string, any>): LedgerCashAccount => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id);
    base.name = base.name || 'Cash Account';
    const noteGroupsRaw = (base.noteGroups && typeof base.noteGroups === 'object') ? base.noteGroups : {};
    const normalizedNoteGroups: Record<string, number[]> = {};
    Object.entries(noteGroupsRaw as Record<string, any>).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            normalizedNoteGroups[key] = value.map(toNumber);
        } else {
            normalizedNoteGroups[key] = [];
        }
    });
    base.noteGroups = normalizedNoteGroups;
    base.createdAt = base.createdAt || new Date().toISOString();
    base.updatedAt = base.updatedAt || base.createdAt;
    return base as LedgerCashAccount;
};

const normalizeMandiReport = (raw: Record<string, any>): MandiReport => {
    const base = { ...raw } as Record<string, any>;
    base.id = ensureId(base.id);
    base.quantityQtl = toNumber(base.quantityQtl);
    base.ratePerQtl = toNumber(base.ratePerQtl);
    base.grossAmount = toNumber(base.grossAmount);
    base.netAmount = toNumber(base.netAmount);
    base.mandiFee = toNumber(base.mandiFee);
    base.developmentCess = toNumber(base.developmentCess);
    base.totalCharges = toNumber(base.totalCharges);
    base.paymentAmount = toNumber(base.paymentAmount);
    return base as MandiReport;
};

const recalculateLedgerBalances = (entries: LedgerEntry[]) => {
    const grouped = new Map<string, LedgerEntry[]>();
    entries.forEach((entry) => {
        if (!entry.accountId) return;
        if (!grouped.has(entry.accountId)) {
            grouped.set(entry.accountId, []);
        }
        grouped.get(entry.accountId)!.push(entry);
    });

    const updated: LedgerEntry[] = [];
    const isoNow = new Date().toISOString();
    grouped.forEach((accountEntries) => {
        accountEntries.sort((a, b) => {
            const dateCompare = (a.date || '').localeCompare(b.date || '');
            if (dateCompare !== 0) return dateCompare;
            return (a.createdAt || '').localeCompare(b.createdAt || '');
        });
        let running = 0;
        accountEntries.forEach((entry) => {
            running = Math.round((running + entry.debit - entry.credit) * 100) / 100;
            entry.balance = running;
            entry.updatedAt = entry.updatedAt || isoNow;
            updated.push(entry);
        });
    });
    return updated;
};

export default function MigrationsPage() {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importSummary, setImportSummary] = useState<string | null>(null);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [isRunning1, setIsRunning1] = useState(false);
    const [result1, setResult1] = useState<{ success: boolean; count?: number; renamed?: number; duplicatesFixed?: number; skipped?: number; error?: string } | null>(null);
    
    const [isRunning2, setIsRunning2] = useState(false);
    const [result2, setResult2] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
    
    const [isRunning3, setIsRunning3] = useState(false);
    const [result3, setResult3] = useState<{ success: boolean; analysis?: Record<string, unknown>; error?: string } | null>(null);
    
    const [isRunning4, setIsRunning4] = useState(false);
    const [result4, setResult4] = useState<{ success: boolean; fixedSrNos?: number; fixedIds?: number; errors?: string[]; summary?: string; error?: string } | null>(null);

    const appendSheet = (workbook: XLSX.WorkBook, name: string, data: Record<string, any>[]) => {
        if (!data.length) return;
        const sheet = XLSX.utils.json_to_sheet(data.map(serializeRecord));
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };

    const handleExport = async () => {
        setIsExporting(true);
        setImportSummary(null);
        setImportErrors([]);
        try {
            const [
                suppliers,
                customers,
                supplierPayments,
                customerPayments,
                ledgerAccounts,
                ledgerEntries,
                ledgerCashAccounts,
                mandiReports,
            ] = await Promise.all([
                getAllSuppliers(),
                getAllCustomers(),
                getAllPayments(),
                getAllCustomerPayments(),
                fetchLedgerAccounts(),
                fetchAllLedgerEntries(),
                fetchLedgerCashAccounts(),
                fetchMandiReports(),
            ]);

            const workbook = XLSX.utils.book_new();
            appendSheet(workbook, 'Suppliers', suppliers as unknown as Record<string, any>[]);
            appendSheet(workbook, 'Customers', customers as unknown as Record<string, any>[]);
            appendSheet(workbook, 'SupplierPayments', supplierPayments as unknown as Record<string, any>[]);
            appendSheet(workbook, 'CustomerPayments', customerPayments as unknown as Record<string, any>[]);
            appendSheet(workbook, 'LedgerAccounts', ledgerAccounts as unknown as Record<string, any>[]);
            appendSheet(workbook, 'LedgerEntries', ledgerEntries as unknown as Record<string, any>[]);
            appendSheet(workbook, 'LedgerCashAccounts', ledgerCashAccounts as unknown as Record<string, any>[]);
            appendSheet(workbook, 'MandiReports', mandiReports as unknown as Record<string, any>[]);

            if (!workbook.SheetNames.length) {
                toast({
                    title: 'No data to export',
                    description: 'No records were found across the tracked collections.',
                    variant: 'destructive',
                });
            } else {
                const filename = `bizsuite_backup_${new Date().toISOString().slice(0, 10)}.xlsx`;
                XLSX.writeFile(workbook, filename);
                toast({
                    title: 'Export complete',
                    description: `Saved ${workbook.SheetNames.length} sheets to ${filename}.`,
                });
            }
        } catch (error: unknown) {

            toast({
                title: 'Export failed',
                description: (error instanceof Error ? error.message : 'Unable to export data.'),
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const processImportFile = async (file: File) => {
        setIsImporting(true);
        setImportSummary(null);
        setImportErrors([]);

        const errors: string[] = [];
        const summaryParts: string[] = [];

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const readSheet = (name: string) => {
                const sheet = workbook.Sheets[name];
                if (!sheet) return [] as Record<string, any>[];
                const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
                return rows.map(deserializeRow);
            };

            const supplierRows = readSheet('Suppliers');
            const customerRows = readSheet('Customers');
            const supplierPaymentRows = readSheet('SupplierPayments');
            const customerPaymentRows = readSheet('CustomerPayments');
            const ledgerAccountRows = readSheet('LedgerAccounts');
            const ledgerEntryRows = readSheet('LedgerEntries');
            const ledgerCashAccountRows = readSheet('LedgerCashAccounts');
            const mandiReportRows = readSheet('MandiReports');

            if (supplierRows.length) {
                try {
                    const suppliers = supplierRows.map(normalizeSupplier);
                    await bulkUpsertSuppliers(suppliers);
                    summaryParts.push(`${suppliers.length} suppliers`);
                } catch (error: unknown) {

                    errors.push(`Suppliers: ${error?.message || 'Unknown error'}`);
                }
            }

            if (customerRows.length) {
                try {
                    const customers = customerRows.map((row) => normalizeSupplier(row) as unknown as Customer);
                    await bulkUpsertCustomers(customers);
                    summaryParts.push(`${customers.length} customers`);
                } catch (error: unknown) {

                    errors.push(`Customers: ${error?.message || 'Unknown error'}`);
                }
            }

            if (supplierPaymentRows.length) {
                try {
                    const payments = supplierPaymentRows.map(normalizePayment);
                    await bulkUpsertPayments(payments);
                    summaryParts.push(`${payments.length} supplier payments`);
                } catch (error: unknown) {

                    errors.push(`Supplier payments: ${error?.message || 'Unknown error'}`);
                }
            }

            if (customerPaymentRows.length) {
                try {
                    const payments = customerPaymentRows.map(normalizeCustomerPayment);
                    await bulkUpsertCustomerPayments(payments);
                    summaryParts.push(`${payments.length} customer payments`);
                } catch (error: unknown) {

                    errors.push(`Customer payments: ${error?.message || 'Unknown error'}`);
                }
            }

            if (ledgerAccountRows.length) {
                try {
                    const accounts = ledgerAccountRows.map(normalizeLedgerAccount);
                    await bulkUpsertLedgerAccounts(accounts);
                    summaryParts.push(`${accounts.length} ledger accounts`);
                } catch (error: unknown) {

                    errors.push(`Ledger accounts: ${error?.message || 'Unknown error'}`);
                }
            }

            if (ledgerEntryRows.length) {
                try {
                    const entries = ledgerEntryRows.map(normalizeLedgerEntry);
                    const recalculated = recalculateLedgerBalances(entries);
                    await bulkUpsertLedgerEntries(recalculated);
                    summaryParts.push(`${recalculated.length} ledger entries`);
                } catch (error: unknown) {

                    errors.push(`Ledger entries: ${error?.message || 'Unknown error'}`);
                }
            }

            if (ledgerCashAccountRows.length) {
                try {
                    const cashAccounts = ledgerCashAccountRows.map(normalizeLedgerCashAccount);
                    await bulkUpsertLedgerCashAccounts(cashAccounts);
                    summaryParts.push(`${cashAccounts.length} ledger cash accounts`);
                } catch (error: unknown) {

                    errors.push(`Ledger cash accounts: ${error?.message || 'Unknown error'}`);
                }
            }

            if (mandiReportRows.length) {
                try {
                    const reports = mandiReportRows.map(normalizeMandiReport);
                    await bulkUpsertMandiReports(reports);
                    summaryParts.push(`${reports.length} mandi reports`);
                } catch (error: unknown) {

                    errors.push(`Mandi reports: ${error?.message || 'Unknown error'}`);
                }
            }

            if (summaryParts.length) {
                setImportSummary(`Imported ${summaryParts.join(', ')} from ${file.name}.`);
                toast({
                    title: 'Import complete',
                    description: summaryParts.join(', '),
                });
                await syncAllData();
            } else {
                setImportSummary(`No supported sheets found in ${file.name}.`);
            }

            if (errors.length) {
                setImportErrors(errors);
            }
        } catch (error: unknown) {

            setImportSummary(null);
            setImportErrors([error?.message || 'Unknown import error.']);
            toast({
                title: 'Import failed',
                description: error?.message || 'Unable to import workbook.',
                variant: 'destructive',
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleImportClick = () => {
        setImportSummary(null);
        setImportErrors([]);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await processImportFile(file);
        if (event.target) {
            event.target.value = '';
        }
    };

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

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Backup & Sync</CardTitle>
                    <CardDescription>
                        Export all Firestore collections to Excel or import curated workbooks. Supplier amounts and ledger balances are recalculated automatically before saving.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={handleExport}
                            disabled={isExporting || isImporting}
                            className="w-full sm:w-auto"
                        >
                            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isExporting ? 'Exporting...' : (
                                <>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export to Excel
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={handleImportClick}
                            disabled={isImporting || isExporting}
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isImporting ? 'Importing...' : (
                                <>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import from Excel
                                </>
                            )}
                        </Button>
                    </div>

                    {importSummary && (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                            {importSummary}
                        </div>
                    )}

                    {importErrors.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
                            <p className="font-semibold">Warnings</p>
                            {importErrors.map((error, index) => (
                                <p key={index}>• {error}</p>
                            ))}
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Export includes suppliers, customers, payments, ledger accounts, ledger entries, cash accounts, and mandi reports. Import recalculates financial fields, writes to Firestore in batches, and refreshes the local IndexedDB cache.
                    </p>
                </CardContent>
            </Card>

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


"use client";

import { useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Download, Upload, FolderOpen, FolderInput } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    migrateGovFinalizedPaymentsToPayments,
    type MigrateGovFinalizedToPaymentsResult,
} from '@/lib/firestore';
import { calculateSupplierEntry } from '@/lib/utils';
import { syncAllData } from '@/lib/database';
import { Wrench, ArrowRightLeft, DatabaseZap, FileSpreadsheet } from 'lucide-react';
import type { Customer, Payment, CustomerPayment, LedgerAccount, LedgerEntry, LedgerCashAccount, MandiReport } from '@/lib/definitions';
import { fixRtgsPaymentIds } from '@/scripts/fix-rtgs-payment-ids';
import { fixTransactionIdMismatch, type FixTransactionIdMismatchResult } from '@/scripts/fix-transaction-id-mismatch';
import { checkSupplierSerialDuplicates, type DuplicateAnalysis } from '@/scripts/check-supplier-serial-duplicates';
import type { FixResult } from '@/scripts/fix-supplier-serial-duplicates';
import { fixSupplierSerialDuplicates } from '@/scripts/fix-supplier-serial-duplicates';
import { MigrationResult, migrateUpdatedAt } from '@/lib/migration-utils';
import { exportToFolder, importFromFolder } from '@/lib/folder-structure-export';
import { cn } from '@/lib/utils';
import { DataMigrationCard } from '@/components/settings/data-migration-card';
import { SqliteMigrationCard } from '@/components/admin/sqlite-migration-card';

type MigrationError = { message?: string } | string;

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
    const [result1, setResult1] = useState<{ success: boolean; count?: number; renamed?: number; duplicatesFixed?: number; skipped?: number; error?: MigrationError } | null>(null);
    
    const [isRunning2, setIsRunning2] = useState(false);
    const [result2, setResult2] = useState<FixTransactionIdMismatchResult | null>(null);
    
    const [isRunning3, setIsRunning3] = useState(false);
    const [result3, setResult3] = useState<{ success: boolean; analysis?: DuplicateAnalysis; error?: MigrationError } | null>(null);
    
    const [isRunning4, setIsRunning4] = useState(false);
    const [result4, setResult4] = useState<FixResult | null>(null);

    const [isRunning5, setIsRunning5] = useState(false);
    const [result5, setResult5] = useState<MigrationResult[] | null>(null);

    const [isRunning6, setIsRunning6] = useState(false);
    const [result6, setResult6] = useState<MigrateGovFinalizedToPaymentsResult | null>(null);
    const [govMigrateDeleteSource, setGovMigrateDeleteSource] = useState(false);

    const [isFolderExporting, setIsFolderExporting] = useState(false);
    const [isFolderImporting, setIsFolderImporting] = useState(false);
    const [folderResult, setFolderResult] = useState<{ type: 'export' | 'import'; success: boolean; message: string; details?: string } | null>(null);

    const handleMigrateGovFinalizedToPayments = async () => {
        if (!confirm('Gov Finalized payments ko Payments collection mein copy karenge. Continue?')) return;
        setIsRunning6(true);
        setResult6(null);
        try {
            const res = await migrateGovFinalizedPaymentsToPayments({ deleteFromSource: govMigrateDeleteSource });
            setResult6(res);
            if (res.success) {
                toast({ title: 'Migration Complete', description: `${res.migrated} payment(s) migrated to Payments.` });
            } else {
                toast({ title: 'Migration Failed', description: res.error, variant: 'destructive' });
            }
        } catch (e) {
            toast({ title: 'Migration Failed', description: String(e), variant: 'destructive' });
            setResult6({ success: false, migrated: 0, skipped: 0, error: String(e) });
        } finally {
            setIsRunning6(false);
        }
    };

    const handleUpdatedAtMigration = async () => {
        if (!confirm("This will update ALL documents in ALL collections with a new 'updatedAt' timestamp. This ensures all data syncs correctly but will cause a one-time re-download on other devices. Continue?")) return;
        setIsRunning5(true);
        setResult5(null);
        try {
            const results = await migrateUpdatedAt();
            setResult5(results);
            toast({ title: "Migration Complete", description: "Updated all documents." });
        } catch (e) {
            toast({ title: "Migration Failed", description: String(e), variant: "destructive" });
        } finally {
            setIsRunning5(false);
        }
    };

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
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Suppliers: ${message}`);
                }
            }

            if (customerRows.length) {
                try {
                    const customers = customerRows.map((row) => normalizeSupplier(row) as unknown as Customer);
                    await bulkUpsertCustomers(customers);
                    summaryParts.push(`${customers.length} customers`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Customers: ${message}`);
                }
            }

            if (supplierPaymentRows.length) {
                try {
                    const payments = supplierPaymentRows.map(normalizePayment);
                    await bulkUpsertPayments(payments);
                    summaryParts.push(`${payments.length} supplier payments`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Supplier payments: ${message}`);
                }
            }

            if (customerPaymentRows.length) {
                try {
                    const payments = customerPaymentRows.map(normalizeCustomerPayment);
                    await bulkUpsertCustomerPayments(payments);
                    summaryParts.push(`${payments.length} customer payments`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Customer payments: ${message}`);
                }
            }

            if (ledgerAccountRows.length) {
                try {
                    const accounts = ledgerAccountRows.map(normalizeLedgerAccount);
                    await bulkUpsertLedgerAccounts(accounts);
                    summaryParts.push(`${accounts.length} ledger accounts`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Ledger accounts: ${message}`);
                }
            }

            if (ledgerEntryRows.length) {
                try {
                    const entries = ledgerEntryRows.map(normalizeLedgerEntry);
                    const recalculated = recalculateLedgerBalances(entries);
                    await bulkUpsertLedgerEntries(recalculated);
                    summaryParts.push(`${recalculated.length} ledger entries`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Ledger entries: ${message}`);
                }
            }

            if (ledgerCashAccountRows.length) {
                try {
                    const cashAccounts = ledgerCashAccountRows.map(normalizeLedgerCashAccount);
                    await bulkUpsertLedgerCashAccounts(cashAccounts);
                    summaryParts.push(`${cashAccounts.length} ledger cash accounts`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Ledger cash accounts: ${message}`);
                }
            }

            if (mandiReportRows.length) {
                try {
                    const reports = mandiReportRows.map(normalizeMandiReport);
                    await bulkUpsertMandiReports(reports);
                    summaryParts.push(`${reports.length} mandi reports`);
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Mandi reports: ${message}`);
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
            const message = error instanceof Error ? error.message : 'Unknown import error.';
            setImportSummary(null);
            setImportErrors([message]);
            toast({
                title: 'Import failed',
                description: message || 'Unable to import workbook.',
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
            const message = error instanceof Error ? error.message : String(error);
            setResult1({ success: false, error: message });
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
            const message = error instanceof Error ? error.message : String(error);
            setResult2({ success: false, count: 0, errors: [message], error: message });
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
            const message = error instanceof Error ? error.message : String(error);
            setResult3({ success: false, error: message });
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
            const message = error instanceof Error ? error.message : String(error);
            setResult4({ success: false, fixedSrNos: 0, fixedIds: 0, skipped: 0, errors: [message], summary: 'Fix failed due to error', error: message });
        } finally {
            setIsRunning4(false);
        }
    };

    const handleExportToFolder = async () => {
        const electron = typeof window !== 'undefined' ? (window as unknown as { electron?: { selectFolder: () => Promise<string | null> } }).electron : undefined;
        if (!electron?.selectFolder) {
            toast({ title: 'Electron required', description: 'Folder export works only in Electron desktop app. Run: npm run electron:dev', variant: 'destructive' });
            return;
        }
        const folderPath = await electron.selectFolder();
        if (!folderPath) return;
        setIsFolderExporting(true);
        setFolderResult(null);
        try {
            const res = await exportToFolder(folderPath);
            if (res.success) {
                setFolderResult({ type: 'export', success: true, message: `Exported ${res.filesWritten} files`, details: folderPath });
                toast({ title: 'Export complete', description: `${res.filesWritten} files saved to folder.`, variant: 'success' });
            } else {
                setFolderResult({ type: 'export', success: false, message: res.error || 'Export failed' });
                toast({ title: 'Export failed', description: res.error, variant: 'destructive' });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setFolderResult({ type: 'export', success: false, message: msg });
            toast({ title: 'Export failed', description: msg, variant: 'destructive' });
        } finally {
            setIsFolderExporting(false);
        }
    };

    const handleImportFromFolder = async () => {
        const electron = typeof window !== 'undefined' ? (window as unknown as { electron?: { selectFolder: () => Promise<string | null> } }).electron : undefined;
        if (!electron?.selectFolder) {
            toast({ title: 'Electron required', description: 'Folder import works only in Electron desktop app. Run: npm run electron:dev', variant: 'destructive' });
            return;
        }
        const folderPath = await electron.selectFolder();
        if (!folderPath) return;
        setIsFolderImporting(true);
        setFolderResult(null);
        try {
            const res = await importFromFolder(folderPath);
            if (res.summary.length) {
                setFolderResult({ type: 'import', success: res.errors.length === 0, message: res.summary.join(', '), details: res.errors.length ? res.errors.join('; ') : undefined });
                toast({ title: 'Import complete', description: res.summary.join(', '), variant: res.errors.length ? 'default' : 'success' });
            } else {
                setFolderResult({ type: 'import', success: false, message: 'No data found in folder or invalid structure.' });
                toast({ title: 'Import failed', description: 'No supported files found in folder.', variant: 'destructive' });
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setFolderResult({ type: 'import', success: false, message: msg });
            toast({ title: 'Import failed', description: msg, variant: 'destructive' });
        } finally {
            setIsFolderImporting(false);
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Data Migration</h1>
                <p className="text-muted-foreground mt-2">Run data fixes, ERP migrations and backups</p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
            />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Left Column: ERP & SQLite */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <ArrowRightLeft className="h-6 w-6 text-primary" />
                            ERP Season Migration
                        </h2>
                        <DataMigrationCard />
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <DatabaseZap className="h-6 w-6 text-primary" />
                            SQLite Database Management
                        </h2>
                        <SqliteMigrationCard />
                    </section>
                </div>

                {/* Right Column: Excel & Folder Backup */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <FileSpreadsheet className="h-6 w-6 text-primary" />
                            Excel Backup & Sync
                        </h2>
                        <Card>
                            <CardHeader>
                                <CardTitle>Backup & Sync</CardTitle>
                                <CardDescription>
                                    Export all Firestore collections to Excel or import curated workbooks. 
                                    Supplier amounts and ledger balances are recalculated automatically.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={handleExport}
                                        disabled={isExporting || isImporting}
                                        size="sm"
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
                                        size="sm"
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
                                        <p className="font-semibold text-xs uppercase tracking-wider opacity-70">Warnings</p>
                                        {importErrors.map((error, index) => (
                                            <p key={index}>• {error}</p>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <FolderOpen className="h-6 w-6 text-primary" />
                            Local Folder Backup
                        </h2>
                        <Card>
                            <CardHeader>
                                <CardTitle>Folder Export / Import</CardTitle>
                                <CardDescription>
                                    Export data to a folder with menu-based structure (Entry, Payments, etc.). 
                                    Requires Electron desktop app.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={handleExportToFolder}
                                        disabled={isFolderExporting || isFolderImporting}
                                        variant="outline"
                                        size="sm"
                                    >
                                        {isFolderExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isFolderExporting ? 'Exporting...' : (
                                            <>
                                                <FolderOpen className="mr-2 h-4 w-4" />
                                                Export to Folder
                                            </>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={handleImportFromFolder}
                                        disabled={isFolderImporting || isFolderExporting}
                                        variant="outline"
                                        size="sm"
                                    >
                                        {isFolderImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isFolderImporting ? 'Importing...' : (
                                            <>
                                                <FolderInput className="mr-2 h-4 w-4" />
                                                Import from Folder
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {folderResult && (
                                    <div className={cn(
                                        "rounded-lg border p-4 text-sm",
                                        folderResult.success ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
                                    )}>
                                        <p className="font-semibold">{folderResult.success ? 'Success' : 'Failed'}</p>
                                        <p>{folderResult.message}</p>
                                        {folderResult.details && <p className="mt-1 text-xs opacity-80">{folderResult.details}</p>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </div>

            <div className="border-t pt-8 mt-4">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <Wrench className="h-7 w-7 text-primary" />
                    Database Utilities & Fixes
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fix RTGS Payment IDs</CardTitle>
                            <CardDescription>Updates paymentId field to match rtgsSrNo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleFixRtgsPaymentIds} disabled={isRunning1} size="sm" className="w-full">
                                {isRunning1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Run Migration'}
                            </Button>
                            {result1 && (
                                <div className={cn("p-3 rounded-lg border text-[10px]", result1.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800')}>
                                    {result1.success ? `Success: ${result1.count || 0} updated` : `Error: ${typeof result1.error === 'string' ? result1.error : (result1.error as any)?.message || 'Unknown'}`}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Fix Transaction ID Mismatch</CardTitle>
                            <CardDescription>Resolves "already exists" errors in history.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleFixTransactionIdMismatch} disabled={isRunning2} size="sm" className="w-full">
                                {isRunning2 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Run Migration'}
                            </Button>
                            {result2 && (
                                <div className={cn("p-3 rounded-lg border text-[10px]", result2.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800')}>
                                    {result2.success ? `Success: ${result2.count || 0} fixed` : `Error: ${result2.error || 'Unknown'}`}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Check/Fix Supplier Duplicates</CardTitle>
                            <CardDescription>Finds and fixes duplicate srNo or ID values.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Button onClick={handleCheckSupplierDuplicates} disabled={isRunning3} size="sm" variant="outline" className="flex-1">
                                    Check
                                </Button>
                                <Button onClick={handleFixSupplierDuplicates} disabled={isRunning4} size="sm" className="flex-1">
                                    Fix
                                </Button>
                            </div>
                            {result3 && <div className="text-[10px] text-muted-foreground bg-muted p-2 rounded">{result3.analysis?.summary}</div>}
                            {result4 && <div className="text-[10px] text-green-700 font-medium">{result4.summary}</div>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Gov Finalized \u2192 Payments</CardTitle>
                            <CardDescription>Copies Gov Payments to main Payments collection.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <input type="checkbox" id="gov-migrate-delete" checked={govMigrateDeleteSource} onChange={(e) => setGovMigrateDeleteSource(e.target.checked)} className="rounded border-gray-300 h-3 w-3" />
                                <Label htmlFor="gov-migrate-delete" className="text-[10px] cursor-pointer">Delete from source</Label>
                            </div>
                            <Button onClick={handleMigrateGovFinalizedToPayments} disabled={isRunning6} size="sm" className="w-full">
                                Migrate
                            </Button>
                            {result6 && (
                                <div className={cn("p-2 rounded border text-[10px]", result6.success ? "bg-green-50" : "bg-red-50")}>
                                    {result6.success ? `${result6.migrated} migrated` : result6.error}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Sync Metadata: UpdatedAt Migration</CardTitle>
                            <CardDescription>Updates all docs with 'updatedAt' for efficient syncing.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button onClick={handleUpdatedAtMigration} disabled={isRunning5} size="sm">
                                {isRunning5 ? 'Migrating...' : 'Run Update Migration'}
                            </Button>
                            {result5 && (
                                <ScrollArea className="h-32 mt-2 rounded border bg-white">
                                    <div className="divide-y text-[10px]">
                                        {result5.map((res, i) => (
                                            <div key={i} className="p-1 px-3 flex justify-between">
                                                <span className="font-medium text-muted-foreground">{res.collection}</span>
                                                <span className={res.status === 'success' ? 'text-green-600 font-bold' : 'text-red-600'}>
                                                    {res.status === 'success' ? res.updated : 'Err'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}


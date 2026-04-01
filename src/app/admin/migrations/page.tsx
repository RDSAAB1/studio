"use client";

import { useRef, useState, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Download, Upload, FolderOpen, FolderInput } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <div className="mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500 min-h-screen bg-background">
            {/* Standard Dashboard Header - Refined & Subtle */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/60">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Data Migration</h1>
                    <p className="text-muted-foreground text-xs font-medium">
                        Administrative node for structural synchronization and local storage protocols
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 flex items-center gap-2 text-[11px] font-bold text-muted-foreground bg-card border border-border/80 rounded-[6px] shadow-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary/80" />
                        Infrastructure Secure
                    </div>
                </div>
            </header>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
            />

            <Tabs defaultValue="sqlite" className="w-full space-y-6">
                {/* Theme-Consistent Tab Bar - Standard 3D style */}
                <div className="flex justify-center md:justify-start">
                    <TabsList className="bg-muted/80 backdrop-blur-sm border shadow-sm h-11">
                        <TabsTrigger value="sqlite" className="px-6 gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
                            <DatabaseZap className="h-4 w-4" />
                            Local Hub
                        </TabsTrigger>
                        <TabsTrigger value="erp" className="px-6 gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
                            <ArrowRightLeft className="h-4 w-4" />
                            ERP Migrate
                        </TabsTrigger>
                        <TabsTrigger value="backups" className="px-6 gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
                            <FileSpreadsheet className="h-4 w-4" />
                            Secure Vault
                        </TabsTrigger>
                        <TabsTrigger value="tools" className="px-6 gap-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md">
                            <Wrench className="h-4 w-4" />
                            Logic Repair
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Content Sections */}
                <TabsContent value="sqlite" className="focus-visible:outline-none focus-visible:ring-0 animate-in slide-in-from-left-2 duration-300">
                    <SqliteMigrationCard />
                </TabsContent>

                <TabsContent value="erp" className="space-y-8 focus-visible:outline-none focus-visible:ring-0 animate-in slide-in-from-left-2 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                        <div className="lg:col-span-3">
                             <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">ERP Segment Migration</h3>
                                <div className="h-[2px] flex-1 bg-slate-200" />
                             </div>
                             <DataMigrationCard />
                        </div>
                        
                        <div className="space-y-6 pt-12">
                            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-4">
                                <h4 className="font-black flex items-center gap-3 text-indigo-600 uppercase tracking-widest text-[11px]">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Integrity Shield
                                </h4>
                                <p className="text-xs text-slate-600 leading-relaxed font-bold">
                                    Records are cross-verified to maintain structural consistency and prevent duplicates during season resets. Automated validation layer active.
                                </p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="backups" className="space-y-6 focus-visible:outline-none focus-visible:ring-0 animate-in slide-in-from-left-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="ui-card p-6 bg-white space-y-6 flex flex-col justify-between min-h-[250px]">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100/50">
                                        <FileSpreadsheet className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-bold text-foreground">Excel Workbook Sync</h4>
                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Spreadsheet compatibility mode</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                    Export system data into Spreadsheet format for offline analytics or manual workbook restoration. Supports .xlsx and .xls signatures.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleExport}
                                        disabled={isExporting || isImporting}
                                        className="flex-1 rounded-md h-10 shadow-md shadow-primary/10 text-[11px] font-bold uppercase tracking-widest bg-primary hover:bg-primary/90"
                                    >
                                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Export Workbook'}
                                    </Button>
                                    <Button
                                        onClick={handleImportClick}
                                        disabled={isImporting || isExporting}
                                        variant="outline"
                                        className="flex-1 rounded-md h-10 text-[11px] font-bold uppercase tracking-widest"
                                    >
                                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Restore File'}
                                    </Button>
                                </div>
                                {importSummary && (
                                    <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2.5 flex items-center gap-3">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest truncate">{importSummary}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ui-card p-6 bg-white space-y-6 flex flex-col justify-between min-h-[250px]">
                             <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-md bg-primary/5 text-primary border border-primary/10">
                                        <FolderOpen className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-bold text-foreground">Directory Snapshot</h4>
                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Fast local storage mirror</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                                    Safeguard massive datasets directly to local directories. Provides rapid, high-throughput synchronization for critical workloads.
                                </p>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex gap-3">
                                    <Button
                                        onClick={handleExportToFolder}
                                        disabled={isFolderExporting || isFolderImporting}
                                        className="flex-1 rounded-md h-10 shadow-md shadow-primary/10 text-[11px] font-bold uppercase tracking-widest bg-primary hover:bg-primary/90"
                                    >
                                        {isFolderExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Folder Export'}
                                    </Button>
                                    <Button
                                        onClick={handleImportFromFolder}
                                        disabled={isFolderImporting || isFolderExporting}
                                        variant="outline"
                                        className="flex-1 rounded-md h-10 text-[11px] font-bold uppercase tracking-widest"
                                    >
                                        {isFolderImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync Path'}
                                    </Button>
                                </div>
                                {folderResult && (
                                    <div className={cn("rounded-md p-2.5 flex items-center gap-3 border", folderResult.success ? "bg-emerald-50 border-emerald-100 text-emerald-800" : "bg-rose-50 border-rose-100 text-rose-800")}>
                                        {folderResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                        <p className="text-[10px] font-bold uppercase tracking-widest truncate">{folderResult.message}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="tools" className="space-y-4 focus-visible:outline-none focus-visible:ring-0 pb-16 animate-in slide-in-from-left-2 duration-300">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="ui-card p-5 bg-white space-y-5 flex flex-col justify-between overflow-hidden relative">
                             <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                             <div className="space-y-0.5">
                                 <h4 className="text-sm font-bold text-foreground">RTGS Correction</h4>
                                 <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Payment ID standardization</p>
                             </div>
                             <div className="space-y-2">
                                 <Button onClick={handleFixRtgsPaymentIds} disabled={isRunning1} size="sm" className="w-full h-9 rounded-md font-bold text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm">
                                     {isRunning1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Run Correction'}
                                 </Button>
                                 {result1 && (
                                     <div className={cn("py-1.5 px-3 rounded-md border text-[10px] font-bold text-center uppercase tracking-widest", result1.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700')}>
                                         {result1.success ? `Updated: ${result1.count}` : 'Failed'}
                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="ui-card p-5 bg-white space-y-5 flex flex-col justify-between overflow-hidden relative">
                             <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40" />
                             <div className="space-y-0.5">
                                 <h4 className="text-sm font-bold text-foreground">Key Conflict Resolve</h4>
                                 <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Transaction key Regeneration</p>
                             </div>
                             <div className="space-y-2">
                                 <Button onClick={handleFixTransactionIdMismatch} disabled={isRunning2} size="sm" className="w-full h-9 rounded-md font-bold text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm">
                                     {isRunning2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Resolve Conflicts'}
                                 </Button>
                                 {result2 && (
                                     <div className={cn("py-1.5 px-3 rounded-md border text-[10px] font-bold text-center uppercase tracking-widest", result2.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700')}>
                                         {result2.success ? `Resolved: ${result2.count}` : 'Failed'}
                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="ui-card p-5 bg-white space-y-5 flex flex-col justify-between overflow-hidden relative">
                             <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/40" />
                             <div className="space-y-0.5">
                                 <h4 className="text-sm font-bold text-foreground">Identity Analysis</h4>
                                 <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Profile deduplication engine</p>
                             </div>
                             <div className="space-y-2">
                                 <div className="flex gap-2">
                                     <Button onClick={handleCheckSupplierDuplicates} disabled={isRunning3} size="sm" variant="outline" className="flex-1 h-9 rounded-md font-bold text-[10px] uppercase tracking-widest">
                                         Audit
                                     </Button>
                                     <Button onClick={handleFixSupplierDuplicates} disabled={isRunning4} size="sm" className="flex-1 h-9 rounded-md font-bold text-[10px] bg-amber-600 hover:bg-amber-700 text-white shadow-sm uppercase tracking-widest">
                                         Correct
                                     </Button>
                                 </div>
                                 {result3 && <div className="text-[9px] text-muted-foreground bg-muted/30 rounded-md p-2 border border-border/40 font-semibold leading-tight line-clamp-2">{result3.analysis?.summary}</div>}
                             </div>
                        </div>

                         <div className="ui-card p-5 bg-white space-y-5 flex flex-col justify-between overflow-hidden relative">
                             <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/40" />
                             <div className="space-y-0.5">
                                 <h4 className="text-sm font-bold text-foreground">Gov Records Finalize</h4>
                                 <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Secondary to Primary storage sync</p>
                             </div>
                             <div className="space-y-2">
                                 <div className="flex items-center gap-3 bg-muted/20 p-2 rounded-md border border-border/40 justify-between">
                                     <Label htmlFor="gov-migrate-delete" className="text-[10px] cursor-pointer font-bold text-muted-foreground uppercase tracking-widest">Purge Source</Label>
                                     <input type="checkbox" id="gov-migrate-delete" checked={govMigrateDeleteSource} onChange={(e) => setGovMigrateDeleteSource(e.target.checked)} className="rounded h-4 w-4 accent-primary" />
                                 </div>
                                 <Button onClick={handleMigrateGovFinalizedToPayments} disabled={isRunning6} size="sm" className="w-full h-9 rounded-md font-bold text-[10px] uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/10">
                                     Finalize All
                                 </Button>
                             </div>
                        </div>

                        <div className="ui-card p-6 bg-slate-900 text-white shadow-xl space-y-5 lg:col-span-2 flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="space-y-0.5 relative z-10">
                                <h4 className="text-base font-bold uppercase tracking-tight">Emergency Global Re-Index</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-80">Full structural synchronization service</p>
                            </div>
                            <div className="flex items-center gap-4 relative z-10">
                                <Button onClick={handleUpdatedAtMigration} disabled={isRunning5} size="sm" className="h-10 px-8 rounded-md font-bold text-[10px] uppercase tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl transition-all active:scale-95 shrink-0">
                                    {isRunning5 ? 'RE-INDEXING...' : 'INITIATE SYNC'}
                                </Button>
                                {result5 && (
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex gap-1.5 pb-1 overflow-x-auto custom-scrollbar-mini">
                                            {result5.map((res, i) => (
                                                <div key={i} className="whitespace-nowrap py-1.5 px-2 bg-white/5 border border-white/10 rounded text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 backdrop-blur-sm">
                                                    <span className="opacity-60">{res.collection.substring(0,8)}</span>
                                                    <span className={res.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                                                        {res.status === 'success' ? res.updated : 'ERR'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                     </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}


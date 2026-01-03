"use client";

import { useState, useEffect, useCallback, useMemo, useTransition, useRef, useDeferredValue } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { addSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, deleteSupplier, getSupplierIdBySrNo } from "@/lib/firestore";
import { useGlobalData } from '@/contexts/global-data-context';
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { completeSupplierFormSchema, type CompleteSupplierFormValues } from "@/lib/complete-form-schema";
import SimpleSupplierFormAllFields from "@/components/sales/simple-supplier-form-all-fields";
import { SimpleCalculatedSummary } from "@/components/sales/simple-calculated-summary";
import { SupplierNavigationBar } from "@/components/sales/supplier-navigation-bar";
import { SimpleSupplierTable } from "@/components/sales/simple-supplier-table";
import { CombinedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import type { ConsolidatedReceiptData } from "@/lib/definitions";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { CompactSupplierTable } from "@/components/sales/compact-supplier-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Plus, Search, Trash2, Printer } from "lucide-react";
import type { Customer, OptionItem } from "@/lib/definitions";
import * as XLSX from 'xlsx';

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string, latestSupplier?: Customer): CompleteSupplierFormValues => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get the latest serial number
    let nextSrNo = 'S0001';
    if (latestSupplier) {
        const num = parseInt(latestSupplier.srNo.substring(1));
        if (!isNaN(num)) {
            nextSrNo = formatSrNo(num + 1, 'S');
        }
    }

    return {
        srNo: nextSrNo,
        date: today,
        term: 20,
        name: '',
        so: '',
        address: '',
        contact: '',
        vehicleNo: '',
        variety: lastVariety || '',
        grossWeight: 0,
        teirWeight: 0,
        rate: 0,
        kartaPercentage: 1,
        labouryRate: 2,
        brokerage: 0,
        brokerageRate: 0,
        brokerageAddSubtract: true,
        kanta: 50,
        paymentType: lastPaymentType || 'Full',
        forceUnique: false,
    };
};

export default function SimpleSupplierEntryAllFields() {
    const { toast } = useToast();
    // Use global context for suppliers data (updated by global context, read from IndexedDB for reactivity)
    const globalData = useGlobalData();
    const suppliersForSerial = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(1).toArray());
    const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray());
    const totalSuppliersCount = useLiveQuery(() => db.suppliers.count());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [currentView, setCurrentView] = useState<'entry' | 'data'>('entry');
    const [isEditing, setIsEditing] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();
    // NO LOADING STATES - Data loads initially, then only CRUD updates
    const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
    const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
    const [allConsolidatedGroups, setAllConsolidatedGroups] = useState<ConsolidatedReceiptData[]>([]);
    // Use receipt settings from global context
    const receiptSettings = globalData.receiptSettings;
    
    const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
    const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
    const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
    const [documentType, setDocumentType] = useState<'tax-invoice' | 'bill-of-supply' | 'challan' | 'rtgs-receipt'>('tax-invoice');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSteps, setSearchSteps] = useState<string[]>([]);
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const deferredSearchSteps = useDeferredValue(searchSteps);

    // Import/Export refs
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);
    const firstInputRef = useRef<HTMLInputElement | null>(null);

    const handleExport = useCallback(() => {
        const rows = (allSuppliers || []).map((s) => ({
            'SR NO.': s.srNo,
            'DATE': s.date,
            'NAME': s.name,
            'FATHER NAME': s.fatherName,
            'ADDRESS': s.address,
            'CONTACT': s.contact,
            'VEHICLE NO': s.vehicleNo,
            'VARIETY': s.variety,
            'GROSS WT': s.grossWeight,
            'TIER WT': s.teirWeight,
            'NET WT': s.netWeight,
            'RATE': s.rate,
            'KARTA %': s.kartaPercentage,
            'LAB RATE': s.labouryRate,
            'BROKERAGE': s.brokerage,
            'BROKERAGE RATE': s.brokerageRate,
            'BROKERAGE ADD/SUB': s.brokerageAddSubtract ? 'ADD' : 'SUB',
            'KANTA': s.kanta,
            'AMOUNT': s.amount,
            'KARTA AMT': s.kartaAmount,
            'LAB AMT': s.labouryAmount,
            'NET AMT': s.netAmount,
            'TERM': s.term,
            'DUE DATE': s.dueDate,
            'SO': s.so,
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
        XLSX.writeFile(workbook, 'suppliers-export.xlsx');
        toast({ title: 'Exported', description: `${rows.length} rows exported` });
    }, [allSuppliers, toast]);

    const handleImportClick = useCallback(() => {
        importInputRef.current?.click();
    }, []);

    const handleImportChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = e.target?.result as ArrayBuffer | string;
                    const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'binary' : 'array', cellNF: true, cellText: false });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

                    let nextSrNum = (allSuppliers || []).length > 0
                        ? Math.max(...(allSuppliers || []).map(c => parseInt((c.srNo || 'S0000').substring(1)) || 0)) + 1
                        : 1;

                    let imported = 0;
                    for (const item of json) {
                        const supplierData: Customer = {
                            id: item['ID'] || crypto.randomUUID(),
                            srNo: item['SR NO.'] || formatSrNo(nextSrNum++, 'S'),
                            date: item['DATE'] || format(new Date(), 'yyyy-MM-dd'),
                            name: toTitleCase(item['NAME'] || ''),
                            fatherName: toTitleCase(item['FATHER NAME'] || ''),
                            address: toTitleCase(item['ADDRESS'] || ''),
                            contact: String(item['CONTACT'] || ''),
                            vehicleNo: String(item['VEHICLE NO'] || '').toUpperCase(),
                            variety: toTitleCase(item['VARIETY'] || ''),
                            grossWeight: Number(item['GROSS WT']) || 0,
                            teirWeight: Number(item['TIER WT']) || 0,
                            netWeight: Number(item['NET WT']) || 0,
                            rate: Number(item['rate'] ?? item['RATE']) || 0,
                            kartaPercentage: Number(item['KARTA %']) || 0,
                            labouryRate: Number(item['LAB RATE']) || 0,
                            brokerage: Number(item['BROKERAGE']) || 0,
                            brokerageRate: Number(item['BROKERAGE RATE']) || 0,
                            brokerageAddSubtract: String(item['BROKERAGE ADD/SUB'] || 'ADD').toUpperCase() === 'ADD',
                            kanta: Number(item['KANTA']) || 0,
                            amount: Number(item['AMOUNT']) || 0,
                            kartaAmount: Number(item['KARTA AMT']) || 0,
                            labouryAmount: Number(item['LAB AMT']) || 0,
                            netAmount: Number(item['NET AMT']) || 0,
                            term: String(item['TERM'] || ''),
                            dueDate: String(item['DUE DATE'] || ''),
                            so: String(item['SO'] || ''),
                            forceUnique: Boolean(item['FORCE UNIQUE'] || false),
                            paymentType: String(item['PAYMENT TYPE'] || ''),
                            // optional/unused columns remain default/undefined
                        } as Customer;

                        await addSupplier(supplierData);
                        imported++;
                    }

                    toast({ title: 'Imported', description: `${imported} rows imported` });
                } catch (err) {
                    toast({ variant: 'destructive', title: 'Import failed', description: 'Invalid file format' });
                } finally {
                    event.target.value = '';
                }
            };

            // Read file
            reader.readAsBinaryString(file);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Import failed', description: 'Could not read file' });
        }
    }, [allSuppliers, toast]);

    const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
    const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
    const [lastVariety, setLastVariety] = useState<string>('');
    const [lastPaymentType, setLastPaymentType] = useState<string>('');
    const [currentSupplier, setCurrentSupplier] = useState<Customer>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
            id: "", srNo: 'S----', date: format(today, 'yyyy-MM-dd'), term: '20', dueDate: format(today, 'yyyy-MM-dd'), 
            name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
            weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
            labouryRate: 2, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
            receiptType: 'Cash', paymentType: 'Full', customerId: '',
        };
    });

    const form = useForm<CompleteSupplierFormValues>({
        resolver: zodResolver(completeSupplierFormSchema),
        defaultValues: getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]),
    });
    
    // Restore form state from localStorage after form is initialized
    useEffect(() => {
        if (!isClient) return;
        
        try {
            const saved = localStorage.getItem('supplier-entry-form-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Only restore if form has meaningful data
                if (parsed.name || parsed.srNo || parsed.variety || (parsed.grossWeight && parsed.grossWeight > 0)) {
                    // Convert date string back to Date object
                    if (parsed.date) {
                        parsed.date = new Date(parsed.date);
                    }
                    // Restore form values
                    Object.keys(parsed).forEach(key => {
                        form.setValue(key as any, parsed[key], { shouldValidate: false });
                    });
                }
            }
        } catch (error) {
            // Error restoring form state
        }
    }, [isClient, form]);

    // Delete current form entry
    const handleDeleteCurrent = useCallback(async () => {
        // If not saved yet, just clear the form
        if (!currentSupplier.id) {
            form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            setCurrentSupplier({
                id: "", srNo: 'S----', date: format(new Date(), 'yyyy-MM-dd'), term: '20', dueDate: format(new Date(), 'yyyy-MM-dd'), 
                name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
                weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
                labouryRate: 2, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
                receiptType: 'Cash', paymentType: 'Full', customerId: '',
            });
            toast({ title: 'Form cleared' });
            return;
        }

        try {
            // Resolve a valid Firestore ID before delete - use existing state (no DB read)
            let targetId = currentSupplier.id;
            if (!targetId || targetId.length < 4) {
                // Use existing state instead of DB query
                const existingSupplier = allSuppliers?.find(s => s.srNo === currentSupplier.srNo);
                if (existingSupplier?.id) {
                    targetId = existingSupplier.id;
                }
            }

            if (!targetId || targetId.length < 4) {
                toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not locate this entry in database.' });
                return;
            }

            await deleteSupplier(targetId);
            toast({ title: 'Deleted', description: 'Entry deleted successfully' });
            // Clear form after deletion
            form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            setCurrentSupplier({
                id: "", srNo: 'S----', date: format(new Date(), 'yyyy-MM-dd'), term: '20', dueDate: format(new Date(), 'yyyy-MM-dd'), 
                name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
                weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
                labouryRate: 2, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
                receiptType: 'Cash', paymentType: 'Full', customerId: '',
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete entry' });
        }
    }, [currentSupplier.id, toast, form, lastVariety, lastPaymentType, suppliersForSerial]);

    // Print current form entry
    const handlePrintCurrent = useCallback(() => {
        if (!currentSupplier.id) {
            // Build a temporary customer object from current form values for preview/print
            const v = form.getValues();
            const finalWeight = Number(v.grossWeight || 0) - Number(v.teirWeight || 0);
            // Calculate Karta Weight with proper rounding: round UP when Final Wt decimal part >= 0.50
            const rawKartaWt = (finalWeight * Number(v.kartaPercentage || 0)) / 100;
            const decimalPart = Math.round((finalWeight - Math.floor(finalWeight)) * 10);
            let kartaWeight;
            if (decimalPart >= 5) {
                kartaWeight = Math.ceil(rawKartaWt * 100) / 100;
            } else {
                kartaWeight = Math.floor(rawKartaWt * 100) / 100;
            }
            const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100;
            const amount = finalWeight * Number(v.rate || 0);
            const kartaAmount = kartaWeight * Number(v.rate || 0);
            // Labour Amount calculated on Final Wt, not Net Wt
            const labouryAmount = finalWeight * Number(v.labouryRate || 0);
            // Brokerage calculated on Final Wt, not Net Wt
            const brokerageAmount = Math.round(Number(v.brokerageRate || 0) * finalWeight * 100) / 100;
            const signedBrokerage = (v.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            const netAmount = amount - kartaAmount - labouryAmount - Number(v.kanta || 0) + signedBrokerage;
            const temp: Customer = {
                id: 'TEMP',
                srNo: v.srNo,
                date: format(v.date, 'yyyy-MM-dd'),
                term: String(v.term),
                dueDate: (() => {
                    const termDays = Number(v.term) || 20;
                    const dueDate = new Date(v.date);
                    dueDate.setDate(dueDate.getDate() + termDays);
                    return format(dueDate, 'yyyy-MM-dd');
                })(),
                name: toTitleCase(v.name),
                so: toTitleCase(v.so),
                address: toTitleCase(v.address),
                contact: v.contact,
                vehicleNo: (v.vehicleNo || '').toUpperCase(),
                variety: v.variety,
                grossWeight: Number(v.grossWeight || 0),
                teirWeight: Number(v.teirWeight || 0),
                weight: Number(finalWeight.toFixed(2)),
                kartaPercentage: v.kartaPercentage,
                kartaWeight: Number(kartaWeight.toFixed(2)),
                kartaAmount: Number(kartaAmount.toFixed(2)),
                netWeight: Number(netWeight.toFixed(2)),
                rate: v.rate,
                labouryRate: v.labouryRate,
                labouryAmount: Number(labouryAmount.toFixed(2)),
                brokerage: v.brokerage || 0,
                brokerageRate: v.brokerageRate || 0,
                brokerageAmount: Number(brokerageAmount.toFixed(2)),
                brokerageAddSubtract: v.brokerageAddSubtract ?? true,
                kanta: v.kanta,
                amount: Number(amount.toFixed(2)),
                netAmount: Number(netAmount.toFixed(2)),
                originalNetAmount: Number(netAmount.toFixed(2)),
                barcode: '',
                receiptType: 'Cash',
                paymentType: v.paymentType,
                customerId: `${toTitleCase(v.name).toLowerCase()}|${toTitleCase(v.so).toLowerCase()}`,
            };
            setReceiptsToPrint([temp]);
            return;
        }
        setReceiptsToPrint([currentSupplier]);
    }, [currentSupplier, form]);

    // Background data loading effect - non-blocking
    useEffect(() => {
        const loadData = async () => {
            try {
                // Pre-load data in background without blocking UI
                const data = await db.suppliers.orderBy('srNo').reverse().toArray();
                setDataLoaded(true);
            } catch (error) {
                // Error loading data
            }
        };
        
        if (isClient) {
            // Use setTimeout to make it non-blocking
            setTimeout(() => {
                loadData();
            }, 0);
        }
    }, [isClient]);

    // Update form with latest serial number when suppliers data is available
    useEffect(() => {
        if (suppliersForSerial && suppliersForSerial.length > 0) {
            const newFormState = getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial[0]);
            form.reset(newFormState);
        }
    }, [suppliersForSerial, lastPaymentType, form]);

    // NO LOADING STATES - Data loads initially, instant UI

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);

    // Remove loading state - always show content immediately
    // useEffect(() => {
    //     if (suppliersForSerial !== undefined) {
    //         setIsLoading(false);
    //     }
    // }, [suppliersForSerial]);

    useEffect(() => {
        if (!isClient) return;
        
        // ✅ Global context handles suppliers realtime listener - no duplicate listener needed
        // useLiveQuery will automatically react to IndexedDB changes updated by global context
        
        const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => {});
        const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => {});

        const savedVariety = localStorage.getItem('lastSelectedVariety');
        if (savedVariety) {
            setLastVariety(savedVariety);
            form.setValue('variety', savedVariety);
        }
        
        const savedPaymentType = localStorage.getItem('lastSelectedPaymentType');
        if (savedPaymentType) {
            setLastPaymentType(savedPaymentType);
            form.setValue('paymentType', savedPaymentType);
        }

        form.setValue('date', new Date());
        
        // Receipt settings are now provided by global context

        return () => {
            unsubVarieties();
            unsubPaymentTypes();
        };
        // Removed form from dependencies - form is stable
        // This prevents re-subscribing to getOptionsRealtime on every render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isClient]);

    // Calculate summary with real-time updates (debounced for performance)
    const calculateSummary = useCallback(() => {
        const values = form.getValues();
        if (values) {
            // Use actual form values, no default fallbacks for calculations
            const grossWeight = Number(values.grossWeight) || 0;
            const teirWeight = Number(values.teirWeight) || 0;
            const kartaPercentage = Number(values.kartaPercentage) || 0;
            const rate = Number(values.rate) || 0;
            const labouryRate = Number(values.labouryRate) || 0;
            const kanta = Number(values.kanta) || 0;
            const brokerageRate = Number(values.brokerageRate || 0) || 0;
            
            const finalWeight = grossWeight - teirWeight;
            // Calculate Karta Weight with proper rounding: round UP when Final Wt decimal part >= 0.50
            const rawKartaWt = (finalWeight * kartaPercentage) / 100;
            const decimalPart = Math.round((finalWeight - Math.floor(finalWeight)) * 10);
            let kartaWeight;
            if (decimalPart >= 5) {
                kartaWeight = Math.ceil(rawKartaWt * 100) / 100;
            } else {
                kartaWeight = Math.floor(rawKartaWt * 100) / 100;
            }
            const netWeight = finalWeight - kartaWeight;
            const amount = finalWeight * rate;
            const kartaAmount = kartaWeight * rate;
            // Labour Amount calculated on Final Wt, not Net Wt
            const labouryAmount = finalWeight * labouryRate;
            // Brokerage calculated on Final Wt, not Net Wt
            const brokerageAmount = Math.round(brokerageRate * finalWeight * 100) / 100;
            const signedBrokerage = (values.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            const netAmount = amount - kartaAmount - labouryAmount - kanta + signedBrokerage;

            // Calculate due date: date + term (in days)
            const termDays = Number(values.term) || 20;
            const entryDate = values.date || new Date();
            const dueDate = new Date(entryDate);
            dueDate.setDate(dueDate.getDate() + termDays);
            
            setCurrentSupplier(prev => ({
                ...prev,
                srNo: values.srNo || 'S----',
                date: values.date ? format(values.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                term: String(termDays),
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                name: values.name || '',
                so: values.so || '',
                address: values.address || '',
                contact: values.contact || '',
                vehicleNo: values.vehicleNo || '',
                variety: values.variety || '',
                grossWeight: grossWeight,
                teirWeight: teirWeight,
                weight: finalWeight, // Final Weight (Gross - Teir), not Net Weight
                kartaPercentage: kartaPercentage,
                kartaWeight: kartaWeight, // Use calculated kartaWeight with proper rounding
                kartaAmount: kartaAmount,
                netWeight: netWeight, // Net Weight (Final - Karta)
                rate: rate,
                labouryRate: labouryRate,
                labouryAmount: labouryAmount,
                brokerage: brokerageAmount,
                brokerageRate: brokerageRate,
                brokerageAmount: brokerageAmount,
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
                kanta: kanta,
                amount: amount,
                netAmount: netAmount,
                originalNetAmount: netAmount,
                paymentType: values.paymentType || 'Full',
            }));
        }
    }, [form]);

    // Real-time calculations with debouncing (updates summary as you type)
    // Also save form state to localStorage (debounced)
    useEffect(() => {
        let saveTimer: NodeJS.Timeout;
        
        const subscription = form.watch((values) => {
            // Debounced save to localStorage (save after 500ms of no changes)
            if (typeof window !== 'undefined') {
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => {
                    try {
                        // Only save if form has meaningful data (not empty)
                        if (values.name || values.srNo || values.variety || values.grossWeight > 0) {
                            localStorage.setItem('supplier-entry-form-state', JSON.stringify(values));
                        }
                    } catch (error) {
                        // Error saving form state
                    }
                }, 500);
            }
            
            const timer = setTimeout(() => {
                calculateSummary();
            }, 300); // Wait 300ms after user stops typing
            
            return () => {
                clearTimeout(timer);
                clearTimeout(saveTimer);
            };
        });
        
        return () => {
            subscription.unsubscribe();
            clearTimeout(saveTimer);
        };
    }, [calculateSummary, form]);

    const handleSrNoBlur = async (srNoValue: string) => {
        let formattedSrNo = srNoValue.trim().toUpperCase();
        
        if (!formattedSrNo) return;
        
        // Extract numeric part from SR No (handles both "122" and "S00121" formats)
        let numericPart: number | null = null;
        
        // If it starts with 'S', extract the number after 'S'
        if (formattedSrNo.startsWith('S')) {
            const numStr = formattedSrNo.substring(1).replace(/^0+/, ''); // Remove leading zeros
            numericPart = parseInt(numStr, 10);
        } else {
            // Pure number format
            numericPart = parseInt(formattedSrNo, 10);
        }
        
        // Format the SR No if we have a valid number
        if (numericPart !== null && !isNaN(numericPart) && isFinite(numericPart) && numericPart > 0) {
            formattedSrNo = formatSrNo(numericPart, 'S');
            form.setValue('srNo', formattedSrNo);
            
            // Check if this serial number already exists
            try {
                const existingSupplier = await db.suppliers
                    .where('srNo')
                    .equals(formattedSrNo)
                    .first();
                
                if (existingSupplier) {
                    // Auto-fill all fields with existing data
                    form.reset({
                        srNo: existingSupplier.srNo,
                        date: existingSupplier.date ? new Date(existingSupplier.date) : new Date(),
                        term: Number(existingSupplier.term) || 0,
                        name: existingSupplier.name || '',
                        so: existingSupplier.so || '',
                        address: existingSupplier.address || '',
                        contact: existingSupplier.contact || '',
                        vehicleNo: existingSupplier.vehicleNo || '',
                        variety: existingSupplier.variety || '',
                        grossWeight: Number(existingSupplier.grossWeight) || 0,
                        teirWeight: Number(existingSupplier.teirWeight) || 0,
                        rate: Number(existingSupplier.rate) || 0,
                        kartaPercentage: Number(existingSupplier.kartaPercentage) || 0,
                        labouryRate: Number(existingSupplier.labouryRate) || 0,
                        brokerage: Number(existingSupplier.brokerage) || 0,
                        brokerageRate: Number(existingSupplier.brokerageRate) || 0,
                        brokerageAddSubtract: existingSupplier.brokerageAddSubtract ?? true,
                        kanta: Number(existingSupplier.kanta) || 0,
                        paymentType: existingSupplier.paymentType || 'Full',
                        forceUnique: existingSupplier.forceUnique || false,
                    });
                    
                    // Set editing mode
                    setIsEditing(true);
                    
                    // Update summary after form reset
                    setTimeout(() => {
                        calculateSummary();
                    }, 100);
                    
                    toast({
                        title: "Existing Entry Found",
                        description: `Supplier entry with serial number ${formattedSrNo} has been loaded for editing.`,
                    });
                }
            } catch (error) {
                // Error checking existing supplier
            }
        }
    };

    const handleSetLastVariety = (variety: string) => {
        setLastVariety(variety);
        if(isClient) {
            localStorage.setItem('lastSelectedVariety', variety);
        }
    };

    const handleSetLastPaymentType = (paymentType: string) => {
        setLastPaymentType(paymentType);
        if(isClient) {
            localStorage.setItem('lastSelectedPaymentType', paymentType);
        }
    };

    const handleContactBlur = async (contactValue: string) => {
        const trimmedContact = contactValue.trim();
        if (trimmedContact && trimmedContact.length >= 10) {
            try {
                const existingSupplier = await db.suppliers
                    .where('contact')
                    .equals(trimmedContact)
                    .first();
                
                if (existingSupplier) {
                    // Auto-fill name, so, and address fields
                    form.setValue('name', existingSupplier.name || '');
                    form.setValue('so', existingSupplier.so || '');
                    form.setValue('address', existingSupplier.address || '');
                    
                    // Update summary after auto-fill
                    setTimeout(() => {
                        calculateSummary();
                    }, 100);
                    
                    toast({
                        title: "Existing Contact Found",
                        description: `Supplier details for contact ${trimmedContact} have been auto-filled.`,
                    });
                }
            } catch (error) {
                // Error checking existing contact
            }
        }
    };

    const handleAddOption = useCallback(async (collectionName: string, optionData: { name: string } | string) => {
        try {
            // Handle both string and object formats
            const name = typeof optionData === 'string' ? optionData : optionData.name;
            if (!name || !name.trim()) {
                toast({ title: "Error", description: "Option name cannot be empty", variant: "destructive" });
                return;
            }
            await addOption(collectionName, { name: toTitleCase(name.trim()) });
            toast({ title: "Option added successfully!" });
        } catch (error: any) {
            toast({ title: "Error adding option", description: error?.message || "Please try again", variant: "destructive" });
        }
    }, [toast]);
    
    const handleUpdateOption = useCallback(async (collectionName: string, id: string, optionData: { name: string }) => {
        try {
            if (!optionData || !optionData.name || !optionData.name.trim()) {
                toast({ 
                    title: "Error", 
                    description: "Option name cannot be empty", 
                    variant: "destructive" 
                });
                return;
            }
            const name = toTitleCase(optionData.name.trim());
            await updateOption(collectionName, id, { name });
            toast({ 
                title: "Option updated successfully!", 
                description: `Updated to "${name}".`,
                variant: "success"
            });
        } catch (error: any) {
            toast({ 
                title: "Error updating option", 
                description: error?.message || "Please try again", 
                variant: "destructive" 
            });
        }
    }, [toast]);
    
    const handleDeleteOption = useCallback(async (collectionName: string, id: string, name: string) => {
        try {
            await deleteOption(collectionName, id, name);
            toast({ title: "Option deleted successfully!" });
        } catch (error) {
            toast({ title: "Error deleting option", variant: "destructive" });
        }
    }, [toast]);

    const handleDelete = useCallback(async (supplierId: string) => {
        try {
            // Use deleteSupplier which handles local-first sync
            const { deleteSupplier } = await import('@/lib/firestore');
            await deleteSupplier(supplierId);
            toast({ 
                title: "Entry deleted successfully!", 
                description: "Supplier entry has been removed.",
                variant: "success"
            });
        } catch (error) {
            toast({ 
                title: "Error deleting entry", 
                description: "Failed to delete supplier entry.",
                variant: "destructive" 
            });
        }
    }, [toast]);

    const onSubmit = (values: CompleteSupplierFormValues) => {
        // Optimistic update - UI updates immediately, DB operations in background
        try {
            // Align DB save with summary calculations
            const finalWeight = Number(values.grossWeight) - Number(values.teirWeight);
            const rawKartaWt = (finalWeight * Number(values.kartaPercentage)) / 100;
            // Always round UP when Final Wt decimal part >= 0.50 (e.g., 179.50 -> 1.80, not 1.79)
            const decimalPart = Math.round((finalWeight - Math.floor(finalWeight)) * 10);
            let kartaWeight;
            if (decimalPart >= 5) {
                kartaWeight = Math.ceil(rawKartaWt * 100) / 100;
            } else {
                kartaWeight = Math.floor(rawKartaWt * 100) / 100;
            }
            const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100; // 2-dec net
            const amount = finalWeight * Number(values.rate);
            const kartaAmount = kartaWeight * Number(values.rate);
            // Labour Amount calculated on Final Wt, not Net Wt
            const labouryAmount = finalWeight * Number(values.labouryRate);
            // Brokerage calculated on Final Wt, not Net Wt
            const brokerageAmount = Math.round(Number(values.brokerageRate || 0) * finalWeight * 100) / 100;
            const signedBrokerage = (values.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            const netAmount = amount - kartaAmount - labouryAmount - Number(values.kanta) + signedBrokerage;

            // Calculate due date: date + term (in days)
            const termDays = Number(values.term) || 20;
            const dueDate = new Date(values.date);
            dueDate.setDate(dueDate.getDate() + termDays);
            
            const supplierBase: Omit<Customer, 'id'> = {
                srNo: values.srNo,
                date: format(values.date, 'yyyy-MM-dd'),
                term: String(termDays),
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                contact: values.contact,
                vehicleNo: (values.vehicleNo || '').toUpperCase(),
                variety: values.variety ? String(values.variety).toUpperCase() : values.variety,
                grossWeight: Number(values.grossWeight),
                teirWeight: Number(values.teirWeight),
                weight: Number(finalWeight.toFixed(2)),
                kartaPercentage: Number(values.kartaPercentage),
                kartaWeight: Number(kartaWeight.toFixed(2)),
                kartaAmount: Number(kartaAmount.toFixed(2)),
                netWeight: Number(netWeight.toFixed(2)),
                rate: Number(values.rate),
                labouryRate: Number(values.labouryRate),
                labouryAmount: Number(labouryAmount.toFixed(2)),
                brokerage: Number(values.brokerage || 0),
                brokerageRate: Number(values.brokerageRate || 0),
                brokerageAmount: Number(brokerageAmount.toFixed(2)),
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
                kanta: Number(values.kanta),
                amount: Number(amount.toFixed(2)),
                netAmount: Number(netAmount.toFixed(2)),
                originalNetAmount: Number(netAmount.toFixed(2)),
                paymentType: values.paymentType,
                customerId: `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}`,
                barcode: '',
                receiptType: 'Cash',
                forceUnique: values.forceUnique,
            };

            let savedId: string | null = null;

            if (isEditing && currentSupplier.id) {
                // Update existing supplier - optimistic UI update
                let targetId = currentSupplier.id;
                
                // Optimistically update UI immediately
                const updatedSupplier = { ...supplierBase, id: targetId } as Customer;
                setCurrentSupplier(updatedSupplier);
                setIsEditing(false);
                savedId = targetId;

                // Write using sync system (triggers Firestore sync)
                updateSupplier(targetId, supplierBase).catch(() => {});
            } else {
                // ✅ Use srNo as document ID (not random UUID) to ensure consistent saving
                // Check if supplier with this srNo already exists
                const existingSupplier = allSuppliers?.find(s => s.srNo === values.srNo);
                if (existingSupplier?.id) {
                    // Update existing supplier
                    updateSupplier(existingSupplier.id, supplierBase).catch(() => {});
                    savedId = existingSupplier.id;
                    setCurrentSupplier({ ...supplierBase, id: existingSupplier.id } as Customer);
                } else {
                    // Create new supplier - use srNo as id if valid, otherwise use a temp id
                    const supplierId = values.srNo && values.srNo.trim() !== '' && values.srNo !== 'S----'
                        ? values.srNo
                        : crypto.randomUUID();
                    const newSupplier = { ...supplierBase, id: supplierId } as Customer;
                    setCurrentSupplier(newSupplier);
                    savedId = supplierId;
                    setIsEditing(false);
                    
                    // Write using sync system (triggers Firestore sync)
                    addSupplier(newSupplier).catch(() => {});
                }
            }

            // Highlight entry immediately (lightweight)
            if (savedId) {
                setHighlightEntryId(savedId);
                setTimeout(() => setHighlightEntryId(null), 3000);
            }
            
            // Reset form for new entry (deferred to avoid blocking update)
            if (!isEditing) {
                // Defer form reset to avoid blocking
                setTimeout(() => {
                    const newState = getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]);
                    form.reset(newState);
                    // Clear saved form state after successful save
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('supplier-entry-form-state');
                    }
                }, 0);
            }
            
        } catch (error: any) {
            toast({ 
                title: "Failed to save entry", 
                description: error?.message || "Please try again.",
                variant: "destructive" 
            });
        }
    };

    const handleNewEntry = useCallback(() => {
        form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
        setIsEditing(false);
        toast({ title: "Form cleared" });
    }, [form, lastVariety, lastPaymentType, suppliersForSerial]);

    const handleFieldFocus = useCallback(() => {
        // Field focus handler (no longer needed for entry table limit)
    }, []);

    const handleViewDetails = useCallback((supplier: Customer) => {
        // Open detail window for supplier
        setDetailsCustomer(supplier);
    }, []);

    const handleOpenPrintPreview = useCallback((supplier: Customer) => {
        setDocumentPreviewCustomer(supplier);
        setDocumentType('tax-invoice');
        setIsDocumentPreviewOpen(true);
    }, []);

    // Pre-index suppliers for faster search (only when allSuppliers changes)
    const indexedSuppliers = useMemo(() => {
        if (!allSuppliers || allSuppliers.length === 0) return [];
        
        return allSuppliers.map(supplier => ({
            ...supplier,
            searchIndex: [
                supplier.name?.toLowerCase() || '',
                supplier.so?.toLowerCase() || '',
                supplier.address?.toLowerCase() || '',
                supplier.srNo?.toLowerCase() || '',
                supplier.contact?.toLowerCase() || '',
                supplier.vehicleNo?.toLowerCase() || ''
            ].join(' ')
        }));
    }, [allSuppliers]);

    // Multi-step filtering logic with deferred values for smooth typing
    const filteredSuppliers = useMemo(() => {
        if (!indexedSuppliers || indexedSuppliers.length === 0) {
            return [];
        }

        // If no search query or search steps, return all suppliers
        if (!deferredSearchQuery || deferredSearchQuery.trim() === '' || deferredSearchSteps.length === 0) {
            return indexedSuppliers;
        }

        // If only one search step, do optimized search using pre-indexed data
        if (deferredSearchSteps.length === 1) {
            const query = deferredSearchSteps[0].toLowerCase().trim();
            if (!query) return indexedSuppliers;
            
            // Use pre-indexed search string for faster filtering
            return indexedSuppliers.filter(supplier => 
                supplier.searchIndex.includes(query)
            );
        }

        // Multiple search steps - apply progressive filtering with early exit
        let result = indexedSuppliers;
        
        for (const step of deferredSearchSteps) {
            const query = step.toLowerCase().trim();
            if (!query) continue;
            
            // Early exit if no results
            if (result.length === 0) break;
            
            // Use pre-indexed search for faster filtering
            result = result.filter(supplier => 
                supplier.searchIndex.includes(query)
            );
        }

        return result;
    }, [indexedSuppliers, deferredSearchQuery, deferredSearchSteps]);

    // Handle search input with multi-step filtering - optimized for no lag
    const handleSearchChange = useCallback((value: string) => {
        // Update input immediately for responsive UI
        setSearchQuery(value);
        
        // Use startTransition for non-urgent state updates to prevent blocking
        startTransition(() => {
            // If empty, clear search steps
            if (!value || value.trim() === '') {
                setSearchSteps([]);
                return;
            }
            
            // Split by comma and filter out empty strings
            const steps = value.split(',').map(step => step.trim()).filter(step => step.length > 0);
            setSearchSteps(steps);
        });
    }, []);

    const handlePrintSupplier = useCallback((supplier: Customer) => {
        // Open print format window for supplier
        setReceiptsToPrint([supplier]);
        setConsolidatedReceiptData(null);
        toast({ 
            title: "Print Format", 
            description: `Opening print format for ${supplier.name} (SR# ${supplier.srNo})` 
        });
    }, []);

    // Yield control to browser to prevent blocking
    const yieldToBrowser = useCallback((): Promise<void> => {
        return new Promise((resolve) => {
            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                window.requestIdleCallback(() => resolve(), { timeout: 1 });
            } else {
                setTimeout(() => resolve(), 0);
            }
        });
    }, []);

    const handleMultiPrint = useCallback(async (suppliers: Customer[]) => {
        if (suppliers.length === 0) return;

        // Show loading toast for large datasets
        const isLargeDataset = suppliers.length > 1000;
        
        if (isLargeDataset) {
            toast({
                title: "Processing Print Data",
                description: `Preparing ${suppliers.length} entries for print. This may take a moment...`,
            });
        }

        try {
            // Determine chunk size based on dataset size
            let chunkSize = 100;
            if (suppliers.length > 10000) {
                chunkSize = 200;
            } else if (suppliers.length > 5000) {
                chunkSize = 150;
            } else if (suppliers.length > 1000) {
                chunkSize = 100;
            } else {
                chunkSize = 50;
            }

            // Step 1: Group suppliers by name, father name, and address (chunked processing)
            const groupedSuppliers: Record<string, Customer[]> = {};
            const totalSuppliers = suppliers.length;
            
            for (let i = 0; i < totalSuppliers; i += chunkSize) {
                const chunk = suppliers.slice(i, i + chunkSize);
                
                // Process chunk
                chunk.forEach((supplier) => {
                    // Normalize the key to handle case differences and extra spaces
                    const normalizedName = (supplier.name || '').trim().toLowerCase();
                    const normalizedFatherName = (supplier.fatherName || '').trim().toLowerCase();
                    const normalizedAddress = (supplier.address || '').trim().toLowerCase();
                    const key = `${normalizedName}-${normalizedFatherName}-${normalizedAddress}`;
                    
                    if (!groupedSuppliers[key]) {
                        groupedSuppliers[key] = [];
                    }
                    groupedSuppliers[key].push(supplier);
                });

                // Yield to browser after each chunk to prevent UI blocking
                if (i + chunkSize < totalSuppliers) {
                    await yieldToBrowser();
                }
            }

            const groups = Object.values(groupedSuppliers);
            
            // Step 2: Prepare data for combined dialog (chunked processing)
            const consolidatedGroups: ConsolidatedReceiptData[] = [];
            const individualSuppliers: Customer[] = [];
            
            for (let i = 0; i < groups.length; i += chunkSize) {
                const chunk = groups.slice(i, i + chunkSize);
                
                chunk.forEach((group) => {
                    if (group.length > 1) {
                        // Group with multiple entries - consolidate
                        const firstSupplier = group[0];
                        const consolidatedData: ConsolidatedReceiptData = {
                            customer: firstSupplier,
                            receipts: group,
                            totalAmount: group.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
                            totalWeight: group.reduce((sum, s) => sum + (Number(s.weight) || 0), 0),
                            totalNetWeight: group.reduce((sum, s) => sum + (Number(s.netWeight) || 0), 0),
                            totalKartaAmount: group.reduce((sum, s) => sum + (Number(s.kartaAmount) || 0), 0),
                            totalLabAmount: group.reduce((sum, s) => sum + (Number(s.labouryAmount) || 0), 0),
                            totalNetAmount: group.reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0),
                            receiptCount: group.length
                        };
                        consolidatedGroups.push(consolidatedData);
                    } else {
                        // Single entry - add to individual
                        individualSuppliers.push(group[0]);
                    }
                });

                // Yield to browser after each chunk to prevent UI blocking
                if (i + chunkSize < groups.length) {
                    await yieldToBrowser();
                }
            }
            
            // Set data for combined dialog
            setReceiptsToPrint(individualSuppliers);
            setAllConsolidatedGroups(consolidatedGroups);
            setConsolidatedReceiptData(consolidatedGroups.length > 0 ? consolidatedGroups[0] : null);
            
            // Show appropriate message
            const totalConsolidatedEntries = consolidatedGroups.reduce((sum, group) => sum + group.receiptCount, 0);
            if (consolidatedGroups.length > 0 && individualSuppliers.length > 0) {
                toast({ 
                    title: "Combined Print Preview", 
                    description: `Showing ${consolidatedGroups.length} consolidated groups (${totalConsolidatedEntries} entries) and ${individualSuppliers.length} individual receipts` 
                });
            } else if (consolidatedGroups.length > 0) {
                toast({ 
                    title: "Consolidated Print Preview", 
                    description: `Showing ${consolidatedGroups.length} consolidated groups with ${totalConsolidatedEntries} total entries` 
                });
            } else {
                toast({ 
                    title: "Individual Print Preview", 
                    description: `Showing individual print format for ${individualSuppliers.length} suppliers` 
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process print data. Please try again.",
                variant: "destructive",
            });
        }
    }, [toast, yieldToBrowser]);


    const handleMultiDelete = useCallback(async (supplierIds: string[]) => {
        try {
            // Import deleteMultipleSuppliers function
            const { deleteMultipleSuppliers } = await import("@/lib/firestore");
            await deleteMultipleSuppliers(supplierIds);
            toast({ 
                title: "Success", 
                description: `${supplierIds.length} suppliers and their associated payments deleted successfully` 
            });
        } catch (error) {
            toast({ 
                title: "Error", 
                description: "Failed to delete some suppliers", 
                variant: "destructive"
            });
        }
    }, []);

    const handleViewChange = useCallback((view: 'entry' | 'data') => {
        // NO LOADING - Instant switch
        setCurrentView(view);
    }, []);

    const handleEditSupplier = useCallback((supplier: Customer) => {
        // First, set editing mode to true
        setIsEditing(true);
        
        // Set current supplier with proper ID BEFORE resetting form
        setCurrentSupplier(supplier);
        
        // Fill form with supplier data - ensure all fields are populated
        form.reset({
            srNo: supplier.srNo,
            date: new Date(supplier.date),
            term: Number(supplier.term) || 0,
            name: supplier.name || '',
            so: supplier.so || '',
            address: supplier.address || '',
            contact: supplier.contact || '',
            vehicleNo: supplier.vehicleNo || '',
            variety: supplier.variety || '',
            grossWeight: Number(supplier.grossWeight) || 0,
            teirWeight: Number(supplier.teirWeight) || 0,
            rate: Number(supplier.rate) || 0,
            kartaPercentage: Number(supplier.kartaPercentage) || 0,
            labouryRate: Number(supplier.labouryRate) || 0,
            kanta: Number(supplier.kanta) || 0,
            paymentType: supplier.paymentType || 'Full',
            forceUnique: supplier.forceUnique || false,
        }, {
            keepDefaultValues: false,
            keepValues: false,
            keepDirty: false,
            keepIsSubmitted: false,
            keepTouched: false,
            keepIsValid: false,
            keepSubmitCount: false
        });
        
        // Switch to entry tab with smooth transition
        handleViewChange('entry');
        
        // Ensure form is enabled and ready for editing
        setTimeout(() => {
            // Try to focus the first input field
            if (firstInputRef.current) {
                firstInputRef.current.focus();
                firstInputRef.current.select(); // Select text for easy editing
                firstInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (formRef.current) {
                // If first input not available, scroll to form
                formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
        
        toast({ 
            title: "Edit Mode Activated", 
            description: `${supplier.name} (SR# ${supplier.srNo}) loaded. Form is ready for editing.`,
            variant: "success"
        });
    }, [form, handleViewChange, toast]);

    // Check for editSupplierData from localStorage (when navigating from detail window)
    useEffect(() => {
        if (isClient && handleEditSupplier) {
            const editData = localStorage.getItem('editSupplierData');
            if (editData) {
                try {
                    const supplierData = JSON.parse(editData) as Customer;
                    // Clear the localStorage
                    localStorage.removeItem('editSupplierData');
                    
                    // Fill form with supplier data
                    handleEditSupplier(supplierData);
                    
                    toast({
                        title: "Entry Loaded",
                        description: `Loaded ${supplierData.name} (SR# ${supplierData.srNo}) for editing.`,
                    });
                } catch (error) {
                    localStorage.removeItem('editSupplierData');
                }
            }
        }
    }, [isClient, handleEditSupplier, toast]);

    // Memoized entry view for ultra fast rendering
    const entryView = useMemo(() => (
        <div className="transition-none will-change-auto">
            <Card>
                <CardContent className="p-4">
                    <FormProvider {...form}>
                        <form 
                            ref={formRef} 
                            onSubmit={form.handleSubmit(onSubmit)} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const activeElement = document.activeElement as HTMLElement;
                                    // Don't interfere if focus is on button, dialog, menu, or command palette
                                    if (activeElement.tagName === 'BUTTON' || 
                                        activeElement.closest('[role="dialog"]') || 
                                        activeElement.closest('[role="menu"]') || 
                                        activeElement.closest('[cmdk-root]')) {
                                        return;
                                    }
                                    // If event was already prevented by CustomDropdown, don't handle it
                                    if (e.defaultPrevented) {
                                        return;
                                    }
                                    e.preventDefault(); // Prevent form submission
                                    const formEl = e.currentTarget;
                                    const formElements = Array.from(formEl.elements).filter(el => 
                                        (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && 
                                        !el.hasAttribute('disabled') && 
                                        (el as HTMLElement).offsetParent !== null
                                    ) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement)[];

                                    const currentElementIndex = formElements.findIndex(el => el === document.activeElement);
                                    
                                    if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
                                        formElements[currentElementIndex + 1].focus();
                                    }
                                }
                            }}
                            className="space-y-4"
                        >
                                <div onFocus={handleFieldFocus}>
                                    <SimpleSupplierFormAllFields 
                                        form={form}
                                        handleSrNoBlur={handleSrNoBlur}
                                        handleContactBlur={handleContactBlur}
                                        varietyOptions={varietyOptions}
                                        paymentTypeOptions={paymentTypeOptions}
                                        setLastVariety={handleSetLastVariety}
                                        setLastPaymentType={handleSetLastPaymentType}
                                        handleAddOption={handleAddOption}
                                        handleUpdateOption={handleUpdateOption}
                                        handleDeleteOption={handleDeleteOption}
                                        firstInputRef={firstInputRef}
                                    />
                                </div>
                        </form>
                    </FormProvider>
                </CardContent>
            </Card>

            {/* Summary + Commands side-by-side with proper spacing and borders */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-lg md:col-span-2">
                    <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm font-semibold">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <SimpleCalculatedSummary 
                            customer={{
                                ...currentSupplier,
                                grossWeight: form.watch('grossWeight') || 0,
                                teirWeight: form.watch('teirWeight') || 0,
                                kartaPercentage: form.watch('kartaPercentage') || 0,
                                rate: form.watch('rate') || 0,
                                labouryRate: form.watch('labouryRate') || 0,
                                brokerage: form.watch('brokerage') || 0,
                                brokerageRate: form.watch('brokerageRate') || 0,
                                brokerageAddSubtract: form.watch('brokerageAddSubtract') ?? true,
                                kanta: form.watch('kanta') || 0,
                                dueDate: (() => {
                                    const date = form.watch('date');
                                    const term = Number(form.watch('term')) || 20;
                                    if (date) {
                                        const dueDate = new Date(date);
                                        dueDate.setDate(dueDate.getDate() + term);
                                        return format(dueDate, 'yyyy-MM-dd');
                                    }
                                    return currentSupplier.dueDate;
                                })(),
                            }}
                            onSave={() => {
                                calculateSummary(); // Calculate before saving
                                form.handleSubmit(onSubmit)();
                            }}
                            onClearForm={undefined}
                            isEditing={isEditing}
                            isSubmitting={false}
                        />
                    </CardContent>
                </Card>

                {/* Commands Panel */}
                <Card className="bg-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-lg">
                    <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm font-semibold">Commands & Search</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-4">
                        {/* Search Section */}
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input
                                    type="text"
                                    placeholder="Search: name, contact, address, vehicle... (use commas for multi-step: vehicle, delhi)"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="pl-10 h-9"
                                />
                            </div>
                            
                            {/* Search Steps Display */}
                            {searchSteps.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs text-muted-foreground font-medium">
                                        Active Filters ({searchSteps.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {searchSteps.map((step, index) => (
                                            <div
                                                key={index}
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md border"
                                            >
                                                <span className="font-medium">Step {index + 1}:</span>
                                                <span>"{step}"</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons - 2 per row */}
                        <div className="space-y-2">
                            {/* Row 1: Clear Form & Save/Update */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    variant="outline" 
                                    onClick={handleNewEntry} 
                                    size="sm" 
                                    className="h-8 rounded-md"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Clear Form
                                </Button>

                                <Button 
                                    onClick={() => {
                                        // Validate in background, submit immediately (optimistic)
                                        const values = form.getValues();
                                        
                                        // Basic validation check
                                        if (!values.srNo || !values.name || !values.variety || !values.rate || !values.grossWeight) {
                                            toast({ 
                                                title: "Missing Required Fields", 
                                                description: "Please fill in all required fields (Sr No, Name, Variety, Rate, Gross Weight).", 
                                                variant: "destructive" 
                                            });
                                            // Validate in background to show field errors
                                            form.trigger().catch(() => {});
                                            return;
                                        }
                                        
                                        calculateSummary();
                                        
                                        // Submit immediately (optimistic)
                                        onSubmit(values);
                                        
                                        // Validate in background to show any errors
                                        form.trigger().catch(() => {});
                                    }} 
                                    size="sm" 
                                    className="h-8 rounded-md"
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {isEditing ? 'Update' : 'Save'}
                                </Button>
                            </div>

                            {/* Row 2: Import & Export */}
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={handleImportChange}
                                />
                                <Button variant="secondary" size="sm" onClick={handleImportClick} className="h-8">
                                    Import
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
                                    Export
                                </Button>
                            </div>

                            {/* Row 3: Delete & Print */}
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={handleDeleteCurrent}
                                    className="h-8"
                                    title={`Delete ${currentSupplier.id ? (currentSupplier.name || 'entry') : 'form/entry'}`}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handlePrintCurrent}
                                    className="h-8"
                                    title={`Print ${currentSupplier.id ? (currentSupplier.name || 'entry') : 'current form'}`}
                                >
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Latest 50 Entries Table with proper spacing */}
            <div className="mt-8">
                <SimpleSupplierTable 
                onBackToEntry={() => {}} // No back button needed in entry tab
                onEditSupplier={handleEditSupplier}
                onViewDetails={handleViewDetails}
                onPrintSupplier={handlePrintSupplier}
                onMultiPrint={handleMultiPrint}
                onMultiDelete={handleMultiDelete}
                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers : []}
                totalCount={filteredSuppliers.length}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                highlightEntryId={highlightEntryId}
                />
            </div>
        </div>
    ), [form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, handleSetLastVariety, handleSetLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, currentSupplier, calculateSummary, handleNewEntry, isEditing, isSubmitting, filteredSuppliers, handleEditSupplier, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete]);

    // Memoized data view for ultra fast rendering - always show table layout
    const dataView = useMemo(() => (
        <div className="transition-none will-change-auto">
            <SimpleSupplierTable 
                onBackToEntry={() => handleViewChange('entry')} 
                onEditSupplier={handleEditSupplier}
                onViewDetails={handleViewDetails}
                onPrintSupplier={handlePrintSupplier}
                onMultiPrint={handleMultiPrint}
                onMultiDelete={handleMultiDelete}
                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers : []}
                totalCount={filteredSuppliers.length}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                highlightEntryId={highlightEntryId}
            />
        </div>
    ), [filteredSuppliers, handleViewChange, handleEditSupplier, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete]);

    // Remove loading state completely - always show content
    // if (!isClient || isLoading) {
    //     return (
    //         <div className="flex justify-center items-center h-64">
    //             <Loader2 className="h-8 w-8 animate-spin text-primary" />
    //             <span className="ml-4 text-muted-foreground">Loading...</span>
    //         </div>
    //     );
    // }

    return (
        <div className="space-y-6">
            {/* Top bar removed as per request */}
                
                {/* Import/Export Controls moved to Commands Panel */}
                

            {/* View Content - Ultra Fast for Old Devices */}
            <div className="relative min-h-[400px]">
                {/* Entry View - Memoized for instant switching */}
                {currentView === 'entry' && entryView}

                {/* Data View - Memoized for instant switching */}
                {currentView === 'data' && dataView}
            </div>

            {/* Print Dialogs */}
            <CombinedReceiptPrintDialog
                receipts={receiptsToPrint}
                consolidatedData={consolidatedReceiptData}
                allConsolidatedGroups={allConsolidatedGroups}
                settings={receiptSettings}
                onOpenChange={(open) => {
                    if (!open) {
                        setReceiptsToPrint([]);
                        setConsolidatedReceiptData(null);
                        setAllConsolidatedGroups([]);
                    }
                }}
                isCustomer={false}
            />
            
            {/* Removed standalone individual and consolidated dialogs; combined dialog handles all */}

            {/* Details and Document Preview Dialogs */}
            <DetailsDialog
                isOpen={!!detailsCustomer}
                onOpenChange={(open) => !open && setDetailsCustomer(null)}
                customer={detailsCustomer}
                paymentHistory={[]} // No payment history for suppliers
                entryType="Supplier"
            />
            
            <DocumentPreviewDialog
                isOpen={isDocumentPreviewOpen}
                setIsOpen={setIsDocumentPreviewOpen}
                customer={documentPreviewCustomer}
                documentType={documentType}
                setDocumentType={setDocumentType}
                receiptSettings={receiptSettings}
            />
        </div>
    );
}

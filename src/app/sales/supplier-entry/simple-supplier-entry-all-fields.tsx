"use client";

import { useState, useEffect, useCallback, useMemo, useTransition, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { addSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, deleteSupplier, getSupplierIdBySrNo } from "@/lib/firestore";
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
    // Get suppliers data once and reuse - non-blocking
    const suppliersForSerial = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(1).toArray());
    const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray());
    const totalSuppliersCount = useLiveQuery(() => db.suppliers.count());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [currentView, setCurrentView] = useState<'entry' | 'data'>('entry');
    const [isEditing, setIsEditing] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isDataLoading, setIsDataLoading] = useState(false);
    const [entryTableLimit, setEntryTableLimit] = useState(50);
    const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
    const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
    const [allConsolidatedGroups, setAllConsolidatedGroups] = useState<ConsolidatedReceiptData[]>([]);
    const [receiptSettings, setReceiptSettings] = useState<any>(null);
    
    const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
    const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
    const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
    const [documentType, setDocumentType] = useState<'tax-invoice' | 'bill-of-supply' | 'challan' | 'rtgs-receipt'>('tax-invoice');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSteps, setSearchSteps] = useState<string[]>([]);

    // Import/Export refs
    const importInputRef = useRef<HTMLInputElement | null>(null);

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
            // Resolve a valid Firestore ID before delete
            let targetId = currentSupplier.id;
            if (!targetId || targetId.length < 4) {
                const bySr = await getSupplierIdBySrNo(currentSupplier.srNo);
                if (bySr) targetId = bySr;
                // As a final fallback, try Dexie lookup by srNo
                if ((!targetId || targetId.length < 4) && db) {
                    const local = await db.suppliers.where('srNo').equals(currentSupplier.srNo).first();
                    if (local?.id) targetId = local.id;
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
            const kartaWeight = Math.round(((finalWeight * Number(v.kartaPercentage || 0)) / 100) * 100) / 100;
            const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100;
            const amount = finalWeight * Number(v.rate || 0);
            const kartaAmount = kartaWeight * Number(v.rate || 0);
            const labouryAmount = finalWeight * Number(v.labouryRate || 0);
            const brokerageAmount = Math.round(Number(v.brokerageRate || 0) * netWeight * 100) / 100;
            const signedBrokerage = (v.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            const netAmount = amount - kartaAmount - labouryAmount - Number(v.kanta || 0) + signedBrokerage;
            const temp: Customer = {
                id: 'TEMP',
                srNo: v.srNo,
                date: format(v.date, 'yyyy-MM-dd'),
                term: String(v.term),
                dueDate: format(new Date(v.date.getTime() + v.term * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
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
                console.error('Error loading data:', error);
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

    // Hide loading when data is available or after timeout
    useEffect(() => {
        if (currentView === 'data' && isDataLoading) {
            if (allSuppliers && allSuppliers.length > 0) {
                // Data is available, hide loading immediately
                setIsDataLoading(false);
            } else {
                // No data yet, hide loading after a short delay
                const timeout = setTimeout(() => {
                    setIsDataLoading(false);
                }, 500); // 500ms delay
                
                return () => clearTimeout(timeout);
            }
        } else if (currentView === 'entry') {
            setIsDataLoading(false);
        }
    }, [currentView, allSuppliers, isDataLoading]);

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
        
        const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => console.error("Error fetching varieties:", err));
        const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => console.error("Error fetching payment types:", err));

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

        // Load receipt settings
        const defaultSettings = {
            companyName: "Jagdambe Rice Mill",
            contactNo: "9794092767",
            email: "",
            address: "",
            fields: {
                srNo: true,
                date: true,
                name: true,
                contact: true,
                address: true,
                vehicleNo: true,
                variety: true,
                grossWeight: true,
                teirWeight: true,
                weight: true,
                kartaWeight: true,
                netWeight: true,
                rate: true,
                amount: true,
                kartaAmount: true,
                labouryAmount: true,
                kanta: true,
                netAmount: true,
                dueDate: true,
                term: true
            }
        };
        setReceiptSettings(defaultSettings);

        return () => {
            unsubVarieties();
            unsubPaymentTypes();
        };
    }, [isClient, form]);

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
            
            const netWeight = grossWeight - teirWeight;
            const amount = netWeight * rate;
            const kartaAmount = (netWeight * kartaPercentage) / 100 * rate;
            const labouryAmount = netWeight * labouryRate;
            const netAmount = amount - kartaAmount - labouryAmount - kanta;

            setCurrentSupplier(prev => ({
                ...prev,
                srNo: values.srNo || 'S----',
                date: values.date ? format(values.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                term: String(values.term || 20),
                dueDate: values.date ? format(new Date(values.date.getTime() + (values.term || 20) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                name: values.name || '',
                so: values.so || '',
                address: values.address || '',
                contact: values.contact || '',
                vehicleNo: values.vehicleNo || '',
                variety: values.variety || '',
                grossWeight: grossWeight,
                teirWeight: teirWeight,
                weight: netWeight,
                kartaPercentage: kartaPercentage,
                kartaWeight: (netWeight * kartaPercentage) / 100,
                kartaAmount: kartaAmount,
                netWeight: netWeight,
                rate: rate,
                labouryRate: labouryRate,
                labouryAmount: labouryAmount,
                kanta: kanta,
                amount: amount,
                netAmount: netAmount,
                originalNetAmount: netAmount,
                paymentType: values.paymentType || 'Full',
            }));
        }
    }, [form]);

    // Real-time calculations with debouncing (updates summary as you type)
    useEffect(() => {
        const subscription = form.watch((values) => {
            const timer = setTimeout(() => {
                calculateSummary();
            }, 300); // Wait 300ms after user stops typing
            
            return () => clearTimeout(timer);
        });
        
        return () => subscription.unsubscribe();
    }, [calculateSummary]);

    const handleSrNoBlur = async (srNoValue: string) => {
        let formattedSrNo = srNoValue.trim();
        if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
            formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'S');
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
                console.error('Error checking existing supplier:', error);
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
                console.error('Error checking existing contact:', error);
            }
        }
    };

    const handleAddOption = useCallback(async (collectionName: string, name: string) => {
        try {
            await addOption(collectionName, { name });
            toast({ title: "Option added successfully!" });
        } catch (error) {
            toast({ title: "Error adding option", variant: "destructive" });
        }
    }, [toast]);
    
    const handleUpdateOption = useCallback(async (collectionName: string, id: string, name: string) => {
        try {
            await updateOption(collectionName, id, { name });
            toast({ title: "Option updated successfully!" });
        } catch (error) {
            toast({ title: "Error updating option", variant: "destructive" });
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
            await db.suppliers.delete(supplierId);
            toast({ 
                title: "Entry deleted successfully!", 
                description: "Supplier entry has been removed.",
                variant: "success"
            });
        } catch (error) {
            console.error('Error deleting supplier:', error);
            toast({ 
                title: "Error deleting entry", 
                description: "Failed to delete supplier entry.",
                variant: "destructive" 
            });
        }
    }, [toast]);

    const onSubmit = async (values: CompleteSupplierFormValues) => {
        console.log('onSubmit called with values:', values);
        console.log('isEditing:', isEditing);
        console.log('currentSupplier:', currentSupplier);
        
        setIsSubmitting(true);
        
        try {
            // Align DB save with summary calculations
            const finalWeight = Number(values.grossWeight) - Number(values.teirWeight);
            const rawKartaWt = (finalWeight * Number(values.kartaPercentage)) / 100;
            const kartaWeight = Math.round(rawKartaWt * 100) / 100; // 2-dec rounding; 0.875 -> 0.88
            const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100; // 2-dec net
            const amount = finalWeight * Number(values.rate);
            const kartaAmount = kartaWeight * Number(values.rate);
            const labouryAmount = finalWeight * Number(values.labouryRate);
            const brokerageAmount = Math.round(Number(values.brokerageRate || 0) * netWeight * 100) / 100;
            const signedBrokerage = (values.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
            const netAmount = amount - kartaAmount - labouryAmount - Number(values.kanta) + signedBrokerage;

            const supplierBase: Omit<Customer, 'id'> = {
                srNo: values.srNo,
                date: format(values.date, 'yyyy-MM-dd'),
                term: String(values.term),
                dueDate: format(new Date(values.date.getTime() + values.term * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                contact: values.contact,
                vehicleNo: (values.vehicleNo || '').toUpperCase(),
                variety: toTitleCase(values.variety),
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

            if (isEditing && currentSupplier.id) {
                // Update existing supplier - use currentSupplier.id directly
                console.log('UPDATE MODE: Updating supplier:', currentSupplier.id);
                console.log('Supplier base data:', supplierBase);
                
                let targetId = currentSupplier.id;
                
                // If ID seems invalid, try to find proper ID
                if (!targetId || targetId.length < 4) {
                    const foundId = await getSupplierIdBySrNo(values.srNo);
                    if (foundId) {
                        targetId = foundId;
                    } else {
                        // Try local DB lookup
                        const localSupplier = await db.suppliers.where('srNo').equals(values.srNo).first();
                        if (localSupplier?.id) {
                            targetId = localSupplier.id;
                        }
                    }
                }
                
                if (targetId && targetId.length > 3) {
                    const success = await updateSupplier(targetId, supplierBase);
                    
                    if (success) {
                        // Update local IndexedDB as well
                        try {
                            const existingLocal = await db.suppliers.get(targetId);
                            if (existingLocal) {
                                await db.suppliers.put({ ...existingLocal, ...supplierBase });
                            }
                        } catch (localError) {
                            console.warn('Failed to update local DB:', localError);
                        }
                        
                        setCurrentSupplier({ ...supplierBase, id: targetId } as Customer);
                        toast({ 
                            title: "Entry updated successfully!", 
                            description: `Supplier ${values.name} has been updated.`,
                            variant: "success"
                        });
                        setIsEditing(false);
                    } else {
                        throw new Error('Failed to update supplier - updateSupplier returned false');
                    }
                } else {
                    throw new Error(`Invalid supplier ID: ${targetId}. Cannot update.`);
                }
            } else {
                // Determine if supplier already exists by SR No
                let existingId = await getSupplierIdBySrNo(values.srNo);
                if (!existingId) {
                    const existingLocal = await db.suppliers.where('srNo').equals(values.srNo).first();
                    existingId = existingLocal?.id;
                }

                if (existingId) {
                    console.log('ADD MODE detected existing supplier. Updating instead:', existingId);
                    const success = await updateSupplier(existingId, supplierBase);
                    if (!success) {
                        throw new Error('Failed to update existing supplier with matching SR number.');
                    }
                    try {
                        const existingLocal = await db.suppliers.get(existingId);
                        if (existingLocal) {
                            await db.suppliers.put({ ...existingLocal, ...supplierBase });
                        }
                    } catch (localError) {
                        console.warn('Failed to update local DB:', localError);
                    }
                    setCurrentSupplier({ ...supplierBase, id: existingId } as Customer);
                    toast({
                        title: "Entry updated successfully!",
                        description: `Supplier ${values.name} has been updated.`,
                        variant: "success"
                    });
                    setIsEditing(false);
                } else {
                    // Add new supplier
                    console.log('ADD MODE: Creating new supplier');
                    const savedSupplier = await addSupplier({ id: crypto.randomUUID(), ...(supplierBase as any) } as Customer);
                    setCurrentSupplier({ ...supplierBase, id: savedSupplier.id } as Customer);
                    toast({ 
                        title: "Entry saved successfully!", 
                        description: `Supplier ${values.name} has been added.`,
                        variant: "success"
                    });
                    setIsEditing(false);
                }
            }

            // Reset form for new entry with next serial number (only if not editing)
            if (!isEditing) {
                form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            }
            
        } catch (error: any) {
            console.error("Error saving supplier:", error);
            console.error("Error stack:", error?.stack);
            toast({ 
                title: "Failed to save entry", 
                description: error?.message || "Please try again.",
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNewEntry = useCallback(() => {
        form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
        setIsEditing(false);
        setEntryTableLimit(50); // Reset to 50 entries
        toast({ title: "Form cleared" });
    }, [form, lastVariety, lastPaymentType, suppliersForSerial]);

    const handleLoadMore = useCallback(() => {
        const totalCount = totalSuppliersCount || 0;
        const currentLimit = entryTableLimit;
        const remainingEntries = totalCount - currentLimit;
        
        if (remainingEntries <= 100) {
            // Load all remaining entries if 100 or less
            setEntryTableLimit(totalCount);
        } else {
            // Load 600 more entries
            setEntryTableLimit(prev => prev + 600);
        }
    }, [totalSuppliersCount, entryTableLimit]);

    const handleFieldFocus = useCallback(() => {
        setEntryTableLimit(50); // Reset to 50 entries when any field is focused
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

    // Multi-step filtering logic
    const filteredSuppliers = useMemo(() => {
        if (!allSuppliers) {
            return [];
        }

        // If no search query or search steps, return all suppliers
        if (!searchQuery || searchQuery.trim() === '' || searchSteps.length === 0) {
            return allSuppliers;
        }

        // If only one search step, do normal search across all fields
        if (searchSteps.length === 1) {
            const query = searchSteps[0].toLowerCase().trim();
            return allSuppliers.filter(supplier => {
                return (
                    supplier.name?.toLowerCase().includes(query) ||
                    supplier.so?.toLowerCase().includes(query) ||
                    supplier.address?.toLowerCase().includes(query) ||
                    supplier.srNo?.toLowerCase().includes(query) ||
                    supplier.contact?.toLowerCase().includes(query) ||
                    supplier.vehicleNo?.toLowerCase().includes(query)
                );
            });
        }

        // Multiple search steps - apply progressive filtering
        let result = [...allSuppliers];
        
        searchSteps.forEach(step => {
            const query = step.toLowerCase().trim();
            if (query) {
                result = result.filter(supplier => {
                    return (
                        supplier.name?.toLowerCase().includes(query) ||
                        supplier.so?.toLowerCase().includes(query) ||
                        supplier.address?.toLowerCase().includes(query) ||
                        supplier.srNo?.toLowerCase().includes(query) ||
                        supplier.contact?.toLowerCase().includes(query) ||
                        supplier.vehicleNo?.toLowerCase().includes(query)
                    );
                });
            }
        });

        return result;
    }, [allSuppliers, searchQuery, searchSteps]);

    // Handle search input with multi-step filtering
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        
        // If empty, clear search steps
        if (!value || value.trim() === '') {
            setSearchSteps([]);
            return;
        }
        
        // Split by comma and filter out empty strings
        const steps = value.split(',').map(step => step.trim()).filter(step => step.length > 0);
        setSearchSteps(steps);
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

    const handleMultiPrint = useCallback((suppliers: Customer[]) => {
        if (suppliers.length === 0) return;

        // Group suppliers by name, father name, and address
        const groupedSuppliers = suppliers.reduce((groups, supplier) => {
            // Normalize the key to handle case differences and extra spaces
            const normalizedName = (supplier.name || '').trim().toLowerCase();
            const normalizedFatherName = (supplier.fatherName || '').trim().toLowerCase();
            const normalizedAddress = (supplier.address || '').trim().toLowerCase();
            const key = `${normalizedName}-${normalizedFatherName}-${normalizedAddress}`;
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(supplier);
            return groups;
        }, {} as Record<string, Customer[]>);

        const groups = Object.values(groupedSuppliers);
        
        // Prepare data for combined dialog
        const consolidatedGroups: ConsolidatedReceiptData[] = [];
        const individualSuppliers: Customer[] = [];
        
        groups.forEach((group) => {
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
    }, []);


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
            console.error('Error deleting suppliers:', error);
            toast({ 
                title: "Error", 
                description: "Failed to delete some suppliers", 
                variant: "destructive"
            });
        }
    }, []);

    const handleViewChange = useCallback((view: 'entry' | 'data') => {
        // Show loading for data view click
        if (view === 'data') {
            setIsDataLoading(true);
        }
        
        // Reset to 50 entries when switching to entry
        if (view === 'entry') {
            setEntryTableLimit(50);
        }
        
        // Ultra fast switching - non-blocking transition
        startTransition(() => {
            setCurrentView(view);
        });
    }, []);

    const handleEditSupplier = useCallback((supplier: Customer) => {
        // Fill form with supplier data
        form.reset({
            srNo: supplier.srNo,
            date: new Date(supplier.date),
            term: Number(supplier.term),
            name: supplier.name,
            so: supplier.so,
            address: supplier.address,
            contact: supplier.contact,
            vehicleNo: supplier.vehicleNo,
            variety: supplier.variety,
            grossWeight: supplier.grossWeight,
            teirWeight: supplier.teirWeight,
            rate: supplier.rate,
            kartaPercentage: supplier.kartaPercentage,
            labouryRate: supplier.labouryRate,
            kanta: supplier.kanta,
            paymentType: supplier.paymentType,
            forceUnique: supplier.forceUnique || false,
        });
        
        // Set current supplier with proper ID
        setCurrentSupplier(supplier);
        
        // Switch to entry tab with smooth transition
        handleViewChange('entry');
        setIsEditing(true);
        
        toast({ 
            title: "Supplier loaded for editing", 
            description: `${supplier.name} (SR# ${supplier.srNo}) loaded in form.`,
            variant: "success"
        });
    }, [form, handleViewChange, toast]);

    // Memoized entry view for ultra fast rendering
    const entryView = useMemo(() => (
        <div className="transition-none will-change-auto">
            <Card>
                <CardContent className="p-4">
                    <FormProvider {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                dueDate: form.watch('date') ? format(form.watch('date'), 'yyyy-MM-dd') : currentSupplier.dueDate,
                            }}
                            onSave={() => {
                                calculateSummary(); // Calculate before saving
                                form.handleSubmit(onSubmit)();
                            }}
                            onClearForm={undefined}
                            isEditing={isEditing}
                            isSubmitting={isSubmitting}
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
                                    disabled={isSubmitting}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Clear Form
                                </Button>

                                <Button 
                                    onClick={async () => {
                                        try {
                                            // Validate form first
                                            const isValid = await form.trigger();
                                            if (!isValid) {
                                                // Get form errors to show specific validation issues
                                                const formErrors = form.formState.errors;
                                                console.log('Form validation errors:', formErrors);
                                                
                                                // Helper function to extract all error messages
                                                const extractErrors = (errors: any, prefix = ''): string[] => {
                                                    const errorMessages: string[] = [];
                                                    for (const key in errors) {
                                                        const error = errors[key];
                                                        const fieldName = prefix ? `${prefix}.${key}` : key;
                                                        if (error?.message) {
                                                            errorMessages.push(`${fieldName}: ${error.message}`);
                                                        } else if (error && typeof error === 'object') {
                                                            errorMessages.push(...extractErrors(error, fieldName));
                                                        }
                                                    }
                                                    return errorMessages;
                                                };
                                                
                                                const errorMessages = extractErrors(formErrors);
                                                
                                                toast({ 
                                                    title: "Validation Error", 
                                                    description: errorMessages.length > 0 
                                                        ? errorMessages.slice(0, 3).join(', ') + (errorMessages.length > 3 ? ` and ${errorMessages.length - 3} more...` : '')
                                                        : "Please check the form for errors.", 
                                                    variant: "destructive",
                                                    duration: 5000
                                                });
                                                return;
                                            }
                                            
                                            calculateSummary();
                                            
                                            // Get form values and submit
                                            const values = form.getValues();
                                            console.log('Form values:', values);
                                            console.log('Is editing:', isEditing);
                                            console.log('Current supplier ID:', currentSupplier.id);
                                            
                                            await onSubmit(values);
                                        } catch (error: any) {
                                            console.error('Error in button onClick:', error);
                                            toast({ 
                                                title: "Error", 
                                                description: error?.message || "Failed to save entry.", 
                                                variant: "destructive" 
                                            });
                                        }
                                    }} 
                                    size="sm" 
                                    className="h-8 rounded-md" 
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
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
                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers.slice(0, entryTableLimit) : []}
                totalCount={filteredSuppliers.length}
                onLoadMore={handleLoadMore}
                showLoadMore={entryTableLimit < filteredSuppliers.length}
                currentLimit={entryTableLimit}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                />
            </div>
        </div>
    ), [form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, handleSetLastVariety, handleSetLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, currentSupplier, calculateSummary, handleNewEntry, isEditing, isSubmitting, filteredSuppliers, handleEditSupplier, entryTableLimit, handleLoadMore, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete]);

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
                isLoading={isDataLoading}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
            />
        </div>
    ), [filteredSuppliers, handleViewChange, handleEditSupplier, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete, isDataLoading]);

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

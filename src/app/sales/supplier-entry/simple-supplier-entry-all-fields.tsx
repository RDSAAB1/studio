"use client";

import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { addSupplier, getOptionsRealtime, addOption, updateOption, deleteOption } from "@/lib/firestore";
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { completeSupplierFormSchema, type CompleteSupplierFormValues } from "@/lib/complete-form-schema";
import SimpleSupplierFormAllFields from "@/components/sales/simple-supplier-form-all-fields";
import { SimpleCalculatedSummary } from "@/components/sales/simple-calculated-summary";
import { SupplierNavigationBar } from "@/components/sales/supplier-navigation-bar";
import { SimpleSupplierTable } from "@/components/sales/simple-supplier-table";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { CompactSupplierTable } from "@/components/sales/compact-supplier-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus } from "lucide-react";
import type { Customer, OptionItem } from "@/lib/definitions";

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
    const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<any>(null);
    const [receiptSettings, setReceiptSettings] = useState<any>(null);
    const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
    const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
    const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
    const [documentType, setDocumentType] = useState<'tax-invoice' | 'bill-of-supply' | 'challan' | 'rtgs-receipt'>('tax-invoice');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchSteps, setSearchSteps] = useState<string[]>([]);

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
            labouryRate: 2, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
            receiptType: 'Cash', paymentType: 'Full', customerId: '',
        };
    });

    const form = useForm<CompleteSupplierFormValues>({
        resolver: zodResolver(completeSupplierFormSchema),
        defaultValues: getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]),
    });

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
    }, [suppliersForSerial, lastVariety, lastPaymentType, form]);

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
                        ...existingSupplier,
                        date: existingSupplier.date ? new Date(existingSupplier.date) : new Date(),
                        dueDate: existingSupplier.dueDate ? new Date(existingSupplier.dueDate) : undefined,
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
            await addOption(collectionName, name);
            toast({ title: "Option added successfully!" });
        } catch (error) {
            toast({ title: "Error adding option", variant: "destructive" });
        }
    }, [toast]);
    
    const handleUpdateOption = useCallback(async (collectionName: string, id: string, name: string) => {
        try {
            await updateOption(collectionName, id, name);
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
        setIsSubmitting(true);
        
        try {
            // Simple calculation - just basic amount calculation
            const netWeight = values.grossWeight - values.teirWeight;
            const amount = netWeight * values.rate;
            const kartaAmount = (netWeight * values.kartaPercentage) / 100 * values.rate;
            const labouryAmount = netWeight * values.labouryRate;
            const netAmount = amount - kartaAmount - labouryAmount - values.kanta;

            const supplierData: Customer = {
                id: values.srNo,
                srNo: values.srNo,
                date: format(values.date, 'yyyy-MM-dd'),
                term: String(values.term),
                dueDate: format(new Date(values.date.getTime() + values.term * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                contact: values.contact,
                vehicleNo: toTitleCase(values.vehicleNo),
                variety: toTitleCase(values.variety),
                grossWeight: values.grossWeight,
                teirWeight: values.teirWeight,
                weight: netWeight,
                kartaPercentage: values.kartaPercentage,
                kartaWeight: (netWeight * values.kartaPercentage) / 100,
                kartaAmount: kartaAmount,
                netWeight: netWeight,
                rate: values.rate,
                labouryRate: values.labouryRate,
                labouryAmount: labouryAmount,
                kanta: values.kanta,
                amount: amount,
                netAmount: netAmount,
                originalNetAmount: netAmount,
                paymentType: values.paymentType,
                customerId: `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}`,
                barcode: '',
                receiptType: 'Cash',
                forceUnique: values.forceUnique,
            };

            if (isEditing) {
                // Update existing supplier
                const existingSupplier = await db.suppliers.where('srNo').equals(values.srNo).first();
                if (existingSupplier) {
                    await db.suppliers.update(existingSupplier.id, supplierData);
                    toast({ 
                        title: "Entry updated successfully!", 
                        description: `Supplier ${values.name} has been updated.`,
                        variant: "success"
                    });
                } else {
                    // If not found, add as new
                    await addSupplier(supplierData);
                    toast({ 
                        title: "Entry saved successfully!", 
                        description: `Supplier ${values.name} has been added.`,
                        variant: "success"
                    });
                }
                setIsEditing(false);
            } else {
                // Add new supplier
                await addSupplier(supplierData);
                toast({ 
                    title: "Entry saved successfully!", 
                    description: `Supplier ${values.name} has been added.`,
                    variant: "success"
                });
            }

            // Reset form for new entry with next serial number
            form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            
        } catch (error) {
            console.error("Error saving supplier:", error);
            toast({ 
                title: "Failed to save entry", 
                description: "Please try again.",
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

        // If no search steps, return all suppliers
        if (searchSteps.length === 0) {
            return allSuppliers;
        }

        // Apply filters step by step
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
    }, [allSuppliers, searchSteps]);

    // Handle search input with multi-step filtering
    const handleSearchChange = useCallback((value: string) => {
        setSearchQuery(value);
        
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

            {/* Simple Calculated Summary */}
            <SimpleCalculatedSummary 
                customer={currentSupplier}
                onSave={() => {
                    calculateSummary(); // Calculate before saving
                    form.handleSubmit(onSubmit)();
                }}
                onClearForm={handleNewEntry}
                isEditing={isEditing}
                isSubmitting={isSubmitting}
            />

            {/* Latest 50 Entries Table */}
            <SimpleSupplierTable 
                onBackToEntry={() => {}} // No back button needed in entry tab
                onEditSupplier={handleEditSupplier}
                onViewDetails={handleViewDetails}
                onPrintSupplier={handlePrintSupplier}
                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers.slice(0, entryTableLimit) : []}
                totalCount={filteredSuppliers.length}
                onLoadMore={handleLoadMore}
                showLoadMore={entryTableLimit < filteredSuppliers.length}
                currentLimit={entryTableLimit}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                searchSteps={searchSteps}
            />
        </div>
    ), [form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, handleSetLastVariety, handleSetLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, currentSupplier, calculateSummary, handleNewEntry, isEditing, isSubmitting, filteredSuppliers, handleEditSupplier, entryTableLimit, handleLoadMore, handleViewDetails, handlePrintSupplier, searchQuery, handleSearchChange, searchSteps]);

    // Memoized data view for ultra fast rendering - always show table layout
    const dataView = useMemo(() => (
        <div className="transition-none will-change-auto">
            <SimpleSupplierTable 
                onBackToEntry={() => handleViewChange('entry')} 
                onEditSupplier={handleEditSupplier}
                onViewDetails={handleViewDetails}
                onPrintSupplier={handlePrintSupplier}
                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers : []}
                totalCount={filteredSuppliers.length}
                isLoading={isDataLoading}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                searchSteps={searchSteps}
            />
        </div>
    ), [filteredSuppliers, handleViewChange, handleEditSupplier, handleViewDetails, handlePrintSupplier, isDataLoading, searchQuery, handleSearchChange, searchSteps]);

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
            {/* Navigation Bar */}
                <SupplierNavigationBar
                    activeView={currentView}
                    onEntryClick={() => handleViewChange('entry')}
                    onDataClick={() => handleViewChange('data')}
                    onNewEntry={handleNewEntry}
                    entryCount={1} // Current form entry
                    totalCount={totalSuppliersCount || 0}
                    isDataLoading={isDataLoading}
                />

            {/* View Content - Ultra Fast for Old Devices */}
            <div className="relative min-h-[400px]">
                {/* Entry View - Memoized for instant switching */}
                {currentView === 'entry' && entryView}

                {/* Data View - Memoized for instant switching */}
                {currentView === 'data' && dataView}
            </div>

            {/* Print Dialogs */}
            <ReceiptPrintDialog
                receipts={receiptsToPrint}
                settings={receiptSettings}
                onOpenChange={(open) => !open && setReceiptsToPrint([])}
                isCustomer={false}
            />
            
            <ConsolidatedReceiptPrintDialog
                data={consolidatedReceiptData}
                settings={receiptSettings}
                onOpenChange={(open) => !open && setConsolidatedReceiptData(null)}
                isCustomer={false}
            />

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
            />
        </div>
    );
}

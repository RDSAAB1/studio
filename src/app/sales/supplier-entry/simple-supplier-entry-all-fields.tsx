"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from '@/lib/use-live-query';
import { db } from '@/lib/database';
import { addSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, deleteSupplier, getSupplierIdBySrNo } from "@/lib/firestore";
import { useGlobalData } from '@/contexts/global-data-context';
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { completeSupplierFormSchema, type CompleteSupplierFormValues } from "@/lib/complete-form-schema";
import SimpleSupplierFormAllFields from "@/components/sales/simple-supplier-form-all-fields";
import { SimpleCalculatedSummary } from "@/components/sales/simple-calculated-summary";
import { SupplierNavigationBar } from "@/components/sales/supplier-navigation-bar";
import { SimpleSupplierTable } from "@/components/sales/simple-supplier-table";
import type { ConsolidatedReceiptData, ReceiptSettings } from "@/lib/definitions";
import { SupplierEntryDialogs } from "./components/supplier-entry-dialogs";
import { useSupplierImportExport } from "./hooks/use-supplier-import-export";
import { useSupplierSearch } from "./hooks/use-supplier-search";
import { useSupplierEntryForm } from "./hooks/use-supplier-entry-form";
import { CompactSupplierTable } from "@/components/sales/compact-supplier-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Plus, Search, Trash2, Printer } from "lucide-react";
import type { Customer, OptionItem } from "@/lib/definitions";
import type { DocumentType } from "@/lib/definitions";


// Memoized version of the supplier table to prevent re-renders while typing in the form
const MemoizedSupplierTable = React.memo(SimpleSupplierTable);

export default function SimpleSupplierEntryAllFields() {
    const { toast } = useToast();
    // Use global context for suppliers data (updated by global context, read from IndexedDB for reactivity)
    const globalData = useGlobalData();
    const suppliersForSerial = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(1).toArray());
    const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(500).toArray());
    const totalSuppliersCount = useLiveQuery(() => db.suppliers.count());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const [currentView, setCurrentView] = useState<'entry' | 'data'>('entry');
    const [dataLoaded, setDataLoaded] = useState(false);
    // NO LOADING STATES - Data loads initially, then only CRUD updates
    const receiptSettings: ReceiptSettings = globalData.receiptSettings ?? {
        companyName: '',
        companyAddress1: '',
        companyAddress2: '',
        contactNo: '',
        gmail: '',
        fields: {
            date: true,
            name: true,
            contact: true,
            address: true,
            vehicleNo: true,
            term: true,
            rate: true,
            grossWeight: true,
            teirWeight: true,
            weight: true,
            amount: true,
            dueDate: true,
            kartaWeight: true,
            netAmount: true,
            srNo: true,
            variety: true,
            netWeight: true,
        },
    };
    
    const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
    const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
    const [documentPreviewCustomer, setDocumentPreviewCustomer] = useState<Customer | null>(null);
    const [documentType, setDocumentTypeState] = useState<DocumentType>('tax-invoice');
    // Import/Export hook
    const {
      handleExport,
      handleImportClick,
      handleImportChange,
      importInputRef,
    } = useSupplierImportExport({ allSuppliers });

    // Search hook
    const {
      searchQuery,
      searchSteps,
      filteredSuppliers,
      handleSearchChange,
      isPending: isSearchPending,
    } = useSupplierSearch({ allSuppliers });
    const formRef = useRef<HTMLFormElement | null>(null);
    const firstInputRef = useRef<HTMLInputElement | null>(null);

    // Import/Export handlers are now from useSupplierImportExport hook

    const {
        form,
        currentSupplier,
        isEditing,
        isSubmitting: hookIsSubmitting,
        onSubmit,
        handleDeleteCurrent,
        handlePrintCurrent,
        handleNewEntry,
        handleAddOption,
        handleUpdateOption,
        handleDeleteOption,
        varietyOptions,
        paymentTypeOptions,
        handleSrNoBlur,
        handleContactBlur,
        handleSetLastVariety,
        handleSetLastPaymentType,
        highlightEntryId,
        receiptsToPrint,
        setReceiptsToPrint,
        consolidatedReceiptData,
        setConsolidatedReceiptData,
        allConsolidatedGroups,
        setAllConsolidatedGroups,
        calculateSummary,
        handleEditSupplier: hookHandleEditSupplier,
        uniqueProfiles,
        handleUseProfile,
        uniqueNames,
        uniqueSo,
        uniqueAddresses,
        uniqueVehicleNos,
        uniqueContacts,
    } = useSupplierEntryForm({
        isClient,
        allSuppliers,
        suppliersForSerial,
    });

    const handleViewDetails = useCallback((supplier: Customer) => {
        // Open detail window for supplier
        setDetailsCustomer(supplier);
    }, []);

    const handleOpenPrintPreview = useCallback((supplier: Customer) => {
        setDocumentPreviewCustomer(supplier);
        setDocumentTypeState('tax-invoice');
        setIsDocumentPreviewOpen(true);
    }, []);

    // Search/filter logic is now from useSupplierSearch hook

    const handleFieldFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        // Intentionally left blank; used to capture focus events on the form container
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


    const [isDeletingSelected, setIsDeletingSelected] = useState(false);

    const handleMultiDelete = useCallback(async (supplierIds: string[]) => {
        if (supplierIds.length === 0) return;
        setIsDeletingSelected(true);
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
        } finally {
            setIsDeletingSelected(false);
        }
    }, [toast]);

    const handleViewChange = useCallback((view: 'entry' | 'data') => {
        // NO LOADING - Instant switch
        setCurrentView(view);
    }, []);

    const handleEditSupplier = useCallback((supplier: Customer) => {
        // Use hook's handler for logic (sets state, resets form, shows toast)
        hookHandleEditSupplier(supplier);
        
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
    }, [hookHandleEditSupplier, handleViewChange]);

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
                    
/* 
                    toast({
                        title: "Entry Loaded",
                        description: `Loaded ${supplierData.name} (SR# ${supplierData.srNo}) for editing.`,
                    });
*/
                } catch (error) {
                    localStorage.removeItem('editSupplierData');
                }
            }
        }
    }, [isClient, handleEditSupplier, toast]);
    
    // Global Shortcuts (Alt+S, Alt+C)
    useEffect(() => {
        const onSave = () => {
            // Only execute if this component is visible in the DOM
            if (formRef.current?.closest('.hidden') || hookIsSubmitting) return;
            form.handleSubmit(onSubmit)();
        };
        const onClear = () => {
            // Only execute if this component is visible in the DOM
            if (formRef.current?.closest('.hidden')) return;
            handleNewEntry();
        };

        const onPrint = () => {
            if (formRef.current?.closest('.hidden')) return;
            handlePrintCurrent();
        };

        window.addEventListener('app:save-entry', onSave);
        window.addEventListener('app:clear-form', onClear);
        window.addEventListener('app:print-entry', onPrint);

        return () => {
            window.removeEventListener('app:save-entry', onSave);
            window.removeEventListener('app:clear-form', onClear);
            window.removeEventListener('app:print-entry', onPrint);
        };
    }, [form, onSubmit, handleNewEntry, hookIsSubmitting]);


    // Memoized data view for ultra fast rendering - always show table layout
    const dataView = useMemo(() => (
        <div className="transition-none will-change-auto">
            <MemoizedSupplierTable 
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
                highlightEntryId={highlightEntryId ?? undefined}
            />
        </div>
    ), [filteredSuppliers, handleViewChange, handleEditSupplier, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete, varietyOptions, paymentTypeOptions, highlightEntryId]);


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
                {/* Entry View - Only the form part is in entryView useMemo */}
                {currentView === 'entry' && (
                    <div className="transition-none will-change-auto space-y-8">
                        <Card>
                            <CardContent className="p-4">
                                <FormProvider {...form}>
                                    <form 
                                        id="supplier-entry-form"
                                        ref={formRef} 
                                        onSubmit={form.handleSubmit(onSubmit)} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const activeElement = document.activeElement as HTMLElement;
                                                if (activeElement.tagName === 'BUTTON' || 
                                                    activeElement.closest('[role="dialog"]') || 
                                                    activeElement.closest('[role="menu"]') || 
                                                    activeElement.closest('[cmdk-root]')) {
                                                    return;
                                                }
                                                if (e.defaultPrevented) return;
                                                e.preventDefault();
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
                                                handleAddOption={(collectionName, name) => void handleAddOption(collectionName, name)}
                                                handleUpdateOption={(collectionName, id, name) => void handleUpdateOption(collectionName, id, { name })}
                                                handleDeleteOption={(collectionName, id, name) => void handleDeleteOption(collectionName, id, name)}
                                                handleUseProfile={handleUseProfile}
                                                uniqueProfiles={uniqueProfiles}
                                                uniqueNames={uniqueNames}
                                                uniqueSo={uniqueSo}
                                                uniqueAddresses={uniqueAddresses}
                                                uniqueVehicleNos={uniqueVehicleNos}
                                                uniqueContacts={uniqueContacts}
                                                firstInputRef={firstInputRef}
                                            />
                                        </div>
                                    </form>
                                </FormProvider>
                            </CardContent>
                        </Card>

                        {/* Summary + Commands (Isolated from entryView useMemo) */}
                        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                            <div className="flex-1 min-w-0 lg:flex-[0.6] lg:min-w-[55%] order-2 lg:order-1">
                                <Card className="h-full">
                                    <CardHeader className="p-3 pb-2">
                                        <CardTitle className="text-sm font-semibold">Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0">
                                        <FormProvider {...form}>
                                            <SimpleCalculatedSummary 
                                                onSave={() => {
                                                    calculateSummary();
                                                    form.handleSubmit(onSubmit)();
                                                }}
                                                onClearForm={undefined}
                                                isEditing={isEditing}
                                                isSubmitting={hookIsSubmitting}
                                            />
                                        </FormProvider>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex-1 min-w-0 lg:min-w-[320px] order-1 lg:order-2">
                                <Card className="h-full">
                                    <CardHeader className="p-3 pb-2">
                                        <CardTitle className="text-sm font-semibold">Commands & Search</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 space-y-4">
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                <Input
                                                    type="text"
                                                    placeholder="Search..."
                                                    value={searchQuery}
                                                    onChange={(e) => handleSearchChange(e.target.value)}
                                                    className="pl-10 h-9"
                                                />
                                            </div>
                                            {searchSteps.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {searchSteps.map((step, index) => (
                                                        <div key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md border">
                                                            <span>Step {index + 1}: "{step}"</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" onClick={handleNewEntry} size="sm" className="h-8">
                                                    <Plus className="mr-2 h-4 w-4" /> Clear (Alt+C)
                                                </Button>
                                                <Button type="submit" form="supplier-entry-form" disabled={hookIsSubmitting} size="sm" className="h-8 font-bold">
                                                    {hookIsSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                    {isEditing ? 'Update (Alt+S)' : 'Save (Alt+S)'}
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input ref={importInputRef} type="file" className="hidden" onChange={handleImportChange} />
                                                <Button variant="secondary" size="sm" onClick={handleImportClick} className="h-8">Import</Button>
                                                <Button variant="outline" size="sm" onClick={handleExport} className="h-8">Export</Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="destructive" size="sm" onClick={handleDeleteCurrent} className="h-8">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={handlePrintCurrent} className="h-8">
                                                    <Printer className="mr-2 h-4 w-4" /> Print
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Table - Fully isolated, only refreshes when search or data changes */}
                        <div className="mt-8">
                            <MemoizedSupplierTable 
                                onBackToEntry={() => {}} 
                                onEditSupplier={handleEditSupplier}
                                onViewDetails={handleViewDetails}
                                onPrintSupplier={handlePrintSupplier}
                                onMultiPrint={handleMultiPrint}
                                onMultiDelete={handleMultiDelete}
                                suppliers={Array.isArray(filteredSuppliers) ? filteredSuppliers : []}
                                totalCount={filteredSuppliers.length}
                                varietyOptions={varietyOptions}
                                paymentTypeOptions={paymentTypeOptions}
                                highlightEntryId={highlightEntryId ?? undefined}
                            />
                        </div>
                    </div>
                )}

                {/* Data View - Memoized for instant switching */}
                {currentView === 'data' && dataView}
            </div>

            <SupplierEntryDialogs
                receiptsToPrint={receiptsToPrint}
                setReceiptsToPrint={setReceiptsToPrint}
                consolidatedReceiptData={consolidatedReceiptData}
                setConsolidatedReceiptData={setConsolidatedReceiptData}
                allConsolidatedGroups={allConsolidatedGroups}
                setAllConsolidatedGroups={setAllConsolidatedGroups}
                receiptSettings={receiptSettings}
                detailsCustomer={detailsCustomer}
                setDetailsCustomer={setDetailsCustomer}
                isDocumentPreviewOpen={isDocumentPreviewOpen}
                setIsDocumentPreviewOpen={setIsDocumentPreviewOpen}
                documentPreviewCustomer={documentPreviewCustomer}
                documentType={documentType}
                setDocumentType={(type) => setDocumentTypeState(type)}
            />
        </div>
    );
}


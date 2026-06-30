"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
import { FuzzyCorrectionDialog } from "@/components/sales/fuzzy-correction-dialog";
import { ImportConfigDialog } from "@/components/sales/import-config-dialog";
import { useSupplierSearch } from "./hooks/use-supplier-search";
import { useSupplierEntryForm } from "./hooks/use-supplier-entry-form";
import { CompactSupplierTable } from "@/components/sales/compact-supplier-table";
import { StockPurchaseTab } from "./components/stock-purchase-tab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveQuery as useDexieLiveQuery } from "dexie-react-hooks";

import { Loader2, Save, Plus, Search, Trash2, Printer, Upload, Download } from "lucide-react";
import type { Customer, OptionItem } from "@/lib/definitions";
import type { DocumentType } from "@/lib/definitions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";


// Memoized version of the supplier table to prevent re-renders while typing in the form
const MemoizedSupplierTable = React.memo(SimpleSupplierTable);

function levenshteinDistanceCleaned(str1: string, str2: string): number {
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1,
                track[j - 1][i] + 1,
                track[j - 1][i - 1] + indicator
            );
        }
    }
    return track[str2.length][str1.length];
}

interface SupplierCluster {
    primaryIdentity: string;
    cleanName: string;
    cleanSo: string;
    cleanAddr: string;
    count: number;
    supplierIds: Set<string>;
}

const EMPTY_ARRAY: any[] = [];

export default function SimpleSupplierEntryAllFields() {
    const { toast } = useToast();
    const [isFilterPending, setIsFilterPending] = useState(false);
    const triggerFilterWithOverlay = useCallback((action: () => void) => {
        setIsFilterPending(true);
        setTimeout(() => {
            action();
            setTimeout(() => setIsFilterPending(false), 10);
        }, 50);
    }, []);
    // Use global context for suppliers data (updated by global context, read from IndexedDB for reactivity)
    const globalData = useGlobalData();
    const [isImportMode, setIsImportMode] = useState(false);
    const allStagedSuppliers = useLiveQuery(() => db.stagedSuppliers.toArray()) || EMPTY_ARRAY;
    const suppliersForSerial = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(1).toArray());
    const allSuppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray()) || EMPTY_ARRAY;
    
    const activeSuppliersList = useMemo(() => {
        return isImportMode ? allStagedSuppliers : allSuppliers;
    }, [isImportMode, allStagedSuppliers, allSuppliers]);

    const [dropdownFuzzyClusters, setDropdownFuzzyClusters] = useState<SupplierCluster[]>([]);

    useEffect(() => {
        if (!isImportMode || activeSuppliersList.length === 0) {
            if (dropdownFuzzyClusters.length > 0) {
                setDropdownFuzzyClusters([]);
            }
            return;
        }

        const timer = setTimeout(() => {
            const cleaned = activeSuppliersList.map(s => {
                const name = s.name || '';
                const so = s.so || s.fatherName || '';
                const address = s.address || '';
                
                const fatherPart = so ? ` S/o ${so}` : '';
                const addrPart = address ? ` | ${address}` : '';
                const identity = `${name}${fatherPart}${addrPart}`;
                
                return {
                    id: s.id,
                    identityStr: identity,
                    cleanName: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    cleanSo: so.toLowerCase().replace(/[^a-z0-9]/g, ''),
                    cleanAddr: address.toLowerCase().replace(/[^a-z0-9]/g, '')
                };
            });

            const clusters: SupplierCluster[] = [];

            for (const item of cleaned) {
                let foundCluster = false;
                
                for (const cluster of clusters) {
                    const nameDist = levenshteinDistanceCleaned(item.cleanName, cluster.cleanName);
                    const nameLen = Math.max(item.cleanName.length, cluster.cleanName.length);
                    const nameSim = nameLen === 0 ? 1.0 : 1.0 - nameDist / nameLen;
                    
                    const soDist = levenshteinDistanceCleaned(item.cleanSo, cluster.cleanSo);
                    const soLen = Math.max(item.cleanSo.length, cluster.cleanSo.length);
                    const soSim = soLen === 0 ? 1.0 : 1.0 - soDist / soLen;
                    
                    const addrDist = levenshteinDistanceCleaned(item.cleanAddr, cluster.cleanAddr);
                    const addrLen = Math.max(item.cleanAddr.length, cluster.cleanAddr.length);
                    const addrSim = addrLen === 0 ? 1.0 : 1.0 - addrDist / addrLen;
                    
                    // Weight name matching higher
                    const score = (nameSim * 0.5) + (soSim * 0.3) + (addrSim * 0.2);
                    
                    if (score >= 0.85) {
                        cluster.count += 1;
                        cluster.supplierIds.add(item.id);
                        foundCluster = true;
                        break;
                    }
                }
                
                if (!foundCluster) {
                    clusters.push({
                        primaryIdentity: item.identityStr,
                        cleanName: item.cleanName,
                        cleanSo: item.cleanSo,
                        cleanAddr: item.cleanAddr,
                        count: 1,
                        supplierIds: new Set([item.id])
                    });
                }
            }
            
            setDropdownFuzzyClusters(clusters.sort((a, b) => b.count - a.count));
        }, 150);

        return () => clearTimeout(timer);
    }, [activeSuppliersList, isImportMode]);

    const identityOptions = useMemo(() => {
        return dropdownFuzzyClusters.map((cluster) => ({
                value: cluster.primaryIdentity,
                label: `${cluster.primaryIdentity} - (${cluster.count} Receipts)`,
                displayValue: cluster.primaryIdentity
            }));
    }, [dropdownFuzzyClusters]);

    const totalSuppliersCount = useLiveQuery(() => isImportMode ? db.stagedSuppliers.count() : db.suppliers.count());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [selectedVariety, setSelectedVariety] = useState<string>("ALL");
    const [selectedIdentityFilter, setSelectedIdentityFilter] = useState<string | null>(null);
    const [selectedDateFilter, setSelectedDateFilter] = useState<string>("ALL");
    const [selectedParticularDate, setSelectedParticularDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedStartDate, setSelectedStartDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    const [selectedEndDate, setSelectedEndDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient) return;
        const loadDefaultFilters = async () => {
            try {
                // Variety
                const storedVariety = await db.settings.get('supplierEntryDefaultVariety');
                if (storedVariety && (storedVariety as any).value) {
                    setSelectedVariety((storedVariety as any).value);
                } else {
                    const localVariety = localStorage.getItem('supplierEntryDefaultVariety');
                    if (localVariety) setSelectedVariety(localVariety);
                }

                // Date Filter Mode
                const storedDateFilter = await db.settings.get('supplierEntryDefaultDateFilter');
                if (storedDateFilter && (storedDateFilter as any).value) {
                    setSelectedDateFilter((storedDateFilter as any).value);
                } else {
                    const localDateFilter = localStorage.getItem('supplierEntryDefaultDateFilter');
                    if (localDateFilter) setSelectedDateFilter(localDateFilter);
                }

                // Particular Date
                const storedParticularDate = await db.settings.get('supplierEntryDefaultParticularDate');
                if (storedParticularDate && (storedParticularDate as any).value) {
                    setSelectedParticularDate((storedParticularDate as any).value);
                } else {
                    const localParticularDate = localStorage.getItem('supplierEntryDefaultParticularDate');
                    if (localParticularDate) setSelectedParticularDate(localParticularDate);
                }

                // Start Date
                const storedStartDate = await db.settings.get('supplierEntryDefaultStartDate');
                if (storedStartDate && (storedStartDate as any).value) {
                    setSelectedStartDate((storedStartDate as any).value);
                } else {
                    const localStartDate = localStorage.getItem('supplierEntryDefaultStartDate');
                    if (localStartDate) setSelectedStartDate(localStartDate);
                }

                // End Date
                const storedEndDate = await db.settings.get('supplierEntryDefaultEndDate');
                if (storedEndDate && (storedEndDate as any).value) {
                    setSelectedEndDate((storedEndDate as any).value);
                } else {
                    const localEndDate = localStorage.getItem('supplierEntryDefaultEndDate');
                    if (localEndDate) setSelectedEndDate(localEndDate);
                }
            } catch (err) {
                console.error("Failed to load default filters:", err);
            }
        };
        loadDefaultFilters();
    }, [isClient]);

    const handleVarietyChange = useCallback(async (val: string | null) => {
        const newValue = val || "ALL";
        triggerFilterWithOverlay(() => {
            setSelectedVariety(newValue);
        });
        
        try {
            await db.settings.put({ id: 'supplierEntryDefaultVariety', value: newValue });
            localStorage.setItem('supplierEntryDefaultVariety', newValue);
        } catch (err) {
            console.error("Failed to save default variety:", err);
        }
    }, [triggerFilterWithOverlay]);

    const handleDateFilterModeChange = useCallback(async (val: string | null) => {
        const newValue = val || "ALL";
        triggerFilterWithOverlay(() => {
            setSelectedDateFilter(newValue);
        });
        try {
            await db.settings.put({ id: 'supplierEntryDefaultDateFilter', value: newValue });
            localStorage.setItem('supplierEntryDefaultDateFilter', newValue);
        } catch (err) {
            console.error("Failed to save date filter mode:", err);
        }
    }, [triggerFilterWithOverlay]);

    const handleParticularDateChange = useCallback(async (val: string) => {
        triggerFilterWithOverlay(() => {
            setSelectedParticularDate(val);
        });
        try {
            await db.settings.put({ id: 'supplierEntryDefaultParticularDate', value: val });
            localStorage.setItem('supplierEntryDefaultParticularDate', val);
        } catch (err) {
            console.error("Failed to save particular date:", err);
        }
    }, [triggerFilterWithOverlay]);

    const handleStartDateChange = useCallback(async (val: string) => {
        triggerFilterWithOverlay(() => {
            setSelectedStartDate(val);
        });
        try {
            await db.settings.put({ id: 'supplierEntryDefaultStartDate', value: val });
            localStorage.setItem('supplierEntryDefaultStartDate', val);
        } catch (err) {
            console.error("Failed to save start date:", err);
        }
    }, [triggerFilterWithOverlay]);

    const handleEndDateChange = useCallback(async (val: string) => {
        triggerFilterWithOverlay(() => {
            setSelectedEndDate(val);
        });
        try {
            await db.settings.put({ id: 'supplierEntryDefaultEndDate', value: val });
            localStorage.setItem('supplierEntryDefaultEndDate', val);
        } catch (err) {
            console.error("Failed to save end date:", err);
        }
    }, [triggerFilterWithOverlay]);

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
      isImporting,
      importProgress,
      importStatus,
      importCurrent,
      importTotal,
      importStartTime,
      showFuzzyDialog,
      fuzzyClusters,
      handleResolveFuzzy,
      handleCancelFuzzy,
      handleCancelImport,
      showConfigDialog,
      handleConfirmConfig,
      handleCancelConfig,
      pendingImportData,
    } = useSupplierImportExport({ allSuppliers: activeSuppliersList });

    const {
      searchQuery,
      searchSteps,
      filteredSuppliers,
      handleSearchChange,
      isPending: isSearchPending,
    } = useSupplierSearch({ allSuppliers: activeSuppliersList });

    const filteredSuppliersByAllFilters = useMemo(() => {
        let result = filteredSuppliers;

        // Identity Filter (using fuzzy clusters)
        if (isImportMode && selectedIdentityFilter) {
            const selectedCluster = dropdownFuzzyClusters.find(c => c.primaryIdentity === selectedIdentityFilter);
            if (selectedCluster) {
                result = result.filter(s => selectedCluster.supplierIds.has(s.id));
            }
        }

        // 1. Variety Filter
        if (selectedVariety && selectedVariety !== "ALL") {
            result = result.filter(supplier => 
                supplier.variety && supplier.variety.trim().toUpperCase() === selectedVariety.trim().toUpperCase()
            );
        }

        // 2. Date Filter
        if (selectedDateFilter === "TODAY") {
            const todayStr = format(new Date(), "yyyy-MM-dd");
            result = result.filter(supplier => supplier.date === todayStr);
        } else if (selectedDateFilter === "PARTICULAR" && selectedParticularDate) {
            result = result.filter(supplier => supplier.date === selectedParticularDate);
        } else if (selectedDateFilter === "RANGE" && selectedStartDate && selectedEndDate) {
            result = result.filter(supplier => {
                const sDate = supplier.date;
                return sDate >= selectedStartDate && sDate <= selectedEndDate;
            });
        }

        return result;
    }, [filteredSuppliers, isImportMode, selectedIdentityFilter, selectedVariety, selectedDateFilter, selectedParticularDate, selectedStartDate, selectedEndDate]);

    const formRef = useRef<HTMLFormElement | null>(null);
    const firstInputRef = useRef<HTMLInputElement | null>(null);

    // Import/Export handlers are now from useSupplierImportExport hook


    const handleMergeSelected = useCallback(async (selectedIds: string[]) => {
        if (selectedIds.length === 0) return;
        
        try {
            toast({
                title: "Merging Records",
                description: `Processing ${selectedIds.length} records...`,
            });

            // Get selected staged supplier objects
            const selectedStaged = await db.stagedSuppliers.where('id').anyOf(selectedIds).toArray();
            if (selectedStaged.length === 0) return;

            const { mergeStagedSuppliers } = await import("@/lib/firestore/suppliers");
            const { addCount, updateCount } = await mergeStagedSuppliers(selectedStaged);

            toast({
                title: "Merge Complete",
                description: `Successfully processed ${selectedStaged.length} records (${addCount} added, ${updateCount} updated).`,
            });
        } catch (error) {
            console.error("Merge error:", error);
            toast({
                title: "Merge Failed",
                description: "An error occurred during merge.",
                variant: "destructive",
            });
        }
    }, [toast]);


    // Combine main DB + staged suppliers for suggestions in import mode
    const allSuppliersForSuggestions = useMemo(() => {
        const mainList = allSuppliers || [];
        if (isImportMode && allStagedSuppliers.length > 0) {
            // Merge both, main DB first (higher priority), then staged
            return [...mainList, ...allStagedSuppliers];
        }
        return mainList;
    }, [allSuppliers, allStagedSuppliers, isImportMode]);

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
        allSuppliers: allSuppliersForSuggestions, // Combined sources for suggestions
        suppliersForSerial,
        isImportMode,
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
            
            // Toast notifications removed to prevent interference with print preview opening.
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
        
        // In import mode, don't switch to entry view - table handles editing inline
        if (!isImportMode) {
            // Switch to entry tab with smooth transition
            handleViewChange('entry');
            
            // Ensure form is enabled and ready for editing
            setTimeout(() => {
                // Try to focus the first input field
                if (firstInputRef.current) {
                    firstInputRef.current?.focus();
                    firstInputRef.current.select(); // Select text for easy editing
                    firstInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (formRef.current) {
                    // If first input not available, scroll to form
                    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 150);
        }
    }, [hookHandleEditSupplier, handleViewChange, isImportMode]);

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
    }, [hookIsSubmitting, handleNewEntry, handlePrintCurrent, form]);

    const dataView = useMemo(() => (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Data Management</h2>
                <Button variant="outline" size="sm" onClick={() => handleViewChange('entry')}>
                    Back to Entry
                </Button>
            </div>
            <MemoizedSupplierTable 
                onBackToEntry={() => handleViewChange('entry')} 
                onEditSupplier={handleEditSupplier}
                onViewDetails={handleViewDetails}
                onPrintSupplier={handlePrintSupplier}
                onMultiPrint={handleMultiPrint}
                onMultiDelete={handleMultiDelete}
                suppliers={Array.isArray(filteredSuppliersByAllFilters) ? filteredSuppliersByAllFilters : []}
                totalCount={filteredSuppliersByAllFilters.length}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                uniqueProfiles={uniqueProfiles}
                uniqueNames={uniqueNames}
                uniqueSo={uniqueSo}
                uniqueAddresses={uniqueAddresses}
                uniqueContacts={uniqueContacts}
                highlightEntryId={highlightEntryId ?? undefined}
                selectedVariety={selectedVariety}
                onVarietyChange={handleVarietyChange}
                selectedDateFilter={selectedDateFilter}
                onDateFilterModeChange={handleDateFilterModeChange}
                selectedParticularDate={selectedParticularDate}
                onParticularDateChange={handleParticularDateChange}
                selectedStartDate={selectedStartDate}
                onStartDateChange={handleStartDateChange}
                selectedEndDate={selectedEndDate}
                onEndDateChange={handleEndDateChange}
                isImportMode={isImportMode}
                onMergeSelected={handleMergeSelected}
                isFilterPending={isFilterPending}
            />
        </div>
    ), [filteredSuppliersByAllFilters, handleEditSupplier, handleViewDetails, handlePrintSupplier, handleMultiPrint, handleMultiDelete, varietyOptions, paymentTypeOptions, highlightEntryId, handleViewChange, selectedVariety, handleVarietyChange, selectedDateFilter, handleDateFilterModeChange, selectedParticularDate, handleParticularDateChange, selectedStartDate, handleStartDateChange, selectedEndDate, handleEndDateChange, uniqueProfiles, uniqueNames, uniqueSo, uniqueAddresses, uniqueContacts]);

    return (
        <div className="space-y-6">
            <div className="relative min-h-[400px]">
                {currentView === 'entry' && (
                    <div className="w-full">
                        <div className="transition-none will-change-auto space-y-8">
                                {(!isImportMode || isEditing) && (
                        <Card className={cn(isEditing && isImportMode && "border-amber-500 shadow-md ring-1 ring-amber-500/50")}>
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
                                                    const nextEl = formElements[currentElementIndex + 1];
                                                    nextEl?.focus();
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
                                                isImportMode={isImportMode}
                                            />
                                        </div>
                                    </form>
                                </FormProvider>
                            </CardContent>
                        </Card>
                        )}

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
                                    <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm font-semibold">Commands & Search</CardTitle>
                                        <div className="flex items-center space-x-2 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 shadow-sm">
                                            <Switch 
                                                id="import-mode-toggle" 
                                                checked={isImportMode} 
                                                onCheckedChange={(val) => {
                                                    setIsImportMode(val);
                                                    toast({
                                                        title: val ? "Import Mode Enabled" : "Import Mode Disabled",
                                                        description: val ? "Now viewing staging data. Top form is simplified." : "Now viewing main supplier database.",
                                                    });
                                                }} 
                                                className="scale-75" 
                                            />
                                            <Label htmlFor="import-mode-toggle" className="text-[10px] font-bold uppercase cursor-pointer text-slate-700">Import Mode</Label>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0 space-y-4">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                                    <Input
                                                        type="text"
                                                        placeholder="Search..."
                                                        value={searchQuery}
                                                        onChange={(e) => handleSearchChange(e.target.value)}
                                                        className="pl-10 h-9"
                                                    />
                                                </div>
                                            </div>
                                            {isImportMode && (
                                                <div className="flex flex-col space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Filter by Identity</Label>
                                                    <CustomDropdown
                                                        options={identityOptions}
                                                        value={selectedIdentityFilter}
                                                        onChange={setSelectedIdentityFilter}
                                                        placeholder="Select exact identity..."
                                                        searchPlaceholder="Search Name/S.O/Address..."
                                                        showClearButton={true}
                                                        showSearch={true}
                                                        preserveOrder={true}
                                                    />
                                                </div>
                                            )}
                                            {searchSteps.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {searchSteps.map((step, index) => (
                                                        <div key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md border">
                                                            <span>Step {index + 1}: "{step}"</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                         <div className="space-y-2">
                                             <div className="grid grid-cols-2 gap-2">
                                                 <Button onClick={handleNewEntry} size="sm" className="h-8 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive shadow-sm transition-all duration-200">
                                                     <Plus className="mr-2 h-4 w-4 text-destructive-foreground" /> Clear (Alt+C)
                                                 </Button>
                                                 <Button type="submit" form="supplier-entry-form" disabled={hookIsSubmitting} size="sm" className="h-8 font-bold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground border border-primary shadow-sm transition-all duration-200">
                                                     {hookIsSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                                     {isEditing ? 'Update (Alt+S)' : 'Save (Alt+S)'}
                                                 </Button>
                                             </div>

                                             <div className="grid grid-cols-2 gap-2">
                                                 <input ref={importInputRef} type="file" className="hidden" onChange={handleImportChange} />
                                                 <Button size="sm" onClick={handleImportClick} className="h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shadow-sm transition-all duration-200">
                                                     <Download className="mr-2 h-4 w-4 text-slate-600" /> Import
                                                 </Button>
                                                 <Button size="sm" onClick={handleExport} className="h-8 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 shadow-sm transition-all duration-200">
                                                     <Upload className="mr-2 h-4 w-4 text-slate-600" /> Export
                                                 </Button>
                                             </div>

                                             <div className="grid grid-cols-2 gap-2">
                                                 <Button size="sm" onClick={handleDeleteCurrent} className="h-8 rounded-md bg-destructive hover:bg-destructive/90 text-destructive-foreground border border-destructive shadow-sm transition-all duration-200">
                                                     <Trash2 className="mr-2 h-4 w-4 text-destructive-foreground" /> Delete
                                                 </Button>
                                                 <Button size="sm" onClick={handlePrintCurrent} className="h-8 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground border border-primary shadow-sm transition-all duration-200">
                                                     <Printer className="mr-2 h-4 w-4 text-primary-foreground" /> Print
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
                                suppliers={Array.isArray(filteredSuppliersByAllFilters) ? filteredSuppliersByAllFilters : []}
                                totalCount={filteredSuppliersByAllFilters.length}
                                varietyOptions={varietyOptions}
                                paymentTypeOptions={paymentTypeOptions}
                                uniqueProfiles={uniqueProfiles}
                                uniqueNames={uniqueNames}
                                uniqueSo={uniqueSo}
                                uniqueAddresses={uniqueAddresses}
                                uniqueContacts={uniqueContacts}
                                highlightEntryId={highlightEntryId ?? undefined}
                                selectedVariety={selectedVariety}
                                onVarietyChange={handleVarietyChange}
                                selectedDateFilter={selectedDateFilter}
                                onDateFilterModeChange={handleDateFilterModeChange}
                                selectedParticularDate={selectedParticularDate}
                                onParticularDateChange={handleParticularDateChange}
                                selectedStartDate={selectedStartDate}
                                onStartDateChange={handleStartDateChange}
                                selectedEndDate={selectedEndDate}
                                onEndDateChange={handleEndDateChange}
                                isImportMode={isImportMode}
                                onMergeSelected={handleMergeSelected}
                                isFilterPending={isFilterPending}
                            />
                        </div>
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
                isImporting={isImporting}
                importProgress={importProgress}
                importStatus={importStatus}
                importCurrent={importCurrent}
                importTotal={importTotal}
                importStartTime={importStartTime}
                onCancelImport={handleCancelImport}
            />

            <FuzzyCorrectionDialog
                isOpen={showFuzzyDialog}
                clusters={fuzzyClusters}
                onResolve={handleResolveFuzzy}
                onCancel={handleCancelFuzzy}
            />

            <ImportConfigDialog
                isOpen={showConfigDialog}
                importedItems={pendingImportData || []}
                onConfirm={handleConfirmConfig}
                onCancel={handleCancelConfig}
            />
        </div>
    );
}

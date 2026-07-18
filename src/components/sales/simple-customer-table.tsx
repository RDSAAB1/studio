"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, Edit2, Trash2, X, Eye, Printer, CheckSquare, Square, User, UserSquare, Home, Truck, PhoneCall, MoreVertical, Calendar, Save } from "lucide-react";
import { toTitleCase, formatCurrency, roundToTwoDecimalPlaces, calculateCustomerEntry } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, OptionItem, RtgsSettings } from "@/lib/definitions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { printHtmlContent } from "@/lib/electron-print";
import { getRtgsSettings, deleteCustomer, updateCustomer, deleteStagedCustomer, updateStagedCustomer } from "@/lib/firestore";
import { SuggestionInput } from "@/components/ui/suggestion-input";
import { cn } from "@/lib/utils";

interface SimpleCustomerTableProps {
    onEditCustomer: (customer: Customer) => void;
    onViewDetails?: (customer: Customer) => void;
    onPrintCustomer?: (customer: Customer) => void;
    onMultiPrint?: (customers: Customer[]) => void;
    onMultiDelete?: (customerIds: string[]) => void;
    customers: Customer[];
    totalCount: number;
    isLoading?: boolean;
    varietyOptions: OptionItem[];
    highlightEntryId?: string;
    
    // Filters props
    selectedVariety: string;
    onVarietyChange: (val: string | null) => void;
    selectedDateFilter: string;
    onDateFilterModeChange: (val: string | null) => void;
    selectedParticularDate: string;
    onParticularDateChange: (val: string) => void;
    selectedStartDate: string;
    onStartDateChange: (val: string) => void;
    selectedEndDate: string;
    onEndDateChange: (val: string) => void;
    isImportMode?: boolean;
    onMergeSelected?: (selectedIds: string[]) => void;

    // Suggestion props
    uniqueProfiles?: Array<{name: string, so: string, address: string, contact: string, id?: string}>;
    uniqueNames?: string[];
    uniqueSo?: string[];
    uniqueAddresses?: string[];
    uniqueContacts?: string[];
}

const SimpleCustomerTableComponent = ({ 
    onEditCustomer, 
    onViewDetails, 
    onPrintCustomer, 
    onMultiPrint, 
    onMultiDelete, 
    customers, 
    totalCount, 
    varietyOptions, 
    highlightEntryId,
    selectedVariety,
    onVarietyChange,
    selectedDateFilter,
    onDateFilterModeChange,
    selectedParticularDate,
    onParticularDateChange,
    selectedStartDate,
    onStartDateChange,
    selectedEndDate,
    onEndDateChange,
    isImportMode = false,
    onMergeSelected,
    uniqueProfiles = [],
    uniqueNames = [],
    uniqueSo = [],
    uniqueAddresses = [],
    uniqueContacts = []
}: SimpleCustomerTableProps) => {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastClickTimeRef = useRef<number>(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
    const [isDetailedMode, setIsDetailedMode] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);

    const [isMultiEditing, setIsMultiEditing] = useState(false);
    const [isMultiSaving, setIsMultiSaving] = useState(false);
    const [multiEditData, setMultiEditData] = useState<Partial<Customer>>({});
    const [multiEditTouched, setMultiEditTouched] = useState<Set<string>>(new Set());

    const markMultiEditTouched = useCallback((field: string) => {
        setMultiEditTouched((prev) => {
            if (prev.has(field)) return prev;
            const next = new Set(prev);
            next.add(field);
            return next;
        });
    }, []);

    const profileSuggestions = React.useMemo(() => {
        return uniqueProfiles.map(p => {
            const fatherPart = p.so ? ` S/o ${p.so}` : '';
            const addrPart = p.address ? ` | ${p.address}` : '';
            return `${p.name}${fatherPart}${addrPart}`;
        });
    }, [uniqueProfiles]);

    const handleNameSelect = useCallback((selectedValue: string) => {
        const matchedProfile = uniqueProfiles.find(p => {
            const fatherPart = p.so ? ` S/o ${p.so}` : '';
            const addrPart = p.address ? ` | ${p.address}` : '';
            const formatted = `${p.name}${fatherPart}${addrPart}`;
            return formatted.toLowerCase().trim() === selectedValue.toLowerCase().trim();
        });

        if (matchedProfile) {
            setMultiEditData(prev => ({
                ...prev,
                name: matchedProfile.name,
                so: matchedProfile.so,
                address: matchedProfile.address,
                contact: matchedProfile.contact
            }));
            markMultiEditTouched('name');
            if (matchedProfile.so) markMultiEditTouched('so');
            if (matchedProfile.address) markMultiEditTouched('address');
            if (matchedProfile.contact) markMultiEditTouched('contact');
        } else {
            const value = toTitleCase(selectedValue);
            setMultiEditData(prev => ({ ...prev, name: value }));
            if (value.trim()) markMultiEditTouched('name');
        }
    }, [uniqueProfiles, markMultiEditTouched]);

    const handleMultiEdit = () => {
        if (selectedCustomers.size === 0) return;
        setIsMultiEditing(true);
        setMultiEditData({});
        toast({
            title: "Multi Edit Mode",
            description: `Edit ${selectedCustomers.size} selected entries`,
        });
    };

    const handleEditSingleInImportMode = useCallback((customer: Customer) => {
        setSelectedCustomers(new Set([customer.id]));
        setIsMultiEditing(true);
        setMultiEditData({
            name: customer.name || '',
            so: customer.so || customer.fatherName || '',
            address: customer.address || '',
            contact: customer.contact || '',
            vehicleNo: customer.vehicleNo || '',
            variety: customer.variety || '',
            kartaPercentage: customer.kartaPercentage,
            cdRate: customer.cdRate,
            cd: customer.cd,
            cdAmount: customer.cdAmount,
            brokerage: customer.brokerage,
            brokerageRate: customer.brokerageRate,
            bags: customer.bags,
            bagRate: customer.bagRate,
            bagWeightKg: customer.bagWeightKg,
            transportationRate: customer.transportationRate,
            baseReport: customer.baseReport,
            collectedReport: customer.collectedReport,
            riceBranGst: customer.riceBranGst,
            kanta: customer.kanta
        });
        setMultiEditTouched(new Set());
        toast({
            title: "Edit Entry",
            description: `Editing: ${customer.name || 'Entry'} — modify any field and click Save All`,
        });
    }, []);

    const handleMultiEditSave = async () => {
        if (selectedCustomers.size === 0) return;
        
        setIsMultiSaving(true);
        try {
            const selectedList = customers.filter(c => selectedCustomers.has(c.id));
            let successCount = 0;
            let errorCount = 0;
            
            for (const customer of selectedList) {
                try {
                    const updateData: Partial<Customer> = {};
                    let nameOrSoOrContactChanged = false;
                    
                    if (multiEditTouched.has('name')) {
                        updateData.name = multiEditData.name?.trim() || '';
                        nameOrSoOrContactChanged = true;
                    }
                    if (multiEditTouched.has('so')) {
                        updateData.so = multiEditData.so?.trim() || '';
                        updateData.fatherName = updateData.so;
                        nameOrSoOrContactChanged = true;
                    }
                    if (multiEditTouched.has('address')) {
                        updateData.address = multiEditData.address?.trim() || '';
                    }
                    if (multiEditTouched.has('contact')) {
                        updateData.contact = multiEditData.contact?.trim() || '';
                        nameOrSoOrContactChanged = true;
                    }
                    if (multiEditTouched.has('vehicleNo')) {
                        updateData.vehicleNo = multiEditData.vehicleNo?.trim() || '';
                    }
                    if (multiEditTouched.has('variety')) {
                        updateData.variety = multiEditData.variety?.trim() || '';
                    }
                    if (multiEditTouched.has('bags') && typeof multiEditData.bags === 'number') {
                        updateData.bags = multiEditData.bags;
                    }
                    if (multiEditTouched.has('bagWeightKg') && typeof multiEditData.bagWeightKg === 'number') {
                        updateData.bagWeightKg = multiEditData.bagWeightKg;
                    }
                    if (multiEditTouched.has('bagRate') && typeof multiEditData.bagRate === 'number') {
                        updateData.bagRate = multiEditData.bagRate;
                    }
                    if (multiEditTouched.has('kartaPercentage') && typeof multiEditData.kartaPercentage === 'number') {
                        updateData.kartaPercentage = multiEditData.kartaPercentage;
                    }
                    if (multiEditTouched.has('cdRate') && typeof multiEditData.cdRate === 'number') {
                        updateData.cdRate = multiEditData.cdRate;
                        updateData.cd = multiEditData.cdRate;
                    }
                    if (multiEditTouched.has('brokerage') && typeof multiEditData.brokerage === 'number') {
                        updateData.brokerage = multiEditData.brokerage;
                        updateData.brokerageRate = multiEditData.brokerage;
                    }
                    if (multiEditTouched.has('transportationRate') && typeof multiEditData.transportationRate === 'number') {
                        updateData.transportationRate = multiEditData.transportationRate;
                    }
                    if (multiEditTouched.has('baseReport') && typeof multiEditData.baseReport === 'number') {
                        updateData.baseReport = multiEditData.baseReport;
                    }
                    if (multiEditTouched.has('collectedReport') && typeof multiEditData.collectedReport === 'number') {
                        updateData.collectedReport = multiEditData.collectedReport;
                    }
                    if (multiEditTouched.has('riceBranGst') && typeof multiEditData.riceBranGst === 'number') {
                        updateData.riceBranGst = multiEditData.riceBranGst;
                    }
                    if (multiEditTouched.has('kanta') && typeof multiEditData.kanta === 'number') {
                        updateData.kanta = multiEditData.kanta;
                    }

                    if (nameOrSoOrContactChanged) {
                        const nextName = updateData.name ?? customer.name ?? '';
                        const nextSo = updateData.so ?? customer.so ?? '';
                        updateData.customerId = `${toTitleCase(nextName).toLowerCase()}|${toTitleCase(nextSo).toLowerCase()}`;
                    }

                    // Recalculate customer entry calculations
                    const calculationInputFields = [
                        'grossWeight', 'teirWeight', 'kartaPercentage', 'rate', 'bags', 'bagWeightKg', 
                        'bagRate', 'brokerage', 'cdRate', 'transportationRate', 'baseReport', 
                        'collectedReport', 'riceBranGst', 'kanta'
                    ];
                    const calculationChanged = calculationInputFields.some(field => multiEditTouched.has(field));
                    if (calculationChanged) {
                        const mergedForCalculation = {
                            ...customer,
                            ...updateData
                        };
                        
                        if (updateData.cdRate !== undefined) {
                            mergedForCalculation.cd = updateData.cdRate;
                        }
                        
                        const calculated = calculateCustomerEntry(mergedForCalculation as any);
                        
                        updateData.weight = calculated.weight;
                        updateData.kartaWeight = calculated.kartaWeight;
                        updateData.kartaAmount = calculated.kartaAmount;
                        updateData.netWeight = calculated.netWeight;
                        updateData.amount = calculated.amount;
                        updateData.bagAmount = calculated.bagAmount;
                        updateData.bagWeightDeductionAmount = (calculated as any).bagWeightDeductionAmount || 0;
                        updateData.brokerageAmount = calculated.brokerageAmount;
                        updateData.cdAmount = calculated.cdAmount;
                        updateData.transportAmount = (calculated as any).transportAmount || 0;
                        updateData.originalNetAmount = calculated.originalNetAmount;
                        updateData.netAmount = calculated.netAmount;
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        if (isImportMode) {
                            const updateResult = await updateStagedCustomer(customer.id, updateData);
                            if (updateResult) {
                                successCount++;
                                try {
                                    await db.stagedCustomers.put({ ...customer, ...updateData });
                                } catch {}
                            } else {
                                errorCount++;
                            }
                        } else {
                            const updateResult = await updateCustomer(customer.id, updateData);
                            if (updateResult) {
                                successCount++;
                                try {
                                    await db.customers.put({ ...customer, ...updateData });
                                } catch {}
                            } else {
                                errorCount++;
                            }
                        }
                    }
                } catch (error) {
                    errorCount++;
                }
            }
            
            if (errorCount > 0) {
                toast({
                    title: "Partial Success",
                    description: `${successCount} entries updated successfully, ${errorCount} failed`,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Success",
                    description: `${successCount} entries updated successfully`,
                });
            }
            
            setIsMultiEditing(false);
            setMultiEditData({});
            setMultiEditTouched(new Set());
            setSelectedCustomers(new Set());
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update entries",
                variant: "destructive",
            });
        } finally {
            setIsMultiSaving(false);
        }
    };

    const handleMultiEditCancel = () => {
        setIsMultiEditing(false);
        setMultiEditData({});
        setMultiEditTouched(new Set());
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const fetchedSettings = await getRtgsSettings();
                setSettings(fetchedSettings);
            } catch (err) {
                console.error("Failed to fetch settings:", err);
            }
        };
        fetchSettings();
    }, []);

    const displayRows = useMemo(() => {
        if (isDetailedMode) return customers;
        
        const grouped: { [key: string]: any } = {};
        customers.forEach(c => {
            const dateKey = format(new Date(c.date), "yyyy-MM-dd");
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    id: dateKey,
                    date: c.date,
                    srNo: 'Σ',
                    term: '-',
                    name: ``,
                    so: '-',
                    vehicleNo: '-',
                    address: '-',
                    contact: '-',
                    paymentType: '-',
                    variety: '-',
                    bags: 0,
                    grossWeight: 0,
                    teirWeight: 0,
                    weight: 0,
                    kartaWeight: 0,
                    netWeight: 0,
                    rate: 0,
                    amount: 0,
                    kartaAmount: 0,
                    bagWeightDeductionAmount: 0,
                    brokerageRate: 0,
                    cdRate: 0,
                    cdAmount: 0,
                    bagAmount: 0,
                    transportAmount: 0,
                    kanta: 0,
                    advanceFreight: 0,
                    netAmount: 0,
                    count: 0,
                    isGrouped: true
                };
            }
            grouped[dateKey].bags += (Number(c.bags) || 0);
            grouped[dateKey].grossWeight += (Number(c.grossWeight) || 0);
            grouped[dateKey].teirWeight += (Number(c.teirWeight) || 0);
            grouped[dateKey].weight += (Number(c.weight) || 0);
            grouped[dateKey].kartaWeight += (Number(c.kartaWeight) || 0);
            grouped[dateKey].netWeight += (Number(c.netWeight) || 0);
            grouped[dateKey].amount += (Number(c.amount) || 0);
            grouped[dateKey].kartaAmount += (Number(c.kartaAmount) || 0);
            grouped[dateKey].bagWeightDeductionAmount += (Number((c as any).bagWeightDeductionAmount) || 0);
            grouped[dateKey].cdAmount += (Number(c.cdAmount) || 0);
            grouped[dateKey].bagAmount += (Number(c.bagAmount) || 0);
            grouped[dateKey].transportAmount += (Number((c as any).transportAmount) || 0);
            grouped[dateKey].kanta += (Number(c.kanta) || 0);
            grouped[dateKey].advanceFreight += (Number(c.advanceFreight) || 0);
            grouped[dateKey].netAmount += (Number(c.netAmount) || 0);
            grouped[dateKey].count += 1;
        });
        
        return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((row: any) => {
            if (row.weight > 0) {
                row.rate = row.amount / row.weight;
            }
            row.name = `${row.count} Entries`;
            return row;
        });
    }, [customers, isDetailedMode]);
    
    const { visibleItems, hasMore, scrollRef } = useInfiniteScroll(displayRows, {
        totalItems: displayRows.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: displayRows.length > 30,
    });

    const displayCustomers = displayRows.slice(0, visibleItems);
    
    const handleSelectCustomer = (customerId: string) => {
        setSelectedCustomers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(customerId)) {
                newSet.delete(customerId);
            } else {
                newSet.add(customerId);
            }
            return newSet;
        });
    };

    const handleSelectGroup = (dateStr: string) => {
        const groupCustomers = customers.filter(c => format(new Date(c.date), "yyyy-MM-dd") === dateStr);
        const groupIds = groupCustomers.map(c => c.id);
        const allSelected = groupIds.every(id => selectedCustomers.has(id));

        setSelectedCustomers(prev => {
            const newSet = new Set(prev);
            groupIds.forEach(id => {
                if (allSelected) {
                    newSet.delete(id);
                } else {
                    newSet.add(id);
                }
            });
            return newSet;
        });
    };

    const isGroupSelected = (dateStr: string) => {
        const groupCustomers = customers.filter(c => format(new Date(c.date), "yyyy-MM-dd") === dateStr);
        if (groupCustomers.length === 0) return false;
        return groupCustomers.every(c => selectedCustomers.has(c.id));
    };

    const handleSelectAll = () => {
        if (selectedCustomers.size === customers.length) {
            setSelectedCustomers(new Set());
        } else {
            setSelectedCustomers(new Set(customers.map(c => c.id)));
        }
    };

    const handleMultiPrint = () => {
        if (selectedCustomers.size === 0) return;
        const selectedList = customers.filter(c => selectedCustomers.has(c.id));
        if (onMultiPrint) {
            onMultiPrint(selectedList);
        }
    };

    const handleMultiDelete = async () => {
        if (selectedCustomers.size === 0) return;
        try {
            setIsDeleting(true);
            const selectedList = customers.filter(c => selectedCustomers.has(c.id));
            const ids = selectedList.map(c => c.id);
            if (onMultiDelete) {
                await onMultiDelete(ids);
            }
            setSelectedCustomers(new Set());
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete entries",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const escapeHtml = (value?: string | null) => {
        if (!value) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };
    const handlePrintReport = async () => {
        if (!settings) {
            toast({ variant: 'destructive', title: 'Error', description: 'Settings not loaded.' });
            return;
        }

        // In detailed mode → print individual customer rows (filtered by selection)
        // In non-detailed (combined) mode → print grouped/aggregated rows from displayRows
        let rowsToPrint: any[];
        if (isDetailedMode) {
            const individualList = selectedCustomers.size > 0
                ? customers.filter(c => selectedCustomers.has(c.id))
                : customers;
            rowsToPrint = individualList;
        } else {
            // Combined/overall: use the already-grouped displayRows
            if (selectedCustomers.size > 0) {
                const selectedDates = new Set(
                    customers.filter(c => selectedCustomers.has(c.id))
                        .map(c => format(new Date(c.date), 'yyyy-MM-dd'))
                );
                rowsToPrint = (displayRows as any[]).filter((r: any) => selectedDates.has(r.id));
            } else {
                rowsToPrint = displayRows as any[];
            }
        }

        if (!rowsToPrint.length) {
            toast({ variant: 'destructive', title: 'Error', description: 'No data to print.' });
            return;
        }

        const companyName = settings?.companyName || 'Company Name';

        // Calculate totals dynamically for the printed dataset
        const printTotals = rowsToPrint.reduce((acc, c) => {
            const baseAmt = Number(c.amount || 0);
            const kartaAmt = Number(c.kartaAmount || 0);
            const bagDedAmt = Number((c as any).bagWeightDeductionAmount || 0);
            const finalAmt = baseAmt - kartaAmt - bagDedAmt;
            const cdAmt = baseAmt * ((Number(c.cdRate || c.cd || 0)) / 100);
            const brkAmt = (Number(c.weight || 0)) * (Number(c.brokerageRate || c.brokerage || 0));
            const bagAmt = Number(c.bagAmount || 0);
            const transAmt = Number((c as any).transportAmount || 0);
            const kantaAmt = Number(c.kanta || 0);
            const totalRec = finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + Number(c.advanceFreight || 0);

            acc.bags += Number(c.bags || 0);
            acc.grossWt += Number(c.grossWeight || 0);
            acc.teirWt += Number(c.teirWeight || 0);
            acc.weight += Number(c.weight || 0);
            acc.kartaWt += Number(c.kartaWeight || 0);
            acc.netWt += Number(c.netWeight || 0);
            acc.baseAmt += baseAmt;
            acc.dedAmt += (bagDedAmt + kartaAmt);
            acc.finalAmt += finalAmt;
            acc.totalRec += totalRec;
            acc.rateSum += Number(c.rate || 0);
            return acc;
        }, {
            bags: 0, grossWt: 0, teirWt: 0, weight: 0, kartaWt: 0, netWt: 0,
            baseAmt: 0, dedAmt: 0, finalAmt: 0, totalRec: 0, rateSum: 0
        });

        const rateAvg = rowsToPrint.length > 0 ? printTotals.rateSum / rowsToPrint.length : 0;

        // In combined mode, header columns are simpler (no Gr/Tr, no Fn/Kt columns shown for grouped)
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Customer Report</title>
                <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'IBM Plex Sans', sans-serif !important; margin: 0; padding: 15px; color: #334155; line-height: 1.2; letter-spacing: -0.01em; font-weight: 400; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2px solid #475569; padding-bottom: 8px; }
                    .header-left { text-align: left; }
                    .header-left h1 { margin: 0; font-size: 24px; color: #1e293b; letter-spacing: -0.02em; font-weight: 700; line-height: 1; }
                    .header-left p { margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; }
                    
                    .main-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 0.5px solid #94a3b8; table-layout: fixed; line-height: 1.1; }
                    .main-table th, .main-table td { border: 0.5px solid #cbd5e1; padding: 3px 2px; text-align: right; overflow: hidden; white-space: nowrap; }
                    .main-table th { background: #f1f5f9; color: #1e293b; text-align: center; font-weight: 600; font-size: 9.5px; border: 0.5px solid #94a3b8; vertical-align: middle; }
                    .main-table td { background: #fff; color: #334155; font-weight: 400; }
                    .main-table td:nth-child(3) { text-align: left !important; white-space: normal; }
                    .main-table td:nth-child(1), .main-table td:nth-child(2) { text-align: center; }
                    
                    .cell-stack { display: flex; flex-direction: column; gap: 0px; }
                    .primary-val { font-weight: 400; color: #0f172a; }
                    .secondary-val { font-size: 8px; color: #64748b; font-weight: 400; }
                    .text-financial { color: #166534; font-weight: 600; }
                    .text-supp { color: #1e3a8a; font-weight: 400; font-size: 10.5px; }
                    .bg-total { background: #f1f5f9 !important; color: #1e293b !important; font-weight: 600 !important; }
                    .bg-total td { background: #f1f5f9 !important; border-top: 1.5px solid #475569 !important; }
                    
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                        @page { size: landscape; margin: 0.5cm; margin-top: 2.0cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        <h1>${escapeHtml(companyName)}</h1>
                        <p>Customer Report${isDetailedMode ? '' : ' (Combined / Date-wise)'}</p>
                    </div>
                </div>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th style="width: 4%">SR</th>
                            <th style="width: 7%">Date</th>
                            <th style="width: ${isDetailedMode ? '15%' : '20%'}">${isDetailedMode ? 'Customer / Company' : 'Entries'}</th>
                            ${isDetailedMode ? `
                            <th style="width: 8%">Gr/Tr</th>
                            <th style="width: 8%">Fn/Kt</th>
                            ` : ''}
                            <th style="width: 8%">NetWt/Rt</th>
                            <th style="width: 6%">Bags</th>
                            <th style="width: 8%">Base Amt</th>
                            <th style="width: 8%">Ded</th>
                            <th style="width: 8%">Final Amt</th>
                            <th style="width: 8%">Total Rec.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsToPrint.map((c, idx) => {
                            const baseAmt = Number(c.amount || 0);
                            const kartaAmt = Number(c.kartaAmount || 0);
                            const bagDedAmt = Number((c as any).bagWeightDeductionAmount || 0);
                            const finalAmt = baseAmt - kartaAmt - bagDedAmt;
                            const cdAmt = baseAmt * ((Number(c.cdRate || c.cd || 0)) / 100);
                            const brkAmt = (Number(c.weight || 0)) * (Number(c.brokerageRate || c.brokerage || 0));
                            const bagAmt = Number(c.bagAmount || 0);
                            const transAmt = Number((c as any).transportAmount || 0);
                            const kantaAmt = Number(c.kanta || 0);
                            const totalRec = finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + Number(c.advanceFreight || 0);

                            return `
                                <tr>
                                    <td>${c.isGrouped ? 'Σ' : (c.srNo || (idx + 1))}</td>
                                    <td>${format(new Date(c.date), "dd-MMM")}</td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="text-supp">${escapeHtml(c.isGrouped ? c.name : toTitleCase(c.name || ''))}</span>
                                            <span class="secondary-val">${escapeHtml(c.isGrouped ? '' : (c.companyName || ''))}</span>
                                        </div>
                                    </td>
                                    ${isDetailedMode ? `
                                    <td>
                                        <div class="cell-stack">
                                            <span>${Number(c.grossWeight || 0).toFixed(1)}</span>
                                            <span class="secondary-val">${Number(c.teirWeight || 0).toFixed(1)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span>${Number(c.weight || 0).toFixed(2)}</span>
                                            <span class="secondary-val">Kt: ${Number(c.kartaWeight || 0).toFixed(2)}</span>
                                        </div>
                                    </td>
                                    ` : ''}
                                    <td>
                                        <div class="cell-stack">
                                            <span>${Number(c.netWeight || 0).toFixed(2)}</span>
                                            <span class="secondary-val">@ ${Number(c.rate || 0)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span>${c.bags || 0}</span>
                                        </div>
                                    </td>
                                    <td>₹${Math.round(baseAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(bagDedAmt + kartaAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(finalAmt).toLocaleString('en-IN')}</td>
                                    <td class="text-financial">₹${Math.round(totalRec).toLocaleString('en-IN')}</td>
                                </tr>
                            `;
                        }).join('')}
                        <tr class="bg-total">
                            <td colspan="${isDetailedMode ? '3' : '3'}" style="text-align:center; font-size: 11px;">TOTALS (${rowsToPrint.length} ${isDetailedMode ? 'Entries' : 'Days'})</td>
                            ${isDetailedMode ? `
                            <td>
                                <div class="cell-stack">
                                    <span>G: ${printTotals.grossWt.toFixed(1)}</span>
                                    <span class="secondary-val">T: ${printTotals.teirWt.toFixed(1)}</span>
                                </div>
                            </td>
                            <td>
                                <div class="cell-stack">
                                    <span>F: ${printTotals.weight.toFixed(2)}</span>
                                    <span class="secondary-val">K: ${printTotals.kartaWt.toFixed(2)}</span>
                                </div>
                            </td>
                            ` : ''}
                            <td>
                                <div class="cell-stack">
                                    <span>N: ${printTotals.netWt.toFixed(2)}</span>
                                    <span class="secondary-val">Avg: @ ${Math.round(rateAvg)}</span>
                                </div>
                            </td>
                            <td>
                                <div class="cell-stack">
                                    <span>${printTotals.bags}</span>
                                </div>
                            </td>
                            <td>₹${Math.round(printTotals.baseAmt).toLocaleString('en-IN')}</td>
                            <td>₹${Math.round(printTotals.dedAmt).toLocaleString('en-IN')}</td>
                            <td>₹${Math.round(printTotals.finalAmt).toLocaleString('en-IN')}</td>
                            <td class="text-financial">₹${Math.round(printTotals.totalRec).toLocaleString('en-IN')}</td>
                        </tr>
                    </tbody>
                </table>
            </body>
            </html>
        `;

        await printHtmlContent(printContent);
    };

    const totals = useMemo(() => {
        const list = selectedCustomers.size > 0 
            ? customers.filter(c => selectedCustomers.has(c.id))
            : (customers || []);
        const initialTotals = {
            bags: 0,
            grossWt: 0,
            teirWt: 0,
            finalWt: 0,
            kartaWt: 0,
            totalBagWt: 0,
            netWt: 0,
            rate: 0,
            baseAmt: 0,
            kartaAmt: 0,
            bagDedAmt: 0,
            finalAmt: 0,
            brkAmt: 0,
            cdAmt: 0,
            transAmt: 0,
            totalRec: 0,
            avgBagWt: 0,
            count: list.length,
            minRate: 0,
            maxRate: 0,
            rateAvg: 0,
            avgBagWtAvg: 0
        };

        if (list.length === 0) return initialTotals;

        const computed = list.reduce((acc, curr) => {
            const baseAmt = Number(curr.amount || 0);
            const kAmt = Number(curr.kartaAmount || 0);
            const bDeduction = Number((curr as any).bagWeightDeductionAmount || 0);
            const finalAmt = baseAmt - kAmt - bDeduction;
            
            const cdAmt = baseAmt * ((Number(curr.cdRate || curr.cd || 0)) / 100);
            const brkAmt = (Number(curr.weight || 0)) * (Number(curr.brokerageRate || curr.brokerage || 0));
            const transAmt = Number((curr as any).transportAmount || 0);
            const kantaAmt = Number(curr.kanta || 0);
            const bagAmt = Number(curr.bagAmount || 0);
            const advFreight = Number(curr.advanceFreight || 0);
            
            const totalRec = finalAmt - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + advFreight;

            const totalBagWtQtl = (Number(curr.bags || 0) * Number(curr.bagWeightKg || 0)) / 100;
            const avgBagWtKg = Number(curr.bags || 0) > 0 ? (Number(curr.netWeight || 0) * 100) / Number(curr.bags) : 0;

            acc.bags += Number(curr.bags || 0);
            acc.grossWt += Number(curr.grossWeight || 0);
            acc.teirWt += Number(curr.teirWeight || 0);
            acc.finalWt += Number(curr.weight || 0);
            acc.kartaWt += Number(curr.kartaWeight || 0);
            acc.totalBagWt += totalBagWtQtl;
            acc.netWt += Number(curr.netWeight || 0);
            acc.rate += Number(curr.rate || 0);
            acc.baseAmt += baseAmt;
            acc.kartaAmt += kAmt;
            acc.bagDedAmt += bDeduction;
            acc.finalAmt += finalAmt;
            acc.brkAmt += brkAmt;
            acc.cdAmt += cdAmt;
            acc.transAmt += transAmt;
            acc.totalRec += totalRec;
            acc.avgBagWt += avgBagWtKg;
            return acc;
        }, initialTotals);

        const validRates = list.map(c => c.rate).filter(rate => rate > 0);
        computed.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        computed.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;

        if (list.length > 0) {
            computed.rateAvg = computed.rate / list.length;
            computed.avgBagWtAvg = computed.avgBagWt / list.length;
        }

        return computed;
    }, [customers, selectedCustomers]);

    const hasData = customers && customers.length > 0;

    return (
        <div className="space-y-4">
            {/* Multi-select Controls & Actions - Solid colors, clean borders, and rounded-md corners */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white border border-slate-300 rounded-md shadow-sm">
                {/* Left Actions (when selected) */}
                <div className="flex flex-wrap items-center gap-2">
                    {selectedCustomers.size > 0 ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-violet-750 bg-violet-50 px-2.5 py-1 rounded-md border border-violet-250">
                                {selectedCustomers.size} Selected
                            </span>
                            <Button
                                size="sm"
                                onClick={handleMultiEdit}
                                className="h-8 px-3 text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 font-semibold shadow-sm rounded-md transition-all duration-200"
                            >
                                <Edit2 className="h-4 w-4 mr-1.5" />
                                Edit
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleMultiPrint}
                                className="h-8 px-3 text-primary-foreground bg-primary hover:bg-primary/90 border border-primary/95 font-semibold shadow-sm rounded-md transition-all duration-200"
                            >
                                <Printer className="h-4 w-4 mr-1.5 text-primary-foreground" />
                                Print Format
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleMultiDelete}
                                disabled={isDeleting}
                                className="h-8 px-3 text-white bg-rose-600 hover:bg-rose-700 border border-rose-700 font-semibold shadow-sm rounded-md transition-all duration-200"
                            >
                                {isDeleting ? (
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                )}
                                Delete
                            </Button>
                            {isImportMode && onMergeSelected && (
                                <Button
                                    size="sm"
                                    onClick={async () => {
                                        if (selectedCustomers.size > 0) {
                                            await onMergeSelected(Array.from(selectedCustomers));
                                            setSelectedCustomers(new Set());
                                        }
                                    }}
                                    className="h-8 px-3 text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 font-semibold shadow-sm rounded-md transition-all duration-200 animate-in fade-in zoom-in duration-200"
                                >
                                    Merge to Main Database
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="text-[11px] text-slate-450 font-medium tracking-tight pl-1">
                            No entries selected. Use row checkboxes to perform actions.
                        </div>
                    )}
                </div>
                
                {/* Right side aligned Date & Variety filters + mode controls */}
                <div className="flex flex-wrap items-center gap-2.5 ml-auto">
                    {/* Variety Filter Dropdown */}
                    <div className="w-[130px] shrink-0">
                        <CustomDropdown
                            options={[
                                { value: 'ALL', label: 'ALL VARIETIES' },
                                ...varietyOptions.map((v) => ({
                                    value: v.name,
                                    label: String(v.name).toUpperCase()
                                }))
                            ]}
                            value={selectedVariety}
                            onChange={onVarietyChange}
                            placeholder="Variety"
                            showClearButton={false}
                            maxRows={5}
                            showScrollbar={true}
                            inputClassName="h-8 text-xs bg-white border-slate-300 rounded-md hover:border-slate-450 focus:border-indigo-500"
                        />
                    </div>

                    {/* Date Filter Selection Row */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-[120px] shrink-0">
                            <CustomDropdown
                                options={[
                                    { value: 'ALL', label: 'ALL DATES' },
                                    { value: 'TODAY', label: 'TODAY' },
                                    { value: 'PARTICULAR', label: 'PARTICULAR' },
                                    { value: 'RANGE', label: 'DATE RANGE' }
                                ]}
                                value={selectedDateFilter}
                                onChange={onDateFilterModeChange}
                                placeholder="Filter Date"
                                showClearButton={false}
                                maxRows={5}
                                showScrollbar={true}
                                inputClassName="h-8 text-xs bg-white border-slate-300 rounded-md hover:border-slate-450 focus:border-indigo-500"
                            />
                        </div>
                        
                        {selectedDateFilter === "PARTICULAR" && (
                            <div className="w-[125px] shrink-0">
                                <SmartDatePicker
                                    value={selectedParticularDate}
                                    onChange={(val) => onParticularDateChange(typeof val === 'string' ? val : format(val, "yyyy-MM-dd"))}
                                    placeholder="Pick date"
                                    inputClassName="h-8 text-xs bg-white border-slate-300 rounded-md"
                                    buttonClassName="h-8 w-8 px-2"
                                />
                            </div>
                        )}
                        
                        {selectedDateFilter === "RANGE" && (
                            <div className="flex gap-1 items-center">
                                <SmartDatePicker
                                    value={selectedStartDate}
                                    onChange={(val) => onStartDateChange(typeof val === 'string' ? val : format(val, "yyyy-MM-dd"))}
                                    placeholder="Start date"
                                    inputClassName="h-8 text-xs bg-white border-slate-300 rounded-md"
                                    buttonClassName="h-8 w-8 px-2"
                                />
                                <span className="text-[10px] text-muted-foreground">to</span>
                                <SmartDatePicker
                                    value={selectedEndDate}
                                    onChange={(val) => onEndDateChange(typeof val === 'string' ? val : format(val, "yyyy-MM-dd"))}
                                    placeholder="End date"
                                    inputClassName="h-8 text-xs bg-white border-slate-300 rounded-md"
                                    buttonClassName="h-8 w-8 px-2"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 px-3 h-8 bg-white border border-slate-300 hover:bg-slate-50 transition-all duration-200 rounded-md shadow-sm">
                        <Switch id="table-detailed-mode" checked={isDetailedMode} onCheckedChange={setIsDetailedMode} className="scale-75" />
                        <Label htmlFor="table-detailed-mode" className="text-[10px] font-bold uppercase cursor-pointer text-slate-650 tracking-wider">Detailed</Label>
                    </div>
                    
                    <Button onClick={handlePrintReport} size="sm" className="h-8 text-[11px] font-bold uppercase tracking-tight px-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 rounded-md border border-primary/95">
                        <Printer className="mr-1.5 h-3.5 w-3.5 text-primary-foreground" /> Print Report
                    </Button>
                </div>
            </div>

            {/* Multi-Edit Form */}
            {isMultiEditing && selectedCustomers.size > 0 && (
                <Card className="border border-slate-300 bg-white shadow-sm rounded-md overflow-hidden">
                    <CardHeader className="p-3 pb-2 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">
                                Multi-Edit Mode ({selectedCustomers.size} entries selected)
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleMultiEditSave}
                                    className="h-8 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 shadow-sm transition-all duration-200"
                                    disabled={isMultiSaving}
                                >
                                    {isMultiSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-1" />
                                            Save All
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleMultiEditCancel}
                                    className="h-8 rounded-md bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-sm transition-all duration-200"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <SuggestionInput
                                            suggestions={profileSuggestions}
                                            onSuggestionSelect={handleNameSelect}
                                            value={multiEditData.name || ''}
                                            onChange={(e) => {
                                                const value = toTitleCase(e.target.value);
                                                setMultiEditData(prev => ({ ...prev, name: value }));
                                                if (value.trim()) markMultiEditTouched('name');
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('name');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter name"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Father Name</label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <UserSquare className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <SuggestionInput
                                            suggestions={uniqueSo}
                                            value={multiEditData.so || ''}
                                            onChange={(e) => {
                                                const value = toTitleCase(e.target.value);
                                                setMultiEditData(prev => ({ ...prev, so: value }));
                                                if (value.trim()) markMultiEditTouched('so');
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('so');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter father name"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Address</label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Home className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <SuggestionInput
                                            suggestions={uniqueAddresses}
                                            value={multiEditData.address || ''}
                                            onChange={(e) => {
                                                const value = toTitleCase(e.target.value);
                                                setMultiEditData(prev => ({ ...prev, address: value }));
                                                if (value.trim()) markMultiEditTouched('address');
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('address');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter address"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Contact No</label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <PhoneCall className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <Input
                                            value={multiEditData.contact || ''}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                                                setMultiEditData(prev => ({ ...prev, contact: value }));
                                                if (value.trim()) markMultiEditTouched('contact');
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('contact');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter contact"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Variety</label>
                                    <CustomDropdown
                                        options={varietyOptions.map((option) => ({ value: option.name, label: option.name }))}
                                        value={multiEditData.variety || null}
                                        onChange={(value) => {
                                            setMultiEditData(prev => ({ ...prev, variety: value || '' }));
                                            if (value) {
                                                markMultiEditTouched('variety');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('variety');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        placeholder="Select variety"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Karta %</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.kartaPercentage !== undefined ? String(multiEditData.kartaPercentage) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, kartaPercentage: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('kartaPercentage');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('kartaPercentage');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">CD %</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.cdRate !== undefined ? String(multiEditData.cdRate) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, cdRate: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('cdRate');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('cdRate');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Brokerage (Rate)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.brokerage !== undefined ? String(multiEditData.brokerage) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, brokerage: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('brokerage');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('brokerage');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Bags</label>
                                    <Input
                                        type="number"
                                        value={multiEditData.bags !== undefined ? String(multiEditData.bags) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, bags: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('bags');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('bags');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Bag Weight (KG)</label>
                                    <Input
                                        type="number"
                                        step="0.001"
                                        value={multiEditData.bagWeightKg !== undefined ? String(multiEditData.bagWeightKg) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, bagWeightKg: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('bagWeightKg');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('bagWeightKg');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Transport Rate</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.transportationRate !== undefined ? String(multiEditData.transportationRate) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, transportationRate: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('transportationRate');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('transportationRate');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Base Report</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.baseReport !== undefined ? String(multiEditData.baseReport) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, baseReport: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('baseReport');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('baseReport');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Collected Report</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={multiEditData.collectedReport !== undefined ? String(multiEditData.collectedReport) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, collectedReport: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('collectedReport');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('collectedReport');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Rice Bran GST %</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={multiEditData.riceBranGst !== undefined ? String(multiEditData.riceBranGst) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, riceBranGst: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('riceBranGst');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('riceBranGst');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Kanta</label>
                                    <Input
                                        type="number"
                                        step="1"
                                        value={multiEditData.kanta !== undefined ? String(multiEditData.kanta) : ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setMultiEditData(prev => ({ ...prev, kanta: value ? Number(value) : undefined }));
                                            if (value) {
                                                markMultiEditTouched('kanta');
                                            } else {
                                                setMultiEditTouched(prev => {
                                                    const newSet = new Set(prev);
                                                    newSet.delete('kanta');
                                                    return newSet;
                                                });
                                            }
                                        }}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table */}
            <Card className="border border-slate-300 bg-white shadow-[0_15px_35px_-5px_rgba(0,0,0,0.1),_0_5px_15px_-3px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden transition-all duration-300 relative after:absolute after:inset-0 after:rounded-xl after:border after:border-white/40 after:pointer-events-none">
                <CardContent className="p-0">
                    <ScrollArea ref={scrollRef} className="h-[40vh]">
                        <div className="overflow-x-auto relative">
                            <table ref={tableRef} className="w-full text-[11px] border-collapse border-0 border-spacing-0 m-0 p-0 shadow-inner">
                            <thead className="sticky top-0 z-20 bg-slate-200 m-0 p-0">
                                {/* Sticky Total Row at Top, above column headers */}
                                {hasData && totals && (
                                    <tr className="bg-gradient-to-b from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 border-b border-slate-350 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),_0_2px_4px_rgba(0,0,0,0.04)] font-bold text-slate-800 h-[34px] transition-all">
                                        <td className="p-1.5 bg-slate-50/95 sticky left-0 z-30 border-r border-slate-300 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="h-6 w-6 p-0 hover:bg-slate-300"
                                            >
                                                {selectedCustomers.size === customers.length && customers.length > 0 ? (
                                                    <CheckSquare className="h-3.5 w-3.5 text-slate-700" />
                                                ) : (
                                                    <Square className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </td>
                                        <td className="p-1.5 text-center font-bold text-slate-800 uppercase sticky left-[35px] bg-slate-50/95 z-30 border-r border-slate-300">
                                            TOTAL
                                        </td>
                                        <td className="p-1.5 text-left text-slate-700 text-[10.5px] border-r border-slate-300 font-bold">
                                            Summary ({customers.length} Entries)
                                        </td>
                                        {isDetailedMode && (
                                            <>
                                                <td className="p-1.5 text-center text-[11px] font-bold text-slate-800 border-r border-slate-300 leading-none">
                                                    <div>Min-Max Rate:</div>
                                                    <div className="text-rose-600 font-bold">₹{Math.round(totals.minRate).toLocaleString('en-IN')}-₹{Math.round(totals.maxRate).toLocaleString('en-IN')}</div>
                                                </td>
                                                <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">G:{totals.grossWt.toFixed(1)} / T:{totals.teirWt.toFixed(1)}</td>
                                                <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">F:{totals.finalWt.toFixed(2)} / K:{totals.kartaWt.toFixed(2)}</td>
                                            </>
                                        )}
                                        <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">N:{totals.netWt.toFixed(2)} / Avg: @{Math.round(totals.rateAvg).toLocaleString('en-IN')}</td>
                                        <td className="p-1.5 text-center text-slate-800 font-bold border-r border-slate-300">{totals.bags} Bags / Avg: {totals.avgBagWtAvg?.toFixed(2)}kg</td>
                                        <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">₹{totals.baseAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">B:-{totals.bagDedAmt.toFixed(0)} / K:-{totals.kartaAmt.toFixed(0)}</td>
                                        <td className="p-1.5 text-right text-blue-700 font-bold border-r border-slate-300">₹{totals.finalAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">B:-{totals.brkAmt.toFixed(0)} / C:-{totals.cdAmt.toFixed(0)}</td>
                                        <td className="p-1.5 text-right text-slate-600 font-semibold border-r border-slate-300">+{totals.transAmt.toFixed(0)}</td>
                                        <td className="p-1.5 text-[12px] font-bold text-right text-emerald-600 border-r border-slate-300">
                                            ₹{totals.totalRec.toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 bg-slate-50/95 sticky right-0 z-30" />
                                    </tr>
                                )}
                                <tr className="text-slate-700 bg-gradient-to-b from-slate-100 to-slate-250 font-bold shadow-[0_2px_5px_rgba(0,0,0,0.05)] border-b border-slate-300">
                                    <th className="p-1.5 w-[3%] sticky left-0 bg-gradient-to-b from-slate-200 to-slate-300 z-20 border-b border-r border-slate-300 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                                        {/* Blank cell since select all checkbox moved to totals row */}
                                    </th>
                                    <th className="p-1.5 text-center border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-300 sticky left-[35px] z-20 w-[4%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">SR</th>
                                    <th className="p-1.5 text-center border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[7%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Date</th>
                                    {isDetailedMode && (
                                        <>
                                            <th className="p-1.5 text-left border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[14%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Name / Company</th>
                                            <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Gross / Teir</th>
                                            <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Final / Karta / Bag</th>
                                        </>
                                    )}
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Net Wt / Rate</th>
                                    <th className="p-1.5 text-center border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Bags / Avg</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[8%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Base Amount</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Bag Ded / Karta</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[8%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Final Amt</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Brk / CD Amt</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[8%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Transport</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 text-slate-800 font-bold w-[10%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Total Rec.</th>
                                    <th className="p-1.5 text-center border-b border-slate-300 bg-gradient-to-b from-slate-200 to-slate-300 sticky right-0 z-20 w-[4%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hasData ? displayCustomers.map((customer, index) => {
                                    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('[role="menuitem"]') || (e.target as HTMLElement).closest('[role="menu"]')) {
                                            return;
                                        }
                                        const currentTime = Date.now();
                                        const timeSinceLastClick = currentTime - lastClickTimeRef.current;
                                        if (clickTimeoutRef.current) {
                                            clearTimeout(clickTimeoutRef.current);
                                            clickTimeoutRef.current = null;
                                        }
                                        if (timeSinceLastClick < 300) {
                                            lastClickTimeRef.current = 0;
                                            return;
                                        }
                                        lastClickTimeRef.current = currentTime;
                                        clickTimeoutRef.current = setTimeout(() => {
                                            if (onViewDetails) {
                                                onViewDetails(customer);
                                            }
                                            clickTimeoutRef.current = null;
                                        }, 300);
                                    };
                                    const handleRowDoubleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('[role="menuitem"]') || (e.target as HTMLElement).closest('[role="menu"]')) {
                                            return;
                                        }
                                        if (clickTimeoutRef.current) {
                                            clearTimeout(clickTimeoutRef.current);
                                            clickTimeoutRef.current = null;
                                        }
                                        lastClickTimeRef.current = 0;
                                        if (isImportMode) {
                                            handleEditSingleInImportMode(customer);
                                        } else if (onEditCustomer) {
                                            onEditCustomer(customer);
                                        }
                                    };

                                    if (customer.isGrouped) {
                                        return (
                                            <tr 
                                                key={customer.id || index} 
                                                className="border-b border-slate-300 bg-slate-50/50 hover:bg-slate-100 h-[29px] font-medium"
                                                onClick={handleRowClick}
                                            >
                                                <td className="p-1.5 w-8 align-middle sticky left-0 bg-inherit z-10 border-r border-slate-300">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleSelectGroup(customer.id)}
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        {isGroupSelected(customer.id) ? (
                                                            <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                                        ) : (
                                                            <Square className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </td>
                                                <td className="p-1.5 align-middle sticky left-[35px] bg-inherit z-10 font-bold font-mono text-blue-700 border-r border-slate-300">
                                                    Σ
                                                </td>
                                                <td className="p-1.5 text-center align-middle border-r border-slate-300">
                                                    {format(new Date(customer.date), 'dd-MMM')}
                                                </td>
                                                <td className="p-1.5 text-right font-mono text-slate-900 font-bold border-r border-slate-300">G:{customer.grossWeight.toFixed(1)} / T:{customer.teirWeight.toFixed(1)}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 border-r border-slate-300">F:{customer.weight.toFixed(2)} / K:{customer.kartaWeight.toFixed(2)}</td>
                                                <td className="p-1.5 text-right font-mono text-blue-600 font-bold border-r border-slate-300">N:{customer.netWeight.toFixed(2)}</td>
                                                <td className="p-1.5 text-center font-mono text-slate-500 border-r border-slate-300">{customer.bags} Bags</td>
                                                <td className="p-1.5 text-right font-mono text-slate-900 font-semibold border-r border-slate-300">₹{Math.round(customer.amount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 font-semibold border-r border-slate-300">₹{Math.round(customer.bagWeightDeductionAmount + customer.kartaAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-blue-700 font-bold border-r border-slate-300">₹{Math.round(customer.amount - customer.kartaAmount - customer.bagWeightDeductionAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-emerald-600 font-bold border-r border-slate-300">₹{Math.round(customer.netAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 sticky right-0 bg-inherit z-10 border-l border-slate-300" />
                                            </tr>
                                        );
                                    }

                                    const baseAmt = Number(customer.amount || 0);
                                    const kartaAmt = Number(customer.kartaAmount || 0);
                                    const bagDedAmt = Number((customer as any).bagWeightDeductionAmount || 0);
                                    const calculatedFinalAmount = Math.round(baseAmt - kartaAmt - bagDedAmt);
                                    
                                    const cdAmt = baseAmt * ((Number(customer.cdRate || customer.cd || 0)) / 100);
                                    const brkAmt = (Number(customer.weight || 0)) * (Number(customer.brokerageRate || customer.brokerage || 0));
                                    const bagAmt = Number(customer.bagAmount || 0);
                                    const transAmt = Number((customer as any).transportAmount || 0);
                                    const kantaAmt = Number(customer.kanta || 0);
                                    
                                    const totalRec = Math.round(calculatedFinalAmount - cdAmt - brkAmt + bagAmt + transAmt + kantaAmt + Number(customer.advanceFreight || 0));
                                    const totalBagWtQtl = (Number(customer.bags || 0) * Number(customer.bagWeightKg || 0)) / 100;
                                    const avgBagWtKg = Number(customer.bags || 0) > 0 ? (Number(customer.netWeight || 0) * 100) / Number(customer.bags) : 0;

                                    const isHighlighted = highlightEntryId === customer.id;

                                    return (
                                        <tr 
                                            id={`entry-row-${customer.id}`}
                                            key={customer.id} 
                                            className={`border-b border-slate-300 hover:bg-slate-50/50 h-auto cursor-pointer ${isHighlighted ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
                                            onClick={handleRowClick}
                                            onDoubleClick={handleRowDoubleClick}
                                        >
                                            <td className="p-1.5 w-8 align-middle sticky left-0 bg-inherit z-10 border-r border-slate-300">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSelectCustomer(customer.id)}
                                                    className="h-6 w-6 p-0"
                                                >
                                                    {selectedCustomers.has(customer.id) ? (
                                                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                                    ) : (
                                                        <Square className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                            </td>
                                            <td className="p-1.5 align-middle sticky left-[35px] bg-inherit z-10 font-bold font-mono border-r border-slate-300">
                                                {customer.srNo}
                                            </td>
                                            <td className="p-1.5 text-center align-middle border-r border-slate-300">
                                                {format(new Date(customer.date), 'dd-MMM')}
                                            </td>
                                            {isDetailedMode && (
                                                <>
                                                    <td className="p-1.5 align-middle text-left leading-normal border-r border-slate-300">
                                                        <div className="font-bold text-[12px] text-slate-800 truncate max-w-[140px]" title={customer.name}>
                                                            {customer.name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={customer.companyName}>
                                                            {customer.companyName || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300">
                                                        <div>G: {Number(customer.grossWeight || 0).toFixed(1)}</div>
                                                        <div className="text-slate-500 text-[10px]">T: {Number(customer.teirWeight || 0).toFixed(1)}</div>
                                                    </td>
                                                    <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300">
                                                        <div className="font-bold text-slate-800">{Number(customer.weight || 0).toFixed(2)}</div>
                                                        <div className="text-rose-600 text-[9px]">Kt: {Number(customer.kartaWeight || 0).toFixed(2)} / Bg: {totalBagWtQtl.toFixed(2)}</div>
                                                    </td>
                                                </>
                                            )}
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300">
                                                <div className="font-bold text-slate-900">{Number(customer.netWeight || 0).toFixed(2)}</div>
                                                <div className="text-slate-500 text-[10px]">@ ₹{Number(customer.rate || 0).toLocaleString('en-IN')}</div>
                                            </td>
                                            <td className="p-1.5 align-middle text-center font-mono border-r border-slate-300">
                                                <div className="text-violet-700 font-bold">{customer.bags || 0}</div>
                                                <div className="text-slate-500 text-[9px]">{avgBagWtKg.toFixed(2)}kg</div>
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300">
                                                ₹{Math.round(baseAmt).toLocaleString('en-IN')}
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300 leading-tight">
                                                <div className="text-rose-500 font-medium">B: -{Math.round(bagDedAmt)}</div>
                                                <div className="text-rose-500 font-medium">K: -{Math.round(kartaAmt)}</div>
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300 font-bold">
                                                ₹{Math.round(calculatedFinalAmount).toLocaleString('en-IN')}
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300 leading-tight">
                                                <div className="text-slate-500">B: -{Math.round(brkAmt)}</div>
                                                <div className="text-slate-500">C: -{Math.round(cdAmt)}</div>
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono border-r border-slate-300 leading-tight">
                                                <div className="text-slate-600">+{Math.round(transAmt)}</div>
                                            </td>
                                            <td className="p-1.5 align-middle text-right font-mono text-emerald-600 font-bold border-r border-slate-300 text-[12px]">
                                                ₹{Math.round(totalRec).toLocaleString('en-IN')}
                                            </td>
                                            <td className="text-center p-1.5 align-middle sticky right-0 bg-inherit z-10 border-l border-slate-300">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => {
                                                            if (isImportMode) {
                                                                handleEditSingleInImportMode(customer);
                                                            } else {
                                                                onEditCustomer(customer);
                                                            }
                                                        }}>
                                                            <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onViewDetails?.(customer)}>
                                                            <Eye className="mr-2 h-3.5 w-3.5" /> View
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onPrintCustomer?.(customer)}>
                                                            <Printer className="mr-2 h-3.5 w-3.5" /> Print
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => {
                                                            if (customer.id) onMultiDelete?.([customer.id]);
                                                        }}>
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={isDetailedMode ? 22 : 16} className="text-center py-8">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-sm text-muted-foreground">No data available</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {hasData && !hasMore && displayRows.length > 30 && (
                                    <tr>
                                        <td colSpan={isDetailedMode ? 22 : 16} className="text-center py-2 text-xs text-muted-foreground">
                                            Showing all {displayRows.length} entries
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            </table>
                        </div>
                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
};

export const SimpleCustomerTable = memo(SimpleCustomerTableComponent);

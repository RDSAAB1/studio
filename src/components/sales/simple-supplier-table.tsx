"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useLiveQuery } from '@/lib/use-live-query';
import { db } from '@/lib/database';
import { deleteSupplier, updateSupplier, deleteStagedSupplier, updateStagedSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Edit2, Trash2, Save, X, Eye, Printer, CheckSquare, Square, User, UserSquare, Home, Truck, Wheat, Banknote, Percent, Weight, Hash, Calendar, FileText, PhoneCall, MoreVertical, Sigma, HandCoins, CircleDollarSign, TrendingUp, Scale } from "lucide-react";
import { toTitleCase, formatCurrency, roundToTwoDecimalPlaces, calculateSupplierEntry } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, OptionItem, RtgsSettings } from "@/lib/definitions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { printHtmlContent } from "@/lib/electron-print";
import { getRtgsSettings } from "@/lib/firestore";
import { SuggestionInput } from "@/components/ui/suggestion-input";
import { ProcessingOverlay } from "@/components/ui/processing-overlay";

import { cn } from "@/lib/utils";

const CategorySummaryCard = ({ title, data, icon }: { title: string; data: { label: string; value: string; isHighlighted?: boolean }[]; icon: React.ReactNode }) => (
    <Card className="flex-1 bg-card/60 border-primary/30 shadow-md">
        <CardHeader className="p-2 flex flex-row items-center space-x-2">
             <div className="bg-primary/10 text-primary p-1.5 rounded-md">{icon}</div>
             <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-1">
             <div className="space-y-1">
                {data.map((item, index) => (
                    <div key={index} className="flex justify-between items-baseline text-xs">
                        <p className="text-muted-foreground">{item.label}</p>
                        <p className={cn("font-mono font-semibold", item.isHighlighted && "text-primary font-bold text-sm")}>{item.value}</p>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

interface SimpleSupplierTableProps {
    onBackToEntry?: () => void;
    onEditSupplier: (supplier: Customer) => void;
    onViewDetails?: (supplier: Customer) => void;
    onPrintSupplier?: (supplier: Customer) => void;
    onMultiPrint?: (suppliers: Customer[]) => void;
    onMultiDelete?: (supplierIds: string[]) => void;
    suppliers: Customer[];
    totalCount: number;
    isLoading?: boolean;
    varietyOptions: OptionItem[];
    paymentTypeOptions: OptionItem[];
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
    
    // Staging props
    isImportMode?: boolean;
    onMergeSelected?: (selectedIds: string[]) => void;
    isFilterPending?: boolean;
    
    // Suggestion props
    uniqueProfiles?: Array<{name: string, so: string, address: string, contact: string, id?: string}>;
    uniqueNames?: string[];
    uniqueSo?: string[];
    uniqueAddresses?: string[];
    uniqueContacts?: string[];
}
const SimpleSupplierTableComponent = ({ 
    onBackToEntry, 
    onEditSupplier, 
    onViewDetails, 
    onPrintSupplier, 
    onMultiPrint, 
    onMultiDelete, 
    suppliers, 
    totalCount, 
    varietyOptions, 
    paymentTypeOptions, 
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
    isFilterPending = false,
    uniqueProfiles = [],
    uniqueNames = [],
    uniqueSo = [],
    uniqueAddresses = [],
    uniqueContacts = []
}: SimpleSupplierTableProps) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
    const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const lastClickTimeRef = React.useRef<number>(0);
    const [isDetailedMode, setIsDetailedMode] = useState(true);
    const [settings, setSettings] = useState<RtgsSettings | null>(null);
    const [isMultiDeleting, setIsMultiDeleting] = useState(false);
    const [isMultiEditing, setIsMultiEditing] = useState(false);
    const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
    const brokerOptions = React.useMemo(() => {
        return accounts.map(acc => ({
            value: acc.name,
            label: acc.name
        }));
    }, [accounts]);





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
                fatherName: matchedProfile.so,
                address: matchedProfile.address,
                contact: matchedProfile.contact
            }));
            markMultiEditTouched('name');
            if (matchedProfile.so) markMultiEditTouched('fatherName');
            if (matchedProfile.address) markMultiEditTouched('address');
            if (matchedProfile.contact) markMultiEditTouched('contact');
        } else {
            const value = toTitleCase(selectedValue);
            setMultiEditData(prev => ({ ...prev, name: value }));
            if (value.trim()) markMultiEditTouched('name');
        }
    }, [uniqueProfiles]);

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
        if (isDetailedMode) {
            return suppliers;
        }
        
        const grouped: { [key: string]: any } = {};
        suppliers.forEach(s => {
            const dateKey = format(new Date(s.date), "yyyy-MM-dd");
            if (!grouped[dateKey]) {
                grouped[dateKey] = {
                    id: dateKey,
                    date: s.date,
                    srNo: 'Σ',
                    term: '-',
                    name: ``,
                    so: '-',
                    vehicleNo: '-',
                    address: '-',
                    contact: '-',
                    paymentType: '-',
                    variety: '-',
                    grossWeight: 0,
                    teirWeight: 0,
                    weight: 0,
                    kartaWeight: 0,
                    netWeight: 0,
                    rate: 0,
                    amount: 0,
                    kartaAmount: 0,
                    netAmount: 0,
                    labouryAmount: 0,
                    kanta: 0,
                    originalNetAmount: 0,
                    count: 0,
                    isGrouped: true
                };
            }
            grouped[dateKey].grossWeight += (Number(s.grossWeight) || 0);
            grouped[dateKey].teirWeight += (Number(s.teirWeight) || 0);
            grouped[dateKey].weight += (Number(s.weight) || 0);
            grouped[dateKey].kartaWeight += (Number(s.kartaWeight) || 0);
            grouped[dateKey].netWeight += (Number(s.netWeight) || 0);
            grouped[dateKey].amount += (Number(s.amount) || 0);
            grouped[dateKey].kartaAmount += (Number(s.kartaAmount) || 0);
            grouped[dateKey].netAmount += (Number(s.netAmount) || 0);
            grouped[dateKey].labouryAmount += (Number(s.labouryAmount) || 0);
            grouped[dateKey].kanta += (Number(s.kanta) || 0);
            grouped[dateKey].originalNetAmount += (Number(s.originalNetAmount) || 0);
            grouped[dateKey].count += 1;
        });
        
        return Object.values(grouped).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((row: any) => {
            if (row.weight > 0) {
                row.rate = row.amount / row.weight;
            }
            row.name = `${row.count} Entries`;
            return row;
        });
    }, [suppliers, isDetailedMode, isImportMode]);
    
    // Highlight entry when highlightEntryId changes (no scrolling to avoid unresponsiveness)

    // Infinite scroll pagination - moved to top to be available for drag handlers
    const { visibleItems, hasMore, scrollRef } = useInfiniteScroll(displayRows, {
        totalItems: displayRows.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: displayRows.length > 30,
    });

    const displaySuppliers = displayRows.slice(0, visibleItems);
    
    const hasRestoredScroll = React.useRef(false);

    // Restore scroll position from localStorage
    useEffect(() => {
        if (!scrollRef.current || typeof window === 'undefined' || hasRestoredScroll.current) return;
        
        const restoreScroll = () => {
            try {
                const savedScroll = localStorage.getItem('supplier-table-scroll-position');
                if (savedScroll) {
                    const scrollPosition = parseInt(savedScroll, 10);
                    if (!isNaN(scrollPosition) && scrollPosition > 0) {
                        const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                        if (viewport) {
                            viewport.scrollTop = scrollPosition;
                        }
                    }
                }
            } catch (error) {}
        };
        
        restoreScroll();
        const timer = setTimeout(() => {
            restoreScroll();
            hasRestoredScroll.current = true;
        }, 300);
        return () => clearTimeout(timer);
    }, [scrollRef]);
    
    // Save scroll position to localStorage
    useEffect(() => {
        if (!scrollRef.current || typeof window === 'undefined') return;
        
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!viewport) return;
        
        let saveTimer: NodeJS.Timeout;
        const handleScroll = () => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                try {
                    localStorage.setItem('supplier-table-scroll-position', String(viewport.scrollTop));
                } catch (error) {

                }
            }, 200);
        };
        
        viewport.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            clearTimeout(saveTimer);
        };
    }, [scrollRef]);
    
    // Keep refs in sync
    React.useEffect(() => {
        displaySuppliersRef.current = displaySuppliers;
    }, [displaySuppliers]);
    
    // Drag selection state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const tbodyRef = React.useRef<HTMLTableSectionElement | null>(null);
    const dragStartSelectionRef = React.useRef<Set<string>>(new Set());
    const rafRef = React.useRef<number | null>(null);
    const hasDraggedRef = React.useRef<boolean>(false);
    const dragStartRef = React.useRef<{ x: number; y: number } | null>(null);
    const displaySuppliersRef = React.useRef<typeof displaySuppliers>([]);
    
    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);
    
    // Handle mouse down for drag selection
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only start drag if clicking on table body (not buttons/checkboxes)
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
            return;
        }
        
        const tbody = tbodyRef.current;
        if (!tbody) return;
        
        const container = tbody.parentElement;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const x = e.clientX - containerRect.left;
        const y = e.clientY - containerRect.top;
        
        // Store initial selection state
        dragStartSelectionRef.current = new Set(selectedSuppliers);
        hasDraggedRef.current = false;
        dragStartRef.current = { x, y };
        
        setIsDragging(true);
        setDragStart({ x, y });
        setDragEnd({ x, y });
        
        // Prevent text selection during drag
        e.preventDefault();
    }, [selectedSuppliers]);
    
    // Optimized selection calculation using requestAnimationFrame
    const updateSelection = useCallback((clientX: number, clientY: number) => {
        if (!tbodyRef.current || !dragStartRef.current) return;
        
        const tbody = tbodyRef.current;
        const container = tbody.parentElement;
        if (!container) return;
        
        const containerRect = container.getBoundingClientRect();
        const x = clientX - containerRect.left;
        const y = clientY - containerRect.top;
        const dragStart = dragStartRef.current;
        
        // Check if we've actually dragged (moved more than 5 pixels)
        const dragDistance = Math.abs(x - dragStart.x) + Math.abs(y - dragStart.y);
        if (dragDistance > 5) {
            hasDraggedRef.current = true;
        }
        
        setDragEnd({ x, y });
        
        // Use requestAnimationFrame to batch updates
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }
        
        rafRef.current = requestAnimationFrame(() => {
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const newSelection = new Set(dragStartSelectionRef.current);
            const currentDisplaySuppliers = displaySuppliersRef.current;
            
            const minY = Math.min(dragStart.y, y);
            const maxY = Math.max(dragStart.y, y);
            
            // Find the row where drag started
            let startRowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowRect = row.getBoundingClientRect();
                const rowTop = rowRect.top - containerRect.top;
                const rowBottom = rowTop + rowRect.height;
                if (dragStart.y >= rowTop && dragStart.y <= rowBottom) {
                    startRowIndex = i;
                    break;
                }
            }
            
            // Determine if we're adding or removing based on initial click
            const initialWasSelected = startRowIndex >= 0 && startRowIndex < currentDisplaySuppliers.length 
                ? dragStartSelectionRef.current.has(currentDisplaySuppliers[startRowIndex].id)
                : false;
            
            // Update selection for rows in drag box
            rows.forEach((row, index) => {
                if (index >= currentDisplaySuppliers.length) return;
                
                const rowRect = row.getBoundingClientRect();
                const rowTop = rowRect.top - containerRect.top;
                const rowBottom = rowTop + rowRect.height;
                
                // Check if row intersects with selection box
                if (rowBottom >= minY && rowTop <= maxY) {
                    const supplier = currentDisplaySuppliers[index];
                    if (supplier) {
                        if (initialWasSelected) {
                            // If started from selected row, deselect rows in drag box
                            newSelection.delete(supplier.id);
                        } else {
                            // If started from unselected row, select rows in drag box
                            newSelection.add(supplier.id);
                        }
                    }
                }
            });
            
            setSelectedSuppliers(newSelection);
        });
    }, []);
    
    // Handle mouse move for drag selection (only for visual feedback, actual selection in global handler)
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        updateSelection(e.clientX, e.clientY);
    }, [isDragging, updateSelection]);
    
    // Handle mouse up to end drag selection
    const handleMouseUp = useCallback(() => {
        const wasDragging = hasDraggedRef.current;
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        dragStartRef.current = null;
        dragStartSelectionRef.current = new Set();
        hasDraggedRef.current = false;
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        return wasDragging;
    }, []);
    
    // Add global mouse event listeners for drag selection
    React.useEffect(() => {
        if (isDragging) {
            const handleGlobalMouseMove = (e: MouseEvent) => {
                updateSelection(e.clientX, e.clientY);
            };
            
            const handleGlobalMouseUp = () => {
                const wasDragging = hasDraggedRef.current;
                setIsDragging(false);
                setDragStart(null);
                setDragEnd(null);
                dragStartRef.current = null;
                dragStartSelectionRef.current = new Set();
                hasDraggedRef.current = false;
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
                return wasDragging;
            };
            
            document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
            document.addEventListener('mouseup', handleGlobalMouseUp);
            
            return () => {
                document.removeEventListener('mousemove', handleGlobalMouseMove);
                document.removeEventListener('mouseup', handleGlobalMouseUp);
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                }
            };
        }
    }, [isDragging, updateSelection]);

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

    // Compute due date preview from multi-edit Date + Term
    const computedDueDate = React.useMemo(() => {
        try {
            const baseDateStr = multiEditData.date as string | undefined;
            const termStr = multiEditData.term as string | undefined;
            if (!baseDateStr || !termStr) return '';
            const d = new Date(baseDateStr);
            const days = parseInt(termStr || '0', 10) || 0;
            const due = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
            return format(due, 'yyyy-MM-dd');
        } catch {
            return '';
        }
    }, [multiEditData.date, multiEditData.term]);


    const handleDelete = async (supplierId: string) => {
        try {
            setIsDeleting(true);
            if (isImportMode) {
                await deleteStagedSupplier(supplierId);
            } else {
                await deleteSupplier(supplierId);
            }
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
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSelectSupplier = (supplierId: string) => {
        setSelectedSuppliers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(supplierId)) {
                newSet.delete(supplierId);
            } else {
                newSet.add(supplierId);
            }
            return newSet;
        });
    };

    const handleSelectGroup = (dateStr: string) => {
        const groupSuppliers = suppliers.filter(s => format(new Date(s.date), "yyyy-MM-dd") === dateStr);
        const groupIds = groupSuppliers.map(s => s.id);
        const allSelected = groupIds.every(id => selectedSuppliers.has(id));

        setSelectedSuppliers(prev => {
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
        const groupSuppliers = suppliers.filter(s => format(new Date(s.date), "yyyy-MM-dd") === dateStr);
        if (groupSuppliers.length === 0) return false;
        return groupSuppliers.every(s => selectedSuppliers.has(s.id));
    };

    const handleSelectAll = () => {
        if (selectedSuppliers.size === suppliers.length) {
            setSelectedSuppliers(new Set());
        } else {
            setSelectedSuppliers(new Set(suppliers.map(s => s.id)));
        }
    };

    const handleMultiEdit = () => {
        if (selectedSuppliers.size === 0) return;
        
        setIsMultiEditing(true);
        setMultiEditData({
            brokerageRate: 0,
            brokerageAddSubtract: true,
        });
        toast({
            title: "Multi Edit Mode",
            description: `Edit ${selectedSuppliers.size} selected entries`,
        });
    };

    // In import mode, clicking Edit on a single row opens multi-edit pre-filled with that entry's data
    const handleEditSingleInImportMode = useCallback((supplier: Customer) => {
        setSelectedSuppliers(new Set([supplier.id]));
        setIsMultiEditing(true);
        setMultiEditData({
            name: supplier.name || '',
            fatherName: (supplier as any).fatherName || supplier.so || '',
            address: supplier.address || '',
            contact: supplier.contact || '',
            vehicleNo: supplier.vehicleNo || '',
            variety: supplier.variety || '',
            kartaPercentage: supplier.kartaPercentage,
            kanta: supplier.kanta,
            brokerageRate: supplier.brokerageRate,
            brokerName: supplier.brokerName || '',
        });
        // Don't mark as touched — user will only mark what they actually change
        setMultiEditTouched(new Set());
        toast({
            title: "Edit Entry",
            description: `Editing: ${supplier.name || 'Entry'} — modify any field and click Save All`,
        });
    }, []);

    const handleMultiEditSave = async () => {
        if (selectedSuppliers.size === 0) return;
        
        setIsMultiSaving(true);
        try {
            const selectedSuppliersList = suppliers.filter(s => selectedSuppliers.has(s.id));
            let successCount = 0;
            let errorCount = 0;
            
            for (const supplier of selectedSuppliersList) {
                try {
                    const updateData: Partial<Customer> = {};
                    const shouldUpdateCustomerId = { name: false, so: false };
                    
                    if (multiEditTouched.has('name')) {
                        const updatedName = multiEditData.name?.trim() || '';
                        updateData.name = updatedName;
                        shouldUpdateCustomerId.name = true;
                    }
                    if (multiEditTouched.has('fatherName')) {
                        const updatedSo = multiEditData.fatherName?.trim() || '';
                        updateData.so = updatedSo;
                        shouldUpdateCustomerId.so = true;
                    }
                    if (multiEditTouched.has('address')) {
                        updateData.address = multiEditData.address?.trim() || '';
                    }
                    if (multiEditTouched.has('contact')) {
                        updateData.contact = multiEditData.contact?.trim() || '';
                    }
                    if (multiEditTouched.has('vehicleNo')) {
                        updateData.vehicleNo = multiEditData.vehicleNo?.trim() || '';
                    }
                    if (multiEditTouched.has('variety')) {
                        updateData.variety = multiEditData.variety?.trim() || '';
                    }
                    if (multiEditTouched.has('paymentType')) {
                        updateData.paymentType = multiEditData.paymentType?.trim() || '';
                    }
                    if (multiEditTouched.has('kartaPercentage') && typeof multiEditData.kartaPercentage === 'number') {
                        updateData.kartaPercentage = multiEditData.kartaPercentage;
                    }
                    if (multiEditTouched.has('kanta') && typeof multiEditData.kanta === 'number') {
                        updateData.kanta = multiEditData.kanta;
                    }
                    if (multiEditTouched.has('term') && typeof multiEditData.term === 'number') {
                        updateData.term = String(multiEditData.term);
                        if (multiEditData.date) {
                            updateData.dueDate = computedDueDate;
                        }
                    }
                    if (multiEditTouched.has('date') && typeof multiEditData.date === 'string' && multiEditData.date) {
                        updateData.date = multiEditData.date;
                        if (!multiEditTouched.has('term') && supplier.term) {
                            const termDays = parseInt(String(supplier.term || '0'), 10) || 0;
                            const baseDate = new Date(multiEditData.date);
                            const due = new Date(baseDate.getTime() + termDays * 24 * 60 * 60 * 1000);
                            updateData.dueDate = format(due, 'yyyy-MM-dd');
                        }
                    }
                    // Note: grossWeight, teirWeight, and rate are NOT editable in multi-edit mode
                    // They remain individual to each entry
                    if (multiEditTouched.has('labouryRate') && typeof multiEditData.labouryRate === 'number') {
                        updateData.labouryRate = multiEditData.labouryRate;
                    }
                    if (multiEditTouched.has('brokerageRate') && typeof multiEditData.brokerageRate === 'number') {
                        updateData.brokerageRate = multiEditData.brokerageRate;
                    }

                    if (multiEditTouched.has('brokerName')) {
                        updateData.brokerName = multiEditData.brokerName?.trim() || '';
                    }

                    if (shouldUpdateCustomerId.name || shouldUpdateCustomerId.so || updateData.contact) {
                        const nextName = updateData.name ?? supplier.name ?? '';
                        const nextSo = updateData.so ?? supplier.so ?? '';
                        updateData.customerId = `${toTitleCase(nextName).toLowerCase()}|${toTitleCase(nextSo).toLowerCase()}`;
                    }

                    // Recalculate calculations if any key field is touched/updated
                    const calculationInputFields = ['grossWeight', 'teirWeight', 'kartaPercentage', 'rate', 'labouryRate', 'kanta', 'brokerageRate'];
                    const calculationChanged = calculationInputFields.some(field => multiEditTouched.has(field));
                    if (calculationChanged) {
                        const mergedForCalculation = {
                            ...supplier,
                            ...updateData
                        };
                        const calculated = calculateSupplierEntry(mergedForCalculation as any);
                        updateData.weight = calculated.weight;
                        updateData.kartaWeight = calculated.kartaWeight;
                        updateData.kartaAmount = calculated.kartaAmount;
                        updateData.netWeight = calculated.netWeight;
                        updateData.amount = calculated.amount;
                        updateData.labouryAmount = calculated.labouryAmount;
                        updateData.originalNetAmount = calculated.originalNetAmount;
                        updateData.netAmount = calculated.netAmount;
                        updateData.finalAmount = calculated.finalAmount;
                        updateData.brokerage = calculated.brokerage;
                    }
                    
                    // Only update if there's data to update
                    if (Object.keys(updateData).length > 0) {
                        if (isImportMode) {
                            const updateResult = await updateStagedSupplier(supplier.id, updateData);
                            if (updateResult) {
                                successCount++;
                                try {
                                    await db.stagedSuppliers.put({ ...supplier, ...updateData });
                                } catch (localError) {
                                }
                            } else {
                                errorCount++;
                            }
                        } else {
                            const updateResult = await updateSupplier(supplier.id, updateData);
                            if (updateResult) {
                                successCount++;
                                try {
                                    await db.suppliers.put({ ...supplier, ...updateData });
                                } catch (localError) {
                                }
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
            setSelectedSuppliers(new Set());
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

    const handleMultiPrint = () => {
        if (selectedSuppliers.size === 0) return;
        
        const selectedSuppliersList = suppliers.filter(s => selectedSuppliers.has(s.id));
        if (onMultiPrint) {
            onMultiPrint(selectedSuppliersList);
        }
    };

    const handleMultiDelete = async () => {
        if (selectedSuppliers.size === 0) return;
        
        try {
            setIsMultiDeleting(true);
            const selectedSuppliersList = suppliers.filter(s => selectedSuppliers.has(s.id));
            const supplierIds = selectedSuppliersList.map(s => s.id);
            
            if (isImportMode) {
                const { deleteMultipleStagedSuppliers } = await import("@/lib/firestore");
                await deleteMultipleStagedSuppliers(supplierIds);
            } else if (onMultiDelete) {
                await onMultiDelete(supplierIds);
            }
            
            setSelectedSuppliers(new Set());
        } catch (error) {

            toast({
                title: "Error",
                description: "Failed to delete entries",
                variant: "destructive",
            });
        } finally {
            setIsMultiDeleting(false);
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

        // In detailed mode → print individual supplier rows (filtered by selection)
        // In non-detailed (combined) mode → print grouped/aggregated rows from displayRows
        let rowsToPrint: any[];
        if (isDetailedMode) {
            // Detailed: individual entries, respecting selection
            const individualList = selectedSuppliers.size > 0
                ? suppliers.filter(s => selectedSuppliers.has(s.id))
                : suppliers;
            rowsToPrint = individualList;
        } else {
            // Combined/overall: use the already-grouped displayRows
            // If something is selected, filter to only groups that have at least one selected entry
            if (selectedSuppliers.size > 0) {
                const selectedDates = new Set(
                    suppliers.filter(s => selectedSuppliers.has(s.id))
                        .map(s => format(new Date(s.date), 'yyyy-MM-dd'))
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
        const printTotals = rowsToPrint.reduce((acc, s) => {
            const baseAmt = Number(s.amount || 0);
            const kartaAmt = Number(s.kartaAmount || 0);
            const afterKarta = baseAmt - kartaAmt;
            const cd = afterKarta * 0.01;
            
            acc.grossWt += (Number(s.grossWeight) || 0);
            acc.teirWt += (Number(s.teirWeight) || 0);
            acc.weight += (Number(s.weight) || 0);
            acc.kartaWt += (Number(s.kartaWeight) || 0);
            acc.netWt += (Number(s.netWeight) || 0);
            acc.amount += baseAmt;
            acc.kartaAmt += kartaAmt;
            acc.labouryAmt += (Number(s.labouryAmount) || 0);
            acc.kanta += (Number(s.kanta) || 0);
            acc.netAmt += (Number(s.netAmount) || 0);
            acc.rateSum += (Number(s.rate) || 0);
            acc.cdAmt += cd;
            acc.finalNet += (afterKarta - cd - (Number(s.labouryAmount) || 0) - (Number(s.kanta) || 0));
            return acc;
        }, {
            grossWt: 0, teirWt: 0, weight: 0, kartaWt: 0, netWt: 0,
            amount: 0, kartaAmt: 0, labouryAmt: 0, kanta: 0, netAmt: 0, rateSum: 0, cdAmt: 0, finalNet: 0
        });
        const rateAvg = rowsToPrint.length > 0 ? printTotals.rateSum / rowsToPrint.length : 0;

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Supplier Report</title>
                <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'IBM Plex Sans', sans-serif !important; margin: 0; padding: 15px; color: #334155; line-height: 1.2; letter-spacing: -0.01em; font-weight: 400; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px; border-bottom: 2px solid #475569; padding-bottom: 8px; }
                    .header-left { text-align: left; }
                    .header-left h1 { margin: 0; font-size: 24px; color: #1e293b; letter-spacing: -0.02em; font-weight: 700; line-height: 1; }
                    .header-left p { margin: 4px 0 0 0; font-size: 10px; color: #64748b; font-weight: 600; }
                    .header-right { text-align: right; font-size: 9px; color: #64748b; font-weight: 500; line-height: 1.3; }
                    
                    .main-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 0.5px solid #94a3b8; table-layout: fixed; line-height: 1.1; }
                    .main-table th, .main-table td { border: 0.5px solid #cbd5e1; padding: 3px 2px; text-align: right; overflow: hidden; white-space: nowrap; }
                    .main-table th { background: #f1f5f9; color: #1e293b; text-align: center; font-weight: 600; font-size: 9.5px; border: 0.5px solid #94a3b8; vertical-align: middle; }
                    .main-table td { background: #fff; color: #334155; font-weight: 400; }
                    
                    /* Align text columns to left in printout */
                    ${isDetailedMode 
                        ? '.main-table td:nth-child(3), .main-table td:nth-child(4) { text-align: left !important; white-space: normal; }' 
                        : '.main-table td:nth-child(3) { text-align: left !important; white-space: normal; }'
                    }
                    
                    .main-table td:nth-child(1), .main-table td:nth-child(2) { text-align: center; }
                    
                    .cell-stack { display: flex; flex-direction: column; gap: 0px; }
                    .primary-val { font-weight: 400; color: #0f172a; }
                    .secondary-val { font-size: 8px; color: #64748b; font-weight: 400; }
                    .text-financial { color: #166534; font-weight: 600; }
                    .text-rate { color: #92400e; font-weight: 600; }
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
                        <p>Supplier Report${isDetailedMode ? '' : ' (Combined / Date-wise)'}</p>
                    </div>
                </div>

                <table class="main-table">
                    <thead>
                        <tr>
                            <th style="width: 4%">SR</th>
                            <th style="width: 7%">${isDetailedMode ? 'Date / T' : 'Date'}</th>
                            <th style="width: ${isDetailedMode ? '14%' : '18%'}">${isDetailedMode ? 'Supplier / Father' : 'Entries'}</th>
                            ${isDetailedMode ? `
                            <th style="width: 10%">Vehicle / Address</th>
                            <th style="width: 6%">Gr/Tr</th>
                            ` : ''}
                            <th style="width: 6%">Fn</th>
                            <th style="width: 4%">Kt</th>
                            <th style="width: 7%">NetWt</th>
                            <th style="width: 7%">Rate</th>
                            <th style="width: 8%">Amnt</th>
                            <th style="width: 5%">KtA</th>
                            <th style="width: 8%">Af.Kt</th>
                            <th style="width: 5%">Lb</th>
                            <th style="width: 5%">Kn</th>
                            <th style="width: 8%">Pay</th>
                            <th style="width: 5%">CD</th>
                            <th style="width: 11%">Final Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsToPrint.map((s, idx) => {
                            const afterKartaAmount = Number(s.amount || 0) - Number(s.kartaAmount || 0);
                            const cdAmount = afterKartaAmount * 0.01;
                            const finalNet = afterKartaAmount - cdAmount - Number(s.labouryAmount || 0) - Number(s.kanta || 0);
                            return `
                                <tr>
                                    <td>${s.isGrouped ? 'Σ' : (s.srNo || (idx + 1))}</td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="primary-val">${format(new Date(s.date), "dd-MMM")}</span>
                                            ${isDetailedMode ? `<span class="secondary-val">${s.term || ''}</span>` : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span class="text-supp">${escapeHtml(s.isGrouped ? s.name : toTitleCase(s.name || ''))}</span>
                                            <span class="secondary-val">${s.isGrouped ? '' : `S/O: ${escapeHtml(toTitleCase(s.so || ''))}`}</span>
                                        </div>
                                    </td>
                                    ${isDetailedMode ? `
                                    <td>
                                        <div class="cell-stack">
                                            <span class="primary-val" style="font-size:9px">${escapeHtml((s.vehicleNo || '').toUpperCase())}</span>
                                            <span class="secondary-val">${escapeHtml(s.address || '')}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cell-stack">
                                            <span style="font-weight:700">${Number(s.grossWeight || 0).toFixed(2)}</span>
                                            <span class="secondary-val">${Number(s.teirWeight || 0).toFixed(2)}</span>
                                        </div>
                                    </td>
                                    ` : ''}
                                    <td>${Number(s.weight || 0).toFixed(2)}</td>
                                    <td>${Number(s.kartaWeight || 0).toFixed(2)}</td>
                                    <td style="font-weight:700; color:#1e293b">${Number(s.netWeight || 0).toFixed(2)}</td>
                                    <td class="text-rate">${Math.round(Number(s.rate || 0)).toLocaleString('en-IN')}</td>
                                    <td class="text-rate">${Math.round(Number(s.amount || 0)).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(Number(s.kartaAmount || 0)).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(afterKartaAmount).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(Number(s.labouryAmount || 0)).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(Number(s.kanta || 0)).toLocaleString('en-IN')}</td>
                                    <td class="text-financial">${Math.round(Number(s.netAmount || 0)).toLocaleString('en-IN')}</td>
                                    <td>${Math.round(cdAmount).toLocaleString('en-IN')}</td>
                                    <td class="text-financial" style="font-weight:700; font-size: 11px">₹${Math.round(finalNet).toLocaleString('en-IN')}</td>
                                </tr>
                            `;
                        }).join('')}
                         <tr class="bg-total">
                                    <td colspan="${isDetailedMode ? '4' : '3'}" style="text-align:center; font-size: 11px;">TOTALS (${rowsToPrint.length} ${isDetailedMode ? 'Entries' : 'Days'})</td>
                                    ${isDetailedMode ? `
                                    <td>
                                        <div class="cell-stack">
                                            <span>${printTotals.grossWt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                            <span class="secondary-val">${printTotals.teirWt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </td>
                                    ` : ''}
                                    <td>${printTotals.weight.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td>${printTotals.kartaWt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td style="color:#1e293b; font-weight:700">${printTotals.netWt.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                                    <td>
                                        <div class="cell-stack text-rate" style="font-size:8.5px">
                                            <span>Avg: ₹${Math.round(rateAvg).toLocaleString('en-IN')}</span>
                                        </div>
                                    </td>
                                    <td class="text-rate">₹${Math.round(printTotals.amount).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(printTotals.kartaAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(printTotals.amount - printTotals.kartaAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(printTotals.labouryAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(printTotals.kanta).toLocaleString('en-IN')}</td>
                                    <td class="text-financial">₹${Math.round(printTotals.netAmt).toLocaleString('en-IN')}</td>
                                    <td>₹${Math.round(printTotals.cdAmt).toLocaleString('en-IN')}</td>
                                    <td class="text-financial" style="font-size: 12.5px; font-weight: 700;">₹${Math.round(printTotals.finalNet).toLocaleString('en-IN')}</td>
                                </tr>
                            </tbody>
                        </table>
            </body>
            </html>
        `;

        await printHtmlContent(printContent);
    };

    const totals = useMemo(() => {
        const list = selectedSuppliers.size > 0 
            ? suppliers.filter(s => selectedSuppliers.has(s.id))
            : (suppliers || []);
        const initialTotals = {
            grossWt: 0,
            teirWt: 0,
            weight: 0,
            kartaWt: 0,
            netWt: 0,
            amount: 0,
            kartaAmt: 0,
            afterKartaAmt: 0,
            cdAmt: 0,
            finalNet: 0,
            labouryAmt: 0,
            brokerageAmt: 0,
            kanta: 0,
            netAmt: 0,
            rateAvg: 0,
            finalAmt: 0,
            minRate: 0,
            maxRate: 0,
            kartaPercentage: 0,
            totalEntries: list.length,
        };

        if (list.length === 0) return initialTotals;

        const computed = list.reduce((acc, s) => {
            acc.grossWt += (Number(s.grossWeight) || 0);
            acc.teirWt += (Number(s.teirWeight) || 0);
            acc.weight += (Number(s.weight) || 0);
            acc.kartaWt += (Number(s.kartaWeight) || 0);
            acc.netWt += (Number(s.netWeight) || 0);
            acc.amount += (Number(s.amount) || 0);
            acc.kartaAmt += (Number(s.kartaAmount) || 0);
            
            const afterKarta = (Number(s.amount) || 0) - (Number(s.kartaAmount) || 0);
            const cd = afterKarta * 0.01;
            acc.afterKartaAmt += afterKarta;
            acc.cdAmt += cd;
            acc.finalNet += (afterKarta - cd - (Number(s.labouryAmount) || 0) - (Number(s.kanta) || 0));

            acc.labouryAmt += (Number(s.labouryAmount) || 0);
            acc.brokerageAmt += (Number(s.brokerageAmount) || 0);
            acc.kanta += (Number(s.kanta) || 0);
            acc.netAmt += (Number(s.netAmount) || 0);
            acc.kartaPercentage += (Number(s.kartaPercentage) || 0);
            return acc;
        }, initialTotals);

        const validRates = list.map(s => s.rate).filter(rate => rate > 0);
        computed.minRate = validRates.length > 0 ? Math.min(...validRates) : 0;
        computed.maxRate = validRates.length > 0 ? Math.max(...validRates) : 0;

        if (computed.weight > 0) {
            computed.rateAvg = computed.amount / computed.weight;
        }
        if (list.length > 0) {
            computed.kartaPercentage = computed.kartaPercentage / list.length;
        }

        computed.finalAmt = computed.amount - computed.kartaAmt;
        return computed;
    }, [suppliers, selectedSuppliers]);

    // Always show table structure
    const hasData = suppliers && suppliers.length > 0;

    return (
        <div className="space-y-4">
            <ProcessingOverlay 
                show={isDeleting || isMultiDeleting || isFilterPending} 
                isDeleting={isDeleting || isMultiDeleting} 
                title={
                    isDeleting || isMultiDeleting 
                        ? "Deleting Records..." 
                        : isFilterPending 
                            ? "Filtering Data..." 
                            : "Processing..."
                }
                description={
                    isDeleting || isMultiDeleting 
                        ? "Please wait while we delete the entries." 
                        : isFilterPending 
                            ? "Applying search filters to the database..." 
                            : "Please wait..."
                }
            />
            {/* Multi-select Controls & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100/80 border rounded-lg shadow-sm">
                {/* Left Actions (when selected) */}
                <div className="flex flex-wrap items-center gap-2">
                    {selectedSuppliers.size > 0 ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700 bg-slate-200 px-2.5 py-1 rounded-full border border-slate-300">
                                {selectedSuppliers.size} Selected
                            </span>
                            <Button
                                size="sm"
                                onClick={handleMultiEdit}
                                className="h-8 px-3 text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 font-semibold shadow-sm rounded-md transition-all duration-200"
                            >
                                <Edit2 className="h-4 w-4 mr-1.5" />
                                Edit
                            </Button>
                            {!isImportMode && (
                                <Button
                                    size="sm"
                                    onClick={handleMultiPrint}
                                    className="h-8 px-3 text-primary-foreground bg-primary hover:bg-primary/90 border border-primary/95 font-semibold shadow-sm rounded-md transition-all duration-200"
                                >
                                    <Printer className="h-4 w-4 mr-1.5 text-primary-foreground" />
                                    Print Format
                                </Button>
                            )}
                            {isImportMode && onMergeSelected && (
                                <Button
                                    size="sm"
                                    onClick={() => onMergeSelected(Array.from(selectedSuppliers))}
                                    className="h-8 px-3 text-primary-foreground bg-primary hover:bg-primary/90 border border-primary/95 font-semibold shadow-sm rounded-md transition-all duration-200"
                                >
                                    <CheckSquare className="h-4 w-4 mr-1.5 text-primary-foreground" />
                                    Merge to Main Database
                                </Button>
                            )}
                            <Button
                                size="sm"
                                onClick={handleMultiDelete}
                                disabled={isMultiDeleting}
                                className="h-8 px-3 text-white bg-rose-600 hover:bg-rose-700 border border-rose-700 font-semibold shadow-sm rounded-md transition-all duration-200"
                            >
                                {isMultiDeleting ? (
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                )}
                                Delete
                            </Button>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 font-medium italic pl-1">
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
                            inputClassName="h-8 text-xs bg-white border-slate-300"
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
                                inputClassName="h-8 text-xs bg-white border-slate-300"
                            />
                        </div>
                        
                        {selectedDateFilter === "PARTICULAR" && (
                            <div className="w-[125px] shrink-0">
                                <SmartDatePicker
                                    value={selectedParticularDate}
                                    onChange={(val) => onParticularDateChange(typeof val === 'string' ? val : format(val, "yyyy-MM-dd"))}
                                    placeholder="Pick date"
                                    inputClassName="h-8 text-xs bg-white border-slate-300"
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
                                    inputClassName="h-8 text-xs bg-white border-slate-300"
                                    buttonClassName="h-8 w-8 px-2"
                                />
                                <span className="text-[10px] text-muted-foreground">to</span>
                                <SmartDatePicker
                                    value={selectedEndDate}
                                    onChange={(val) => onEndDateChange(typeof val === 'string' ? val : format(val, "yyyy-MM-dd"))}
                                    placeholder="End date"
                                    inputClassName="h-8 text-xs bg-white border-slate-300"
                                    buttonClassName="h-8 w-8 px-2"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 px-2.5 h-8 bg-white border border-slate-300 rounded-md shadow-sm">
                        <Switch id="table-detailed-mode" checked={isDetailedMode} onCheckedChange={setIsDetailedMode} className="scale-75" />
                        <Label htmlFor="table-detailed-mode" className="text-[10px] font-bold uppercase cursor-pointer text-slate-600">Detailed</Label>
                    </div>
                    

                    
                    <Button onClick={handlePrintReport} size="sm" className="h-8 text-[11px] font-bold uppercase tracking-tight px-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all duration-200 rounded-md border border-primary/95">
                        <Printer className="mr-1.5 h-3.5 w-3.5 text-primary-foreground" /> Print Report
                    </Button>
                </div>
            </div>

            {/* Multi-Edit Form */}
            {isMultiEditing && selectedSuppliers.size > 0 && (
                <Card>
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">
                                Multi-Edit Mode ({selectedSuppliers.size} entries selected)
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
                    <CardContent className="p-3 pt-0">
                        <div className="space-y-4">
                            {isImportMode ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Name</label>
                                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
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
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Father Name</label>
                                            <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                                <SuggestionInput
                                                    suggestions={uniqueSo}
                                                    value={multiEditData.fatherName || ''}
                                                    onChange={(e) => {
                                                        const value = toTitleCase(e.target.value);
                                                        setMultiEditData(prev => ({ ...prev, fatherName: value }));
                                                        if (value.trim()) markMultiEditTouched('fatherName');
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            setMultiEditTouched(prev => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete('fatherName');
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Enter father name"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Address</label>
                                            <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
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
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Contact No</label>
                                            <InputWithIcon icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />}>
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
                                            </InputWithIcon>
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
                                            <label className="text-xs font-medium text-muted-foreground">Broker Name</label>
                                            <CustomDropdown
                                                options={brokerOptions}
                                                value={multiEditData.brokerName || null}
                                                onChange={(value) => {
                                                    setMultiEditData(prev => ({ ...prev, brokerName: value || '' }));
                                                    if (value) {
                                                        markMultiEditTouched('brokerName');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('brokerName');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                placeholder="Select Broker"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Brokerage Rate</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={multiEditData.brokerageRate !== undefined ? String(multiEditData.brokerageRate) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setMultiEditData(prev => ({ ...prev, brokerageRate: value ? Number(value) : undefined }));
                                                    if (value) {
                                                        markMultiEditTouched('brokerageRate');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('brokerageRate');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Personal Details Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Name</label>
                                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
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
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Father Name</label>
                                            <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
                                                    value={multiEditData.fatherName || ''}
                                                    onChange={(e) => {
                                                        const value = toTitleCase(e.target.value);
                                                        setMultiEditData(prev => ({ ...prev, fatherName: value }));
                                                        if (value.trim()) markMultiEditTouched('fatherName');
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            setMultiEditTouched(prev => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete('fatherName');
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Enter father name"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Address</label>
                                            <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
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
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Contact No</label>
                                            <InputWithIcon icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />}>
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
                                            </InputWithIcon>
                                        </div>
                                    </div>

                                    {/* Vehicle Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Vehicle No</label>
                                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
                                                    value={multiEditData.vehicleNo || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value.toUpperCase();
                                                        setMultiEditData(prev => ({ ...prev, vehicleNo: value }));
                                                        if (value.trim()) markMultiEditTouched('vehicleNo');
                                                    }}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            setMultiEditTouched(prev => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete('vehicleNo');
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Enter vehicle number"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                    </div>

                                    {/* Business Details Row */}
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
                                    </div>

                                    {/* Calculation Details Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Kanta</label>
                                            <Input
                                                type="number"
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
                                            <label className="text-xs font-medium text-muted-foreground">Laboury Rate</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={multiEditData.labouryRate !== undefined ? String(multiEditData.labouryRate) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setMultiEditData(prev => ({ ...prev, labouryRate: value ? Number(value) : undefined }));
                                                    if (value) {
                                                        markMultiEditTouched('labouryRate');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('labouryRate');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Brokerage Rate</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={multiEditData.brokerageRate !== undefined ? String(multiEditData.brokerageRate) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setMultiEditData(prev => ({ ...prev, brokerageRate: value ? Number(value) : undefined }));
                                                    if (value) {
                                                        markMultiEditTouched('brokerageRate');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('brokerageRate');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>

                                    {/* Additional Details Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Date</label>
                                            <SmartDatePicker
                                                value={(multiEditData.date as string) || ''}
                                                onChange={(next) => {
                                                    const nextValue = typeof next === "string" ? next : format(next, "yyyy-MM-dd");
                                                    setMultiEditData(prev => ({ ...prev, date: nextValue || undefined }));
                                                    if (nextValue) {
                                                        markMultiEditTouched('date');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('date');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                inputClassName="text-sm h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Term (days)</label>
                                            <Input
                                                type="number"
                                                value={multiEditData.term !== undefined ? String(multiEditData.term) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setMultiEditData(prev => ({ ...prev, term: value || undefined }));
                                                    if (value) {
                                                        markMultiEditTouched('term');
                                                    } else {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('term');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                                            <InputWithIcon icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
                                                    value={computedDueDate || multiEditData.dueDate || ''}
                                                    readOnly
                                                    disabled
                                                    placeholder="Auto (Date + Term)"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">S/O</label>
                                            <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
                                                    value={multiEditData.so || ''}
                                                    onChange={(e) => setMultiEditData(prev => ({ ...prev, so: toTitleCase(e.target.value) }))}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            setMultiEditTouched(prev => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete('so');
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Enter S/O"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">SR No</label>
                                            <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                                <Input
                                                    value={multiEditData.srNo || ''}
                                                    onChange={(e) => setMultiEditData(prev => ({ ...prev, srNo: e.target.value.toUpperCase() }))}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            setMultiEditTouched(prev => {
                                                                const newSet = new Set(prev);
                                                                newSet.delete('srNo');
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Enter SR No"
                                                    className="pl-10 h-9 text-sm"
                                                />
                                            </InputWithIcon>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                        <div className="flex items-center space-x-2 px-2 h-8 bg-white border rounded-md shadow-sm">
                                            <Switch id="table-detailed-mode" checked={isDetailedMode} onCheckedChange={setIsDetailedMode} className="scale-75" />
                                            <Label htmlFor="table-detailed-mode" className="text-[10px] font-bold uppercase cursor-pointer text-slate-600">Detailed</Label>
                                        </div>
                                        <Button onClick={handlePrintReport} size="sm" className="h-8 text-[11px] font-bold uppercase tracking-tight px-3 bg-indigo-600 hover:bg-indigo-700">
                                            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print Report
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table wrapper with 3D shadow, rounded corners and border depth */}
            <Card className="border border-slate-300 bg-white shadow-[0_15px_35px_-5px_rgba(0,0,0,0.1),_0_5px_15px_-3px_rgba(0,0,0,0.05)] rounded-xl overflow-hidden transition-all duration-300 relative after:absolute after:inset-0 after:rounded-xl after:border after:border-white/40 after:pointer-events-none">
                {isFilterPending && (
                    <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-xl">
                        <div className="flex items-center gap-2.5 bg-white/90 border border-slate-200/80 rounded-xl px-5 py-3 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05)] backdrop-blur-md">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                            <span className="text-sm font-semibold text-slate-700 tracking-wide">Applying Filters...</span>
                        </div>
                    </div>
                )}
                <CardContent className="p-0">
                    <ScrollArea ref={scrollRef} className="h-[40vh]">
                        <div className="overflow-x-auto relative" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                            <table ref={tableRef} className="w-full text-[11px] border-collapse border-0 border-spacing-0 m-0 p-0 shadow-inner">
                            <thead className="sticky top-0 z-20 bg-slate-200 m-0 p-0">
                                {/* Sticky Total Row at Top, above column headers */}
                                {hasData && totals && (
                                    <tr className="bg-gradient-to-b from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 border-b border-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),_0_2px_4px_rgba(0,0,0,0.04)] font-bold text-slate-800 h-[34px] transition-all">
                                        <td className="p-1.5 bg-slate-50/95 sticky left-0 z-30 border-r border-slate-300 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="h-6 w-6 p-0 hover:bg-slate-300"
                                            >
                                                {selectedSuppliers.size === suppliers.length && suppliers.length > 0 ? (
                                                    <CheckSquare className="h-3.5 w-3.5 text-slate-700" />
                                                ) : (
                                                    <Square className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </td>
                                        <td className="p-1.5 text-center font-bold text-slate-800 uppercase sticky left-[35px] bg-slate-50/95 z-30 border-r border-slate-300">
                                            TOTAL
                                        </td>
                                        <td className="p-1.5 text-center text-slate-700 text-[10px] border-r border-slate-300">-</td>
                                        {isDetailedMode && <td className="p-1.5 text-center text-slate-700 text-[10px] border-r border-slate-300">-</td>}
                                        <td className="p-1.5 text-[11px] font-bold text-slate-800 text-left border-r border-slate-300">
                                            Summary ({suppliers.length} Entries)
                                        </td>
                                        {isDetailedMode && (
                                            <>
                                                <td className="p-1.5 text-center text-[11px] font-bold text-slate-800 border-r border-slate-300 leading-none">
                                                    <div>Min-Max Rate:</div>
                                                    <div className="text-rose-600 font-bold">₹{Math.round(totals.minRate).toLocaleString('en-IN')}-₹{Math.round(totals.maxRate).toLocaleString('en-IN')}</div>
                                                </td>
                                                <td className="p-1.5 text-left text-slate-700 text-[10px] border-r border-slate-300">-</td>
                                                <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">{totals.grossWt.toFixed(2)}</td>
                                                <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">-{totals.teirWt.toFixed(2)}</td>
                                            </>
                                        )}
                                        <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">{totals.weight.toFixed(2)}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">-{totals.kartaWt.toFixed(2)}</td>
                                        <td className="p-1.5 text-right text-blue-600 font-bold border-r border-slate-300">{totals.netWt.toFixed(2)}</td>
                                        <td className="p-1.5 text-right text-slate-600 font-semibold border-r border-slate-300">
                                            Avg: ₹{Math.round(totals.rateAvg).toLocaleString('en-IN')}
                                        </td>
                                        <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">₹{totals.amount.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">₹{totals.kartaAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-blue-700 font-bold border-r border-slate-300">₹{totals.afterKartaAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">₹{totals.labouryAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-rose-600 font-bold border-r border-slate-300">₹{totals.kanta.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-slate-900 font-bold border-r border-slate-300">₹{totals.netAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-right text-orange-600 font-bold border-r border-slate-300">₹{totals.cdAmt.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                                        <td className="p-1.5 text-[12px] font-bold text-right text-emerald-600 border-r border-slate-300">
                                            ₹{totals.finalNet.toLocaleString('en-IN', {maximumFractionDigits:0})}
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
                                    {isDetailedMode && <th className="p-1.5 text-center border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[4%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Term</th>}
                                    <th className="p-1.5 text-left border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[14%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">{isDetailedMode ? 'Name / S/O' : 'Entries'}</th>
                                    {isDetailedMode && (
                                        <>
                                            <th className="p-1.5 text-left border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[12%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Address / Contact</th>
                                            <th className="p-1.5 text-left border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Vehicle</th>
                                            <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Gross</th>
                                            <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Teir</th>
                                        </>
                                    )}
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Final</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[5%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Karta</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Net</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[6%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Rate</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[7%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Amount</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[5%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Karta Amt</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[7%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">After Karta</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[5%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Laboury</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[5%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Kanta</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[7%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Net Payable</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 w-[5%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">CD Amt</th>
                                    <th className="p-1.5 text-right border-b border-r border-slate-300 bg-gradient-to-b from-slate-200 to-slate-250 text-slate-800 font-bold w-[9%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Final Net</th>
                                    <th className="p-1.5 text-center border-b border-slate-300 bg-gradient-to-b from-slate-200 to-slate-300 sticky right-0 z-20 w-[4%] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody ref={tbodyRef}>
                                {hasData ? displaySuppliers.map((supplier, index) => {
                                    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]') || (e.target as HTMLElement).closest('[role="menuitem"]') || (e.target as HTMLElement).closest('[role="menu"]')) {
                                            return;
                                        }
                                        if (isDragging || hasDraggedRef.current) {
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
                                            if (onViewDetails && !isDragging) {
                                                onViewDetails(supplier);
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
                                            if (!supplier.isGrouped) handleEditSingleInImportMode(supplier);
                                        } else if (onEditSupplier) {
                                            onEditSupplier(supplier);
                                        }
                                    };
                                    const isHighlighted = highlightEntryId === supplier.id;

                                    if (supplier.isGrouped) {
                                        const afterKartaAmount = supplier.amount - supplier.kartaAmount;
                                        const cdAmount = afterKartaAmount * 0.01;
                                        const finalNet = afterKartaAmount - cdAmount - supplier.labouryAmount - supplier.kanta;
                                        return (
                                            <tr 
                                                key={supplier.id || index} 
                                                className="border-b border-slate-300 bg-slate-50/50 hover:bg-slate-100 h-[29px] font-medium"
                                                onClick={handleRowClick}
                                            >
                                                <td className="p-1.5 w-8 align-middle sticky left-0 bg-inherit z-10 border-r border-slate-300">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Avoid triggering row edit click
                                                            handleSelectGroup(supplier.id);
                                                        }}
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        {isGroupSelected(supplier.id) ? (
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
                                                    {format(new Date(supplier.date), 'dd-MMM')}
                                                </td>
                                                <td className="p-1.5 align-middle text-left leading-normal text-blue-700 font-bold border-r border-slate-300">
                                                    {supplier.name}
                                                </td>
                                                <td className="p-1.5 text-right font-mono text-slate-900 font-bold border-r border-slate-300">{supplier.weight.toFixed(2)}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 border-r border-slate-300">-{supplier.kartaWeight.toFixed(2)}</td>
                                                <td className="p-1.5 text-right font-mono text-blue-600 font-bold border-r border-slate-300">{supplier.netWeight.toFixed(2)}</td>
                                                <td className="p-1.5 text-right font-mono text-slate-500 border-r border-slate-300">@ ₹{Math.round(supplier.rate).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-slate-900 font-semibold border-r border-slate-300">₹{Math.round(supplier.amount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 font-semibold border-r border-slate-300">₹{Math.round(supplier.kartaAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-blue-700 font-bold border-r border-slate-300">₹{Math.round(afterKartaAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 border-r border-slate-300">₹{Math.round(supplier.labouryAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-rose-600 border-r border-slate-300">₹{Math.round(supplier.kanta).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-slate-900 font-semibold border-r border-slate-300">₹{Math.round(Number(supplier.netAmount)).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-orange-600 border-r border-slate-300">₹{Math.round(cdAmount).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 text-right font-mono text-emerald-600 font-bold border-r border-slate-300">₹{Math.round(finalNet).toLocaleString('en-IN')}</td>
                                                <td className="p-1.5 sticky right-0 bg-inherit z-10 border-l border-slate-300" />
                                            </tr>
                                        );
                                    }

                                    return (
                                    <tr 
                                        id={`entry-row-${supplier.id}`}
                                        key={supplier.id} 
                                        className={`border-b border-slate-300 hover:bg-slate-50/50 h-auto cursor-pointer ${isHighlighted ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
                                        onClick={handleRowClick}
                                        onDoubleClick={handleRowDoubleClick}
                                    >
                                        <td className="p-1.5 w-8 align-middle sticky left-0 bg-inherit z-10 border-r border-slate-300">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSelectSupplier(supplier.id)}
                                                className="h-6 w-6 p-0"
                                            >
                                                {selectedSuppliers.has(supplier.id) ? (
                                                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                                ) : (
                                                    <Square className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </td>
                                        <td className="p-1.5 align-middle sticky left-[35px] bg-inherit z-10 font-bold font-mono border-r border-slate-300">
                                            {supplier.srNo}
                                        </td>
                                        <td className="p-1.5 text-center align-middle border-r border-slate-300">
                                            {format(new Date(supplier.date), 'dd-MMM')}
                                        </td>
                                        <td className="p-1.5 text-center align-middle font-mono border-r border-slate-300">
                                            {supplier.term || '-'}
                                        </td>
                                        <td className="p-1.5 align-middle text-left leading-normal border-r border-slate-300">
                                            <div className="font-bold text-[12px] text-slate-800 truncate max-w-[140px]" title={supplier.name}>
                                                {supplier.name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={supplier.so || supplier.fatherName}>
                                                S/O: {supplier.so || supplier.fatherName || '-'}
                                            </div>
                                        </td>
                                        <td className="p-1.5 align-middle text-left leading-normal border-r border-slate-300">
                                            <div className="text-[11px] text-slate-600 font-medium">
                                                {supplier.address || '-'}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono">
                                                {supplier.contact || '-'}
                                            </div>
                                        </td>
                                        <td className="p-1.5 align-middle text-left leading-normal font-mono font-bold text-violet-700 uppercase border-r border-slate-300">
                                            {supplier.vehicleNo || '-'}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-800 border-r border-slate-300">
                                            {Number(supplier.grossWeight || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-500 border-r border-slate-300">
                                            -{Number(supplier.teirWeight || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-900 font-bold border-r border-slate-300">
                                            {Number(supplier.weight || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-rose-600 border-r border-slate-300">
                                            -{Number(supplier.kartaWeight || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-blue-600 font-bold border-r border-slate-300">
                                            {Number(supplier.netWeight || 0).toFixed(2)}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-500 border-r border-slate-300">
                                            @ ₹{Number(supplier.rate || 0).toLocaleString('en-IN')}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-900 font-semibold border-r border-slate-300">
                                            ₹{Number(supplier.amount || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-rose-600 font-semibold border-r border-slate-300">
                                            ₹{Number(supplier.kartaAmount || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-blue-700 font-bold border-r border-slate-300">
                                            ₹{Number(Number(supplier.amount || 0) - Number(supplier.kartaAmount || 0)).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-rose-600 border-r border-slate-300">
                                            ₹{Number(supplier.labouryAmount || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-rose-600 border-r border-slate-300">
                                            ₹{Number(supplier.kanta || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-slate-900 font-semibold border-r border-slate-300">
                                            ₹{Number(supplier.netAmount || 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-orange-600 border-r border-slate-300">
                                            ₹{Number((Number(supplier.amount || 0) - Number(supplier.kartaAmount || 0)) * 0.01).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="p-1.5 align-middle text-right font-mono text-emerald-600 font-bold border-r border-slate-300">
                                            ₹{Number(Number(supplier.amount || 0) - Number(supplier.kartaAmount || 0) - (Number(supplier.amount || 0) - Number(supplier.kartaAmount || 0)) * 0.01 - Number(supplier.labouryAmount || 0) - Number(supplier.kanta || 0)).toLocaleString('en-IN', {maximumFractionDigits:0})}
                                        </td>
                                        <td className="text-center p-1.5 align-middle sticky right-0 bg-inherit z-10 border-l border-slate-300">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                        <MoreVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => isImportMode ? handleEditSingleInImportMode(supplier) : onEditSupplier(supplier)}>
                                                        <Edit2 className="mr-2 h-3.5 w-3.5" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onViewDetails?.(supplier)}>
                                                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onPrintSupplier?.(supplier)}>
                                                        <Printer className="mr-2 h-3.5 w-3.5" /> Print
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => handleDelete(supplier.id)}>
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
                            {/* Drag selection box overlay */}
                            {isDragging && dragStart && dragEnd && (
                                <div
                                    className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-10"
                                    style={{
                                        left: `${Math.min(dragStart.x, dragEnd.x)}px`,
                                        top: `${Math.min(dragStart.y, dragEnd.y)}px`,
                                        width: `${Math.abs(dragEnd.x - dragStart.x)}px`,
                                        height: `${Math.abs(dragEnd.y - dragStart.y)}px`,
                                    }}
                                />
                            )}
                        </div>
                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
};

export const SimpleSupplierTable = memo(SimpleSupplierTableComponent);


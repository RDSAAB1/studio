"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { deleteSupplier, updateSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Edit2, Trash2, Save, X, Eye, Printer, CheckSquare, Square, User, UserSquare, Home, Truck, Wheat, Banknote, Percent, Weight, Hash, Calendar, FileText, PhoneCall } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, OptionItem } from "@/lib/definitions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

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
}

export const SimpleSupplierTable = ({ onBackToEntry, onEditSupplier, onViewDetails, onPrintSupplier, onMultiPrint, onMultiDelete, suppliers, totalCount, isLoading = false, varietyOptions, paymentTypeOptions }: SimpleSupplierTableProps) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
    const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const lastClickTimeRef = React.useRef<number>(0);
    
    // Infinite scroll pagination - moved to top to be available for drag handlers
    const { visibleItems, hasMore, isLoading: isLoadingMore, scrollRef } = useInfiniteScroll(suppliers, {
        totalItems: suppliers.length,
        initialLoad: 30,
        loadMore: 30,
        threshold: 5,
        enabled: suppliers.length > 30,
    });

    const displaySuppliers = suppliers.slice(0, visibleItems);
    
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
    
    const [isMultiDeleting, setIsMultiDeleting] = useState(false);
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
            await deleteSupplier(supplierId);
            toast({ 
                title: "Entry deleted successfully!", 
                description: "Supplier entry and associated payments have been removed.",
                variant: "success"
            });
        } catch (error) {
            console.error('Error deleting supplier:', error);
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

                    if (shouldUpdateCustomerId.name || shouldUpdateCustomerId.so || updateData.contact) {
                        const nextName = updateData.name ?? supplier.name ?? '';
                        const nextSo = updateData.so ?? supplier.so ?? '';
                        updateData.customerId = `${toTitleCase(nextName).toLowerCase()}|${toTitleCase(nextSo).toLowerCase()}`;
                    }
                    
                    // Only update if there's data to update
                    if (Object.keys(updateData).length > 0) {
                        console.log('Updating supplier:', supplier.id, updateData);
                        const updateResult = await updateSupplier(supplier.id, updateData);
                        console.log('Update result:', updateResult);
                        
                        if (updateResult) {
                            successCount++;
                            try {
                                await db.suppliers.put({ ...supplier, ...updateData });
                            } catch (localError) {
                                console.error('Failed to update local cache for supplier', supplier.id, localError);
                            }
                        } else {
                            errorCount++;
                        }
                    }
                } catch (error) {
                    console.error('Error updating supplier:', supplier.id, error);
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
            console.error('Error in multi-edit save:', error);
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
            toast({
                title: "Print Preview",
                description: `Printing ${selectedSuppliersList.length} suppliers`,
            });
        }
    };

    const handleMultiDelete = async () => {
        if (selectedSuppliers.size === 0) return;
        
        try {
            setIsMultiDeleting(true);
            const selectedSuppliersList = suppliers.filter(s => selectedSuppliers.has(s.id));
            const supplierIds = selectedSuppliersList.map(s => s.id);
            
            if (onMultiDelete) {
                await onMultiDelete(supplierIds);
            }
            
            setSelectedSuppliers(new Set());
        } catch (error) {
            console.error('Error in multi-delete:', error);
            toast({
                title: "Error",
                description: "Failed to delete entries",
                variant: "destructive",
            });
        } finally {
            setIsMultiDeleting(false);
        }
    };

    // Always show table structure
    const hasData = suppliers && suppliers.length > 0;

    return (
        <div className="space-y-4">
            {/* Multi-select Controls */}
            {hasData && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="h-8 px-3"
                        >
                            {selectedSuppliers.size === suppliers.length ? (
                                <CheckSquare className="h-4 w-4 mr-1" />
                            ) : (
                                <Square className="h-4 w-4 mr-1" />
                            )}
                            {selectedSuppliers.size === suppliers.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        
                        {selectedSuppliers.size > 0 && (
                            <>
                                <span className="text-sm text-muted-foreground">
                                    {selectedSuppliers.size} selected
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMultiEdit}
                                    className="h-8 px-3 text-blue-600 hover:text-blue-700"
                                >
                                    <Edit2 className="h-4 w-4 mr-1" />
                                    Edit Selected
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMultiPrint}
                                    className="h-8 px-3 text-green-600 hover:text-green-700"
                                >
                                    <Printer className="h-4 w-4 mr-1" />
                                    Print Selected
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleMultiDelete}
                                    disabled={isMultiDeleting}
                                    className="h-8 px-3 text-red-600 hover:text-red-700"
                                >
                                    {isMultiDeleting ? (
                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 mr-1" />
                                    )}
                                    Delete Selected
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Multi-Edit Form */}
            {isMultiEditing && selectedSuppliers.size > 0 && (
                <Card className="bg-card/70 backdrop-blur-sm border-2 border-primary/30 shadow-lg">
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold">
                                Multi-Edit Mode ({selectedSuppliers.size} entries selected)
                            </CardTitle>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleMultiEditSave}
                                    className="h-8 rounded-md"
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
                                    variant="outline"
                                    onClick={handleMultiEditCancel}
                                    className="h-8 rounded-md"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="space-y-4">
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

                            {/* Calculation Details Row - Note: Gross Weight, Teir Weight, and Rate are NOT editable in multi-edit mode (they remain individual to each entry) */}
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
                                            setMultiEditData(prev => ({ ...prev, date: next || undefined }));
                                            if (next) {
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
                                            setMultiEditData(prev => ({ ...prev, term: value ? Number(value) : undefined }));
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
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <ScrollArea ref={scrollRef} className="h-96">
                        <div className="overflow-x-auto relative" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                            <table ref={tableRef} className="w-full text-sm min-w-[1200px]">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-8"></th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">SR No</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Date</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-32">Name</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-24">SO</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-40">Address</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Final Wt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Karta Wt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Net Wt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Rate</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Amount</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Karta Amt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Lab Amt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Brokerage Amt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Kanta</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Net Amt</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody ref={tbodyRef}>
                                {hasData ? displaySuppliers.map((supplier, index) => {
                                    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                                        // Prevent row click if clicking on buttons or checkbox
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
                                            return;
                                        }
                                        
                                        // Don't trigger click if drag selection happened
                                        if (isDragging || hasDraggedRef.current) {
                                            return;
                                        }
                                        
                                        const currentTime = Date.now();
                                        const timeSinceLastClick = currentTime - lastClickTimeRef.current;
                                        
                                        // Clear any pending single click
                                        if (clickTimeoutRef.current) {
                                            clearTimeout(clickTimeoutRef.current);
                                            clickTimeoutRef.current = null;
                                        }
                                        
                                        // If double click happened recently (within 300ms), skip single click
                                        if (timeSinceLastClick < 300) {
                                            lastClickTimeRef.current = 0;
                                            return;
                                        }
                                        
                                        // Set last click time
                                        lastClickTimeRef.current = currentTime;
                                        
                                        // Delay single click to detect double click
                                        clickTimeoutRef.current = setTimeout(() => {
                                            // Single click - show details (only if not dragging)
                                            if (onViewDetails && !isDragging) {
                                                onViewDetails(supplier);
                                            }
                                            clickTimeoutRef.current = null;
                                        }, 300);
                                    };
                                    
                                    const handleRowDoubleClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
                                        // Prevent row double click if clicking on buttons or checkbox
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
                                            return;
                                        }
                                        
                                        // Clear pending single click
                                        if (clickTimeoutRef.current) {
                                            clearTimeout(clickTimeoutRef.current);
                                            clickTimeoutRef.current = null;
                                        }
                                        
                                        // Reset last click time
                                        lastClickTimeRef.current = 0;
                                        
                                        // Double click - edit and focus form
                                        if (onEditSupplier) {
                                            onEditSupplier(supplier);
                                        }
                                    };
                                    
                                    return (
                                    <tr 
                                        key={supplier.id} 
                                        className="border-b hover:bg-muted/30 h-8 cursor-pointer"
                                        onClick={handleRowClick}
                                        onDoubleClick={handleRowDoubleClick}
                                    >
                                        <td className="p-1 text-xs w-8">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSelectSupplier(supplier.id)}
                                                className="h-6 w-6 p-0"
                                            >
                                                {selectedSuppliers.has(supplier.id) ? (
                                                    <CheckSquare className="h-3 w-3 text-primary" />
                                                ) : (
                                                    <Square className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </td>
                                        <td className="p-1 text-xs w-20 font-mono">
                                            {supplier.srNo}
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            {format(new Date(supplier.date), 'dd/MM/yy')}
                                        </td>
                                        <td className="p-1 text-xs w-32">
                                                <span className="text-xs truncate block">{supplier.name}</span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                                <span className="text-xs truncate block">{supplier.so}</span>
                                        </td>
                                        <td className="p-1 text-xs w-40">
                                                <span className="text-xs truncate block">{supplier.address}</span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {Number(supplier.weight || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                                <span className="text-xs font-medium">
                                                    {Number(supplier.kartaWeight || 0).toFixed(2)}
                                                </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {Number(supplier.netWeight || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                                <span className="text-xs font-medium">
                                                    ₹{Number(supplier.rate || 0).toFixed(2)}
                                                </span>
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs font-bold">
                                                ₹{Number(supplier.amount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs">
                                                ₹{Number(supplier.kartaAmount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs">
                                                ₹{Number(supplier.labouryAmount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs">
                                                ₹{Number(supplier.brokerageAmount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                                <span className="text-xs">{supplier.kanta}</span>
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs font-bold">
                                                ₹{Number(supplier.netAmount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <div className="flex items-center gap-0.5">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-purple-600 hover:text-purple-700"
                                                            onClick={() => onEditSupplier(supplier)}
                                                            title="Edit in Form"
                                                        >
                                                            <Edit2 className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
                                                            onClick={() => onViewDetails?.(supplier)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-purple-600 hover:text-purple-700"
                                                            onClick={() => onPrintSupplier?.(supplier)}
                                                            title="Print Supplier"
                                                        >
                                                            <Printer className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                                            onClick={() => handleDelete(supplier.id)}
                                                            disabled={isDeleting}
                                                            title="Delete Supplier"
                                                        >
                                                            {isDeleting ? (
                                                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-2.5 w-2.5" />
                                                            )}
                                                        </Button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={15} className="text-center py-8">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-sm text-muted-foreground">No data available</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {hasData && isLoadingMore && (
                                    <tr>
                                        <td colSpan={17} className="text-center py-4">
                                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                            <span className="ml-2 text-sm text-muted-foreground">Loading more entries...</span>
                                        </td>
                                    </tr>
                                )}
                                {hasData && !hasMore && suppliers.length > 30 && (
                                    <tr>
                                        <td colSpan={17} className="text-center py-2 text-xs text-muted-foreground">
                                            Showing all {suppliers.length} entries
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-100">
                                {hasData && (
                                    <tr className="text-xs font-bold text-gray-700">
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.weight) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.kartaWeight) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.netWeight) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.rate) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.kartaAmount) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.labouryAmount) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.brokerageAmount) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.kanta) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">
                                            {Number(suppliers.reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0)).toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                        <td className="px-2 py-1 text-center border border-gray-300">-</td>
                                    </tr>
                                )}
                            </tfoot>
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
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { deleteSupplier, updateSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Edit2, Trash2, Save, X, Eye, Printer, CheckSquare, Square, User, UserSquare, Home, Truck, Wheat, Banknote, Percent, Weight, Hash, Calendar, FileText, PhoneCall } from "lucide-react";
import { toTitleCase } from "@/lib/utils";
import { format } from "date-fns";
import type { Customer, OptionItem } from "@/lib/definitions";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

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
    onLoadMore?: () => void;
    showLoadMore?: boolean;
    currentLimit?: number;
    varietyOptions: OptionItem[];
    paymentTypeOptions: OptionItem[];
}

export const SimpleSupplierTable = ({ onBackToEntry, onEditSupplier, onViewDetails, onPrintSupplier, onMultiPrint, onMultiDelete, suppliers, totalCount, isLoading = false, onLoadMore, showLoadMore = false, currentLimit = 0, varietyOptions, paymentTypeOptions }: SimpleSupplierTableProps) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<Customer>>({});
    const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
    const [isMultiDeleting, setIsMultiDeleting] = useState(false);
    const [isMultiEditing, setIsMultiEditing] = useState(false);
    const [isMultiSaving, setIsMultiSaving] = useState(false);
    const [multiEditData, setMultiEditData] = useState<Partial<Customer>>({});
    const [multiEditTouched, setMultiEditTouched] = useState<Set<string>>(new Set());

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

    const handleEdit = (index: number) => {
        if (suppliers && suppliers[index]) {
            setEditingRow(index);
            setEditData({ ...suppliers[index] });
        }
    };

    const handleSave = async (index: number) => {
        if (!suppliers || !suppliers[index]) {
            toast({ 
                title: "Error", 
                description: "Supplier data not found.",
                variant: "destructive" 
            });
            return;
        }
        
        if (!editData || Object.keys(editData).length === 0) {
            toast({ 
                title: "No changes", 
                description: "Please make some changes before saving.",
                variant: "default"
            });
            setEditingRow(null);
            setEditData({});
            return;
        }
        
        const supplier = suppliers[index];
        
        if (!supplier.id) {
            toast({ 
                title: "Error", 
                description: "Supplier ID is missing. Cannot update.",
                variant: "destructive" 
            });
            return;
        }
        
        try {
            // Remove 'id' from editData if present (shouldn't be updated)
            const { id: _, ...updateData } = editData;
            
            console.log('Updating supplier:', supplier.id, 'with data:', updateData);
            const success = await updateSupplier(supplier.id, updateData);
            
            if (success) {
                setEditingRow(null);
                setEditData({});
                
                toast({ 
                    title: "Entry updated successfully!", 
                    description: "Supplier entry has been updated.",
                    variant: "success"
                });
            } else {
                throw new Error('Update function returned false');
            }
        } catch (error: any) {
            console.error('Error updating supplier:', error);
            toast({ 
                title: "Error updating entry", 
                description: error?.message || "Failed to update supplier entry. Please try again.",
                variant: "destructive" 
            });
        }
    };

    const handleCancel = () => {
        setEditingRow(null);
        setEditData({});
    };

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
                    
                    if (multiEditTouched.has('name')) {
                        updateData.name = multiEditData.name?.trim() || '';
                    }
                    if (multiEditTouched.has('fatherName')) {
                        updateData.fatherName = multiEditData.fatherName?.trim() || '';
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
                    // Note: grossWeight, teirWeight, and rate are NOT editable in multi-edit mode
                    // They remain individual to each entry
                    if (multiEditTouched.has('kartaPercentage')) {
                        updateData.kartaPercentage = multiEditData.kartaPercentage;
                    }
                    if (multiEditTouched.has('labouryRate')) {
                        updateData.labouryRate = multiEditData.labouryRate;
                    }
                    if (multiEditTouched.has('brokerageRate')) {
                        updateData.brokerageRate = multiEditData.brokerageRate;
                    }
                    if (multiEditTouched.has('brokerageAddSubtract')) {
                        updateData.brokerageAddSubtract = multiEditData.brokerageAddSubtract;
                    }
                    if (multiEditTouched.has('kanta')) {
                        updateData.kanta = multiEditData.kanta;
                    }
                    if (multiEditTouched.has('date')) {
                        updateData.date = (multiEditData.date as string) || supplier.date;
                    }
                    if (multiEditTouched.has('term')) {
                        updateData.term = multiEditData.term?.trim() || supplier.term || '';
                    }
                    // Auto-compute dueDate from (date, term) - prefer multi-edit values, else supplier values
                    if (multiEditTouched.has('date') || multiEditTouched.has('term')) {
                        const baseDateStr = (multiEditTouched.has('date') ? (multiEditData.date as string) : supplier.date) as string;
                        const termStr = (multiEditTouched.has('term') ? (multiEditData.term as string) : (supplier.term as string)) || '0';
                        try {
                            const base = new Date(baseDateStr);
                            const days = parseInt(termStr || '0', 10) || 0;
                            const due = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
                            updateData.dueDate = format(due, 'yyyy-MM-dd');
                        } catch {}
                    }
                    if (multiEditTouched.has('so')) {
                        updateData.so = multiEditData.so?.trim() || '';
                    }
                    if (multiEditTouched.has('srNo')) {
                        updateData.srNo = multiEditData.srNo?.trim() || '';
                    }
                    
                    // RECALCULATE dependent fields if any calculation-affecting field was changed
                    // Note: grossWeight, teirWeight, rate always use supplier's existing values (not editable in multi-edit)
                    const needsRecalculation = 
                        multiEditTouched.has('kartaPercentage') || 
                        multiEditTouched.has('labouryRate') || 
                        multiEditTouched.has('brokerageRate') || 
                        multiEditTouched.has('brokerageAddSubtract') || 
                        multiEditTouched.has('kanta');
                    
                    if (needsRecalculation) {
                        // Always use supplier's existing grossWeight, teirWeight, and rate (these are NOT editable in multi-edit)
                        const grossWeight = supplier.grossWeight ?? 0;
                        const teirWeight = supplier.teirWeight ?? 0;
                        const rate = supplier.rate ?? 0;
                        
                        // Get calculation-affecting values (use multi-edit values if touched, else use supplier's existing values)
                        const kartaPercentage = multiEditTouched.has('kartaPercentage') 
                            ? (multiEditData.kartaPercentage ?? supplier.kartaPercentage ?? 0)
                            : (supplier.kartaPercentage ?? 0);
                        const labouryRate = multiEditTouched.has('labouryRate') 
                            ? (multiEditData.labouryRate ?? supplier.labouryRate ?? 0)
                            : (supplier.labouryRate ?? 0);
                        const brokerageRate = multiEditTouched.has('brokerageRate') 
                            ? (multiEditData.brokerageRate ?? supplier.brokerageRate ?? 0)
                            : (supplier.brokerageRate ?? 0);
                        const brokerageAddSubtract = multiEditTouched.has('brokerageAddSubtract') 
                            ? (multiEditData.brokerageAddSubtract ?? supplier.brokerageAddSubtract ?? true)
                            : (supplier.brokerageAddSubtract ?? true);
                        const kanta = multiEditTouched.has('kanta') 
                            ? (multiEditData.kanta ?? supplier.kanta ?? 0)
                            : (supplier.kanta ?? 0);
                        
                        // Calculate all dependent values
                        const finalWeight = Number(grossWeight) - Number(teirWeight);
                        const rawKartaWt = (finalWeight * Number(kartaPercentage)) / 100;
                        const kartaWeight = Math.round(rawKartaWt * 100) / 100;
                        const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100;
                        
                        const amount = Math.round(finalWeight * Number(rate) * 100) / 100;
                        const kartaAmount = Math.round(kartaWeight * Number(rate) * 100) / 100;
                        const labouryAmount = Math.round(finalWeight * Number(labouryRate) * 100) / 100;
                        
                        // Brokerage calculation: brokerageRate * netWeight
                        const brokerageAmount = Math.round(Number(brokerageRate || 0) * netWeight * 100) / 100;
                        const signedBrokerage = brokerageAddSubtract ? brokerageAmount : -brokerageAmount;
                        
                        const netAmount = Math.round((amount - kartaAmount - labouryAmount - Number(kanta) + signedBrokerage) * 100) / 100;
                        
                        // Add calculated fields to updateData
                        updateData.weight = finalWeight;
                        updateData.kartaWeight = kartaWeight;
                        updateData.netWeight = netWeight;
                        updateData.amount = amount;
                        updateData.kartaAmount = kartaAmount;
                        updateData.labouryAmount = labouryAmount;
                        updateData.brokerageAmount = brokerageAmount;
                        // Also save brokerageRate if it was used in calculation
                        if (multiEditTouched.has('brokerageRate') || needsRecalculation) {
                            updateData.brokerageRate = brokerageRate;
                        }
                        updateData.originalNetAmount = netAmount;
                        updateData.netAmount = netAmount;
                    }
                    
                    // Only update if there's data to update
                    if (Object.keys(updateData).length > 0) {
                        console.log('Updating supplier:', supplier.id, updateData);
                        const updateResult = await updateSupplier(supplier.id, updateData);
                        console.log('Update result:', updateResult);
                        
                        if (updateResult) {
                            successCount++;
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

    // Show all suppliers (limited to 50 in entry form)
    const displaySuppliers = suppliers;

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
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, name: toTitleCase(e.target.value) }))}
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
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, fatherName: toTitleCase(e.target.value) }))}
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
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, address: toTitleCase(e.target.value) }))}
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
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, contact: e.target.value }))}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('contact');
                                                        return newSet;
                                                    });
                                                } else {
                                                    setMultiEditTouched(prev => new Set([...prev, 'contact']));
                                                }
                                            }}
                                            placeholder="Enter contact number"
                                            className="pl-10 h-9 text-sm"
                                            maxLength={10}
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
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, vehicleNo: e.target.value.toUpperCase() }))}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('vehicleNo');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter vehicle no"
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
                                        value={(multiEditData.variety as string) || null}
                                        onChange={(val) => {
                                            setMultiEditData(prev => ({ ...prev, variety: val || undefined }));
                                            setMultiEditTouched(prev => new Set([...prev, 'variety']));
                                        }}
                                        options={varietyOptions.map(o => ({ value: o.name, label: o.name }))}
                                        placeholder="Select variety"
                                    />
                                </div>
                            </div>

                            {/* Calculation Details Row - Note: Gross Weight, Teir Weight, and Rate are NOT editable in multi-edit mode (they remain individual to each entry) */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Karta %</label>
                                    <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                        <Input
                                            type="number"
                                            value={multiEditData.kartaPercentage || 0}
                                            onChange={(e) => {
                                                setMultiEditData(prev => ({ ...prev, kartaPercentage: Number(e.target.value) || 0 }));
                                                setMultiEditTouched(prev => new Set([...prev, 'kartaPercentage']));
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value || e.target.value === '0') {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('kartaPercentage');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter karta %"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </InputWithIcon>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Payment Type</label>
                                    <CustomDropdown
                                        value={(multiEditData.paymentType as string) || null}
                                        onChange={(val) => {
                                            setMultiEditData(prev => ({ ...prev, paymentType: val || undefined }));
                                            setMultiEditTouched(prev => new Set([...prev, 'paymentType']));
                                        }}
                                        options={paymentTypeOptions.map(o => ({ value: o.name, label: o.name }))}
                                        placeholder="Select payment type"
                                    />
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Brokerage Rate</label>
                                    <div className="flex gap-1">
                                        <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                            <Input
                                                type="number"
                                                value={multiEditData.brokerageRate || 0}
                                                onChange={(e) => {
                                                    setMultiEditData(prev => ({ ...prev, brokerageRate: Number(e.target.value) || 0 }));
                                                    setMultiEditTouched(prev => new Set([...prev, 'brokerageRate']));
                                                }}
                                                onBlur={(e) => {
                                                    if (!e.target.value || e.target.value === '0') {
                                                        setMultiEditTouched(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete('brokerageRate');
                                                            return newSet;
                                                        });
                                                    }
                                                }}
                                                placeholder="Enter brokerage rate"
                                                className="pl-10 h-9 text-sm flex-1"
                                            />
                                        </InputWithIcon>
                                        <Button
                                            type="button"
                                            variant={multiEditData.brokerageAddSubtract ? "default" : "outline"}
                                            size="sm"
                                            className="h-9 px-3 text-sm"
                                            onClick={() => {
                                                setMultiEditData(prev => ({ ...prev, brokerageAddSubtract: true }));
                                                setMultiEditTouched(prev => new Set([...prev, 'brokerageAddSubtract']));
                                            }}
                                        >
                                            +
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={!multiEditData.brokerageAddSubtract ? "default" : "outline"}
                                            size="sm"
                                            className="h-9 px-3 text-sm"
                                            onClick={() => {
                                                setMultiEditData(prev => ({ ...prev, brokerageAddSubtract: false }));
                                                setMultiEditTouched(prev => new Set([...prev, 'brokerageAddSubtract']));
                                            }}
                                        >
                                            -
                                        </Button>
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Kanta</label>
                                    <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                        <Input
                                            type="number"
                                            value={multiEditData.kanta || 0}
                                            onChange={(e) => {
                                                setMultiEditData(prev => ({ ...prev, kanta: Number(e.target.value) || 0 }));
                                                setMultiEditTouched(prev => new Set([...prev, 'kanta']));
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value || e.target.value === '0') {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('kanta');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter kanta"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </InputWithIcon>
                                </div>
                            </div>

                            {/* Additional Details Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Date</label>
                                    <InputWithIcon icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                                        <Input
                                            type="date"
                                            value={(multiEditData.date as string) || ''}
                                            onChange={(e) => {
                                                setMultiEditData(prev => ({ ...prev, date: e.target.value }));
                                                setMultiEditTouched(prev => new Set([...prev, 'date']));
                                            }}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('date');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Select date"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Term</label>
                                    <InputWithIcon icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                                        <Input
                                            value={multiEditData.term || ''}
                                            onChange={(e) => setMultiEditData(prev => ({ ...prev, term: e.target.value }))}
                                            onBlur={(e) => {
                                                if (!e.target.value.trim()) {
                                                    setMultiEditTouched(prev => {
                                                        const newSet = new Set(prev);
                                                        newSet.delete('term');
                                                        return newSet;
                                                    });
                                                }
                                            }}
                                            placeholder="Enter term"
                                            className="pl-10 h-9 text-sm"
                                        />
                                    </InputWithIcon>
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
                    <div className="h-96 overflow-y-auto overflow-x-auto">
                        <table className="w-full text-sm">
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
                            <tbody>
                                {hasData ? displaySuppliers.map((supplier, index) => (
                                    <tr key={supplier.id} className="border-b hover:bg-muted/30 h-8">
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
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.name || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-xs truncate block">{supplier.name}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.so || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, so: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs truncate block">{supplier.so}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-40">
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.address || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, address: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs truncate block">{supplier.address}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {Number(supplier.weight || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.kartaWeight || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, kartaWeight: Number(e.target.value) }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium">
                                                    {Number(supplier.kartaWeight || 0).toFixed(2)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {Number(supplier.netWeight || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.rate || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, rate: Number(e.target.value) }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium">
                                                    ₹{Number(supplier.rate || 0).toFixed(2)}
                                                </span>
                                            )}
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
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.kanta || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, kanta: Number(e.target.value) }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSave(index);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            handleCancel();
                                                        }
                                                    }}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs">{supplier.kanta}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-20">
                                            <span className="text-xs font-bold">
                                                ₹{Number(supplier.netAmount || 0).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <div className="flex items-center gap-0.5">
                                                {editingRow === index ? (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                                                        onClick={handleCancel}
                                                    >
                                                        <X className="h-3 w-3 mr-1" />
                                                        Cancel
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-blue-600 hover:text-blue-700"
                                                            onClick={() => handleEdit(index)}
                                                            title="Edit in Table"
                                                        >
                                                            <Edit2 className="h-2.5 w-2.5" />
                                                        </Button>
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
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={15} className="text-center py-8">
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="text-sm text-muted-foreground">No data available</span>
                                            </div>
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
                    </div>
                </CardContent>
            </Card>

            {/* Load More Button */}
            {showLoadMore && onLoadMore && (
                <div className="flex justify-center py-4">
                    <Button
                        variant="outline"
                        onClick={onLoadMore}
                        className="px-6"
                    >
                        Load More ({currentLimit} of {totalCount})
                    </Button>
                </div>
            )}
        </div>
    );
};
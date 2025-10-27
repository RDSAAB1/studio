"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { deleteSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2, Plus, ArrowLeft, Edit3, Check, X } from "lucide-react";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";

interface ExcelSupplierTableProps {
    onBackToEntry: () => void;
}

export const ExcelSupplierTable = ({ onBackToEntry }: ExcelSupplierTableProps) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null);
    const [editValue, setEditValue] = useState("");
    const [localData, setLocalData] = useState<Customer[]>([]);
    
    // Get all suppliers for Excel-like editing
    const suppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray(), []);
    const totalSuppliers = useLiveQuery(() => db.suppliers.count(), []);

    // Update local data when suppliers change
    useEffect(() => {
        if (suppliers) {
            setLocalData([...suppliers]);
        }
    }, [suppliers]);

    const handleCellClick = (row: number, field: string, value: any) => {
        setEditingCell({ row, field });
        setEditValue(String(value || ''));
    };

    const handleCellSave = async (row: number, field: string) => {
        if (!localData || !localData[row]) return;
        
        setIsSaving(true);
        try {
            const supplier = localData[row];
            const updatedSupplier = { ...supplier, [field]: editValue };
            
            // Update local data immediately for instant feedback
            const newData = [...localData];
            newData[row] = updatedSupplier;
            setLocalData(newData);
            
            // Update in database
            await db.suppliers.update(supplier.id, { [field]: editValue });
            
            setEditingCell(null);
            setEditValue("");
            
            toast({ 
                title: "Updated successfully", 
                description: `${field} updated for ${supplier.name}`,
                variant: "success"
            });
        } catch (error) {
            console.error("Error updating supplier:", error);
            toast({ 
                title: "Update failed", 
                description: "Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCellCancel = () => {
        setEditingCell(null);
        setEditValue("");
    };

    const handleDelete = async (id: string) => {
        setIsDeleting(true);
        try {
            await deleteSupplier(id);
            // Remove from local data
            setLocalData(prev => prev.filter(item => item.id !== id));
            toast({ 
                title: "Entry deleted successfully!", 
                description: "Supplier entry has been removed.",
                variant: "success"
            });
        } catch (error) {
            console.error("Error deleting supplier:", error);
            toast({ 
                title: "Failed to delete entry", 
                description: "Please try again.",
                variant: "destructive" 
            });
        } finally {
            setIsDeleting(false);
        }
    };

    if (!suppliers || localData.length === 0) {
        return (
            <div className="space-y-4">
                {/* Header Bar */}
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={onBackToEntry}
                                    className="h-8"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Entry
                                </Button>
                                <CardTitle className="text-lg">Excel Data View</CardTitle>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>Total: {totalSuppliers || 0} entries</span>
                                <span>Showing: 0 entries</span>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="flex justify-center items-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading suppliers...</span>
                </div>
            </div>
        );
    }

    const fields = [
        { key: 'srNo', label: 'SR No', width: 'w-20' },
        { key: 'date', label: 'Date', width: 'w-24' },
        { key: 'name', label: 'Name', width: 'w-32' },
        { key: 'so', label: 'SO', width: 'w-24' },
        { key: 'address', label: 'Address', width: 'w-40' },
        { key: 'contact', label: 'Contact', width: 'w-24' },
        { key: 'vehicleNo', label: 'Vehicle', width: 'w-24' },
        { key: 'variety', label: 'Variety', width: 'w-24' },
        { key: 'grossWeight', label: 'Gross Wt', width: 'w-20' },
        { key: 'teirWeight', label: 'Tier Wt', width: 'w-20' },
        { key: 'rate', label: 'Rate', width: 'w-20' },
        { key: 'kartaPercentage', label: 'Karta %', width: 'w-20' },
        { key: 'labouryRate', label: 'Lab Rate', width: 'w-20' },
        { key: 'kanta', label: 'Kanta', width: 'w-20' },
        { key: 'paymentType', label: 'Payment', width: 'w-24' },
    ];

    return (
        <div className="space-y-4">
            {/* Header Bar */}
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={onBackToEntry}
                                className="h-8"
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Entry
                            </Button>
                            <CardTitle className="text-lg">Excel Data View</CardTitle>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Total: {totalSuppliers || 0} entries</span>
                            <span>Showing: {localData.length} entries</span>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Excel-like Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div className="min-w-full">
                            {/* Header Row */}
                            <div className="flex bg-muted/50 border-b sticky top-0 z-10">
                                {fields.map((field) => (
                                    <div 
                                        key={field.key}
                                        className={`${field.width} p-2 text-xs font-semibold text-muted-foreground border-r last:border-r-0 flex-shrink-0`}
                                    >
                                        {field.label}
                                    </div>
                                ))}
                                <div className="w-20 p-2 text-xs font-semibold text-muted-foreground flex-shrink-0">
                                    Actions
                                </div>
                            </div>

                            {/* Data Rows */}
                            {localData.map((supplier, rowIndex) => (
                                <div key={supplier.id} className="flex border-b hover:bg-muted/30 group">
                                    {fields.map((field) => (
                                        <div 
                                            key={field.key}
                                            className={`${field.width} p-1 border-r last:border-r-0 flex-shrink-0 relative`}
                                        >
                                            {editingCell?.row === rowIndex && editingCell?.field === field.key ? (
                                                <div className="flex gap-1 items-center">
                                                    <Input
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        className="h-7 text-xs border-primary"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleCellSave(rowIndex, field.key);
                                                            } else if (e.key === 'Escape') {
                                                                handleCellCancel();
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                                        onClick={() => handleCellSave(rowIndex, field.key)}
                                                        disabled={isSaving}
                                                    >
                                                        <Check className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                                        onClick={handleCellCancel}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div 
                                                    className="h-7 px-2 py-1 text-xs cursor-pointer hover:bg-blue-50 rounded flex items-center group-hover:bg-blue-50 transition-colors"
                                                    onClick={() => handleCellClick(rowIndex, field.key, supplier[field.key as keyof Customer])}
                                                >
                                                    <span className="truncate">
                                                        {field.key === 'date' ? 
                                                            format(new Date(supplier.date), 'dd/MM/yy') :
                                                            supplier[field.key as keyof Customer] || '-'
                                                        }
                                                    </span>
                                                    <Edit3 className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50 transition-opacity" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div className="w-20 p-1 flex items-center justify-center">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(supplier.id)}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

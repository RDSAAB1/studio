"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { deleteSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Edit2, Trash2, Save, X, Eye, Printer, Search } from "lucide-react";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";

interface SimpleSupplierTableProps {
    onBackToEntry?: () => void;
    onEditSupplier: (supplier: Customer) => void;
    onViewDetails?: (supplier: Customer) => void;
    onPrintSupplier?: (supplier: Customer) => void;
    suppliers: Customer[];
    totalCount: number;
    isLoading?: boolean;
    onLoadMore?: () => void;
    showLoadMore?: boolean;
    currentLimit?: number;
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    searchSteps?: string[];
}

export const SimpleSupplierTable = ({ onBackToEntry, onEditSupplier, onViewDetails, onPrintSupplier, suppliers, totalCount, isLoading = false, onLoadMore, showLoadMore = false, currentLimit = 0, searchQuery = '', onSearchChange, searchSteps = [] }: SimpleSupplierTableProps) => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<Customer>>({});

    const handleEdit = (index: number) => {
        if (suppliers && suppliers[index]) {
            setEditingRow(index);
            setEditData({ ...suppliers[index] });
        }
    };

    const handleSave = async (index: number) => {
        if (!suppliers || !suppliers[index] || !editData) return;
        
        try {
            const supplier = suppliers[index];
            await db.suppliers.update(supplier.id, editData);
            
            setEditingRow(null);
            setEditData({});
            
            toast({ 
                title: "Updated successfully", 
                description: `${supplier.name} has been updated.`,
                variant: "success"
            });
        } catch (error) {
            console.error("Error updating supplier:", error);
            toast({ 
                title: "Update failed", 
                description: "Please try again.",
                variant: "destructive"
            });
        }
    };

    const handleCancel = () => {
        setEditingRow(null);
        setEditData({});
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        
        setIsDeleting(true);
        try {
            await deleteSupplier(id);
            toast({ 
                title: "Deleted successfully", 
                description: `${name} has been removed.`,
                variant: "success"
            });
        } catch (error) {
            console.error("Error deleting supplier:", error);
            toast({ 
                title: "Delete failed", 
                description: "Please try again.",
                variant: "destructive" 
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewDetails = (supplier: Customer) => {
        if (onViewDetails) {
            onViewDetails(supplier);
        } else {
            toast({ 
                title: "Supplier Details", 
                description: `Viewing details for ${supplier.name} (SR# ${supplier.srNo})` 
            });
        }
    };

    const handlePrintSupplier = (supplier: Customer) => {
        if (onPrintSupplier) {
            onPrintSupplier(supplier);
        } else {
            toast({ 
                title: "Print Supplier", 
                description: `Printing ${supplier.name} (SR# ${supplier.srNo})` 
            });
        }
    };

    // Show all suppliers (limited to 50 in entry form)
    const displaySuppliers = suppliers;

    // Always show search and table structure
    const hasData = suppliers && suppliers.length > 0;
    const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;

    return (
        <div className="space-y-4">
            {/* Search Input */}
            {onSearchChange && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input
                                type="text"
                                placeholder="Multi-step search: vehicle, address, name (separate with commas)"
                                value={searchQuery}
                                onChange={(e) => onSearchChange(e.target.value)}
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
                                <div className="text-xs text-muted-foreground">
                                    Each step filters the results from the previous step
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Simple Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-auto max-h-96 will-change-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">SR No</th>
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
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-16">Kanta</th>
                                    <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-20">Net Amt</th>
                                            <th className="p-1 text-left text-xs font-semibold text-muted-foreground w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hasData ? displaySuppliers.map((supplier, index) => (
                                    <tr key={supplier.id} className="border-b hover:bg-muted/30 h-8">
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.srNo || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, srNo: e.target.value }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="font-medium text-xs">{supplier.srNo}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            {editingRow === index ? (
                                                <Input
                                                    type="date"
                                                    value={editData.date || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs">{format(new Date(supplier.date), 'dd/MM/yy')}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-32">
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.name || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="font-medium text-xs truncate block">{supplier.name}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            {editingRow === index ? (
                                                <Input
                                                    value={editData.so || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, so: e.target.value }))}
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
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs truncate block">{supplier.address}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {supplier.weight?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.kartaWeight || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, kartaWeight: Number(e.target.value) }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs">{supplier.kartaWeight}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            <span className="text-xs font-medium">
                                                {supplier.netWeight?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.rate || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, rate: Number(e.target.value) }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs">{supplier.rate}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <span className="text-xs font-medium">
                                                ₹{supplier.amount?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <span className="text-xs">
                                                ₹{supplier.kartaAmount?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <span className="text-xs">
                                                ₹{supplier.labouryAmount?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-16">
                                            {editingRow === index ? (
                                                <Input
                                                    type="number"
                                                    value={editData.kanta || ''}
                                                    onChange={(e) => setEditData(prev => ({ ...prev, kanta: Number(e.target.value) }))}
                                                    className="h-6 text-xs"
                                                />
                                            ) : (
                                                <span className="text-xs">{supplier.kanta}</span>
                                            )}
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <span className="text-xs font-bold">
                                                ₹{supplier.netAmount?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td className="p-1 text-xs w-24">
                                            <div className="flex items-center gap-0.5">
                                                {editingRow === index ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
                                                            onClick={() => handleSave(index)}
                                                        >
                                                            <Save className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                                            onClick={handleCancel}
                                                        >
                                                            <X className="h-2.5 w-2.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-blue-600 hover:text-blue-700"
                                                            onClick={() => onEditSupplier(supplier)}
                                                            title="Edit Supplier"
                                                        >
                                                            <Edit2 className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-gray-600 hover:text-gray-700"
                                                            onClick={() => handleViewDetails(supplier)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-green-600 hover:text-green-700"
                                                            onClick={() => handlePrintSupplier(supplier)}
                                                            title="Print Supplier"
                                                        >
                                                            <Printer className="h-2.5 w-2.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0 text-red-600 hover:text-red-700"
                                                            onClick={() => handleDelete(supplier.id, supplier.name)}
                                                            disabled={isDeleting}
                                                            title="Delete Supplier"
                                                        >
                                                            <Trash2 className="h-2.5 w-2.5" />
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
                                                {hasSearchQuery ? (
                                                    <>
                                                        <Search className="h-8 w-8 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">
                                                            No entries found after {searchSteps.length} filter{searchSteps.length > 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Try removing some filters or using different search terms
                                                        </span>
                                                        {searchSteps.length > 0 && (
                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                <div className="font-medium">Applied filters:</div>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {searchSteps.map((step, index) => (
                                                                        <span key={index} className="px-1 py-0.5 bg-muted rounded text-xs">
                                                                            {index + 1}. "{step}"
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : isLoading ? (
                                                    <>
                                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">Loading data...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Search className="h-8 w-8 text-muted-foreground" />
                                                        <span className="text-sm text-muted-foreground">No data available</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Load More Button */}
            {showLoadMore && onLoadMore && (
                <div className="flex justify-center mt-4">
                    <Button
                        onClick={onLoadMore}
                        variant="outline"
                        size="sm"
                        className="h-8 px-6"
                    >
                        Load More ({currentLimit} of {totalCount})
                    </Button>
                </div>
            )}
        </div>
    );
};

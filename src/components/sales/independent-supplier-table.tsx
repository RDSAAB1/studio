"use client";

import { useState } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { deleteSupplier } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { EntryTable } from "./entry-table";
import { Loader2, Database, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const IndependentSupplierTable = () => {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Table gets its own data directly from database - only last 50 entries
    const suppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().limit(50).toArray(), []);
    const totalSuppliers = useLiveQuery(() => db.suppliers.count(), []);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleEdit = (id: string) => {
        // Table handles its own edit - could open edit dialog or navigate to edit page
        const supplier = suppliers?.find(s => s.id === id);
        if (supplier) {
            toast({ 
                title: "Edit Supplier", 
                description: `Edit functionality for ${supplier.name} (SR# ${supplier.srNo})` 
            });
            // Here you could open an edit dialog or navigate to edit page
        }
    };

    const handleDelete = async (id: string) => {
        setIsDeleting(true);
        try {
            await deleteSupplier(id);
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

    const handleShowDetails = (supplier: any) => {
        toast({ 
            title: "Supplier Details", 
            description: `Details for ${supplier.name} (SR# ${supplier.srNo})` 
        });
        // Here you could open a details dialog
    };

    const handlePrintRow = (supplier: any) => {
        toast({ 
            title: "Print Receipt", 
            description: `Printing receipt for ${supplier.name} (SR# ${supplier.srNo})` 
        });
        // Here you could open print dialog
    };

    if (!suppliers) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading suppliers...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Entry and Data Count Bar */}
            <Card className="bg-muted/50 border-primary/20">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Showing:</span>
                                <span className="text-sm text-muted-foreground">
                                    {suppliers ? suppliers.length : 0} entries
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Total:</span>
                                <span className="text-sm text-muted-foreground">
                                    {totalSuppliers || 0} entries in database
                                </span>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Latest 50 entries displayed
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <EntryTable 
                entries={suppliers} 
                isDeleting={isDeleting}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShowDetails={handleShowDetails}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                onPrintRow={handlePrintRow}
            />
        </div>
    );
};

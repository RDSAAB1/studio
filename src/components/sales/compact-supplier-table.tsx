"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import type { Customer } from "@/lib/definitions";

interface CompactSupplierTableProps {
    suppliers: Customer[];
    onEditSupplier: (supplier: Customer) => void;
    onDeleteSupplier: (id: string) => void;
    isDeleting?: boolean;
}

export const CompactSupplierTable = ({ 
    suppliers, 
    onEditSupplier, 
    onDeleteSupplier, 
    isDeleting = false 
}: CompactSupplierTableProps) => {
    const { toast } = useToast();
    const [isExpanded, setIsExpanded] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (supplier: Customer) => {
        if (window.confirm(`Delete entry ${supplier.srNo} - ${supplier.name}?`)) {
            setDeletingId(supplier.id);
            try {
                await onDeleteSupplier(supplier.id);
                toast({ 
                    title: "Entry deleted successfully", 
                    description: `${supplier.name} has been deleted.`,
                    variant: "success"
                });
            } catch (error) {
                toast({ 
                    title: "Error deleting entry", 
                    variant: "destructive" 
                });
            } finally {
                setDeletingId(null);
            }
        }
    };

    const displaySuppliers = isExpanded ? suppliers : suppliers.slice(0, 10);

    return (
        <Card className="mt-4">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                        Latest Entries ({suppliers.length})
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-6 px-2 text-xs"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="h-3 w-3 mr-1" />
                                Show Less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Show All
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-2 font-semibold text-muted-foreground w-16">SR No</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-20">Date</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-32">Name</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-24">SO</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-20">Amount</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-20">Net Amt</th>
                                <th className="text-left p-2 font-semibold text-muted-foreground w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displaySuppliers.map((supplier, index) => (
                                <tr 
                                    key={supplier.id} 
                                    className="border-b hover:bg-muted/30 transition-colors"
                                >
                                    <td className="p-2 font-mono text-xs">
                                        {supplier.srNo}
                                    </td>
                                    <td className="p-2 text-xs">
                                        {format(new Date(supplier.date), 'dd/MM/yy')}
                                    </td>
                                    <td className="p-2 text-xs font-medium truncate max-w-32">
                                        {supplier.name}
                                    </td>
                                    <td className="p-2 text-xs truncate max-w-24">
                                        {supplier.so}
                                    </td>
                                    <td className="p-2 text-xs">
                                        ₹{supplier.amount?.toFixed(2) || '0.00'}
                                    </td>
                                    <td className="p-2 text-xs font-medium">
                                        ₹{supplier.netAmount?.toFixed(2) || '0.00'}
                                    </td>
                                    <td className="p-2">
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEditSupplier(supplier)}
                                                className="h-6 w-6 p-0 hover:bg-primary/10"
                                                title="Edit"
                                            >
                                                <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(supplier)}
                                                disabled={isDeleting || deletingId === supplier.id}
                                                className="h-6 w-6 p-0 hover:bg-destructive/10"
                                                title="Delete"
                                            >
                                                {deletingId === supplier.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            
                            {suppliers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-4 text-sm text-muted-foreground">
                                        No entries found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

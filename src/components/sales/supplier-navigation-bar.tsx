"use client";

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Database, Plus, Loader2 } from "lucide-react";

interface SupplierNavigationBarProps {
    activeView: 'entry' | 'data';
    onEntryClick: () => void;
    onDataClick: () => void;
    onNewEntry?: () => void;
    entryCount?: number;
    totalCount?: number;
    isDataLoading?: boolean;
}

export const SupplierNavigationBar = memo(({ 
    activeView, 
    onEntryClick, 
    onDataClick, 
    onNewEntry,
    entryCount = 0,
    totalCount = 0,
    isDataLoading = false
}: SupplierNavigationBarProps) => {
    return (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-sm">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    {/* Navigation Buttons */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeView === 'entry' ? 'default' : 'outline'}
                            size="sm"
                            onClick={onEntryClick}
                            className="h-9 px-4 transition-none will-change-auto"
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Entry Form
                        </Button>
                        <Button
                            variant={activeView === 'data' ? 'default' : 'outline'}
                            size="sm"
                            onClick={onDataClick}
                            disabled={isDataLoading}
                            className="h-9 px-4 transition-none will-change-auto"
                        >
                            {isDataLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Database className="mr-2 h-4 w-4" />
                            )}
                            {isDataLoading ? 'Loading...' : 'Data View'}
                        </Button>
                    </div>

                    {/* Stats and Actions */}
                    <div className="flex items-center gap-4">
                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>Entries: {entryCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Database className="h-4 w-4" />
                                <span>Total: {totalCount}</span>
                            </div>
                        </div>

                        {/* New Entry Button */}
                        {onNewEntry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onNewEntry}
                                className="h-9 px-4"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                New Entry
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

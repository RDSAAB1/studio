"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";

interface SyncCollectionInfo {
  collectionName: string;
  displayName: string;
  totalInFirestore: number;
  fetched: number;
  sent: number;
  status: 'pending' | 'syncing' | 'success' | 'error';
  error?: string;
}

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (selectedCollections?: string[], onProgress?: (collections: SyncCollectionInfo[]) => void) => Promise<SyncCollectionInfo[]>;
}

export function SyncDialog({ open, onOpenChange, onSync }: SyncDialogProps) {
  const [collections, setCollections] = useState<SyncCollectionInfo[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);

  // Load collections info first time dialog opens (just to show the list)
  useEffect(() => {
    if (open && collections.length === 0 && !isSyncing) {
      // Load all collections info first (this will sync all, but user can select next time)
      const loadInitial = async () => {
        setIsSyncing(true);
        try {
          const results = await onSync(undefined); // Get all collections info
          setCollections(results);
        } catch (error) {
          console.error('Error loading collections:', error);
        } finally {
          setIsSyncing(false);
        }
      };
      loadInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Initialize selected collections after collections are loaded
  useEffect(() => {
    if (collections.length > 0 && selectedCollections.size === 0 && selectAll) {
      // Load saved preferences from localStorage
      const saved = localStorage.getItem('syncSelectedCollections');
      if (saved) {
        try {
          const savedArray = JSON.parse(saved);
          if (Array.isArray(savedArray) && savedArray.length > 0) {
            // Some collections are deselected
            const allNames = collections.map(c => c.collectionName);
            const selected = allNames.filter(name => !savedArray.includes(name));
            setSelectedCollections(new Set(selected));
            setSelectAll(selected.length === allNames.length);
          } else {
            // All selected
            const allNames = collections.map(c => c.collectionName);
            setSelectedCollections(new Set(allNames));
            setSelectAll(true);
          }
        } catch {
          // If parse fails, select all
          const allNames = collections.map(c => c.collectionName);
          setSelectedCollections(new Set(allNames));
          setSelectAll(true);
        }
      } else {
        // Default: select all
        const allNames = collections.map(c => c.collectionName);
        setSelectedCollections(new Set(allNames));
        setSelectAll(true);
      }
    }
  }, [collections.length]);

  // Update selectAll when selectedCollections changes
  useEffect(() => {
    if (collections.length > 0) {
      const allNames = collections.map(c => c.collectionName);
      const allSelected = allNames.every(name => selectedCollections.has(name));
      setSelectAll(allSelected);
    }
  }, [selectedCollections, collections]);

  const handleToggleCollection = (collectionName: string) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionName)) {
      newSelected.delete(collectionName);
    } else {
      newSelected.add(collectionName);
    }
    setSelectedCollections(newSelected);
    
    // Save deselected collections (for easier logic)
    const allNames = collections.map(c => c.collectionName);
    const deselected = allNames.filter(name => !newSelected.has(name));
    localStorage.setItem('syncSelectedCollections', JSON.stringify(deselected));
  };

  const handleSelectAll = () => {
    const allCollectionNames = collections.map(c => c.collectionName);
    if (selectAll) {
      // Deselect all
      setSelectedCollections(new Set());
      localStorage.setItem('syncSelectedCollections', JSON.stringify(allCollectionNames));
    } else {
      // Select all
      setSelectedCollections(new Set(allCollectionNames));
      localStorage.setItem('syncSelectedCollections', JSON.stringify([]));
    }
    setSelectAll(!selectAll);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncComplete(false);
    setCollections([]);

    try {
      // Pass selected collections to sync
      const collectionsToSync = selectedCollections.size > 0 
        ? Array.from(selectedCollections)
        : undefined; // undefined means sync all
      
      // Real-time progress callback
      const onProgress = (progressCollections: SyncCollectionInfo[]) => {
        setCollections([...progressCollections]);
      };
      
      const results = await onSync(collectionsToSync, onProgress);
      setCollections(results);
      setSyncComplete(true);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const isCollectionSelected = (collectionName: string) => {
    return selectedCollections.has(collectionName);
  };

  const totalCollections = collections.length;
  const syncedCollections = collections.filter(c => c.status === 'success').length;
  const errorCollections = collections.filter(c => c.status === 'error').length;
  const syncingCollections = collections.filter(c => c.status === 'syncing').length;
  const totalFetched = collections.reduce((sum, c) => sum + c.fetched, 0);
  const totalSent = collections.reduce((sum, c) => sum + c.sent, 0);
  const totalInFirestore = collections.reduce((sum, c) => sum + c.totalInFirestore, 0);
  
  // Calculate progress percentage
  const progressPercentage = totalCollections > 0 
    ? Math.round(((syncedCollections + errorCollections) / totalCollections) * 100)
    : 0;
  
  // Get currently syncing collection
  const currentSyncing = collections.find(c => c.status === 'syncing');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Data Sync Status
          </DialogTitle>
          <DialogDescription>
            Detailed sync information for all collections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Total Collections</p>
                <p className="text-2xl font-bold">{totalCollections}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Synced</p>
                <p className="text-2xl font-bold text-green-600">{syncedCollections}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">{errorCollections}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Data</p>
                <p className="text-2xl font-bold">{totalInFirestore}</p>
              </div>
            </div>
            
            {/* Progress Bar */}
            {isSyncing && totalCollections > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {currentSyncing ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Syncing: {currentSyncing.displayName}
                      </span>
                    ) : (
                      'Preparing...'
                    )}
                  </span>
                  <span className="font-medium">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Collection Selection */}
          {collections.length > 0 && (
            <div className="p-4 border rounded-md bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Select Collections to Sync</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-7 text-xs"
                >
                  {selectAll ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {collections.map((collection) => {
                  const isSelected = isCollectionSelected(collection.collectionName);
                  return (
                    <div key={collection.collectionName} className="flex items-center space-x-2">
                      <Checkbox
                        id={`sync-${collection.collectionName}`}
                        checked={isSelected}
                        onCheckedChange={() => handleToggleCollection(collection.collectionName)}
                        disabled={isSyncing}
                      />
                      <Label
                        htmlFor={`sync-${collection.collectionName}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {collection.displayName}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sync Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSync}
              disabled={isSyncing || (collections.length > 0 && selectedCollections.size === 0 && !selectAll)}
              variant="default"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Selected
                </>
              )}
            </Button>
          </div>

          {/* Collections Table */}
          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead className="text-right">Total in Firestore</TableHead>
                  <TableHead className="text-right">Fetched</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.length === 0 && !isSyncing ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Click "Sync Selected" to start syncing
                    </TableCell>
                  </TableRow>
                ) : isSyncing && collections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  collections.map((collection) => {
                    const isSelected = isCollectionSelected(collection.collectionName);
                    const wasSynced = collection.status === 'success' || collection.status === 'error';
                    const isCurrentlySyncing = collection.status === 'syncing';
                    return (
                      <TableRow 
                        key={collection.collectionName}
                        className={`
                          ${!isSelected && wasSynced ? 'opacity-50' : ''}
                          ${isCurrentlySyncing ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
                        `}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleCollection(collection.collectionName)}
                            disabled={isSyncing}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{collection.displayName}</span>
                            {collection.status === 'syncing' && collection.error && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 italic">{collection.error}</span>
                            )}
                            {collection.status === 'error' && collection.error && (
                              <span className="text-xs text-red-600 dark:text-red-400">{collection.error}</span>
                            )}
                            {!isSelected && wasSynced && (
                              <span className="text-xs text-muted-foreground">(Skipped)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {collection.totalInFirestore}
                        </TableCell>
                        <TableCell className="text-right text-blue-600">
                          {isSelected ? collection.fetched : '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {isSelected ? collection.sent : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {!isSelected && wasSynced ? (
                            <span className="text-muted-foreground text-xs">Skipped</span>
                          ) : collection.status === 'syncing' ? (
                            <div className="flex flex-col items-center gap-1">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">Syncing...</span>
                            </div>
                          ) : collection.status === 'success' ? (
                            <div className="flex flex-col items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-xs text-green-600">Done</span>
                            </div>
                          ) : collection.status === 'error' ? (
                            <div className="flex flex-col items-center gap-1">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span className="text-xs text-red-600">Error</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Summary Footer */}
          {syncComplete && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Sync Complete!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Fetched {totalFetched} records | Sent {totalSent} records
                  </p>
                </div>
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Edit2, Save, Upload, Loader2, X } from "lucide-react";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import { format } from "date-fns";
import {
  findMatchingField,
  detectUnit,
  processRow,
  validateRow,
  calculateMissingFields,
  type ColumnMapping,
  type ImportRow,
} from "@/lib/import-helpers";
import type { Customer } from "@/lib/definitions";

interface ImportPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rawData: any[];
  sourceColumns: string[];
  onImport: (rows: ImportRow[]) => Promise<void>;
}

const TARGET_FIELDS = [
  { value: 'skip', label: '-- Skip --' },
  { value: 'srNo', label: 'SR No' },
  { value: 'name', label: 'Name' },
  { value: 'fatherName', label: 'Father Name' },
  { value: 'contact', label: 'Contact' },
  { value: 'address', label: 'Address' },
  { value: 'vehicleNo', label: 'Vehicle No' },
  { value: 'variety', label: 'Variety' },
  { value: 'grossWeight', label: 'Gross Weight' },
  { value: 'teirWeight', label: 'Tier Weight' },
  { value: 'netWeight', label: 'Net Weight' },
  { value: 'rate', label: 'Rate' },
  { value: 'amount', label: 'Amount' },
  { value: 'date', label: 'Date' },
  { value: 'term', label: 'Term' },
  { value: 'kanta', label: 'Kanta' },
  { value: 'labouryRate', label: 'Labour Rate' },
];

export const ImportPreviewDialog = ({
  isOpen,
  onOpenChange,
  rawData,
  sourceColumns,
  onImport,
}: ImportPreviewDialogProps) => {
  const [mappings, setMappings] = useState<Record<string, ColumnMapping>>({});
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Customer>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkKartaPercentage, setBulkKartaPercentage] = useState<string>('');
  const [bulkLabouryRate, setBulkLabouryRate] = useState<string>('');
  const [bulkKanta, setBulkKanta] = useState<string>('');

  // Auto-detect mappings on mount
  useEffect(() => {
    if (sourceColumns.length > 0 && Object.keys(mappings).length === 0 && rawData.length > 0) {
      const autoMappings: Record<string, ColumnMapping> = {};
      sourceColumns.forEach(col => {
        const matchedField = findMatchingField(col);
        if (matchedField && matchedField !== 'skip') {
          const detectedUnit = detectUnit(col, rawData[0]?.[col]);
          autoMappings[col] = {
            sourceColumn: col,
            targetField: matchedField,
            unit: detectedUnit,
            isRequired: ['name', 'date'].includes(matchedField),
          };
        }
      });
      if (Object.keys(autoMappings).length > 0) {
        setMappings(autoMappings);
      }
    }
  }, [sourceColumns, rawData, mappings]);

  // Process data when mappings change
  useEffect(() => {
    if (rawData.length > 0) {
      const processed = rawData.map((row, index) => {
        // Process row with mappings (even if empty, will return empty object)
        const mappedData = Object.keys(mappings).length > 0 
          ? processRow(row, mappings) 
          : ({} as Partial<Customer>);
        const validation = validateRow(mappedData);
        return {
          id: `row-${index}`,
          originalData: row,
          mappedData,
          isSelected: true,
          isValid: validation.isValid,
          errors: validation.errors,
        };
      });
      setPreviewRows(processed);
      setSelectedRowIds(new Set(processed.map(r => r.id)));
    } else {
      // Clear preview if no data
      setPreviewRows([]);
      setSelectedRowIds(new Set());
    }
  }, [mappings, rawData]);

  // Handle column mapping change
  const handleMappingChange = (sourceCol: string, targetField: string, unit?: 'QTL' | 'KG') => {
    // If targetField is 'skip' or empty, remove the mapping
    if (!targetField || targetField === 'skip' || targetField === '' || targetField.trim() === '') {
      setMappings(prev => {
        const newMappings = { ...prev };
        delete newMappings[sourceCol];
        return newMappings;
      });
      return;
    }

    setMappings(prev => {
      const currentMapping = prev[sourceCol];
      const newUnit = unit || currentMapping?.unit || detectUnit(sourceCol, rawData[0]?.[sourceCol]);
      
      return {
        ...prev,
        [sourceCol]: {
          sourceColumn: sourceCol,
          targetField,
          unit: ['grossWeight', 'teirWeight', 'netWeight', 'weight'].includes(targetField) ? newUnit : 'QTL',
          isRequired: ['name', 'date'].includes(targetField),
        },
      };
    });
  };

  // Handle unit change
  const handleUnitChange = (sourceCol: string, unit: 'QTL' | 'KG') => {
    setMappings(prev => ({
      ...prev,
      [sourceCol]: {
        ...prev[sourceCol],
        unit,
      },
    }));
  };

  // Handle row selection
  const handleSelectRow = (rowId: string) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(previewRows.map(r => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  // Handle edit row
  const handleEditRow = (row: ImportRow) => {
    setEditingRowId(row.id);
    setEditingData({ ...row.mappedData });
  };

  // Handle save edited row
  const handleSaveRow = (rowId: string) => {
    setPreviewRows(prev => prev.map(row => {
      if (row.id === rowId) {
        // Recalculate fields after editing
        const recalculated = calculateMissingFields(editingData);
        const validation = validateRow(recalculated);
        return {
          ...row,
          mappedData: recalculated,
          isValid: validation.isValid,
          errors: validation.errors,
        };
      }
      return row;
    }));
    setEditingRowId(null);
    setEditingData({});
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingData({});
  };

  // Handle import all
  const handleImportAll = async () => {
    setIsImporting(true);
    try {
      await onImport(previewRows);
      onOpenChange(false);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle import selected
  const handleImportSelected = async () => {
    const selectedRows = previewRows.filter(r => selectedRowIds.has(r.id));
    setIsImporting(true);
    try {
      await onImport(selectedRows);
      onOpenChange(false);
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle import single row
  const handleImportSingle = async (row: ImportRow) => {
    setIsImporting(true);
    try {
      await onImport([row]);
      // Remove imported row from preview
      setPreviewRows(prev => prev.filter(r => r.id !== row.id));
      setSelectedRowIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(row.id);
        return newSet;
      });
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle bulk apply
  const handleBulkApply = () => {
    const kartaPct = parseFloat(bulkKartaPercentage) || 0;
    const labourRate = parseFloat(bulkLabouryRate) || 0;
    const kantaVal = parseFloat(bulkKanta) || 0;

    setPreviewRows(prev => prev.map(row => {
      if (selectedRowIds.has(row.id)) {
        const updated = {
          ...row.mappedData,
          kartaPercentage: bulkKartaPercentage ? kartaPct : row.mappedData.kartaPercentage,
          labouryRate: bulkLabouryRate ? labourRate : row.mappedData.labouryRate,
          kanta: bulkKanta ? kantaVal : row.mappedData.kanta,
        };
        const recalculated = calculateMissingFields(updated);
        const validation = validateRow(recalculated);
        return {
          ...row,
          mappedData: recalculated,
          isValid: validation.isValid,
          errors: validation.errors,
        };
      }
      return row;
    }));

    setBulkEditOpen(false);
    setBulkKartaPercentage('');
    setBulkLabouryRate('');
    setBulkKanta('');
  };

  const allSelected = previewRows.length > 0 && selectedRowIds.size === previewRows.length;
  const someSelected = selectedRowIds.size > 0 && selectedRowIds.size < previewRows.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-xl font-semibold">Import Preview & Mapping</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0 p-6">
          {/* Column Mapping Section */}
          <div className="border rounded-lg p-3 bg-muted/20 flex-shrink-0">
            <h3 className="font-semibold mb-2 text-xs">Column Mapping</h3>
            <ScrollArea className="h-24">
              <div className="grid grid-cols-4 gap-2 text-xs">
                {sourceColumns.map(col => {
                  const mapping = mappings[col];
                  const isWeightField = ['grossWeight', 'teirWeight', 'netWeight', 'weight'].includes(mapping?.targetField || '');
                  
                  return (
                    <div key={col} className="space-y-1">
                      <label className="text-muted-foreground text-[10px] truncate block">{col}</label>
                      <div className="flex gap-1">
                        <Select
                          value={mapping?.targetField || ''}
                          onValueChange={(value) => handleMappingChange(col, value)}
                        >
                          <SelectTrigger className="h-6 text-[10px] flex-1">
                            <SelectValue placeholder="Map..." />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELDS.map(field => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isWeightField && (
                          <Select
                            value={mapping?.unit || 'QTL'}
                            onValueChange={(value: 'QTL' | 'KG') => handleUnitChange(col, value)}
                          >
                            <SelectTrigger className="h-6 w-14 text-[10px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QTL">QTL</SelectItem>
                              <SelectItem value="KG">KG</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Preview Table */}
          <div className="border rounded-lg flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b bg-muted/20 flex-shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        (el as any).indeterminate = someSelected;
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedRowIds.size} of {previewRows.length} selected
                  </span>
                  {previewRows.filter(r => !r.isValid).length > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                      {previewRows.filter(r => !r.isValid).length} invalid
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedRowIds.size > 0 && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setBulkEditOpen(true)}
                      className="h-6 text-[11px] px-2"
                    >
                      Bulk Edit
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    onClick={handleImportAll} 
                    disabled={previewRows.length === 0 || isImporting}
                    className="h-6 text-[11px] px-2"
                  >
                    {isImporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Import All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleImportSelected}
                    disabled={selectedRowIds.size === 0 || isImporting}
                    className="h-6 text-[11px] px-2"
                  >
                    Import Selected ({selectedRowIds.size})
                  </Button>
                </div>
              </div>
              {bulkEditOpen && (
                <div className="flex items-center gap-2 p-2 bg-background border rounded text-xs">
                  <span className="text-muted-foreground">Apply to {selectedRowIds.size} selected:</span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Karta %"
                    value={bulkKartaPercentage}
                    onChange={(e) => setBulkKartaPercentage(e.target.value)}
                    className="h-6 w-20 text-[10px]"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Labour Rate"
                    value={bulkLabouryRate}
                    onChange={(e) => setBulkLabouryRate(e.target.value)}
                    className="h-6 w-20 text-[10px]"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Kanta"
                    value={bulkKanta}
                    onChange={(e) => setBulkKanta(e.target.value)}
                    className="h-6 w-20 text-[10px]"
                  />
                  <Button
                    size="sm"
                    onClick={handleBulkApply}
                    className="h-6 text-[10px] px-2"
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setBulkEditOpen(false);
                      setBulkKartaPercentage('');
                      setBulkLabouryRate('');
                      setBulkKanta('');
                    }}
                    className="h-6 text-[10px] px-2"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-xs">SR No</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Father</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Gross</TableHead>
                    <TableHead className="text-xs">Tier</TableHead>
                    <TableHead className="text-xs">Final</TableHead>
                    <TableHead className="text-xs">Karta%</TableHead>
                    <TableHead className="text-xs">Karta Wt</TableHead>
                    <TableHead className="text-xs">Net Wt</TableHead>
                    <TableHead className="text-xs">Rate</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Karta Amt</TableHead>
                    <TableHead className="text-xs">Lab Amt</TableHead>
                    <TableHead className="text-xs">Kanta</TableHead>
                    <TableHead className="text-xs">Net Amt</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row) => (
                    <TableRow 
                      key={row.id} 
                      className={!row.isValid ? 'bg-red-50 dark:bg-red-950/20' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRowIds.has(row.id)}
                          onCheckedChange={() => handleSelectRow(row.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">{row.mappedData.srNo || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            value={editingData.name || ''}
                            onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                            className="h-7 text-xs"
                            placeholder="Name"
                          />
                        ) : (
                          row.mappedData.name || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            value={editingData.so || editingData.fatherName || ''}
                            onChange={(e) => setEditingData({ ...editingData, so: e.target.value, fatherName: e.target.value })}
                            className="h-7 text-xs"
                            placeholder="Father Name"
                          />
                        ) : (
                          row.mappedData.so || row.mappedData.fatherName || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            value={editingData.contact || ''}
                            onChange={(e) => setEditingData({ ...editingData, contact: e.target.value })}
                            className="h-7 text-xs"
                            placeholder="Contact"
                          />
                        ) : (
                          row.mappedData.contact || '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="date"
                            value={editingData.date || ''}
                            onChange={(e) => setEditingData({ ...editingData, date: e.target.value })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          row.mappedData.date ? format(new Date(row.mappedData.date), 'dd-MMM-yy') : '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.grossWeight || 0}
                            onChange={(e) => setEditingData({ ...editingData, grossWeight: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          row.mappedData.grossWeight?.toFixed(2) || '0.00'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.teirWeight || 0}
                            onChange={(e) => setEditingData({ ...editingData, teirWeight: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          row.mappedData.teirWeight?.toFixed(2) || '0.00'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.weight || 0}
                            onChange={(e) => setEditingData({ ...editingData, weight: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          row.mappedData.weight?.toFixed(2) || ((row.mappedData.grossWeight || 0) - (row.mappedData.teirWeight || 0)).toFixed(2)
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.kartaPercentage || 0}
                            onChange={(e) => setEditingData({ ...editingData, kartaPercentage: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          (row.mappedData.kartaPercentage || 0).toFixed(2)
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.mappedData.kartaWeight?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.mappedData.netWeight?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.rate || 0}
                            onChange={(e) => setEditingData({ ...editingData, rate: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          formatCurrency(row.mappedData.rate || 0)
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCurrency(row.mappedData.amount || 0)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCurrency(row.mappedData.kartaAmount || 0)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCurrency(row.mappedData.labouryAmount || 0)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {editingRowId === row.id ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingData.kanta || 0}
                            onChange={(e) => setEditingData({ ...editingData, kanta: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs"
                          />
                        ) : (
                          formatCurrency(row.mappedData.kanta || 0)
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatCurrency(row.mappedData.netAmount || row.mappedData.originalNetAmount || 0)}
                      </TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <Badge variant="default" className="text-[10px]">Valid</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            {row.errors?.[0] || 'Invalid'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingRowId === row.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveRow(row.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditRow(row)}
                              className="h-6 w-6 p-0"
                              title="Edit"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleImportSingle(row)}
                              className="h-6 w-6 p-0"
                              disabled={isImporting}
                              title="Import this row"
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {previewRows.length === 0 && rawData.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center text-muted-foreground h-24">
                        Processing data... Please map columns to see preview.
                      </TableCell>
                    </TableRow>
                  )}
                  {previewRows.length === 0 && rawData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center text-muted-foreground h-24">
                        No data to preview.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

      {/* Footer */}
      <div className="border-t bg-card px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
          Cancel
        </Button>
      </div>
    </div>
  );
};


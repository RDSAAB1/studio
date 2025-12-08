"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { fetchMandiReports, getMandiReportsRealtime } from '@/lib/firestore';
import { formatCurrency, toTitleCase } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { MandiReport } from "@/lib/definitions";
import * as XLSX from 'xlsx';

export function MandiReportHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<{ from?: Date; to?: Date }>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get all mandi report entries from database
  // Use toArray() and sort manually if purchaseDate index doesn't exist yet
  const allEntriesRaw = useLiveQuery(async () => {
    if (typeof window === 'undefined' || !db) {
      console.log('DB not available (server-side or not initialized)');
      return [];
    }
    try {
      const entries = await db.mandiReports.toArray();
      console.log(`Fetched ${entries.length} mandi report entries from IndexedDB`);
      return entries;
    } catch (error) {
      console.error('Error fetching mandi reports from IndexedDB:', error);
      return [];
    }
  }, []);
  
  // Real-time listener for mandi reports
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsLoading(true);
    const unsubscribe = getMandiReportsRealtime(
      (data) => {
        console.log(`[MandiReportHistory] ✅ Real-time update: ${data.length} reports`);
        setIsLoading(false);
        // Data is automatically synced to IndexedDB by the real-time function
      },
      (error) => {
        console.error('[MandiReportHistory] ❌ Error in real-time listener:', error);
        setIsLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, []);
  
  // Debug: Log when data changes
  useEffect(() => {
    if (allEntriesRaw !== undefined) {
      console.log('Mandi reports data updated:', {
        count: allEntriesRaw?.length || 0,
        sample: allEntriesRaw?.[0] || null
      });
      if (allEntriesRaw.length > 0) {
        setIsLoading(false);
      }
    }
  }, [allEntriesRaw]);
  
  // Sort by purchaseDate manually
  const allEntries = useMemo(() => {
    if (!allEntriesRaw || allEntriesRaw.length === 0) return [];
    return [...allEntriesRaw].sort((a, b) => {
      const dateA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
      const dateB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
      return dateB - dateA; // Reverse order (newest first)
    });
  }, [allEntriesRaw]);

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    let filtered = [...(allEntries || [])];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.voucherNo?.toLowerCase().includes(query) ||
        entry.sellerName?.toLowerCase().includes(query) ||
        entry.fatherName?.toLowerCase().includes(query) ||
        entry.mobile?.toLowerCase().includes(query) ||
        entry.commodity?.toLowerCase().includes(query) ||
        entry.district?.toLowerCase().includes(query) ||
        entry.village?.toLowerCase().includes(query) ||
        entry.traderName?.toLowerCase().includes(query) ||
        entry.traderReceiptNo?.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter.from) {
      filtered = filtered.filter(entry => {
        if (!entry.purchaseDate) return false;
        const entryDate = new Date(entry.purchaseDate);
        return entryDate >= dateFilter.from!;
      });
    }
    if (dateFilter.to) {
      filtered = filtered.filter(entry => {
        if (!entry.purchaseDate) return false;
        const entryDate = new Date(entry.purchaseDate);
        entryDate.setHours(23, 59, 59, 999);
        return entryDate <= dateFilter.to!;
      });
    }

    return filtered;
  }, [allEntries, searchQuery, dateFilter]);

  // Export to Excel
  const handleExport = () => {
    const rows = filteredEntries.map((entry) => ({
      'Voucher No': entry.voucherNo || '',
      'Book No': entry.bookNo || '',
      'Purchase Date': entry.purchaseDate ? format(new Date(entry.purchaseDate), 'dd MMM yyyy') : '',
      'Seller Name': toTitleCase(entry.sellerName || ''),
      'Father Name': toTitleCase(entry.fatherName || ''),
      'District': entry.district || '',
      'Tehsil': entry.tehsil || '',
      'Village': entry.village || '',
      'Khasra No': entry.khasraNo || '',
      'Khasra Area': entry.khasraArea || '',
      'Mobile': entry.mobile || '',
      'Commodity': entry.commodity || '',
      'Quantity (Qtl)': entry.quantityQtl || 0,
      'Rate Per Qtl': entry.ratePerQtl || 0,
      'Gross Amount': entry.grossAmount || 0,
      'Mandi Fee': entry.mandiFee || 0,
      'Development Cess': entry.developmentCess || 0,
      'Total Charges': entry.totalCharges || 0,
      'Net Amount': entry.netAmount || 0,
      'Payment Amount': entry.paymentAmount || 0,
      'Payment Date': entry.paymentDate ? format(new Date(entry.paymentDate), 'dd MMM yyyy') : '',
      'Payment Mode': entry.paymentMode || '',
      'Bank Account': entry.bankAccount || '',
      'IFSC': entry.ifsc || '',
      'Bank Name': entry.bankName || '',
      'Bank Branch': entry.bankBranch || '',
      'Transaction Number': entry.transactionNumber || '',
      'Trader Receipt No': entry.traderReceiptNo || '',
      'Trader Name': entry.traderName || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mandi Report History');
    
    const fileName = `mandi-report-history-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mandi Report History</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              onClick={async () => {
                setIsLoading(true);
                // Clear lastSync to force fresh fetch
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('lastSync:mandiReports');
                }
                // Clear IndexedDB cache
                if (db) {
                  try {
                    await db.mandiReports.clear();
                    console.log('[MandiReportHistory] Cleared IndexedDB cache');
                  } catch (error) {
                    console.error('Error clearing IndexedDB:', error);
                  }
                }
                try {
                  console.log('[MandiReportHistory] Force refreshing from Firestore...');
                  const reports = await fetchMandiReports();
                  console.log(`[MandiReportHistory] Fetched ${reports.length} reports`);
                  if (db && reports.length > 0) {
                    await db.mandiReports.bulkPut(reports);
                    console.log('[MandiReportHistory] Synced to IndexedDB');
                  } else if (reports.length === 0) {
                    console.warn('[MandiReportHistory] No reports found in Firestore. Check Firestore console.');
                  }
                } catch (error) {
                  console.error('[MandiReportHistory] Error refreshing data:', error);
                } finally {
                  setIsLoading(false);
                }
              }} 
              variant="outline" 
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Force Refresh
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm" disabled={filteredEntries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search: Voucher No, Seller Name, Mobile, Commodity, Trader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              placeholder="From Date"
              value={dateFilter.from ? format(dateFilter.from, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value ? new Date(e.target.value) : undefined })}
              className="w-40"
            />
            <Input
              type="date"
              placeholder="To Date"
              value={dateFilter.to ? format(dateFilter.to, 'yyyy-MM-dd') : ''}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value ? new Date(e.target.value) : undefined })}
              className="w-40"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-card z-10">Voucher No</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Purchase Date</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Seller Name</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Father Name</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Mobile</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Commodity</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-right">Qty (Qtl)</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-right">Rate/Qtl</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-right">Gross Amount</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-right">Mandi Fee</TableHead>
                <TableHead className="sticky top-0 bg-card z-10 text-right">Net Amount</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Payment Mode</TableHead>
                <TableHead className="sticky top-0 bg-card z-10">Trader Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allEntriesRaw === undefined || isLoading) ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading data...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    {allEntries.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <p className="font-medium">No mandi report entries found.</p>
                        <p className="text-xs">• Check Firestore console for data in 'mandiReports' collection</p>
                        <p className="text-xs">• If data exists, click 'Force Refresh' button above</p>
                        <p className="text-xs">• Data should be at: /mandiReports/{'{'}documentId{'}'}</p>
                        <p className="text-xs mt-2">• Import data from: Reports → Mandi Report Import</p>
                      </div>
                    ) : (
                      'No entries match your search criteria'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.voucherNo || '-'}</TableCell>
                    <TableCell>
                      {entry.purchaseDate ? format(new Date(entry.purchaseDate), 'dd MMM yyyy') : '-'}
                    </TableCell>
                    <TableCell>{toTitleCase(entry.sellerName || '')}</TableCell>
                    <TableCell>{toTitleCase(entry.fatherName || '')}</TableCell>
                    <TableCell>{entry.mobile || '-'}</TableCell>
                    <TableCell>{toTitleCase(entry.commodity || '')}</TableCell>
                    <TableCell className="text-right">{(entry.quantityQtl || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.ratePerQtl || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.grossAmount || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.mandiFee || 0)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(entry.netAmount || (entry.grossAmount || 0) - (entry.totalCharges || 0))}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.paymentMode || '-'}</Badge>
                    </TableCell>
                    <TableCell>{toTitleCase(entry.traderName || '')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredEntries.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {filteredEntries.length} of {allEntries.length} entries
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground">Total Gross Amount: </span>
                <span className="font-semibold">
                  {formatCurrency(
                    filteredEntries.reduce((sum, entry) => sum + (entry.grossAmount || 0), 0)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Net Amount: </span>
                <span className="font-semibold">
                  {formatCurrency(
                    filteredEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0)
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Payment Amount: </span>
                <span className="font-semibold">
                  {formatCurrency(
                    filteredEntries.reduce((sum, entry) => sum + (entry.paymentAmount || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


"use client";

import { useMemo, useState } from 'react';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, toTitleCase } from '@/lib/utils';

type NegativeItem = {
  key: string;
  name: string;
  so?: string;
  contact?: string;
  totalOriginalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  lastRtgsDate?: string;
  lastRtgsAmount?: number;
  rtgsCount: number;
};

export default function NegativeRtgsReportClient() {
  const { customerSummaryMap } = useSupplierData();
  const [searchName, setSearchName] = useState('');

  const rows: NegativeItem[] = useMemo(() => {
    const list: NegativeItem[] = [];
    if (!customerSummaryMap || customerSummaryMap.size === 0) return list;

    for (const [key, s] of customerSummaryMap.entries()) {
      const rtgsPayments = (s.allPayments || []).filter((p: any) => p.receiptType === 'RTGS' || p.rtgsAmount);
      if (rtgsPayments.length === 0) continue;

      // Negative outstanding strictly less than zero
      if ((s.totalOutstanding || 0) < 0) {
        const sortedRtgs = [...rtgsPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const last = sortedRtgs[0];
        list.push({
          key,
          name: toTitleCase(s.name || ''),
          so: toTitleCase(s.so || ''),
          contact: s.contact || '',
          totalOriginalAmount: s.totalOriginalAmount || 0,
          totalPaid: s.totalPaid || 0,
          totalOutstanding: s.totalOutstanding || 0,
          lastRtgsDate: last?.date,
          lastRtgsAmount: (last?.rtgsAmount || last?.amount || 0),
          rtgsCount: rtgsPayments.length,
        });
      }
    }

    return list.sort((a, b) => (a.totalOutstanding - b.totalOutstanding));
  }, [customerSummaryMap]);

  const filtered = useMemo(() => {
    if (!searchName) return rows;
    const term = searchName.trim().toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(term));
  }, [rows, searchName]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>RTGS Negative Outstanding</CardTitle>
          <CardDescription>Suppliers paid via RTGS with current outstanding below zero.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="searchName">Search by Name</Label>
              <Input id="searchName" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Enter supplier name" />
            </div>
            <div className="flex items-end">
              <Badge variant="secondary">Total: {filtered.length}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardDescription>List of suppliers where outstanding is negative.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto h-[70vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name / Father</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Paid (All)</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Last RTGS</TableHead>
                  <TableHead>RTGS Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">No records found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{r.name}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{r.so}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.contact}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(r.totalOriginalAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(r.totalPaid)}</TableCell>
                      <TableCell className="font-bold text-red-600 whitespace-nowrap">{formatCurrency(r.totalOutstanding)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.lastRtgsDate ? `${format(new Date(r.lastRtgsDate), 'dd-MMM-yy')} — ${formatCurrency(r.lastRtgsAmount || 0)}` : ''}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.rtgsCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}



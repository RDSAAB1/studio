"use client";

import { useMemo, useState } from 'react';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format } from 'date-fns';
import type { Payment } from '@/lib/definitions';
import { Button } from '@/components/ui/button';

type Row = {
  srNo: string;
  name: string;
  so?: string;
  originalNetAmount: number;
  totalPaid: number;
  totalCd: number;
  outstanding: number; // negative
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  excess?: number;
  reasons: string[];
};

export default function NegativeOutstandingClient() {
  const { customerSummaryMap } = useSupplierData();
  const [search, setSearch] = useState('');

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (!customerSummaryMap || customerSummaryMap.size === 0) return list;

    // Collect all valid SR Nos for stale reference detection
    const allSrNos = new Set<string>();
    for (const [, s0] of customerSummaryMap.entries()) {
      (s0.allTransactions || []).forEach(t0 => allSrNos.add(t0.srNo));
    }

    // Build duplicate paymentId map (best-effort)
    const paymentIdCount = new Map<string, number>();
    for (const [, s1] of customerSummaryMap.entries()) {
      (s1.allPayments || []).forEach((p: any) => {
        const id = p.paymentId || p.id;
        if (!id) return;
        paymentIdCount.set(id, (paymentIdCount.get(id) || 0) + 1);
      });
    }

    for (const [, s] of customerSummaryMap.entries()) {
      for (const t of (s.allTransactions || [])) {
        const net = Number(t.netAmount) || 0;
        // Skip floating point errors (near-zero negatives are effectively zero)
        if (net < -0.01) { // Only consider meaningful negatives (> 1 paisa)
          // find payments linked to this srNo
          const payments = (s.allPayments || []).filter(p => (p.paidFor || []).some(pf => pf.srNo === t.srNo));
          const last = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          const reasons: string[] = [];
          const original = Number(t.originalNetAmount) || 0;
          const paid = Number(t.totalPaid) || 0;
          const cd = Number(t.totalCd) || 0;
          
          // Calculate excess using same logic as outstanding table (accounting for CD adjustment)
          // netAmount already has CD fix applied, so excess is simply the absolute negative value
          const excess = Math.abs(net);
          
          // Only mark as "Overpaid" if excess is significant
          if (excess > 0.5) {
            reasons.push(`Overpaid by ${formatCurrency(excess)}`);
          }

          // Check for other issues (not just CD-related)
          let hasNonCdIssue = false;

          // Allocation vs payment amount consistency per payment
          for (const p of payments as Payment[]) {
            const usedAmount = Number(p.rtgsAmount || p.amount || 0);
            const allocated = (p.paidFor || []).reduce((sum, pf) => sum + Number(pf.amount || 0), 0);
            if (allocated > usedAmount + 0.5) {
              reasons.push(`Allocation exceeds payment total in ${p.paymentId || p.id}`);
              hasNonCdIssue = true;
            }
            if (p.receiptType === 'RTGS' && p.rtgsAmount && p.amount && Math.abs(p.rtgsAmount - p.amount) > 0.5) {
              reasons.push(`RTGS amount (${formatCurrency(p.rtgsAmount)}) ≠ amount (${formatCurrency(p.amount)}) in ${p.paymentId || p.id}`);
              hasNonCdIssue = true;
            }
            const pid = p.paymentId || p.id;
            if (pid && (paymentIdCount.get(pid) || 0) > 1) {
              reasons.push(`Duplicate paymentId ${pid}`);
              hasNonCdIssue = true;
            }
            // Stale paidFor references
            if ((p.paidFor || []).some(pf => !allSrNos.has(pf.srNo))) {
              reasons.push('Stale paidFor reference (missing SR No)');
              hasNonCdIssue = true;
            }
          }

          // Filter: Only include entries that have issues OTHER than just CD overpayment
          // Exclude entries where ONLY "Overpaid" reason exists and excess <= CD amount (CD fix handles these)
          // Include if: has allocation/RTGS/duplicate/stale issues OR overpayment > CD amount (real problem beyond CD)
          const isOnlyCdOverpayment = !hasNonCdIssue && excess <= cd + 0.5;
          
          // Skip entries that are only CD-related (CD fix handles these in calculation)
          // Only show entries with real allocation/payment issues
          if (!isOnlyCdOverpayment) {
            list.push({
              srNo: t.srNo,
              name: toTitleCase(s.name || ''),
              so: toTitleCase(s.so || ''),
              originalNetAmount: original,
              totalPaid: paid,
              totalCd: cd,
              outstanding: net, // This matches outstanding table exactly (CD fix already applied)
              lastPaymentDate: last?.date,
              lastPaymentAmount: (last?.rtgsAmount || last?.amount || 0),
              excess: excess > 0 ? excess : 0,
              reasons: Array.from(new Set(reasons)),
            });
          }
        }
      }
    }
    return list.sort((a, b) => a.outstanding - b.outstanding);
  }, [customerSummaryMap]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(term) || (r.srNo || '').toLowerCase().includes(term));
  }, [rows, search]);

  const exportJson = useMemo(() => {
    if (!customerSummaryMap) return '[]';
    const report = filtered.map((r) => {
      // find the matching supplier summary and payments for this SR
      let paymentsForEntry: Payment[] = [];
      for (const [, s] of customerSummaryMap.entries()) {
        const hasEntry = (s.allTransactions || []).some(t => t.srNo === r.srNo);
        if (hasEntry) {
          paymentsForEntry = (s.allPayments || []).filter(p => (p.paidFor || []).some(pf => pf.srNo === r.srNo));
          break;
        }
      }
      const payments = paymentsForEntry.map((p) => ({
        id: p.id,
        paymentId: p.paymentId,
        date: p.date,
        receiptType: p.receiptType,
        amount: p.amount,
        rtgsAmount: p.rtgsAmount,
        cdAmount: p.cdAmount,
        paidForAmountForThisSrNo: (p.paidFor || []).find(pf => pf.srNo === r.srNo)?.amount || 0,
        totalAllocated: (p.paidFor || []).reduce((sum, pf) => sum + Number(pf.amount || 0), 0),
      }));
      return {
        srNo: r.srNo,
        name: r.name,
        fatherName: r.so,
        originalNetAmount: r.originalNetAmount,
        totalPaid: r.totalPaid,
        totalCd: r.totalCd,
        outstanding: r.outstanding,
        excess: r.excess || 0,
        reasons: r.reasons,
        lastPaymentDate: r.lastPaymentDate,
        lastPaymentAmount: r.lastPaymentAmount,
        payments,
      };
    });
    try {
      return JSON.stringify(report, null, 2);
    } catch {
      return '[]';
    }
  }, [filtered, customerSummaryMap]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      // no toast imported here; keep silent
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Negative Outstanding (Supplier Payments)</CardTitle>
          <CardDescription>Entries from the outstanding table that are currently below zero.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="q">Search</Label>
              <Input id="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or SR No" />
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <Badge variant="secondary">Total: {filtered.length}</Badge>
              <Badge variant="outline">Overpaid: {filtered.filter(r => (r.excess || 0) > 0.5).length}</Badge>
              <Badge variant="outline">Alloc{'>'}Payment: {filtered.filter(r => r.reasons.some(rr => rr.startsWith('Allocation exceeds'))).length}</Badge>
              <Badge variant="outline">RTGS Mismatch: {filtered.filter(r => r.reasons.some(rr => rr.startsWith('RTGS amount'))).length}</Badge>
              <Badge variant="outline">Duplicate IDs: {filtered.filter(r => r.reasons.some(rr => rr.startsWith('Duplicate paymentId'))).length}</Badge>
              <Badge variant="outline">Stale paidFor: {filtered.filter(r => r.reasons.some(rr => rr.startsWith('Stale paidFor'))).length}</Badge>
              <Button size="sm" onClick={handleCopy}>Copy Fix Report (JSON)</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardDescription>Negative outstanding entries with last payment info.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Label>Fix Report (copy-paste this JSON)</Label>
            <textarea
              readOnly
              value={exportJson}
              className="w-full h-40 p-2 border rounded mt-1 font-mono text-xs"
            />
          </div>
          <div className="overflow-auto h-[70vh] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SR No.</TableHead>
                  <TableHead>Name / Father</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>CD</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Excess</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Reasons</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">No negative outstanding entries found.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.srNo}>
                      <TableCell className="whitespace-nowrap">{r.srNo}</TableCell>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{r.name}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{r.so}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(r.originalNetAmount)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(r.totalPaid)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatCurrency(r.totalCd)}</TableCell>
                      <TableCell className="font-bold text-red-600 whitespace-nowrap">{formatCurrency(r.outstanding)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.excess ? formatCurrency(r.excess) : '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.lastPaymentDate ? `${format(new Date(r.lastPaymentDate), 'dd-MMM-yy')} — ${formatCurrency(r.lastPaymentAmount || 0)}` : ''}</TableCell>
                      <TableCell className="min-w-64">
                        {r.reasons.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.reasons.map((reason, idx) => (
                              <Badge key={idx} variant="outline">{reason}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Uncategorized</span>
                        )}
                      </TableCell>
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



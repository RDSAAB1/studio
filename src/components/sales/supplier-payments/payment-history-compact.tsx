"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { Payment } from "@/lib/definitions";

interface PaymentHistoryCompactProps {
  payments: Payment[];
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
  historyType?: 'cash' | 'rtgs' | 'gov' | 'payment';
  maxRows?: number;
}

export const PaymentHistoryCompact = ({ payments, onEdit, onDelete, historyType = 'payment', maxRows }: PaymentHistoryCompactProps) => {
  // Sort payments by ID in descending order - prefix first, then number (highest first)
  const sortedPayments = React.useMemo(() => {
    // Deduplicate payments to prevent key collisions
    const seenKeys = new Set<string>();
    const uniquePayments = payments.filter(p => {
      // Prefer paymentId (e.g. RT001, C001) for deduplication as it's the logical ID
      // p.id is the Firestore document ID, which will be different for duplicates
      const key = p.paymentId || p.id;
      if (!key) return true; // If no ID, keep it (though it might cause issues if multiple have no ID)
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    return [...uniquePayments].sort((a, b) => {
      const idA = String(a?.paymentId || a?.id || '').trim().replace(/\s+/g, '');
      const idB = String(b?.paymentId || b?.id || '').trim().replace(/\s+/g, '');
      
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      
      // Parse ID into prefix and number parts
      // Handles: E832, EX00039, EX00138.1, P00081, RT00393, etc.
      const parseId = (id: string): { prefix: string; number: number; decimal: number } => {
        // Clean the ID - remove any non-alphanumeric characters except dots
        const cleanId = id.replace(/[^A-Za-z0-9.]/g, '');
        
        // Try to match: prefix (letters) + number + optional decimal
        const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
        if (match) {
          const prefix = match[1] || '';
          const numberStr = match[2] || '0';
          const decimalStr = match[3] || '0';
          
          return {
            prefix: prefix,
            number: parseInt(numberStr, 10) || 0,
            decimal: decimalStr ? parseInt(decimalStr, 10) : 0
          };
        }
        // If no match, treat entire ID as prefix
        return { prefix: cleanId || id, number: 0, decimal: 0 };
      };
      
      const parsedA = parseId(idA);
      const parsedB = parseId(idB);
      
      // First compare prefixes alphabetically (case-insensitive)
      const prefixA = parsedA.prefix.toUpperCase();
      const prefixB = parsedB.prefix.toUpperCase();
      const prefixCompare = prefixA.localeCompare(prefixB);
      if (prefixCompare !== 0) return prefixCompare;
      
      // If prefixes are same, compare numbers numerically (descending - highest first)
      if (parsedA.number !== parsedB.number) {
        return parsedB.number - parsedA.number;
      }
      
      // If numbers are same, compare decimal parts (descending)
      return parsedB.decimal - parsedA.decimal;
    });
  }, [payments]);

  // Helper function to get receipt numbers from paidFor array
  const getReceiptNumbers = React.useCallback((payment: Payment) => {
    if (payment.paidFor && payment.paidFor.length > 0) {
      return payment.paidFor.map((pf) => pf.srNo || '').filter(Boolean).join(', ');
    }
    return payment.parchiNo || '';
  }, []);

  // Helper function to get receipt numbers as array for display
  const getReceiptNumbersArray = React.useCallback((payment: Payment) => {
    if (payment.paidFor && payment.paidFor.length > 0) {
      return payment.paidFor.map((pf) => pf.srNo || '').filter(Boolean);
    }
    return payment.parchiNo ? [payment.parchiNo] : [];
  }, []);

  // Get payee account holder name (supplier)
  const getAccountHolderName = React.useCallback((payment: Payment) => {
    return payment.supplierName || (payment as any).supplierDetails?.name || '-';
  }, []);

  // Get RTGS bank details
  const getBankDetails = React.useCallback((payment: Payment) => {
    const paymentAny = payment as any;
    let bankName = paymentAny.bankName || payment.bankName || '-';
    
    // Extract full bank name if it's in format "SBI - State Bank of India"
    if (bankName.includes(' - ')) {
      const parts = bankName.split(' - ');
      if (parts.length > 1) {
        bankName = parts[1]; // Take the full name part
      }
    }
    
    return {
      accountNo: paymentAny.bankAcNo || payment.bankAcNo || '-',
      bankName: bankName,
      bankBranch: paymentAny.bankBranch || payment.bankBranch || '-',
      bankIfsc: paymentAny.bankIfsc || payment.bankIfsc || '-',
      checkNo: paymentAny.checkNo || payment.checkNo || '-',
    };
  }, []);

  // Get Center Name for Gov payments
  const getCenterName = React.useCallback((payment: Payment) => {
    return (payment as any).centerName || '-';
  }, []);

  // Calculate CD amount from payment
  const getCdAmount = React.useCallback((payment: Payment) => {
    // Check multiple possible fields for CD amount
    const paymentAny = payment as any;
    
    // First check if payment has direct cdAmount field
    if (typeof paymentAny.cdAmount === 'number' && paymentAny.cdAmount > 0) {
      return paymentAny.cdAmount;
    }
    
    // Check if CD amount is stored in paidFor array (sum all CD amounts)
    if (payment.paidFor && Array.isArray(payment.paidFor) && payment.paidFor.length > 0) {
      const totalCdFromPaidFor = payment.paidFor.reduce((sum: number, pf: any) => {
        const cdAmt = typeof pf.cdAmount === 'number' ? pf.cdAmount : 0;
        return sum + cdAmt;
      }, 0);
      if (totalCdFromPaidFor > 0) {
        return totalCdFromPaidFor;
      }
    }
    
    // Check other possible field names
    if (typeof paymentAny.creditCd === 'number' && paymentAny.creditCd > 0) {
      return paymentAny.creditCd;
    }
    if (typeof paymentAny.totalCd === 'number' && paymentAny.totalCd > 0) {
      return paymentAny.totalCd;
    }
    if (typeof paymentAny.cd === 'number' && paymentAny.cd > 0) {
      return paymentAny.cd;
    }
    
    // If not found, return 0
    return 0;
  }, []);

  const visiblePayments = React.useMemo(() => {
    return maxRows ? sortedPayments.slice(0, maxRows) : sortedPayments;
  }, [maxRows, sortedPayments]);

  return (
    <Card className="text-[9px] flex flex-col h-full overflow-hidden rounded-md">
      <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          {/* Fixed Header – flat, no rounding, so it reads as part of the table */}
          <div className="sticky top-0 z-30 bg-muted/50 border-b border-border rounded-none">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="h-1 border-b-0 overflow-hidden">
                  {historyType === 'cash' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[14%] text-left align-middle overflow-hidden">ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[12%] text-left align-middle overflow-hidden">Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[34%] text-left align-middle overflow-hidden">Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[16%] text-right align-middle overflow-hidden">Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-right align-middle overflow-hidden">CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-center align-middle overflow-hidden">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'rtgs' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden">ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden">Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[14%] text-left align-middle overflow-hidden">Account Holder</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[16%] text-left align-middle overflow-hidden">Bank / IFSC</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden">Check</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[28%] text-left align-middle overflow-hidden">Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-right align-middle overflow-hidden">Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-right align-middle overflow-hidden">CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-center align-middle overflow-hidden">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'gov' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[7%] text-left align-middle overflow-hidden">ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[7%] text-left align-middle overflow-hidden">Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[14%] text-left align-middle overflow-hidden">Center</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[38%] text-left align-middle overflow-hidden">Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-right align-middle overflow-hidden">Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-right align-middle overflow-hidden">CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[14%] text-center align-middle overflow-hidden">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'payment' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[8%] text-left align-middle overflow-hidden">ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[12%] text-left align-middle overflow-hidden">Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[22%] text-left align-middle overflow-hidden">Account Holder</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[16%] text-left align-middle overflow-hidden">Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-right align-middle overflow-hidden">Extra</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-right align-middle overflow-hidden">Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-right align-middle overflow-hidden">CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-center align-middle overflow-hidden">Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          {/* Scrollable Body – no gap, no rounding at top */}
          <div className={`flex-1 min-h-0 ${maxRows ? "overflow-x-hidden overflow-y-hidden" : "overflow-x-hidden overflow-y-auto"}`}>
            <Table className="table-fixed w-full">
              <TableBody>
                {visiblePayments.length === 0 ? (
                    <TableRow>
                    <TableCell colSpan={historyType === 'cash' ? 6 : historyType === 'rtgs' ? 9 : historyType === 'gov' ? 7 : historyType === 'payment' ? 8 : 7} className="text-center text-[9px] text-muted-foreground py-4">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  visiblePayments.map((payment, index) => {
                    const receiptNumbers = getReceiptNumbers(payment);
                    const cdAmount = getCdAmount(payment);
                    const extraAmountFromPaidFor =
                      payment.paidFor?.reduce((sum: number, pf: any) => sum + (Number((pf as any).extraAmount) || 0), 0) || 0;
                    const paymentReceiptType = String((payment as any).receiptType || '').trim().toLowerCase();
                    const extraAmountSign =
                      paymentReceiptType === 'ledger' && String((payment as any).drCr || '').toLowerCase() === 'credit' ? -1 : 1;
                    const extraAmountFromPaymentFields =
                      (Number((payment as any).extraAmount) || 0) + (Number((payment as any).advanceAmount) || 0);
                    const ledgerAmountFallback =
                      paymentReceiptType === 'ledger' &&
                      (payment.paidFor?.length || 0) === 0 &&
                      extraAmountFromPaymentFields === 0
                        ? Math.abs(Number((payment as any).amount || 0))
                        : 0;
                    const extraAmountFromPayment = extraAmountFromPaymentFields + ledgerAmountFallback;
                    const includePaymentLevelExtra =
                      extraAmountFromPaidFor === 0 || !(paymentReceiptType === 'ledger' || paymentReceiptType === 'online');
                    const extraAmount = extraAmountFromPaidFor + ((includePaymentLevelExtra ? extraAmountFromPayment : 0) * extraAmountSign);
                    const accountHolderName = getAccountHolderName(payment);
                    const bankDetails = getBankDetails(payment);
                    const centerName = getCenterName(payment);
                    const paymentDate = payment.date && isValid(new Date(payment.date))
                      ? format(new Date(payment.date), "dd-MMM-yy")
                      : '-';
                    
                    return (
                      <TableRow key={`${payment.id || payment.paymentId || 'pay'}-${index}`} className="h-5 border-b border-slate-200/70 text-slate-900 odd:bg-card/50 hover:bg-primary/5 transition-colors">
                        {historyType === 'cash' && (
                          <>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[14%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[12%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[9px] px-2 py-0.5 w-[34%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[9px] px-2 py-0.5 w-[16%] text-right align-middle">
                              <span className="font-extrabold text-slate-900 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[9px] px-2 py-0.5 w-[12%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {historyType === 'rtgs' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[14%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground truncate block font-medium">{accountHolderName}</span>
                                <span className="truncate block font-mono text-[9px] text-muted-foreground/80">{bankDetails.accountNo}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[16%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="truncate block font-medium">{bankDetails.bankName}</span>
                                <span className="truncate block text-[9px] text-muted-foreground/80">{bankDetails.bankBranch} / {bankDetails.bankIfsc}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="truncate block font-medium">{bankDetails.checkNo}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[28%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[10%] text-right align-middle">
                              <span className="font-extrabold text-slate-900 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[6%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {historyType === 'gov' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[7%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[7%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[14%] text-left align-middle">
                              <span className="truncate block font-medium">{centerName}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[38%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[12%] text-right align-middle">
                              <span className="font-extrabold text-slate-900 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[14%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {historyType === 'payment' && (
                          <>
                            <TableCell className="px-2 py-0.5 w-[8%] text-left align-top">
                              <div className="font-mono font-bold text-[10px] leading-none truncate">{payment.paymentId || payment.id}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-left align-top">
                              <div className="text-muted-foreground text-[9px] font-medium leading-none truncate">{paymentDate}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[22%] text-left align-top">
                              <div className="text-[9px] font-semibold leading-none truncate">{accountHolderName || '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[16%] text-left align-top">
                              <div className="text-[9px] text-muted-foreground font-medium leading-none truncate">{receiptNumbers || '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-right align-top">
                              <div className="text-[9px] font-semibold text-slate-700 leading-tight truncate">{extraAmount !== 0 ? formatCurrency(extraAmount) : '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-right align-top">
                              <div
                                className={`text-[9px] font-semibold leading-tight truncate ${
                                  Number(payment.amount || 0) < 0 ? 'text-rose-700' : 'text-slate-900'
                                }`}
                              >
                                {Number(payment.amount || 0) !== 0 ? formatCurrency(Math.abs(Number(payment.amount || 0))) : '-'}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[8%] text-right align-top">
                              <div className="text-[9px] font-semibold text-slate-600 leading-tight truncate">
                                {cdAmount > 0 ? formatCurrency(cdAmount) : '-'}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[10%] text-center align-top">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-primary/20 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-red-500/20 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

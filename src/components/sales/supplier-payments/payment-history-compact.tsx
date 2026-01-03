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
}

export const PaymentHistoryCompact = ({ payments, onEdit, onDelete, historyType = 'payment' }: PaymentHistoryCompactProps) => {
  // Sort payments by ID in descending order - prefix first, then number (highest first)
  const sortedPayments = React.useMemo(() => {
    return [...payments].sort((a, b) => {
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

  // Get Extra Amount for Gov payments
  const getExtraAmount = React.useCallback((payment: Payment) => {
    return (payment as any).extraAmount || 0;
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

  return (
    <Card className="text-[10px] flex flex-col h-full overflow-hidden border-2 border-primary/20 shadow-lg bg-gradient-to-br from-card via-card/95 to-card/90">
      <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          {/* Fixed Header */}
          <div className="sticky top-0 z-30 bg-primary/20 border-b-2 border-primary/30 shadow-sm backdrop-blur-sm">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="h-4 border-b-0">
                  {historyType === 'cash' && (
                    <>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[12%] text-left align-middle">ID</TableHead>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[10%] text-left align-middle">Date</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[25%] text-left align-middle">Paid For</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[15%] text-right align-middle">Paid</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[15%] text-right align-middle">CD</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[13%] text-center align-middle">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'rtgs' && (
                    <>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[10%] text-left align-middle">ID & Date</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[15%] text-left align-middle">Account Holder & No.</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[18%] text-left align-middle">Bank, Branch/IFSC</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[6%] text-left align-middle">Check No.</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[28%] text-left align-middle">Paid For</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[10%] text-right align-middle">Paid</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[8%] text-right align-middle">CD</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[5%] text-center align-middle">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'gov' && (
                    <>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[10%] text-left align-middle">ID & Date</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[12%] text-left align-middle">Center Name</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[35%] text-left align-middle">Paid For</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[12%] text-right align-middle">Paid</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[8%] text-right align-middle">CD</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[12%] text-right align-middle">Extra Amount</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[11%] text-center align-middle">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'payment' && (
                    <>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[12%] text-left">ID</TableHead>
                      <TableHead className="text-[11px] px-2 py-1 font-extrabold w-[10%] text-left">Date</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[20%] text-left">Account Holder</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[20%] text-left">Paid For</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[12%] text-right">Paid</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[10%] text-right">CD</TableHead>
                      <TableHead className="text-[10px] px-2 py-1 font-extrabold w-[16%] text-center">Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          {/* Scrollable Body */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
            <Table className="table-fixed w-full">
              <TableBody>
                {sortedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={historyType === 'cash' ? 6 : historyType === 'rtgs' ? 7 : historyType === 'gov' ? 6 : 7} className="text-center text-[10px] text-muted-foreground py-6">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPayments.map((payment) => {
                    const receiptNumbers = getReceiptNumbers(payment);
                    const cdAmount = getCdAmount(payment);
                    const accountHolderName = getAccountHolderName(payment);
                    const bankDetails = getBankDetails(payment);
                    const centerName = getCenterName(payment);
                    const paymentDate = payment.date && isValid(new Date(payment.date))
                      ? format(new Date(payment.date), "dd-MMM-yy")
                      : '-';
                    
                    return (
                      <TableRow key={payment.id || payment.paymentId} className="h-6 border-b border-border/30 hover:bg-primary/10 transition-colors">
                        {historyType === 'cash' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[12%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[11px] px-2 py-1 w-[10%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[25%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[15%] text-right align-middle">
                              <span className="font-extrabold text-green-600 dark:text-green-500 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[15%] text-right align-middle">
                              <span className="font-extrabold text-blue-600 dark:text-blue-500 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[13%] text-center align-middle">
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
                        {historyType === 'rtgs' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[10%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                                <span className="text-muted-foreground truncate block font-medium text-[10px]">{paymentDate}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[15%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground truncate block font-medium">{accountHolderName}</span>
                                <span className="truncate block font-mono text-[9px] text-muted-foreground/80">{bankDetails.accountNo}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[18%] text-left align-middle">
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
                              <span className="font-extrabold text-green-600 dark:text-green-500 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-right align-middle">
                              <span className="font-extrabold text-blue-600 dark:text-blue-500 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[5%] text-center align-middle">
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
                            <TableCell className="text-[11px] px-2 py-1 w-[10%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                                <span className="text-muted-foreground truncate block font-medium text-[10px]">{paymentDate}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[12%] text-left align-middle">
                              <span className="truncate block font-medium">{centerName}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[35%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[12%] text-right align-middle">
                              <span className="font-extrabold text-green-600 dark:text-green-500 truncate block">{formatCurrency(payment.amount || 0)}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-right align-middle">
                              <span className="font-extrabold text-blue-600 dark:text-blue-500 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[12%] text-right align-middle">
                              <span className="font-extrabold text-purple-600 dark:text-purple-500 truncate block">{getExtraAmount(payment) > 0 ? formatCurrency(getExtraAmount(payment)) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[11%] text-center align-middle">
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
                            <TableCell className="text-[11px] px-2 py-0.5 w-[12%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[11px] px-2 py-0.5 w-[10%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[20%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{accountHolderName || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[20%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[12%] text-right align-middle">
                              <span className="font-semibold text-green-600 dark:text-green-500 truncate block">{payment.amount > 0 ? formatCurrency(payment.amount) : '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-0.5 w-[10%] text-right align-middle">
                              <span className="font-semibold text-blue-600 dark:text-blue-500 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[16%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1.5">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-primary/20 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-red-500/20 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
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


"use client";

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Payment } from "@/lib/definitions";

interface PaymentHistoryCompactProps {
  payments: Payment[];
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
}

export const PaymentHistoryCompact = ({ payments, onEdit, onDelete }: PaymentHistoryCompactProps) => {
  // Sort payments by ID (descending - high to low)
  const sortedPayments = React.useMemo(() => {
    return [...payments].sort((a, b) => {
      const idA = a?.paymentId || a?.id || '';
      const idB = b?.paymentId || b?.id || '';
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      return idB.toString().localeCompare(idA.toString(), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [payments]);

  // Helper function to get receipt numbers from paidFor array
  const getReceiptNumbers = React.useCallback((payment: Payment) => {
    if (payment.paidFor && payment.paidFor.length > 0) {
      return payment.paidFor.map((pf) => pf.srNo || '').filter(Boolean).join(', ');
    }
    return payment.parchiNo || '';
  }, []);

  // Get payee account holder name (supplier)
  const getAccountHolderName = React.useCallback((payment: Payment) => {
    return payment.supplierName || (payment as any).supplierDetails?.name || '-';
  }, []);

  // Format date for display
  const formatPaymentDate = React.useCallback((dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
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
    <Card className="text-[10px] flex flex-col h-full">
      <CardContent className="p-0 flex flex-col flex-1 min-h-0">
        <div className="text-[10px] border border-b-0 rounded-t-lg overflow-hidden flex-shrink-0">
          <div className="overflow-x-auto border-b">
            <Table>
              <TableHeader>
                <TableRow className="border-b-0 h-6 bg-transparent">
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold align-middle">ID / Date</TableHead>
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold align-middle">Account Holder</TableHead>
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold align-middle">Paid For</TableHead>
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold text-right align-middle">Paid</TableHead>
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold text-right align-middle">CD</TableHead>
                  <TableHead className="text-[10px] px-1 py-0.5 font-bold text-center w-[80px] align-middle">Actions</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="overflow-x-auto">
            <Table>
              <TableBody>
                {sortedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-[10px] text-muted-foreground py-4 align-middle">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPayments.map((payment) => {
                    const receiptNumbers = getReceiptNumbers(payment);
                    const cdAmount = getCdAmount(payment);
                    const accountHolderName = getAccountHolderName(payment);
                    const paymentDate = formatPaymentDate(payment.date);
                    
                    return (
                      <TableRow key={payment.id || payment.paymentId} className="h-6">
                        <TableCell className="text-[10px] px-1 py-0.5 align-middle">
                          <div className="flex flex-col">
                            <span className="font-mono">{payment.paymentId || payment.id}</span>
                            <span className="text-muted-foreground text-[9px]">{paymentDate}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] px-1 py-0.5 align-middle">
                          <span className="text-muted-foreground">{accountHolderName}</span>
                        </TableCell>
                        <TableCell className="text-[10px] px-1 py-0.5 align-middle">
                          {receiptNumbers || '-'}
                        </TableCell>
                        <TableCell className="text-[10px] px-1 py-0.5 text-right font-medium align-middle">
                          {formatCurrency(payment.amount || 0)}
                        </TableCell>
                        <TableCell className="text-[10px] px-1 py-0.5 text-right font-medium align-middle">
                          {cdAmount > 0 ? formatCurrency(cdAmount) : '-'}
                        </TableCell>
                        <TableCell className="text-center px-1 py-0.5 align-middle">
                          <div className="flex items-center justify-center gap-1">
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
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
                                className="h-5 w-5"
                                onClick={() => onDelete(payment)}
                                title="Delete Payment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};


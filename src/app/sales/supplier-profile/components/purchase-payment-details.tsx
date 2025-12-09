"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { CustomerSummary, Payment } from "@/lib/definitions";

// Local formatSerialNumber function to avoid import issues
const formatSerialNumber = (srNo: string | number): string => {
  const numStr = String(srNo).replace(/[^0-9]/g, '');
  const paddedNum = numStr.padStart(5, '0');
  return `S${paddedNum}`;
};

interface PurchasePaymentDetailsProps {
  supplierData: CustomerSummary | null;
  isMillOverview?: boolean;
}

export const PurchasePaymentDetails: React.FC<PurchasePaymentDetailsProps> = ({
  supplierData,
  isMillOverview = false,
}) => {
  if (!supplierData) return null;

  // Create a detailed breakdown of payments per purchase
  const purchasePaymentBreakdown = React.useMemo(() => {
    const breakdown: Array<{
      srNo: string;
      originalAmount: number;
      totalPaid: number;
      cashPaid: number;
      rtgsPaid: number;
      outstanding: number;
      paymentDetails: Payment[];
    }> = [];

    // Process each transaction/purchase
    supplierData.allTransactions?.forEach(transaction => {
      const srNo = transaction.srNo || '';
      // Use adjustedOriginal if available (includes Gov. Required amount), otherwise use originalNetAmount
      const originalAmount = (transaction as any).adjustedOriginal !== undefined 
        ? (transaction as any).adjustedOriginal 
        : (transaction.originalNetAmount || 0);
      
      // Find all payments for this specific purchase
      const paymentsForThisPurchase = supplierData.allPayments?.filter(payment =>
        payment.paidFor?.some(pf => pf.srNo === srNo)
      ) || [];

      let totalPaid = 0;
      let totalCd = 0;
      let cashPaid = 0;
      let rtgsPaid = 0;

      paymentsForThisPurchase.forEach(payment => {
        const paidForThisPurchase = payment.paidFor?.find(pf => pf.srNo === srNo);
        if (paidForThisPurchase) {
          totalPaid += paidForThisPurchase.amount || 0;
          totalCd += paidForThisPurchase.cdAmount || 0;
          
          if (payment.type === 'cash') {
            cashPaid += paidForThisPurchase.amount || 0;
          } else if (payment.type === 'rtgs') {
            rtgsPaid += paidForThisPurchase.amount || 0;
          }
        }
      });

      // Outstanding = Adjusted Original - Total Paid - Total CD
      const outstanding = originalAmount - totalPaid - totalCd;

      breakdown.push({
        srNo,
        originalAmount,
        totalPaid,
        cashPaid,
        rtgsPaid,
        outstanding,
        paymentDetails: paymentsForThisPurchase,
      });
    });

    return breakdown;
  }, [supplierData]);

  if (purchasePaymentBreakdown.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isMillOverview ? 'Mill Overview - Purchase Payment Details' : 'Purchase Payment Breakdown'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purchase #</TableHead>
                <TableHead>Base Original</TableHead>
                <TableHead>Extra Amount</TableHead>
                <TableHead>Adjusted Original</TableHead>
                <TableHead>Total Paid</TableHead>
                <TableHead>Cash Paid</TableHead>
                <TableHead>RTGS Paid</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchasePaymentBreakdown.map((purchase, index) => {
                // Get base original amount (without extra amount)
                const baseOriginal = supplierData.allTransactions?.find(t => t.srNo === purchase.srNo)?.originalNetAmount || 0;
                const extraAmount = purchase.originalAmount - baseOriginal;
                
                return (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatSerialNumber(purchase.srNo)}
                    </TableCell>
                    <TableCell>{formatCurrency(baseOriginal)}</TableCell>
                    <TableCell className={extraAmount > 0 ? "text-green-600 font-semibold" : ""}>
                      {extraAmount > 0 ? `+ ${formatCurrency(extraAmount)}` : '-'}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(purchase.originalAmount)}</TableCell>
                    <TableCell>{formatCurrency(purchase.totalPaid)}</TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(purchase.cashPaid)}
                    </TableCell>
                    <TableCell className="text-blue-600">
                      {formatCurrency(purchase.rtgsPaid)}
                    </TableCell>
                    <TableCell className={purchase.outstanding > 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                      {formatCurrency(purchase.outstanding)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={purchase.outstanding > 0 ? "destructive" : "default"}>
                        {purchase.outstanding > 0 ? "Outstanding" : "Paid"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-primary/5 rounded border border-primary/20">
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(purchasePaymentBreakdown.reduce((sum, p) => sum + p.originalAmount, 0))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Total Original Amount</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(purchasePaymentBreakdown.reduce((sum, p) => sum + p.totalPaid, 0))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Total Paid</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(purchasePaymentBreakdown.reduce((sum, p) => sum + p.cashPaid, 0))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">Cash Paid</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded border border-indigo-200">
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(purchasePaymentBreakdown.reduce((sum, p) => sum + p.rtgsPaid, 0))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">RTGS Paid</div>
            </div>
          </div>
          
          {/* Extra Amount and Outstanding Summary */}
          <div className="grid grid-cols-2 gap-4">
            {(() => {
              // Calculate total extra amount from Gov. payments
              const totalExtraAmount = purchasePaymentBreakdown.reduce((sum, p) => {
                // Find Gov. payment for this purchase
                const govPayment = p.paymentDetails.find(payment => (payment as any).receiptType === 'Gov.');
                if (govPayment) {
                  const paidForThis = govPayment.paidFor?.find((pf: any) => pf.srNo === p.srNo);
                  if (paidForThis) {
                    const extraAmount = (paidForThis as any).extraAmount || 0;
                    return sum + extraAmount;
                  }
                }
                return sum;
              }, 0);
              
              return (
                <>
                  {totalExtraAmount > 0 && (
                    <div className="text-center p-4 bg-green-50 rounded border border-green-200">
                      <div className="text-xl font-bold text-green-600">
                        + {formatCurrency(totalExtraAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Extra Amount (Gov. Payment)</div>
                    </div>
                  )}
                  <div className="text-center p-4 bg-red-50 rounded border border-red-200">
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(purchasePaymentBreakdown.reduce((sum, p) => sum + p.outstanding, 0))}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Total Outstanding</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

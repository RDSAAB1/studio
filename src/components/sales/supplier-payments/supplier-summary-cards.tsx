"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Scale, FileText, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Customer, Payment } from "@/lib/definitions";

interface SupplierSummary {
  totalGrossWeight: number;
  totalTeirWeight: number;
  totalFinalWeight: number;
  totalKartaWeight: number;
  totalNetWeight: number;
  totalAmount: number;
  totalKartaAmount: number;
  totalLabouryAmount: number;
  totalKanta: number;
  totalBrokerage?: number;
  totalOriginalAmount: number;
  totalPaid: number;
  totalCdAmount: number;
  totalCashPaid: number;
  totalRtgsPaid: number;
  totalOutstanding: number;
  averageRate: number;
  minRate: number;
  maxRate: number;
  averageKartaPercentage: number;
  averageLabouryRate: number;
  averageOriginalPrice?: number;
  totalExtraAmount?: number;
  totalAdjustedOriginal?: number;
  allTransactions?: Customer[];
  allPayments?: Payment[];
  outstandingEntryIds?: string[];
}

interface SupplierSummaryCardsProps {
  summary: SupplierSummary;
}

// Helper functions for formatting
const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatWeightLocal = (value: number | string | null | undefined) => {
  return `${toNumber(value).toFixed(2)} kg`;
};

const formatPercentageLocal = (value: number | string | null | undefined) => {
  return `${toNumber(value).toFixed(2)}%`;
};

const formatRateLocal = (value: number | string | null | undefined) => {
  const numericValue = toNumber(value);
  return `₹${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDecimalLocal = (value: number | string | null | undefined) => {
  return toNumber(value).toFixed(2);
};

export function SupplierSummaryCards({ summary }: SupplierSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
      {/* Operational Summary Card */}
      <Card className="border border-gray-400/50">
        <CardHeader className="pb-1 px-2 pt-2">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
            <Scale size={12} className="text-muted-foreground"/>
            Operational Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 px-2 pb-2 text-[11px]">
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Wt:</span>
              <span className="font-medium">{formatWeightLocal(summary.totalGrossWeight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Teir Wt:</span>
              <span className="font-medium">{formatWeightLocal(summary.totalTeirWeight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Final Wt:</span>
              <span className="font-bold">{formatWeightLocal(summary.totalFinalWeight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Karta Wt (@{formatPercentageLocal(summary.averageKartaPercentage)}):</span>
              <span className="font-medium">{formatWeightLocal(summary.totalKartaWeight)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Net Wt:</span>
              <span className="font-bold text-primary">{formatWeightLocal(summary.totalNetWeight)}</span>
            </div>
          </div>
          <Separator className="my-1"/>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average Rate:</span>
              <span className="font-medium">{formatRateLocal(summary.averageRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Rate:</span>
              <span className="font-medium">{formatRateLocal(summary.minRate || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Rate:</span>
              <span className="font-medium">{formatRateLocal(summary.maxRate || 0)}</span>
            </div>
            {(summary.averageOriginalPrice || 0) > 0 && (
              <div className="flex justify-between pt-0.5 border-t border-muted">
                <span className="text-muted-foreground text-[10px]">Avg. Original Price:</span>
                <span className="font-medium text-[10px]">{formatRateLocal(summary.averageOriginalPrice || 0)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deduction Summary Card */}
      <Card className="border border-gray-400/50">
        <CardHeader className="pb-1 px-2 pt-2">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
            <FileText size={12} className="text-muted-foreground"/>
            Deduction Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0.5 px-2 pb-2 text-[11px]">
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount (@{formatRateLocal(summary.averageRate)}/kg):</span>
              <span className="font-medium">{formatCurrency(summary.totalAmount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Karta (@{formatPercentageLocal(summary.averageKartaPercentage)}):</span>
              <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(summary.totalKartaAmount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Laboury (@{formatDecimalLocal(summary.averageLabouryRate)}):</span>
              <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(summary.totalLabouryAmount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Kanta:</span>
              <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(summary.totalKanta || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Other:</span>
              <span className="font-medium text-red-500 dark:text-red-400">- {formatCurrency(summary.totalBrokerage || 0)}</span>
            </div>
            <div className="flex justify-between pt-0.5 border-t border-muted">
              <span className="text-muted-foreground text-[10px]">Total Deductions:</span>
              <span className="font-semibold text-red-500 dark:text-red-400 text-[10px]">
                - {formatCurrency(
                  (summary.totalKartaAmount || 0) +
                  (summary.totalLabouryAmount || 0) +
                  (summary.totalKanta || 0) +
                  (summary.totalBrokerage || 0)
                )}
              </span>
            </div>
            <Separator className="my-1"/>
            <div className="flex justify-between pt-0.5">
              <span className="text-muted-foreground font-semibold">Original Amount:</span>
              <span className="font-bold">{formatCurrency(summary.totalOriginalAmount || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary Card */}
      <Card className="border border-gray-400/50">
        <CardHeader className="pb-1 px-2 pt-2">
          <CardTitle className="text-[12px] font-semibold flex items-center gap-1.5">
            <Banknote size={12} className="text-muted-foreground"/>
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 px-2 pb-2 text-[11px]">
          {/* Original Amount Section */}
          <div className="space-y-0.5 bg-primary/5 p-1.5 rounded border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-medium">Base Original Amount:</span>
              <span className="font-semibold text-primary">{formatCurrency(summary.totalOriginalAmount || 0)}</span>
            </div>
            {(summary.totalExtraAmount || 0) > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-[10px]">Extra Amount (Gov.):</span>
                  <span className="font-semibold text-green-600 text-[10px]">+ {formatCurrency(summary.totalExtraAmount || 0)}</span>
                </div>
                <Separator className="my-0.5"/>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Adjusted Original:</span>
                  <span className="font-bold text-primary text-xs">{formatCurrency(summary.totalAdjustedOriginal || summary.totalOriginalAmount || 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Payment Breakdown */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(summary.totalPaid || 0)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span className="text-muted-foreground text-[10px]">• Cash Paid:</span>
              <span className="font-medium text-green-500 text-[10px]">{formatCurrency(summary.totalCashPaid || 0)}</span>
            </div>
            <div className="flex justify-between pl-2">
              <span className="text-muted-foreground text-[10px]">• RTGS Paid:</span>
              <span className="font-medium text-green-500 text-[10px]">{formatCurrency(summary.totalRtgsPaid || 0)}</span>
            </div>
            {(() => {
              // IMPORTANT: Sum ALL paidFor amounts for Gov payments, not just one entry per payment
              // This ensures all entries in a single Gov payment are counted
              const govPaid = (summary.allPayments || [])
                .filter((p: Payment) => {
                  const receiptType = ((p as any).receiptType || '').trim();
                  return receiptType === 'Gov.' || receiptType.toLowerCase() === 'gov' || receiptType.toLowerCase().startsWith('gov');
                })
                .reduce((sum: number, p: Payment) => {
                  // Sum ALL paidFor amounts for this Gov payment that match filtered transactions
                  const matchingPaidFor = p.paidFor?.filter(pf => 
                    (summary.allTransactions || []).some((t: Customer) => t.srNo === pf.srNo)
                  ) || [];
                  
                  // Sum ALL matching paidFor amounts, not just one
                  const govPaidForThisPayment = matchingPaidFor.reduce((paymentSum, pf) => 
                    paymentSum + (pf.amount || 0), 0
                  );
                  
                  return sum + govPaidForThisPayment;
                }, 0);
              if (govPaid > 0) {
                return (
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground text-[10px]">• Gov. Paid:</span>
                    <span className="font-medium text-green-500 text-[10px]">{formatCurrency(govPaid)}</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total CD Granted:</span>
              <span className="font-medium text-blue-600">{formatCurrency(summary.totalCdAmount || 0)}</span>
            </div>
          </div>
          
          <Separator className="my-1"/>
          
          {/* Transaction Stats */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Transactions:</span>
              <span className="font-medium">{summary.allTransactions?.length || 0} Entries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Entries:</span>
              <span className="font-medium text-red-500 dark:text-red-400">{summary.outstandingEntryIds?.length || 0} Entries</span>
            </div>
          </div>
          
          <Separator className="my-1"/>
          
          {/* Final Outstanding */}
          <div className="bg-red-50 dark:bg-red-950/20 p-1.5 rounded border border-red-200 dark:border-red-800">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold">Final Outstanding:</span>
              <span className="font-bold text-red-600 dark:text-red-400 text-sm">{formatCurrency(summary.totalOutstanding || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


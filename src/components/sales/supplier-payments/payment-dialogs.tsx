"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SupplierStatementPreview } from "@/app/sales/supplier-profile/components/supplier-statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';
import { formatCurrency } from "@/lib/utils";
import type { Payment } from "@/lib/definitions";

interface PaymentDialogsProps {
  // Statement Dialog
  isStatementOpen: boolean;
  setIsStatementOpen: (open: boolean) => void;
  selectedSupplierSummary: any;
  filteredSupplierSummary: any;

  // Summary Dialog
  isSummaryOpen: boolean;
  setIsSummaryOpen: (open: boolean) => void;

  // History Dialog
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  selectedHistoryType: 'cash' | 'gov' | 'rtgs';
  cashHistoryRows: Payment[];
  rtgsHistoryRows: Payment[];
  govHistoryRows: Payment[];
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (payment: Payment) => void;
  type?: 'supplier' | 'customer';
}

export function PaymentDialogs({
  isStatementOpen,
  setIsStatementOpen,
  selectedSupplierSummary,
  filteredSupplierSummary,
  isSummaryOpen,
  setIsSummaryOpen,
  historyDialogOpen,
  setHistoryDialogOpen,
  selectedHistoryType,
  cashHistoryRows,
  rtgsHistoryRows,
  govHistoryRows,
  onEditPayment,
  onDeletePayment,
  type = 'supplier',
}: PaymentDialogsProps) {
  return (
    <>
      {/* Overall Statement Dialog (Generate Statement) */}
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 printable-statement-container bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Overall Statement</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-background">
            {selectedSupplierSummary ? (
              <SupplierStatementPreview data={filteredSupplierSummary} type={type} />
            ) : (
              <div className="p-4 text-center text-muted-foreground">No supplier selected</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="max-w-[min(1400px,98vw)] w-[min(1400px,98vw)] p-0 overflow-hidden">
          <div className="flex h-[min(88vh,820px)] flex-col">
            <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-primary via-primary/95 to-primary/90 text-white shadow-[0_12px_30px_rgba(88,28,135,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <DialogTitle className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                    Payment Summary
                  </DialogTitle>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-primary-100/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                    Current filters ke hisaab se supplier ka full statement summary.
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 bg-gradient-to-b from-primary/15 via-background to-background">
              <ScrollArea className="h-full pr-3">
                {filteredSupplierSummary ? (
                  (() => {
                    const summary: any = filteredSupplierSummary;
                    const totalOutstanding = summary.totalOutstanding || 0;
                    const totalNetWeight = summary.totalNetWeight || 0;
                    const totalGrossWeight = summary.totalGrossWeight || 0;
                    const totalFinalWeight = summary.totalFinalWeight || 0;
                    const totalPaid = summary.totalPaid || 0;
                    const totalCashPaid = summary.totalCashPaid || 0;
                    const totalRtgsPaid = summary.totalRtgsPaid || 0;
                    const govPaid = summary.govPaid || 0;
                    const minRate = summary.minRate || 0;
                    const maxRate = summary.maxRate || 0;
                    const avgRate = summary.averageRate || 0;
                    const totalKartaAmount = summary.totalKartaAmount || 0;
                    const totalLabouryAmount = summary.totalLabouryAmount || 0;
                    const totalKanta = summary.totalKanta || 0;
                    const totalBrokerage = summary.totalBrokerage || 0;
                    const baseOriginalAmount = summary.totalBaseOriginalAmount ?? summary.totalOriginalAmount ?? 0;
                    const govExtraAmount = summary.totalGovExtraAmount ?? 0;
                    const adjustedOriginalAmount = summary.totalOriginalAmount || 0;
                    const ledgerCreditAmount = summary.ledgerCreditAmount || 0;
                    const ledgerDebitAmount = summary.ledgerDebitAmount || 0;
                    const totalCdAmount = summary.totalCdAmount || 0;
                    const totalDeductions =
                      totalKartaAmount +
                      totalLabouryAmount +
                      totalKanta +
                      totalBrokerage;
                    const rateSpread = Math.max(0, maxRate - minRate);
                    const averageOriginalPrice = summary.averageOriginalPrice || 0;
                    const averageLabouryRate = summary.averageLabouryRate || 0;
                    const txCount = (summary.allTransactions?.length as number) || 0;
                    const outstandingCount = (summary.outstandingEntryIds?.length as number) || 0;
                    const paidCount = Math.max(0, txCount - outstandingCount);

                    const paidShareDenom = totalPaid > 0 ? totalPaid : 1;
                    const netLedgerImpact = ledgerDebitAmount - ledgerCreditAmount;
                    const netBillAmount = baseOriginalAmount + govExtraAmount + ledgerCreditAmount;
                    const cashPct = Math.max(0, Math.min(100, (totalCashPaid / paidShareDenom) * 100));
                    const rtgsPct = Math.max(0, Math.min(100, (totalRtgsPaid / paidShareDenom) * 100));
                    const govPct = Math.max(0, Math.min(100, (govPaid / paidShareDenom) * 100));

                    return (
                      <div className="w-full min-w-0 space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 bg-slate-50">
                        <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
                          <Card className="border-emerald-200 bg-emerald-50/90 shadow-sm">
                            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
                              <div className="text-[11px] font-medium text-emerald-900/90">Net Bill Amount</div>
                              <div className="mt-1 text-lg sm:text-xl font-semibold text-emerald-950 tabular-nums">
                                {formatCurrency(netBillAmount)}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-rose-200 bg-rose-50/90 shadow-sm">
                            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
                              <div className="text-[11px] font-medium text-rose-900/90">Outstanding</div>
                              <div className="mt-1 text-lg sm:text-xl font-semibold text-rose-950 tabular-nums">
                                {formatCurrency(totalOutstanding)}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-slate-200 bg-slate-50 shadow-sm">
                            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
                              <div className="text-[11px] font-medium text-slate-800">Net Weight (kg)</div>
                              <div className="mt-1 text-lg sm:text-xl font-semibold text-slate-950 tabular-nums">
                                {Number(totalNetWeight || 0).toFixed(2)}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-indigo-200 bg-indigo-50/90 shadow-sm">
                            <CardContent className="py-3 px-3 sm:py-4 sm:px-4">
                              <div className="text-[11px] font-medium text-indigo-900/90">Entries (Paid/Total)</div>
                              <div className="mt-1 text-lg sm:text-xl font-semibold text-indigo-950 tabular-nums">
                                {paidCount} / {txCount}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                          <Card className="border-slate-200 bg-white shadow-sm">
                            <CardHeader className="py-2.5 px-3 sm:px-4 border-b">
                              <CardTitle className="text-xs font-semibold text-slate-800">Weights & Entries</CardTitle>
                            </CardHeader>
                            <CardContent className="py-2.5 px-3 sm:px-4 space-y-1.5 text-[11px] text-slate-800">
                              <div className="flex justify-between"><span>Gross</span><span className="font-semibold tabular-nums">{Number(totalGrossWeight || 0).toFixed(2)} kg</span></div>
                              <div className="flex justify-between"><span>Teir</span><span className="font-semibold tabular-nums">{Number(summary.totalTeirWeight || 0).toFixed(2)} kg</span></div>
                              <div className="flex justify-between"><span>Final</span><span className="font-semibold tabular-nums">{Number(totalFinalWeight || 0).toFixed(2)} kg</span></div>
                              <div className="flex justify-between"><span>Net</span><span className="font-semibold tabular-nums">{Number(totalNetWeight || 0).toFixed(2)} kg</span></div>
                            </CardContent>
                          </Card>

                          <Card className="border-slate-200 bg-white shadow-sm">
                            <CardHeader className="py-2.5 px-3 sm:px-4 border-b">
                              <CardTitle className="text-xs font-semibold text-slate-800">Bill Amounts</CardTitle>
                            </CardHeader>
                            <CardContent className="py-2.5 px-3 sm:px-4 space-y-1.5 text-[11px] text-slate-800">
                              <div className="flex justify-between"><span>Total Amount</span><span className="font-semibold tabular-nums">{formatCurrency(summary.totalAmount ?? 0)}</span></div>
                              <div className="flex justify-between"><span>Total Deductions</span><span className="font-semibold tabular-nums text-rose-700">- {formatCurrency(totalDeductions)}</span></div>
                              <div className="flex justify-between"><span>Base Original</span><span className="font-semibold tabular-nums">{formatCurrency(baseOriginalAmount)}</span></div>
                              {govExtraAmount > 0 && <div className="flex justify-between"><span>Gov Extra</span><span className="font-semibold tabular-nums">{formatCurrency(govExtraAmount)}</span></div>}
                            </CardContent>
                          </Card>

                          <Card className="border-slate-200 bg-white shadow-sm">
                            <CardHeader className="py-2.5 px-3 sm:px-4 border-b">
                              <CardTitle className="text-xs font-semibold text-slate-800">Payment Status & Ledger</CardTitle>
                            </CardHeader>
                            <CardContent className="py-2.5 px-3 sm:px-4 space-y-1.5 text-[11px] text-slate-800">
                              <div className="flex justify-between"><span>Total Paid</span><span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(totalPaid)}</span></div>
                              <div className="flex justify-between"><span>Outstanding</span><span className="font-semibold tabular-nums text-rose-700">{formatCurrency(totalOutstanding)}</span></div>
                              {(ledgerCreditAmount > 0 || ledgerDebitAmount > 0) && (
                                <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 font-semibold">
                                  <span>Net Ledger Impact</span>
                                  <span className="tabular-nums">{formatCurrency(netLedgerImpact)}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="p-6 text-center text-muted-foreground">Select a supplier to view summary</div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">
              {selectedHistoryType === 'cash' && 'Cash History'}
              {selectedHistoryType === 'rtgs' && 'RTGS History'}
              {selectedHistoryType === 'gov' && 'Gov History'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto p-6">
            {selectedHistoryType === 'cash' && (
              <PaymentHistoryCompact
                payments={cashHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="cash"
              />
            )}
            {selectedHistoryType === 'rtgs' && (
              <PaymentHistoryCompact
                payments={rtgsHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="rtgs"
              />
            )}
            {selectedHistoryType === 'gov' && (
              <PaymentHistoryCompact
                payments={govHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="gov"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}




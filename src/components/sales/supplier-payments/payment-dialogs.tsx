"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatementPreview } from "@/app/sales/supplier-profile/components/statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';
import type { Payment } from "@/lib/definitions";

interface PaymentDialogsProps {
  // Statement Dialog
  isStatementOpen: boolean;
  setIsStatementOpen: (open: boolean) => void;
  selectedSupplierSummary: any;
  filteredSupplierSummary: any;

  // History Dialog
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  selectedHistoryType: 'cash' | 'gov' | 'rtgs';
  cashHistoryRows: Payment[];
  rtgsHistoryRows: Payment[];
  govHistoryRows: Payment[];
  onEditPayment: (payment: Payment) => void;
  onDeletePayment: (paymentId: string) => void;
}

export function PaymentDialogs({
  isStatementOpen,
  setIsStatementOpen,
  selectedSupplierSummary,
  filteredSupplierSummary,
  historyDialogOpen,
  setHistoryDialogOpen,
  selectedHistoryType,
  cashHistoryRows,
  rtgsHistoryRows,
  govHistoryRows,
  onEditPayment,
  onDeletePayment,
}: PaymentDialogsProps) {
  return (
    <>
      {/* Statement Preview Dialog */}
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 printable-statement-container bg-card">
          <DialogHeader className="sr-only">
            <DialogTitle>Statement Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto bg-background">
            {selectedSupplierSummary ? (
              <StatementPreview data={filteredSupplierSummary} />
            ) : (
              <div className="p-4 text-center text-muted-foreground">No supplier selected</div>
            )}
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




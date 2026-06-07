"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SupplierStatementPreview } from "@/app/sales/supplier-profile/components/supplier-statement-preview";
import { PaymentHistoryCompact } from '@/components/sales/supplier-payments/payment-history-compact';
import { formatCurrency, cn } from "@/lib/utils";
import type { Payment, Customer } from "@/lib/definitions";

interface PaymentDialogsProps {
  // Statement Dialog
  isStatementOpen: boolean;
  setIsStatementOpen: (open: boolean) => void;
  selectedSupplierSummary: any;
  filteredSupplierSummary: any;

  // History Dialog
  historyDialogOpen: boolean;
  setHistoryDialogOpen: (open: boolean) => void;
  selectedHistoryType: 'cash' | 'gov' | 'rtgs' | 'online' | 'ledger';
  cashHistoryRows: Payment[];
  rtgsHistoryRows: Payment[];
  govHistoryRows: Payment[];
  onlineHistoryRows: Payment[];
  ledgerHistoryRows: Payment[];
  onEditPayment?: (payment: Payment) => void;
  onDeletePayment?: (payment: Payment) => void;
  type?: 'supplier' | 'customer';
  suppliers?: Customer[];
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
  onlineHistoryRows,
  ledgerHistoryRows,
  onEditPayment,
  onDeletePayment,
  type = 'supplier',
  suppliers = [],
}: PaymentDialogsProps) {
  return (
    <>
      {/* Overall Statement Dialog (Generate Statement) */}
      <Dialog open={isStatementOpen} onOpenChange={setIsStatementOpen}>
        <DialogContent 
          className="max-w-5xl max-h-[90vh] flex flex-col p-0 printable-statement-container bg-card"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
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

      {/* Full Screen History Dialog */}
            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent 
          className="max-w-[min(1800px,98vw)] max-h-[95vh] w-full h-full flex flex-col p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-lg font-semibold">
              {selectedHistoryType === 'cash' && 'Cash History'}
              {selectedHistoryType === 'online' && 'Online History'}
              {selectedHistoryType === 'ledger' && 'Ledger History'}
              {type !== 'customer' && selectedHistoryType === 'rtgs' && 'RTGS History'}
              {type !== 'customer' && selectedHistoryType === 'gov' && 'Gov History'}
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
            {selectedHistoryType === 'online' && (
              <PaymentHistoryCompact
                payments={onlineHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="online"
              />
            )}
            {selectedHistoryType === 'ledger' && (
              <PaymentHistoryCompact
                payments={ledgerHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="ledger"
              />
            )}
            {type !== 'customer' && selectedHistoryType === 'rtgs' && (
              <PaymentHistoryCompact
                payments={rtgsHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="rtgs"
              />
            )}
            {type !== 'customer' && selectedHistoryType === 'gov' && (
              <PaymentHistoryCompact
                payments={govHistoryRows}
                onEdit={onEditPayment}
                onDelete={onDeletePayment}
                historyType="gov"
                suppliers={suppliers}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}




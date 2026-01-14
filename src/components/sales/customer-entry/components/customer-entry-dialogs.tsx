import type { Customer, CustomerPayment, DocumentType, ConsolidatedReceiptData, ReceiptSettings } from "@/lib/definitions";
import { CustomerDetailsDialog } from "@/components/sales/customer-details-dialog";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface CustomerEntryDialogsProps {
  // Details dialog
  detailsCustomer: Customer | null;
  setDetailsCustomer: (customer: Customer | null) => void;
  onPrintPreview: (customer: Customer) => void;
  paymentHistory: CustomerPayment[];
  
  // Document preview dialog
  isDocumentPreviewOpen: boolean;
  setIsDocumentPreviewOpen: (open: boolean) => void;
  documentPreviewCustomer: Customer | null;
  documentType: DocumentType;
  setDocumentType: (type: DocumentType) => void;
  receiptSettings: ReceiptSettings;
  
  // Receipt print dialogs
  receiptsToPrint: Customer[];
  setReceiptsToPrint: (receipts: Customer[]) => void;
  consolidatedReceiptData: ConsolidatedReceiptData | null;
  setConsolidatedReceiptData: (data: ConsolidatedReceiptData | null) => void;
  
  // Update confirm dialog
  isUpdateConfirmOpen: boolean;
  setIsUpdateConfirmOpen: (open: boolean) => void;
  onUpdateConfirm: (deletePayments: boolean) => void;
  
  // Import progress dialog
  isImporting: boolean;
  importProgress: number;
  importStatus: string;
  importCurrent: number;
  importTotal: number;
  importStartTime: number | null;
}

export function CustomerEntryDialogs({
  detailsCustomer,
  setDetailsCustomer,
  onPrintPreview,
  paymentHistory,
  isDocumentPreviewOpen,
  setIsDocumentPreviewOpen,
  documentPreviewCustomer,
  documentType,
  setDocumentType,
  receiptSettings,
  receiptsToPrint,
  setReceiptsToPrint,
  consolidatedReceiptData,
  setConsolidatedReceiptData,
  isUpdateConfirmOpen,
  setIsUpdateConfirmOpen,
  onUpdateConfirm,
  isImporting,
  importProgress,
  importStatus,
  importCurrent,
  importTotal,
  importStartTime,
}: CustomerEntryDialogsProps) {
  return (
    <>
      <CustomerDetailsDialog
        customer={detailsCustomer}
        onOpenChange={() => setDetailsCustomer(null)}
        onPrint={onPrintPreview}
        paymentHistory={paymentHistory}
      />
        
      <DocumentPreviewDialog
        isOpen={isDocumentPreviewOpen}
        setIsOpen={setIsDocumentPreviewOpen}
        customer={documentPreviewCustomer}
        documentType={documentType}
        setDocumentType={setDocumentType}
        receiptSettings={receiptSettings}
      />
      
      <ReceiptPrintDialog
        receipts={receiptsToPrint}
        settings={receiptSettings}
        onOpenChange={() => setReceiptsToPrint([])}
        isCustomer={true}
      />
      
      <ConsolidatedReceiptPrintDialog
        data={consolidatedReceiptData}
        settings={receiptSettings}
        onOpenChange={() => setConsolidatedReceiptData(null)}
        isCustomer={true}
      />

      <UpdateConfirmDialog
        isOpen={isUpdateConfirmOpen}
        onOpenChange={setIsUpdateConfirmOpen}
        onConfirm={onUpdateConfirm}
      />

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importing Customer Entries</DialogTitle>
            <DialogDescription>
              Please wait while we import your data...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{importStatus}</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
            
            {importTotal > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-medium text-foreground">
                    {importCurrent} / {importTotal} entries
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Remaining:</span>
                  <span className="font-medium text-foreground">
                    {importTotal - importCurrent} entries
                  </span>
                </div>
                {importStartTime && importCurrent > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Time elapsed:</span>
                      <span className="font-medium text-foreground">
                        {((Date.now() - importStartTime) / 1000).toFixed(1)}s
                      </span>
                    </div>
                    {(() => {
                      const elapsed = (Date.now() - importStartTime) / 1000;
                      const avgTimePerItem = elapsed / importCurrent;
                      const estimatedTotal = avgTimePerItem * importTotal;
                      const remainingTime = estimatedTotal - elapsed;
                      
                      if (remainingTime > 0 && importCurrent < importTotal) {
                        let timeStr = '';
                        if (remainingTime < 60) {
                          timeStr = `${Math.ceil(remainingTime)}s`;
                        } else if (remainingTime < 3600) {
                          const minutes = Math.floor(remainingTime / 60);
                          const seconds = Math.ceil(remainingTime % 60);
                          timeStr = `${minutes}m ${seconds}s`;
                        } else {
                          const hours = Math.floor(remainingTime / 3600);
                          const minutes = Math.floor((remainingTime % 3600) / 60);
                          timeStr = `${hours}h ${minutes}m`;
                        }
                        return (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Estimated time remaining:</span>
                            <span className="font-medium text-primary">
                              ~{timeStr}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}




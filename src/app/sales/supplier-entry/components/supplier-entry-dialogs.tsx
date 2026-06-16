import type { Customer, ConsolidatedReceiptData, ReceiptSettings, DocumentType } from "@/lib/definitions";
import { CombinedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SupplierEntryDialogsProps {
  // Receipt print dialog
  receiptsToPrint: Customer[];
  setReceiptsToPrint: (receipts: Customer[]) => void;
  consolidatedReceiptData: ConsolidatedReceiptData | null;
  setConsolidatedReceiptData: (data: ConsolidatedReceiptData | null) => void;
  allConsolidatedGroups: ConsolidatedReceiptData[];
  setAllConsolidatedGroups: (groups: ConsolidatedReceiptData[]) => void;
  receiptSettings: ReceiptSettings;
  
  // Details dialog
  detailsCustomer: Customer | null;
  setDetailsCustomer: (customer: Customer | null) => void;
  
  // Document preview dialog
  isDocumentPreviewOpen: boolean;
  setIsDocumentPreviewOpen: (open: boolean) => void;
  documentPreviewCustomer: Customer | null;
  documentType: DocumentType;
  setDocumentType: (type: DocumentType) => void;

  // Import progress dialog
  isImporting: boolean;
  importProgress: number;
  importStatus: string;
  importCurrent: number;
  importTotal: number;
  importStartTime: number | null;
  onCancelImport?: () => void;
}

export function SupplierEntryDialogs({
  receiptsToPrint,
  setReceiptsToPrint,
  consolidatedReceiptData,
  setConsolidatedReceiptData,
  allConsolidatedGroups,
  setAllConsolidatedGroups,
  receiptSettings,
  detailsCustomer,
  setDetailsCustomer,
  isDocumentPreviewOpen,
  setIsDocumentPreviewOpen,
  documentPreviewCustomer,
  documentType,
  setDocumentType,
  isImporting,
  importProgress,
  importStatus,
  importCurrent,
  importTotal,
  importStartTime,
  onCancelImport,
}: SupplierEntryDialogsProps) {
  return (
    <>
      <CombinedReceiptPrintDialog
        receipts={receiptsToPrint}
        consolidatedData={consolidatedReceiptData}
        allConsolidatedGroups={allConsolidatedGroups}
        settings={receiptSettings}
        onOpenChange={(open) => {
          if (!open) {
            setReceiptsToPrint([]);
            setConsolidatedReceiptData(null);
            setAllConsolidatedGroups([]);
          }
        }}
        isCustomer={false}
      />

      <DetailsDialog
        isOpen={!!detailsCustomer}
        onOpenChange={(open) => !open && setDetailsCustomer(null)}
        customer={detailsCustomer}
        paymentHistory={[]} // No payment history for suppliers
        entryType="Supplier"
      />

      <DocumentPreviewDialog
        isOpen={isDocumentPreviewOpen}
        setIsOpen={setIsDocumentPreviewOpen}
        customer={documentPreviewCustomer}
        documentType={documentType}
        setDocumentType={setDocumentType}
        receiptSettings={receiptSettings}
      />

      {/* Import Progress Dialog */}
      <Dialog open={isImporting} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importing Supplier Entries</DialogTitle>
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
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pb-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>

            {onCancelImport && importCurrent < importTotal && (
              <div className="flex justify-center pt-3 border-t">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={onCancelImport} 
                  className="h-8 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-5 font-semibold"
                >
                  Cancel Import
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

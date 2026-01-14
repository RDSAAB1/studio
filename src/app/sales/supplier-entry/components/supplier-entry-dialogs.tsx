import type { Customer, ConsolidatedReceiptData, ReceiptSettings } from "@/lib/definitions";
import { CombinedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { DocumentPreviewDialog } from "@/components/sales/document-preview-dialog";
import { DetailsDialog } from "@/components/sales/details-dialog";

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
  documentType: 'tax-invoice' | 'bill-of-supply' | 'challan' | 'rtgs-receipt';
  setDocumentType: (type: 'tax-invoice' | 'bill-of-supply' | 'challan' | 'rtgs-receipt') => void;
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
    </>
  );
}

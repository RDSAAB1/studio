"use client";

import { useState } from "react";
import type { Customer, ReceiptSettings, ConsolidatedReceiptData } from "@/lib/definitions";
import { DetailsDialog } from "@/components/sales/details-dialog";
import { ReceiptPrintDialog, ConsolidatedReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { UpdateConfirmDialog } from "@/components/sales/update-confirm-dialog";
import { ReceiptSettingsDialog } from "@/components/sales/receipt-settings-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatementPreview } from "@/components/print-formats/statement-preview";

interface SupplierEntryDialogsProps {
  // Details Dialog
  detailsSupplier: Customer | null;
  setDetailsSupplier: (supplier: Customer | null) => void;
  
  // Receipt Dialogs
  receiptsToPrint: Customer[];
  setReceiptsToPrint: (receipts: Customer[]) => void;
  consolidatedReceiptData: ConsolidatedReceiptData | null;
  setConsolidatedReceiptData: (data: ConsolidatedReceiptData | null) => void;
  
  // Update Confirm Dialog
  isUpdateConfirmOpen: boolean;
  setIsUpdateConfirmOpen: (open: boolean) => void;
  updateAction: ((deletePayments: boolean) => void) | null;
  setUpdateAction: (action: ((deletePayments: boolean) => void) | null) => void;
  
  // Receipt Settings Dialog
  receiptSettings: ReceiptSettings | null;
  setReceiptSettings: (settings: ReceiptSettings | null) => void;
  
  // Statement Preview Dialog
  isStatementPreviewOpen: boolean;
  setIsStatementPreviewOpen: (open: boolean) => void;
  statementPreviewData: Customer | null;
  setStatementPreviewData: (data: Customer | null) => void;
  
  // Delete Confirm Dialog
  isDeleteConfirmOpen: boolean;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  deleteAction: (() => void) | null;
  setDeleteAction: (action: (() => void) | null) => void;
}

export const SupplierEntryDialogs = ({
  detailsSupplier,
  setDetailsSupplier,
  receiptsToPrint,
  setReceiptsToPrint,
  consolidatedReceiptData,
  setConsolidatedReceiptData,
  isUpdateConfirmOpen,
  setIsUpdateConfirmOpen,
  updateAction,
  setUpdateAction,
  receiptSettings,
  setReceiptSettings,
  isStatementPreviewOpen,
  setIsStatementPreviewOpen,
  statementPreviewData,
  setStatementPreviewData,
  isDeleteConfirmOpen,
  setIsDeleteConfirmOpen,
  deleteAction,
  setDeleteAction,
}: SupplierEntryDialogsProps) => {
  return (
    <>
      {/* Details Dialog */}
      <DetailsDialog
        supplier={detailsSupplier}
        onClose={() => setDetailsSupplier(null)}
      />

      {/* Receipt Print Dialogs */}
      <ReceiptPrintDialog
        suppliers={receiptsToPrint}
        onClose={() => setReceiptsToPrint([])}
        receiptSettings={receiptSettings}
      />

      <ConsolidatedReceiptPrintDialog
        data={consolidatedReceiptData}
        onClose={() => setConsolidatedReceiptData(null)}
        receiptSettings={receiptSettings}
      />

      {/* Update Confirm Dialog */}
      <UpdateConfirmDialog
        isOpen={isUpdateConfirmOpen}
        onClose={() => {
          setIsUpdateConfirmOpen(false);
          setUpdateAction(null);
        }}
        onConfirm={(deletePayments) => {
          if (updateAction) {
            updateAction(deletePayments);
          }
          setIsUpdateConfirmOpen(false);
          setUpdateAction(null);
        }}
      />

      {/* Receipt Settings Dialog */}
      <ReceiptSettingsDialog
        isOpen={!!receiptSettings}
        onClose={() => setReceiptSettings(null)}
        settings={receiptSettings}
        onSave={setReceiptSettings}
      />

      {/* Statement Preview Dialog */}
      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <ScrollArea className="h-[80vh]">
            {statementPreviewData && (
              <StatementPreview data={statementPreviewData} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAction) {
                  deleteAction();
                }
                setIsDeleteConfirmOpen(false);
                setDeleteAction(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



      <ReceiptPrintDialog

        suppliers={receiptsToPrint}

        onClose={() => setReceiptsToPrint([])}

        receiptSettings={receiptSettings}

      />



      <ConsolidatedReceiptPrintDialog

        data={consolidatedReceiptData}

        onClose={() => setConsolidatedReceiptData(null)}

        receiptSettings={receiptSettings}

      />



      {/* Update Confirm Dialog */}

      <UpdateConfirmDialog

        isOpen={isUpdateConfirmOpen}

        onClose={() => {

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

        onConfirm={(deletePayments) => {

          if (updateAction) {

            updateAction(deletePayments);

          }

          setIsUpdateConfirmOpen(false);

          setUpdateAction(null);

        }}

      />



      {/* Receipt Settings Dialog */}

      <ReceiptSettingsDialog

        isOpen={!!receiptSettings}

        onClose={() => setReceiptSettings(null)}

        settings={receiptSettings}

        onSave={setReceiptSettings}

      />



      {/* Statement Preview Dialog */}

      <Dialog open={isStatementPreviewOpen} onOpenChange={setIsStatementPreviewOpen}>

        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">

          <ScrollArea className="h-[80vh]">

            {statementPreviewData && (

              <StatementPreview data={statementPreviewData} />

            )}

          </ScrollArea>

        </DialogContent>

      </Dialog>



      {/* Delete Confirm Dialog */}

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>

            <AlertDialogDescription>

              Are you sure you want to delete this supplier? This action cannot be undone.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => {

                if (deleteAction) {

                  deleteAction();

                }

                setIsDeleteConfirmOpen(false);

                setDeleteAction(null);

              }}

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

            >

              Delete

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </>

  );

};



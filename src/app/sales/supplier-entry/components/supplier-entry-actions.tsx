"use client";

import { useState } from "react";
import type { Customer, ReceiptSettings } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Hourglass, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SupplierEntryActionsProps {
  // State
  isEditing: boolean;
  isLoading: boolean;
  currentSupplier: Customer;
  receiptSettings: ReceiptSettings | null;
  
  // Actions
  onNew: () => void;
  onEdit: (supplier: Customer) => void;
  onDelete: (supplier: Customer) => void;
  onPrintReceipt: (suppliers: Customer[]) => void;
  onPrintConsolidated: (data: any) => void;
  onShowDetails: (supplier: Customer) => void;
  onShowStatement: (supplier: Customer) => void;
  
  // Dialog setters
  setReceiptsToPrint: (receipts: Customer[]) => void;
  setConsolidatedReceiptData: (data: any) => void;
  setDetailsSupplier: (supplier: Customer | null) => void;
  setStatementPreviewData: (data: Customer | null) => void;
  setIsStatementPreviewOpen: (open: boolean) => void;
}

export const SupplierEntryActions = ({
  isEditing,
  isLoading,
  currentSupplier,
  receiptSettings,
  onNew,
  onEdit,
  onDelete,
  onPrintReceipt,
  onPrintConsolidated,
  onShowDetails,
  onShowStatement,
  setReceiptsToPrint,
  setConsolidatedReceiptData,
  setDetailsSupplier,
  setStatementPreviewData,
  setIsStatementPreviewOpen,
}: SupplierEntryActionsProps) => {
  const { toast } = useToast();
  const [showTips, setShowTips] = useState(false);

  const handlePrintReceipt = () => {
    if (!receiptSettings) {
      toast({
        title: "Receipt settings not configured",
        description: "Please configure receipt settings first",
        variant: "destructive"
      });
      return;
    }
    setReceiptsToPrint([currentSupplier]);
  };

  const handlePrintConsolidated = () => {
    if (!receiptSettings) {
      toast({
        title: "Receipt settings not configured",
        description: "Please configure receipt settings first",
        variant: "destructive"
      });
      return;
    }
    
    const consolidatedData = {
      suppliers: [currentSupplier],
      totalAmount: currentSupplier.netAmount || 0,
      totalWeight: currentSupplier.netWeight || 0,
      date: currentSupplier.date,
    };
    setConsolidatedReceiptData(consolidatedData);
  };

  const handleShowDetails = () => {
    setDetailsSupplier(currentSupplier);
  };

  const handleShowStatement = () => {
    setStatementPreviewData(currentSupplier);
    setIsStatementPreviewOpen(true);
  };

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {/* Primary Actions */}
      <Button
        onClick={onNew}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700"
      >
        New Entry
      </Button>

      {isEditing && (
        <Button
          onClick={() => onEdit(currentSupplier)}
          variant="outline"
          disabled={isLoading}
        >
          Save Changes
        </Button>
      )}

      {/* Print Actions */}
      <Button
        onClick={handlePrintReceipt}
        variant="outline"
        disabled={isLoading || !currentSupplier.srNo || currentSupplier.srNo === 'S----'}
      >
        Print Receipt
      </Button>

      <Button
        onClick={handlePrintConsolidated}
        variant="outline"
        disabled={isLoading || !currentSupplier.srNo || currentSupplier.srNo === 'S----'}
      >
        Print Consolidated
      </Button>

      {/* View Actions */}
      <Button
        onClick={handleShowDetails}
        variant="outline"
        disabled={isLoading || !currentSupplier.srNo || currentSupplier.srNo === 'S----'}
      >
        View Details
      </Button>

      <Button
        onClick={handleShowStatement}
        variant="outline"
        disabled={isLoading || !currentSupplier.srNo || currentSupplier.srNo === 'S----'}
      >
        Generate Statement
      </Button>

      {/* Tips Toggle */}
      <Button
        onClick={() => setShowTips(!showTips)}
        variant="ghost"
        size="sm"
        className="ml-auto"
      >
        <Lightbulb className="h-4 w-4 mr-1" />
        Tips
      </Button>

      {/* Tips Panel */}
      {showTips && (
        <div className="w-full mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <Hourglass className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Quick Tips:</p>
              <ul className="space-y-1 text-xs">
                <li>• Use Tab key to navigate between fields quickly</li>
                <li>• Press Enter in the last field to save the entry</li>
                <li>• Use the search to find existing suppliers</li>
                <li>• Check the calculated summary for accuracy</li>
                <li>• Use the print options to generate receipts</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

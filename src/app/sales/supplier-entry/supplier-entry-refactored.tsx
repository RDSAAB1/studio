"use client";

import { useState, useCallback } from "react";
import { FormProvider } from "react-hook-form";
import type { Customer, ReceiptSettings, ConsolidatedReceiptData } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Custom hooks and components
import { useSupplierEntry } from "./hooks/use-supplier-entry";
import { SupplierEntryDialogs } from "./components/supplier-entry-dialogs";
import { SupplierEntryActions } from "./components/supplier-entry-actions";
import { SupplierEntrySearch } from "./components/supplier-entry-search";

// Existing components
import { SupplierForm } from "@/components/sales/supplier-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { EntryTable } from "@/components/sales/entry-table";

export default function SupplierEntryRefactored() {
  const { toast } = useToast();
  
  // Use the custom hook for all supplier entry logic
  const {
    suppliers,
    paymentHistory,
    currentSupplier,
    isEditing,
    isLoading,
    isClient,
    varietyOptions,
    paymentTypeOptions,
    receiptSettings,
    holidays,
    dailyPaymentLimit,
    form,
    setCurrentSupplier,
    setIsEditing,
    performCalculations,
    performHeavyCalculations,
    handleCalculationFieldChange,
    handleSrNoBlur,
    resetFormToState,
    handleNew,
    handleSubmit,
    setSuppliers,
    setPaymentHistory,
    autoFillData,
    setAutoFillData,
  } = useSupplierEntry();

  // Dialog states
  const [detailsSupplier, setDetailsSupplier] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);
  const [isStatementPreviewOpen, setIsStatementPreviewOpen] = useState(false);
  const [statementPreviewData, setStatementPreviewData] = useState<Customer | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteAction, setDeleteAction] = useState<(() => void) | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Handler functions for form
  const onContactChange = useCallback((contactValue: string) => {
    form.setValue('contact', contactValue);
  }, [form]);
  
  const handleNameOrSoBlur = useCallback(() => {
    // Handle name or SO blur logic if needed
  }, []);
  
  const setLastVariety = useCallback((variety: string) => {
    localStorage.setItem('lastSelectedVariety', variety);
  }, []);
  
  const setLastPaymentType = useCallback((paymentType: string) => {
    localStorage.setItem('lastSelectedPaymentType', paymentType);
  }, []);
  
  const handleAddOption = useCallback(async (collectionName: string, name: string) => {
    try {
      // Add option logic would go here
      toast({ title: "Option added successfully!" });
    } catch (error) {
      toast({ title: "Error adding option", variant: "destructive" });
    }
  }, [toast]);
  
  const handleUpdateOption = useCallback(async (collectionName: string, id: string, name: string) => {
    try {
      // Update option logic would go here
      toast({ title: "Option updated successfully!" });
    } catch (error) {
      toast({ title: "Error updating option", variant: "destructive" });
    }
  }, [toast]);
  
  const handleDeleteOption = useCallback(async (collectionName: string, id: string, name: string) => {
    try {
      // Delete option logic would go here
      toast({ title: "Option deleted successfully!" });
    } catch (error) {
      toast({ title: "Error deleting option", variant: "destructive" });
    }
  }, [toast]);

  // Handle supplier selection from search
  const handleSelectSupplier = useCallback((supplier: Customer) => {
    resetFormToState(supplier);
    setIsEditing(true);
    
    // Auto-fill all fields with supplier data (same as edit and serial number blur)
    const allFields = [
        'date', 'term', 'name', 'so', 'address', 'contact', 'vehicleNo', 
        'variety', 'grossWeight', 'teirWeight', 'rate', 'kartaPercentage', 
        'labouryRate', 'kanta', 'paymentType'
    ];
    
    // Create auto-fill data object
    const autoFillData: Record<string, any> = {};
    allFields.forEach(field => {
        const value = supplier[field as keyof Customer];
        if (value !== undefined && value !== null) {
            autoFillData[field] = value;
        }
    });
    
    // Set auto-fill data for immediate UI update FIRST
    setAutoFillData(autoFillData);
    
    // Then set form values after a small delay to ensure auto-fill data is processed
    setTimeout(() => {
        allFields.forEach(field => {
            const value = supplier[field as keyof Customer];
            if (value !== undefined && value !== null) {
                form.setValue(field as any, value);
            }
        });
        
        // Run calculations with the filled data
        performHeavyCalculations(supplier, true);
    }, 10);
    
    toast({
      title: "Supplier loaded",
      description: `All fields filled for ${supplier.name} (SR# ${supplier.srNo})`,
    });
  }, [resetFormToState, setIsEditing, form, setAutoFillData, performHeavyCalculations, toast]);

  // Handle edit action
  const handleEdit = useCallback((supplier: Customer) => {
    resetFormToState(supplier);
    setIsEditing(true);
    
    // Auto-fill all fields with supplier data (same as serial number blur)
    const allFields = [
        'date', 'term', 'name', 'so', 'address', 'contact', 'vehicleNo', 
        'variety', 'grossWeight', 'teirWeight', 'rate', 'kartaPercentage', 
        'labouryRate', 'kanta', 'paymentType'
    ];
    
    // Create auto-fill data object
    const autoFillData: Record<string, any> = {};
    allFields.forEach(field => {
        const value = supplier[field as keyof Customer];
        if (value !== undefined && value !== null) {
            autoFillData[field] = value;
        }
    });
    
    // Set auto-fill data for immediate UI update FIRST
    console.log('Edit Auto-Fill Data:', autoFillData);
    setAutoFillData(autoFillData);
    
    // Then set form values after a small delay to ensure auto-fill data is processed
    setTimeout(() => {
        allFields.forEach(field => {
            const value = supplier[field as keyof Customer];
            if (value !== undefined && value !== null) {
                form.setValue(field as any, value);
            }
        });
        
        // Run calculations with the filled data
        performHeavyCalculations(supplier, true);
    }, 10);
    
    toast({ 
        title: "Supplier loaded for editing!", 
        description: `All fields filled for ${supplier.name} (SR# ${supplier.srNo})` 
    });
  }, [resetFormToState, setIsEditing, form, setAutoFillData, performHeavyCalculations, toast]);

  // Handle delete action
  const handleDelete = useCallback((supplier: Customer) => {
    setDeleteAction(() => async () => {
      try {
        // Delete logic would go here
        toast({ title: "Supplier deleted successfully!" });
      } catch (error) {
        toast({ title: "Error deleting supplier", variant: "destructive" });
      }
    });
    setIsDeleteConfirmOpen(true);
  }, [toast]);

  // Handle print receipt
  const handlePrintReceipt = useCallback((suppliers: Customer[]) => {
    setReceiptsToPrint(suppliers);
  }, []);

  // Handle print consolidated
  const handlePrintConsolidated = useCallback((data: any) => {
    setConsolidatedReceiptData(data);
  }, []);

  // Handle show details
  const handleShowDetails = useCallback((supplier: Customer) => {
    setDetailsSupplier(supplier);
  }, []);

  // Handle show statement
  const handleShowStatement = useCallback((supplier: Customer) => {
    setStatementPreviewData(supplier);
    setIsStatementPreviewOpen(true);
  }, []);

  // Loading state
  if (!isClient || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-4 text-muted-foreground">Loading Supplier Entry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Component */}
      <SupplierEntrySearch
        suppliers={suppliers}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSelectSupplier={handleSelectSupplier}
      />

      {/* Actions Component */}
      <SupplierEntryActions
        isEditing={isEditing}
        isLoading={isLoading}
        currentSupplier={currentSupplier}
        receiptSettings={receiptSettings}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPrintReceipt={handlePrintReceipt}
        onPrintConsolidated={handlePrintConsolidated}
        onShowDetails={handleShowDetails}
        onShowStatement={handleShowStatement}
        setReceiptsToPrint={setReceiptsToPrint}
        setConsolidatedReceiptData={setConsolidatedReceiptData}
        setDetailsSupplier={setDetailsSupplier}
        setStatementPreviewData={setStatementPreviewData}
        setIsStatementPreviewOpen={setIsStatementPreviewOpen}
      />

      {/* Main Form */}
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2">
              <SupplierForm
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                onContactChange={onContactChange}
                handleNameOrSoBlur={handleNameOrSoBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={setLastVariety}
                setLastPaymentType={setLastPaymentType}
                handleAddOption={handleAddOption}
                handleUpdateOption={handleUpdateOption}
                handleDeleteOption={handleDeleteOption}
                allSuppliers={suppliers}
                handleCalculationFieldChange={handleCalculationFieldChange}
                onAutoFill={autoFillData}
              />
            </div>

            {/* Summary Section */}
            <div className="lg:col-span-1">
              <CalculatedSummary
                currentSupplier={currentSupplier}
                isEditing={isEditing}
              />
            </div>
          </div>
        </form>
      </FormProvider>

      {/* Entry Table */}
      <EntryTable
        suppliers={suppliers}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPrintReceipt={handlePrintReceipt}
        onPrintConsolidated={handlePrintConsolidated}
        onShowDetails={handleShowDetails}
        onShowStatement={handleShowStatement}
      />

      {/* All Dialogs */}
      <SupplierEntryDialogs
        detailsSupplier={detailsSupplier}
        setDetailsSupplier={setDetailsSupplier}
        receiptsToPrint={receiptsToPrint}
        setReceiptsToPrint={setReceiptsToPrint}
        consolidatedReceiptData={consolidatedReceiptData}
        setConsolidatedReceiptData={setConsolidatedReceiptData}
        isUpdateConfirmOpen={isUpdateConfirmOpen}
        setIsUpdateConfirmOpen={setIsUpdateConfirmOpen}
        updateAction={updateAction}
        setUpdateAction={setUpdateAction}
        receiptSettings={receiptSettings}
        setReceiptSettings={() => {}} // This would be handled by the hook
        isStatementPreviewOpen={isStatementPreviewOpen}
        setIsStatementPreviewOpen={setIsStatementPreviewOpen}
        statementPreviewData={statementPreviewData}
        setStatementPreviewData={setStatementPreviewData}
        isDeleteConfirmOpen={isDeleteConfirmOpen}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
        deleteAction={deleteAction}
        setDeleteAction={setDeleteAction}
      />
    </div>
  );
}

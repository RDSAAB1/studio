"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormProvider } from "react-hook-form";
import { useSupplierEntryForm } from "@/app/sales/purchase/hooks/use-supplier-entry-form";
import SimpleSupplierFormAllFields from "@/components/sales/simple-supplier-form-all-fields";
import { useGlobalData } from "@/contexts/global-data-context";
import { Save, ExternalLink, Loader2 } from "lucide-react";
import { SimpleCalculatedSummary } from "@/components/sales/simple-calculated-summary";

export function SupplierPurchaseDialog({ 
  isOpen, 
  onOpenChange,
  trigger
}: { 
  isOpen?: boolean; 
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;
  
  const globalData = useGlobalData();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    form,
    isSubmitting,
    onSubmit,
    varietyOptions,
    paymentTypeOptions,
    handleSrNoBlur,
    handleContactBlur,
    handleSetLastVariety,
    handleSetLastPaymentType,
    handleAddOption,
    handleUpdateOption,
    handleDeleteOption,
    uniqueProfiles,
    handleUseProfile,
    uniqueNames,
    uniqueSo,
    uniqueAddresses,
    uniqueVehicleNos,
    uniqueContacts,
    calculateSummary,
    handleNewEntry
  } = useSupplierEntryForm({
    isClient,
    allSuppliers: globalData.suppliers || [],
    suppliersForSerial: globalData.suppliers || [],
    isImportMode: false
  });

  // Override the onSubmit to close the dialog after successful save
  const handleSubmitAndClose = async (values: any) => {
    await onSubmit(values);
    // If it's not submitting anymore and no errors, close it
    // Wait for the next tick to check if form was cleared
    setTimeout(() => {
      handleOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-4 border-b bg-slate-50 sticky top-0 z-10">
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-indigo-600" />
            Supplier Purchase Entry
          </DialogTitle>
          <DialogDescription>
            Enter full details for supplier purchase with Karta, Bags, and Brokerage calculations.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-slate-100 min-h-[500px]">
          {isClient ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <FormProvider {...form}>
                  <form 
                    id="dialog-supplier-entry-form"
                    onSubmit={form.handleSubmit(handleSubmitAndClose)}
                    className="space-y-4"
                  >
                    <SimpleSupplierFormAllFields 
                      form={form}
                      handleSrNoBlur={handleSrNoBlur}
                      handleContactBlur={handleContactBlur}
                      varietyOptions={varietyOptions}
                      paymentTypeOptions={paymentTypeOptions}
                      setLastVariety={handleSetLastVariety}
                      setLastPaymentType={handleSetLastPaymentType}
                      handleAddOption={handleAddOption as any}
                      handleUpdateOption={handleUpdateOption as any}
                      handleDeleteOption={handleDeleteOption as any}
                      handleUseProfile={handleUseProfile}
                      uniqueProfiles={uniqueProfiles}
                      uniqueNames={uniqueNames}
                      uniqueSo={uniqueSo}
                      uniqueAddresses={uniqueAddresses}
                      uniqueVehicleNos={uniqueVehicleNos}
                      uniqueContacts={uniqueContacts}
                      firstInputRef={{ current: null }}
                      isImportMode={false}
                    />
                  </form>
                </FormProvider>
              </div>

              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-4">
                  <h3 className="font-semibold mb-3">Summary & Save</h3>
                  <FormProvider {...form}>
                    <SimpleCalculatedSummary 
                      onSave={() => {
                        calculateSummary();
                        form.handleSubmit(handleSubmitAndClose)();
                      }}
                      onClearForm={handleNewEntry}
                      isEditing={false}
                      isSubmitting={isSubmitting}
                    />
                  </FormProvider>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

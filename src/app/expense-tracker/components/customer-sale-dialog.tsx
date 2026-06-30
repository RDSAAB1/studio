"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { FormProvider } from "react-hook-form";
import { useCustomerEntryForm } from "@/components/sales/customer-entry/hooks/use-customer-entry-form";
import { CustomerForm } from "@/components/sales/customer-form";
import { useGlobalData } from "@/contexts/global-data-context";
import { ExternalLink, Loader2 } from "lucide-react";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { useToast } from "@/hooks/use-toast";
import { addCustomer, updateCustomer, addOption, updateOption, deleteOption } from "@/lib/firestore";
import { formatSrNo, formatDateLocal, toTitleCase } from "@/lib/utils";
import type { Customer } from "@/lib/definitions";

export function CustomerSaleDialog({ 
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const safeCustomers = globalData.customers || [];
  
  const {
    form,
    currentCustomer,
    isEditing,
    varietyOptions,
    paymentTypeOptions,
    handleNew,
    handleSrNoBlur,
    handleContactBlur,
    handleSetLastVariety,
    handleSetLastPaymentType,
  } = useCustomerEntryForm({
    isClient,
    safeCustomers,
    paymentHistory: [],
  });

  const handleSubmitAndClose = async () => {
    setIsSubmitting(true);
    try {
      const formValues = form.getValues();
      
      let srNo = formValues.srNo?.trim() ?? "";
      if (!srNo || srNo === 'C----' || srNo === '') {
        let nextSrNum = 1;
        if (safeCustomers.length > 0) {
          const maxSrNo = safeCustomers.reduce((max, c) => {
            const num = parseInt(c.srNo.substring(1)) || 0;
            return num > max ? num : max;
          }, 0);
          nextSrNum = maxSrNo + 1;
        }
        srNo = formatSrNo(nextSrNum, 'C');
        form.setValue('srNo', srNo);
      }

      const dataToSave: Omit<Customer, 'id'> = {
        ...currentCustomer,
        srNo: srNo,
        date: formatDateLocal(formValues.date),
        term: '0', 
        dueDate: formatDateLocal(formValues.date),
        name: toTitleCase(formValues.name),
        companyName: toTitleCase(formValues.companyName || ''),
        address: toTitleCase(formValues.address),
        contact: formValues.contact,
        gstin: formValues.gstin,
        stateName: formValues.stateName,
        stateCode: formValues.stateCode,
        vehicleNo: toTitleCase(formValues.vehicleNo),
        variety: formValues.variety ? String(formValues.variety).toUpperCase() : formValues.variety,
        paymentType: formValues.paymentType,
        customerId: `${toTitleCase(formValues.name).toLowerCase()}|${formValues.contact.toLowerCase()}`,
        grossWeight: formValues.grossWeight,
        teirWeight: formValues.teirWeight,
        rate: formValues.rate,
        bags: formValues.bags,
        bagWeightKg: formValues.bagWeightKg,
        bagRate: formValues.bagRate,
        isBrokerageIncluded: formValues.isBrokerageIncluded,
        shippingName: toTitleCase(formValues.shippingName || ''),
        shippingCompanyName: toTitleCase(formValues.shippingCompanyName || ''),
        shippingAddress: toTitleCase(formValues.shippingAddress || ''),
        shippingContact: formValues.shippingContact || '',
        shippingGstin: formValues.shippingGstin || '',
        shippingStateName: formValues.shippingStateName || '',
        shippingStateCode: formValues.shippingStateCode || '',
        hsnCode: formValues.hsnCode || '',
        taxRate: formValues.taxRate || 5,
        isGstIncluded: formValues.isGstIncluded || false,
        nineRNo: formValues.nineRNo || '',
        gatePassNo: formValues.gatePassNo || '',
        grNo: formValues.grNo || '',
        grDate: formValues.grDate || '',
        transport: formValues.transport || '',
        transportationRate: formValues.transportationRate ?? 0,
        cdRate: formValues.cd ?? 0, 
        cd: currentCustomer.cd ?? 0, 
        cdAmount: formValues.cdAmount ?? 0, 
        brokerageRate: formValues.brokerage ?? 0, 
        so: '',
        kartaPercentage: formValues.kartaPercentage ?? 0,
        kartaWeight: currentCustomer.kartaWeight ?? 0, 
        kartaAmount: currentCustomer.kartaAmount ?? 0, 
        bagWeightDeductionAmount: currentCustomer.bagWeightDeductionAmount ?? 0, 
        transportAmount: currentCustomer.transportAmount ?? 0, 
        labouryRate: 0,
        labouryAmount: 0,
        barcode: '',
        receiptType: 'Cash',
        baseReport: formValues.baseReport ?? 0,
        collectedReport: formValues.collectedReport ?? 0,
        riceBranGst: formValues.riceBranGst ?? 0,
        ...(currentCustomer.calculatedRate != null && { calculatedRate: currentCustomer.calculatedRate }),
      };

      const entryToSave = { ...dataToSave, id: srNo };

      if (isEditing && currentCustomer.id) {
        const updateId = currentCustomer.id || srNo;
        const { id, ...updateData } = entryToSave as Customer;
        await updateCustomer(updateId, updateData);
        toast({ title: "Entry updated successfully.", variant: "success" });
      } else {
        await addCustomer(entryToSave as Customer);
        toast({ title: "Entry saved successfully.", variant: "success" });
      }
      
      handleNew();
      
      setTimeout(() => {
        handleOpenChange(false);
      }, 500);

    } catch (error: any) {
      toast({ title: "Failed to save entry", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-4 border-b bg-slate-50 sticky top-0 z-10">
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-indigo-600" />
            Customer Sale Entry
          </DialogTitle>
          <DialogDescription>
            Enter full details for customer sale with Karta, Bags, and Brokerage calculations.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-slate-100 min-h-[500px]">
          {isClient ? (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <FormProvider {...form}>
                <form 
                  id="dialog-customer-entry-form"
                  onSubmit={form.handleSubmit(handleSubmitAndClose)}
                  className="space-y-4"
                >
                  <CustomerForm 
                      form={form}
                      handleSrNoBlur={handleSrNoBlur}
                      handleContactBlur={handleContactBlur}
                      varietyOptions={varietyOptions}
                      paymentTypeOptions={paymentTypeOptions}
                      setLastVariety={handleSetLastVariety}
                      setLastPaymentType={handleSetLastPaymentType}
                      handleAddOption={(collectionName, optionData) => addOption(collectionName, optionData)}
                      handleUpdateOption={(collectionName, id, optionData) => updateOption(collectionName, id, optionData)}
                      handleDeleteOption={(collectionName, id, name) => deleteOption(collectionName, id, name)}
                      allCustomers={safeCustomers}
                      summary={
                        <CalculatedSummary
                          customer={currentCustomer}
                          onSave={() => form.handleSubmit(handleSubmitAndClose)()}
                          onSaveAndPrint={() => {}} 
                          isEditing={isEditing}
                          isCustomerForm={true}
                          isBrokerageIncluded={form.watch('isBrokerageIncluded')}
                          onBrokerageToggle={(checked: boolean) => form.setValue('isBrokerageIncluded', checked)}
                          onImport={() => {}}
                          onExport={() => {}}
                          onSearch={() => {}}
                          onClear={handleNew}
                          totals={undefined}
                          isSubmitting={isSubmitting}
                        />
                      }
                  />
                </form>
              </FormProvider>
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

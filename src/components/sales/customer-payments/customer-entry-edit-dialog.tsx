"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import type { Customer, OptionItem, CustomerPayment } from "@/lib/definitions";
import { calculateCustomerEntry, toTitleCase } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/database";
import { updateCustomer, getOptionsRealtime, addOption, updateOption, deleteOption } from "@/lib/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerForm } from "@/components/sales/customer-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormValidation } from "@/hooks/use-form-validation";
import {
  requiredString,
  optionalString,
  contactNumber10Digit,
  nonNegativeNumber,
} from "@/lib/form-validation";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  srNo: requiredString(),
  date: z.date(),
  bags: nonNegativeNumber(),
  name: requiredString("Name is required."),
  companyName: optionalString(),
  address: requiredString(),
  contact: contactNumber10Digit("Contact number"),
  gstin: optionalString(),
  stateName: optionalString(),
  stateCode: optionalString(),
  vehicleNo: z.string(),
  variety: requiredString("Variety is required."),
  grossWeight: nonNegativeNumber(),
  teirWeight: nonNegativeNumber(),
  rate: nonNegativeNumber(),
  cd: nonNegativeNumber(),
  brokerage: nonNegativeNumber(),
  paymentType: requiredString("Payment type is required"),
  isBrokerageIncluded: z.boolean(),
  bagWeightKg: nonNegativeNumber(),
  bagRate: nonNegativeNumber(),
  shippingName: optionalString(),
  shippingCompanyName: optionalString(),
  shippingAddress: optionalString(),
  shippingContact: optionalString(),
  shippingGstin: optionalString(),
  shippingStateName: optionalString(),
  shippingStateCode: optionalString(),
  hsnCode: optionalString(),
  taxRate: nonNegativeNumber().optional(),
  isGstIncluded: z.boolean().optional(),
  nineRNo: optionalString(),
  gatePassNo: optionalString(),
  grNo: optionalString(),
  grDate: optionalString(),
  transport: optionalString(),
  transportationRate: nonNegativeNumber().default(0),
  baseReport: nonNegativeNumber().optional(),
  collectedReport: nonNegativeNumber().optional(),
  riceBranGst: nonNegativeNumber().optional(),
  cdAmount: nonNegativeNumber().optional(),
  kartaPercentage: nonNegativeNumber(),
});

type FormValues = z.infer<typeof formSchema>;

interface CustomerEntryEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: Customer | null;
    onSuccess?: () => void;
}

export const CustomerEntryEditDialog: React.FC<CustomerEntryEditDialogProps> = ({
  open,
  onOpenChange,
  entry,
  onSuccess,
}) => {
  const { toast } = useToast();
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const paymentHistory = useLiveQuery(() => db.customerPayments.toArray(), []);

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const loadedEntryIdRef = useRef<string | null>(null);

  const safeCustomers = useMemo(
    () => (Array.isArray(customers) ? customers : []),
    [customers]
  );
  const safePaymentHistory = useMemo(
    () => (Array.isArray(paymentHistory) ? paymentHistory : []),
    [paymentHistory]
  );

  const form = useFormValidation<FormValues>(formSchema, {
    defaultValues: {
      srNo: "",
      date: new Date(),
      bags: 0,
      name: "",
      companyName: "",
      address: "",
      contact: "",
      gstin: "",
      stateName: "",
      stateCode: "",
      vehicleNo: "",
      variety: "",
      grossWeight: 0,
      teirWeight: 0,
      rate: 0,
      cd: 0,
      brokerage: 0,
      paymentType: "Full",
      isBrokerageIncluded: false,
      bagWeightKg: 0,
      bagRate: 0,
      shippingName: "",
      shippingCompanyName: "",
      shippingAddress: "",
      shippingContact: "",
      shippingGstin: "",
      shippingStateName: "",
      shippingStateCode: "",
      hsnCode: "1006",
      taxRate: 5,
      isGstIncluded: false,
      nineRNo: "",
      gatePassNo: "",
      grNo: "",
      grDate: "",
      transport: "",
      transportationRate: 0,
      baseReport: 0,
      collectedReport: 0,
      riceBranGst: 0,
      cdAmount: 0,
      kartaPercentage: 0,
    },
    shouldFocusError: false,
  });

  const performCalculations = useCallback(
    (data: Partial<FormValues>) => {
      const calculatedState = calculateCustomerEntry(
        data,
        safePaymentHistory as CustomerPayment[]
      );
      setCurrentCustomer((prev) => {
        if (prev) {
          return { ...prev, ...calculatedState };
        }
        const formattedDate =
          formatDate(data.date ?? null, "yyyy-MM-dd") ||
          new Date().toISOString().split("T")[0];
        const baseCustomer: Customer = {
          id: entry?.id || "",
          srNo: data.srNo || "",
          date: formattedDate,
          name: data.name || "",
          contact: data.contact || "",
          address: data.address || "",
          variety: data.variety || "",
          grossWeight: data.grossWeight || 0,
          teirWeight: data.teirWeight || 0,
          rate: data.rate || 0,
          paymentType: data.paymentType || "Full",
          customerId: "",
          netAmount: 0,
          originalNetAmount: 0,
          netWeight: 0,
          amount: 0,
          weight: 0,
          bags: data.bags || 0,
          bagWeightKg: data.bagWeightKg || 0,
          bagRate: data.bagRate || 0,
          bagAmount: 0,
          brokerage: 0,
          brokerageAmount: 0,
          brokerageRate: data.brokerage || 0,
          cd: 0,
          cdRate: data.cd || 0,
          isBrokerageIncluded: data.isBrokerageIncluded || false,
          term: "0",
          dueDate: formattedDate,
          vehicleNo: data.vehicleNo || "",
          barcode: "",
          receiptType: "Cash",
          so: "",
          kartaPercentage: 0,
          kartaWeight: 0,
          kartaAmount: 0,
          labouryRate: 0,
          labouryAmount: 0,
          kanta: 0,
        };
        return { ...baseCustomer, ...calculatedState };
      });
    },
    [safePaymentHistory, entry]
  );

  useEffect(() => {
    if (!open) {
      loadedEntryIdRef.current = null;
      return;
    }

    if (!entry) return;

    const entryId = entry.id || entry.srNo;
    if (!entryId) return;

    if (loadedEntryIdRef.current === entryId) {
      return;
    }

    const loadEntryData = async () => {
      let fullEntry: Customer | null = null;

      if (entry.id && db) {
        try {
          fullEntry = (await db.customers.get(entry.id)) as Customer | null;
        } catch (error) {}
      }

      if (!fullEntry && entry.srNo && db) {
        try {
          fullEntry = (await db.customers
            .where("srNo")
            .equals(entry.srNo)
            .first()) as Customer | null;
        } catch (error) {}
      }

      const customerToUse = fullEntry || entry;

      if (!customerToUse.id && customerToUse.srNo && db) {
        try {
          const found = (await db.customers
            .where("srNo")
            .equals(customerToUse.srNo)
            .first()) as Customer | null;
          if (found) {
            Object.assign(customerToUse, { id: found.id });
          }
        } catch (error) {}
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let formDate: Date;
      try {
        formDate = customerToUse.date ? new Date(customerToUse.date) : today;
        if (isNaN(formDate.getTime())) formDate = today;
      } catch {
        formDate = today;
      }

      const formValues: FormValues = {
        srNo: customerToUse.srNo || "",
        date: formDate,
        bags: customerToUse.bags || 0,
        name: customerToUse.name || "",
        companyName: customerToUse.companyName || "",
        address: customerToUse.address || "",
        contact: customerToUse.contact || "",
        gstin: customerToUse.gstin || "",
        stateName: customerToUse.stateName || "",
        stateCode: customerToUse.stateCode || "",
        vehicleNo: customerToUse.vehicleNo || "",
        variety: customerToUse.variety || "",
        grossWeight: customerToUse.grossWeight || 0,
        teirWeight: customerToUse.teirWeight || 0,
        rate: customerToUse.rate || 0,
        cd:
          customerToUse.cdRate !== undefined && customerToUse.cdRate !== null
            ? customerToUse.cdRate
            : customerToUse.cd &&
              customerToUse.amount &&
              customerToUse.amount > 0
            ? (customerToUse.cd / customerToUse.amount) * 100
            : 0,
        brokerage:
          customerToUse.brokerageRate !== undefined &&
          customerToUse.brokerageRate !== null
            ? customerToUse.brokerageRate
            : customerToUse.brokerage &&
              customerToUse.netWeight &&
              customerToUse.netWeight > 0
            ? customerToUse.brokerage / customerToUse.netWeight
            : 0,
        paymentType: customerToUse.paymentType || "Full",
        isBrokerageIncluded: customerToUse.isBrokerageIncluded || false,
        bagWeightKg: customerToUse.bagWeightKg || 0,
        bagRate: customerToUse.bagRate || 0,
        shippingName: customerToUse.shippingName || "",
        shippingCompanyName: customerToUse.shippingCompanyName || "",
        shippingAddress: customerToUse.shippingAddress || "",
        shippingContact: customerToUse.shippingContact || "",
        shippingGstin: customerToUse.shippingGstin || "",
        shippingStateName: customerToUse.shippingStateName || "",
        shippingStateCode: customerToUse.shippingStateCode || "",
        hsnCode: customerToUse.hsnCode || "1006",
        taxRate: customerToUse.taxRate || 5,
        isGstIncluded: customerToUse.isGstIncluded || false,
        nineRNo: customerToUse.nineRNo || "",
        gatePassNo: customerToUse.gatePassNo || "",
        grNo: customerToUse.grNo || "",
        grDate: customerToUse.grDate || "",
        transport: customerToUse.transport || "",
        transportationRate: customerToUse.transportationRate || 0,
        baseReport: customerToUse.baseReport || 0,
        collectedReport: customerToUse.collectedReport || 0,
        riceBranGst: customerToUse.riceBranGst || 0,
        cdAmount: customerToUse.cdAmount || customerToUse.cd || 0,
        kartaPercentage: customerToUse.kartaPercentage || 0,
      };

      const customerWithDefaults: Customer = {
        ...customerToUse,
        netWeight: customerToUse.netWeight || 0,
        rate: customerToUse.rate || 0,
      };

      loadedEntryIdRef.current = entryId;

      setCurrentCustomer(customerWithDefaults);
      form.reset(formValues);

      setTimeout(() => {
        performCalculations(formValues);
      }, 0);
    };

    loadEntryData();
  }, [open, entry?.id, entry?.srNo, db, form, performCalculations]);

  useEffect(() => {
    if (!open) return;

    const unsubVarieties = getOptionsRealtime(
      "varieties",
      setVarietyOptions,
      () => {}
    );
    const unsubPaymentTypes = getOptionsRealtime(
      "paymentTypes",
      setPaymentTypeOptions,
      () => {}
    );

    return () => {
      unsubVarieties();
      unsubPaymentTypes();
    };
  }, [open]);

  const handleSrNoBlur = useCallback(async (rawValue: string) => {}, []);

  const handleContactBlur = useCallback(() => {}, []);

  const handleAddOption = useCallback(async (collectionName: string, optionData: { name: string }) => {
    await addOption(collectionName, optionData);
  }, []);

  const handleUpdateOption = useCallback(async (collectionName: string, id: string, optionData: { name: string }) => {
    await updateOption(collectionName, id, optionData);
  }, []);

  const handleDeleteOption = useCallback(async (collectionName: string, id: string, name: string) => {
    await deleteOption(collectionName, id, name);
  }, []);

  useEffect(() => {
    if (!open || !currentCustomer) return;

    const subscription = form.watch((value) => {
      performCalculations(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
  }, [form, open, currentCustomer, performCalculations]);

  const onSubmit = async (values: FormValues) => {
    if (isSubmitting) return;

    if (!currentCustomer) {
      toast({
        title: "Error",
        description: "Invalid entry data",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let customerId = currentCustomer.id;

      if (!customerId && entry?.id) {
        customerId = entry.id;
      }

      if (!customerId && values.srNo && db) {
        try {
          const foundCustomer = await db.customers
            .where("srNo")
            .equals(values.srNo)
            .first();
          if (foundCustomer?.id) {
            customerId = foundCustomer.id;
          }
        } catch (error) {}
      }

      if (!customerId && currentCustomer.srNo && db) {
        try {
          const foundCustomer = await db.customers
            .where("srNo")
            .equals(currentCustomer.srNo)
            .first();
          if (foundCustomer?.id) {
            customerId = foundCustomer.id;
          }
        } catch (error) {}
      }

      if (!customerId) {
        throw new Error(
          "Cannot update: Customer ID not found. Please ensure the entry exists in the database."
        );
      }

      const calculatedState = calculateCustomerEntry(
        values,
        safePaymentHistory as CustomerPayment[]
      );

      const srNoChanged =
        currentCustomer.srNo &&
        values.srNo &&
        currentCustomer.srNo !== values.srNo;

      const formattedDate =
        formatDate(values.date, "yyyy-MM-dd") ||
        new Date().toISOString().split("T")[0];

      const completeEntry: Customer = {
        ...currentCustomer,
        ...values,
        ...calculatedState,
        id: customerId,
        srNo: values.srNo,
        customerId:
          currentCustomer.customerId ||
          `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
        date: formattedDate,
        dueDate: formattedDate,
        name: toTitleCase(values.name),
        companyName: toTitleCase(values.companyName || ""),
        address: toTitleCase(values.address),
        variety: toTitleCase(values.variety),
        vehicleNo: toTitleCase(values.vehicleNo),
        cdRate: values.cd || 0,
        brokerageRate: values.brokerage || 0,
        shippingName: toTitleCase(values.shippingName || ""),
        shippingCompanyName: toTitleCase(values.shippingCompanyName || ""),
        shippingAddress: toTitleCase(values.shippingAddress || ""),
        shippingContact: values.shippingContact || "",
        shippingGstin: values.shippingGstin || "",
        shippingStateName: values.shippingStateName || "",
        shippingStateCode: values.shippingStateCode || "",
        hsnCode: values.hsnCode || "",
        taxRate: values.taxRate || 5,
        isGstIncluded: values.isGstIncluded || false,
        nineRNo: values.nineRNo || "",
        gatePassNo: values.gatePassNo || "",
        grNo: values.grNo || "",
        grDate: values.grDate || "",
        transport: values.transport || "",
        transportationRate: values.transportationRate || 0,
        baseReport: values.baseReport || 0,
        collectedReport: values.collectedReport || 0,
        riceBranGst: values.riceBranGst || 0,
        cdAmount: values.cdAmount || 0,
        calculatedRate: calculatedState.calculatedRate || undefined,
      };

      const { id, ...updateData } = completeEntry;

      if (!updateData.srNo) {
        updateData.srNo = values.srNo || currentCustomer.srNo;
      }

      const success = await updateCustomer(id, updateData);

      if (success) {
        toast({
          title: "Entry updated successfully!",
          description: "Outstanding updated in database",
          variant: "success",
        });
        onSuccess?.();
        onOpenChange(false);

        (async () => {
          try {
            const { forceSyncToFirestore } = await import(
              "@/lib/local-first-sync"
            );
            await forceSyncToFirestore();
          } catch (syncError) {}
        })();
      } else {
        throw new Error("Failed to update customer");
      }
    } catch (error) {
      toast({
        title: "Failed to update entry.",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <DialogTitle>Edit Customer Entry - {entry.srNo}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="customer-entry-edit-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Entry
                </Button>
              </div>
            </div>
            {(Number(currentCustomer?.advanceFreight ?? entry?.advanceFreight ?? 0) > 0) && (
              <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-800 border-amber-300 font-semibold">
                Advance Freight: {formatCurrency(Number(currentCustomer?.advanceFreight ?? entry?.advanceFreight ?? 0))} — recover from customer at payment
              </Badge>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6">
          <FormProvider {...form}>
            <form
              id="customer-entry-edit-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pb-4"
            >
              <CustomerForm
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleContactBlur={(v: string) => handleContactBlur()}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={() => {}}
                setLastPaymentType={() => {}}
                handleAddOption={handleAddOption}
                handleUpdateOption={handleUpdateOption}
                handleDeleteOption={handleDeleteOption}
                allCustomers={safeCustomers}
              />
              {currentCustomer && (
                <CalculatedSummary
                  customer={currentCustomer}
                  onSave={() => form.handleSubmit(onSubmit)()}
                  isEditing={true}
                  isCustomerForm={true}
                  isBrokerageIncluded={form.watch("isBrokerageIncluded")}
                  onBrokerageToggle={(checked: boolean) =>
                    form.setValue("isBrokerageIncluded", checked)
                  }
                />
              )}
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
};

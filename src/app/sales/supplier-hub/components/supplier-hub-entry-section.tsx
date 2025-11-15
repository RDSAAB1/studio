"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import type { Customer, CustomerSummary, OptionItem } from "@/lib/definitions";
import { completeSupplierFormSchema, type CompleteSupplierFormValues } from "@/lib/complete-form-schema";
import {
  addSupplier,
  addOption,
  updateOption,
  deleteOption,
  getOptionsRealtime,
  getSupplierIdBySrNo,
} from "@/lib/firestore";
import { formatSrNo, toTitleCase, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import SimpleSupplierFormAllFields from "@/components/sales/simple-supplier-form-all-fields";
import { SimpleCalculatedSummary } from "@/components/sales/simple-calculated-summary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type SupplierHubEntrySectionProps = {
  suppliers: Customer[];
  selectedSupplierKey: string | null;
  selectedSummary: CustomerSummary | null;
  millOverviewKey?: string;
  onRegisterCommands?: (commands: {
    finalize?: () => void;
    clear?: () => void;
    reset?: () => void;
  }) => void;
};

const computeNextSerial = (suppliers: Customer[]): string => {
  const numericSerials = suppliers
    .map((supplier) => {
      if (!supplier?.srNo) return 0;
      const match = supplier.srNo.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .filter((num) => Number.isFinite(num));

  const maxSerial = numericSerials.length ? Math.max(...numericSerials) : 0;
  return formatSrNo(maxSerial + 1, "S");
};

const buildDefaultValues = (suppliers: Customer[]): CompleteSupplierFormValues => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    srNo: computeNextSerial(suppliers),
    date: today,
    term: 20,
    name: "",
    so: "",
    address: "",
    contact: "",
    vehicleNo: "",
    variety: "",
    grossWeight: 0,
    teirWeight: 0,
    rate: 0,
    kartaPercentage: 1,
    labouryRate: 2,
    brokerage: 0,
    brokerageRate: 0,
    brokerageAddSubtract: true,
    kanta: 50,
    paymentType: "Full",
    forceUnique: false,
  };
};

const mapFormToCustomer = async (
  values: CompleteSupplierFormValues,
  suppliers: Customer[]
): Promise<Customer> => {
  const finalWeight = Number(values.grossWeight || 0) - Number(values.teirWeight || 0);
  const kartaWeightRaw = (finalWeight * Number(values.kartaPercentage || 0)) / 100;
  const kartaWeight = Math.round(kartaWeightRaw * 100) / 100;
  const netWeight = Math.round((finalWeight - kartaWeight) * 100) / 100;
  const amount = finalWeight * Number(values.rate || 0);
  const kartaAmount = kartaWeight * Number(values.rate || 0);
  const labouryAmount = finalWeight * Number(values.labouryRate || 0);
  const brokerageAmount = Math.round(Number(values.brokerageRate || 0) * netWeight * 100) / 100;
  const signedBrokerage =
    (values.brokerageAddSubtract ?? true) ? brokerageAmount : -brokerageAmount;
  const netAmount =
    amount - kartaAmount - labouryAmount - Number(values.kanta || 0) + signedBrokerage;

  const dueDate = new Date(values.date);
  dueDate.setDate(dueDate.getDate() + Number(values.term || 0));

  const existing = suppliers.find((supplier) => supplier.srNo === values.srNo);
  let id = existing?.id;
  if (!id) {
    id = await getSupplierIdBySrNo(values.srNo);
  }
  if (!id) {
    id = crypto.randomUUID();
  }

  return {
    id,
    srNo: values.srNo,
    date: format(values.date, "yyyy-MM-dd"),
    term: String(values.term),
    dueDate: format(dueDate, "yyyy-MM-dd"),
    name: toTitleCase(values.name),
    so: toTitleCase(values.so),
    address: toTitleCase(values.address),
    contact: values.contact,
    vehicleNo: (values.vehicleNo || "").toUpperCase(),
    variety: toTitleCase(values.variety),
    grossWeight: Number(values.grossWeight || 0),
    teirWeight: Number(values.teirWeight || 0),
    weight: Number(finalWeight.toFixed(2)),
    kartaPercentage: Number(values.kartaPercentage || 0),
    kartaWeight: kartaWeight,
    kartaAmount: Number(kartaAmount.toFixed(2)),
    netWeight: Number(netWeight.toFixed(2)),
    rate: Number(values.rate || 0),
    labouryRate: Number(values.labouryRate || 0),
    labouryAmount: Number(labouryAmount.toFixed(2)),
    brokerage: Number(values.brokerage || 0),
    brokerageRate: Number(values.brokerageRate || 0),
    brokerageAmount: Number(brokerageAmount.toFixed(2)),
    brokerageAddSubtract: values.brokerageAddSubtract ?? true,
    kanta: Number(values.kanta || 0),
    amount: Number(amount.toFixed(2)),
    netAmount: Number(netAmount.toFixed(2)),
    originalNetAmount: Number(netAmount.toFixed(2)),
    paymentType: values.paymentType,
    customerId: `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}`,
    barcode: "",
    receiptType: "Cash",
    forceUnique: values.forceUnique ?? false,
  } as Customer;
};

const SupplierHubEntrySection = ({
  suppliers,
  selectedSupplierKey,
  selectedSummary,
  millOverviewKey,
  onRegisterCommands,
}: SupplierHubEntrySectionProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);

  const form = useForm<CompleteSupplierFormValues>({
    resolver: zodResolver(completeSupplierFormSchema),
    defaultValues: buildDefaultValues(suppliers),
  });

  const latestEntries = useMemo(() => {
    if (!selectedSummary || selectedSupplierKey === millOverviewKey) {
      return (suppliers || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.date || "").getTime() - new Date(a.date || "").getTime()
        )
        .slice(0, 8);
    }

    return (selectedSummary.allTransactions || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.date || "").getTime() - new Date(a.date || "").getTime()
      )
      .slice(0, 8);
  }, [selectedSummary, suppliers, selectedSupplierKey, millOverviewKey]);

  useEffect(() => {
    const unsubVarieties = getOptionsRealtime(
      "varieties",
      setVarietyOptions,
      (err) => console.error("Error fetching varieties:", err)
    );
    const unsubPaymentTypes = getOptionsRealtime(
      "paymentTypes",
      setPaymentTypeOptions,
      (err) => console.error("Error fetching payment types:", err)
    );

    return () => {
      unsubVarieties();
      unsubPaymentTypes();
    };
  }, []);

  useEffect(() => {
    const defaults = buildDefaultValues(suppliers);
    form.reset(defaults);
  }, [suppliers, form]);

  useEffect(() => {
    if (!selectedSummary || selectedSupplierKey === millOverviewKey) return;
    const lastTransaction =
      selectedSummary.allTransactions?.slice().sort(
        (a, b) =>
          new Date(b.date || "").getTime() - new Date(a.date || "").getTime()
      )[0];

    form.reset({
      ...buildDefaultValues(suppliers),
      name: toTitleCase(selectedSummary.name || lastTransaction?.name || ""),
      so: toTitleCase(selectedSummary.so || lastTransaction?.so || ""),
      address: toTitleCase(
        selectedSummary.address || lastTransaction?.address || ""
      ),
      contact: selectedSummary.contact || lastTransaction?.contact || "",
      variety: toTitleCase(lastTransaction?.variety || ""),
      paymentType: lastTransaction?.paymentType || "Full",
    });
  }, [selectedSummary, selectedSupplierKey, millOverviewKey, form, suppliers]);

  const watchedValues = useWatch({ control: form.control });

  const handleSrNoBlur = useCallback(
    async (rawValue: string) => {
      if (!rawValue) return;
      const trimmed = rawValue.trim();
      const numeric = Number(trimmed.replace(/\D/g, ""));
      if (!Number.isFinite(numeric)) return;
      const formatted = formatSrNo(numeric, "S");
      form.setValue("srNo", formatted);

      const supplierMatch =
        suppliers.find((supplier) => supplier.srNo === formatted) ?? null;
      if (supplierMatch) {
        form.reset({
          ...buildDefaultValues(suppliers),
          ...supplierMatch,
          srNo: formatted,
          date: supplierMatch.date ? new Date(supplierMatch.date) : new Date(),
          term: Number(supplierMatch.term) || 20,
          paymentType: supplierMatch.paymentType || "Full",
          variety: supplierMatch.variety || "",
          brokerageAddSubtract: supplierMatch.brokerageAddSubtract ?? true,
        } as unknown as CompleteSupplierFormValues);
        toast({
          title: "Existing entry loaded",
          description: `SR ${formatted} is ready for review.`,
        });
      }
    },
    [form, suppliers, toast]
  );

  const handleContactBlur = useCallback(
    (value: string) => {
      if (!value || value.trim().length < 6) return;
      const match = suppliers.find((supplier) => supplier.contact === value.trim());
      if (match) {
        form.setValue("name", toTitleCase(match.name || ""));
        form.setValue("so", toTitleCase(match.so || ""));
        form.setValue("address", toTitleCase(match.address || ""));
        form.setValue("variety", toTitleCase(match.variety || ""));
        form.setValue("paymentType", match.paymentType || "Full");
      }
    },
    [form, suppliers]
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const values = form.getValues();
      const payload = await mapFormToCustomer(values, suppliers);
      await addSupplier(payload);
      toast({
        title: "Entry saved",
        description: `${payload.name} recorded with SR ${payload.srNo}.`,
      });
      form.reset({
        ...buildDefaultValues([...suppliers, payload]),
        name: values.name,
        so: values.so,
        address: values.address,
        contact: values.contact,
        variety: values.variety,
        paymentType: values.paymentType,
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Failed to save entry",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, suppliers, toast]);

  const handleClear = useCallback(() => {
    form.reset(buildDefaultValues(suppliers));
  }, [form, suppliers]);

  useEffect(() => {
    onRegisterCommands?.({
      finalize: handleSubmit,
      clear: handleClear,
      reset: handleClear,
    });

    return () => {
      onRegisterCommands?.({
        finalize: undefined,
        clear: undefined,
        reset: undefined,
      });
    };
  }, [handleSubmit, handleClear, onRegisterCommands]);

  const summaryCustomer = useMemo(() => {
    const defaults = buildDefaultValues(suppliers);
    const merged = {
      ...defaults,
      ...watchedValues,
    } as CompleteSupplierFormValues;

    const dateValue = merged.date instanceof Date ? merged.date : new Date(merged.date);
    const dueDateObj = new Date(dateValue);
    dueDateObj.setDate(dueDateObj.getDate() + Number(merged.term || 0));

    return {
      srNo: merged.srNo,
      date: format(dateValue, "yyyy-MM-dd"),
      term: String(merged.term),
      dueDate: format(dueDateObj, "yyyy-MM-dd"),
      name: merged.name,
      so: merged.so,
      address: merged.address,
      contact: merged.contact,
      vehicleNo: merged.vehicleNo,
      variety: merged.variety,
      grossWeight: Number(merged.grossWeight || 0),
      teirWeight: Number(merged.teirWeight || 0),
      rate: Number(merged.rate || 0),
      kartaPercentage: Number(merged.kartaPercentage || 0),
      labouryRate: Number(merged.labouryRate || 0),
      brokerage: Number(merged.brokerage || 0),
      brokerageRate: Number(merged.brokerageRate || 0),
      brokerageAddSubtract: merged.brokerageAddSubtract ?? true,
      kanta: Number(merged.kanta || 0),
      paymentType: merged.paymentType,
    } as unknown as Customer;
  }, [watchedValues, suppliers]);

  return (
    <div className="space-y-6">
      <div className="border border-gray-400/50 rounded-lg p-4">
          <FormProvider {...form}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              <SimpleSupplierFormAllFields
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleContactBlur={handleContactBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setLastVariety={() => undefined}
                setLastPaymentType={() => undefined}
                handleAddOption={addOption}
                handleUpdateOption={updateOption}
                handleDeleteOption={deleteOption}
              />
            </form>
          </FormProvider>

        <div className="mt-6">
          <div className="border border-gray-400/50 rounded-lg p-3 bg-muted/20">
                <SimpleCalculatedSummary
                  customer={summaryCustomer}
                  onSave={handleSubmit}
                  onClearForm={handleClear}
                  isEditing={false}
                  isSubmitting={isSubmitting}
                />
          </div>
        </div>
      </div>

      <div className="border border-gray-400/50 rounded-lg">
          <ScrollArea className="max-h-72">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 bg-muted/40">
                <TableRow>
                  <TableHead>SR No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Net Wt</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {latestEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono">{entry.srNo}</TableCell>
                    <TableCell>
                      {entry.date ? format(new Date(entry.date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>{entry.variety || "—"}</TableCell>
                    <TableCell>{Number(entry.netWeight || 0).toFixed(2)}</TableCell>
                    <TableCell>{formatCurrency(entry.netAmount || 0)}</TableCell>
                    <TableCell>
                      {formatCurrency(
                        Number(entry.originalNetAmount || entry.netAmount || 0) -
                          Number(entry.totalPaid || 0) -
                          Number((entry as any).totalCd || 0)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {latestEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No entries found for this supplier yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
      </div>
    </div>
  );
};

export default SupplierHubEntrySection;


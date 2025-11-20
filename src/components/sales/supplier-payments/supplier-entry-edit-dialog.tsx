
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import type { Customer, OptionItem, Payment, Holiday } from "@/lib/definitions";
import { calculateSupplierEntry, toTitleCase } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { updateSupplier, getOptionsRealtime, getHolidays, getDailyPaymentLimit } from "@/lib/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierForm } from "@/components/sales/supplier-form";
import { CalculatedSummary } from "@/components/sales/calculated-summary";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string()
      .length(10, "Contact number must be exactly 10 digits.")
      .regex(/^\d+$/, "Contact number must only contain digits."),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    kartaPercentage: z.coerce.number().min(0),
    labouryRate: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required"),
    forceUnique: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SupplierEntryEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: Customer | null;
    onSuccess?: () => void;
}

export const SupplierEntryEditDialog: React.FC<SupplierEntryEditDialogProps> = ({
    open,
    onOpenChange,
    entry,
    onSuccess
}) => {
    const { toast } = useToast();
    const suppliers = useLiveQuery(() => db.suppliers.toArray(), []);
    const paymentHistory = useLiveQuery(() => db.payments.toArray(), []);

    const [currentSupplier, setCurrentSupplier] = useState<Customer | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
    const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [dailyPaymentLimit, setDailyPaymentLimit] = useState(800000);

    const safeSuppliers = useMemo(() => Array.isArray(suppliers) ? suppliers : [], [suppliers]);
    const safePaymentHistory = useMemo(() => Array.isArray(paymentHistory) ? paymentHistory : [], [paymentHistory]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            srNo: '',
            date: new Date(),
            term: 20,
            name: '',
            so: '',
            address: '',
            contact: '',
            vehicleNo: '',
            variety: '',
            grossWeight: 0,
            teirWeight: 0,
            rate: 0,
            kartaPercentage: 1,
            labouryRate: 2,
            kanta: 50,
            paymentType: 'Full',
        },
        shouldFocusError: false,
    });

    const performCalculations = useCallback((data: Partial<FormValues>, showWarning: boolean = false) => {
        const { warning, suggestedTerm, ...calculatedState } = calculateSupplierEntry(data, safePaymentHistory, holidays, dailyPaymentLimit, safeSuppliers || []);
        if (currentSupplier) {
            setCurrentSupplier(prev => prev ? ({...prev, ...calculatedState}) : null);
        }
        if (showWarning && warning) {
            let title = 'Date Warning';
            let description = warning;
            if (warning.includes('holiday')) {
                title = 'Holiday on Due Date';
                description = `Try Term: ${String(suggestedTerm)} days`;
            } else if (warning.includes('limit')) {
                title = 'Daily Limit Reached';
                description = `Try Term: ${String(suggestedTerm)} days`;
            }
            toast({ title, description, variant: 'destructive', duration: 7000 });
        }
    }, [safePaymentHistory, holidays, dailyPaymentLimit, safeSuppliers, toast, currentSupplier]);

    // Load entry data when dialog opens
    useEffect(() => {
        if (open && entry) {
            const loadEntryData = async () => {
                let fullEntry: Customer | null = null;
                
                // Try to get full entry from database using id or srNo
                if (entry.id && db) {
                    try {
                        fullEntry = await db.suppliers.get(entry.id) as Customer | null;
                    } catch (error) {
                        console.error('Error fetching supplier by id:', error);
                    }
                }
                
                // If not found by id, try by srNo
                if (!fullEntry && entry.srNo && db) {
                    try {
                        fullEntry = await db.suppliers.where('srNo').equals(entry.srNo).first() as Customer | null;
                    } catch (error) {
                        console.error('Error fetching supplier by srNo:', error);
                    }
                }
                
                // Fallback to entry passed as prop
                const supplierToUse = fullEntry || entry;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                let formDate: Date;
                try {
                    formDate = supplierToUse.date ? new Date(supplierToUse.date) : today;
                    if (isNaN(formDate.getTime())) formDate = today;
                } catch {
                    formDate = today;
                }
                
                const formValues: FormValues = {
                    srNo: supplierToUse.srNo || '',
                    date: formDate,
                    term: Number(supplierToUse.term) || 0,
                    name: supplierToUse.name || '',
                    so: supplierToUse.so || '',
                    address: supplierToUse.address || '',
                    contact: supplierToUse.contact || '',
                    vehicleNo: supplierToUse.vehicleNo || '',
                    variety: supplierToUse.variety || '',
                    grossWeight: supplierToUse.grossWeight || 0,
                    teirWeight: supplierToUse.teirWeight || 0,
                    rate: supplierToUse.rate || 0,
                    kartaPercentage: supplierToUse.kartaPercentage || 1,
                    labouryRate: supplierToUse.labouryRate || 2,
                    kanta: supplierToUse.kanta || 50,
                    paymentType: supplierToUse.paymentType || 'Full',
                    forceUnique: supplierToUse.forceUnique || false,
                };
                
                // Ensure supplier has all required fields with defaults
                const supplierWithDefaults: Customer = {
                    ...supplierToUse,
                    netWeight: supplierToUse.netWeight || 0,
                    rate: supplierToUse.rate || 0,
                    taxRate: supplierToUse.taxRate || 0,
                    isGstIncluded: supplierToUse.isGstIncluded || false,
                    advanceFreight: supplierToUse.advanceFreight || 0,
                };
                
                setCurrentSupplier(supplierWithDefaults);
                form.reset(formValues);
                performCalculations(formValues, false);
            };
            
            loadEntryData();
        }
    }, [open, entry, form, performCalculations]);

    // Load options and settings
    useEffect(() => {
        if (!open) return;

        const fetchSettings = async () => {
            const fetchedHolidays = await getHolidays();
            setHolidays(fetchedHolidays);
            const limit = await getDailyPaymentLimit();
            setDailyPaymentLimit(limit);
        };
        fetchSettings();

        const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => console.error("Error fetching varieties:", err));
        const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => console.error("Error fetching payment types:", err));

        return () => {
            unsubVarieties();
            unsubPaymentTypes();
        };
    }, [open]);

    const handleCalculationFieldChange = useCallback((fieldName: string, value: any) => {
        const currentValues = form.getValues();
        const updatedValues = { ...currentValues, [fieldName]: value };
        performCalculations(updatedValues, false);
    }, [form, performCalculations]);

    const handleSrNoBlur = useCallback(async (rawValue: string) => {
        // Handle SR No blur if needed
    }, []);

    const handleNameOrSoBlur = useCallback(() => {
        // Handle name or SO blur if needed
    }, []);

    const onContactChange = useCallback(() => {
        // Handle contact change if needed
    }, []);

    const handleAddOption = useCallback(async (type: 'variety' | 'paymentType', value: string) => {
        // Handle add option if needed
    }, []);

    const handleUpdateOption = useCallback(async (type: 'variety' | 'paymentType', id: string, value: string) => {
        // Handle update option if needed
    }, []);

    const handleDeleteOption = useCallback(async (type: 'variety' | 'paymentType', id: string) => {
        // Handle delete option if needed
    }, []);

    const onSubmit = async (values: FormValues) => {
        if (!currentSupplier) {
            toast({ title: "Error", description: "Invalid entry data", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            // Find supplier ID if not available
            let supplierId = currentSupplier.id;
            if (!supplierId && values.srNo && db) {
                const foundSupplier = await db.suppliers.where('srNo').equals(values.srNo).first();
                if (foundSupplier?.id) {
                    supplierId = foundSupplier.id;
                } else {
                    throw new Error('Supplier entry not found in database');
                }
            }

            if (!supplierId) {
                throw new Error('Cannot update: Supplier ID not found');
            }

            const completeEntry: Customer = {
                ...currentSupplier,
                ...values,
                id: supplierId,
                customerId: currentSupplier.customerId || '',
                date: format(values.date, 'yyyy-MM-dd'),
                dueDate: format(new Date(values.date.getTime() + (values.term * 24 * 60 * 60 * 1000)), 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                variety: toTitleCase(values.variety),
                vehicleNo: toTitleCase(values.vehicleNo),
                forceUnique: values.forceUnique || false,
            };

            const { id, ...updateData } = completeEntry as any;
            const success = await updateSupplier(id, updateData);
            
            if (success) {
                toast({ title: "Entry updated successfully!", variant: "success" });
                onSuccess?.();
                onOpenChange(false);
            } else {
                throw new Error('Failed to update supplier');
            }
        } catch (error) {
            console.error("Error updating supplier:", error);
            toast({ title: "Failed to update entry.", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!entry) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle>Edit Supplier Entry - {entry.srNo}</DialogTitle>
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
                                form="supplier-entry-edit-form"
                                disabled={isSubmitting}
                            >
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Entry
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6">
                    <FormProvider {...form}>
                        <form id="supplier-entry-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-4">
                            <SupplierForm
                                form={form}
                                handleSrNoBlur={handleSrNoBlur}
                                onContactChange={onContactChange}
                                handleNameOrSoBlur={handleNameOrSoBlur}
                                varietyOptions={varietyOptions}
                                paymentTypeOptions={paymentTypeOptions}
                                setLastVariety={() => {}}
                                setLastPaymentType={() => {}}
                                handleAddOption={handleAddOption}
                                handleUpdateOption={handleUpdateOption}
                                handleDeleteOption={handleDeleteOption}
                                allSuppliers={safeSuppliers}
                                handleCalculationFieldChange={handleCalculationFieldChange}
                                onAutoFill={null}
                            />
                            {currentSupplier && (
                                <CalculatedSummary 
                                    customer={currentSupplier}
                                    onSave={() => form.handleSubmit(onSubmit)()}
                                    isEditing={true}
                                    isCustomerForm={false}
                                />
                            )}
                        </form>
                    </FormProvider>
                </div>
            </DialogContent>
        </Dialog>
    );
};


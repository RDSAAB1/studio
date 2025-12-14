
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { Loader2, Percent } from "lucide-react";

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
    brokerageRate: z.preprocess((val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }, z.number().min(0).default(0)),
    brokerageAddSubtract: z.boolean().optional(),
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
    const loadedEntryIdRef = useRef<string | null>(null);
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
            brokerageRate: 0,
            brokerageAddSubtract: true,
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
        // Reset loaded entry ref when dialog closes
        if (!open) {
            loadedEntryIdRef.current = null;
            return;
        }
        
        if (!entry) return;
        
        // Get entry ID to check if we've already loaded this entry
        const entryId = entry.id || entry.srNo;
        if (!entryId) return;
        
        // Skip if we've already loaded this entry
        if (loadedEntryIdRef.current === entryId) {
            return;
        }
        
        const loadEntryData = async () => {
            console.log('[SupplierEntryEdit] Loading entry data:', {
                entryId: entry.id,
                entrySrNo: entry.srNo,
                entryName: entry.name
            });
            
            let fullEntry: Customer | null = null;
            
            // Try to get full entry from database using id or srNo
            if (entry.id && db) {
                try {
                    fullEntry = await db.suppliers.get(entry.id) as Customer | null;
                    console.log('[SupplierEntryEdit] Found by id:', !!fullEntry);
                } catch (error) {
                    console.error('[SupplierEntryEdit] Error fetching supplier by id:', error);
                }
            }
            
            // If not found by id, try by srNo
            if (!fullEntry && entry.srNo && db) {
                try {
                    fullEntry = await db.suppliers.where('srNo').equals(entry.srNo).first() as Customer | null;
                    console.log('[SupplierEntryEdit] Found by srNo:', !!fullEntry, fullEntry?.id);
                } catch (error) {
                    console.error('[SupplierEntryEdit] Error fetching supplier by srNo:', error);
                }
            }
            
            // Fallback to entry passed as prop, but ensure it has an id
            const supplierToUse = fullEntry || entry;
            
            // If supplierToUse doesn't have an id, try to find it
            if (!supplierToUse.id && supplierToUse.srNo && db) {
                try {
                    const found = await db.suppliers.where('srNo').equals(supplierToUse.srNo).first() as Customer | null;
                    if (found) {
                        Object.assign(supplierToUse, { id: found.id });
                        console.log('[SupplierEntryEdit] Added missing id:', found.id);
                    }
                } catch (error) {
                    console.error('[SupplierEntryEdit] Error finding id for entry:', error);
                }
            }
            
            console.log('[SupplierEntryEdit] Final supplier to use:', {
                id: supplierToUse.id,
                srNo: supplierToUse.srNo,
                name: supplierToUse.name
            });
            
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
                kartaPercentage: Number(supplierToUse.kartaPercentage) || 1,
                labouryRate: Number(supplierToUse.labouryRate) || 2,
                brokerageRate: Number(supplierToUse.brokerageRate) || 0,
                brokerageAddSubtract: supplierToUse.brokerageAddSubtract ?? true,
                kanta: Number(supplierToUse.kanta) || 50,
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
            
            // Mark this entry as loaded before setting state
            loadedEntryIdRef.current = entryId;
            
            setCurrentSupplier(supplierWithDefaults);
            form.reset(formValues);
            
            // Perform calculations after a small delay to ensure form is reset
            setTimeout(() => {
                performCalculations(formValues, false);
            }, 0);
        };
        
        loadEntryData();
    }, [open, entry?.id, entry?.srNo, db]);

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
            // Find supplier ID - try multiple methods
            let supplierId = currentSupplier.id;
            
            console.log('[SupplierEntryEdit] Looking for supplier ID:', {
                currentSupplierId: currentSupplier.id,
                entryId: entry?.id,
                srNo: values.srNo,
                currentSupplierSrNo: currentSupplier.srNo
            });
            
            // Try entry.id first (from prop)
            if (!supplierId && entry?.id) {
                supplierId = entry.id;
                console.log('[SupplierEntryEdit] Using entry.id:', supplierId);
            }
            
            // Try finding by srNo in database
            if (!supplierId && values.srNo && db) {
                try {
                    const foundSupplier = await db.suppliers.where('srNo').equals(values.srNo).first();
                    if (foundSupplier?.id) {
                        supplierId = foundSupplier.id;
                        console.log('[SupplierEntryEdit] Found by srNo:', supplierId);
                    }
                } catch (error) {
                    console.error('[SupplierEntryEdit] Error finding supplier by srNo:', error);
                }
            }
            
            // Try currentSupplier.srNo if values.srNo didn't work
            if (!supplierId && currentSupplier.srNo && db) {
                try {
                    const foundSupplier = await db.suppliers.where('srNo').equals(currentSupplier.srNo).first();
                    if (foundSupplier?.id) {
                        supplierId = foundSupplier.id;
                        console.log('[SupplierEntryEdit] Found by currentSupplier.srNo:', supplierId);
                    }
                } catch (error) {
                    console.error('[SupplierEntryEdit] Error finding supplier by currentSupplier.srNo:', error);
                }
            }

            if (!supplierId) {
                console.error('[SupplierEntryEdit] Cannot find supplier ID:', {
                    currentSupplier: {
                        id: currentSupplier.id,
                        srNo: currentSupplier.srNo
                    },
                    entry: {
                        id: entry?.id,
                        srNo: entry?.srNo
                    },
                    values: {
                        srNo: values.srNo
                    }
                });
                throw new Error('Cannot update: Supplier ID not found. Please ensure the entry exists in the database.');
            }
            
            console.log('[SupplierEntryEdit] Using supplier ID:', supplierId);

            // Recalculate all fields using calculateSupplierEntry
            const entryDataForCalculation = {
                ...currentSupplier,
                ...values,
                date: format(values.date, 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                variety: toTitleCase(values.variety),
                vehicleNo: toTitleCase(values.vehicleNo),
                brokerageRate: values.brokerageRate || 0,
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
            };
            
            const { warning, suggestedTerm, ...calculatedFields } = calculateSupplierEntry(
                entryDataForCalculation,
                safePaymentHistory,
                holidays,
                dailyPaymentLimit,
                safeSuppliers || []
            );

            const completeEntry: Customer = {
                ...currentSupplier,
                ...values,
                ...calculatedFields, // Include all calculated fields
                id: supplierId,
                customerId: currentSupplier.customerId || '',
                date: format(values.date, 'yyyy-MM-dd'),
                dueDate: format(new Date(values.date.getTime() + (values.term * 24 * 60 * 60 * 1000)), 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                variety: toTitleCase(values.variety),
                vehicleNo: toTitleCase(values.vehicleNo),
                brokerageRate: values.brokerageRate || 0,
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
                forceUnique: values.forceUnique || false,
            };

            const { id, ...updateData } = completeEntry as any;
            
            // Log what we're updating
            console.log('[SupplierEntryEdit] Updating supplier:', {
                id,
                updateDataKeys: Object.keys(updateData),
                calculatedFields: Object.keys(calculatedFields),
                sampleData: {
                    name: updateData.name,
                    variety: updateData.variety,
                    grossWeight: updateData.grossWeight,
                    rate: updateData.rate,
                    weight: updateData.weight,
                    netWeight: updateData.netWeight,
                    amount: updateData.amount,
                    originalNetAmount: updateData.originalNetAmount
                }
            });
            
            // Verify the update data is not empty
            if (!updateData || Object.keys(updateData).length === 0) {
                throw new Error('Update data is empty');
            }
            
            const success = await updateSupplier(id, updateData);
            
            // Verify the update actually happened in local DB
            if (success && db) {
                const updatedEntry = await db.suppliers.get(id);
                console.log('[SupplierEntryEdit] Verification - Entry after update:', {
                    id,
                    found: !!updatedEntry,
                    name: updatedEntry?.name,
                    variety: updatedEntry?.variety,
                    grossWeight: updatedEntry?.grossWeight,
                    rate: updatedEntry?.rate
                });
                
                if (!updatedEntry) {
                    console.error('[SupplierEntryEdit] ERROR: Entry not found in local DB after update!');
                    throw new Error('Entry was not updated in local database');
                }
            }
            
            if (success) {
                // Force immediate sync to Firestore
                try {
                    const { forceSyncToFirestore } = await import('@/lib/local-first-sync');
                    // Wait a bit for the local update to complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await forceSyncToFirestore();
                    console.log('[SupplierEntryEdit] Sync to Firestore completed');
                } catch (syncError) {
                    console.error('[SupplierEntryEdit] Sync error (non-critical):', syncError);
                    // Don't fail the update if sync fails - it will retry later
                }
                
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
                            
                            {/* Brokerage Field */}
                            <Card>
                                <CardContent className="p-3 space-y-2">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="brokerageRate" className="text-xs whitespace-nowrap">Brokerage Rate</Label>
                                            <Controller
                                                name="brokerageAddSubtract"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <SegmentedSwitch
                                                        id="brokerage-toggle"
                                                        checked={field.value ?? true}
                                                        onCheckedChange={(checked) => {
                                                            field.onChange(checked);
                                                            const currentValues = form.getValues();
                                                            performCalculations({ ...currentValues, brokerageAddSubtract: checked }, false);
                                                        }}
                                                        leftLabel="EXCLUDE"
                                                        rightLabel="INCLUDE"
                                                        className="w-36 h-6"
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="relative">
                                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                                <Percent className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <Controller
                                                name="brokerageRate"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <Input 
                                                        id="brokerageRate" 
                                                        type="number" 
                                                        step="0.01"
                                                        value={field.value !== undefined && field.value !== null ? field.value : ''}
                                                        onChange={(e) => {
                                                            const value = parseFloat(e.target.value) || 0;
                                                            field.onChange(value);
                                                            const currentValues = form.getValues();
                                                            performCalculations({ ...currentValues, brokerageRate: value }, false);
                                                        }}
                                                        onBlur={field.onBlur}
                                                        className="h-8 text-sm pl-10" 
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            Brokerage Amount = Final Weight × Brokerage Rate
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                            
                            {currentSupplier && (
                                <CalculatedSummary 
                                    customer={{
                                        ...currentSupplier,
                                        weight: currentSupplier.weight || (Number(form.watch('grossWeight') || 0) - Number(form.watch('teirWeight') || 0)),
                                        brokerageRate: Number(form.watch('brokerageRate')) || 0,
                                        brokerageAddSubtract: form.watch('brokerageAddSubtract') ?? true,
                                    }}
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


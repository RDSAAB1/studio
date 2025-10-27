"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';
import { addSupplier } from "@/lib/firestore";
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { simpleSupplierFormSchema, type SimpleSupplierFormValues } from "@/lib/simple-form-schema";
import SimpleSupplierForm from "@/components/sales/simple-supplier-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Plus } from "lucide-react";

const getInitialFormState = (): SimpleSupplierFormValues => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
        srNo: 'S----',
        date: today,
        name: '',
        contact: '',
        so: '',
        address: '',
        vehicleNo: '',
        variety: '',
        grossWeight: 0,
        rate: 0,
    };
};

export default function SimpleSupplierEntry() {
    const { toast } = useToast();
    const suppliers = useLiveQuery(() => db.suppliers.orderBy('srNo').reverse().toArray(), []);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<SimpleSupplierFormValues>({
        resolver: zodResolver(simpleSupplierFormSchema),
        defaultValues: getInitialFormState(),
    });

    useEffect(() => {
        if (suppliers !== undefined) {
            setIsLoading(false);
        }
    }, [suppliers]);

    const handleSrNoBlur = (srNoValue: string) => {
        let formattedSrNo = srNoValue.trim();
        if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
            formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'S');
            form.setValue('srNo', formattedSrNo);
        }
    };

    const onSubmit = async (values: SimpleSupplierFormValues) => {
        setIsSubmitting(true);
        
        try {
            const supplierData = {
                id: values.srNo,
                srNo: values.srNo,
                date: format(values.date, 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                contact: values.contact,
                so: toTitleCase(values.so || ''),
                address: toTitleCase(values.address || ''),
                vehicleNo: toTitleCase(values.vehicleNo || ''),
                variety: toTitleCase(values.variety),
                grossWeight: values.grossWeight,
                rate: values.rate,
                // Set default values for fields not in simple form
                term: '20',
                dueDate: format(values.date, 'yyyy-MM-dd'),
                teirWeight: 0,
                weight: values.grossWeight,
                kartaPercentage: 1,
                kartaWeight: 0,
                kartaAmount: 0,
                netWeight: values.grossWeight,
                labouryRate: 2,
                labouryAmount: 0,
                kanta: 50,
                amount: values.grossWeight * values.rate,
                netAmount: values.grossWeight * values.rate,
                originalNetAmount: values.grossWeight * values.rate,
                paymentType: 'Full',
                customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact}`,
                barcode: '',
                receiptType: 'Cash',
            };

            await addSupplier(supplierData);
            
            toast({ 
                title: "Entry saved successfully!", 
                description: `Supplier ${values.name} has been added.`,
                variant: "success"
            });

            // Reset form for new entry
            form.reset(getInitialFormState());
            
        } catch (error) {
            console.error("Error saving supplier:", error);
            toast({ 
                title: "Failed to save entry", 
                description: "Please try again.",
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNewEntry = () => {
        form.reset(getInitialFormState());
        toast({ title: "New entry started" });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Simple Supplier Entry</span>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                onClick={handleNewEntry}
                                disabled={isSubmitting}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                New Entry
                            </Button>
                            <Button 
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Save Entry
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FormProvider {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <SimpleSupplierForm 
                                form={form}
                                handleSrNoBlur={handleSrNoBlur}
                            />
                        </form>
                    </FormProvider>
                </CardContent>
            </Card>

            {/* Simple Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Entry Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="font-medium">Total Amount: </span>
                            <span className="text-lg font-bold">
                                ₹{((form.watch('grossWeight') || 0) * (form.watch('rate') || 0)).toLocaleString()}
                            </span>
                        </div>
                        <div>
                            <span className="font-medium">Weight: </span>
                            <span>{(form.watch('grossWeight') || 0).toLocaleString()} kg</span>
                        </div>
                        <div>
                            <span className="font-medium">Rate: </span>
                            <span>₹{(form.watch('rate') || 0).toLocaleString()}/kg</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

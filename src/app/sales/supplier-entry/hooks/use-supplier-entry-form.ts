import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/database';
import { addSupplier, updateSupplier, getOptionsRealtime, addOption, updateOption, deleteOption, deleteSupplier } from "@/lib/firestore";
import { formatSrNo, toTitleCase } from "@/lib/utils";
import { completeSupplierFormSchema, type CompleteSupplierFormValues } from "@/lib/complete-form-schema";
import type { Customer, OptionItem, ConsolidatedReceiptData } from "@/lib/definitions";
import { useSupplierCalculations } from "./use-supplier-calculations";

const getInitialFormState = (lastVariety?: string, lastPaymentType?: string, latestSupplier?: Customer): CompleteSupplierFormValues => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get the latest serial number
    let nextSrNo = 'S0001';
    if (latestSupplier) {
        const num = parseInt(latestSupplier.srNo.substring(1));
        if (!isNaN(num)) {
            nextSrNo = formatSrNo(num + 1, 'S');
        }
    }

    return {
        srNo: nextSrNo,
        date: today,
        term: 20,
        name: '',
        so: '',
        address: '',
        contact: '',
        vehicleNo: '',
        variety: lastVariety || '',
        grossWeight: 0,
        teirWeight: 0,
        rate: 0,
        kartaPercentage: 1,
        labouryRate: 0,
        brokerage: 0,
        brokerageRate: 0,
        brokerageAddSubtract: true,
        kanta: 50,
        paymentType: lastPaymentType || 'Full',
        forceUnique: false,
    };
};

interface UseSupplierEntryFormProps {
    isClient: boolean;
    allSuppliers: Customer[] | undefined;
    suppliersForSerial: Customer[] | undefined;
}

export function useSupplierEntryForm({ isClient, allSuppliers, suppliersForSerial }: UseSupplierEntryFormProps) {
    const { toast } = useToast();
    const { calculateValues } = useSupplierCalculations();

    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
    const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
    const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
    const [lastVariety, setLastVariety] = useState<string>('');
    const [lastPaymentType, setLastPaymentType] = useState<string>('');
    const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
    const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
    const [allConsolidatedGroups, setAllConsolidatedGroups] = useState<ConsolidatedReceiptData[]>([]);

    const [currentSupplier, setCurrentSupplier] = useState<Customer>(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return {
            id: "", srNo: 'S----', date: format(today, 'yyyy-MM-dd'), term: '20', dueDate: format(today, 'yyyy-MM-dd'), 
            name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
            weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
            labouryRate: 0, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
            receiptType: 'Cash', paymentType: 'Full', customerId: '',
        };
    });

    const form = useForm<CompleteSupplierFormValues>({
        resolver: zodResolver(completeSupplierFormSchema),
        defaultValues: getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]),
    });

    // Update form with latest serial number when suppliers data is available
    useEffect(() => {
        if (suppliersForSerial && suppliersForSerial.length > 0) {
            // Only update if not editing and form is relatively clean (checking srNo default)
            // This prevents overwriting user input if they started typing before data loaded
            const currentValues = form.getValues();
            if (!isEditing && (currentValues.srNo === 'S0001' || currentValues.srNo === 'S----')) {
                const newFormState = getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial[0]);
                form.reset(newFormState);
            }
        }
    }, [suppliersForSerial, lastPaymentType, form, isEditing, lastVariety]);

    // Initialize options and load saved state
    useEffect(() => {
        if (!isClient) return;
        
        const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => {});
        const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => {});

        const savedVariety = localStorage.getItem('lastSelectedVariety');
        if (savedVariety) {
            setLastVariety(savedVariety);
            form.setValue('variety', savedVariety);
        }
        
        const savedPaymentType = localStorage.getItem('lastSelectedPaymentType');
        if (savedPaymentType) {
            setLastPaymentType(savedPaymentType);
            form.setValue('paymentType', savedPaymentType);
        }

        form.setValue('date', new Date());

        return () => {
            unsubVarieties();
            unsubPaymentTypes();
        };
    }, [isClient, form]);

    // Restore form state from localStorage
    useEffect(() => {
        if (!isClient) return;
        
        try {
            const saved = localStorage.getItem('supplier-entry-form-state');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.name || parsed.srNo || parsed.variety || (parsed.grossWeight && parsed.grossWeight > 0)) {
                    if (parsed.date) {
                        parsed.date = new Date(parsed.date);
                    }
                    const allowedKeys: (keyof CompleteSupplierFormValues)[] = [
                        'srNo','date','term','name','so','address','contact','vehicleNo','variety',
                        'grossWeight','teirWeight','rate','kartaPercentage','labouryRate','brokerage',
                        'brokerageRate','brokerageAddSubtract','kanta','paymentType','forceUnique'
                    ];
                    allowedKeys.forEach((k) => {
                        if (parsed[k] !== undefined) {
                            form.setValue(k, parsed[k] as CompleteSupplierFormValues[typeof k], { shouldValidate: false });
                        }
                    });
                }
            }
        } catch (error) {
            // Error restoring form state
        }
    }, [isClient, form]);

    const calculateSummary = useCallback(() => {
        const values = form.getValues();
        if (values) {
            const calculated = calculateValues(values);

            // Calculate due date: date + term (in days)
            const termDays = Number(values.term) || 20;
            const entryDate = values.date || new Date();
            const dueDate = new Date(entryDate);
            dueDate.setDate(dueDate.getDate() + termDays);
            
            setCurrentSupplier(prev => ({
                ...prev,
                srNo: values.srNo || 'S----',
                date: values.date ? format(values.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                term: String(termDays),
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                name: values.name || '',
                so: values.so || '',
                address: values.address || '',
                contact: values.contact || '',
                vehicleNo: values.vehicleNo || '',
                variety: values.variety || '',
                grossWeight: Number(values.grossWeight) || 0,
                teirWeight: Number(values.teirWeight) || 0,
                weight: calculated.finalWeight,
                kartaPercentage: Number(values.kartaPercentage) || 0,
                kartaWeight: calculated.kartaWeight,
                kartaAmount: calculated.kartaAmount,
                netWeight: calculated.netWeight,
                rate: Number(values.rate) || 0,
                labouryRate: Number(values.labouryRate) || 0,
                labouryAmount: calculated.labouryAmount,
                brokerage: calculated.brokerageAmount,
                brokerageRate: Number(values.brokerageRate) || 0,
                brokerageAmount: calculated.brokerageAmount,
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
                kanta: Number(values.kanta) || 0,
                amount: calculated.amount,
                netAmount: calculated.netAmount,
                originalNetAmount: calculated.netAmount,
                paymentType: values.paymentType || 'Full',
            }));
        }
    }, [form, calculateValues]);

    // Real-time calculations with debouncing
    useEffect(() => {
        let saveTimer: NodeJS.Timeout;
        
        const subscription = form.watch((values) => {
            if (typeof window !== 'undefined') {
                clearTimeout(saveTimer);
                saveTimer = setTimeout(() => {
                    try {
                        if (values.name || values.srNo || values.variety || (values.grossWeight && values.grossWeight > 0)) {
                            localStorage.setItem('supplier-entry-form-state', JSON.stringify(values));
                        }
                    } catch (error) {
                        // Error saving form state
                    }
                }, 500);
            }
        });
        
        return () => {
            subscription.unsubscribe();
            clearTimeout(saveTimer);
        };
    }, [calculateSummary, form]);

    const handleSetLastVariety = (variety: string) => {
        setLastVariety(variety);
        if(isClient) {
            localStorage.setItem('lastSelectedVariety', variety);
        }
    };

    const handleSetLastPaymentType = (paymentType: string) => {
        setLastPaymentType(paymentType);
        if(isClient) {
            localStorage.setItem('lastSelectedPaymentType', paymentType);
        }
    };

    const handleSrNoBlur = async (srNoValue: string) => {
        let formattedSrNo = srNoValue.trim().toUpperCase();
        
        if (!formattedSrNo) return;
        
        let numericPart: number | null = null;
        if (formattedSrNo.startsWith('S')) {
            const numStr = formattedSrNo.substring(1).replace(/^0+/, '');
            numericPart = parseInt(numStr, 10);
        } else {
            numericPart = parseInt(formattedSrNo, 10);
        }
        
        if (numericPart !== null && !isNaN(numericPart) && isFinite(numericPart) && numericPart > 0) {
            formattedSrNo = formatSrNo(numericPart, 'S');
            form.setValue('srNo', formattedSrNo);
            
            try {
                const existingSupplier = await db.suppliers
                    .where('srNo')
                    .equals(formattedSrNo)
                    .first();
                
                if (existingSupplier) {
                    form.reset({
                        srNo: existingSupplier.srNo,
                        date: existingSupplier.date ? new Date(existingSupplier.date) : new Date(),
                        term: Number(existingSupplier.term) || 0,
                        name: existingSupplier.name || '',
                        so: existingSupplier.so || '',
                        address: existingSupplier.address || '',
                        contact: existingSupplier.contact || '',
                        vehicleNo: existingSupplier.vehicleNo || '',
                        variety: existingSupplier.variety || '',
                        grossWeight: Number(existingSupplier.grossWeight) || 0,
                        teirWeight: Number(existingSupplier.teirWeight) || 0,
                        rate: Number(existingSupplier.rate) || 0,
                        kartaPercentage: Number(existingSupplier.kartaPercentage) || 0,
                        labouryRate: Number(existingSupplier.labouryRate) || 0,
                        brokerage: Number(existingSupplier.brokerage) || 0,
                        brokerageRate: Number(existingSupplier.brokerageRate) || 0,
                        brokerageAddSubtract: existingSupplier.brokerageAddSubtract ?? true,
                        kanta: Number(existingSupplier.kanta) || 0,
                        paymentType: existingSupplier.paymentType || 'Full',
                        forceUnique: existingSupplier.forceUnique || false,
                    });
                    
                    setIsEditing(true);
                    setCurrentSupplier(existingSupplier);
                    
                    setTimeout(() => {
                        calculateSummary();
                    }, 100);
                    
/* 
                    toast({
                        title: "Existing Entry Found",
                        description: `Record for ${existingSupplier.name}${existingSupplier.so ? ` S/O ${existingSupplier.so}` : ''} (SR# ${formattedSrNo}) has been loaded for editing.`,
                    });
*/
                }
            } catch (error) {
                // Error checking existing supplier
            }
        }
    };

    const handleContactBlur = async (contactValue: string) => {
        const trimmedContact = contactValue.trim();
        if (trimmedContact && trimmedContact.length >= 10) {
            try {
                const existingSupplier = await db.suppliers
                    .where('contact')
                    .equals(trimmedContact)
                    .first();
                
                if (existingSupplier) {
                    form.setValue('name', existingSupplier.name || '');
                    form.setValue('so', existingSupplier.so || '');
                    form.setValue('address', existingSupplier.address || '');
                    setCurrentSupplier(existingSupplier);
                    
                    setTimeout(() => {
                        calculateSummary();
                    }, 100);
                    
/* 
                    toast({
                        title: "Existing Contact Found",
                        description: `Details for ${existingSupplier.name}${existingSupplier.so ? ` S/O ${existingSupplier.so}` : ''}, ${existingSupplier.address || 'No Address'} (Contact: ${trimmedContact}) have been auto-filled.`,
                    });
*/
                }
            } catch (error) {
                // Error checking existing contact
            }
        }
    };

    const onSubmit = async (values: CompleteSupplierFormValues) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const calculated = calculateValues(values);

            // Capture editing state BEFORE it gets reset below
            const wasEditing = isEditing;

            const termDays = Number(values.term) || 20;
            const dueDate = new Date(values.date);
            dueDate.setDate(dueDate.getDate() + termDays);
            
            const supplierBase: Omit<Customer, 'id'> = {
                srNo: values.srNo,
                date: format(values.date, 'yyyy-MM-dd'),
                term: String(termDays),
                dueDate: format(dueDate, 'yyyy-MM-dd'),
                name: toTitleCase(values.name),
                so: toTitleCase(values.so),
                address: toTitleCase(values.address),
                contact: values.contact,
                vehicleNo: (values.vehicleNo || '').toUpperCase(),
                variety: values.variety ? String(values.variety).toUpperCase() : values.variety,
                grossWeight: Number(values.grossWeight),
                teirWeight: Number(values.teirWeight),
                weight: calculated.finalWeight,
                kartaPercentage: Number(values.kartaPercentage),
                kartaWeight: calculated.kartaWeight,
                kartaAmount: calculated.kartaAmount,
                netWeight: calculated.netWeight,
                rate: Number(values.rate),
                labouryRate: Number(values.labouryRate),
                labouryAmount: calculated.labouryAmount,
                brokerage: Number(values.brokerage || 0),
                brokerageRate: Number(values.brokerageRate || 0),
                brokerageAmount: calculated.brokerageAmount,
                brokerageAddSubtract: values.brokerageAddSubtract ?? true,
                kanta: Number(values.kanta),
                amount: calculated.amount,
                netAmount: calculated.netAmount,
                originalNetAmount: calculated.netAmount,
                paymentType: values.paymentType,
                customerId: `${toTitleCase(values.name).toLowerCase()}|${toTitleCase(values.so).toLowerCase()}`,
                barcode: '',
                receiptType: 'Cash',
                forceUnique: values.forceUnique,
            };

            let savedId: string | null = null;

            if (isEditing && currentSupplier.id) {
                let targetId = currentSupplier.id;
                
                const updatedSupplier = { ...supplierBase, id: targetId } as Customer;
                setCurrentSupplier(updatedSupplier);
                setIsEditing(false);
                savedId = targetId;

                updateSupplier(targetId, supplierBase).catch(() => {});
            } else {
                // For non-editing mode, always check DATABASE directly to catch old entries outside the 500-limit cache
                const existingSupplier = values.srNo ? await db.suppliers.where('srNo').equals(values.srNo.trim()).first() : null;
                
                if (existingSupplier?.id) {
                    // Update instead of add if found
                    updateSupplier(existingSupplier.id, supplierBase).catch(() => {});
                    savedId = existingSupplier.id;
                    setCurrentSupplier({ ...supplierBase, id: existingSupplier.id } as Customer);
                } else {
                    const supplierId = values.srNo && values.srNo.trim() !== '' && values.srNo !== 'S----'
                        ? values.srNo
                        : crypto.randomUUID();
                    const newSupplier = { ...supplierBase, id: supplierId } as Customer;
                    setCurrentSupplier(newSupplier);
                    savedId = supplierId;
                    setIsEditing(false);
                    
                    addSupplier(newSupplier).catch(() => {});
                }
            }

            if (savedId) {
                setHighlightEntryId(savedId);
                setTimeout(() => setHighlightEntryId(null), 3000);
            }
            
            {
                // Always reset form after save OR update — ready for next new entry.
                // New entry:  next = justSaved srNo + 1  (reliable, no DB query needed)
                // Update:     next = highest existing srNo + 1  (no new record was added)
                let nextSrNo: string;

                if (wasEditing) {
                    // After update: derive from highest known serial in list
                    const highestSupplier = suppliersForSerial?.[0];
                    if (highestSupplier) {
                        const num = parseInt(highestSupplier.srNo.substring(1), 10);
                        nextSrNo = !isNaN(num) ? formatSrNo(num + 1, 'S') : 'S0001';
                    } else {
                        nextSrNo = 'S0001';
                    }
                } else {
                    // After new save: just-saved srNo + 1 (instant, no race condition)
                    const justSavedNum = parseInt(values.srNo.substring(1), 10);
                    nextSrNo = !isNaN(justSavedNum) ? formatSrNo(justSavedNum + 1, 'S') : values.srNo;
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                form.reset({
                    srNo: nextSrNo,
                    date: today,
                    term: 20,
                    name: '',
                    so: '',
                    address: '',
                    contact: '',
                    vehicleNo: '',
                    variety: lastVariety || '',
                    grossWeight: 0,
                    teirWeight: 0,
                    rate: 0,
                    kartaPercentage: 1,
                    labouryRate: 0,
                    brokerage: 0,
                    brokerageRate: 0,
                    brokerageAddSubtract: true,
                    kanta: 50,
                    paymentType: lastPaymentType || 'Full',
                    forceUnique: false,
                });

                if (typeof window !== 'undefined') {
                    localStorage.removeItem('supplier-entry-form-state');
                }

                // IMPORTANT: Reset currentSupplier ID and identity to prevent overwriting on next entry
                const resetSupplier: Customer = {
                    id: "", srNo: nextSrNo, date: format(today, 'yyyy-MM-dd'), term: '20', dueDate: format(today, 'yyyy-MM-dd'), 
                    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
                    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
                    labouryRate: 0, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
                    receiptType: 'Cash', paymentType: lastPaymentType || 'Full', customerId: '',
                };
                setCurrentSupplier(resetSupplier);
            }
            
        } catch (error: any) {
            toast({ 
                title: "Failed to save entry", 
                description: error?.message || "Please try again.",
                variant: "destructive" 
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCurrent = useCallback(async () => {
        if (!currentSupplier.id) {
            form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            setCurrentSupplier({
                id: "", srNo: 'S----', date: format(new Date(), 'yyyy-MM-dd'), term: '20', dueDate: format(new Date(), 'yyyy-MM-dd'), 
                name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
                weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
                labouryRate: 0, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
                receiptType: 'Cash', paymentType: 'Full', customerId: '',
            });
            toast({ title: 'Form cleared' });
            return;
        }

        try {
            let targetId = currentSupplier.id;
            if (!targetId || targetId.length < 4) {
                const existingSupplier = allSuppliers?.find(s => s.srNo === currentSupplier.srNo);
                if (existingSupplier?.id) {
                    targetId = existingSupplier.id;
                }
            }

            if (!targetId || targetId.length < 4) {
                toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not locate this entry in database.' });
                return;
            }

            await deleteSupplier(targetId);
            toast({ title: 'Deleted', description: 'Entry deleted successfully' });
            form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
            setCurrentSupplier({
                id: "", srNo: 'S----', date: format(new Date(), 'yyyy-MM-dd'), term: '20', dueDate: format(new Date(), 'yyyy-MM-dd'), 
                name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
                weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
                labouryRate: 0, labouryAmount: 0, brokerage: 0, brokerageRate: 0, brokerageAmount: 0, brokerageAddSubtract: true, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
                receiptType: 'Cash', paymentType: 'Full', customerId: '',
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not delete entry' });
        }
    }, [currentSupplier, toast, form, lastVariety, lastPaymentType, suppliersForSerial, allSuppliers]);

    const handlePrintCurrent = useCallback(() => {
        if (!currentSupplier.id) {
            const v = form.getValues();
            const calculated = calculateValues(v);
            
            const temp: Customer = {
                id: 'TEMP',
                srNo: v.srNo,
                date: format(v.date, 'yyyy-MM-dd'),
                term: String(v.term),
                dueDate: (() => {
                    const termDays = Number(v.term) || 20;
                    const dueDate = new Date(v.date);
                    dueDate.setDate(dueDate.getDate() + termDays);
                    return format(dueDate, 'yyyy-MM-dd');
                })(),
                name: toTitleCase(v.name),
                so: toTitleCase(v.so),
                address: toTitleCase(v.address),
                contact: v.contact,
                vehicleNo: (v.vehicleNo || '').toUpperCase(),
                variety: v.variety,
                grossWeight: Number(v.grossWeight || 0),
                teirWeight: Number(v.teirWeight || 0),
                weight: calculated.finalWeight,
                kartaPercentage: v.kartaPercentage,
                kartaWeight: calculated.kartaWeight,
                kartaAmount: calculated.kartaAmount,
                netWeight: calculated.netWeight,
                rate: v.rate,
                labouryRate: v.labouryRate,
                labouryAmount: calculated.labouryAmount,
                brokerage: v.brokerage || 0,
                brokerageRate: v.brokerageRate || 0,
                brokerageAmount: calculated.brokerageAmount,
                brokerageAddSubtract: v.brokerageAddSubtract ?? true,
                kanta: v.kanta,
                amount: calculated.amount,
                netAmount: calculated.netAmount,
                originalNetAmount: calculated.netAmount,
                barcode: '',
                receiptType: 'Cash',
                paymentType: v.paymentType,
                customerId: `${toTitleCase(v.name).toLowerCase()}|${toTitleCase(v.so).toLowerCase()}`,
            };
            setReceiptsToPrint([temp]);
            return;
        }
        setReceiptsToPrint([currentSupplier]);
    }, [currentSupplier, form, calculateValues]);

    const handleNewEntry = useCallback(() => {
        form.reset(getInitialFormState(lastVariety, lastPaymentType, suppliersForSerial?.[0]));
        setIsEditing(false);
        toast({ title: "Form cleared" });
    }, [form, lastVariety, lastPaymentType, suppliersForSerial, toast]);

    // Calculate unique profiles for easy lookup
    const uniqueProfiles = useMemo(() => {
        if (!allSuppliers) return [];
        const profiles = new Map<string, {name: string, so: string, address: string, contact: string, id: string}>();
        
        // Sort by date to get the most recent details for each profile
        const sorted = [...allSuppliers].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        sorted.forEach(s => {
            const normalizedName = (s.name || '').trim().toLowerCase();
            const normalizedSo = ((s as any).fatherName || s.so || '').trim().toLowerCase();
            const normalizedAddress = (s.address || '').trim().toLowerCase();
            
            const key = `${normalizedName}|${normalizedSo}|${normalizedAddress}`;
            if (!profiles.has(key) && normalizedName) {
                profiles.set(key, {
                    name: s.name,
                    so: (s as any).fatherName || s.so || '',
                    address: s.address,
                    contact: s.contact,
                    id: s.id
                });
            }
        });
        return Array.from(profiles.values());
    }, [allSuppliers]);

    const uniqueAddresses = useMemo(() => {
        if (!allSuppliers) return [];
        const seen = new Set<string>();
        return allSuppliers
            .map(s => (s.address || '').trim())
            .filter(a => {
                if (!a || seen.has(a.toLowerCase())) return false;
                seen.add(a.toLowerCase());
                return true;
            })
            .slice(0, 100);
    }, [allSuppliers]);

    const uniqueVehicleNos = useMemo(() => {
        if (!allSuppliers) return [];
        const seen = new Set<string>();
        return allSuppliers
            .map(s => (s.vehicleNo || '').trim().toUpperCase())
            .filter(v => {
                if (!v || seen.has(v.toLowerCase())) return false;
                seen.add(v.toLowerCase());
                return true;
            })
            .slice(0, 100);
    }, [allSuppliers]);

    const uniqueNames = useMemo(() => {
        if (!allSuppliers) return [];
        const seen = new Set<string>();
        return allSuppliers
            .map(s => (s.name || '').trim())
            .filter(n => {
                if (!n || seen.has(n.toLowerCase())) return false;
                seen.add(n.toLowerCase());
                return true;
            })
            .slice(0, 100);
    }, [allSuppliers]);

    const uniqueSo = useMemo(() => {
        if (!allSuppliers) return [];
        const seen = new Set<string>();
        return allSuppliers
            .map(s => ((s as any).fatherName || s.so || '').trim())
            .filter(so => {
                if (!so || seen.has(so.toLowerCase())) return false;
                seen.add(so.toLowerCase());
                return true;
            })
            .slice(0, 100);
    }, [allSuppliers]);

    const uniqueContacts = useMemo(() => {
        if (!allSuppliers) return [];
        const seen = new Set<string>();
        return allSuppliers
            .map(s => (s.contact || '').trim())
            .filter(c => {
                if (!c || seen.has(c)) return false;
                seen.add(c);
                return true;
            })
            .slice(0, 100);
    }, [allSuppliers]);

    const handleUseProfile = useCallback((profile: {name: string, so: string, address: string, contact: string}) => {
        form.setValue('name', profile.name);
        form.setValue('so', profile.so);
        form.setValue('address', profile.address);
        form.setValue('contact', profile.contact);
        
        // Switch to "new entry" mode but with these details
        setIsEditing(false);
        setCurrentSupplier(prev => ({
            ...prev,
            name: profile.name,
            so: profile.so,
            address: profile.address,
            contact: profile.contact,
            id: '' // Important: clear ID for new entry
        }));
        
        toast({ 
            title: "Profile Loaded", 
            description: `Details for ${profile.name} filled. This is a NEW entry.`,
        });
    }, [form, toast]);

    const handleAddOption = useCallback(async (collectionName: string, optionData: { name: string } | string) => {
        try {
            const name = typeof optionData === 'string' ? optionData : optionData.name;
            if (!name || !name.trim()) {
                toast({ title: "Error", description: "Option name cannot be empty", variant: "destructive" });
                return;
            }
            await addOption(collectionName, { name: toTitleCase(name.trim()) });
            toast({ title: "Option added successfully!" });
        } catch (error: any) {
            toast({ title: "Error adding option", description: error?.message || "Please try again", variant: "destructive" });
        }
    }, [toast]);
    
    const handleUpdateOption = useCallback(async (collectionName: string, id: string, optionData: { name: string }) => {
        try {
            if (!optionData || !optionData.name || !optionData.name.trim()) {
                toast({ title: "Error", description: "Option name cannot be empty", variant: "destructive" });
                return;
            }
            const name = toTitleCase(optionData.name.trim());
            await updateOption(collectionName, id, { name });
            toast({ title: "Option updated successfully!", description: `Updated to "${name}".`, variant: "success" });
        } catch (error: any) {
            toast({ title: "Error updating option", description: error?.message || "Please try again", variant: "destructive" });
        }
    }, [toast]);
    
    const handleDeleteOption = useCallback(async (collectionName: string, id: string, name: string) => {
        try {
            await deleteOption(collectionName, id, name);
            toast({ title: "Option deleted successfully!" });
        } catch (error) {
            toast({ title: "Error deleting option", variant: "destructive" });
        }
    }, [toast]);

    const handleEditSupplier = useCallback((supplier: Customer) => {
        const formattedSrNo = formatSrNo(parseInt(supplier.srNo.substring(1)), 'S');
        
        form.reset({
            srNo: supplier.srNo,
            date: supplier.date ? new Date(supplier.date) : new Date(),
            term: Number(supplier.term) || 0,
            name: supplier.name || '',
            so: supplier.so || '',
            address: supplier.address || '',
            contact: supplier.contact || '',
            vehicleNo: supplier.vehicleNo || '',
            variety: supplier.variety || '',
            grossWeight: Number(supplier.grossWeight) || 0,
            teirWeight: Number(supplier.teirWeight) || 0,
            rate: Number(supplier.rate) || 0,
            kartaPercentage: Number(supplier.kartaPercentage) || 0,
            labouryRate: Number(supplier.labouryRate) || 0,
            brokerage: Number(supplier.brokerage) || 0,
            brokerageRate: Number(supplier.brokerageRate) || 0,
            brokerageAddSubtract: supplier.brokerageAddSubtract ?? true,
            kanta: Number(supplier.kanta) || 0,
            paymentType: supplier.paymentType || 'Full',
            forceUnique: supplier.forceUnique || false,
        });
        
        setIsEditing(true);
        setCurrentSupplier(supplier);
        
        setTimeout(() => {
            calculateSummary();
        }, 100);
        
        toast({ 
            title: "Edit Mode Activated", 
            description: `${supplier.name} (SR# ${supplier.srNo}) loaded. Form is ready for editing.`,
            variant: "success"
        });
    }, [form, calculateSummary, toast]);

    return {
        form,
        currentSupplier,
        setCurrentSupplier,
        isEditing,
        isSubmitting,
        setIsEditing,
        varietyOptions,
        paymentTypeOptions,
        lastVariety,
        lastPaymentType,
        highlightEntryId,
        setHighlightEntryId,
        receiptsToPrint,
        setReceiptsToPrint,
        consolidatedReceiptData,
        setConsolidatedReceiptData,
        allConsolidatedGroups,
        setAllConsolidatedGroups,
        handleSetLastVariety,
        handleSetLastPaymentType,
        handleSrNoBlur,
        handleContactBlur,
        onSubmit,
        handleDeleteCurrent,
        handlePrintCurrent,
        handleNewEntry,
        handleAddOption,
        handleUpdateOption,
        handleDeleteOption,
        calculateSummary,
        handleEditSupplier,
        uniqueProfiles,
        handleUseProfile,
        uniqueNames,
        uniqueSo,
        uniqueAddresses,
        uniqueVehicleNos,
        uniqueContacts
    };
}

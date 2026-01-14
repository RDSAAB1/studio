
"use client";

import { useState, useMemo, useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase, formatCurrency, calculateCustomerEntry } from "@/lib/utils";
import type { Customer, OptionItem } from "@/lib/definitions";
import { statesAndCodes, findStateByName, findStateByCode } from "@/lib/data";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { Separator } from "../ui/separator";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { User, Phone, Home, Truck, Wheat, Banknote, Landmark, Hash, Percent, Weight, Boxes, Settings, PlusCircle } from "lucide-react";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";

const SectionCard = ({ icon, children, className }: { icon?: React.ReactNode, children: React.ReactNode, className?: string }) => (
    <Card className={cn("bg-card/60 backdrop-blur-sm border-white/10", className)}>
        <CardContent className="pt-4">
            {children}
        </CardContent>
    </Card>
);

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

export const CustomerForm = ({ form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, setLastVariety, setLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, allCustomers }: any) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);
    const [cdInputMode, setCdInputMode] = useState<'percentage' | 'amount'>(() => {
        // Check if there's a saved preference in localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('cd-input-mode');
            return (saved === 'amount' ? 'amount' : 'percentage') as 'percentage' | 'amount';
        }
        return 'percentage';
    });

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;
    
    // Create name options from all customers
    const nameOptions = useMemo(() => {
        // Get unique customers by customerId (name + contact combination)
        const uniqueCustomers = Array.from(new Map(allCustomers.map((s: Customer) => [s.customerId || `${s.name}|${s.contact}`, s])).values());
        return uniqueCustomers.map((customer: Customer) => ({
            value: customer.name,
            label: `${toTitleCase(customer.name)}${customer.address ? ` - ${toTitleCase(customer.address)}` : ''}`,
            displayValue: customer.name, // Only show name in input field, not address
            data: customer // Store full customer data for auto-fill
        }));
    }, [allCustomers]);

    const handleNameChange = (value: string | null) => {
        if (value) {
            form.setValue('name', toTitleCase(value));
        } else {
            form.setValue('name', '');
        }
    };

    const handleNameSelect = (value: string | null) => {
        if (value) {
            // Find the customer data from options
            const selectedOption = nameOptions.find(opt => opt.value === value);
            if (selectedOption && selectedOption.data) {
                const customer = selectedOption.data as Customer;
                // Auto-fill all fields - ensure correct mapping
                // Set name
                form.setValue('name', toTitleCase(customer.name || ''));
                // Set company name
                form.setValue('companyName', toTitleCase(customer.companyName || ''));
                // Set address - explicitly from address field
                const addressValue = customer.address ? toTitleCase(String(customer.address)) : '';
                form.setValue('address', addressValue);
                // Set contact
                form.setValue('contact', customer.contact || '');
                // Set GSTIN - explicitly from gstin field only, never from address
                const gstinValue = customer.gstin ? String(customer.gstin).trim() : '';
                form.setValue('gstin', gstinValue);
                // Set state fields
                form.setValue('stateName', customer.stateName || '');
                form.setValue('stateCode', customer.stateCode || '');
            } else {
                // Just set the name if it's a new entry
                form.setValue('name', toTitleCase(value));
            }
        }
    };

    const handleAddNewName = (newName: string) => {
        const titleCaseName = toTitleCase(newName);
        form.setValue('name', titleCaseName);
        // Clear other fields when adding new customer
        form.setValue('companyName', '');
        form.setValue('address', '');
        form.setValue('contact', '');
        form.setValue('gstin', '');
        form.setValue('stateName', '');
        form.setValue('stateCode', '');
    };

    const handleCapitalizeOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, selectionStart, selectionEnd } = e.target;
        const capitalizedValue = toTitleCase(value);
        form.setValue(name as any, capitalizedValue, { shouldValidate: true });
        
        // Use requestAnimationFrame to restore cursor position after the re-render
        requestAnimationFrame(() => {
             e.target.setSelectionRange(selectionStart, selectionEnd);
        });
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '0' || e.target.value === '0.00') {
            e.target.select();
        }
    };

    const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d*$/.test(value)) {
            form.setValue('contact', value);
        }
    }
    
    const handleStateNameChange = (value: string | null) => {
        form.setValue('stateName', value || '');
        const state = findStateByName(value || '');
        if (state) {
            form.setValue('stateCode', state.code);
        }
    };

    const handleStateCodeChange = (value: string | null) => {
        form.setValue('stateCode', value || '');
        const state = findStateByCode(value || '');
        if (state) {
            form.setValue('stateName', state.name);
        }
    };

    const stateNameOptions = statesAndCodes.map(s => ({ value: s.name, label: s.name }));
    const stateCodeOptions = statesAndCodes.map(s => ({ value: s.code, label: s.code }));

    // Use useWatch to efficiently watch multiple fields at once (single subscription)
    const watchedValues = useWatch({
        control: form.control,
        name: ['grossWeight', 'teirWeight', 'bags', 'bagWeightKg', 'rate', 'kartaPercentage', 'netWeight', 'brokerage', 'cd', 'cdAmount', 'bagRate', 'transportationRate', 'taxRate', 'isGstIncluded', 'variety', 'baseReport', 'collectedReport', 'riceBranGst']
    });

    const [
        grossWeight,
        teirWeight,
        bags,
        bagWeightKg,
        rate,
        kartaPercentage,
        netWeight,
        brokerage,
        cd,
        cdAmount,
        bagRate,
        transportationRate,
        taxRate,
        isGstIncluded,
        variety,
        baseReport,
        collectedReport,
        riceBranGst
    ] = watchedValues;
    
    // Check if RICE BRAN is selected
    const isRiceBran = (variety || '').toUpperCase().trim() === 'RICE BRAN';

    // Calculate values for display
    const calculated = useMemo(() => {
        const formValues = form.getValues();
        return calculateCustomerEntry(formValues, []);
    }, [grossWeight, teirWeight, bags, bagWeightKg, rate, kartaPercentage, netWeight, brokerage, cd, cdAmount, bagRate, transportationRate, variety, baseReport, collectedReport, riceBranGst, form]);

    // Handle CD input mode change and auto-calculate
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cd-input-mode', cdInputMode);
        }
    }, [cdInputMode]);

    // Auto-calculate CD% when CD Amount is entered
    useEffect(() => {
        if (cdInputMode === 'amount' && cdAmount && calculated.amount && calculated.amount > 0) {
            const calculatedCdRate = (cdAmount / calculated.amount) * 100;
            const currentCd = form.getValues('cd') || 0;
            // Only update if the calculated value is significantly different (avoid infinite loops)
            if (Math.abs(currentCd - calculatedCdRate) > 0.01) {
                form.setValue('cd', calculatedCdRate, { shouldValidate: false, shouldDirty: false });
            }
        }
    }, [cdAmount, cdInputMode, calculated.amount, form]);

    // Auto-calculate CD Amount when CD% is entered
    useEffect(() => {
        if (cdInputMode === 'percentage' && cd && calculated.amount && calculated.amount > 0) {
            const calculatedCdAmount = (calculated.amount * cd) / 100;
            const currentCdAmount = form.getValues('cdAmount') || 0;
            // Only update if the calculated value is significantly different (avoid infinite loops)
            if (Math.abs(currentCdAmount - calculatedCdAmount) > 0.01) {
                form.setValue('cdAmount', calculatedCdAmount, { shouldValidate: false, shouldDirty: false });
            }
        }
    }, [cd, cdInputMode, calculated.amount, form]);

    // Set default values when RICE BRAN is selected
    useEffect(() => {
        if (isRiceBran) {
            // Use setTimeout to ensure form values are updated after reset
            const timer = setTimeout(() => {
                const currentBaseReport = form.getValues('baseReport');
                const currentRiceBranGst = form.getValues('riceBranGst');
                const currentBagWeightKg = form.getValues('bagWeightKg');
                
                // Set defaults if fields are empty/zero/undefined/null
                if (!currentBaseReport || currentBaseReport === 0) {
                    form.setValue('baseReport', 15, { shouldValidate: false, shouldDirty: false });
                }
                if (!currentRiceBranGst || currentRiceBranGst === 0) {
                    form.setValue('riceBranGst', 5, { shouldValidate: false, shouldDirty: false });
                }
                if (!currentBagWeightKg || currentBagWeightKg === 0) {
                    form.setValue('bagWeightKg', 0.2, { shouldValidate: false, shouldDirty: false });
                }
            }, 50);
            
            return () => clearTimeout(timer);
        }
    }, [isRiceBran, form]);

    // Calculate tax amounts
    const taxCalculations = useMemo(() => {
        const calcNetWeight = calculated.netWeight || 0;
        const calcRate = rate || 0;
        const calcTaxRate = (taxRate as number) || 5;
        const calcIsGstIncluded = (isGstIncluded as boolean) || false;
        
        const tableTotalAmount = calcNetWeight * calcRate;
        
        let taxableAmount: number;
        let totalTaxAmount: number;
        let totalInvoiceValue: number;

        if (calcIsGstIncluded) {
            taxableAmount = tableTotalAmount / (1 + (calcTaxRate / 100));
            totalTaxAmount = tableTotalAmount - taxableAmount;
            totalInvoiceValue = tableTotalAmount;
        } else {
            taxableAmount = tableTotalAmount;
            totalTaxAmount = taxableAmount * (calcTaxRate / 100);
            totalInvoiceValue = taxableAmount + totalTaxAmount;
        }

        const cgstAmount = totalTaxAmount / 2;
        const sgstAmount = totalTaxAmount / 2;

        return {
            tableTotalAmount,
            taxableAmount,
            totalTaxAmount,
            cgstAmount,
            sgstAmount,
            totalInvoiceValue,
            taxRate: calcTaxRate
        };
    }, [calculated.netWeight, rate, taxRate, isGstIncluded]);

    // Number to words function
    const numberToWords = (num: number): string => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const number = parseFloat(num.toString().split(".")[0]);
        if (number === 0) return "Zero";
        let str = '';
        if (number < 20) {
            str = a[number];
        } else if (number < 100) {
            str = b[Math.floor(number/10)] + a[number%10];
        } else if (number < 1000) {
            str = a[Math.floor(number/100)] + 'hundred ' + numberToWords(number % 100);
        } else if (number < 100000) {
            str = numberToWords(Math.floor(number/1000)) + 'thousand ' + numberToWords(number % 1000);
        } else if (number < 10000000) {
            str = numberToWords(Math.floor(number/100000)) + 'lakh ' + numberToWords(number % 100000);
        } else {
            str = 'Number too large';
        }
        return toTitleCase(str.trim()) + " Only";
    };

    return (
        <>
            <div className="space-y-3">
                {/* Weight & Rate Section - Top */}
                <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                    <CardContent className="pt-4 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="customer-gross-weight" className="text-xs">Gross Wt.</Label>
                                <InputWithIcon icon={<Weight className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="grossWeight" control={form.control} render={({ field }) => (<Input id="customer-gross-weight" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label>
                                <InputWithIcon icon={<Weight className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="teirWeight" control={form.control} render={({ field }) => (<Input id="teirWeight" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9"/>)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="bags" className="text-xs">Bags</Label>
                                <InputWithIcon icon={<Boxes className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="bags" type="number" {...form.register('bags')} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="customer-rate" className="text-xs">Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="rate" control={form.control} render={({ field }) => (<Input id="customer-rate" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="kartaPercentage" className="text-xs">KRTA %</Label>
                                <InputWithIcon icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<Input id="kartaPercentage" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />)} />
                                </InputWithIcon>
                            </div>
                        </div>
                        {/* RICE BRAN specific fields */}
                        {isRiceBran && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 pt-2 border-t border-border/50">
                                <div className="space-y-0.5">
                                    <Label htmlFor="baseReport" className="text-xs">Base Report</Label>
                                    <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="baseReport" control={form.control} render={({ field }) => (
                                            <Input 
                                                id="baseReport" 
                                                type="number" 
                                                {...field} 
                                                value={field.value ?? 0}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                                onFocus={handleFocus} 
                                                className="h-7 text-xs pl-9" 
                                                placeholder="0.00"
                                            />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="collectedReport" className="text-xs">Collected Report</Label>
                                    <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="collectedReport" control={form.control} render={({ field }) => (
                                            <Input 
                                                id="collectedReport" 
                                                type="number" 
                                                {...field} 
                                                value={field.value ?? 0}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                                onFocus={handleFocus} 
                                                className="h-7 text-xs pl-9" 
                                                placeholder="0.00"
                                            />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="riceBranGst" className="text-xs">GST %</Label>
                                    <InputWithIcon icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="riceBranGst" control={form.control} render={({ field }) => (
                                            <Input 
                                                id="riceBranGst" 
                                                type="number" 
                                                {...field} 
                                                value={field.value ?? 0}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                                onFocus={handleFocus} 
                                                className="h-7 text-xs pl-9" 
                                                placeholder="0.00"
                                            />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                {calculated.calculatedRate !== undefined && (
                                    <div className="space-y-0.5">
                                        <Label htmlFor="calculatedRate" className="text-xs text-muted-foreground">Calculated Rate</Label>
                                        <div id="calculatedRate" className="h-7 flex items-center pl-9 text-xs font-semibold text-primary">
                                            ₹{Number(calculated.calculatedRate).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Basic Information Card */}
                <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                    <CardContent className="pt-4 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                                <InputWithIcon icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label htmlFor={`customerDate-${field.name}`} className="text-xs">Date</Label>
                                    <SmartDatePicker
                                        id={`customerDate-${field.name}`}
                                        value={field.value}
                                        onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                                        placeholder="Pick a date"
                                        inputClassName="h-7 text-xs"
                                        buttonClassName="h-7 w-7"
                                        returnDate={true}
                                    />
                                </div>
                            )} />
                            <div className="space-y-0.5 relative z-[9999]">
                                <Label htmlFor="name" className="text-xs">Name</Label>
                                <div className="relative z-[9999]">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="relative z-[9999]">
                                    <CustomDropdown
                                        id="name"
                                        options={nameOptions}
                                        value={form.watch('name')}
                                        onChange={(value) => {
                                            handleNameChange(value);
                                            if (value) {
                                                handleNameSelect(value);
                                            }
                                        }}
                                        onAdd={handleAddNewName}
                                        placeholder="Search or enter customer name..."
                                        inputClassName={cn("h-7 text-xs pl-9", form.formState.errors.name && "border-destructive")}
                                        showClearButton={true}
                                    />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="contact" className="text-xs">Contact No.</Label>
                                <InputWithIcon icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}>
                                   <Controller name="contact" control={form.control} render={({ field }) => ( <Input id="contact" {...field} type="tel" maxLength={10} onChange={handleNumericInput} onBlur={e => handleContactBlur(e.target.value)} className={cn("h-7 text-xs pl-9", form.formState.errors.contact && "border-destructive")} /> )}/>
                                </InputWithIcon>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Product Details Card */}
                <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                    <CardContent className="pt-4 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                             <Controller name="variety" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label className="text-xs flex items-center gap-1.5">Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-4 w-4 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} value={field.value} onChange={(val) => { form.setValue("variety", val); setLastVariety(val); }} placeholder="Select variety..." maxRows={5} showScrollbar={true}/>
                                </div>
                            )} />
                            <div className="space-y-0.5">
                                <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                                <InputWithIcon icon={<Truck className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="vehicleNo" control={form.control} render={({ field }) => ( <Input id="vehicleNo" {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" /> )}/>
                                </InputWithIcon>
                            </div>
                             <Controller name="paymentType" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label className="text-xs flex items-center gap-1.5">Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-4 w-4 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} value={field.value} onChange={(val) => {form.setValue("paymentType", val); setLastPaymentType(val);}} placeholder="Select type..." maxRows={5} showScrollbar={true}/>
                                </div>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                {/* Weight & Financial Details Card */}
                <Card className="bg-card/60 backdrop-blur-sm border-white/10 lg:col-span-2">
                    <CardContent className="pt-4 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="bagWeightKg" className="text-xs">Bag Wt. (kg)</Label>
                                <InputWithIcon icon={<Weight className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="bagWeightKg" type="number" {...form.register('bagWeightKg')} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="bagRate" className="text-xs">Bags Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="bagRate" type="number" {...form.register('bagRate')} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="cd" className="text-xs">CD</Label>
                                    <SegmentedSwitch
                                        id="cd-input-mode"
                                        checked={cdInputMode === 'amount'}
                                        onCheckedChange={(checked) => {
                                            setCdInputMode(checked ? 'amount' : 'percentage');
                                        }}
                                        leftLabel="%"
                                        rightLabel="Amount"
                                        className="w-32 h-6"
                                    />
                                </div>
                                {cdInputMode === 'percentage' ? (
                                    <InputWithIcon icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="cd" control={form.control} render={({ field }) => (
                                            <Input 
                                                id="cd" 
                                                type="number" 
                                                {...field} 
                                                value={field.value ?? 0}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                                onFocus={handleFocus} 
                                                className="h-7 text-xs pl-9" 
                                                placeholder="0.00"
                                            />
                                        )} />
                                    </InputWithIcon>
                                ) : (
                                    <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="cdAmount" control={form.control} render={({ field }) => (
                                            <Input 
                                                id="cdAmount" 
                                                type="number" 
                                                {...field} 
                                                value={field.value ?? 0}
                                                onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                                onFocus={handleFocus} 
                                                className="h-7 text-xs pl-9" 
                                                placeholder="0.00"
                                            />
                                        )} />
                                    </InputWithIcon>
                                )}
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="brokerage" className="text-xs">Brokerage Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="brokerage" control={form.control} render={({ field }) => (
                                        <Input id="brokerage" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                    )} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="transportationRate" className="text-xs">Transportation Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="transportationRate" control={form.control} render={({ field }) => (
                                        <Input 
                                            id="transportationRate" 
                                            type="number" 
                                            {...field} 
                                            value={field.value ?? 0} 
                                            onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                                            onFocus={handleFocus} 
                                            className="h-7 text-xs pl-9" 
                                        />
                                    )} />
                                </InputWithIcon>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                            </div>
                        </div>
        
        <OptionsManagerDialog
            isOpen={isManageOptionsOpen}
            setIsOpen={setIsManageOptionsOpen}
            type={managementType}
            options={optionsToManage}
            onAdd={handleAddOption}
            onUpdate={handleUpdateOption}
            onDelete={(collectionName: string, id: string, name: string) => handleDeleteOption(collectionName, id, name)}
        />
        </>
    );
};

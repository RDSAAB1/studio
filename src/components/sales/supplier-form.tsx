
"use client";

import React, { useState, memo, useCallback, useRef, useEffect } from "react";
import { Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import type { Customer, OptionItem } from "@/lib/definitions";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Hourglass, Settings, Hash, Percent, Weight } from "lucide-react";
import { Separator } from "../ui/separator";
import { CustomDropdown } from "../ui/custom-dropdown";

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

const SupplierFormComponent = ({ form, handleSrNoBlur, onContactChange, handleNameOrSoBlur, varietyOptions, paymentTypeOptions, setLastVariety, setLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, allSuppliers, handleCalculationFieldChange, onAutoFill }: any) => {
    
    // Debug logging for options


    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);
    // REMOVED: Name suggestions state to prevent lag
    // const [nameSuggestions, setNameSuggestions] = useState<Customer[]>([]);
    // const [isNamePopoverOpen, setIsNamePopoverOpen] = useState(false);

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;
    
    // Immediate display state - completely separate from form
    const [immediateValues, setImmediateValues] = useState<Record<string, string>>({});
    
    // Auto-capitalization function
    const capitalizeText = useCallback((text: string) => {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }, []);

    // Ultra-fast onChange - immediate display, no calculations
    const createImmediateOnChange = useCallback((fieldName: string, shouldCapitalize: boolean = false) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            let value = e.target.value;
            
            // Apply auto-capitalization for text fields
            if (shouldCapitalize) {
                value = capitalizeText(value);
            }
            
            // Update immediate display state instantly
            setImmediateValues(prev => ({ ...prev, [fieldName]: value }));
            
            // Update form value in background (no UI impact)
            setTimeout(() => {
                form.setValue(fieldName, value);
            }, 0);
        };
    }, [form, capitalizeText]);
    
    // Background calculation on blur
    const createBackgroundOnBlur = useCallback((fieldName: string) => {
        return (e: React.FocusEvent<HTMLInputElement>) => {
            const value = e.target.value;
            
            // Trigger calculations in background
            const calculationFields = ['rate', 'grossWeight', 'teirWeight', 'kartaPercentage', 'labouryRate', 'kanta'];
            if (calculationFields.includes(fieldName)) {
                // Use setTimeout to ensure it runs after UI updates
                setTimeout(() => {
                    handleCalculationFieldChange(fieldName, value);
                }, 0);
            }
        };
    }, [handleCalculationFieldChange]);
    
    // Get display value - immediate state takes priority
    const getDisplayValue = useCallback((fieldName: string, formValue: any) => {
        return immediateValues[fieldName] !== undefined ? immediateValues[fieldName] : (formValue || '');
    }, [immediateValues]);
    
    // Clear immediate values when form is reset (for new entries)
    const clearImmediateValues = useCallback(() => {
        setImmediateValues({});
    }, []);
    
    // Set immediate values for auto-fill (when serial number is found)
    const setImmediateValuesForAutoFill = useCallback((values: Record<string, any>) => {
        const newImmediateValues: Record<string, string> = {};
        const textFields = ['name', 'so', 'address', 'vehicleNo']; // Fields that need capitalization
        const numericFields = ['term', 'rate', 'grossWeight', 'teirWeight', 'kartaPercentage', 'labouryRate', 'kanta']; // Numeric fields that also get capitalization
        
        Object.entries(values).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                let stringValue = String(value);
                
                // Apply capitalization for text fields and numeric fields
                if (textFields.includes(key) || numericFields.includes(key)) {
                    stringValue = capitalizeText(stringValue);
                }
                
                newImmediateValues[key] = stringValue;
            }
        });
        setImmediateValues(newImmediateValues);
    }, [capitalizeText]);
    
    // Handle auto-fill from parent component
    useEffect(() => {
        if (onAutoFill && typeof onAutoFill === 'object') {
            setImmediateValuesForAutoFill(onAutoFill);
        }
    }, [onAutoFill, setImmediateValuesForAutoFill]);
    
    // Functions are exposed through props and useEffect
    
    // REMOVED: All name suggestion handlers to prevent lag
    // const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... };
    // const handleNameSelect = (supplier: Customer) => { ... };
    // const handleInputClick = () => { ... };
    
    // REMOVED: handleCapitalizeOnChange to eliminate delay
    // const handleCapitalizeOnChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '0' || e.target.value === '0.00') {
            e.target.select();
        }
    };

    // REMOVED: handleNumericInput to eliminate delay
    // const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

    return (
        <>
        <div className="space-y-3">
            <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                <CardContent className="p-3">
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2">
                        <div className="space-y-1">
                            <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                            <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-8 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                                <InputWithIcon icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="term" 
                                    type="number" 
                                    value={getDisplayValue('term', form.watch('term'))}
                                    onChange={createImmediateOnChange('term', true)}
                                    onFocus={handleFocus} 
                                    onBlur={() => handleNameOrSoBlur()} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="supplier-form-rate" className="text-xs">Rate</Label>
                            <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="supplier-form-rate" 
                                    type="number" 
                                    value={getDisplayValue('rate', form.watch('rate'))}
                                    onChange={createImmediateOnChange('rate', true)}
                                    onBlur={createBackgroundOnBlur('rate')} 
                                    onFocus={handleFocus} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="supplier-gross-weight" className="text-xs">Gross Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="supplier-gross-weight" 
                                    type="number" 
                                    value={getDisplayValue('grossWeight', form.watch('grossWeight'))}
                                    onChange={createImmediateOnChange('grossWeight', true)}
                                    onBlur={createBackgroundOnBlur('grossWeight')} 
                                    onFocus={handleFocus} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="teirWeight" 
                                    type="number" 
                                    value={getDisplayValue('teirWeight', form.watch('teirWeight'))}
                                    onChange={createImmediateOnChange('teirWeight', true)}
                                    onBlur={createBackgroundOnBlur('teirWeight')} 
                                    onFocus={handleFocus} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="vehicleNo" 
                                    value={getDisplayValue('vehicleNo', form.watch('vehicleNo'))}
                                    onChange={createImmediateOnChange('vehicleNo', true)}
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                    </div>
                </CardContent>
            </Card>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5">
                    <Card className="h-full">
                        <CardContent className="p-3 space-y-2 flex flex-col justify-between h-full">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                                <div className="space-y-1">
                                    <Label htmlFor="contact" className="text-xs">Contact</Label>
                                    <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                       <Controller name="contact" control={form.control} render={({ field }) => ( <Input {...field} type="tel" maxLength={10} onBlur={(e) => handleNameOrSoBlur(e.target.value)} className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} /> )}/>
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="name" className="text-xs">Name</Label>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Input 
                                            id="name" 
                                            value={getDisplayValue('name', form.watch('name'))}
                                            onChange={createImmediateOnChange('name', true)}
                                            autoComplete="off" 
                                            className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")} 
                                        />
                                    </InputWithIcon>
                                </div>
                           </div>
                            <div className="space-y-1">
                                <Label htmlFor="so" className="text-xs">S/O</Label>
                                <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="so" 
                                        value={getDisplayValue('so', form.watch('so'))}
                                        onChange={createImmediateOnChange('so', true)}
                                        onBlur={handleNameOrSoBlur} 
                                        className="h-8 text-sm pl-10" 
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="address" className="text-xs">Address</Label>
                                <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="address" 
                                        value={getDisplayValue('address', form.watch('address'))}
                                        onChange={createImmediateOnChange('address', true)}
                                        className="h-8 text-sm pl-10" 
                                    />
                                </InputWithIcon>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    <Card className="h-full">
                         <CardContent className="p-3 space-y-2 flex flex-col justify-between h-full">
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-2">Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                <CustomDropdown 
                                    options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                    value={getDisplayValue('paymentType', form.watch('paymentType'))} 
                                    onChange={(val) => {

                                        setImmediateValues(prev => ({ ...prev, paymentType: val || '' }));
                                        setTimeout(() => {
                                            form.setValue("paymentType", val || '');
                                            setLastPaymentType(val || '');
                                        }, 0);
                                    }} 
                                    onAdd={(newItem) => {

                                        handleAddOption('paymentTypes', newItem);
                                    }}
                                    placeholder="Select type..."
                                    maxRows={5}
                                    showScrollbar={true}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-2">Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                <CustomDropdown 
                                    options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                    value={getDisplayValue('variety', form.watch('variety'))} 
                                    onChange={(val) => {

                                        setImmediateValues(prev => ({ ...prev, variety: val || '' }));
                                        setTimeout(() => {
                                            form.setValue("variety", val || '');
                                            setLastVariety(val || '');
                                        }, 0);
                                    }} 
                                    onAdd={(newItem) => {

                                        handleAddOption('varieties', newItem);
                                    }}
                                    placeholder="Select variety..."
                                    maxRows={5}
                                    showScrollbar={true}
                                />
                            </div>
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs">Date</Label>
                                    <SmartDatePicker
                                        value={field.value}
                                        onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                                        placeholder="Pick a date"
                                        inputClassName="h-8 text-sm"
                                        buttonClassName="h-8 w-8"
                                        returnDate={true}
                                    />
                                </div>
                            )} />
                         </CardContent>
                    </Card>
                </div>
                 <div className="lg:col-span-4">
                    <Card className="h-full">
                         <CardContent className="p-3 space-y-2 flex flex-col justify-between h-full">
                            <div className="space-y-1">
                                <Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="kartaPercentage" 
                                        type="number" 
                                        value={getDisplayValue('kartaPercentage', form.watch('kartaPercentage'))}
                                        onChange={createImmediateOnChange('kartaPercentage')}
                                        onBlur={createBackgroundOnBlur('kartaPercentage')} 
                                        onFocus={handleFocus} 
                                        className="h-8 text-sm pl-10" 
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="labouryRate" 
                                        type="number" 
                                        value={getDisplayValue('labouryRate', form.watch('labouryRate'))}
                                        onChange={createImmediateOnChange('labouryRate')}
                                        onBlur={createBackgroundOnBlur('labouryRate')} 
                                        onFocus={handleFocus} 
                                        className="h-8 text-sm pl-10" 
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="kanta" 
                                        type="number" 
                                        value={getDisplayValue('kanta', form.watch('kanta'))}
                                        onChange={createImmediateOnChange('kanta')}
                                        onBlur={createBackgroundOnBlur('kanta')} 
                                        onFocus={handleFocus} 
                                        className="h-8 text-sm pl-10" 
                                    />
                                </InputWithIcon>
                            </div>
                         </CardContent>
                    </Card>
                 </div>
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

// Memoized component for better performance
export const SupplierForm = memo(SupplierFormComponent);



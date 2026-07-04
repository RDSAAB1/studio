
"use client";

import React, { useState, memo, useCallback, useRef, useEffect } from "react";
import { Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import type { Customer, OptionItem } from "@/lib/definitions";

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
    
    // Auto-capitalization function
    const capitalizeText = useCallback((text: string) => {
        return text.replace(/\b\w/g, (char) => char.toUpperCase());
    }, []);

    // Capitalize text values on blur instead of active typing (onChange)
    const handleCapitalizeOnBlur = useCallback((fieldName: string, value: string) => {
        const capitalized = capitalizeText(value);
        form.setValue(fieldName, capitalized, { shouldValidate: true, shouldDirty: true });
        
        // Trigger calculations if this is a calculation field
        const calculationFields = ['rate', 'grossWeight', 'teirWeight', 'kartaPercentage', 'labouryRate', 'kanta'];
        if (calculationFields.includes(fieldName)) {
            handleCalculationFieldChange(fieldName, capitalized);
        }
    }, [form, capitalizeText, handleCalculationFieldChange]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '0' || e.target.value === '0.00') {
            e.target.select();
        }
    };

    return (
        <>
        <div className="space-y-3">
            <div className="rounded-md border border-border/50 bg-card p-3">
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
                                <Controller
                                    name="term"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Input 
                                            id="term" 
                                            type="number" 
                                            value={field.value !== undefined && field.value !== null ? field.value : ''}
                                            onChange={(e) => {
                                                field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                            }}
                                            onFocus={handleFocus} 
                                            onBlur={() => {
                                                field.onBlur();
                                                handleNameOrSoBlur();
                                            }} 
                                            className="h-8 text-sm pl-10" 
                                        />
                                    )}
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="supplier-form-rate" className="text-xs">Rate</Label>
                            <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Controller
                                    name="rate"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Input 
                                            id="supplier-form-rate" 
                                            type="number" 
                                            step="any"
                                            value={field.value !== undefined && field.value !== null ? field.value : ''}
                                            onChange={(e) => {
                                                field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                            }}
                                            onFocus={handleFocus}
                                            onBlur={() => {
                                                field.onBlur();
                                                handleCapitalizeOnBlur('rate', String(field.value || ''));
                                            }} 
                                            className="h-8 text-sm pl-10" 
                                        />
                                    )}
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="supplier-gross-weight" className="text-xs">Gross Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Controller
                                    name="grossWeight"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Input 
                                            id="supplier-gross-weight" 
                                            type="number" 
                                            step="any"
                                            value={field.value !== undefined && field.value !== null ? field.value : ''}
                                            onChange={(e) => {
                                                field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                            }}
                                            onFocus={handleFocus}
                                            onBlur={() => {
                                                field.onBlur();
                                                handleCapitalizeOnBlur('grossWeight', String(field.value || ''));
                                            }} 
                                            className="h-8 text-sm pl-10" 
                                        />
                                    )}
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Controller
                                    name="teirWeight"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Input 
                                            id="teirWeight" 
                                            type="number" 
                                            step="any"
                                            value={field.value !== undefined && field.value !== null ? field.value : ''}
                                            onChange={(e) => {
                                                field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                            }}
                                            onFocus={handleFocus}
                                            onBlur={() => {
                                                field.onBlur();
                                                handleCapitalizeOnBlur('teirWeight', String(field.value || ''));
                                            }} 
                                            className="h-8 text-sm pl-10" 
                                        />
                                    )}
                                />
                            </InputWithIcon>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                <Controller
                                    name="vehicleNo"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Input 
                                            id="vehicleNo" 
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={() => {
                                                field.onBlur();
                                                handleCapitalizeOnBlur('vehicleNo', String(field.value || ''));
                                            }}
                                            className="h-8 text-sm pl-10" 
                                        />
                                    )}
                                />
                            </InputWithIcon>
                        </div>
                    </div>
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5">
                    <div className="h-full rounded-md border border-border/50 bg-card p-3 space-y-2 flex flex-col justify-between">
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                                <div className="space-y-1">
                                    <Label htmlFor="contact" className="text-xs">Contact</Label>
                                    <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                       <Controller name="contact" control={form.control} render={({ field }) => ( <Input id="contact" {...field} type="tel" maxLength={10} onBlur={(e) => handleNameOrSoBlur(e.target.value)} className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} /> )}/>
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="name" className="text-xs">Name</Label>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller
                                            name="name"
                                            control={form.control}
                                            render={({ field }) => (
                                                <Input 
                                                    id="name" 
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    onBlur={() => {
                                                        field.onBlur();
                                                        handleCapitalizeOnBlur('name', String(field.value || ''));
                                                    }}
                                                    autoComplete="off" 
                                                    className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")} 
                                                />
                                            )}
                                        />
                                    </InputWithIcon>
                                </div>
                           </div>
                            <div className="space-y-1">
                                <Label htmlFor="so" className="text-xs">S/O</Label>
                                <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller
                                        name="so"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input 
                                                id="so" 
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                onBlur={() => {
                                                    field.onBlur();
                                                    handleCapitalizeOnBlur('so', String(field.value || ''));
                                                    handleNameOrSoBlur();
                                                }}
                                                className="h-8 text-sm pl-10" 
                                            />
                                        )}
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="address" className="text-xs">Address</Label>
                                <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller
                                        name="address"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input 
                                                id="address" 
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                onBlur={() => {
                                                    field.onBlur();
                                                    handleCapitalizeOnBlur('address', String(field.value || ''));
                                                }}
                                                className="h-8 text-sm pl-10" 
                                            />
                                        )}
                                    />
                                </InputWithIcon>
                            </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <div className="h-full rounded-md border border-border/50 bg-card p-3 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-2">Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                <Controller
                                    name="paymentType"
                                    control={form.control}
                                    render={({ field }) => (
                                        <CustomDropdown 
                                            options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                            value={field.value || ''} 
                                            onChange={(val) => {
                                                field.onChange(val || '');
                                                setLastPaymentType(val || '');
                                            }} 
                                            onAdd={(newItem) => {
                                                handleAddOption('paymentTypes', newItem);
                                            }}
                                            placeholder="Select type..."
                                            maxRows={5}
                                            showScrollbar={true}
                                        />
                                    )}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs flex items-center gap-2">Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                <Controller
                                    name="variety"
                                    control={form.control}
                                    render={({ field }) => (
                                        <CustomDropdown 
                                            options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                            value={field.value || ''} 
                                            onChange={(val) => {
                                                field.onChange(val || '');
                                                setLastVariety(val || '');
                                            }} 
                                            onAdd={(newItem) => {
                                                handleAddOption('varieties', newItem);
                                            }}
                                            placeholder="Select variety..."
                                            maxRows={5}
                                            showScrollbar={true}
                                        />
                                    )}
                                />
                            </div>
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label htmlFor={`supplierDate-${field.name}`} className="text-xs">Date</Label>
                                    <SmartDatePicker
                                        id={`supplierDate-${field.name}`}
                                        value={field.value}
                                        onChange={(val) => field.onChange(val instanceof Date ? val : (val ? new Date(val) : new Date()))}
                                        placeholder="Pick a date"
                                        inputClassName="h-8 text-sm"
                                        buttonClassName="h-8 w-8"
                                        returnDate={true}
                                    />
                                </div>
                            )} />
                    </div>
                </div>
                 <div className="lg:col-span-4">
                    <div className="h-full rounded-md border border-border/50 bg-card p-3 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1">
                                <Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller
                                        name="kartaPercentage"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input 
                                                id="kartaPercentage" 
                                                type="number" 
                                                step="any"
                                                value={field.value !== undefined && field.value !== null ? field.value : ''}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                                }}
                                                onBlur={() => {
                                                    field.onBlur();
                                                    handleCapitalizeOnBlur('kartaPercentage', String(field.value || ''));
                                                }} 
                                                onFocus={handleFocus} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        )}
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller
                                        name="labouryRate"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input 
                                                id="labouryRate" 
                                                type="number" 
                                                step="any"
                                                value={field.value !== undefined && field.value !== null ? field.value : ''}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                                }}
                                                onBlur={() => {
                                                    field.onBlur();
                                                    handleCapitalizeOnBlur('labouryRate', String(field.value || ''));
                                                }} 
                                                onFocus={handleFocus} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        )}
                                    />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller
                                        name="kanta"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Input 
                                                id="kanta" 
                                                type="number" 
                                                step="any"
                                                value={field.value !== undefined && field.value !== null ? field.value : ''}
                                                onChange={(e) => {
                                                    field.onChange(e.target.value === '' ? '' : Number(e.target.value));
                                                }}
                                                onBlur={() => {
                                                    field.onBlur();
                                                    handleCapitalizeOnBlur('kanta', String(field.value || ''));
                                                }} 
                                                onFocus={handleFocus} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        )}
                                    />
                                </InputWithIcon>
                            </div>
                    </div>
                 </div>
            </div>
        </div>

        <OptionsManagerDialog
            isOpen={isManageOptionsOpen}
            setIsOpen={setIsManageOptionsOpen}
            type={managementType}
            options={optionsToManage}
            onAdd={(collectionName, optionData) => handleAddOption(collectionName, optionData.name)}
            onUpdate={(collectionName, id, optionData) => handleUpdateOption(collectionName, id, optionData.name)}
            onDelete={(collectionName: string, id: string, name: string) => handleDeleteOption(collectionName, id, name)}
        />
        </>
    );
};

// Memoized component for better performance
export const SupplierForm = memo(SupplierFormComponent);


"use client";

import React, { useState, useEffect } from "react";
import { Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import type { OptionItem } from "@/lib/definitions";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { User, Phone, Home, Truck, Wheat, Banknote, Landmark, UserSquare, Wallet, Hourglass, Settings, Hash, Percent, Weight } from "lucide-react";
import { CustomDropdown } from "../ui/custom-dropdown";
import { OptionsManagerDialog } from "./options-manager-dialog";

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

// Auto-capitalization function
const capitalizeText = (text: string) => {
    return text.replace(/\b\w/g, (char) => char.toUpperCase());
};

// Custom input with auto-capitalization
const AutoCapitalizeInput = ({ value, onChange, onBlur, className, ...props }: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const capitalizedValue = capitalizeText(e.target.value);
        onChange(capitalizedValue);
    };

    return (
        <Input
            value={value}
            onChange={handleChange}
            onBlur={onBlur}
            className={className}
            {...props}
        />
    );
};

// Custom input with uppercase for vehicle number
const AutoUppercaseInput = ({ value, onChange, onBlur, className, ...props }: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uppercaseValue = e.target.value.toUpperCase();
        onChange(uppercaseValue);
    };

    return (
        <Input
            value={value}
            onChange={handleChange}
            onBlur={onBlur}
            className={className}
            {...props}
        />
    );
};

interface SimpleSupplierFormAllFieldsProps {
    form: any;
    handleSrNoBlur: (value: string) => void;
    handleContactBlur: (value: string) => void;
    varietyOptions: OptionItem[];
    paymentTypeOptions: OptionItem[];
    setLastVariety: (variety: string) => void;
    setLastPaymentType: (paymentType: string) => void;
    handleAddOption: (collectionName: string, name: string) => void;
    handleUpdateOption: (collectionName: string, id: string, name: string) => void;
    handleDeleteOption: (collectionName: string, id: string, name: string) => void;
    firstInputRef?: React.RefObject<HTMLInputElement>;
}

const SimpleSupplierFormAllFields = ({ 
    form, 
    handleSrNoBlur, 
    handleContactBlur,
    varietyOptions, 
    paymentTypeOptions, 
    setLastVariety, 
    setLastPaymentType, 
    handleAddOption, 
    handleUpdateOption, 
    handleDeleteOption,
    firstInputRef
}: SimpleSupplierFormAllFieldsProps) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;

    return (
        <>
        <div className="space-y-3">
            <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                <CardContent className="p-3">
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-3 gap-y-2">
                        <div className="space-y-1">
                            <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                            <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="srNo" 
                                    {...(() => {
                                        const registration = form.register('srNo', {
                                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => handleSrNoBlur(e.target.value)
                                        });
                                        return {
                                            ...registration,
                                            ref: (e: HTMLInputElement | null) => {
                                                registration.ref(e);
                                                if (firstInputRef && e) {
                                                    (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                                                }
                                            }
                                        };
                                    })()}
                                    className="font-code h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                            <InputWithIcon icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="term" 
                                    type="number" 
                                    {...form.register('term')} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="supplier-rate" className="text-xs">Rate</Label>
                            <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="supplier-rate" 
                                    type="number" 
                                    {...form.register('rate')} 
                                    className="h-8 text-sm pl-10" 
                                />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="simple-supplier-all-fields-gross-weight" className="text-xs">Gross Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Input 
                                    id="simple-supplier-all-fields-gross-weight" 
                                    type="number" 
                                    {...form.register('grossWeight')} 
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
                                    {...form.register('teirWeight')} 
                                    className="h-8 text-sm pl-10" 
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
                                        <AutoUppercaseInput
                                            id="vehicleNo"
                                            name="vehicleNo"
                                            {...field}
                                            className="h-8 text-sm pl-10"
                                        />
                                    )}
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
                                       <Input 
                                           id="contact"
                                           name="contact"
                                           {...form.register('contact')} 
                                           type="tel" 
                                           maxLength={10} 
                                           onBlur={(e) => handleContactBlur(e.target.value)}
                                           className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} 
                                       />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="name" className="text-xs">Name</Label>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller
                                            name="name"
                                            control={form.control}
                                            render={({ field }) => (
                                                <AutoCapitalizeInput
                                                    id="name"
                                                    name="name"
                                                    {...field}
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
                                            <AutoCapitalizeInput
                                                id="so"
                                                name="so"
                                                {...field}
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
                                            <AutoCapitalizeInput
                                                id="address"
                                                name="address"
                                                {...field}
                                                className="h-8 text-sm pl-10"
                                            />
                                        )}
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
                                <Label className="text-xs flex items-center gap-2">
                                    Payment Type
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => openManagementDialog('paymentType')} 
                                        className="h-5 w-5 shrink-0"
                                        tabIndex={-1}
                                    >
                                        <Settings className="h-3 w-3"/>
                                    </Button>
                                </Label>
                                <CustomDropdown 
                                    options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                    value={form.watch('paymentType')} 
                                    onChange={(val) => {
                                        form.setValue("paymentType", val || '');
                                        setLastPaymentType(val || '');
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
                                <Label className="text-xs flex items-center gap-2">
                                    Variety 
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => openManagementDialog('variety')} 
                                        className="h-5 w-5 shrink-0"
                                        tabIndex={-1}
                                    >
                                        <Settings className="h-3 w-3"/>
                                    </Button>
                                </Label>
                                <CustomDropdown 
                                    options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: String(v.name).toUpperCase()}))} 
                                    value={form.watch('variety')} 
                                    onChange={(val) => {
                                        form.setValue("variety", val || '');
                                        setLastVariety(val || '');
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
                                    <Label htmlFor={`simpleSupplierDate-${field.name}`} className="text-xs">Date</Label>
                                    <SmartDatePicker
                                        id={`simpleSupplierDate-${field.name}`}
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
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label>
                                        <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                            <Input 
                                                id="kartaPercentage" 
                                                type="number" 
                                                {...form.register('kartaPercentage')} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        </InputWithIcon>
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                        <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                            <Input 
                                                id="labouryRate" 
                                                type="number" 
                                                {...form.register('labouryRate')} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        </InputWithIcon>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="brokerageRate" className="text-xs whitespace-nowrap">Brokerage Rate</Label>
                                    <SegmentedSwitch
                                        id="brokerage-toggle"
                                        checked={form.watch('brokerageAddSubtract') ?? true}
                                        onCheckedChange={(checked) => form.setValue('brokerageAddSubtract', checked)}
                                        leftLabel="EXCLUDE"
                                        rightLabel="INCLUDE"
                                        className="w-36 h-6"
                                    />
                                </div>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="brokerageRate" 
                                        type="number" 
                                        step="0.01"
                                        {...form.register('brokerageRate')} 
                                        className="h-8 text-sm pl-10" 
                                        placeholder="0.00"
                                    />
                                </InputWithIcon>
                                <p className="text-[10px] text-muted-foreground">
                                    Brokerage Amount = Final Weight × Brokerage Rate
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                    <Input 
                                        id="kanta" 
                                        type="number" 
                                        {...form.register('kanta')} 
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
            onDelete={handleDeleteOption}
        />
        </>
    );
};

export default SimpleSupplierFormAllFields;

"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Controller, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { OptionItem } from "@/lib/definitions";
import { useLiveQuery } from "@/lib/use-live-query";
import { db } from "@/lib/database";
import type { UseFormReturn } from "react-hook-form";
import type { CompleteSupplierFormValues } from "@/lib/complete-form-schema";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Search, Hash, Hourglass, Banknote, Weight, Truck, Phone, User, UserSquare, Home, Percent, Settings, Landmark, Users } from "lucide-react";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { CustomDropdown } from "../ui/custom-dropdown";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { ProfilesSearchDialog } from "./profiles-search-dialog";
import { SuggestionInput } from "@/components/ui/suggestion-input";

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
interface CustomInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange"> {
    onChange: (value: string) => void;
}

const AutoCapitalizeInput = React.memo(({ value, onChange, onBlur, className, ...props }: CustomInputProps) => {
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
});
AutoCapitalizeInput.displayName = "AutoCapitalizeInput";

// Custom input with uppercase for vehicle number
const AutoUppercaseInput = React.memo(({ value, onChange, onBlur, className, ...props }: CustomInputProps) => {
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
});
AutoUppercaseInput.displayName = "AutoUppercaseInput";

interface SimpleSupplierFormAllFieldsProps {
    form: UseFormReturn<CompleteSupplierFormValues>;
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
    uniqueProfiles: Array<{name: string, so: string, address: string, contact: string}>;
    handleUseProfile: (profile: {name: string, so: string, address: string, contact: string}) => void;
    uniqueNames: string[];
    uniqueSo: string[];
    uniqueAddresses: string[];
    uniqueVehicleNos: string[];
    uniqueContacts: string[];
    isImportMode?: boolean;
    isStockMode?: boolean;
}

const SimpleSupplierFormAllFields = React.memo(({ 
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
    handleUseProfile,
    uniqueProfiles,
    uniqueNames,
    uniqueSo,
    uniqueAddresses,
    uniqueVehicleNos,
    uniqueContacts,
    firstInputRef,
    isImportMode = false,
    isStockMode = false
}: SimpleSupplierFormAllFieldsProps) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];
    const brokerOptions = React.useMemo(() => {
        return accounts.map(acc => ({
            value: acc.name,
            label: acc.name
        }));
    }, [accounts]);

    // useWatch isolates re-renders to only when these specific fields change
    const watchedPaymentType = useWatch({ control: form.control, name: 'paymentType' });
    const watchedVariety = useWatch({ control: form.control, name: 'variety' });
    const watchedBrokerageAddSubtract = useWatch({ control: form.control, name: 'brokerageAddSubtract' });

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;

    const profileSuggestions = useMemo(() => 
        uniqueProfiles.map(p => {
            const fatherPart = p.so ? ` S/o ${p.so}` : '';
            const addrPart = p.address ? ` | ${p.address}` : '';
            return `${p.name}${fatherPart}${addrPart}`;
        }),
    [uniqueProfiles]);


    // Stable callback — does not recreate on every render
    const handleNameSelect = useCallback((selectedValue: string) => {
        const matchedProfile = uniqueProfiles.find(p => {
            const fatherPart = p.so ? ` S/o ${p.so}` : '';
            const addrPart = p.address ? ` | ${p.address}` : '';
            const formatted = `${p.name}${fatherPart}${addrPart}`;
            return formatted.toLowerCase().trim() === selectedValue.toLowerCase().trim();
        });
        if (matchedProfile) {
            form.setValue('name', matchedProfile.name, { shouldValidate: true, shouldDirty: true });
            form.setValue('so', matchedProfile.so, { shouldValidate: true, shouldDirty: true });
            form.setValue('address', matchedProfile.address, { shouldValidate: true, shouldDirty: true });
            form.setValue('contact', matchedProfile.contact, { shouldValidate: true, shouldDirty: true });
        } else {
            form.setValue('name', selectedValue, { shouldValidate: true, shouldDirty: true });
        }
    }, [uniqueProfiles, form]);

    return (
        <>
        {isStockMode ? (
            <div className="rounded-md border border-border/50 bg-card p-3 space-y-3">
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
                    <div className="space-y-1">
                        <Label htmlFor="supplier-rate" className="text-xs">Rate</Label>
                        <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                            <Input 
                                id="supplier-rate" 
                                type="number" step="any"
                                {...form.register('rate')} 
                                className="h-8 text-sm pl-10" 
                            />
                        </InputWithIcon>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="simple-supplier-all-fields-gross-weight" className="text-xs">Quantity</Label>
                        <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                            <Input 
                                id="simple-supplier-all-fields-gross-weight" 
                                type="number" step="any"
                                {...form.register('grossWeight')} 
                                className="h-8 text-sm pl-10" 
                            />
                        </InputWithIcon>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Controller
                            name="unit"
                            control={form.control}
                            render={({ field }) => (
                                <CustomDropdown
                                    options={[
                                        { value: "KG", label: "Kg" },
                                        { value: "BAG", label: "Bag" },
                                        { value: "QTL", label: "Qtl" },
                                        { value: "PIECE", label: "Piece" },
                                    ]}
                                    value={field.value || "BAG"}
                                    onChange={(val) => form.setValue("unit", val || "BAG", { shouldDirty: true })}
                                    placeholder="Select unit..."
                                    maxRows={4}
                                />
                            )}
                        />
                    </div>
                    <div className="flex items-center space-x-2 pb-1 h-8 self-end">
                        <Controller
                            name="isPartyReceipt"
                            control={form.control}
                            render={({ field }) => (
                                <Switch
                                    id="stock-is-party-receipt"
                                    checked={!!field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                        <Label htmlFor="stock-is-party-receipt" className="text-xs cursor-pointer font-bold">Party Receipt</Label>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-8 space-y-1">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="name" className="text-xs">Party Name</Label>
                            <button
                                type="button"
                                onClick={() => {
                                    const btn = document.querySelector('[title="Add New Party/Account (Global)"]') as HTMLButtonElement | null;
                                    if (btn) btn.click();
                                }}
                                className="text-[10px] font-bold text-primary hover:underline uppercase"
                            >
                                + Add Party
                            </button>
                        </div>
                        <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                            <Controller
                                name="name"
                                control={form.control}
                                render={({ field }) => (
                                    <SuggestionInput
                                        id="name"
                                        suggestions={profileSuggestions}
                                        onSuggestionSelect={handleNameSelect}
                                        {...field}
                                        transformValue={capitalizeText}
                                        className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")}
                                    />
                                )}
                            />
                        </InputWithIcon>
                    </div>
                    <div className="lg:col-span-4 space-y-1">
                        <Label className="text-xs">Variety</Label>
                        <Controller
                            name="variety"
                            control={form.control}
                            render={({ field }) => (
                                <CustomDropdown
                                    options={[
                                        { value: "SUTLI", label: "SUTLI" },
                                        { value: "VARDANA", label: "VARDANA" },
                                        { value: "THREAD", label: "THREAD" },
                                        { value: "OTHER", label: "OTHER" },
                                    ]}
                                    value={field.value || "VARDANA"}
                                    onChange={(val) => form.setValue("variety", val || "VARDANA", { shouldDirty: true, shouldValidate: true })}
                                    placeholder="Select variety..."
                                    maxRows={4}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>
        ) : (
            <div className="space-y-3">
                {/* Top row - flat panel, no nested cards */}
                {!isImportMode && (
                    <div className="rounded-md border border-border/50 bg-card p-3">
                             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-x-3 gap-y-2">
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
                                <div className="space-y-1">
                                    <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                                    <InputWithIcon icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}>
                                        <Input 
                                            id="term" 
                                            type="number" step="any"
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
                                            type="number" step="any"
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
                                            type="number" step="any"
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
                                            type="number" step="any"
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
                                                <SuggestionInput
                                                    id="vehicleNo"
                                                    suggestions={uniqueVehicleNos}
                                                    {...field}
                                                    transformValue={(v) => v.toUpperCase()}
                                                    className="h-8 text-sm pl-10"
                                                />
                                            )}
                                        />
                                    </InputWithIcon>
                                </div>
                            </div>
                    </div>
                )}

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                     <div className="lg:col-span-7">
                        <div className="h-full rounded-md border border-border/50 bg-card p-3 space-y-3 flex flex-col justify-between">
                                {/* Row 1: Name */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="name" className="text-xs">Name</Label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const btn = document.querySelector('[title="Add New Party/Account (Global)"]') as HTMLButtonElement | null;
                                                    if (btn) btn.click();
                                                }}
                                                className="text-[10px] font-bold text-primary hover:underline uppercase"
                                            >
                                                + Add Party
                                            </button>
                                        </div>
                                        <ProfilesSearchDialog 
                                            profiles={uniqueProfiles} 
                                            onSelect={handleUseProfile} 
                                            trigger={
                                                <button 
                                                    type="button" 
                                                    tabIndex={-1} 
                                                    className="text-[10px] text-primary hover:underline flex items-center gap-1 transition-all"
                                                >
                                                    <Users className="h-2.5 w-2.5" />
                                                    Advance
                                                </button>
                                            }
                                        />
                                    </div>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller
                                            name="name"
                                            control={form.control}
                                            render={({ field }) => (
                                                <SuggestionInput
                                                    id="name"
                                                    suggestions={profileSuggestions}
                                                    onSuggestionSelect={handleNameSelect}
                                                    {...field}
                                                    transformValue={capitalizeText}
                                                    className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")}
                                                />
                                            )}
                                        />
                                    </InputWithIcon>
                                </div>

                                {/* Row 2: S/O & Address */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-2">
                                    <div className="space-y-1 sm:col-span-2">
                                        <Label htmlFor="so" className="text-xs">S/O (Father Name)</Label>
                                        <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                            <Controller
                                                name="so"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <SuggestionInput
                                                        id="so"
                                                        suggestions={uniqueSo}
                                                        {...field}
                                                        transformValue={capitalizeText}
                                                        className="h-8 text-sm pl-10"
                                                    />
                                                )}
                                            />
                                        </InputWithIcon>
                                    </div>

                                    <div className="space-y-1 sm:col-span-1">
                                        <Label htmlFor="address" className="text-xs">Address</Label>
                                        <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                            <Controller
                                                name="address"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <SuggestionInput
                                                        id="address"
                                                        suggestions={uniqueAddresses}
                                                        {...field}
                                                        transformValue={capitalizeText}
                                                        className="h-8 text-sm pl-10"
                                                    />
                                                )}
                                            />
                                        </InputWithIcon>
                                    </div>
                                </div>

                                {/* Row 3: Contact & Variety */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="contact" className="text-xs">Contact</Label>
                                        <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                           <Controller
                                               name="contact"
                                               control={form.control}
                                               render={({ field }) => (
                                                   <SuggestionInput
                                                       id="contact"
                                                       suggestions={uniqueContacts}
                                                       {...field}
                                                       type="tel"
                                                       maxLength={10}
                                                       onBlur={(e) => {
                                                           field.onBlur();
                                                           handleContactBlur(e.target.value);
                                                       }}
                                                       className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} 
                                                   />
                                               )}
                                           />
                                        </InputWithIcon>
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
                                            value={watchedVariety || ''} 
                                            onChange={(val) => {
                                                form.setValue("variety", val || '', { shouldDirty: true, shouldValidate: true });
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
                               </div>
                        </div>
                     </div>

                      <div className="lg:col-span-5">
                        <div className="h-full rounded-md border border-border/50 bg-card p-3 space-y-2 flex flex-col justify-between">
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label>
                                            <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                                <Input 
                                                    id="kartaPercentage" 
                                                    type="number" step="any"
                                                    {...form.register('kartaPercentage')} 
                                                    className="h-8 text-sm pl-10" 
                                                />
                                            </InputWithIcon>
                                        </div>
                                        {!isImportMode && (
                                            <div className="flex-1">
                                                <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                                    <Input 
                                                        id="labouryRate" 
                                                        type="number" step="any"
                                                        {...form.register('labouryRate')} 
                                                        className="h-8 text-sm pl-10" 
                                                    />
                                                </InputWithIcon>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <div className="flex-[0.6] min-w-0">
                                            <Label htmlFor="brokerName" className="text-xs">Broker Name</Label>
                                            <Controller
                                                name="brokerName"
                                                control={form.control}
                                                render={({ field }) => (
                                                    <CustomDropdown 
                                                        options={brokerOptions} 
                                                        value={field.value || ''} 
                                                        onChange={(val) => {
                                                            form.setValue("brokerName", val || '', { shouldDirty: true, shouldValidate: true });
                                                        }} 
                                                        placeholder="Select Broker..."
                                                        maxRows={5}
                                                        showScrollbar={true}
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="flex-[0.4] min-w-0">
                                            <Label htmlFor="brokerageRate" className="text-xs">Brokerage Rate</Label>
                                            <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                                <Input 
                                                    id="brokerageRate" 
                                                    type="number" step="any"
                                                    step="0.01"
                                                    {...form.register('brokerageRate')} 
                                                    className="h-8 text-sm pl-10" 
                                                    placeholder="0.00"
                                                />
                                            </InputWithIcon>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Brokerage Amount = Final Weight × Brokerage Rate
                                    </p>
                                </div>
                                {!isImportMode && (
                                    <div className="space-y-1">
                                        <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                        <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                            <Input 
                                                id="kanta" 
                                                type="number" step="any"
                                                {...form.register('kanta')} 
                                                className="h-8 text-sm pl-10" 
                                            />
                                        </InputWithIcon>
                                    </div>
                                )}
                                <div className="flex items-center space-x-2 pt-1 h-8">
                                    <Controller
                                        name="isPartyReceipt"
                                        control={form.control}
                                        render={({ field }) => (
                                            <Switch
                                                id="crops-is-party-receipt"
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                    <Label htmlFor="crops-is-party-receipt" className="text-xs cursor-pointer font-bold">Party Receipt</Label>
                                </div>
                        </div>
                     </div>
                </div>
            </div>
        )}
        <OptionsManagerDialog
            isOpen={isManageOptionsOpen}
            setIsOpen={setIsManageOptionsOpen}
            type={managementType}
            options={optionsToManage}
            onAdd={(collectionName, optionData) => handleAddOption(collectionName, optionData.name)}
            onUpdate={(collectionName, id, optionData) => handleUpdateOption(collectionName, id, optionData.name)}
            onDelete={handleDeleteOption}
        />
        </>
    );
});

SimpleSupplierFormAllFields.displayName = "SimpleSupplierFormAllFields";

export default SimpleSupplierFormAllFields;


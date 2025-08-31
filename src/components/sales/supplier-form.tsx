
"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase } from "@/lib/utils";
import type { Customer, OptionItem } from "@/lib/definitions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DynamicCombobox } from "@/components/ui/dynamic-combobox";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Milestone, UserSquare, Wallet, Hourglass, Settings, InfoIcon, PlusCircle } from "lucide-react";
import { Separator } from "../ui/separator";

const InputWithIcon = ({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) => (
    <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
        </div>
        {children}
    </div>
);

export const SupplierForm = ({ form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, setLastVariety, handleAddOption, handleUpdateOption, handleDeleteOption, allSuppliers }: any) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);
    const [nameSuggestions, setNameSuggestions] = useState<Customer[]>([]);
    const [isNamePopoverOpen, setIsNamePopoverOpen] = useState(false);

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        form.setValue('name', value);
        if (value.length > 1) {
            const uniqueSuppliers = Array.from(new Map(allSuppliers.map((s: Customer) => [s.customerId, s])).values());
            const filtered = uniqueSuppliers.filter((s: Customer) => 
                s.name.toLowerCase().startsWith(value.toLowerCase()) || s.contact.startsWith(value)
            );
            setNameSuggestions(filtered);
            setIsNamePopoverOpen(true);
        } else {
            setNameSuggestions([]);
            setIsNamePopoverOpen(false);
        }
    };
    
    const handleNameSelect = (supplier: Customer) => {
        form.setValue('name', toTitleCase(supplier.name));
        form.setValue('so', toTitleCase(supplier.so));
        form.setValue('address', toTitleCase(supplier.address));
        form.setValue('contact', supplier.contact);
        setIsNamePopoverOpen(false);
    };

    const handleCapitalizeOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const field = e.target.name as any;
        const value = e.target.value;
        form.setValue(field, toTitleCase(value) as any);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '0' || e.target.value === '0.00') {
            e.target.select();
        }
    };

    return (
        <>
        <div className="space-y-3">
            <Card className="bg-card/60 backdrop-blur-sm border-white/10">
                <CardContent className="p-3">
                     <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1.5fr] gap-x-3 gap-y-2">
                        <div className="space-y-1">
                            <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                            <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-8 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                                <InputWithIcon icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="term" type="number" {...form.register('term')} onFocus={handleFocus} className="h-8 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="rate" className="text-xs">Rate</Label>
                            <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="rate" control={form.control} render={({ field }) => (<Input id="rate" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="grossWeight" className="text-xs">Gross Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="grossWeight" control={form.control} render={({ field }) => (<Input id="grossWeight" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label>
                            <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="teirWeight" control={form.control} render={({ field }) => (<Input id="teirWeight" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10"/>)} />
                            </InputWithIcon>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="vehicleNo" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-8 text-sm pl-10" /> )}/>
                            </InputWithIcon>
                        </div>
                    </div>
                </CardContent>
            </Card>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-5">
                    <Card className="h-full">
                        <CardContent className="p-3 space-y-2 flex flex-col justify-between h-full">
                           <div className="grid grid-cols-2 gap-x-3">
                                <div className="space-y-1">
                                    <Label htmlFor="contact" className="text-xs">Contact</Label>
                                    <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                        <Controller name="contact" control={form.control} render={({ field }) => ( <Input {...field} onBlur={e => handleContactBlur(e.target.value)} className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} /> )}/>
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="name" className="text-xs">Name</Label>
                                    <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                                <Input id="name" value={form.watch('name')} onChange={handleNameChange} onBlur={(e) => { handleCapitalizeOnBlur(e); setTimeout(() => setIsNamePopoverOpen(false), 150); }} autoComplete="off" className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")} name="name" onFocus={e => { if (e.target.value.length > 1 && nameSuggestions.length > 0) { setIsNamePopoverOpen(true); }}}/>
                                            </InputWithIcon>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                            <Command><CommandList><CommandEmpty>No suppliers found.</CommandEmpty><CommandGroup>
                                                {nameSuggestions.map((s) => ( <CommandItem key={s.id} value={`${s.name} ${s.contact}`} onSelect={() => handleNameSelect(s)}>{toTitleCase(s.name)} ({s.contact})</CommandItem>))}
                                            </CommandGroup></CommandList></Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                           </div>
                            <div className="space-y-1">
                                <Label htmlFor="so" className="text-xs">S/O</Label>
                                <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="so" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-8 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="address" className="text-xs">Address</Label>
                                <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="address" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-8 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    <Card className="h-full">
                         <CardContent className="p-3 space-y-2 flex flex-col justify-between h-full">
                            <div className="space-y-1">
                                <Label className="text-xs">Payment Type</Label>
                                <Controller name="paymentType" control={form.control} render={({ field }) => (
                                    <DynamicCombobox options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))} value={field.value} onChange={(val) => form.setValue("paymentType", val)} onAdd={(newVal) => handleAddOption('paymentTypes', newVal)} placeholder="Select type..." searchPlaceholder="Search..." emptyPlaceholder="No type found." onIconClick={() => openManagementDialog('paymentType')}/>
                                )} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Variety</Label>
                                <Controller name="variety" control={form.control} render={({ field }) => (
                                    <DynamicCombobox options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))} value={field.value} onChange={(val) => { form.setValue("variety", val); setLastVariety(val); }} onAdd={(newVal) => handleAddOption('varieties', newVal)} placeholder="Select variety..." searchPlaceholder="Search..." emptyPlaceholder="No variety found." onIconClick={() => openManagementDialog('variety')}/>
                                )} />
                            </div>
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs">Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-8 text-sm",!field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 z-[51]">
                                        <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus/>
                                        </PopoverContent>
                                    </Popover>
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
                                    <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<Input id="kartaPercentage" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="labouryRate" control={form.control} render={({ field }) => (<Input id="labouryRate" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="kanta" control={form.control} render={({ field }) => (<Input id="kanta" type="number" {...field} onFocus={handleFocus} className="h-8 text-sm pl-10" />)} />
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

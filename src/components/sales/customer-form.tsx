
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
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DynamicCombobox } from "@/components/ui/dynamic-combobox";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Weight, Boxes, Briefcase, PackageSearch, Wallet, Settings, InfoIcon } from "lucide-react";

const SectionCard = ({ title, icon, children, className }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) => (
    <Card className={cn("bg-card/60 backdrop-blur-sm border-white/10", className)}>
        <CardHeader className="pb-4 pt-5">
            <CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle>
        </CardHeader>
        <CardContent>
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

export const CustomerForm = ({ form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, setLastVariety, handleAddOption, handleUpdateOption, handleDeleteOption, allCustomers }: any) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);
    const [nameSuggestions, setNameSuggestions] = useState<Customer[]>([]);
    const [isNamePopoverOpen, setIsNamePopoverOpen] = useState(false);
    const [isSameAsBilling, setIsSameAsBilling] = useState(true);

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        form.setValue('name', value);
        if (value.length > 1) {
            const uniqueCustomers = Array.from(new Map(allCustomers.map((s: Customer) => [s.customerId, s])).values());
            const filtered = uniqueCustomers.filter((s: Customer) => 
                s.name.toLowerCase().startsWith(value.toLowerCase()) || s.contact.startsWith(value)
            );
            setNameSuggestions(filtered);
            setIsNamePopoverOpen(true);
        } else {
            setNameSuggestions([]);
            setIsNamePopoverOpen(false);
        }
    };
    
    const handleNameSelect = (customer: Customer) => {
        form.setValue('name', toTitleCase(customer.name));
        form.setValue('companyName', toTitleCase(customer.companyName || ''));
        form.setValue('address', toTitleCase(customer.address));
        form.setValue('contact', customer.contact);
        form.setValue('gstin', customer.gstin || '');
        setIsNamePopoverOpen(false);
    };

    const handleCapitalizeOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const field = e.target.name as any;
        const value = e.target.value;
        form.setValue(field, toTitleCase(value) as any);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '0') {
        e.target.select();
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left Side */}
                <div className="lg:col-span-3 space-y-4">
                    <SectionCard title="Basic Info" icon={<InfoIcon className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs">Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9 text-sm",!field.value && "text-muted-foreground")}>
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
                            <div className="space-y-1">
                                <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                                <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-9 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Customer Details" icon={<User className="h-5 w-5" />}>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="name" className="text-xs">Name</Label>
                                <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                            <Input id="name" value={form.watch('name')} onChange={handleNameChange} onBlur={(e) => { handleCapitalizeOnBlur(e); setTimeout(() => setIsNamePopoverOpen(false), 150); }} autoComplete="off" className="h-9 text-sm pl-10" name="name" onFocus={e => { if (e.target.value.length > 1 && nameSuggestions.length > 0) { setIsNamePopoverOpen(true); }}}/>
                                        </InputWithIcon>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                        <Command><CommandList><CommandEmpty>No customers found.</CommandEmpty><CommandGroup>
                                            {nameSuggestions.map((s) => ( <CommandItem key={s.id} value={`${s.name} ${s.contact}`} onSelect={() => handleNameSelect(s)}>{toTitleCase(s.name)} ({s.contact})</CommandItem>))}
                                        </CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                                {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                                <InputWithIcon icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="companyName" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="contact" className="text-xs">Contact</Label>
                                <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="contact" control={form.control} render={({ field }) => ( <Input {...field} onBlur={e => handleContactBlur(e.target.value)} className="h-9 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                                {form.formState.errors.contact && <p className="text-xs text-destructive mt-1">{form.formState.errors.contact.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="gstin" className="text-xs">GSTIN</Label>
                                <InputWithIcon icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="gstin" control={form.control} render={({ field }) => ( <Input {...field} className="h-9 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1 sm:col-span-2">
                                <Label htmlFor="address" className="text-xs">Address</Label>
                                <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="address" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Side */}
                <div className="lg:col-span-2 space-y-4">
                     <SectionCard title="Transaction & Weight" icon={<PackageSearch className="h-5 w-5" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                                <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="vehicleNo" control={form.control} render={({ field }) => ( <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                             <Controller name="variety" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-2"><Wheat className="h-3 w-3"/>Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <DynamicCombobox options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))} value={field.value} onChange={(val) => { form.setValue("variety", val); setLastVariety(val); }} onAdd={(newVal) => handleAddOption('varieties', newVal)} placeholder="Select or add variety..." searchPlaceholder="Search variety..." emptyPlaceholder="No variety found."/>
                                    {form.formState.errors.variety && <p className="text-xs text-destructive mt-1">{form.formState.errors.variety.message}</p>}
                                </div>
                            )} />
                             <div className="space-y-1">
                                <Label htmlFor="grossWeight" className="text-xs">Gross Wt.</Label>
                                <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="grossWeight" control={form.control} render={({ field }) => (<Input id="grossWeight" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label>
                                <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="teirWeight" control={form.control} render={({ field }) => (<Input id="teirWeight" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10"/>)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bags" className="text-xs">Bags</Label>
                                <InputWithIcon icon={<Boxes className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bags" type="number" {...form.register('bags')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bagWeightKg" className="text-xs">Bag Wt. (kg)</Label>
                                <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bagWeightKg" type="number" {...form.register('bagWeightKg')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Financial Details" icon={<Banknote className="h-5 w-5" />}>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className="space-y-1">
                                <Label htmlFor="rate" className="text-xs">Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="rate" control={form.control} render={({ field }) => (<Input id="rate" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="bagRate" className="text-xs">Bag Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bagRate" type="number" {...form.register('bagRate')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="brokerage" className="text-xs">Brokerage Rate</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="brokerage" control={form.control} render={({ field }) => (<Input id="brokerage" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="cd" className="text-xs">CD %</Label>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="cd" control={form.control} render={({ field }) => (<Input id="cd" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="kanta" control={form.control} render={({ field }) => (<Input id="kanta" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                                </InputWithIcon>
                            </div>
                             <Controller name="paymentType" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-2"><Wallet className="h-3 w-3"/>Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <DynamicCombobox options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))} value={field.value} onChange={(val) => form.setValue("paymentType", val)} onAdd={(newVal) => handleAddOption('paymentTypes', newVal)} placeholder="Select or add type..." searchPlaceholder="Search type..." emptyPlaceholder="No type found."/>
                                    {form.formState.errors.paymentType && <p className="text-xs text-destructive mt-1">{form.formState.errors.paymentType.message}</p>}
                                </div>
                            )} />
                        </div>
                    </SectionCard>
                </div>
            </div>
             <SectionCard title="Shipping Details" icon={<Truck className="h-5 w-5" />} className="mt-4">
                <CardHeader className="p-0 pb-4 flex flex-row items-center justify-between">
                    <div/>
                    <div className="flex items-center space-x-2">
                        <Switch id="same-as-billing" checked={isSameAsBilling} onCheckedChange={setIsSameAsBilling} />
                        <Label htmlFor="same-as-billing" className="text-sm font-normal">Same as Bill To</Label>
                    </div>
                </CardHeader>
                {!isSameAsBilling && (
                <CardContent className="pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="shippingName" className="text-xs">Shipping Name</Label>
                        <Input id="shippingName" {...form.register('shippingName')} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="shippingCompanyName" className="text-xs">Shipping Company Name</Label>
                        <Input id="shippingCompanyName" {...form.register('shippingCompanyName')} className="h-9 text-sm" />
                    </div>
                        <div className="space-y-1">
                        <Label htmlFor="shippingContact" className="text-xs">Shipping Contact</Label>
                        <Input id="shippingContact" {...form.register('shippingContact')} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <Label htmlFor="shippingAddress" className="text-xs">Shipping Address</Label>
                        <Input id="shippingAddress" {...form.register('shippingAddress')} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="shippingGstin" className="text-xs">Shipping GSTIN</Label>
                        <Input id="shippingGstin" {...form.register('shippingGstin')} className="h-9 text-sm" />
                    </div>
                </CardContent>
                )}
            </SectionCard>
        
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

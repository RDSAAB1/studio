
"use client";

import { useState, useMemo, useEffect } from "react";
import { Controller, useWatch } from "react-hook-form";
import { format } from "date-fns";
import { cn, toTitleCase, formatCurrency, calculateCustomerEntry } from "@/lib/utils";
import type { Customer, OptionItem, KantaParchi } from "@/lib/definitions";
import { statesAndCodes, findStateByName, findStateByCode } from "@/lib/data";


import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { OptionsManagerDialog } from "./options-manager-dialog";
import { Separator } from "../ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Weight, Boxes, Briefcase, PackageSearch, Wallet, Settings, InfoIcon, Receipt, FileCheck, PlusCircle, ChevronsUpDown } from "lucide-react";
import { CollapsibleField } from "./collapsible-field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

export const CustomerForm = ({ form, handleSrNoBlur, handleContactBlur, varietyOptions, paymentTypeOptions, setLastVariety, setLastPaymentType, handleAddOption, handleUpdateOption, handleDeleteOption, allCustomers, activeTab: externalActiveTab, onTabChange, allKantaParchi = [], selectedKantaParchiSrNo = '', onKantaParchiSelect, onNewKantaParchi, documentType = 'tax-invoice', onDocumentTypeChange, receiptSettings }: any) => {
    
    const [isManageOptionsOpen, setIsManageOptionsOpen] = useState(false);
    const [managementType, setManagementType] = useState<'variety' | 'paymentType' | null>(null);
    const [nameSuggestions, setNameSuggestions] = useState<Customer[]>([]);
    const [isNamePopoverOpen, setIsNamePopoverOpen] = useState(false);
    const [isSameAsBilling, setIsSameAsBilling] = useState(true);
    const [internalActiveTab, setInternalActiveTab] = useState("weight");
    
    // Use external activeTab if provided, otherwise use internal state
    const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;
    const setActiveTab = (tab: string) => {
        if (onTabChange) {
            onTabChange(tab);
        } else {
            setInternalActiveTab(tab);
        }
    };

    const openManagementDialog = (type: 'variety' | 'paymentType') => {
        setManagementType(type);
        setIsManageOptionsOpen(true);
    };

    const optionsToManage = managementType === 'variety' ? varietyOptions : paymentTypeOptions;
    
    // Memoize Kanta Parchi options for dropdown
    const kantaParchiOptions = useMemo(() => {
        if (!Array.isArray(allKantaParchi) || allKantaParchi.length === 0) {
            return [];
        }
        return allKantaParchi.map((kp: KantaParchi) => ({
            value: kp.srNo,
            label: `${kp.srNo} - ${toTitleCase(kp.name || '')} (${kp.contact || ''}) - ${kp.date || ''}`
        }));
    }, [allKantaParchi]);
    
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = toTitleCase(e.target.value);
        form.setValue('name', value);
        if (value.length > 1) {
            const uniqueCustomers = Array.from(new Map(allCustomers.map((s: Customer) => [s.customerId, s])).values());
            const filtered = uniqueCustomers.filter((s: Customer) => 
                s.name.toLowerCase().startsWith(value.toLowerCase()) || s.contact.startsWith(value)
            );
            setNameSuggestions(filtered);
        } else {
            setNameSuggestions([]);
        }
    };
    
    const handleNameSelect = (customer: Customer) => {
        form.setValue('name', toTitleCase(customer.name));
        form.setValue('companyName', toTitleCase(customer.companyName || ''));
        form.setValue('address', toTitleCase(customer.address));
        form.setValue('contact', customer.contact);
        form.setValue('gstin', customer.gstin || '');
        form.setValue('stateName', customer.stateName || '');
        form.setValue('stateCode', customer.stateCode || '');
        setIsNamePopoverOpen(false);
    };

    const handleInputClick = () => {
        if (!isNamePopoverOpen) {
            setIsNamePopoverOpen(true);
        }
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
        name: ['grossWeight', 'teirWeight', 'bags', 'bagWeightKg', 'rate', 'netWeight', 'brokerage', 'cd', 'kanta', 'bagRate', 'advanceFreight', 'taxRate', 'isGstIncluded']
    });

    const [
        grossWeight,
        teirWeight,
        bags,
        bagWeightKg,
        rate,
        netWeight,
        brokerage,
        cd,
        kanta,
        bagRate,
        advanceFreight,
        taxRate,
        isGstIncluded
    ] = watchedValues;

    // Calculate values for display
    const calculated = useMemo(() => {
        const formValues = form.getValues();
        return calculateCustomerEntry(formValues, []);
    }, [grossWeight, teirWeight, bags, bagWeightKg, rate, netWeight, brokerage, cd, kanta, bagRate, advanceFreight, form]);

    // Calculate tax amounts
    const taxCalculations = useMemo(() => {
        const calcNetWeight = calculated.netWeight || 0;
        const calcRate = rate || 0;
        const calcTaxRate = (taxRate as number) || 5;
        const calcIsGstIncluded = (isGstIncluded as boolean) || false;
        const calcAdvanceFreight = (advanceFreight as number) || 0;
        
        const tableTotalAmount = calcNetWeight * calcRate;
        
        let taxableAmount: number;
        let totalTaxAmount: number;
        let totalInvoiceValue: number;

        if (calcIsGstIncluded) {
            taxableAmount = tableTotalAmount / (1 + (calcTaxRate / 100));
            totalTaxAmount = tableTotalAmount - taxableAmount;
            totalInvoiceValue = tableTotalAmount + calcAdvanceFreight;
        } else {
            taxableAmount = tableTotalAmount;
            totalTaxAmount = taxableAmount * (calcTaxRate / 100);
            totalInvoiceValue = taxableAmount + totalTaxAmount + calcAdvanceFreight;
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
    }, [calculated.netWeight, rate, taxRate, isGstIncluded, advanceFreight]);

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
            <SectionCard>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="weight" className="flex items-center gap-2">
                            <Weight className="h-4 w-4" />
                            Weight Details
                        </TabsTrigger>
                        <TabsTrigger value="document" className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4" />
                            Create Document
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Weight Details */}
                    <TabsContent value="weight" className="space-y-2 mt-2">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-sm flex items-center gap-1.5">
                                <Weight className="h-3.5 w-3.5" />
                                Kanta Parchi Entry
                            </h3>
                            {onNewKantaParchi && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onNewKantaParchi}
                                    className="h-7 text-xs px-2"
                                >
                                    <PlusCircle className="h-3.5 w-3.5 mr-1" />
                                    New
                                </Button>
                            )}
                        </div>
                        
                        {/* Row 1: Sr No., Rate, Gross Wt., Teir Wt., Bags */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                                <InputWithIcon icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="rate" className="text-xs">Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="rate" control={form.control} render={({ field }) => (<Input id="rate" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />)} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="grossWeight" className="text-xs">Gross Wt.</Label>
                                <InputWithIcon icon={<Weight className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="grossWeight" control={form.control} render={({ field }) => (<Input id="grossWeight" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />)} />
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
                        </div>

                        <Separator className="my-1" />

                        {/* Row 2: Name, Contact No., Variety, Vehicle No., Payment Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="name" className="text-xs">Name</Label>
                                <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <InputWithIcon icon={<User className="h-3.5 w-3.5 text-muted-foreground" />}>
                                            <Input id="name" value={form.watch('name')} onChange={handleNameChange} onBlur={() => setTimeout(() => setIsNamePopoverOpen(false), 200)} onClick={handleInputClick} onFocus={handleInputClick} autoComplete="off" className={cn("h-7 text-xs pl-9", form.formState.errors.name && "border-destructive")} name="name" />
                                        </InputWithIcon>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                        <Command><CommandList><CommandEmpty>No customers found.</CommandEmpty><CommandGroup>
                                            {nameSuggestions.map((s) => ( <CommandItem key={s.id} value={`${s.name} ${s.contact}`} onSelect={() => handleNameSelect(s)}>{toTitleCase(s.name)} ({s.contact})</CommandItem>))}
                                        </CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="contact" className="text-xs">Contact No.</Label>
                                <InputWithIcon icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}>
                                   <Controller name="contact" control={form.control} render={({ field }) => ( <Input {...field} type="tel" maxLength={10} onChange={handleNumericInput} onBlur={e => handleContactBlur(e.target.value)} className={cn("h-7 text-xs pl-9", form.formState.errors.contact && "border-destructive")} /> )}/>
                                </InputWithIcon>
                            </div>
                             <Controller name="variety" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label className="text-xs flex items-center gap-1.5">Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-4 w-4 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: toTitleCase(v.name)}))} value={field.value} onChange={(val) => { form.setValue("variety", val); setLastVariety(val); }} placeholder="Select variety..."/>
                                </div>
                            )} />
                            <div className="space-y-0.5">
                                <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                                <InputWithIcon icon={<Truck className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="vehicleNo" control={form.control} render={({ field }) => ( <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" /> )}/>
                                </InputWithIcon>
                            </div>
                             <Controller name="paymentType" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label className="text-xs flex items-center gap-1.5">Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-4 w-4 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: toTitleCase(v.name)}))} value={field.value} onChange={(val) => {form.setValue("paymentType", val); setLastPaymentType(val);}} placeholder="Select type..." />
                                </div>
                            )} />
                        </div>

                        <Separator className="my-1"/>

                        {/* Row 3: Date, Bags Rate, Bag Wt. */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                            <Controller name="date" control={form.control} render={({ field }) => (
                                <div className="space-y-0.5">
                                    <Label className="text-xs">Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-7 text-xs px-2",!field.value && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 z-[51]">
                                        <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus/>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )} />
                            <div className="space-y-0.5">
                                <Label htmlFor="bagRate" className="text-xs">Bags Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="bagRate" type="number" {...form.register('bagRate')} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="bagWeightKg" className="text-xs">Bag Wt. (kg)</Label>
                                <InputWithIcon icon={<Weight className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Input id="bagWeightKg" type="number" {...form.register('bagWeightKg')} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                </InputWithIcon>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Create Document - Simple Form */}
                    <TabsContent value="document" className="space-y-2 mt-2">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-sm flex items-center gap-1.5">
                                <FileCheck className="h-3.5 w-3.5" />
                                Document Details
                            </h3>
                        </div>

                        {/* Kanta Parchi Selection & Document Type */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="kantaParchiSelect" className="text-xs">Select Kanta Parchi <span className="text-destructive">*</span></Label>
                                <CustomDropdown
                                    options={kantaParchiOptions}
                                    value={selectedKantaParchiSrNo}
                                    onChange={(val) => {
                                        if (onKantaParchiSelect) {
                                            onKantaParchiSelect(val || '');
                                        }
                                    }}
                                    placeholder={kantaParchiOptions.length === 0 ? "No Kanta Parchi available. Create one in Weight Details tab first." : "Select Kanta Parchi to create document"}
                                    noItemsPlaceholder="No Kanta Parchi found"
                                />
                            </div>
                            <div className="space-y-0.5">
                                <Label className="text-xs">Document Type</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start px-2">
                                            {documentType === 'tax-invoice' ? 'Tax Invoice' : documentType === 'bill-of-supply' ? 'Bill of Supply' : 'Challan'}
                                            <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onDocumentTypeChange && onDocumentTypeChange('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDocumentTypeChange && onDocumentTypeChange('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDocumentTypeChange && onDocumentTypeChange('challan')}>Challan</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <Separator className="my-1" />

                        {/* Tax & Charges */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
                            <div className="space-y-0.5">
                                <Label htmlFor="taxRate" className="text-xs">Tax Rate (%)</Label>
                                <InputWithIcon icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="taxRate" control={form.control} render={({ field }) => (
                                        <Input id="taxRate" type="number" {...field} defaultValue={5} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                    )} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="cd" className="text-xs">CD (%)</Label>
                                <InputWithIcon icon={<Percent className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="cd" control={form.control} render={({ field }) => (
                                        <Input id="cd" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                    )} />
                                </InputWithIcon>
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
                                <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="kanta" control={form.control} render={({ field }) => (
                                        <Input id="kanta" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                    )} />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-0.5">
                                <Label htmlFor="advanceFreight" className="text-xs">Advance/Freight</Label>
                                <InputWithIcon icon={<Banknote className="h-3.5 w-3.5 text-muted-foreground" />}>
                                    <Controller name="advanceFreight" control={form.control} render={({ field }) => (
                                        <Input id="advanceFreight" type="number" {...field} onFocus={handleFocus} className="h-7 text-xs pl-9" />
                                    )} />
                                </InputWithIcon>
                            </div>
                        </div>

                        <Separator className="my-1" />

                        {/* Bill To Section */}
                        <div>
                            <h4 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                Bill To
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                <div className="space-y-0.5">
                                    <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                                    <InputWithIcon icon={<Briefcase className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="companyName" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="address" className="text-xs">Address</Label>
                                    <InputWithIcon icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="address" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="stateName" className="text-xs">State Name</Label>
                                    <CustomDropdown
                                        options={stateNameOptions}
                                        value={form.watch('stateName')}
                                        onChange={handleStateNameChange}
                                        placeholder="Select state..."
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="stateCode" className="text-xs">State Code</Label>
                                    <CustomDropdown
                                        options={stateCodeOptions}
                                        value={form.watch('stateCode')}
                                        onChange={handleStateCodeChange}
                                        placeholder="Select code..."
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="contact" className="text-xs">Contact</Label>
                                    <InputWithIcon icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="contact" control={form.control} render={({ field }) => (
                                            <Input {...field} type="tel" maxLength={10} onChange={handleNumericInput} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="gstin" className="text-xs">GSTIN</Label>
                                    <InputWithIcon icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="gstin" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={(e) => form.setValue('gstin', e.target.value.toUpperCase())} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                            </div>
                        </div>

                        <Separator className="my-1" />

                        {/* Ship To Section */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="font-semibold text-xs flex items-center gap-1.5">
                                    <Truck className="h-3.5 w-3.5" />
                                    Ship To
                                </h4>
                                <div className="flex items-center gap-1.5">
                                    <Label htmlFor="sameAsBilling" className="text-xs">Same as Bill To</Label>
                                    <Switch
                                        id="sameAsBilling"
                                        checked={isSameAsBilling}
                                        onCheckedChange={setIsSameAsBilling}
                                        className="h-4"
                                    />
                                </div>
                            </div>
                            {!isSameAsBilling ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingCompanyName" className="text-xs">Company Name</Label>
                                        <InputWithIcon icon={<Briefcase className="h-3.5 w-3.5 text-muted-foreground" />}>
                                            <Controller name="shippingCompanyName" control={form.control} render={({ field }) => (
                                                <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                            )} />
                                        </InputWithIcon>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingAddress" className="text-xs">Address</Label>
                                        <InputWithIcon icon={<Home className="h-3.5 w-3.5 text-muted-foreground" />}>
                                            <Controller name="shippingAddress" control={form.control} render={({ field }) => (
                                                <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                            )} />
                                        </InputWithIcon>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingStateName" className="text-xs">State Name</Label>
                                        <CustomDropdown
                                            options={stateNameOptions}
                                            value={form.watch('shippingStateName')}
                                            onChange={(val) => {
                                                form.setValue('shippingStateName', val || '');
                                                const state = findStateByName(val || '');
                                                if (state) form.setValue('shippingStateCode', state.code);
                                            }}
                                            placeholder="Select state..."
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingStateCode" className="text-xs">State Code</Label>
                                        <CustomDropdown
                                            options={stateCodeOptions}
                                            value={form.watch('shippingStateCode')}
                                            onChange={(val) => {
                                                form.setValue('shippingStateCode', val || '');
                                                const state = findStateByCode(val || '');
                                                if (state) form.setValue('shippingStateName', state.name);
                                            }}
                                            placeholder="Select code..."
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingContact" className="text-xs">Contact</Label>
                                        <InputWithIcon icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}>
                                            <Controller name="shippingContact" control={form.control} render={({ field }) => (
                                                <Input {...field} type="tel" maxLength={10} onChange={handleNumericInput} className="h-7 text-xs pl-9" />
                                            )} />
                                        </InputWithIcon>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label htmlFor="shippingGstin" className="text-xs">GSTIN</Label>
                                        <InputWithIcon icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}>
                                            <Controller name="shippingGstin" control={form.control} render={({ field }) => (
                                                <Input {...field} onChange={(e) => form.setValue('shippingGstin', e.target.value.toUpperCase())} className="h-7 text-xs pl-9" />
                                            )} />
                                        </InputWithIcon>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">Same as Bill To</p>
                            )}
                        </div>

                        <Separator className="my-1" />

                        {/* Transport Details */}
                        <div>
                            <h4 className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                                <Truck className="h-3.5 w-3.5" />
                                Transport Details
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1.5">
                                <div className="space-y-0.5">
                                    <Label htmlFor="nineRNo" className="text-xs">9R No</Label>
                                    <InputWithIcon icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="nineRNo" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="gatePassNo" className="text-xs">Gate Pass No</Label>
                                    <InputWithIcon icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="gatePassNo" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="grNo" className="text-xs">G.R. No</Label>
                                    <InputWithIcon icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="grNo" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="grDate" className="text-xs">G.R. Date</Label>
                                    <Controller name="grDate" control={form.control} render={({ field }) => (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-7 text-xs px-2", !field.value && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 z-[51]">
                                                <CalendarComponent mode="single" selected={field.value} onSelect={(date) => field.onChange(date || new Date())} initialFocus/>
                                            </PopoverContent>
                                        </Popover>
                                    )} />
                                </div>
                                <div className="space-y-0.5 sm:col-span-2">
                                    <Label htmlFor="transport" className="text-xs">Transport</Label>
                                    <InputWithIcon icon={<Truck className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="transport" control={form.control} render={({ field }) => (
                                            <Input {...field} onChange={handleCapitalizeOnChange} className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5">
                                    <Label htmlFor="hsnCode" className="text-xs">HSN Code</Label>
                                    <InputWithIcon icon={<Hash className="h-3.5 w-3.5 text-muted-foreground" />}>
                                        <Controller name="hsnCode" control={form.control} render={({ field }) => (
                                            <Input {...field} defaultValue="1006" className="h-7 text-xs pl-9" />
                                        )} />
                                    </InputWithIcon>
                                </div>
                                <div className="space-y-0.5 flex items-end">
                                    <div className="flex items-center gap-1.5 w-full">
                                        <Label htmlFor="isGstIncluded" className="text-xs">GST Included</Label>
                                        <Controller name="isGstIncluded" control={form.control} render={({ field }) => (
                                            <Switch checked={field.value || false} onCheckedChange={field.onChange} className="h-4" />
                                        )} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </SectionCard>
        
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

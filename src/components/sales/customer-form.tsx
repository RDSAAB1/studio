
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
                    <TabsContent value="weight" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-base flex items-center gap-2">
                                <Weight className="h-4 w-4" />
                                Kanta Parchi Entry
                            </h3>
                            {onNewKantaParchi && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onNewKantaParchi}
                                    className="h-8"
                                >
                                    <PlusCircle className="h-4 w-4 mr-2" />
                                    New
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
                            <div className="space-y-1">
                                <Label htmlFor="srNo" className="text-xs">Sr No.</Label>
                                <InputWithIcon icon={<Hash className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-8 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                             <Controller name="variety" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-2">Variety <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: toTitleCase(v.name)}))} value={field.value} onChange={(val) => { form.setValue("variety", val); setLastVariety(val); }} placeholder="Select variety..."/>
                                </div>
                            )} />
                             <Controller name="paymentType" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs flex items-center gap-2">Payment Type<Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-5 w-5 shrink-0"><Settings className="h-3 w-3"/></Button></Label>
                                    <CustomDropdown options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: toTitleCase(v.name)}))} value={field.value} onChange={(val) => {form.setValue("paymentType", val); setLastPaymentType(val);}} placeholder="Select type..." />
                                </div>
                            )} />
                            <div className="space-y-1">
                                <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                                <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                    <Controller name="vehicleNo" control={form.control} render={({ field }) => ( <Input {...field} onChange={handleCapitalizeOnChange} className="h-8 text-sm pl-10" /> )}/>
                                </InputWithIcon>
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="contact" className="text-xs">Contact</Label>
                                <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                   <Controller name="contact" control={form.control} render={({ field }) => ( <Input {...field} type="tel" maxLength={10} onChange={handleNumericInput} onBlur={e => handleContactBlur(e.target.value)} className={cn("h-8 text-sm pl-10", form.formState.errors.contact && "border-destructive")} /> )}/>
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="name" className="text-xs">Name</Label>
                                <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                            <Input id="name" value={form.watch('name')} onChange={handleNameChange} onBlur={() => setTimeout(() => setIsNamePopoverOpen(false), 200)} onClick={handleInputClick} onFocus={handleInputClick} autoComplete="off" className={cn("h-8 text-sm pl-10", form.formState.errors.name && "border-destructive")} name="name" />
                                        </InputWithIcon>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                                        <Command><CommandList><CommandEmpty>No customers found.</CommandEmpty><CommandGroup>
                                            {nameSuggestions.map((s) => ( <CommandItem key={s.id} value={`${s.name} ${s.contact}`} onSelect={() => handleNameSelect(s)}>{toTitleCase(s.name)} ({s.contact})</CommandItem>))}
                                        </CommandGroup></CommandList></Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <Separator className="my-2"/>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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
                                <Label htmlFor="bagWeightKg" className="text-xs">Bag Wt. (kg)</Label>
                                <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bagWeightKg" type="number" {...form.register('bagWeightKg')} onFocus={handleFocus} className="h-8 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bags" className="text-xs">Bags</Label>
                                <InputWithIcon icon={<Boxes className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bags" type="number" {...form.register('bags')} onFocus={handleFocus} className="h-8 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bagRate" className="text-xs">Bag Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                    <Input id="bagRate" type="number" {...form.register('bagRate')} onFocus={handleFocus} className="h-8 text-sm pl-10" />
                                </InputWithIcon>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Create Document (Document-like Layout matching print format) */}
                    <TabsContent value="document" className="space-y-4 mt-4">
                        {/* Kanta Parchi Selection */}
                        <div className="mb-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
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
                                <div className="flex items-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 w-full">
                                                {documentType === 'tax-invoice' ? 'Tax Invoice' : documentType === 'bill-of-supply' ? 'Bill of Supply' : 'Challan'}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
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
                        </div>

                        {/* Document Layout - Matching Print Format with Theme */}
                        <div className="bg-card text-card-foreground font-sans text-sm leading-normal p-6 border-2 border-border rounded-lg shadow-sm">
                            {/* Top Header Row - Company Info (Left) + Document Title (Right) */}
                            <div className="flex justify-between items-start mb-4">
                                {/* Left: Company Details */}
                                <div className="w-1/2">
                                    <h2 className="font-bold text-3xl mb-1 text-foreground">{receiptSettings?.companyName || 'Company Name'}</h2>
                                    <p className="text-muted-foreground text-sm">{receiptSettings?.companyAddress1 || ''}, {receiptSettings?.companyAddress2 || ''}</p>
                                    <p className="text-muted-foreground text-sm">State: {receiptSettings?.companyStateName || ''} (Code: {receiptSettings?.companyStateCode || ''})</p>
                                    <p className="text-muted-foreground text-sm">GSTIN: {receiptSettings?.companyGstin || ''}</p>
                                    <p className="text-muted-foreground text-sm">Phone: {receiptSettings?.contactNo || ''} | Email: {receiptSettings?.gmail || ''}</p>
                                </div>
                                
                                {/* Right: Document Type & Details */}
                                <div className="text-right w-1/2">
                                    <h1 className="text-4xl font-bold text-foreground uppercase mb-1">
                                        {documentType === 'tax-invoice' ? 'TAX INVOICE' : documentType === 'bill-of-supply' ? 'BILL OF SUPPLY' : 'DELIVERY CHALLAN'}
                                    </h1>
                                    <div className="text-base text-muted-foreground">
                                        <div className="grid grid-cols-2 text-left gap-x-2">
                                            <span className="font-bold">Invoice #:</span>
                                            <span>{form.watch('srNo') || '—'}</span>
                                            <span className="font-bold">Date:</span>
                                            <span>{form.watch('date') ? format(form.watch('date'), "dd MMM, yyyy") : format(new Date(), "dd MMM, yyyy")}</span>
                                            <span className="font-bold">Vehicle No:</span>
                                            <span>{form.watch('vehicleNo') ? toTitleCase(form.watch('vehicleNo')).toUpperCase() : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tax %, Brokerage, CD %, Kanta, Advance/Freight - Formatted Row */}
                            <div className="grid grid-cols-5 gap-4 mb-6 pb-4 border-b-2 border-border">
                                <div className="text-center">
                                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Tax Rate (%)</Label>
                                    <Controller name="taxRate" control={form.control} render={({ field }) => (
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            className="h-8 text-center text-base font-bold border-0 border-b-2 border-border rounded-none px-0 bg-transparent"
                                            defaultValue={5}
                                            onFocus={(e) => e.target.select()}
                                        />
                                    )} />
                                </div>
                                <div className="text-center">
                                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">CD (%)</Label>
                                    <Controller name="cd" control={form.control} render={({ field }) => (
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            className="h-8 text-center text-base font-bold border-0 border-b-2 border-border rounded-none px-0 bg-transparent"
                                            onFocus={(e) => e.target.select()}
                                        />
                                    )} />
                                </div>
                                <div className="text-center">
                                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Brokerage Rate</Label>
                                    <Controller name="brokerage" control={form.control} render={({ field }) => (
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            className="h-8 text-center text-base font-bold border-0 border-b-2 border-border rounded-none px-0 bg-transparent"
                                            onFocus={(e) => e.target.select()}
                                        />
                                    )} />
                                </div>
                                <div className="text-center">
                                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Kanta</Label>
                                    <Controller name="kanta" control={form.control} render={({ field }) => (
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            className="h-8 text-center text-base font-bold border-0 border-b-2 border-border rounded-none px-0 bg-transparent"
                                            onFocus={(e) => e.target.select()}
                                        />
                                    )} />
                                </div>
                                <div className="text-center">
                                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Advance/Freight</Label>
                                    <Controller name="advanceFreight" control={form.control} render={({ field }) => (
                                        <Input 
                                            type="number" 
                                            {...field} 
                                            className="h-8 text-center text-base font-bold border-0 border-b-2 border-border rounded-none px-0 bg-transparent"
                                            onFocus={(e) => e.target.select()}
                                        />
                                    )} />
                                </div>
                            </div>

                            {/* Bill To & Ship To - Two Columns */}
                            <div className="grid grid-cols-2 gap-4 mt-8 mb-6">
                                {/* Bill To */}
                                <div className="border border-border p-4 rounded-lg bg-muted/30">
                                    <h3 className="font-bold text-muted-foreground mb-2 uppercase tracking-wider text-xs">Bill To</h3>
                                    <div className="space-y-1">
                                        <CollapsibleField
                                            label="Name"
                                            value={form.watch('companyName') || form.watch('name')}
                                            onChange={(val) => {
                                                form.setValue('companyName', val);
                                                if (!form.watch('name')) form.setValue('name', val);
                                            }}
                                        />
                                        <CollapsibleField
                                            label="Address"
                                            value={form.watch('address')}
                                            onChange={(val) => form.setValue('address', val)}
                                        />
                                        <div className="border-b border-gray-200 pb-2 mb-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-medium text-gray-600">State:</Label>
                                                <span className="text-sm text-gray-900">
                                                    {form.watch('stateName') && form.watch('stateCode') 
                                                        ? `${form.watch('stateName')} (Code: ${form.watch('stateCode')})`
                                                        : '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <CollapsibleField
                                            label="Phone"
                                            value={form.watch('contact')}
                                            onChange={(val) => form.setValue('contact', val)}
                                        />
                                        <CollapsibleField
                                            label="GSTIN"
                                            value={form.watch('gstin')}
                                            onChange={(val) => form.setValue('gstin', val.toUpperCase())}
                                        />
                                    </div>
                                    {/* State fields - collapsible for editing */}
                                    <div className="mt-2 space-y-1">
                                        <CollapsibleField
                                            label="Edit State Name"
                                            value={form.watch('stateName')}
                                            onChange={(val) => {
                                                form.setValue('stateName', val);
                                                const state = findStateByName(val);
                                                if (state) form.setValue('stateCode', state.code);
                                            }}
                                        />
                                        <CollapsibleField
                                            label="Edit State Code"
                                            value={form.watch('stateCode')}
                                            onChange={(val) => {
                                                form.setValue('stateCode', val);
                                                const state = findStateByCode(val);
                                                if (state) form.setValue('stateName', state.name);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Ship To */}
                                <div className="border border-border p-4 rounded-lg bg-muted/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-bold text-muted-foreground uppercase tracking-wider text-xs">Ship To</h3>
                                        <button
                                            type="button"
                                            onClick={() => setIsSameAsBilling(!isSameAsBilling)}
                                            className={cn(
                                                "relative w-32 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-300 ease-in-out text-[10px]",
                                                !isSameAsBilling ? 'bg-primary/20' : 'bg-secondary/20'
                                            )}
                                        >
                                            <span className={cn("absolute right-2 font-semibold transition-colors duration-300", !isSameAsBilling ? 'text-primary' : 'text-muted-foreground')}>Different</span>
                                            <span className={cn("absolute left-2 font-semibold transition-colors duration-300", isSameAsBilling ? 'text-primary' : 'text-muted-foreground')}>Same</span>
                                            <div
                                                className={cn(
                                                    "absolute w-[calc(50%+4px)] h-full top-0 rounded-full shadow-sm flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                                                    !isSameAsBilling ? 'translate-x-[-1px]' : 'translate-x-[calc(100%-20px)]'
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300 text-[9px] font-bold",
                                                    !isSameAsBilling ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                                                )}>
                                                    Toggle
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                    {!isSameAsBilling ? (
                                        <div className="space-y-1">
                                            <CollapsibleField
                                                label="Name"
                                                value={form.watch('shippingCompanyName') || form.watch('shippingName')}
                                                onChange={(val) => {
                                                    form.setValue('shippingCompanyName', val);
                                                    if (!form.watch('shippingName')) form.setValue('shippingName', val);
                                                }}
                                            />
                                            <CollapsibleField
                                                label="Address"
                                                value={form.watch('shippingAddress')}
                                                onChange={(val) => form.setValue('shippingAddress', val)}
                                            />
                                            <div className="border-b border-gray-200 pb-2 mb-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs font-medium text-gray-600">State:</Label>
                                                    <span className="text-sm text-gray-900">
                                                        {form.watch('shippingStateName') && form.watch('shippingStateCode') 
                                                            ? `${form.watch('shippingStateName')} (Code: ${form.watch('shippingStateCode')})`
                                                            : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                            <CollapsibleField
                                                label="Phone"
                                                value={form.watch('shippingContact')}
                                                onChange={(val) => form.setValue('shippingContact', val)}
                                            />
                                            <CollapsibleField
                                                label="GSTIN"
                                                value={form.watch('shippingGstin')}
                                                onChange={(val) => form.setValue('shippingGstin', val.toUpperCase())}
                                            />
                                            <div className="mt-2 space-y-1">
                                                <CollapsibleField
                                                    label="Edit State Name"
                                                    value={form.watch('shippingStateName')}
                                                    onChange={(val) => {
                                                        form.setValue('shippingStateName', val);
                                                        const state = findStateByName(val);
                                                        if (state) form.setValue('shippingStateCode', state.code);
                                                    }}
                                                />
                                                <CollapsibleField
                                                    label="Edit State Code"
                                                    value={form.watch('shippingStateCode')}
                                                    onChange={(val) => {
                                                        form.setValue('shippingStateCode', val);
                                                        const state = findStateByCode(val);
                                                        if (state) form.setValue('shippingStateName', state.name);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Same as Bill To</p>
                                    )}
                                </div>
                            </div>

                            {/* Transport Details - Matching print format */}
                            <div className="border border-border p-3 rounded-lg text-xs grid grid-cols-4 gap-x-4 gap-y-2 bg-muted/30">
                                <div className="flex gap-2 items-center">
                                    <span className="font-semibold text-muted-foreground">9R No:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('nineRNo')}
                                        onChange={(val) => form.setValue('nineRNo', val)}
                                        className="!border-0 !p-0 !m-0"
                                        inputClassName="!h-6 text-xs"
                                    />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="font-semibold text-muted-foreground">Gate Pass No:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('gatePassNo')}
                                        onChange={(val) => form.setValue('gatePassNo', val)}
                                        className="!border-0 !p-0 !m-0"
                                        inputClassName="!h-6 text-xs"
                                    />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="font-semibold text-muted-foreground">G.R. No:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('grNo')}
                                        onChange={(val) => form.setValue('grNo', val)}
                                        className="!border-0 !p-0 !m-0"
                                        inputClassName="!h-6 text-xs"
                                    />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="font-semibold text-muted-foreground">G.R. Date:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('grDate')}
                                        onChange={(val) => form.setValue('grDate', val)}
                                        type="date"
                                        className="!border-0 !p-0 !m-0"
                                        inputClassName="!h-6 text-xs"
                                    />
                                </div>
                                <div className="flex gap-2 items-center col-span-2">
                                    <span className="font-semibold text-muted-foreground">Transport:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('transport')}
                                        onChange={(val) => form.setValue('transport', val)}
                                        className="!border-0 !p-0 !m-0 flex-1"
                                        inputClassName="!h-6 text-xs"
                                    />
                                </div>
                                <div className="col-span-2 flex gap-2 items-center">
                                    <span className="font-semibold text-muted-foreground">HSN Code:</span>
                                    <CollapsibleField
                                        label=""
                                        value={form.watch('hsnCode') || '1006'}
                                        onChange={(val) => form.setValue('hsnCode', val)}
                                        className="!border-0 !p-0 !m-0"
                                        inputClassName="!h-6 text-xs"
                                    />
                                    <span className="font-semibold text-muted-foreground ml-4">GST Included:</span>
                                    <Controller name="isGstIncluded" control={form.control} render={({ field }) => (
                                        <Switch checked={field.value || false} onCheckedChange={field.onChange} className="h-4 w-8" />
                                    )} />
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-border rounded-lg overflow-hidden mt-6 bg-muted/30">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="uppercase text-xs text-muted-foreground">
                                            <th className="p-3 font-semibold text-center w-[5%]">#</th>
                                            <th className="p-3 font-semibold w-[35%]">Item & Description</th>
                                            <th className="p-3 font-semibold text-center w-[10%]">HSN/SAC</th>
                                            <th className="p-3 font-semibold text-center w-[10%]">UOM</th>
                                            <th className="p-3 font-semibold text-center w-[15%]">Qty (Qtl)</th>
                                            <th className="p-3 font-semibold text-right w-[10%]">Rate</th>
                                            <th className="p-3 font-semibold text-right w-[15%]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t border-border">
                                            <td className="p-3 text-center">1</td>
                                            <td className="p-3">
                                                <p className="font-semibold text-base text-foreground">{toTitleCase(form.watch('variety') || '—')}</p>
                                            </td>
                                            <td className="p-3 text-center text-muted-foreground">{form.watch('hsnCode') || '1006'}</td>
                                            <td className="p-3 text-center text-muted-foreground">{form.watch('bags') || '—'} Bags</td>
                                            <td className="p-3 text-center text-foreground">{(calculated.netWeight || 0).toFixed(2)}</td>
                                            <td className="p-3 text-right text-foreground">{formatCurrency(form.watch('rate') || 0)}</td>
                                            <td className="p-3 text-right font-semibold text-foreground">{formatCurrency(Math.round(taxCalculations.tableTotalAmount))}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Amount Summary Section */}
                            <div className="flex justify-between gap-6 mt-6">
                                {/* Left: Amount in Words & Bank Details */}
                                <div className="w-3/5 space-y-3">
                                    <div className="border border-border rounded-lg p-4 bg-muted/30">
                                        <p className="font-bold mb-1 uppercase text-muted-foreground text-xs">Amount in Words:</p>
                                        <p className="font-semibold text-foreground text-base">{numberToWords(Math.round(taxCalculations.totalInvoiceValue))}</p>
                                    </div>
                                    {receiptSettings && (
                                        <div className="border border-border rounded-lg p-3 bg-muted/30">
                                            <h4 className="font-bold mb-1 text-muted-foreground uppercase text-xs">Bank Details</h4>
                                            {receiptSettings.defaultBank?.bankName ? (
                                                <div className="text-xs space-y-0.5 text-foreground">
                                                    <p><span className="font-semibold">Bank:</span> {receiptSettings.defaultBank.bankName}</p>
                                                    <p><span className="font-semibold">A/C No:</span> {receiptSettings.defaultBank.accountNumber}</p>
                                                    <p><span className="font-semibold">Branch:</span> {receiptSettings.defaultBank.branchName || ''}</p>
                                                    <p><span className="font-semibold">IFSC:</span> {receiptSettings.defaultBank.ifscCode}</p>
                                                </div>
                                            ) : (
                                                <div className="text-xs space-y-0.5 text-foreground">
                                                    <p><span className="font-semibold">Bank:</span> {receiptSettings.bankName || '—'}</p>
                                                    <p><span className="font-semibold">A/C No:</span> {receiptSettings.accountNo || '—'}</p>
                                                    <p><span className="font-semibold">Branch:</span> {receiptSettings.branchName || '—'}</p>
                                                    <p><span className="font-semibold">IFSC:</span> {receiptSettings.ifscCode || '—'}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Tax Calculation Summary */}
                                <div className="w-2/5 text-base border border-border rounded-lg overflow-hidden bg-muted/30">
                                    <div className="flex justify-between p-2 border-b border-border">
                                        <span className="font-semibold text-muted-foreground">Taxable Amount:</span>
                                        <span className="font-semibold text-foreground">{formatCurrency(Math.round(taxCalculations.taxableAmount))}</span>
                                    </div>
                                    <div className="flex justify-between p-2 border-b border-border">
                                        <span className="font-semibold text-muted-foreground">CGST ({taxCalculations.taxRate/2}%):</span>
                                        <span className="text-foreground">{formatCurrency(Math.round(taxCalculations.cgstAmount))}</span>
                                    </div>
                                    <div className="flex justify-between p-2 border-b border-border">
                                        <span className="font-semibold text-muted-foreground">SGST ({taxCalculations.taxRate/2}%):</span>
                                        <span className="text-foreground">{formatCurrency(Math.round(taxCalculations.sgstAmount))}</span>
                                    </div>
                                    {(form.watch('advanceFreight') || 0) > 0 && (
                                        <div className="flex justify-between p-2 border-b border-border">
                                            <span className="font-semibold text-muted-foreground">Freight/Advance:</span>
                                            <span className="text-foreground">{formatCurrency(form.watch('advanceFreight') || 0)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between p-3 mt-1 bg-primary/20 text-foreground font-bold rounded-b-lg">
                                        <span>Balance Due:</span>
                                        <span>{formatCurrency(Math.round(taxCalculations.totalInvoiceValue))}</span>
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

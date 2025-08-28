
"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodError } from "zod";
import type { Customer, Payment, OptionItem, ReceiptSettings, ReceiptFieldSettings, ConsolidatedReceiptData } from "@/lib/definitions";
import { formatSrNo, toTitleCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicCombobox } from "@/components/ui/dynamic-combobox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";


import { Pen, PlusCircle, Save, Trash, Info, Settings, Plus, ChevronsUpDown, Check, Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Milestone, UserSquare, Wallet, ArrowRight, LayoutGrid, LayoutList, Rows3, StepForward, X, Server, Hourglass, InfoIcon, UserCog, PackageSearch, CircleDollarSign, Receipt, Printer, Search, Briefcase, Boxes, RefreshCw } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator";
import { addCustomer, deleteCustomer, getCustomersRealtime, updateCustomer, getPaymentsRealtime, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings, deletePaymentsForSrNo } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { TaxInvoice } from "@/components/receipts/tax-invoice";
import { BillOfSupply } from "@/components/receipts/bill-of-supply";
import { Challan } from "@/components/receipts/challan";

const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    bags: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    companyName: z.string(),
    address: z.string(),
    contact: z.string()
      .length(10, "Contact number must be exactly 10 digits.")
      .regex(/^\d+$/, "Contact number must only contain digits."),
    gstin: z.string().optional(),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    cd: z.coerce.number().min(0),
    brokerage: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required"),
    isBrokerageIncluded: z.boolean(),
    bagWeightKg: z.coerce.number().min(0),
    bagRate: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;
type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';
type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'challan';

const getInitialFormState = (lastVariety?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: 'C----', date: today.toISOString().split('T')[0], term: '0', dueDate: today.toISOString().split('T')[0], 
    name: '', so: '', companyName: '', address: '', contact: '', gstin: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 0, labouryAmount: 0, kanta: 0, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', searchValue: '', bags: 0, brokerage: 0, cd: 0, isBrokerageIncluded: false,
    bagWeightKg: 0, bagRate: 0, bagAmount: 0
  };
};

const SectionCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <Card className={cn("bg-card/60 backdrop-blur-sm border-white/10", className)}>
        {children}
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

const CustomerForm = memo(function CustomerForm({ form, handleSrNoBlur, handleCapitalizeOnBlur, handleContactBlur, varietyOptions, paymentTypeOptions, handleFocus, lastVariety, setLastVariety, handleAddOption, handleUpdateOption, handleDeleteOption, allCustomers }: any) {
    
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

    return (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
                <SectionCard>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><InfoIcon className="h-5 w-5"/>Basic Info</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <Controller name="date" control={form.control} render={({ field }) => (
                            <div className="space-y-1">
                                <Label className="text-xs">Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                        "w-full justify-start text-left font-normal h-9 text-sm",
                                        !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 z-[51]">
                                    <CalendarComponent
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(date) => field.onChange(date || new Date())}
                                        initialFocus
                                    />
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
                        <div className="space-y-1">
                            <Label htmlFor="bags" className="text-xs">Bags</Label>
                                <InputWithIcon icon={<Boxes className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="bags" type="number" {...form.register('bags')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                         <Controller
                            name="paymentType"
                            control={form.control}
                            render={({ field }) => (
                                <div className="space-y-1">
                                    <Label className="text-xs">Payment Type</Label>
                                    <div className="flex items-center gap-2">
                                        <DynamicCombobox
                                            options={paymentTypeOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))}
                                            value={field.value}
                                            onChange={(val) => form.setValue("paymentType", val)}
                                            onAdd={(newVal) => handleAddOption('paymentTypes', newVal)}
                                            placeholder="Select or add type..."
                                            searchPlaceholder="Search type..."
                                            emptyPlaceholder="No type found."
                                        />
                                        <Button variant="ghost" size="icon" onClick={() => openManagementDialog('paymentType')} className="h-9 w-9 shrink-0"><Settings className="h-4 w-4"/></Button>
                                    </div>
                                    {form.formState.errors.paymentType && <p className="text-xs text-destructive mt-1">{form.formState.errors.paymentType.message}</p>}
                                </div>
                            )}
                        />
                         <div className="space-y-1">
                            <Label htmlFor="bagRate" className="text-xs">Bag Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="bagRate" type="number" {...form.register('bagRate')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                    </CardContent>
                </SectionCard>

                <SectionCard>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><UserCog className="h-5 w-5" />Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="name" className="text-xs">Name</Label>
                            <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Input
                                            id="name"
                                            value={form.watch('name')}
                                            onChange={handleNameChange}
                                            onBlur={(e) => {
                                                handleCapitalizeOnBlur(e);
                                                setTimeout(() => setIsNamePopoverOpen(false), 150); // Delay hiding
                                            }}
                                            autoComplete="off"
                                            className="h-9 text-sm pl-10"
                                            name="name"
                                            onFocus={e => {
                                                if (e.target.value.length > 1 && nameSuggestions.length > 0) {
                                                    setIsNamePopoverOpen(true);
                                                }
                                            }}
                                        />
                                    </InputWithIcon>
                                </PopoverTrigger>
                                <PopoverContent 
                                    className="w-[--radix-popover-trigger-width] p-0" 
                                    align="start" 
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                >
                                    <Command>
                                        <CommandList>
                                            <CommandEmpty>No customers found.</CommandEmpty>
                                            <CommandGroup>
                                                {nameSuggestions.map((s) => (
                                                    <CommandItem
                                                        key={s.id}
                                                        value={`${s.name} ${s.contact}`}
                                                        onSelect={() => handleNameSelect(s)}
                                                    >
                                                        {toTitleCase(s.name)} ({s.contact})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                                <InputWithIcon icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="companyName" control={form.control} render={({ field }) => (
                                    <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="contact" className="text-xs">Contact</Label>
                            <InputWithIcon icon={<Phone className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="contact" control={form.control} render={({ field }) => (
                                    <Input {...field} onBlur={e => handleContactBlur(e.target.value)} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
                                {form.formState.errors.contact && <p className="text-xs text-destructive mt-1">{form.formState.errors.contact.message}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="gstin" className="text-xs">GSTIN</Label>
                            <InputWithIcon icon={<FileText className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="gstin" control={form.control} render={({ field }) => (
                                    <Input {...field} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="address" className="text-xs">Address</Label>
                                <InputWithIcon icon={<Home className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="address" control={form.control} render={({ field }) => (
                                        <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
                        </div>
                    </CardContent>
                </SectionCard>
            </div>
            
            <div className="space-y-6">
                <SectionCard>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><PackageSearch className="h-5 w-5" />Transaction &amp; Weight</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                            <InputWithIcon icon={<Truck className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="vehicleNo" control={form.control} render={({ field }) => (
                                <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
                        </div>
                        <Controller
                            name="variety"
                            control={form.control}
                            render={({ field }) => (
                            <div className="space-y-1">
                                <Label className="text-xs">Variety</Label>
                                <div className="flex items-center gap-2">
                                <DynamicCombobox
                                    options={varietyOptions.map((v: OptionItem) => ({value: v.name, label: v.name}))}
                                    value={field.value}
                                    onChange={(val) => {
                                        form.setValue("variety", val);
                                        setLastVariety(val);
                                    }}
                                    onAdd={(newVal) => handleAddOption('varieties', newVal)}
                                    placeholder="Select or add variety..."
                                    searchPlaceholder="Search variety..."
                                    emptyPlaceholder="No variety found."
                                />
                                 <Button variant="ghost" size="icon" onClick={() => openManagementDialog('variety')} className="h-9 w-9 shrink-0"><Settings className="h-4 w-4"/></Button>
                                 </div>
                                {form.formState.errors.variety && <p className="text-xs text-destructive mt-1">{form.formState.errors.variety.message}</p>}
                            </div>
                            )}
                        />
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
                            <Label htmlFor="bagWeightKg" className="text-xs">Bag Wt. (kg)</Label>
                                <InputWithIcon icon={<Weight className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="bagWeightKg" type="number" {...form.register('bagWeightKg')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
                            </InputWithIcon>
                        </div>
                    </CardContent>
                </SectionCard>
                
                <SectionCard>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><CircleDollarSign className="h-5 w-5" />Financial Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="rate" className="text-xs">Rate</Label>
                                <InputWithIcon icon={<Banknote className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="rate" control={form.control} render={({ field }) => (<Input id="rate" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="cd" className="text-xs">CD %</Label>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="cd" control={form.control} render={({ field }) => (<Input id="cd" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="brokerage" className="text-xs">Brokerage Rate</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="brokerage" control={form.control} render={({ field }) => (<Input id="brokerage" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="kanta" control={form.control} render={({ field }) => (<Input id="kanta" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="flex items-center space-x-2 pt-4">
                            <Controller
                                name="isBrokerageIncluded"
                                control={form.control}
                                render={({ field }) => (
                                    <Switch
                                        id="brokerage-toggle"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                            <Label htmlFor="brokerage-toggle" className="text-sm font-normal">Include Brokerage in Net Amount</Label>
                        </div>
                   </CardContent>
                </SectionCard>
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
});


const CalculatedSummary = memo(function CalculatedSummary({ currentCustomer }: { currentCustomer: Customer }) {
    const summaryFields = useMemo(() => {
        const avgWeightPerBag = (currentCustomer.bags && currentCustomer.bags > 0) ? ((currentCustomer.weight * 100) / currentCustomer.bags).toFixed(2) : '0.00';
        return [
          { label: "Weight", value: `${currentCustomer.weight.toFixed(2)} Qtl` },
          { label: "Net Weight", value: `${currentCustomer.netWeight.toFixed(2)} Qtl`},
          { label: "Avg Wt/Bag", value: `${avgWeightPerBag} kg` },
          { label: "Bag Amount", value: formatCurrency(currentCustomer.bagAmount || 0) },
          { label: "Brokerage Amt", value: formatCurrency(currentCustomer.brokerage || 0) }, 
          { label: "CD Amount", value: formatCurrency(currentCustomer.cd || 0) },
          { label: "Amount", value: formatCurrency(currentCustomer.amount) }, 
          { label: "Net Amount", value: formatCurrency(Number(currentCustomer.netAmount)), isBold: true },
        ];
      }, [currentCustomer]);

    return (
        <Card className="bg-card/60 backdrop-blur-sm border-white/10">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-2">
            {summaryFields.map(item => (
                <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={cn("text-sm font-semibold", item.isBold && "text-primary font-bold text-base")}>{String(item.value)}</p>
                </div>
            ))}
            </CardContent>
        </Card>
    );
});

const CustomerTable = memo(function CustomerTable({ customers, onEdit, onDelete, onShowDetails, onPrint, selectedIds, onSelectionChange }: any) {
    
    const handleSelectAll = (checked: boolean) => {
        const allCustomerIds = customers.map((c: Customer) => c.id);
        onSelectionChange(checked ? new Set(allCustomerIds) : new Set());
    };

    const handleRowSelect = (id: string) => {
        const newSelectedIds = new Set(selectedIds);
        if (newSelectedIds.has(id)) {
            newSelectedIds.delete(id);
        } else {
            newSelectedIds.add(id);
        }
        onSelectionChange(newSelectedIds);
    };

    return (
        <div className="mt-6 min-h-[200px]">
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="px-3 py-2 text-xs w-10">
                                         <Checkbox
                                            checked={selectedIds.size > 0 && selectedIds.size === customers.length}
                                            onCheckedChange={handleSelectAll}
                                            aria-label="Select all rows"
                                        />
                                    </TableHead>
                                    <TableHead className="px-3 py-2 text-xs">SR No.</TableHead>
                                    <TableHead className="px-3 py-2 text-xs">Date</TableHead>
                                    <TableHead className="px-3 py-2 text-xs">Name</TableHead>
                                    <TableHead className="px-3 py-2 text-xs">Variety</TableHead>
                                    <TableHead className="px-3 py-2 text-xs">Net Weight</TableHead>
                                    <TableHead className="text-right px-3 py-2 text-xs">Net Amount</TableHead>
                                    <TableHead className="text-center px-3 py-2 text-xs">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customers.map((customer: Customer) => (
                                    <TableRow key={`${customer.id}-${customer.srNo}`} className="h-12" data-state={selectedIds.has(customer.id) ? 'selected' : ''}>
                                        <TableCell className="px-3 py-1">
                                            <Checkbox
                                                checked={selectedIds.has(customer.id)}
                                                onCheckedChange={() => handleRowSelect(customer.id)}
                                                aria-label={`Select row ${customer.srNo}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono px-3 py-1 text-sm">{customer.srNo}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{format(new Date(customer.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{toTitleCase(customer.name)}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{toTitleCase(customer.variety)}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{Number(customer.netWeight).toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold px-3 py-1 text-sm">{formatCurrency(Number(customer.netAmount))}</TableCell>
                                        <TableCell className="text-center px-3 py-1">
                                            <div className="flex justify-center items-center gap-0">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrint([customer])}>
                                                    <Printer className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onShowDetails(customer)}>
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(customer.id)}>
                                                    <Pen className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <Trash className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete the entry for {toTitleCase(customer.name)} (SR No: {customer.srNo}).
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDelete(customer.id)}>Continue</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm">{String(value)}</p>
        </div>
    </div>
);

const ReceiptPreview = ({ data, settings }: { data: Customer; settings: ReceiptSettings; }) => {
    const { fields } = settings;
    return (
        <div className="text-black bg-white font-sans p-4">
             <style>
                {`
                  @media print {
                    @page {
                      size: A6 landscape;
                      margin: 5mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                    .receipt-container {
                        page-break-after: always;
                    }
                  }
                `}
            </style>
            <div className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2">INVOICE</div>
            
            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-2">
                <div>
                    <div className="bg-red-200 text-center font-bold text-xl p-1 border border-black">
                        {settings.companyName}
                    </div>
                    <div className="border-x border-b border-black p-1 text-sm">
                        <p>{settings.address1}</p>
                        <p>{settings.address2}</p>
                        <p>CONTACT NO:- {settings.contactNo}</p>
                        <p>EMAIL:- {settings.email}</p>
                        <div className="h-10 mt-1 bg-gray-200 flex items-center justify-center">
                            <p className="text-xs text-gray-500">Barcode Placeholder</p>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="text-center font-bold text-xl p-1 border-t border-r border-black">JRM</div>
                    <div className="border-x border-b border-t border-black p-1">
                        <div className="text-center font-bold underline mb-2">CUSTOMER DETAIL</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {fields.date && <tr><td className="font-bold pr-2">DATE</td><td>{format(new Date(data.date), "dd-MMM-yy")}</td></tr>}
                                {fields.name && <tr><td className="font-bold pr-2">NAME</td><td>{toTitleCase(data.name)}</td></tr>}
                                {fields.contact && <tr><td className="font-bold pr-2">CONTACT</td><td>{data.contact}</td></tr>}
                                {fields.address && <tr><td className="font-bold pr-2">ADDRESS</td><td>{toTitleCase(data.address)}</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-sm">
                <thead>
                    <tr className="bg-orange-300 text-black font-bold">
                        {fields.vehicleNo && <td className="border border-black p-1 text-center">VEHICLE</td>}
                        {fields.term && <td className="border border-black p-1 text-center">TERM</td>}
                        {fields.rate && <td className="border border-black p-1 text-center">RATE</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-center">LOAD</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-center">UNLOAD</td>}
                        {fields.weight && <td className="border border-black p-1 text-center">QTY</td>}
                        {fields.amount && <td className="border border-black p-1 text-center">AMOUNT</td>}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        {fields.vehicleNo && <td className="border border-black p-1">{data.vehicleNo.toUpperCase()}</td>}
                        {fields.term && <td className="border border-black p-1 text-center">{data.term}</td>}
                        {fields.rate && <td className="border border-black p-1 text-right">{Number(data.rate).toFixed(2)}</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-right">{Number(data.grossWeight).toFixed(2)}</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-right">{Number(data.teirWeight).toFixed(2)}</td>}
                        {fields.weight && <td className="border border-black p-1 text-right">{Number(data.weight).toFixed(2)}</td>}
                        {fields.amount && <td className="border border-black p-1 text-right">{formatCurrency(Number(data.amount))}</td>}
                    </tr>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}><td className="border border-black p-2 h-6" colSpan={Object.values(fields).filter(v => v).length - 4}></td></tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-between items-end mt-2">
                <div className="text-sm">
                    <p className="mt-8 border-t border-black pt-1">Authorized Sign</p>
                </div>
                <div className="text-sm">
                    <table className="w-full border-collapse">
                        <tbody>
                            {fields.dueDate && <tr><td className="font-bold border border-black p-1">DUE DATE</td><td className="border border-black p-1 text-right">{format(new Date(data.dueDate), "dd-MMM-yy")}</td></tr>}
                            {fields.kartaWeight && <tr><td className="font-bold border border-black p-1">KARTA</td><td className="border border-black p-1 text-right">{Number(data.kartaWeight).toFixed(2)}</td></tr>}
                            {fields.netAmount && <tr><td className="font-bold border border-black p-1">NET AMOUNT</td><td className="border border-black p-1 text-right font-bold">{formatCurrency(Number(data.netAmount))}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ConsolidatedReceiptPreview = ({ data, settings }: { data: ConsolidatedReceiptData; settings: ReceiptSettings }) => {
    const { fields } = settings;
    
    const visibleColumns: (keyof ReceiptFieldSettings)[] = [
        'srNo', 'date', 'variety', 'vehicleNo', 'term', 'rate', 'grossWeight', 
        'teirWeight', 'weight', 'kartaWeight', 'netWeight', 'amount', 'dueDate', 'netAmount'
    ];

    const colspan = visibleColumns.filter(key => fields[key]).length;

    return (
        <div className="text-black bg-white font-sans p-4">
             <style>
                {`
                  @media print {
                    @page {
                      size: A4;
                      margin: 10mm;
                    }
                    body {
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                  }
                `}
            </style>
            <div className="text-center font-bold text-lg border-b-2 border-black pb-1 mb-2">CONSOLIDATED INVOICE</div>
            
            <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-2 mb-2">
                <div>
                    <div className="bg-red-200 text-center font-bold text-xl p-1 border border-black">
                        {settings.companyName}
                    </div>
                    <div className="border-x border-b border-black p-1 text-sm">
                        <p>{settings.address1}</p>
                        <p>{settings.address2}</p>
                        <p>CONTACT NO:- {settings.contactNo}</p>
                        <p>EMAIL:- {settings.email}</p>
                    </div>
                </div>

                <div>
                    <div className="text-center font-bold text-xl p-1 border-t border-r border-black">JRM</div>
                     <div className="border-x border-b border-t border-black p-1">
                        <div className="text-center font-bold underline mb-2">CUSTOMER DETAIL</div>
                        <table className="w-full text-sm">
                            <tbody>
                                <tr><td className="font-bold pr-2">DATE</td><td>{data.date}</td></tr>
                                <tr><td className="font-bold pr-2">NAME</td><td>{toTitleCase(data.supplier.name)}</td></tr>
                                <tr><td className="font-bold pr-2">S/O</td><td>{toTitleCase(data.supplier.so)}</td></tr>
                                <tr><td className="font-bold pr-2">CONTACT</td><td>{data.supplier.contact}</td></tr>
                                <tr><td className="font-bold pr-2">ADDRESS</td><td>{toTitleCase(data.supplier.address)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-sm my-4">
                <thead>
                    <tr className="bg-orange-300 text-black font-bold">
                        {fields.srNo && <td className="border border-black p-1 text-center">SR No.</td>}
                        {fields.date && <td className="border border-black p-1 text-center">Date</td>}
                        {fields.variety && <td className="border border-black p-1 text-center">Variety</td>}
                        {fields.vehicleNo && <td className="border border-black p-1 text-center">Vehicle</td>}
                        {fields.term && <td className="border border-black p-1 text-center">Term</td>}
                        {fields.rate && <td className="border border-black p-1 text-center">Rate</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-center">Gross Wt.</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-center">Teir Wt.</td>}
                        {fields.weight && <td className="border border-black p-1 text-center">Weight</td>}
                        {fields.kartaWeight && <td className="border border-black p-1 text-center">Karta Wt.</td>}
                        {fields.netWeight && <td className="border border-black p-1 text-center">Net Wt.</td>}
                        {fields.amount && <td className="border border-black p-1 text-center">Amount</td>}
                        {fields.dueDate && <td className="border border-black p-1 text-center">Due Date</td>}
                        {fields.netAmount && <td className="border border-black p-1 text-center">Net Amt.</td>}
                    </tr>
                </thead>
                <tbody>
                    {data.entries.map(entry => (
                         <tr key={entry.id}>
                            {fields.srNo && <td className="border border-black p-1 text-center">{entry.srNo}</td>}
                            {fields.date && <td className="border border-black p-1 text-center">{format(new Date(entry.date), "dd-MMM-yy")}</td>}
                            {fields.variety && <td className="border border-black p-1 text-center">{toTitleCase(entry.variety)}</td>}
                            {fields.vehicleNo && <td className="border border-black p-1 text-center">{entry.vehicleNo.toUpperCase()}</td>}
                            {fields.term && <td className="border border-black p-1 text-center">{entry.term}</td>}
                            {fields.rate && <td className="border border-black p-1 text-right">{Number(entry.rate).toFixed(2)}</td>}
                            {fields.grossWeight && <td className="border border-black p-1 text-right">{Number(entry.grossWeight).toFixed(2)}</td>}
                            {fields.teirWeight && <td className="border border-black p-1 text-right">{Number(entry.teirWeight).toFixed(2)}</td>}
                            {fields.weight && <td className="border border-black p-1 text-right">{Number(entry.weight).toFixed(2)}</td>}
                            {fields.kartaWeight && <td className="border border-black p-1 text-right">{Number(entry.kartaWeight).toFixed(2)}</td>}
                            {fields.netWeight && <td className="border border-black p-1 text-right">{Number(entry.netWeight).toFixed(2)}</td>}
                            {fields.amount && <td className="border border-black p-1 text-right">{formatCurrency(Number(entry.amount))}</td>}
                            {fields.dueDate && <td className="border border-black p-1 text-center">{format(new Date(entry.dueDate), "dd-MMM-yy")}</td>}
                            {fields.netAmount && <td className="border border-black p-1 text-right font-semibold">{formatCurrency(Number(entry.netAmount))}</td>}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-gray-200">
                        <td colSpan={colspan -1} className="border border-black p-1 text-right">GRAND TOTAL</td>
                        {fields.netAmount && <td className="border border-black p-1 text-right">{formatCurrency(data.totalAmount)}</td>}
                    </tr>
                </tfoot>
            </table>

            <div className="flex justify-between items-end mt-16">
                <div className="text-sm">
                    <p className="mt-8 border-t border-black pt-1">Authorized Sign</p>
                </div>
            </div>
        </div>
    );
};


const OptionsManagerDialog = ({ isOpen, setIsOpen, type, options, onAdd, onUpdate, onDelete }: any) => {
    const [editingOption, setEditingOption] = useState<{ id: string; name: string } | null>(null);
    const [newOptionName, setNewOptionName] = useState("");
    const { toast } = useToast();

    const title = type === 'variety' ? "Manage Varieties" : "Manage Payment Types";
    const collectionName = type === 'variety' ? 'varieties' : 'paymentTypes';

    const handleSave = () => {
        if (editingOption) {
            onUpdate(collectionName, editingOption.id, editingOption.name);
            toast({ title: "Success", description: "Option updated successfully." });
            setEditingOption(null);
        }
    };
    
    const handleAdd = () => {
        if (newOptionName.trim()) {
            onAdd(collectionName, newOptionName);
            setNewOptionName("");
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>Add, edit, or remove options from the list.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Add new..."
                            value={newOptionName}
                            onChange={(e) => setNewOptionName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button onClick={handleAdd} size="sm">Add</Button>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-60 pr-4">
                        <div className="space-y-2">
                            {options.map((option: OptionItem) => (
                                <div key={option.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                                    {editingOption?.id === option.id ? (
                                        <Input
                                            value={editingOption.name}
                                            onChange={(e) => setEditingOption({ ...editingOption, name: e.target.value })}
                                            autoFocus
                                            onBlur={handleSave}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                        />
                                    ) : (
                                        <span className="flex-grow">{toTitleCase(option.name)}</span>
                                    )}
                                    <div className="flex gap-1">
                                        {editingOption?.id === option.id ? (
                                            <Button size="icon" variant="ghost" onClick={handleSave}><Save className="h-4 w-4 text-green-500" /></Button>
                                        ) : (
                                            <Button size="icon" variant="ghost" onClick={() => setEditingOption({ id: option.id, name: option.name })}><Pen className="h-4 w-4" /></Button>
                                        )}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-red-500" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the option "{toTitleCase(option.name)}".</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDelete(collectionName, option.id)}>Continue</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function CustomerEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [editableInvoiceDetails, setEditableInvoiceDetails] = useState<Partial<Customer>>({});
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [consolidatedReceiptData, setConsolidatedReceiptData] = useState<ConsolidatedReceiptData | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const receiptRef = useRef<HTMLDivElement>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('tax-invoice');

  const [invoiceDetails, setInvoiceDetails] = useState({
    companyGstin: 'YOUR_GSTIN_HERE',
    hsnCode: '1006',
    taxRate: 18,
    isGstIncluded: false,
  });
  
  const [isSameAsBilling, setIsSameAsBilling] = useState(true);


  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isReceiptSettingsOpen, setIsReceiptSettingsOpen] = useState(false);
  const [tempReceiptSettings, setTempReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);
  const [updateAction, setUpdateAction] = useState<((deletePayments: boolean) => void) | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);
  
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchTerm) {
      return safeCustomers;
    }
    const lowercasedFilter = debouncedSearchTerm.toLowerCase();
    return safeCustomers.filter(customer => {
      return (
        customer.name?.toLowerCase().startsWith(lowercasedFilter) ||
        customer.contact?.startsWith(lowercasedFilter) ||
        customer.srNo?.toLowerCase().startsWith(lowercasedFilter)
      );
    });
  }, [safeCustomers, debouncedSearchTerm]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(lastVariety),
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    setIsLoading(true);
    const unsubscribeCustomers = getCustomersRealtime((data: Customer[]) => {
      setCustomers(data);
      if (isInitialLoad.current) {
          const nextSrNum = data.length > 0 ? Math.max(...data.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
          const initialSrNo = formatSrNo(nextSrNum, 'C');
          form.setValue('srNo', initialSrNo);
          setCurrentCustomer(prev => ({ ...prev, srNo: initialSrNo }));
          isInitialLoad.current = false;
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching customers: ", error);
      toast({
        title: "Error",
        description: "Failed to load customer data. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    });

    const unsubscribePayments = getPaymentsRealtime((data: Payment[]) => {
        setPaymentHistory(data);
    }, (error) => {
        console.error("Error fetching payments: ", error);
    });

    const fetchSettings = async () => {
        const settings = await getReceiptSettings();
        if (settings) {
            setReceiptSettings(settings);
            setTempReceiptSettings(settings);
        }
    };
    fetchSettings();


    const unsubVarieties = getOptionsRealtime('varieties', setVarietyOptions, (err) => console.error("Error fetching varieties:", err));
    const unsubPaymentTypes = getOptionsRealtime('paymentTypes', setPaymentTypeOptions, (err) => console.error("Error fetching payment types:", err));

    const savedVariety = localStorage.getItem('lastSelectedVariety');
    if (savedVariety) {
      setLastVariety(savedVariety);
      form.setValue('variety', savedVariety);
    }

    form.setValue('date', new Date());

    return () => {
      unsubscribeCustomers();
      unsubscribePayments();
      unsubVarieties();
      unsubPaymentTypes();
    };
  }, [isClient, form, toast]);
  
  const handleSetLastVariety = (variety: string) => {
    setLastVariety(variety);
    if(isClient) {
        localStorage.setItem('lastSelectedVariety', variety);
    }
  }

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const values = {...form.getValues(), ...data};
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    
    const bagWeightKg = Number(values.bagWeightKg) || 0;
    const bagWeightQuintals = bagWeightKg / 100;
    const netWeight = weight - bagWeightQuintals;
    
    const rate = values.rate || 0;
    const amount = netWeight * rate;
    
    const brokerageRate = Number(values.brokerage) || 0;
    const brokerageAmount = brokerageRate * weight;

    const cdPercentage = Number(values.cd) || 0;
    const cdAmount = (amount * cdPercentage) / 100;
    
    const kanta = Number(values.kanta) || 0;
    
    const bags = Number(values.bags) || 0;
    const bagRate = Number(values.bagRate) || 0;
    const bagAmount = bags * bagRate;

    let originalNetAmount = amount + kanta + bagAmount - cdAmount;
    if (!values.isBrokerageIncluded) {
        originalNetAmount -= brokerageAmount;
    }

    const totalPaidForThisEntry = paymentHistory
        .filter(p => p.paidFor?.some(pf => pf.srNo === values.srNo))
        .reduce((sum, p) => {
            const paidForDetail = p.paidFor?.find(pf => pf.srNo === values.srNo);
            return sum + (paidForDetail?.amount || 0) + (paymentHistory.find(ph => ph.paymentId === p.paymentId)?.cdAmount || 0);
        }, 0);
      
    const netAmount = originalNetAmount - totalPaidForThisEntry;

    setCurrentCustomer(prev => {
        const currentDate = values.date instanceof Date ? values.date : (prev.date ? new Date(prev.date) : new Date());
        return {
            ...prev, ...values,
            date: currentDate.toISOString().split("T")[0],
            dueDate: (values.date ? new Date(values.date) : new Date()).toISOString().split("T")[0],
            weight: parseFloat(weight.toFixed(2)),
            netWeight: parseFloat(netWeight.toFixed(2)),
            amount: parseFloat(amount.toFixed(2)),
            brokerage: parseFloat(brokerageAmount.toFixed(2)),
            cd: parseFloat(cdAmount.toFixed(2)),
            kanta: parseFloat(kanta.toFixed(2)),
            bagAmount: parseFloat(bagAmount.toFixed(2)),
            originalNetAmount: parseFloat(originalNetAmount.toFixed(2)),
            netAmount: parseFloat(netAmount.toFixed(2)),
        }
    });
  }, [form, paymentHistory]);
  
  useEffect(() => {
    const subscription = form.watch((value) => {
        performCalculations(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
  }, [form, performCalculations]);

  const resetFormToState = useCallback((customerState: Customer) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let formDate;
    try {
        formDate = customerState.date ? new Date(customerState.date) : today;
        if (isNaN(formDate.getTime())) formDate = today;
    } catch {
        formDate = today;
    }
    const formValues: FormValues = {
      srNo: customerState.srNo, date: formDate, bags: customerState.bags || 0,
      name: customerState.name, companyName: customerState.companyName || '', address: customerState.address,
      contact: customerState.contact, gstin: customerState.gstin || '', vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, cd: Number(customerState.cd) || 0,
      brokerage: Number(customerState.brokerage) || 0, kanta: Number(customerState.kanta) || 0,
      paymentType: customerState.paymentType || 'Full',
      isBrokerageIncluded: customerState.isBrokerageIncluded || false,
      bagWeightKg: customerState.bagWeightKg || 0,
      bagRate: customerState.bagRate || 0,
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
    const newState = getInitialFormState(lastVariety);
    newState.srNo = formatSrNo(nextSrNum, 'C');
    const today = new Date();
    today.setHours(0,0,0,0);
    newState.date = today.toISOString().split('T')[0];
    newState.dueDate = today.toISOString().split('T')[0];
    resetFormToState(newState);
  }, [safeCustomers, lastVariety, resetFormToState]);

  const handleEdit = (id: string) => {
    const customerToEdit = safeCustomers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
      resetFormToState(customerToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSrNoBlur = (srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo), 'C');
        form.setValue('srNo', formattedSrNo);
    }
    const foundCustomer = safeCustomers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
    } else {
        setIsEditing(false);
        const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
        const currentState = {...getInitialFormState(lastVariety), srNo: formattedSrNo || formatSrNo(nextSrNum, 'C') };
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10) {
      const foundCustomer = customers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentCustomer.id) {
        form.setValue('name', foundCustomer.name);
        form.setValue('companyName', foundCustomer.companyName || '');
        form.setValue('address', foundCustomer.address);
        form.setValue('gstin', foundCustomer.gstin || '');
        toast({ title: "Customer Found", description: `Details for ${toTitleCase(foundCustomer.name)} have been auto-filled.` });
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === 'BUTTON' || activeElement.closest('[role="dialog"]') || activeElement.closest('[role="menu"]') || activeElement.closest('[cmdk-root]')) {
        return;
      }
      const formEl = e.currentTarget;
      const formElements = Array.from(formEl.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
      const currentElementIndex = formElements.findIndex(el => el === document.activeElement);
      if (currentElementIndex > -1 && currentElementIndex < formElements.length - 1) {
        e.preventDefault();
        formElements[currentElementIndex + 1].focus();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      toast({ title: "Error", description: "Cannot delete entry without a valid ID.", variant: "destructive" });
      return;
    }
    try {
      await deleteCustomer(id);
      await deletePaymentsForSrNo(currentCustomer.srNo);
      toast({ title: "Success", description: "Entry and associated payments deleted successfully." });
      if (currentCustomer.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting customer and payments: ", error);
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const executeSubmit = async (values: FormValues, deletePayments: boolean = false, callback?: (savedEntry: Customer) => void) => {
    const completeEntry: Customer = {
      ...currentCustomer,
      ...values,
      date: (values.date instanceof Date ? values.date : new Date(values.date)).toISOString().split("T")[0],
      dueDate: (values.date instanceof Date ? values.date : new Date(values.date)).toISOString().split("T")[0],
      name: toTitleCase(values.name), 
      companyName: toTitleCase(values.companyName || ''),
      so: '', 
      kartaPercentage: 0,
      labouryRate: 0, 
      address: toTitleCase(values.address), 
      vehicleNo: toTitleCase(values.vehicleNo), 
      variety: toTitleCase(values.variety),
      customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
      term: '0',
    };

    try {
        if (isEditing && completeEntry.id) {
            if (deletePayments) {
                await deletePaymentsForSrNo(completeEntry.srNo);
                const updatedEntry = { ...completeEntry, netAmount: completeEntry.originalNetAmount };
                toast({ title: "Payments Deleted", description: "Associated payments have been removed." });
                const success = await updateCustomer(updatedEntry.id, updatedEntry);
                 if (success) {
                    toast({ title: "Success", description: "Entry updated successfully." });
                    if (callback) callback(updatedEntry); else handleNew();
                } else {
                    toast({ title: "Error", description: "Customer not found. Cannot update.", variant: "destructive" });
                }
            } else {
                 const success = await updateCustomer(completeEntry.id, completeEntry);
                 if (success) {
                    toast({ title: "Success", description: "Entry updated successfully." });
                    if (callback) callback(completeEntry); else handleNew();
                } else {
                    toast({ title: "Error", description: "Customer not found. Cannot update.", variant: "destructive" });
                }
            }
        } else {
            const newEntry = await addCustomer(completeEntry);
            toast({ title: "Success", description: "New entry saved successfully." });
            if (callback) callback(newEntry);
            else handleNew();
        }
    } catch (error) {
        console.error("Error saving customer:", error);
        toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" });
    }
  };

  const onSubmit = async (values: FormValues, callback?: (savedEntry: Customer) => void) => {
    if (isEditing) {
        const hasPayments = paymentHistory.some(p => p.paidFor?.some(pf => pf.srNo === currentCustomer.srNo));
        if (hasPayments) {
            setUpdateAction(() => (deletePayments: boolean) => executeSubmit(values, deletePayments, callback));
            setIsUpdateConfirmOpen(true);
            return;
        }
    }
    executeSubmit(values, false, callback);
  };

  const handleSaveAndPrint = async (docType: DocumentType) => {
    setDocumentType(docType);
    const isValid = await form.trigger();
    if (isValid) {
      onSubmit(form.getValues(), (savedEntry) => {
        setDetailsCustomer(savedEntry);
        setEditableInvoiceDetails(savedEntry);
        setIsSameAsBilling(true);
        setIsDocumentPreviewOpen(true);
        handleNew();
      });
    } else {
      toast({
        title: "Invalid Form",
        description: "Please check the form for errors before saving.",
        variant: "destructive"
      });
    }
  };
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
    setEditableInvoiceDetails(customer);
    setIsSameAsBilling(true);
    setDocumentType('tax-invoice'); // Default to tax-invoice for details view
    setIsDocumentPreviewOpen(true);
  }

  const handleCapitalizeOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof FormValues;
    const value = e.target.value;
    form.setValue(field, toTitleCase(value) as any);
  };
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.select();
    }
  };

  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsCustomer) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsCustomer?.srNo)
    );
  }, [detailsCustomer, paymentHistory]);

  const handlePrint = (entriesToPrint: Customer[]) => {
    if (!entriesToPrint || entriesToPrint.length === 0) {
        toast({
            title: "No Selection",
            description: "Please select one or more entries to print.",
            variant: "destructive",
        });
        return;
    }

    if (entriesToPrint.length === 1) {
        setReceiptsToPrint(entriesToPrint);
        setConsolidatedReceiptData(null);
    } else {
        const firstCustomerId = entriesToPrint[0].customerId;
        const allSameCustomer = entriesToPrint.every(e => e.customerId === firstCustomerId);

        if (!allSameCustomer) {
            toast({
                title: "Multiple Customers Selected",
                description: "Consolidated receipts can only be printed for a single customer at a time.",
                variant: "destructive",
            });
            return;
        }
        
        const customer = entriesToPrint[0];
        const totalAmount = entriesToPrint.reduce((sum, entry) => sum + (Number(entry.netAmount) || 0), 0);
        
        setConsolidatedReceiptData({
            supplier: { // Using supplier key for consistency with component
                name: customer.name,
                so: customer.so,
                address: customer.address,
                contact: customer.contact,
            },
            entries: entriesToPrint,
            totalAmount: totalAmount,
            date: format(new Date(), "dd-MMM-yy"),
        });
        setReceiptsToPrint([]);
    }
  };
  
  const handleActualPrint = (id: string) => {
    const receiptNode = document.getElementById(id);
    if (!receiptNode) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.open();
    iframeDoc.write('<html><head><title>Print Receipt</title>');

    Array.from(document.styleSheets).forEach(styleSheet => {
        try {
            const style = iframeDoc.createElement('style');
            const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
            style.appendChild(iframeDoc.createTextNode(cssText));
            style.appendChild(iframeDoc.createTextNode('body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-container { page-break-after: always; }'));
            iframeDoc.head.appendChild(style);
        } catch (e) {
            console.warn("Could not copy stylesheet:", e);
        }
    });

    iframeDoc.write('</head><body></body></html>');
    iframeDoc.body.innerHTML = receiptNode.innerHTML;
    iframeDoc.close();

    setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
    }, 500);
  };

  const handleAddOption = async (collectionName: string, name: string) => {
    const titleCasedName = toTitleCase(name);
    try {
        await addOption(collectionName, { name: titleCasedName });
        toast({ title: "Success", description: `"${titleCasedName}" has been added.` });
    } catch (error) {
        console.error(`Error adding to ${collectionName}:`, error);
        toast({ title: "Error", description: "Failed to add option.", variant: "destructive" });
    }
  };

  const handleUpdateOption = async (collectionName: string, id: string, name: string) => {
    const titleCasedName = toTitleCase(name);
    try {
        await updateOption(collectionName, id, { name: titleCasedName });
        toast({ title: "Success", description: "Option has been updated." });
    } catch (error) {
        console.error(`Error updating ${collectionName}:`, error);
        toast({ title: "Error", description: "Failed to update option.", variant: "destructive" });
    }
  };

  const handleDeleteOption = async (collectionName: string, id: string) => {
     try {
        await deleteOption(collectionName, id);
        toast({ title: "Success", description: "Option has been deleted." });
    } catch (error) {
        console.error(`Error deleting ${collectionName}:`, error);
        toast({ title: "Error", description: "Failed to delete option.", variant: "destructive" });
    }
  };

  const handleOpenReceiptSettings = () => {
    setTempReceiptSettings(receiptSettings);
    setIsReceiptSettingsOpen(true);
  };

  const handleSaveReceiptSettings = async () => {
      if (tempReceiptSettings) {
          try {
              await updateReceiptSettings(tempReceiptSettings);
              setReceiptSettings(tempReceiptSettings);
              setIsReceiptSettingsOpen(false);
              toast({ title: "Success", description: "Receipt details saved successfully." });
          } catch (error) {
              console.error("Error saving receipt settings:", error);
              toast({ title: "Error", description: "Failed to save details.", variant: "destructive" });
          }
      }
  };

  const handleFieldVisibilityChange = (field: keyof ReceiptFieldSettings, checked: boolean) => {
    if (tempReceiptSettings) {
      setTempReceiptSettings({
        ...tempReceiptSettings,
        fields: {
          ...tempReceiptSettings.fields,
          [field]: checked,
        },
      });
    }
  };

  const renderDocument = () => {
      if (!detailsCustomer || !receiptSettings) return null;
      
      const finalCustomerData: Customer = {
          ...detailsCustomer,
          ...editableInvoiceDetails,
          gstin: editableInvoiceDetails.gstin,
      };

      if (!isSameAsBilling) {
        finalCustomerData.shippingName = editableInvoiceDetails.shippingName;
        finalCustomerData.shippingCompanyName = editableInvoiceDetails.shippingCompanyName;
        finalCustomerData.shippingAddress = editableInvoiceDetails.shippingAddress;
        finalCustomerData.shippingContact = editableInvoiceDetails.shippingContact;
        finalCustomerData.shippingGstin = editableInvoiceDetails.shippingGstin;
      }


      switch(documentType) {
          case 'tax-invoice':
              return <TaxInvoice customer={finalCustomerData} settings={receiptSettings} invoiceDetails={invoiceDetails} />;
          case 'bill-of-supply':
              return <BillOfSupply customer={finalCustomerData} settings={receiptSettings} />;
          case 'challan':
              return <Challan customer={finalCustomerData} settings={receiptSettings} />;
          default:
              return null;
      }
  };
  
  const handleEditableDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setEditableInvoiceDetails(prev => ({...prev, [name]: value}));
  };

  if (!isClient) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]">
        <p className="text-muted-foreground flex items-center"><Hourglass className="w-5 h-5 mr-2 animate-spin"/>Loading data...</p>
      </div>
    );
  }

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit((values) => onSubmit(values))} onKeyDown={handleKeyDown} className="space-y-4">
            <CustomerForm 
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleCapitalizeOnBlur={handleCapitalizeOnBlur}
                handleContactBlur={handleContactBlur}
                varietyOptions={varietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                handleFocus={handleFocus}
                lastVariety={lastVariety}
                setLastVariety={handleSetLastVariety}
                handleAddOption={handleAddOption}
                handleUpdateOption={handleUpdateOption}
                handleDeleteOption={handleDeleteOption}
                allCustomers={safeCustomers}
            />
            
            <CalculatedSummary currentCustomer={currentCustomer} />

            <div className="flex justify-start items-center space-x-2 pt-4">
              <Button type="submit" size="sm">
                {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
              </Button>
               <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4"/> Save & Print <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleSaveAndPrint('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSaveAndPrint('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSaveAndPrint('challan')}>Challan</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              <Button type="button" variant="outline" onClick={handleNew} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
              </Button>
               <div className="flex-grow"></div>
              <Button type="button" variant="ghost" size="icon" onClick={handleOpenReceiptSettings}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
        </form>
      </FormProvider>      
      
      <div className="flex justify-between items-center mt-6 mb-2">
        <div className="relative w-full max-w-sm">
            <InputWithIcon icon={<Search className="h-4 w-4 text-muted-foreground" />}>
                <Input
                    placeholder="Search by SR No, Name, or Contact..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 pl-10"
                />
            </InputWithIcon>
        </div>
        <Button onClick={() => handlePrint(customers.filter(c => selectedCustomerIds.has(c.id)))} disabled={selectedCustomerIds.size === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print Selected ({selectedCustomerIds.size})
        </Button>
      </div>

      <CustomerTable 
        customers={filteredCustomers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails} 
        onPrint={handlePrint}
        selectedIds={selectedCustomerIds}
        onSelectionChange={setSelectedCustomerIds}
      />
        
     <Dialog open={isDocumentPreviewOpen} onOpenChange={setIsDocumentPreviewOpen}>
            <DialogContent className="max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6 p-0">
                <div className="lg:col-span-2 order-2 lg:order-1">
                    <ScrollArea className="max-h-[90vh]">
                        <div id="document-content" className="p-4 sm:p-6">
                           {renderDocument()}
                        </div>
                    </ScrollArea>
                </div>
                <div className="lg:col-span-1 order-1 lg:order-2 bg-muted/30 p-4 sm:p-6 border-l">
                     <DialogHeader className="mb-4">
                         <DialogTitle>Edit Invoice Details</DialogTitle>
                         <DialogDescription>Make on-the-fly changes before printing.</DialogDescription>
                     </DialogHeader>
                    <ScrollArea className="max-h-[calc(90vh-120px)] pr-3">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="p-3"><CardTitle className="text-base">Tax &amp; Invoice Info</CardTitle></CardHeader>
                            <CardContent className="p-3 space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="companyGstin" className="text-xs">Your GSTIN</Label>
                                    <Input id="companyGstin" value={invoiceDetails.companyGstin} onChange={(e) => setInvoiceDetails({...invoiceDetails, companyGstin: e.target.value.toUpperCase()})} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="hsnCode" className="text-xs">HSN/SAC Code</Label>
                                    <Input id="hsnCode" value={invoiceDetails.hsnCode} onChange={(e) => setInvoiceDetails({...invoiceDetails, hsnCode: e.target.value})} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="taxRate" className="text-xs">Tax Rate (%)</Label>
                                    <Input id="taxRate" type="number" value={invoiceDetails.taxRate} onChange={(e) => setInvoiceDetails({...invoiceDetails, taxRate: Number(e.target.value)})} className="h-8 text-xs" />
                                </div>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch
                                        id="gst-included-toggle"
                                        checked={invoiceDetails.isGstIncluded}
                                        onCheckedChange={(checked) => setInvoiceDetails({...invoiceDetails, isGstIncluded: checked})}
                                    />
                                    <Label htmlFor="gst-included-toggle" className="text-xs font-normal">Is GST Included in Rate?</Label>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-3"><CardTitle className="text-base">Bill To Details</CardTitle></CardHeader>
                             <CardContent className="p-3 space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-name" className="text-xs">Customer Name</Label>
                                    <Input id="edit-name" name="name" value={editableInvoiceDetails.name || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-companyName" className="text-xs">Company Name</Label>
                                    <Input id="edit-companyName" name="companyName" value={editableInvoiceDetails.companyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-contact" className="text-xs">Contact</Label>
                                    <Input id="edit-contact" name="contact" value={editableInvoiceDetails.contact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-address" className="text-xs">Address</Label>
                                    <Input id="edit-address" name="address" value={editableInvoiceDetails.address || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-gstin" className="text-xs">Customer's GSTIN</Label>
                                    <Input id="edit-gstin" name="gstin" value={editableInvoiceDetails.gstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                </div>
                             </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-3 flex items-center justify-between">
                                <CardTitle className="text-base">Ship To Details</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Switch id="same-as-billing" checked={isSameAsBilling} onCheckedChange={setIsSameAsBilling} />
                                    <Label htmlFor="same-as-billing" className="text-xs font-normal">Same as Bill To</Label>
                                </div>
                             </CardHeader>
                             {!isSameAsBilling && (
                                 <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="shippingName" className="text-xs">Name</Label>
                                        <Input id="shippingName" name="shippingName" value={editableInvoiceDetails.shippingName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="shippingCompanyName" className="text-xs">Company Name</Label>
                                        <Input id="shippingCompanyName" name="shippingCompanyName" value={editableInvoiceDetails.shippingCompanyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="shippingContact" className="text-xs">Contact</Label>
                                        <Input id="shippingContact" name="shippingContact" value={editableInvoiceDetails.shippingContact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="shippingAddress" className="text-xs">Address</Label>
                                        <Input id="shippingAddress" name="shippingAddress" value={editableInvoiceDetails.shippingAddress || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="shippingGstin" className="text-xs">GSTIN</Label>
                                        <Input id="shippingGstin" name="shippingGstin" value={editableInvoiceDetails.shippingGstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                 </CardContent>
                             )}
                        </Card>
                    </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 flex-row justify-end gap-2">
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                        <Button onClick={() => handleActualPrint('document-content')}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
      
      <Dialog open={receiptsToPrint.length > 0 || !!consolidatedReceiptData} onOpenChange={(open) => {
          if (!open) {
              setReceiptsToPrint([]);
              setConsolidatedReceiptData(null);
          }
      }}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader className="p-4 pb-0">
                <DialogTitle className="sr-only">Print Receipts</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
                <div id="receipt-content">
                    {receiptsToPrint.map((receiptData, index) => (
                        <div key={index} className="receipt-container">
                            {receiptSettings && <ReceiptPreview data={receiptData} settings={receiptSettings}/>}
                        </div>
                    ))}
                    {consolidatedReceiptData && receiptSettings && (
                        <div className="receipt-container">
                            <ConsolidatedReceiptPreview data={consolidatedReceiptData} settings={receiptSettings} />
                        </div>
                    )}
                </div>
            </ScrollArea>
             <DialogFooter className="p-4 pt-0">
                <Button variant="outline" onClick={() => handleActualPrint('receipt-content')}>
                    <Printer className="mr-2 h-4 w-4" /> Print All
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={isReceiptSettingsOpen} onOpenChange={setIsReceiptSettingsOpen}>
          <DialogContent className="max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Edit Receipt Details</DialogTitle>
                  <DialogDescription>Update the company details and visible fields on the printed receipt.</DialogDescription>
              </DialogHeader>
              {tempReceiptSettings && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 py-4">
                      <div className="space-y-4">
                          <h3 className="font-semibold text-lg border-b pb-2">Company Information</h3>
                          <div className="space-y-1"><Label>Company Name</Label><Input value={tempReceiptSettings.companyName} onChange={(e) => setTempReceiptSettings({...tempReceiptSettings, companyName: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Address 1</Label><Input value={tempReceiptSettings.address1} onChange={(e) => setTempReceiptSettings({...tempReceiptSettings, address1: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Address 2</Label><Input value={tempReceiptSettings.address2} onChange={(e) => setTempReceiptSettings({...tempReceiptSettings, address2: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Contact No.</Label><Input value={tempReceiptSettings.contactNo} onChange={(e) => setTempReceiptSettings({...tempReceiptSettings, contactNo: e.target.value})} /></div>
                          <div className="space-y-1"><Label>Email</Label><Input value={tempReceiptSettings.email} onChange={(e) => setTempReceiptSettings({...tempReceiptSettings, email: e.target.value})} /></div>
                      </div>
                      <div className="space-y-4">
                          <h3 className="font-semibold text-lg border-b pb-2">Visible Fields</h3>
                          <ScrollArea className="h-64 pr-4">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {Object.keys(tempReceiptSettings.fields).map((key) => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`field-${key}`}
                                            checked={tempReceiptSettings.fields[key as keyof ReceiptFieldSettings]}
                                            onCheckedChange={(checked) => handleFieldVisibilityChange(key as keyof ReceiptFieldSettings, !!checked)}
                                        />
                                        <Label htmlFor={`field-${key}`} className="font-normal text-sm">{toTitleCase(key.replace(/([A-Z])/g, ' $1'))}</Label>
                                    </div>
                                ))}
                            </div>
                          </ScrollArea>
                      </div>
                  </div>
              )}
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsReceiptSettingsOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveReceiptSettings}>Save Changes</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      <AlertDialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Update Paid Entry?</AlertDialogTitle>
                <AlertDialogDescription>
                    This receipt already has payments associated with it. How would you like to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AlertDialogAction onClick={() => {
                    updateAction?.(true); // Yes, delete payments
                    setIsUpdateConfirmOpen(false);
                }} className="bg-destructive hover:bg-destructive/90">
                    Yes, Delete Payments
                </AlertDialogAction>
                <AlertDialogAction onClick={() => {
                    updateAction?.(false); // No, continue update
                    setIsUpdateConfirmOpen(false);
                }}>
                    Continue Update
                </AlertDialogAction>
                 <AlertDialogCancel className="sm:col-span-2">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

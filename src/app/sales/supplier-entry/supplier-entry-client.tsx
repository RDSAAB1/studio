
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


import { Pen, PlusCircle, Save, Trash, Info, Settings, Plus, ChevronsUpDown, Check, Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Milestone, UserSquare, Wallet, ArrowRight, LayoutGrid, LayoutList, Rows3, StepForward, X, Server, Hourglass, InfoIcon, UserCog, PackageSearch, CircleDollarSign, Receipt, Printer } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator";
import { addSupplier, deleteSupplier, getSuppliersRealtime, updateSupplier, getPaymentsRealtime, getOptionsRealtime, addOption, updateOption, deleteOption, getReceiptSettings, updateReceiptSettings } from "@/lib/firestore";
import { formatCurrency } from "@/lib/utils";

const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string()
      .length(10, "Contact number must be exactly 10 digits.")
      .regex(/^\d+$/, "Contact number must only contain digits."),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    kartaPercentage: z.coerce.number().min(0),
    labouryRate: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0), // Assuming kanta is a fixed cost per entry, not related to weight
    otherCharges: z.coerce.number().min(0), // Added for flexibility
    paymentType: z.string().min(1, "Payment type is required")
});

type FormValues = z.infer<typeof formSchema>;
type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';

const getInitialFormState = (lastVariety?: string): Customer => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: 'S----', date: today.toISOString().split('T')[0], term: '0', dueDate: today.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 2, labouryAmount: 0, kanta: 50, otherCharges: 0, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', searchValue: ''
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

const SupplierForm = memo(function SupplierForm({ form, handleSrNoBlur, handleCapitalizeOnBlur, handleContactBlur, varietyOptions, paymentTypeOptions, handleFocus, lastVariety, setLastVariety, handleAddOption, handleUpdateOption, handleDeleteOption, allSuppliers }: any) {
    
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
                s.name.toLowerCase().includes(value.toLowerCase()) || s.contact.includes(value)
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
                            <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                                <InputWithIcon icon={<Hourglass className="h-4 w-4 text-muted-foreground" />}>
                                <Input id="term" type="number" {...form.register('term')} onFocus={handleFocus} className="h-9 text-sm pl-10" />
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
                    </CardContent>
                </SectionCard>

                <SectionCard>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><UserCog className="h-5 w-5" />Supplier Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="name" className="text-xs">Name</Label>
                             <Popover open={isNamePopoverOpen} onOpenChange={setIsNamePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                        <Input 
                                            value={form.watch('name')} 
                                            onChange={handleNameChange}
                                            onBlur={handleCapitalizeOnBlur}
                                            autoComplete="off"
                                            className="h-9 text-sm pl-10"
                                            name="name"
                                        />
                                    </InputWithIcon>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandList>
                                            <CommandEmpty>No suppliers found.</CommandEmpty>
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
                            <Label htmlFor="so" className="text-xs">S/O</Label>
                                <InputWithIcon icon={<UserSquare className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="so" control={form.control} render={({ field }) => (
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
                            <Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label>
                                <InputWithIcon icon={<Percent className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<Input id="kartaPercentage" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="labouryRate" className="text-xs">Laboury</Label>
                                <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="labouryRate" control={form.control} render={({ field }) => (<Input id="labouryRate" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="kanta" className="text-xs">Kanta</Label>
                                <InputWithIcon icon={<Landmark className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="kanta" control={form.control} render={({ field }) => (<Input id="kanta" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="otherCharges" className="text-xs">Other Charges</Label>
                                <InputWithIcon icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="otherCharges" control={form.control} render={({ field }) => (<Input id="otherCharges" type="number" {...field} onFocus={handleFocus} className="h-9 text-sm pl-10" />)} />
                            </InputWithIcon>
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
        const dueDate = currentCustomer.dueDate ? format(new Date(currentCustomer.dueDate), "PPP") : '-';
        return [
          { label: "Due Date", value: dueDate }, { label: "Weight", value: currentCustomer.weight },
          { label: "Karta Weight", value: currentCustomer.kartaWeight }, { label: "Karta Amount", value: formatCurrency(currentCustomer.kartaAmount) },
          { label: "Net Weight", value: currentCustomer.netWeight }, { label: "Laboury Amount", value: formatCurrency(currentCustomer.labouryAmount) },
          { label: "Amount", value: formatCurrency(currentCustomer.amount) }, { label: "Net Amount", value: formatCurrency(currentCustomer.netAmount), isBold: true },
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

const SupplierTable = memo(function SupplierTable({ customers, onEdit, onDelete, onShowDetails, onPrint, selectedIds, onSelectionChange }: any) {
    
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
                                    <TableRow key={customer.id} className="h-12" data-state={selectedIds.has(customer.id) ? 'selected' : ''}>
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
                                        <TableCell className="px-3 py-1 text-sm">{customer.netWeight.toFixed(2)}</TableCell>
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
                        {fields.rate && <td className="border border-black p-1 text-right">{data.rate.toFixed(2)}</td>}
                        {fields.grossWeight && <td className="border border-black p-1 text-right">{data.grossWeight.toFixed(2)}</td>}
                        {fields.teirWeight && <td className="border border-black p-1 text-right">{data.teirWeight.toFixed(2)}</td>}
                        {fields.weight && <td className="border border-black p-1 text-right">{data.weight.toFixed(2)}</td>}
                        {fields.amount && <td className="border border-black p-1 text-right">{formatCurrency(data.amount)}</td>}
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
                            {fields.kartaWeight && <tr><td className="font-bold border border-black p-1">KARTA</td><td className="border border-black p-1 text-right">{data.kartaWeight.toFixed(2)}</td></tr>}
                            {fields.netAmount && <tr><td className="font-bold border border-black p-1">NET AMOUNT</td><td className="border border-black p-1 text-right font-bold">{formatCurrency(data.netAmount)}</td></tr>}
                        </tbody>
                    </table>
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


export default function SupplierEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState());
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const receiptRef = useRef<HTMLDivElement>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');


  const [varietyOptions, setVarietyOptions] = useState<OptionItem[]>([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<OptionItem[]>([]);
  const [lastVariety, setLastVariety] = useState<string>('');
  const isInitialLoad = useRef(true);

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [isReceiptSettingsOpen, setIsReceiptSettingsOpen] = useState(false);
  const [tempReceiptSettings, setTempReceiptSettings] = useState<ReceiptSettings | null>(null);

  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);

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
    const unsubscribeSuppliers = getSuppliersRealtime((data: Customer[]) => {
      setCustomers(data);
      if (isInitialLoad.current) {
          const nextSrNum = data.length > 0 ? Math.max(...data.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
          const initialSrNo = formatSrNo(nextSrNum);
          form.setValue('srNo', initialSrNo);
          setCurrentCustomer(prev => ({ ...prev, srNo: initialSrNo }));
          isInitialLoad.current = false;
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching suppliers: ", error);
      toast({
        title: "Error",
        description: "Failed to load supplier data. Please try again.",
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
      unsubscribeSuppliers();
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
    const date = values.date;
    const termDays = Number(values.term) || 0;
    const newDueDate = new Date(date);
    newDueDate.setDate(newDueDate.getDate() + termDays);
    const grossWeight = values.grossWeight || 0;
    const teirWeight = values.teirWeight || 0;
    const weight = grossWeight - teirWeight;
    const kartaPercentage = values.kartaPercentage || 0;
    const rate = values.rate || 0;
    const kartaWeight = weight * (kartaPercentage / 100);
    const kartaAmount = kartaWeight * rate;
    const netWeight = weight - kartaWeight;
    const amount = netWeight * rate;
    const labouryRate = values.labouryRate || 0;
    const labouryAmount = weight * labouryRate;
    const kanta = values.kanta || 0;
    const otherCharges = values.otherCharges || 0;
    const netAmount = amount - labouryAmount - kanta - kartaAmount - otherCharges;
    setCurrentCustomer(prev => ({
      ...prev, ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : prev.date,
      term: String(values.term), dueDate: newDueDate.toISOString().split("T")[0],
      weight: parseFloat(weight.toFixed(2)), kartaWeight: parseFloat(kartaWeight.toFixed(2)),
      kartaAmount: parseFloat(kartaAmount.toFixed(2)), netWeight: parseFloat(netWeight.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)), labouryAmount: parseFloat(labouryAmount.toFixed(2)),
      kanta: parseFloat(kanta.toFixed(2)), otherCharges: parseFloat(otherCharges.toFixed(2)), netAmount: parseFloat(netAmount.toFixed(2)),
      originalNetAmount: parseFloat(netAmount.toFixed(2)),
    }));
  }, [form]);
  
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
      srNo: customerState.srNo, date: formDate, term: Number(customerState.term) || 0,
      name: customerState.name, so: customerState.so, address: customerState.address,
      contact: customerState.contact, vehicleNo: customerState.vehicleNo, variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0, teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0, kartaPercentage: customerState.kartaPercentage || 1,
      labouryRate: customerState.labouryRate || 2, kanta: customerState.kanta || 50,
      otherCharges: customerState.otherCharges || 0,
      paymentType: customerState.paymentType || 'Full',
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }, [form, performCalculations]);

  const handleNew = useCallback(() => {
    setIsEditing(false);
    const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
    const newState = getInitialFormState(lastVariety);
    newState.srNo = formatSrNo(nextSrNum);
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
      setCurrentCustomer(customerToEdit);
      resetFormToState(customerToEdit);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSrNoBlur = (srNoValue: string) => {
    let formattedSrNo = srNoValue.trim();
    if (formattedSrNo && !isNaN(parseInt(formattedSrNo)) && isFinite(Number(formattedSrNo))) {
        formattedSrNo = formatSrNo(parseInt(formattedSrNo));
        form.setValue('srNo', formattedSrNo);
    }
    const foundCustomer = safeCustomers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        setCurrentCustomer(foundCustomer);
        resetFormToState(foundCustomer);
    } else {
        setIsEditing(false);
        const nextSrNum = safeCustomers.length > 0 ? Math.max(...safeCustomers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
        const currentState = {...getInitialFormState(lastVariety), srNo: formattedSrNo || formatSrNo(nextSrNum) };
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10) {
      const foundCustomer = customers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentCustomer.id) {
        form.setValue('name', foundCustomer.name);
        form.setValue('so', foundCustomer.so);
        form.setValue('address', foundCustomer.address);
        toast({ title: "Supplier Found", description: `Details for ${toTitleCase(foundCustomer.name)} have been auto-filled.` });
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
    try {
      await deleteSupplier(id);
      toast({ title: "Success", description: "Entry deleted successfully." });
      if (currentCustomer.id === id) {
        handleNew();
      }
    } catch (error) {
      console.error("Error deleting supplier: ", error);
      toast({
        title: "Error",
        description: "Failed to delete entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (values: FormValues) => {
    const completeEntry: Customer = {
      ...currentCustomer, ...values,
      name: toTitleCase(values.name), so: toTitleCase(values.so),
      weight: currentCustomer.weight, kartaWeight: currentCustomer.kartaWeight, kartaAmount: currentCustomer.kartaAmount, netWeight: currentCustomer.netWeight, amount: currentCustomer.amount, labouryAmount: currentCustomer.labouryAmount, kanta: currentCustomer.kanta, otherCharges: currentCustomer.otherCharges, netAmount: currentCustomer.netAmount, originalNetAmount: currentCustomer.originalNetAmount,
      address: toTitleCase(values.address), vehicleNo: toTitleCase(values.vehicleNo),
      variety: toTitleCase(values.variety), date: values.date.toISOString().split("T")[0],
      term: String(values.term), customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
    };
    if (isEditing && completeEntry.id) {
      updateSupplier(completeEntry.id, completeEntry)
        .then((success) => {
          if (success) {
            toast({ title: "Success", description: "Entry updated successfully." });
            handleNew();
          } else {
            toast({ title: "Error", description: "Supplier not found. Cannot update.", variant: "destructive" });
          }
        }).catch((error) => {
             console.error("Error updating supplier: ", error);
             toast({ title: "Error", description: "Failed to update entry.", variant: "destructive" });
           });
    } else {
      const { id, ...newEntryData } = completeEntry;
      addSupplier(newEntryData)
        .then(() => {
          toast({ title: "Success", description: "New entry saved successfully." });
          handleNew();
        })
        .catch((error) => {
          console.error("Error adding supplier: ", error);
          toast({ title: "Error", description: "Failed to save entry.", variant: "destructive" });
        });
    }
  };
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
  }

  const handleCapitalizeOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof FormValues;
    const value = e.target.value;
    form.setValue(field, toTitleCase(value));
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
    setReceiptsToPrint(entriesToPrint);
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
        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
            <SupplierForm 
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
                allSuppliers={safeCustomers}
            />
            
            <CalculatedSummary currentCustomer={currentCustomer} />

            <div className="flex justify-start space-x-4 pt-4">
              <Button type="submit" size="sm">
                {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleNew} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={handleOpenReceiptSettings}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
        </form>
      </FormProvider>      
      
      <div className="flex justify-end mt-4">
        <Button onClick={() => handlePrint(customers.filter(c => selectedSupplierIds.has(c.id)))} disabled={selectedSupplierIds.size === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print Selected ({selectedSupplierIds.size})
        </Button>
      </div>

      <SupplierTable 
        customers={customers} 
        onEdit={handleEdit} 
        onDelete={handleDelete} 
        onShowDetails={handleShowDetails} 
        onPrint={handlePrint}
        selectedIds={selectedSupplierIds}
        onSelectionChange={setSelectedSupplierIds}
      />
        
      <Dialog open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)}>
        <DialogContent className="max-w-4xl p-0">
          {detailsCustomer && (
            <>
            <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                <div>
                    <DialogTitle className="text-base font-semibold">Details for SR No: {detailsCustomer.srNo}</DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuRadioGroup value={activeLayout} onValueChange={(v) => setActiveLayout(v as LayoutOption)}>
                                <DropdownMenuRadioItem value="classic"><Rows3 className="mr-2 h-4 w-4" />Classic</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="compact"><LayoutList className="mr-2 h-4 w-4" />Compact</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="grid"><LayoutGrid className="mr-2 h-4 w-4" />Grid</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="step-by-step"><StepForward className="mr-2 h-4 w-4" />Step-by-Step</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DialogClose asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                    </DialogClose>
                </div>
            </DialogHeader>
            <ScrollArea className="max-h-[85vh]">
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                {activeLayout === 'classic' && (
                  <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                            <div className="flex flex-col items-center justify-center space-y-2 p-4 bg-muted rounded-lg h-full">
                                <p className="text-xs text-muted-foreground">SR No.</p>
                                <p className="text-2xl font-bold font-mono text-primary">{detailsCustomer.srNo}</p>
                            </div>
                            <Separator orientation="vertical" className="h-auto mx-4 hidden md:block" />
                            <Separator orientation="horizontal" className="w-full md:hidden" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 flex-1 text-sm">
                                <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                                <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} className="col-span-1 sm:col-span-2" />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="p-4"><CardTitle className="text-base">Transaction &amp; Weight</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                  <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                  <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                                </div>
                                <Separator />
                                <Table className="text-xs">
                                    <TableBody>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Gross Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Teir Weight (Less)</TableCell><TableCell className="text-right font-semibold p-1">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Scale size={12} />Final Weight</TableCell><TableCell className="text-right font-bold p-2">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                             <CardContent className="p-4 pt-0">
                                <Table className="text-xs">
                                    <TableBody>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Net Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ {formatCurrency(detailsCustomer.rate)}</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">{formatCurrency(detailsCustomer.amount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.kartaAmount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {detailsCustomer.labouryRate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.labouryAmount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsCustomer.kanta)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>

                    <Card className="border-primary/50 bg-primary/5 text-center">
                         <CardContent className="p-3">
                            <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                            <p className="text-3xl font-bold text-primary font-mono">
                                {formatCurrency(Number(detailsCustomer.netAmount))}
                            </p>
                         </CardContent>
                    </Card>

                    <Card className="mt-4">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {paymentsForDetailsEntry.length > 0 ? (
                                <Table className="text-sm">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="p-2 text-xs">Payment ID</TableHead>
                                            <TableHead className="p-2 text-xs">Date</TableHead>
                                            <TableHead className="p-2 text-xs">Type</TableHead>
                                            <TableHead className="p-2 text-xs">CD Applied</TableHead>
                                            <TableHead className="p-2 text-xs text-right">CD Amount</TableHead>
                                            <TableHead className="p-2 text-xs text-right">Amount Paid</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paymentsForDetailsEntry.map((payment, index) => {
                                             const paidForThis = payment.paidFor?.find(pf => pf.srNo === detailsCustomer?.srNo);
                                             return (
                                                <TableRow key={payment.id || index}>
                                                    <TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell>
                                                    <TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                    <TableCell className="p-2">{payment.type}</TableCell>
                                                    <TableCell className="p-2">{payment.cdApplied ? 'Yes' : 'No'}</TableCell>
                                                    <TableCell className="p-2 text-right">{formatCurrency(payment.cdAmount || 0)}</TableCell>
                                                    <TableCell className="p-2 text-right font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell>
                                                </TableRow>
                                             );
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground text-sm py-4">No payments have been applied to this entry yet.</p>
                            )}
                        </CardContent>
                    </Card>  
                  </div>
                )}
              </div>
            </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={receiptsToPrint.length > 0} onOpenChange={(open) => !open && setReceiptsToPrint([])}>
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
    </>
  );
}


"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z, ZodError } from "zod";
import { initialCustomers, appOptionsData } from "@/lib/data";
import type { Customer, Payment } from "@/lib/definitions";
import { formatSrNo, toTitleCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DynamicCombobox } from "@/components/ui/dynamic-combobox";


import { Pen, PlusCircle, Save, Trash, Info, Settings, Plus, ChevronsUpDown, Check, Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Milestone, UserSquare, Wallet, ArrowRight, LayoutGrid, LayoutList, Rows3, StepForward, X, Server, Hourglass, InfoIcon, UserCog, PackageSearch, CircleDollarSign, Receipt, Printer } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator";
import { addSupplier, deleteSupplier, getSuppliersRealtime, updateSupplier, getPaymentsRealtime } from "@/lib/firestore";
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

const getInitialFormState = (customers: Customer[], lastVariety?: string): Customer => {
  const nextSrNum = customers.length > 0 ? Math.max(...customers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: "", srNo: formatSrNo(nextSrNum), date: today.toISOString().split('T')[0], term: '0', dueDate: today.toISOString().split('T')[0], 
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

const SupplierForm = memo(function SupplierForm({ form, handleSrNoBlur, handleCapitalizeOnBlur, handleContactBlur, varietyOptions, setVarietyOptions, paymentTypeOptions, setPaymentTypeOptions, isManageVarietiesOpen, setIsManageVarietiesOpen, openVarietyCombobox, setOpenVarietyCombobox, handleFocus, lastVariety, setLastVariety, appOptionsData }: any) {
    
    return (
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
                                    <DynamicCombobox
                                        options={paymentTypeOptions.map((v: string) => ({value: v, label: v}))}
                                        value={field.value}
                                        onChange={(val) => form.setValue("paymentType", val)}
                                        onAdd={(newVal) => {
                                            const titleCased = toTitleCase(newVal);
                                            if (!paymentTypeOptions.includes(titleCased)) {
                                                setPaymentTypeOptions((prev: any) => [...prev, titleCased].sort());
                                            }
                                            form.setValue("paymentType", titleCased);
                                        }}
                                        placeholder="Select or add type..."
                                        searchPlaceholder="Search type..."
                                        emptyPlaceholder="No type found."
                                    />
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
                            <InputWithIcon icon={<User className="h-4 w-4 text-muted-foreground" />}>
                                <Controller name="name" control={form.control} render={({ field }) => (
                                    <Input {...field} placeholder="e.g. John Doe" onBlur={handleCapitalizeOnBlur} className="h-9 text-sm pl-10" />
                                )}/>
                            </InputWithIcon>
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
                        <CardTitle className="flex items-center gap-2 text-lg"><PackageSearch className="h-5 w-5" />Transaction & Weight</CardTitle>
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
                                <DynamicCombobox
                                    options={varietyOptions.map((v: string) => ({value: v, label: v}))}
                                    value={field.value}
                                    onChange={(val) => {
                                        form.setValue("variety", val);
                                        setLastVariety(val);
                                    }}
                                    onAdd={(newVal) => {
                                        const titleCased = toTitleCase(newVal);
                                        if (!varietyOptions.includes(titleCased)) {
                                            setVarietyOptions((prev: any) => [...prev, titleCased].sort());
                                        }
                                        form.setValue("variety", titleCased);
                                        setLastVariety(titleCased);
                                    }}
                                    placeholder="Select or add variety..."
                                    searchPlaceholder="Search variety..."
                                    emptyPlaceholder="No variety found."
                                />
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

const SupplierTable = memo(function SupplierTable({ customers, onEdit, onDelete, onShowDetails, onPrint }: any) {
    return (
        <div className="mt-6 min-h-[200px]"> {/* Added min-height to avoid layout shift */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
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
                                    <TableRow key={customer.id} className="h-12">
                                        <TableCell className="font-mono px-3 py-1 text-sm">{customer.srNo}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{format(new Date(customer.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{toTitleCase(customer.name)}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{toTitleCase(customer.variety)}</TableCell>
                                        <TableCell className="px-3 py-1 text-sm">{customer.netWeight.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-semibold px-3 py-1 text-sm">{formatCurrency(Number(customer.netAmount))}</TableCell>
                                        <TableCell className="text-center px-3 py-1">
                                            <div className="flex justify-center items-center gap-0">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPrint(customer)}>
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

const ReceiptPreview = ({ data, onPrint }: { data: Customer; onPrint: () => void; }) => {
    return (
        <>
            <DialogHeader>
                <DialogTitle>Print Receipt</DialogTitle>
                <DialogDescription>
                    Review the receipt for SR No: {data.srNo} before printing.
                </DialogDescription>
            </DialogHeader>
            <div id="receipt-content" className="space-y-4 text-sm">
                <div className="text-center">
                    <h3 className="text-lg font-bold">BIZSUITE DATAFLOW</h3>
                    <p className="text-xs">Agricultural Commission Agent</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <p><span className="font-semibold">SR No:</span> {data.srNo}</p>
                    <p><span className="font-semibold">Date:</span> {format(new Date(data.date), "dd-MMM-yyyy")}</p>
                    <p className="col-span-2"><span className="font-semibold">Supplier:</span> {toTitleCase(data.name)} S/O {toTitleCase(data.so)}</p>
                    <p className="col-span-2"><span className="font-semibold">Address:</span> {toTitleCase(data.address)}</p>
                    <p><span className="font-semibold">Contact:</span> {data.contact}</p>
                    <p><span className="font-semibold">Vehicle No:</span> {data.vehicleNo.toUpperCase()}</p>
                </div>
                <Separator />
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell>Variety</TableCell>
                            <TableCell className="text-right font-semibold">{toTitleCase(data.variety)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Gross Weight</TableCell>
                            <TableCell className="text-right font-semibold">{data.grossWeight.toFixed(2)} kg</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Teir Weight</TableCell>
                            <TableCell className="text-right font-semibold">- {data.teirWeight.toFixed(2)} kg</TableCell>
                        </TableRow>
                         <TableRow className="font-bold border-t">
                            <TableCell>Final Weight</TableCell>
                            <TableCell className="text-right">{data.weight.toFixed(2)} kg</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                <Separator />
                 <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell>Rate</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(data.rate)} / kg</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Net Weight</TableCell>
                            <TableCell className="text-right font-semibold">{data.netWeight.toFixed(2)} kg</TableCell>
                        </TableRow>
                        <TableRow className="font-bold border-t">
                            <TableCell>Total Amount</TableCell>
                            <TableCell className="text-right">{formatCurrency(data.amount)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                 <Separator />
                 <p className="font-semibold">Deductions:</p>
                 <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell>Karta ({data.kartaPercentage}%)</TableCell>
                            <TableCell className="text-right font-semibold">- {formatCurrency(data.kartaAmount)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Laboury (@{data.labouryRate.toFixed(2)})</TableCell>
                            <TableCell className="text-right font-semibold">- {formatCurrency(data.labouryAmount)}</TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell>Kanta</TableCell>
                            <TableCell className="text-right font-semibold">- {formatCurrency(data.kanta)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Other Charges</TableCell>
                            <TableCell className="text-right font-semibold">- {formatCurrency(data.otherCharges || 0)}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
                <Separator />
                 <div className="text-right font-bold text-lg p-2 bg-muted rounded-md">
                    Net Payable Amount: {formatCurrency(data.netAmount)}
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onPrint()}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
            </DialogFooter>
        </>
    );
};


export default function SupplierEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState([]));
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [receiptData, setReceiptData] = useState<Customer | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');


  const [varietyOptions, setVarietyOptions] = useState<string[]>([]); // Initialize empty, will load from data
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<string[]>([]); // Initialize empty, will load from data
  const [isManageVarietiesOpen, setIsManageVarietiesOpen] = useState(false);
  const [openVarietyCombobox, setOpenVarietyCombobox] = useState(false);
  const [lastVariety, setLastVariety] = useState<string>('');

  // Ensure customers is always an array
  const safeCustomers = useMemo(() => Array.isArray(customers) ? customers : [], [customers]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(safeCustomers, lastVariety),
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  // Fetch data from Firestore and set up real-time listener
  useEffect(() => {
    if (!isClient) return;

    setIsLoading(true);
    const unsubscribeSuppliers = getSuppliersRealtime((data: Customer[]) => {
      setCustomers(data);
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

    // Load options data (varieties, payment types)
    setVarietyOptions(appOptionsData.varieties);
    setPaymentTypeOptions(appOptionsData.paymentTypes);

    // Load last selected variety from localStorage (or perhaps user settings in the future)
    const savedVariety = localStorage.getItem('lastSelectedVariety');
    if (savedVariety) {
      setLastVariety(savedVariety);
    }

    // Set initial form date
    form.setValue('date', new Date());

    // Cleanup the listener when the component unmounts
    return () => {
      unsubscribeSuppliers();
      unsubscribePayments();
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
    const otherCharges = values.otherCharges || 0; // Added other charges
    const netAmount = amount - labouryAmount - kanta - kartaAmount - otherCharges; // Deduct other charges
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
    if (isClient) {
      const initialFormState = getInitialFormState(safeCustomers, lastVariety);
      setCurrentCustomer(initialFormState);
      resetFormToState(initialFormState);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, customers, lastVariety]);

  useEffect(() => {
    const subscription = form.watch((value) => {
        performCalculations(value as Partial<FormValues>);
    });
    return () => subscription.unsubscribe();
  }, [form, performCalculations]);

  const resetFormToState = (customerState: Customer) => {
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
      otherCharges: customerState.otherCharges || 0, // Include other charges
      paymentType: customerState.paymentType || 'Full',
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }

  const handleNew = () => {
    setIsEditing(false);
    const newState = getInitialFormState(safeCustomers, lastVariety);
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
    const day = today.getDate().toString().padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    resetFormToState({ ...newState, date: new Date(localDateString), dueDate: localDateString });
    resetFormToState(newState);
  };

  const handleEdit = (id: string) => {
    const customerToEdit = safeCustomers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
      setCurrentCustomer(customerToEdit); // Explicitly set the full customer object with ID
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
        setCurrentCustomer(foundCustomer); // Explicitly set the full customer object with ID
        resetFormToState(foundCustomer);
    } else {
        setIsEditing(false);
        const currentState = {...getInitialFormState(safeCustomers, lastVariety), srNo: formattedSrNo};
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10) {
      const foundCustomer = customers.find(c => c.contact === contactValue);
      if (foundCustomer && foundCustomer.id !== currentCustomer.id) { // Only auto-fill if not the current customer being edited
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
      if (activeElement.closest('[role="dialog"]') || activeElement.closest('[role="menu"]') || activeElement.closest('[cmdk-root]')) {
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
      // Optimistic update
      setCustomers(prevCustomers => prevCustomers.filter(c => c.id !== id));
      toast({ title: "Success", description: "Entry deleted successfully." });
      if (currentCustomer.id === id) {
        handleNew(); // Clear form if deleting the currently edited customer
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
      // Ensure calculated fields are included and correctly formatted
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
      const { id, ...newEntryData } = completeEntry; // Destructure to omit the ID field
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
      p.paidFor?.some(pf => pf.srNo === detailsCustomer.srNo)
    );
  }, [detailsCustomer, paymentHistory]);

  const handlePrintReceipt = (customer: Customer) => {
    setReceiptData(customer);
  };
  
  const handleActualPrint = () => {
    const printableContent = document.getElementById('receipt-content');
    if (printableContent) {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow?.document.write('<html><head><title>Print Receipt</title>');
        // You might want to link to your stylesheet for better formatting
        printWindow?.document.write('<link rel="stylesheet" href="/path/to/your/tailwind.css" type="text/css" />');
        printWindow?.document.write('<style>@media print{body{font-family:sans-serif; padding: 20px;}}</style>');
        printWindow?.document.write('</head><body >');
        printWindow?.document.write(printableContent.innerHTML);
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.focus();
        printWindow?.print();
        printWindow?.close();
    }
  };

  if (!isClient) {
    return null; // Render nothing on the server
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
        <p className="text-muted-foreground flex items-center"><Hourglass className="w-5 h-5 mr-2 animate-spin"/>Loading data...</p>
      </div>
    );
    return null;
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
                setVarietyOptions={setVarietyOptions}
                paymentTypeOptions={paymentTypeOptions}
                setPaymentTypeOptions={setPaymentTypeOptions}
                isManageVarietiesOpen={isManageVarietiesOpen}
                setIsManageVarietiesOpen={setIsManageVarietiesOpen}
                openVarietyCombobox={openVarietyCombobox}
                setOpenVarietyCombobox={setOpenVarietyCombobox}
                handleFocus={handleFocus}
                lastVariety={lastVariety}
                setLastVariety={handleSetLastVariety}
                appOptionsData={appOptionsData}
            />
            
            <CalculatedSummary currentCustomer={currentCustomer} />

            <div className="flex justify-start space-x-4 pt-4">
              <Button type="submit" size="sm">
                {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleNew} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
              </Button>
            </div>
        </form>
      </FormProvider>      
      
      <SupplierTable customers={customers} onEdit={handleEdit} onDelete={handleDelete} onShowDetails={handleShowDetails} onPrint={handlePrintReceipt} />
        
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
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-6">
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

      <Dialog open={!!receiptData} onOpenChange={(open) => !open && setReceiptData(null)}>
        <DialogContent className="sm:max-w-md">
            {receiptData && <ReceiptPreview data={receiptData} onPrint={handleActualPrint}/>}
        </DialogContent>
      </Dialog>
    </>
  );
}

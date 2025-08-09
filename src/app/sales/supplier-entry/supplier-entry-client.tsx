
"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialCustomers, appOptionsData } from "@/lib/data";
import type { Customer } from "@/lib/definitions";
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


import { Pen, PlusCircle, Save, Trash, Info, Settings, Plus, ChevronsUpDown, Check, Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Milestone, UserSquare, Wallet, ArrowRight, LayoutGrid, LayoutList, Rows3, StepForward, X, Server, Hourglass, InfoIcon, UserCog, PackageSearch, CircleDollarSign } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator";

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
    kanta: z.coerce.number().min(0),
    paymentType: z.string().min(1, "Payment type is required")
});

type FormValues = z.infer<typeof formSchema>;
type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';

const getInitialFormState = (customers: Customer[], lastVariety?: string): Customer => {
  const nextSrNum = customers.length > 0 ? Math.max(...customers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
  const staticDate = new Date();
  staticDate.setHours(0,0,0,0);

  return {
    id: "", srNo: formatSrNo(nextSrNum), date: staticDate.toISOString().split('T')[0], term: '0', dueDate: staticDate.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: lastVariety || '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 1, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 2, labouryAmount: 0, kanta: 50, amount: 0, netAmount: 0, originalNetAmount: 0, barcode: '',
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

const SupplierForm = memo(function SupplierForm({ form, handleSrNoBlur, handleCapitalizeOnBlur, handleContactBlur, varietyOptions, setVarietyOptions, paymentTypeOptions, setPaymentTypeOptions, isManageVarietiesOpen, setIsManageVarietiesOpen, openVarietyCombobox, setOpenVarietyCombobox, handleFocus, lastVariety, setLastVariety }: any) {
    
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
          { label: "Karta Weight", value: currentCustomer.kartaWeight }, { label: "Karta Amount", value: currentCustomer.kartaAmount },
          { label: "Net Weight", value: currentCustomer.netWeight }, { label: "Laboury Amount", value: currentCustomer.labouryAmount },
          { label: "Amount", value: currentCustomer.amount }, { label: "Net Amount", value: currentCustomer.netAmount, isBold: true },
        ]
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

const SupplierTable = memo(function SupplierTable({ customers, onEdit, onDelete, onShowDetails }: any) {
    return (
        <div className="mt-6">
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
                                        <TableCell className="text-right font-semibold px-3 py-1 text-sm">{Number(customer.netAmount).toFixed(2)}</TableCell>
                                        <TableCell className="text-center px-3 py-1">
                                            <div className="flex justify-center items-center gap-0">
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


export default function SupplierEntryClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState([]));
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');


  const [varietyOptions, setVarietyOptions] = useState<string[]>(appOptionsData.varieties);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState<string[]>(appOptionsData.paymentTypes);
  const [isManageVarietiesOpen, setIsManageVarietiesOpen] = useState(false);
  const [openVarietyCombobox, setOpenVarietyCombobox] = useState(false);
  const [lastVariety, setLastVariety] = useState<string>('');


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...getInitialFormState(customers, lastVariety),
    },
    shouldFocusError: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      try {
        const savedCustomers = localStorage.getItem("customers_data");
        const parsedCustomers = savedCustomers ? JSON.parse(savedCustomers) : initialCustomers;
        setCustomers(Array.isArray(parsedCustomers) ? parsedCustomers : initialCustomers);
        
        const savedVariety = localStorage.getItem('lastSelectedVariety');
        if (savedVariety) {
          setLastVariety(savedVariety);
        }
      } catch (error) {
        console.error("Failed to load data from localStorage", error);
        setCustomers(initialCustomers);
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("customers_data", JSON.stringify(customers));
    }
  }, [customers, isClient]);
  
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
    const netAmount = amount - labouryAmount - kanta - kartaAmount;
    setCurrentCustomer(prev => ({
      ...prev, ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : prev.date,
      term: String(values.term), dueDate: newDueDate.toISOString().split("T")[0],
      weight: parseFloat(weight.toFixed(2)), kartaWeight: parseFloat(kartaWeight.toFixed(2)),
      kartaAmount: parseFloat(kartaAmount.toFixed(2)), netWeight: parseFloat(netWeight.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)), labouryAmount: parseFloat(labouryAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      originalNetAmount: parseFloat(netAmount.toFixed(2)),
    }));
  }, [form]);
  
   useEffect(() => {
    if (isClient) {
      const initialFormState = getInitialFormState(customers, lastVariety);
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
      paymentType: customerState.paymentType || 'Full'
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }

  const handleNew = () => {
    setIsEditing(false);
    const newState = getInitialFormState(customers, lastVariety);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    newState.date = today.toISOString().split("T")[0];
    newState.dueDate = today.toISOString().split("T")[0];
    resetFormToState(newState);
  };

  const handleEdit = (id: string) => {
    const customerToEdit = customers.find(c => c.id === id);
    if (customerToEdit) {
      setIsEditing(true);
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
    const foundCustomer = customers.find(c => c.srNo === formattedSrNo);
    if (foundCustomer) {
        setIsEditing(true);
        resetFormToState(foundCustomer);
    } else {
        setIsEditing(false);
        const currentState = {...getInitialFormState(customers, lastVariety), srNo: formattedSrNo};
        resetFormToState(currentState);
    }
  }

  const handleContactBlur = (contactValue: string) => {
    if (contactValue.length === 10) {
      const foundCustomer = customers.find(c => c.contact === contactValue);
      if (foundCustomer) {
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

  const handleDelete = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    toast({ title: "Success", description: "Entry deleted successfully." });
    if (currentCustomer.id === id) {
      handleNew();
    }
  };

  const onSubmit = (values: FormValues) => {
    const completeEntry: Customer = {
      ...currentCustomer, ...values,
      name: toTitleCase(values.name), so: toTitleCase(values.so),
      address: toTitleCase(values.address), vehicleNo: toTitleCase(values.vehicleNo),
      variety: toTitleCase(values.variety), date: values.date.toISOString().split("T")[0],
      term: String(values.term), customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
    };
    if (isEditing) {
      setCustomers(prev => prev.map(c => c.id === completeEntry.id ? completeEntry : c));
      toast({ title: "Success", description: "Entry updated successfully." });
    } else {
      const newEntry = { ...completeEntry, id: Date.now().toString() };
      setCustomers(prev => [newEntry, ...prev]);
      toast({ title: "Success", description: "New entry saved successfully." });
    }
    handleNew();
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

  if (!isClient) {
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
      
      <SupplierTable customers={customers} onEdit={handleEdit} onDelete={handleDelete} onShowDetails={handleShowDetails} />
        
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
                {/* Layout 1: Classic ID Card */}
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
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {detailsCustomer.labouryRate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>

                    <Card className="border-primary/50 bg-primary/5 text-center">
                         <CardContent className="p-3">
                            <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                            <p className="text-3xl font-bold text-primary font-mono">
                                ₹{Number(detailsCustomer.netAmount).toFixed(2)}
                            </p>
                         </CardContent>
                    </Card>
                  </div>
                )}
                 {/* Layout 2: Compact List */}
                 {activeLayout === 'compact' && (
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Supplier</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                                <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                                <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                                <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Transaction</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Financials</CardTitle></CardHeader>
                             <CardContent className="p-4 pt-2">
                                <Table className="text-sm">
                                    <TableBody>
                                        <TableRow><TableCell className="p-2">Gross Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Teir Weight</TableCell><TableCell className="text-right p-2 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow className="border-t border-dashed"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Net Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2">Rate</TableCell><TableCell className="text-right p-2 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="border-t border-dashed"><TableCell className="p-2 font-bold">Total Amount</TableCell><TableCell className="text-right p-2 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Laboury (@{detailsCustomer.labouryRate.toFixed(2)})</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="p-2 text-destructive">Kanta</TableCell><TableCell className="text-right p-2 font-semibold text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                        <TableRow className="bg-primary/5"><TableCell className="p-2 font-extrabold text-primary">Net Payable Amount</TableCell><TableCell className="text-right p-2 text-xl font-extrabold text-primary">₹{Number(detailsCustomer.netAmount).toFixed(2)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>
                )}
                {/* Layout 3: Grid */}
                {activeLayout === 'grid' && (
                     <div className="space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                            <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                            <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                            <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                             <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                            <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                            <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                            <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                            <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                            <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} className="md:col-span-3" />
                         </div>
                         <Separator />
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                             <Table className="text-sm">
                                <TableBody>
                                    <TableRow><TableCell className="p-2">Gross Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="p-2">Teir Weight</TableCell><TableCell className="text-right p-2 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow className="border-t border-dashed bg-muted/30"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                </TableBody>
                            </Table>
                             <Table className="text-sm">
                                <TableBody>
                                    <TableRow><TableCell className="p-2">Net Weight</TableCell><TableCell className="text-right p-2 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                    <TableRow><TableCell className="p-2">Rate</TableCell><TableCell className="text-right p-2 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                    <TableRow className="border-t border-dashed bg-muted/30"><TableCell className="p-2 font-bold">Total Amount</TableCell><TableCell className="text-right p-2 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                         </div>
                         <Separator />
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
                             <DetailItem icon={<Percent size={14} />} label={`Karta (${detailsCustomer.kartaPercentage}%)`} value={`- ₹ ${detailsCustomer.kartaAmount.toFixed(2)}`} className="text-destructive" />
                             <DetailItem icon={<Milestone size={14} />} label={`Laboury (@${detailsCustomer.labouryRate.toFixed(2)})`} value={`- ₹ ${detailsCustomer.labouryAmount.toFixed(2)}`} className="text-destructive" />
                             <DetailItem icon={<Landmark size={14} />} label="Kanta" value={`- ₹ ${detailsCustomer.kanta.toFixed(2)}`} className="text-destructive" />
                         </div>
                        <Card className="border-primary/50 bg-primary/5 text-center mt-4">
                            <CardContent className="p-3">
                                <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                                <p className="text-3xl font-bold text-primary font-mono">
                                    ₹{Number(detailsCustomer.netAmount).toFixed(2)}
                                </p>
                            </CardContent>
                        </Card>
                     </div>
                )}
                {/* Layout 4: Step-by-Step */}
                {activeLayout === 'step-by-step' && (
                  <div className="flex flex-col md:flex-row items-start justify-center gap-4">
                      <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                        <div className="flex-1 space-y-4">
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><User size={16}/>Supplier Details</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-2">
                                    <DetailItem icon={<Hash size={14} />} label="SR No." value={detailsCustomer.srNo} />
                                    <DetailItem icon={<UserSquare size={14} />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                    <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsCustomer.contact} />
                                    <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsCustomer.address)} />
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><FileText size={16}/>Transaction Details</CardTitle></CardHeader>
                                <CardContent className="p-4 pt-0 space-y-2">
                                    <DetailItem icon={<CalendarIcon size={14} />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                    <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                    <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsCustomer.vehicleNo.toUpperCase()} />
                                    <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />
                                    <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsCustomer.paymentType} />
                                </CardContent>
                            </Card>
                        </div>
                      </div>
                      <div className="self-center p-2 hidden md:block">
                          <ArrowRight className="text-muted-foreground"/>
                      </div>
                       <div className="flex-1 w-full">
                          <Card>
                              <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><Scale size={16}/>Weight Calculation</CardTitle></CardHeader>
                              <CardContent className="p-4 pt-0">
                                  <Table className="text-xs">
                                      <TableBody>
                                          <TableRow><TableCell className="p-1">Gross Weight</TableCell><TableCell className="text-right p-1 font-semibold">{detailsCustomer.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1">Teir Weight</TableCell><TableCell className="text-right p-1 font-semibold">- {detailsCustomer.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow className="bg-muted/50"><TableCell className="p-2 font-bold">Final Weight</TableCell><TableCell className="text-right p-2 font-bold">{detailsCustomer.weight.toFixed(2)} kg</TableCell></TableRow>
                                      </TableBody>
                                  </Table>
                              </CardContent>
                          </Card>
                      </div>
                      <div className="self-center p-2 hidden md:block">
                          <ArrowRight className="text-muted-foreground"/>
                      </div>
                       <div className="flex-1 w-full">
                          <Card>
                               <CardHeader className="p-4"><CardTitle className="text-base flex items-center gap-2"><Banknote size={16}/>Financial Breakdown</CardTitle></CardHeader>
                               <CardContent className="p-4 pt-0">
                                  <Table className="text-xs">
                                      <TableBody>
                                          <TableRow><TableCell className="p-1">Net Weight</TableCell><TableCell className="text-right p-1 font-semibold">{detailsCustomer.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1">Rate</TableCell><TableCell className="text-right p-1 font-semibold">@ ₹{detailsCustomer.rate.toFixed(2)}</TableCell></TableRow>
                                          <TableRow className="border-t border-dashed"><TableCell className="p-1 font-bold">Total</TableCell><TableCell className="text-right p-1 font-bold">₹ {detailsCustomer.amount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Karta ({detailsCustomer.kartaPercentage}%)</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.kartaAmount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Laboury (@{detailsCustomer.labouryRate.toFixed(2)})</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.labouryAmount.toFixed(2)}</TableCell></TableRow>
                                          <TableRow><TableCell className="p-1 text-destructive">Kanta</TableCell><TableCell className="text-right p-1 font-semibold text-destructive">- ₹ {detailsCustomer.kanta.toFixed(2)}</TableCell></TableRow>
                                          <TableRow className="bg-primary/5"><TableCell className="p-2 font-extrabold text-primary">Net Payable</TableCell><TableCell className="text-right p-2 text-xl font-extrabold text-primary">₹{Number(detailsCustomer.netAmount).toFixed(2)}</TableCell></TableRow>
                                      </TableBody>
                                  </Table>
                               </CardContent>
                          </Card>
                      </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

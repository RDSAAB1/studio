
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { Pen, PlusCircle, Save, Trash, Info, Settings, Plus, ChevronsUpDown, Check, Calendar as CalendarIcon, User, Phone, Home, Truck, Wheat, Banknote, Landmark, FileText, Hash, Percent, Scale, Weight, Calculator, Building, Milestone } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
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
    receiptType: z.string().min(1, "Receipt type is required"),
    paymentType: z.string().min(1, "Payment type is required")
});

type FormValues = z.infer<typeof formSchema>;

const getInitialFormState = (customers: Customer[]): Customer => {
  const nextSrNum = customers.length > 0 ? Math.max(...customers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
  const staticDate = new Date();
  staticDate.setHours(0,0,0,0);

  return {
    id: "", srNo: formatSrNo(nextSrNum), date: staticDate.toISOString().split('T')[0], term: '0', dueDate: staticDate.toISOString().split('T')[0], 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 0, labouryAmount: 0, kanta: 0, amount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', searchValue: ''
  };
};

const CustomerForm = memo(function CustomerForm({ form, handleSrNoBlur, handleCapitalizeOnBlur, varietyOptions, setVarietyOptions, isManageVarietiesOpen, setIsManageVarietiesOpen, openVarietyCombobox, setOpenVarietyCombobox }: any) {
    const { toast } = useToast();
    const [newVariety, setNewVariety] = useState("");
    const [editingVariety, setEditingVariety] = useState<{ old: string; new: string } | null>(null);

    const handleAddVariety = () => {
        if (newVariety && !varietyOptions.find(opt => opt.toLowerCase() === newVariety.toLowerCase())) {
            const titleCasedVariety = toTitleCase(newVariety);
            setVarietyOptions((prev: string[]) => [...prev, titleCasedVariety].sort());
            setNewVariety("");
            toast({ title: "Variety Added", description: `"${titleCasedVariety}" has been added.` });
        }
    };

    const handleDeleteVariety = (varietyToDelete: string) => {
        setVarietyOptions((prev: string[]) => prev.filter(v => v !== varietyToDelete));
        toast({ title: "Variety Deleted", description: `"${varietyToDelete}" has been removed.` });
    };
    
    const handleSaveEditedVariety = () => {
        if (editingVariety) {
            setVarietyOptions((prev: string[]) => prev.map(v => v === editingVariety.old ? toTitleCase(editingVariety.new) : v).sort());
            setEditingVariety(null);
            toast({ title: "Variety Updated" });
        }
    };
    
    return (
        <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-card/50">
                <h3 className="text-base font-headline mb-2 text-primary">Transaction Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                        <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code h-9 text-sm" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="term" className="text-xs">Term (Days)</Label>
                        <Input id="term" type="number" {...form.register('term')} className="h-9 text-sm" />
                    </div>
                    <Controller
                        name="receiptType"
                        control={form.control}
                        render={({ field }) => (
                            <div className="space-y-1">
                                <Label className="text-xs">Receipt Type</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {appOptionsData.receiptTypes.map(type => (
                                        <SelectItem key={type} value={type} className="text-sm">{type}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            </div>
                        )}
                    />
                    <Controller
                        name="paymentType"
                        control={form.control}
                        render={({ field }) => (
                            <div className="space-y-1">
                                <Label className="text-xs">Payment Type</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {appOptionsData.paymentTypes.map(type => (
                                        <SelectItem key={type} value={type} className="text-sm">{type}</SelectItem>
                                    ))}
                                </SelectContent>
                                </Select>
                            </div>
                        )}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-3 p-4 border rounded-lg bg-card/50">
                    <h3 className="text-base font-headline mb-2 text-primary">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                            <Controller name="name" control={form.control} render={({ field }) => (
                            <div className="space-y-1 relative">
                                <Label htmlFor="name" className="text-xs">Name</Label>
                                <Input {...field} placeholder="e.g. John Doe" onBlur={handleCapitalizeOnBlur} className="h-9 text-sm" />
                                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
                            </div>
                        )} />
                        <Controller name="so" control={form.control} render={({ field }) => (
                            <div className="space-y-1">
                                <Label htmlFor="so" className="text-xs">S/O</Label>
                                <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm" />
                            </div>
                        )} />
                    </div>
                        <div className="grid grid-cols-3 gap-3">
                        <Controller name="contact" control={form.control} render={({ field }) => (
                            <div className="space-y-1">
                                <Label htmlFor="contact" className="text-xs">Contact</Label>
                                <Input {...field} className="h-9 text-sm" />
                                {form.formState.errors.contact && <p className="text-xs text-destructive">{form.formState.errors.contact.message}</p>}
                            </div>
                        )} />
                        <Controller name="address" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                <Label htmlFor="address" className="text-xs">Address</Label>
                                <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm" />
                            </div>
                        )} />
                            <Controller name="vehicleNo" control={form.control} render={({ field }) => (
                            <div className="space-y-1">
                                <Label htmlFor="vehicleNo" className="text-xs">Vehicle No.</Label>
                                <Input {...field} onBlur={handleCapitalizeOnBlur} className="h-9 text-sm" />
                            </div>
                        )} />
                    </div>
                </div>
                
                <div className="space-y-3 p-4 border rounded-lg bg-card/50">
                    <h3 className="text-base font-headline mb-2 text-primary">Financial Details</h3>
                        <div className="grid grid-cols-[2fr,1fr,1fr] gap-3 mb-3">
                        <Controller
                            name="variety"
                            control={form.control}
                            render={({ field }) => (
                            <div className="space-y-1 col-span-1">
                                <Label className="text-xs">Variety</Label>
                                <div className="flex items-center gap-2">
                                <Popover open={openVarietyCombobox} onOpenChange={setOpenVarietyCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openVarietyCombobox}
                                        className="w-full justify-between h-9 text-sm font-normal"
                                        >
                                        {field.value
                                            ? toTitleCase(varietyOptions.find((v: string) => v.toLowerCase() === field.value.toLowerCase()) ?? field.value)
                                            : "Select variety..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[51]">
                                        <Command>
                                        <CommandInput placeholder="Search variety..." />
                                        <CommandList>
                                            <CommandEmpty>No variety found.</CommandEmpty>
                                            <CommandGroup>
                                            {varietyOptions.map((v: string) => (
                                                <CommandItem
                                                    key={v}
                                                    value={v}
                                                    onSelect={(currentValue) => {
                                                        form.setValue("variety", toTitleCase(currentValue));
                                                        setOpenVarietyCombobox(false);
                                                    }}
                                                >
                                                <Check
                                                    className={cn(
                                                    "mr-2 h-4 w-4",
                                                    field.value?.toLowerCase() === v.toLowerCase() ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {toTitleCase(v)}
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                        </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <Dialog open={isManageVarietiesOpen} onOpenChange={setIsManageVarietiesOpen}>
                                    <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9"><Settings className="h-4 w-4"/></Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Manage Varieties</DialogTitle>
                                        <DialogDescription>Add, edit, or remove varieties from the list.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                        <Input
                                            placeholder="Add new variety"
                                            value={newVariety}
                                            onChange={(e) => setNewVariety(e.target.value)}
                                        />
                                        <Button onClick={handleAddVariety} size="icon"><Plus className="h-4 w-4" /></Button>
                                        </div>
                                        <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                        {varietyOptions.map((v: string) => (
                                            <div key={v} className="flex items-center justify-between gap-2 rounded-md border p-2">
                                            {editingVariety?.old === v ? (
                                                <Input
                                                value={editingVariety.new}
                                                onChange={(e) => setEditingVariety({ ...editingVariety, new: e.target.value })}
                                                autoFocus
                                                onBlur={handleSaveEditedVariety}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedVariety()}
                                                />
                                            ) : (
                                                <span className="flex-grow">{toTitleCase(v)}</span>
                                            )}
                                            <div className="flex gap-1">
                                                {editingVariety?.old === v ? (
                                                <Button size="icon" variant="ghost" onClick={handleSaveEditedVariety}><Save className="h-4 w-4 text-green-500" /></Button>
                                                ) : (
                                                <Button size="icon" variant="ghost" onClick={() => setEditingVariety({ old: v, new: v })}><Pen className="h-4 w-4" /></Button>
                                                )}
                                                <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-red-500" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the variety "{toTitleCase(v)}".
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteVariety(v)}>Continue</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsManageVarietiesOpen(false)}>Done</Button>
                                    </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                </div>
                                {form.formState.errors.variety && <p className="text-xs text-destructive mt-1">{form.formState.errors.variety.message}</p>}
                            </div>
                            )}
                        />
                        <Controller name="grossWeight" control={form.control} render={({ field }) => (<div className="space-y-1 col-span-1"><Label htmlFor="grossWeight" className="text-xs">Gross Wt.</Label><Input id="grossWeight" type="number" {...field} className="h-9 text-sm" /></div>)} />
                        <Controller name="teirWeight" control={form.control} render={({ field }) => (<div className="space-y-1 col-span-1"><Label htmlFor="teirWeight" className="text-xs">Teir Wt.</Label><Input id="teirWeight" type="number" {...field} className="h-9 text-sm"/></div>)} />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                        <Controller name="rate" control={form.control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="rate" className="text-xs">Rate</Label><Input id="rate" type="number" {...field} className="h-9 text-sm" /></div>)} />
                        <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="kartaPercentage" className="text-xs">Karta %</Label><Input id="kartaPercentage" type="number" {...field} className="h-9 text-sm" /></div>)} />
                        <Controller name="labouryRate" control={form.control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="labouryRate" className="text-xs">Laboury</Label><Input id="labouryRate" type="number" {...field} className="h-9 text-sm" /></div>)} />
                        <Controller name="kanta" control={form.control} render={({ field }) => (<div className="space-y-1"><Label htmlFor="kanta" className="text-xs">Kanta</Label><Input id="kanta" type="number" {...field} className="h-9 text-sm" /></div>)} />
                    </div>
                </div>
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
        <Card>
            <CardHeader className="p-4"><CardTitle className="text-base font-headline text-primary">Calculated Summary</CardTitle></CardHeader>
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

const CustomerTable = memo(function CustomerTable({ customers, onEdit, onDelete, onShowDetails }: any) {
    return (
        <div className="mt-6">
            <Card>
                <CardHeader className="p-4">
                    <CardTitle className="font-headline text-xl">Transaction Records</CardTitle>
                </CardHeader>
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


const DetailItem = ({ icon, label, value, className }: { icon: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        <div className="text-primary mt-1">{icon}</div>
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm">{String(value)}</p>
        </div>
    </div>
);

const FinancialDetailItem = ({ label, value, isSubtle = false, isBold = false, className = '' }: { label: string, value: any, isSubtle?: boolean, isBold?: boolean, className?: string }) => (
    <div className={cn("flex justify-between items-center py-1.5", className)}>
        <p className={cn("text-sm", isSubtle ? "text-muted-foreground" : "text-foreground")}>{label}</p>
        <p className={cn("font-semibold text-sm", isSubtle ? "text-muted-foreground" : "text-foreground", isBold && "font-bold text-base")}>{String(value)}</p>
    </div>
);

export default function CustomerManagementClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState(initialCustomers));
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);

  const [varietyOptions, setVarietyOptions] = useState<string[]>(appOptionsData.varieties);
  const [isManageVarietiesOpen, setIsManageVarietiesOpen] = useState(false);
  const [openVarietyCombobox, setOpenVarietyCombobox] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      srNo: currentCustomer.srNo, date: new Date(), term: 0, name: "", so: "", address: "", contact: "",
      vehicleNo: "", variety: "", grossWeight: 0, teirWeight: 0, rate: 0, kartaPercentage: 0,
      labouryRate: 0, kanta: 0, receiptType: "Cash", paymentType: "Full"
    },
  });

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
    const netAmount = amount - labouryAmount - kanta;
    setCurrentCustomer(prev => ({
      ...prev, ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : prev.date,
      term: String(values.term), dueDate: newDueDate.toISOString().split("T")[0],
      weight: parseFloat(weight.toFixed(2)), kartaWeight: parseFloat(kartaWeight.toFixed(2)),
      kartaAmount: parseFloat(kartaAmount.toFixed(2)), netWeight: parseFloat(netWeight.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)), labouryAmount: parseFloat(labouryAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
    }));
  }, [form]);
  
  useEffect(() => {
    setIsClient(true);
    handleNew();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      rate: customerState.rate || 0, kartaPercentage: customerState.kartaPercentage || 0,
      labouryRate: customerState.labouryRate || 0, kanta: customerState.kanta || 0,
      receiptType: customerState.receiptType || 'Cash', paymentType: customerState.paymentType || 'Full'
    };
    setCurrentCustomer(customerState);
    form.reset(formValues);
    performCalculations(formValues);
  }

  const handleNew = () => {
    setIsEditing(false);
    const newState = getInitialFormState(customers);
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
        const currentState = {...getInitialFormState(customers), srNo: formattedSrNo};
        resetFormToState(currentState);
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

  if (!isClient) {
    return null;
  }

  return (
    <>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
            <CustomerForm 
                form={form}
                handleSrNoBlur={handleSrNoBlur}
                handleCapitalizeOnBlur={handleCapitalizeOnBlur}
                varietyOptions={varietyOptions}
                setVarietyOptions={setVarietyOptions}
                isManageVarietiesOpen={isManageVarietiesOpen}
                setIsManageVarietiesOpen={setIsManageVarietiesOpen}
                openVarietyCombobox={openVarietyCombobox}
                setOpenVarietyCombobox={setOpenVarietyCombobox}
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
      
      <CustomerTable customers={customers} onEdit={handleEdit} onDelete={handleDelete} onShowDetails={handleShowDetails} />
      
       <Sheet open={!!detailsCustomer} onOpenChange={(open) => !open && setDetailsCustomer(null)}>
        <SheetContent className="w-full sm:max-w-5xl overflow-y-auto p-0">
            {detailsCustomer && (
                <div className="flex flex-col h-full">
                    <SheetHeader className="p-6 border-b bg-muted/30">
                        <SheetTitle className="text-2xl font-headline">
                            Transaction Profile: <span className="text-primary font-mono">{detailsCustomer.srNo}</span>
                        </SheetTitle>
                        <SheetDescription>
                           Detailed overview for {toTitleCase(detailsCustomer.name)}'s transaction on {format(new Date(detailsCustomer.date), "PPP")}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-grow p-6 space-y-6 bg-muted/20">
                        <Card>
                             <CardHeader>
                                <CardTitle className="text-lg font-headline flex items-center gap-2">
                                    <User className="text-primary"/> Customer & Transaction Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                                <DetailItem icon={<User className="size-4" />} label="Name" value={toTitleCase(detailsCustomer.name)} />
                                <DetailItem icon={<Building className="size-4" />} label="S/O" value={toTitleCase(detailsCustomer.so)} />
                                <DetailItem icon={<Phone className="size-4" />} label="Contact" value={detailsCustomer.contact} />
                                <DetailItem icon={<Home className="size-4" />} label="Address" value={toTitleCase(detailsCustomer.address)} />
                                
                                <DetailItem icon={<CalendarIcon className="size-4" />} label="Date" value={format(new Date(detailsCustomer.date), "PPP")} />
                                <DetailItem icon={<CalendarIcon className="size-4" />} label="Due Date" value={format(new Date(detailsCustomer.dueDate), "PPP")} />
                                <DetailItem icon={<Truck className="size-4" />} label="Vehicle No." value={detailsCustomer.vehicleNo} />
                                <DetailItem icon={<Wheat className="size-4" />} label="Variety" value={toTitleCase(detailsCustomer.variety)} />

                                <DetailItem icon={<FileText className="size-4" />} label="Receipt Type" value={detailsCustomer.receiptType} />
                                <DetailItem icon={<Landmark className="size-4" />} label="Payment Type" value={detailsCustomer.paymentType} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg font-headline flex items-center gap-2">
                                    <Calculator className="text-primary"/> Financial Summary
                                </CardTitle>
                            </CardHeader>
                             <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm"><Weight className="size-4 text-primary" />Weight Calculation</h4>
                                    <FinancialDetailItem label="Gross Wt." value={`${detailsCustomer.grossWeight.toFixed(2)} kg`} />
                                    <FinancialDetailItem label="Teir Wt." value={`${detailsCustomer.teirWeight.toFixed(2)} kg`} isSubtle />
                                    <FinancialDetailItem label="Final Weight" value={`${detailsCustomer.weight.toFixed(2)} kg`} isBold />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm"><Percent className="size-4 text-primary" />Deductions</h4>
                                     <FinancialDetailItem label="Karta" value={`${detailsCustomer.kartaPercentage}% (-${detailsCustomer.kartaWeight.toFixed(2)} kg)`} />
                                     <FinancialDetailItem label="Net Weight" value={`${detailsCustomer.netWeight.toFixed(2)} kg`} isBold />
                                </div>
                                 <div className="space-y-2">
                                    <h4 className="font-semibold flex items-center gap-2 text-sm"><Banknote className="size-4 text-primary" />Amount Calculation</h4>
                                    <FinancialDetailItem label="Rate" value={`₹ ${detailsCustomer.rate.toFixed(2)} / kg`} />
                                    <FinancialDetailItem label="Total Amount" value={`₹ ${detailsCustomer.amount.toFixed(2)}`} isBold />
                                    <FinancialDetailItem label="Laboury" value={`- ₹ ${detailsCustomer.labouryAmount.toFixed(2)}`} isSubtle/>
                                    <FinancialDetailItem label="Kanta" value={`- ₹ ${detailsCustomer.kanta.toFixed(2)}`} isSubtle />
                                </div>
                            </CardContent>
                        </Card>
                        
                         <Card className="bg-primary/10 border-primary shadow-lg">
                            <CardContent className="p-4 flex items-center justify-between">
                                <p className="text-lg font-bold text-primary">Net Payable Amount</p>
                                <p className="text-3xl font-bold text-primary">
                                    ₹{Number(detailsCustomer.netAmount).toFixed(2)}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </SheetContent>
       </Sheet>
    </>
  );
}

    
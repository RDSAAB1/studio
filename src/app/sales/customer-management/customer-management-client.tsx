
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialCustomers, appOptionsData } from "@/lib/data";
import type { Customer } from "@/lib/definitions";
import { formatSrNo, toTitleCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronsUpDown,
  Pen,
  PlusCircle,
  Save,
  Trash,
} from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"


const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required."),
    so: z.string(),
    address: z.string(),
    contact: z.string().min(1, "Contact is required."),
    vehicleNo: z.string(),
    variety: z.string().min(1, "Variety is required."),
    grossWeight: z.coerce.number().min(0),
    teirWeight: z.coerce.number().min(0),
    rate: z.coerce.number().min(0),
    kartaPercentage: z.coerce.number().min(0),
    labouryRate: z.coerce.number().min(0),
    kanta: z.coerce.number().min(0),
    receiptType: z.string(),
    paymentType: z.string()
});

type FormValues = z.infer<typeof formSchema>;

// Helper to get a fresh form state
const getInitialFormState = (customers: Customer[]): Customer => {
  const nextSrNum = customers.length > 0 ? Math.max(...customers.map(c => parseInt(c.srNo.substring(1)) || 0)) + 1 : 1;
  const staticDate = '2025-01-01'; // Static date to avoid hydration mismatch

  return {
    id: "", srNo: formatSrNo(nextSrNum), date: staticDate, term: '0', dueDate: staticDate, 
    name: '', so: '', address: '', contact: '', vehicleNo: '', variety: '', grossWeight: 0, teirWeight: 0,
    weight: 0, kartaPercentage: 0, kartaWeight: 0, kartaAmount: 0, netWeight: 0, rate: 0,
    labouryRate: 0, labouryAmount: 0, kanta: 0, amount: 0, netAmount: 0, barcode: '',
    receiptType: 'Cash', paymentType: 'Full', customerId: '', searchValue: ''
  };
};

export default function CustomerManagementClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState(initialCustomers));
  const [isEditing, setIsEditing] = useState(false);
  const [appOptions, setAppOptions] = useState(appOptionsData);
  const [isClient, setIsClient] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      srNo: currentCustomer.srNo,
      date: new Date(),
      term: 0,
      name: "",
      so: "",
      address: "",
      contact: "",
      vehicleNo: "",
      variety: "",
      grossWeight: 0,
      teirWeight: 0,
      rate: 0,
      kartaPercentage: 0,
      labouryRate: 0,
      kanta: 0,
      receiptType: "Cash",
      paymentType: "Full"
    },
  });

  const performCalculations = useCallback((data: Partial<FormValues>) => {
    const values = {...form.getValues(), ...data};
    const date = values.date;
    const termDays = values.term || 0;
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
      ...prev,
      ...values,
      date: values.date instanceof Date ? values.date.toISOString().split("T")[0] : prev.date,
      term: String(values.term),
      dueDate: newDueDate.toISOString().split("T")[0],
      weight: parseFloat(weight.toFixed(2)),
      kartaWeight: parseFloat(kartaWeight.toFixed(2)),
      kartaAmount: parseFloat(kartaAmount.toFixed(2)),
      netWeight: parseFloat(netWeight.toFixed(2)),
      amount: parseFloat(amount.toFixed(2)),
      labouryAmount: parseFloat(labouryAmount.toFixed(2)),
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
      srNo: customerState.srNo,
      date: formDate,
      term: Number(customerState.term) || 0,
      name: customerState.name,
      so: customerState.so,
      address: customerState.address,
      contact: customerState.contact,
      vehicleNo: customerState.vehicleNo,
      variety: customerState.variety,
      grossWeight: customerState.grossWeight || 0,
      teirWeight: customerState.teirWeight || 0,
      rate: customerState.rate || 0,
      kartaPercentage: customerState.kartaPercentage || 0,
      labouryRate: customerState.labouryRate || 0,
      kanta: customerState.kanta || 0,
      receiptType: customerState.receiptType || 'Cash',
      paymentType: customerState.paymentType || 'Full'
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
        // Keep the typed SR no, but reset the rest of the form
        const currentState = {...getInitialFormState(customers), srNo: formattedSrNo};
        resetFormToState(currentState);
    }
  }


  const handleDelete = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    toast({ title: "Success", description: "Entry deleted successfully." });
    if (currentCustomer.id === id) {
      handleNew();
    }
  };

  const onSubmit = (values: FormValues) => {
    const completeEntry: Customer = {
      ...currentCustomer,
      ...values,
      date: values.date.toISOString().split("T")[0],
      term: String(values.term),
      name: toTitleCase(values.name),
      customerId: `${toTitleCase(values.name).toLowerCase()}|${values.contact.toLowerCase()}`,
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

  const summaryFields = useMemo(() => {
      const dueDate = currentCustomer.dueDate ? format(new Date(currentCustomer.dueDate), "PPP") : '-';
      return [
        { label: "Due Date", value: dueDate },
        { label: "Weight", value: currentCustomer.weight },
        { label: "Karta Weight", value: currentCustomer.kartaWeight },
        { label: "Karta Amount", value: currentCustomer.kartaAmount },
        { label: "Net Weight", value: currentCustomer.netWeight },
        { label: "Laboury Amount", value: currentCustomer.labouryAmount },
        { label: "Amount", value: currentCustomer.amount },
        { label: "Net Amount", value: currentCustomer.netAmount, isBold: true },
      ]
    }, [currentCustomer]);

  if (!isClient) {
    return null; // or a loading skeleton
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">{isEditing ? `Editing Entry: ${currentCustomer.srNo}` : "Add New Entry"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-6">
              
              {/* Basic Customer Information */}
              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Basic Customer Information</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Controller name="contact" control={form.control} render={({ field }) => (
                        <div className="space-y-2">
                            <Label htmlFor="contact">Contact</Label>
                            <Input id="contact" {...field} />
                            {form.formState.errors.contact && <p className="text-sm text-destructive">{form.formState.errors.contact.message}</p>}
                        </div>
                    )} />
                     <Controller name="name" control={form.control} render={({ field }) => (
                        <div className="space-y-2 relative">
                            <Label htmlFor="name">Name</Label>
                            <Input id="name" {...field} placeholder="e.g. John Doe" />
                            {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                        </div>
                    )} />
                    <Controller name="so" control={form.control} render={({ field }) => (
                        <div className="space-y-2">
                            <Label htmlFor="so">S/O</Label>
                            <Input id="so" {...field} />
                        </div>
                    )} />
                    <Controller name="address" control={form.control} render={({ field }) => (
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input id="address" {...field} />
                        </div>
                    )} />
                     <Controller name="vehicleNo" control={form.control} render={({ field }) => (
                        <div className="space-y-2">
                            <Label htmlFor="vehicleNo">Vehicle No.</Label>
                            <Input id="vehicleNo" {...field} />
                        </div>
                    )} />
                  </CardContent>
              </Card>

              {/* Weight, Quantity & Financial Details */}
              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Weight, Quantity & Financial Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Controller name="grossWeight" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="grossWeight">Gross Wt.</Label><Input id="grossWeight" type="number" {...field} /></div>)} />
                    <Controller name="teirWeight" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="teirWeight">Teir Wt.</Label><Input id="teirWeight" type="number" {...field} /></div>)} />
                     <Controller name="variety" control={form.control} render={({ field }) => (
                         <div className="space-y-2">
                            <Label>Variety</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                  {field.value ? toTitleCase(appOptions.varieties.find(v => v.toLowerCase() === field.value.toLowerCase()) || field.value) : "Select variety..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search variety..." />
                                  <CommandList>
                                    <CommandEmpty>No variety found.</CommandEmpty>
                                    <CommandGroup>
                                      {appOptions.varieties.map((variety) => (
                                        <CommandItem key={variety} value={variety} onSelect={() => field.onChange(variety)}>
                                          {toTitleCase(variety)}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                         </div>
                    )} />
                    <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="kartaPercentage">Karta %</Label><Input id="kartaPercentage" type="number" {...field} /></div>)} />
                    <Controller name="rate" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="rate">Rate</Label><Input id="rate" type="number" {...field} /></div>)} />
                    <Controller name="labouryRate" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="labouryRate">Laboury Rate</Label><Input id="labouryRate" type="number" {...field} /></div>)} />
                    <Controller name="kanta" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="kanta">Kanta</Label><Input id="kanta" type="number" {...field} /></div>)} />
                  </CardContent>
              </Card>

              {/* Other Transaction Details */}
              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Other Transaction Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="space-y-2">
                        <Label htmlFor="srNo">Sr No.</Label>
                        <Input id="srNo" {...form.register('srNo')} onBlur={(e) => handleSrNoBlur(e.target.value)} className="font-code" />
                    </div>
                    
                    <Controller name="date" control={form.control} render={({ field }) => (
                         <div className="space-y-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <CalendarComponent
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                         </div>
                    )} />

                    <Controller name="term" control={form.control} render={({ field }) => (
                         <div className="space-y-2">
                            <Label htmlFor="term">Term (Days)</Label>
                            <Input id="term" type="number" {...field} />
                         </div>
                    )} />
                     <Controller name="receiptType" control={form.control} render={({ field }) => (
                         <div className="space-y-2">
                            <Label>Receipt Type</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                  {field.value ? toTitleCase(appOptions.receiptTypes.find(v => v.toLowerCase() === field.value.toLowerCase()) || field.value) : "Select..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0">
                                <Command>
                                  <CommandList>
                                    <CommandGroup>
                                      {appOptions.receiptTypes.map((type) => (
                                        <CommandItem key={type} value={type} onSelect={() => field.onChange(type)}>
                                          {toTitleCase(type)}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                         </div>
                    )} />
                    <Controller name="paymentType" control={form.control} render={({ field }) => (
                         <div className="space-y-2">
                            <Label>Payment Type</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                  {field.value ? toTitleCase(appOptions.paymentTypes.find(v => v.toLowerCase() === field.value.toLowerCase()) || field.value) : "Select..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0">
                                <Command>
                                  <CommandList>
                                    <CommandGroup>
                                      {appOptions.paymentTypes.map((type) => (
                                        <CommandItem key={type} value={type} onSelect={() => field.onChange(type)}>
                                          {toTitleCase(type)}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                         </div>
                    )} />
                  </CardContent>
              </Card>
              
              {/* Summary */}
              <Card>
                <CardHeader><CardTitle className="text-lg font-headline">Calculated Summary</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {summaryFields.map(item => (
                    <div key={item.label} className="space-y-1">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className={cn("text-lg font-semibold", item.isBold && "text-primary font-bold text-xl")}>{String(item.value)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

            </div>
            <div className="flex justify-start space-x-4">
              <Button type="submit">
                {isEditing ? <><Pen className="mr-2 h-4 w-4" /> Update</> : <><Save className="mr-2 h-4 w-4" /> Save</>}
              </Button>
              <Button type="button" variant="outline" onClick={handleNew}>
                <PlusCircle className="mr-2 h-4 w-4" /> New / Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Customer Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="font-headline">Transaction Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sr No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-code">{customer.srNo}</TableCell>
                    <TableCell>{toTitleCase(customer.name)}</TableCell>
                    <TableCell>{customer.date ? format(new Date(customer.date), "PPP") : '-'}</TableCell>
                    <TableCell>{customer.netAmount.toFixed(2)}</TableCell>
                    <TableCell>{customer.dueDate ? format(new Date(customer.dueDate), "PPP") : '-'}</TableCell>
                    <TableCell className="space-x-2">
                       <Button variant="ghost" size="icon" onClick={() => handleEdit(customer.id)}>
                            <Pen className="h-4 w-4" />
                       </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                                <Trash className="h-4 w-4" />
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
                              <AlertDialogAction onClick={() => handleDelete(customer.id)}>Continue</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

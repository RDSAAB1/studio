

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialCustomers, appOptionsData } from "@/lib/data";
import type { Customer } from "@/lib/definitions";
import { formatSrNo, toTitleCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import {
  Pen,
  PlusCircle,
  Save,
  Trash,
  Info,
} from "lucide-react";
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { cn } from "@/lib/utils"


const formSchema = z.object({
    srNo: z.string(),
    date: z.date(),
    term: z.coerce.number().min(0),
    name: z.string().min(1, "Name is required.").transform(val => toTitleCase(val)),
    so: z.string().transform(val => toTitleCase(val)),
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

export default function CustomerManagementClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(() => getInitialFormState(initialCustomers));
  const [isEditing, setIsEditing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsCustomer, setDetailsCustomer] = useState<Customer | null>(null);

  const [varietyOptions, setVarietyOptions] = useState<string[]>(appOptionsData.varieties);

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
      const form = e.currentTarget;
      const formElements = Array.from(form.elements).filter(el => (el as HTMLElement).offsetParent !== null) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];
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
      ...currentCustomer,
      ...values,
      date: values.date.toISOString().split("T")[0],
      term: String(values.term),
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
  
  const handleShowDetails = (customer: Customer) => {
    setDetailsCustomer(customer);
    setIsDetailsModalOpen(true);
  }

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
    
  const customerDetailsFields = (customer: Customer | null) => {
    if (!customer) return [];
    return [
      { label: "SR No.", value: customer.srNo },
      { label: "Date", value: format(new Date(customer.date), "PPP") },
      { label: "Term", value: `${customer.term} days` },
      { label: "Due Date", value: format(new Date(customer.dueDate), "PPP") },
      { label: "Name", value: toTitleCase(customer.name) },
      { label: "S/O", value: toTitleCase(customer.so) },
      { label: "Address", value: customer.address },
      { label: "Contact", value: customer.contact },
      { label: "Vehicle No.", value: customer.vehicleNo },
      { label: "Variety", value: toTitleCase(customer.variety) },
      { label: "Gross Weight", value: customer.grossWeight },
      { label: "Teir Weight", value: customer.teirWeight },
      { label: "Weight", value: customer.weight },
      { label: "Karta %", value: customer.kartaPercentage },
      { label: "Karta Weight", value: customer.kartaWeight },
      { label: "Karta Amount", value: customer.kartaAmount },
      { label: "Net Weight", value: customer.netWeight },
      { label: "Rate", value: customer.rate },
      { label: "Laboury Rate", value: customer.labouryRate },
      { label: "Laboury Amount", value: customer.labouryAmount },
      { label: "Kanta", value: customer.kanta },
      { label: "Amount", value: customer.amount },
      { label: "Net Amount", value: customer.netAmount },
      { label: "Receipt Type", value: customer.receiptType },
      { label: "Payment Type", value: customer.paymentType },
    ];
  };

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
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-8">
            <div className="space-y-6">
              
              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Transaction Details</CardTitle></CardHeader>
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
                                    onSelect={(date) => field.onChange(date || new Date())}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                         </div>
                    )} />

                    <div className="space-y-2">
                      <Label htmlFor="term">Term (Days)</Label>
                      <Input id="term" type="number" {...form.register('term')} />
                    </div>
                     <Controller
                        name="receiptType"
                        control={form.control}
                        render={({ field }) => (
                          <div className="space-y-2">
                            <Label>Receipt Type</Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a receipt type" />
                              </SelectTrigger>
                              <SelectContent>
                                {appOptionsData.receiptTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
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
                          <div className="space-y-2">
                            <Label>Payment Type</Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a payment type" />
                              </SelectTrigger>
                              <SelectContent>
                                {appOptionsData.paymentTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      />
                  </CardContent>
              </Card>

              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Customer Information</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Controller name="contact" control={form.control} render={({ field }) => (
                        <div className="space-y-2">
                            <Label htmlFor="contact">Contact</Label>
                            <Input id="contact" {...field} />
                            {form.formState.errors.contact && <p className="text-sm text-destructive">{form.formState.errors.contact.message}</p>}
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

              <Card className="bg-card/50">
                  <CardHeader><CardTitle className="text-lg font-headline">Financial Details</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Controller name="grossWeight" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="grossWeight">Gross Wt.</Label><Input id="grossWeight" type="number" {...field} /></div>)} />
                    <Controller name="teirWeight" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="teirWeight">Teir Wt.</Label><Input id="teirWeight" type="number" {...field} /></div>)} />
                    
                    <Controller
                        name="variety"
                        control={form.control}
                        render={({ field }) => (
                          <div className="space-y-2">
                            <Label>Variety</Label>
                             <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a variety" />
                              </SelectTrigger>
                              <SelectContent>
                                {varietyOptions.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {form.formState.errors.variety && <p className="text-sm text-destructive mt-1">{form.formState.errors.variety.message}</p>}
                          </div>
                        )}
                      />

                    <Controller name="kartaPercentage" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="kartaPercentage">Karta %</Label><Input id="kartaPercentage" type="number" {...field} /></div>)} />
                    <Controller name="rate" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="rate">Rate</Label><Input id="rate" type="number" {...field} /></div>)} />
                    <Controller name="labouryRate" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="labouryRate">Laboury Rate</Label><Input id="labouryRate" type="number" {...field} /></div>)} />
                    <Controller name="kanta" control={form.control} render={({ field }) => (<div className="space-y-2"><Label htmlFor="kanta">Kanta</Label><Input id="kanta" type="number" {...field} /></div>)} />
                  </CardContent>
              </Card>
              
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
      <div className="mt-8">
        <CardHeader>
          <CardTitle className="font-headline">Transaction Records</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers.map(customer => (
            <Card key={customer.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                    <span>{toTitleCase(customer.name)}</span>
                    <Badge variant={customer.paymentType === 'Full' ? 'secondary' : 'default'}>{customer.paymentType}</Badge>
                </CardTitle>
                <CardDescription>SR No: <span className="font-mono">{customer.srNo}</span></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><strong className="text-muted-foreground">Date:</strong> {customer.date ? format(new Date(customer.date), "PPP") : '-'}</div>
                  <div><strong className="text-muted-foreground">Due:</strong> {customer.dueDate ? format(new Date(customer.dueDate), "PPP") : '-'}</div>
                  <div><strong className="text-muted-foreground">Contact:</strong> {customer.contact}</div>
                  <div><strong className="text-muted-foreground">Variety:</strong> {toTitleCase(customer.variety)}</div>
                  <div><strong className="text-muted-foreground">Vehicle:</strong> {customer.vehicleNo || 'N/A'}</div>
                  <div><strong className="text-muted-foreground">S/O:</strong> {toTitleCase(customer.so)}</div>
                </div>
                <div className="border-t pt-4 mt-4">
                    <p className="text-lg font-bold text-right text-primary">Net Amount: {Number(customer.netAmount).toFixed(2)}</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                 <Button variant="ghost" size="icon" onClick={() => handleShowDetails(customer)}>
                      <Info className="h-4 w-4" />
                 </Button>
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
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

       {/* Details Dialog */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details for {detailsCustomer?.srNo}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {customerDetailsFields(detailsCustomer).map(field => (
                <div key={field.label}>
                  <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
                  <p className="font-semibold">{String(field.value)}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

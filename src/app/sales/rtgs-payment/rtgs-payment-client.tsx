
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pen, Save, PlusCircle, Trash, ArrowUpDown, Users, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DynamicCombobox } from "@/components/ui/dynamic-combobox";


const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  mobileNo: z.string().optional(),
  address: z.string().optional(),
  acNo: z.string().optional(),
  ifscCode: z.string().optional(),
  bank: z.string().optional(),
  branch: z.string().optional(),
  srNo: z.string().min(1, "SR No. is required"),
  date: z.string(),
  grNo: z.string().optional(),
  grDate: z.string().optional(),
  parchiNo: z.string().optional(),
  parchiDate: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount is required"),
  checkNo: z.string().optional(),
  utrNo: z.string().optional(),
  rate: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PaymentOption = {
  quantity: number;
  rate: number;
  calculatedAmount: number;
  amountRemaining: number;
};

type SortConfig = {
    key: keyof PaymentOption;
    direction: 'ascending' | 'descending';
};

const initialFormState: FormValues = {
  name: "",
  fatherName: "",
  mobileNo: "",
  address: "",
  acNo: "",
  ifscCode: "",
  bank: "",
  branch: "",
  srNo: "",
  date: new Date().toISOString().split("T")[0],
  grNo: "",
  grDate: new Date().toISOString().split("T")[0],
  parchiNo: "",
  parchiDate: "",
  amount: 0,
  checkNo: "",
  utrNo: "",
  rate: 0,
  weight: 0,
};

export default function RtgspaymentClient() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(undefined);
  const [outstandingEntries, setOutstandingEntries] = useState<Customer[]>([]);
  const [selectedOutstandingIds, setSelectedOutstandingIds] = useState<Set<string>>(new Set());
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);


  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [isPaymentOptionsModalOpen, setIsPaymentOptionsModalOpen] = useState(false);
  const [calcTargetAmount, setCalcTargetAmount] = useState(50000);
  const [calcMinRate, setCalcMinRate] = useState(2300);
  const [calcMaxRate, setCalcMaxRate] = useState(2400);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormState,
  });

  const generateSrNo = useCallback((records: any[]) => {
      const lastSrNo = records.reduce((max, record) => {
        const srNumMatch = record.srNo?.match(/^R(\d+)$/);
        if (srNumMatch) {
          const currentNum = parseInt(srNumMatch[1], 10);
          return Math.max(max, currentNum);
        }
        return max;
      }, 0);
      return `R${String(lastSrNo + 1).padStart(5, "0")}`;
  }, []);

  const totalOutstandingForSelected = useMemo(() => {
    return outstandingEntries
      .filter(entry => selectedOutstandingIds.has(entry.id))
      .reduce((acc, entry) => acc + Number(entry.netAmount), 0);
  }, [outstandingEntries, selectedOutstandingIds]);

  useEffect(() => {
    setIsClient(true);
    const unsubscribeRecords = onSnapshot(collection(db, "rtgs_payments"), (snapshot) => {
      const recordsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllRecords(recordsData);
      if (editingRecordIndex === null) {
         form.setValue("srNo", generateSrNo(recordsData));
      }
    }, (error) => {
      console.error("Error fetching RTGS records:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load RTGS records.' });
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, "suppliers"), (snapshot) => {
      const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
      setSuppliers(suppliersData);
    }, (error) => {
      console.error("Error fetching suppliers:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load suppliers.' });
    });

    return () => { unsubscribeRecords(); unsubscribeSuppliers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecordIndex]);

  useEffect(() => {
    if (!cdEnabled) {
      setCalculatedCdAmount(0);
      return;
    }
    let base = 0;
    const amount = form.getValues('amount') || 0;
    const outstanding = totalOutstandingForSelected;

    if (cdAt === 'paid_amount' || cdAt === 'payment_amount') {
      base = amount;
    } else if (cdAt === 'unpaid_amount') {
      base = outstanding;
    } else if (cdAt === 'full_amount') {
      base = outstanding;
    }
    setCalculatedCdAmount(Math.round((base * cdPercent) / 100));
  }, [cdEnabled, cdPercent, cdAt, form, totalOutstandingForSelected]);


  const handleSupplierSelect = (supplier: Customer) => {
    setSelectedSupplierId(supplier.id);
    setSearchQuery(""); // Clear search query after selection

    if(supplier) {
      form.reset({
        ...initialFormState,
        srNo: generateSrNo(allRecords),
        name: supplier.name,
        fatherName: supplier.so,
        mobileNo: supplier.contact,
        address: supplier.address,
        acNo: supplier.acNo,
        ifscCode: supplier.ifscCode,
        bank: supplier.bank,
        branch: supplier.branch,
      });
      const supplierOutstanding = suppliers.filter(c => c.customerId === supplier.customerId && Number(c.netAmount) > 0);
      setOutstandingEntries(supplierOutstanding);
    } else {
      setOutstandingEntries([]);
    }
  }

  const onSubmit = async (values: FormValues) => {
    const finalValues = {
        ...values,
        amount: Math.round(values.amount + calculatedCdAmount),
        cdAmount: Math.round(calculatedCdAmount),
        cdApplied: cdEnabled,
        supplierId: selectedSupplierId || null, 
    }

    let message = "";
    if (editingRecordIndex !== null && allRecords[editingRecordIndex]?.id) {
       const recordToUpdateId = allRecords[editingRecordIndex].id;
       try {
         await updateDoc(doc(db, "rtgs_payments", recordToUpdateId), finalValues);
         toast({ title: "Success", description: "Record updated successfully!" });
         handleNew(allRecords);
       } catch (error) {
         console.error("Error updating record:", error);
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to update record.' });
       }
    } else {
       try {
         await addDoc(collection(db, "rtgs_payments"), finalValues);
         toast({ title: "Success", description: "Record saved successfully!" });
         handleNew([...allRecords, { id: 'temp', ...finalValues }]);
       } catch (error) {
         console.error("Error adding record:", error);
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to save record.' });
       }
    }
  };
  
  const handleNew = (records: any[]) => {
    form.reset({...initialFormState, srNo: generateSrNo(records) });
    setEditingRecordIndex(null);
    setSelectedSupplierId(undefined);
    setOutstandingEntries([]);
    setSelectedOutstandingIds(new Set());
    setCdEnabled(false);
    setSearchQuery("");
  }

  const handleEdit = (index: number) => {
    const record = allRecords[index];
    if (record) {
       form.reset(record);
       setEditingRecordIndex(index);
       setSelectedSupplierId(record.supplierId);
       window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (index: number) => {
     const recordToDelete = allRecords[index];
     if (recordToDelete && recordToDelete.id) {
       try {
         await deleteDoc(doc(db, "rtgs_payments", recordToDelete.id));
         toast({ title: "Success", description: "Record deleted successfully." });
         if(editingRecordIndex === index){
             handleNew(allRecords.filter((_, i) => i !== index));
         }
       } catch (error) {
         console.error("Error deleting record:", error);
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete record.' });
       }
     }
  };

  const handleGeneratePaymentOptions = () => {
    if (isNaN(calcTargetAmount) || isNaN(calcMinRate) || isNaN(calcMaxRate) || calcMinRate > calcMaxRate) {
        toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please enter valid numbers for payment calculation.' });
        return;
    }

    const rawOptions: PaymentOption[] = [];
    const generatedUniqueRemainingAmounts = new Set<number>();
    const maxQuantityToSearch = Math.min(200, Math.ceil(calcTargetAmount / (calcMinRate > 0 ? calcMinRate : 1)) + 50);
    const rateSteps = [5, 10]; 

    for (let q = 0.10; q <= maxQuantityToSearch; q = parseFloat((q + 0.10).toFixed(2))) {
        if (Math.round(q * 100) % 10 !== 0) continue; 

        for (let step of rateSteps) {
            if (step <= 0) continue;
            let startRateForStep = Math.ceil(calcMinRate / step) * step;
            let endRateForStep = Math.floor(calcMaxRate / step) * step;

            for (let currentRate = startRateForStep; currentRate <= endRateForStep; currentRate += step) {
                if (currentRate < calcMinRate || currentRate > calcMaxRate || currentRate <= 0) continue;

                let calculatedAmount = q * currentRate;
                let finalAmount = Math.round(calculatedAmount / 5) * 5; 

                if (finalAmount > calcTargetAmount) continue;

                const amountRemaining = Math.round(calcTargetAmount - finalAmount);

                 if (!generatedUniqueRemainingAmounts.has(amountRemaining)) {
                    rawOptions.push({
                        quantity: q,
                        rate: currentRate,
                        calculatedAmount: finalAmount,
                        amountRemaining: amountRemaining
                    });
                    generatedUniqueRemainingAmounts.add(amountRemaining);
                }
            }
        }
    }
    
    const sortedOptions = rawOptions.sort((a, b) => a.amountRemaining - b.amountRemaining);
    const limitedOptions = sortedOptions.slice(0, 50);

    setPaymentOptions(limitedOptions);
    setIsPaymentOptionsModalOpen(true);
    setSortConfig(null);
    
    let message = `Generated ${limitedOptions.length} payment options.`;
     if (rawOptions.length > 50) {
        message += ` Displaying top 50 results.`;
    }
    toast({ title: 'Success', description: message });
  }
  
  const handlePaySelectedOutstanding = () => {
    const selectedEntries = outstandingEntries.filter(e => selectedOutstandingIds.has(e.id));
    const totalAmount = Math.round(selectedEntries.reduce((acc, entry) => acc + Number(entry.netAmount), 0));
    const firstEntry = selectedEntries[0];

    if (firstEntry) {
      form.setValue('amount', totalAmount);
      setCalcTargetAmount(totalAmount);

      form.setValue('grNo', firstEntry.grNo || '');
      form.setValue('grDate', firstEntry.grDate?.split('T')[0] || new Date().toISOString().split("T")[0]);
      form.setValue('parchiNo', firstEntry.parchiNo || '');
      form.setValue('parchiDate', firstEntry.parchiDate?.split('T')[0] || '');
      form.setValue('rate', firstEntry.rate || 0);
      form.setValue('weight', firstEntry.weight || 0);
    }
    
    setIsOutstandingModalOpen(false); // Close the modal
    
    toast({ title: 'Entries Loaded', description: `Loaded ${selectedEntries.length} entries. Total: ${formatCurrency(totalAmount)}. Target amount set.` });
  };


  const selectPaymentAmount = (option: PaymentOption) => {
    form.setValue('amount', option.calculatedAmount);
    form.setValue('rate', option.rate);
    form.setValue('weight', option.quantity);
    setIsPaymentOptionsModalOpen(false);
    toast({ title: 'Selected', description: `Amount ${formatCurrency(option.calculatedAmount)} selected.` });
  }

  const requestSort = (key: keyof PaymentOption) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedPaymentOptions = useMemo(() => {
    let sortableItems = [...paymentOptions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [paymentOptions, sortConfig]);
  
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    
    const uniqueSuppliers = new Map<string, Customer>();
    suppliers.forEach(s => {
        if (s.customerId && !uniqueSuppliers.has(s.customerId)) {
            uniqueSuppliers.set(s.customerId, s);
        }
    });

    return Array.from(uniqueSuppliers.values()).filter(supplier =>
        supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        supplier.contact?.includes(searchQuery)
    );
  }, [searchQuery, suppliers]);

  if (!isClient) {
    return null; 
  }

  return (
    <div className="space-y-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                 <CardTitle>Supplier Details</CardTitle>
                 {selectedSupplierId && (
                      <Dialog open={isOutstandingModalOpen} onOpenChange={setIsOutstandingModalOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)}>View Outstanding ({outstandingEntries.length})</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader><DialogTitle>Outstanding Entries for {toTitleCase(suppliers.find(c=>c.id === selectedSupplierId)?.name || '')}</DialogTitle></DialogHeader>
                          <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead><Checkbox
                                    checked={selectedOutstandingIds.size > 0 && selectedOutstandingIds.size === outstandingEntries.length}
                                    onCheckedChange={(checked) => {
                                      const newSet = new Set<string>();
                                      if (checked) {
                                        outstandingEntries.forEach(e => newSet.add(e.id));
                                      }
                                      setSelectedOutstandingIds(newSet);
                                    }}
                                   /></TableHead>
                                  <TableHead>SR No</TableHead>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Net Amount</TableHead>
                                  <TableHead>Variety</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {outstandingEntries.map(entry => (
                                  <TableRow key={entry.id}>
                                    <TableCell><Checkbox 
                                      checked={selectedOutstandingIds.has(entry.id)}
                                      onCheckedChange={() => {
                                        const newSet = new Set(selectedOutstandingIds);
                                        if (newSet.has(entry.id)) {
                                          newSet.delete(entry.id);
                                        } else {
                                          newSet.add(entry.id);
                                        }
                                        setSelectedOutstandingIds(newSet);
                                      }}
                                    /></TableCell>
                                    <TableCell>{entry.srNo}</TableCell>
                                    <TableCell>{entry.date}</TableCell>
                                    <TableCell>{formatCurrency(Number(entry.netAmount))}</TableCell>
                                    <TableCell>{entry.variety}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                           <DialogFooter>
                            <p className="mr-auto text-sm text-muted-foreground">
                              Selected: {selectedOutstandingIds.size} | Total: {formatCurrency(totalOutstandingForSelected)}
                            </p>
                            <Button variant="ghost" onClick={() => setIsOutstandingModalOpen(false)}>Cancel</Button>
                            <Button onClick={handlePaySelectedOutstanding} disabled={selectedOutstandingIds.size === 0}>
                              Pay Selected
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                  )}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="search">Search Supplier</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="search"
                        type="search"
                        placeholder="Search by name or contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                      {searchQuery && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                 </div>
                 {searchQuery && (
                    <div className="relative">
                        <div className="absolute top-full mt-1 w-full bg-background border rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                            {searchResults.length > 0 ? (
                                searchResults.map(supplier => (
                                    <div 
                                        key={supplier.id} 
                                        className="p-3 hover:bg-accent cursor-pointer"
                                        onClick={() => handleSupplierSelect(supplier)}
                                    >
                                        <p className="font-semibold">{toTitleCase(supplier.name)}</p>
                                        <p className="text-sm text-muted-foreground">{supplier.contact}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="p-3 text-muted-foreground text-sm">No suppliers found.</p>
                            )}
                        </div>
                    </div>
                 )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="fatherName">Father Name</Label><Input id="fatherName" {...form.register("fatherName")} /></div>
              <div className="space-y-2"><Label htmlFor="mobileNo">Contact No.</Label><Input id="mobileNo" {...form.register("mobileNo")} /></div>
              <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" {...form.register("address")} /></div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="acNo">A/C No.</Label><Input id="acNo" {...form.register("acNo")} /></div>
              <div className="space-y-2"><Label htmlFor="ifscCode">IFSC Code</Label><Input id="ifscCode" {...form.register("ifscCode")} /></div>
              <div className="space-y-2"><Label htmlFor="bank">Bank</Label><Input id="bank" {...form.register("bank")} /></div>
              <div className="space-y-2"><Label htmlFor="branch">Branch</Label><Input id="branch" {...form.register("branch")} /></div>
            </CardContent>
          </Card>

          {/* Serial & Date Details */}
          <Card>
            <CardHeader><CardTitle>Serial & Date Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="srNo">SR No.</Label>
                <Input id="srNo" {...form.register("srNo")} />
                {form.formState.errors.srNo && <p className="text-sm text-destructive">{form.formState.errors.srNo.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="date">Payment Date</Label><Input type="date" id="date" {...form.register("date")} /></div>
              <div className="space-y-2"><Label htmlFor="grNo">6R No.</Label><Input id="grNo" {...form.register("grNo")} /></div>
              <div className="space-y-2"><Label htmlFor="grDate">6R Date</Label><Input type="date" id="grDate" {...form.register("grDate")} /></div>
              <div className="space-y-2"><Label htmlFor="parchiNo">Parchi No.</Label><Input id="parchiNo" {...form.register("parchiNo")} /></div>
              <div className="space-y-2"><Label htmlFor="parchiDate">Parchi Date</Label><Input type="date" id="parchiDate" {...form.register("parchiDate")} /></div>
            </CardContent>
          </Card>

          {/* Payment & Transaction Details */}
          <Card>
            <CardHeader><CardTitle>Payment & Transaction Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input type="number" id="amount" {...form.register("amount")} />
                {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="checkNo">Check No.</Label><Input id="checkNo" {...form.register("checkNo")} /></div>
              <div className="space-y-2"><Label htmlFor="utrNo">UTR No.</Label><Input id="utrNo" {...form.register("utrNo")} /></div>
              <div className="space-y-2"><Label htmlFor="rate">Rate</Label><Input type="number" id="rate" {...form.register("rate")} /></div>
              <div className="space-y-2"><Label htmlFor="weight">Weight</Label><Input type="number" id="weight" {...form.register("weight")} /></div>
              
              <div className="flex items-center space-x-2 pt-6 md:col-span-2">
                <Switch id="cd-toggle" checked={cdEnabled} onCheckedChange={setCdEnabled} />
                <Label htmlFor="cd-toggle">Apply CD</Label>
              </div>
              {cdEnabled && <>
                <div className="space-y-2">
                    <Label htmlFor="cd-percent">CD %</Label>
                    <Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                    <Label>CD At</Label>
                      <Select value={cdAt} onValueChange={setCdAt}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="paid_amount">CD on Paid Amount</SelectItem>
                            <SelectItem value="unpaid_amount">CD on Unpaid Amount (Selected)</SelectItem>
                            <SelectItem value="payment_amount">CD on Payment Amount (Manual)</SelectItem>
                            <SelectItem value="full_amount">CD on Full Amount (Selected)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label>Calculated CD Amount</Label>
                    <Input value={formatCurrency(calculatedCdAmount)} readOnly className="font-bold text-primary" />
                </div>
              </>}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-start space-x-4">
          <Button type="submit">
            {editingRecordIndex !== null ? <><Pen className="h-4 w-4 mr-2"/> Update Record</> : <><Save className="h-4 w-4 mr-2"/> Save Record</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => handleNew(allRecords)}>
            <PlusCircle className="h-4 w-4 mr-2"/> New / Clear
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Payment Calculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="calcTargetAmount">Target Amount to Pay</Label>
                    <Input type="number" id="calcTargetAmount" value={calcTargetAmount} onChange={(e) => setCalcTargetAmount(parseFloat(e.target.value))} />
                </div>
                <div>
                    <Label htmlFor="calcMinRate">Min 6R Rate</Label>
                    <Input type="number" id="calcMinRate" value={calcMinRate} onChange={(e) => setCalcMinRate(parseFloat(e.target.value))} />
                </div>
                <div>
                    <Label htmlFor="calcMaxRate">Max 6R Rate</Label>
                    <Input type="number" id="calcMaxRate" value={calcMaxRate} onChange={(e) => setCalcMaxRate(parseFloat(e.target.value))} />
                </div>
           </div>
           <Button onClick={handleGeneratePaymentOptions}>Generate Payment Options</Button>
        </CardContent>
      </Card>

      <Dialog open={isPaymentOptionsModalOpen} onOpenChange={setIsPaymentOptionsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generated Payment Options</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                     <Button variant="ghost" onClick={() => requestSort('quantity')}>
                        Quantity <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('rate')}>
                        6R Rate <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('calculatedAmount')}>
                        Calculated Amount <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('amountRemaining')}>
                        Amount Remaining <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Select</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPaymentOptions.length > 0 ? sortedPaymentOptions.map((option, index) => (
                    <TableRow key={index}>
                      <TableCell>{option.quantity.toFixed(2)}</TableCell>
                      <TableCell>{option.rate}</TableCell>
                      <TableCell>{formatCurrency(option.calculatedAmount)}</TableCell>
                      <TableCell>{formatCurrency(option.amountRemaining)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => selectPaymentAmount(option)}>Select</Button>
                      </TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center">No options generated.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Saved Records</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SR No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRecords.map((record, index) => (
                  <TableRow key={record.id || index}>
                    <TableCell>{record.srNo || 'N/A'}</TableCell>
                    <TableCell>{toTitleCase(record.name)}</TableCell>
                    <TableCell>{formatCurrency(record.amount)}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(index)}><Pen className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(index)}><Trash className="h-4 w-4" /></Button>
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
}

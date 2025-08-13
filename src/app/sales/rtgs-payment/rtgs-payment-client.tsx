
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Customer, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { runTransaction, collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc, writeBatch, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { getSuppliersRealtime, getPaymentsRealtime } from '@/lib/firestore';


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
  amount: z.coerce.number().min(0, "Amount must be positive"),
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

const cdOptions = [
    { value: 'unpaid_amount', label: 'CD on Unpaid Amount (Selected)' },
    { value: 'full_amount', label: 'CD on Full Amount (Selected)' },
    { value: 'payment_amount', label: 'CD on Payment Amount (Manual)' },
];

export default function RtgspaymentClient() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | undefined>(undefined);
  const [outstandingEntries, setOutstandingEntries] = useState<Customer[]>([]);
  const [selectedOutstandingIds, setSelectedOutstandingIds] = useState<Set<string>>(new Set());
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);

  const [paidSrNos, setPaidSrNos] = useState<Set<string>>(new Set());


  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [isPaymentOptionsModalOpen, setIsPaymentOptionsModalOpen] = useState(false);
  const [calcTargetAmount, setCalcTargetAmount] = useState(50000);
  const [calcMinRate, setCalcMinRate] = useState(2300);
  const [calcMaxRate, setCalcMaxRate] = useState(2400);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [paymentType, setPaymentType] = useState('Full');
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormState,
  });

  const generatePaymentId = useCallback((payments: Payment[]) => {
      const lastPaymentNum = payments.reduce((max, record) => {
        const srNumMatch = record.paymentId?.match(/^P(\d+)$/);
        if (srNumMatch) {
          const currentNum = parseInt(srNumMatch[1], 10);
          return Math.max(max, currentNum);
        }
        return max;
      }, 0);
      return `P${String(lastPaymentNum + 1).padStart(5, "0")}`;
  }, []);

  useEffect(() => {
    setIsClient(true);
    
    const unsubscribeSuppliers = getSuppliersRealtime(
        (data) => setSuppliers(data),
        (error) => {
            console.error("Error fetching suppliers:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load suppliers.' });
        }
    );
    
    const unsubscribePayments = getPaymentsRealtime(
        (data) => {
            setAllPayments(data);
            const allPaidSrNos = new Set<string>();
            data.forEach(payment => {
                if (Array.isArray(payment.paidFor)) {
                    payment.paidFor.forEach((pf: PaidFor) => allPaidSrNos.add(pf.srNo));
                }
            });
            setPaidSrNos(allPaidSrNos);

            if (!editingPayment) {
                form.setValue("srNo", generatePaymentId(data));
            }
        },
        (error) => {
            console.error("Error fetching payments:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load payments.' });
        }
    );

    return () => { 
        unsubscribeSuppliers();
        unsubscribePayments();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPayment]);


  const totalOutstandingForSelected = useMemo(() => {
    return Math.round(outstandingEntries
      .filter(entry => selectedOutstandingIds.has(entry.id))
      .reduce((acc, entry) => acc + Number(entry.netAmount), 0));
  }, [outstandingEntries, selectedOutstandingIds]);
  
  const selectedEntries = useMemo(() => {
    return outstandingEntries.filter(entry => selectedOutstandingIds.has(entry.id));
  }, [outstandingEntries, selectedOutstandingIds]);

  useEffect(() => {
    if(!cdEnabled) {
        setCalculatedCdAmount(0);
        return;
    }
    let base = 0;
    const amount = form.getValues('amount') || 0;
    const outstanding = totalOutstandingForSelected;

    if (cdAt === 'payment_amount') {
        base = amount;
    } else if (cdAt === 'unpaid_amount') {
        base = outstanding;
    } else if (cdAt === 'full_amount') {
        const totalOriginalAmount = selectedEntries.reduce((acc, entry) => acc + (entry.originalNetAmount || Number(entry.netAmount)), 0);
        base = totalOriginalAmount;
    }
    setCalculatedCdAmount(Math.round((base * cdPercent) / 100));
  }, [cdEnabled, cdPercent, cdAt, form, totalOutstandingForSelected, selectedEntries]);
  
  useEffect(() => {
      if (paymentType === 'Full') {
          const finalAmount = totalOutstandingForSelected - calculatedCdAmount;
          form.setValue('amount', Math.round(finalAmount));
      }
  }, [paymentType, totalOutstandingForSelected, calculatedCdAmount, form]);


  useEffect(() => {
      const finalTargetAmount = totalOutstandingForSelected - calculatedCdAmount;
      setCalcTargetAmount(Math.round(finalTargetAmount));
  }, [totalOutstandingForSelected, calculatedCdAmount]);

  const handleSupplierSelect = (supplier: Customer) => {
    setSelectedSupplierId(supplier.id);
    setSearchQuery(""); // Clear search query after selection

    if(supplier) {
      form.reset({
        ...initialFormState,
        srNo: generatePaymentId(allPayments),
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
    if (!selectedSupplierId) {
        toast({ title: 'Error', description: 'Please select a supplier.', variant: 'destructive' });
        return;
    }
    const finalPayment: Omit<Payment, 'id'> = {
        paymentId: values.srNo,
        customerId: suppliers.find(s => s.id === selectedSupplierId)?.customerId || '',
        date: values.date,
        amount: Math.round(values.amount),
        cdAmount: Math.round(calculatedCdAmount),
        cdApplied: cdEnabled,
        type: paymentType,
        receiptType: 'RTGS',
        notes: `UTR: ${values.utrNo || ''}, Check: ${values.checkNo || ''}`,
        paidFor: selectedEntries.map(e => ({ srNo: e.srNo, amount: Number(e.netAmount), cdApplied: cdEnabled })),
    };

    try {
        await runTransaction(db, async (transaction) => {
            if (editingPayment && editingPayment.id) {
                // Revert old payment impact
                for (const pf of editingPayment.paidFor || []) {
                    const q = query(collection(db, "suppliers"), where("srNo", "==", pf.srNo));
                    const supplierDocs = await getDocs(q);
                    if (!supplierDocs.empty) {
                        const supDoc = supplierDocs.docs[0];
                        const oldAmount = Number(supDoc.data().netAmount);
                        transaction.update(supDoc.ref, { netAmount: oldAmount + pf.amount });
                    }
                }
            }

            // Apply new/updated payment impact
            for (const entry of selectedEntries) {
                const newNetAmount = Number(entry.netAmount) - (paymentType === 'Full' ? Number(entry.netAmount) : values.amount / selectedEntries.length);
                const supplierRef = doc(db, "suppliers", entry.id);
                transaction.update(supplierRef, { netAmount: Math.round(newNetAmount) });
            }

            if (editingPayment && editingPayment.id) {
                const paymentRef = doc(db, "payments", editingPayment.id);
                transaction.update(paymentRef, finalPayment as any);
            } else {
                const newPaymentRef = doc(collection(db, "payments"));
                transaction.set(newPaymentRef, { ...finalPayment, id: newPaymentRef.id });
            }
        });
        toast({ title: "Success", description: `Payment ${editingPayment ? 'updated' : 'saved'} successfully!` });
        handleNew();
    } catch (error) {
        console.error("Error saving payment:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save payment.' });
    }
  };
  
  const handleNew = () => {
    form.reset({...initialFormState, srNo: generatePaymentId(allPayments) });
    setEditingPayment(null);
    setSelectedSupplierId(undefined);
    setOutstandingEntries([]);
    setSelectedOutstandingIds(new Set());
    setCdEnabled(false);
    setSearchQuery("");
  }

  const handleEdit = (paymentToEdit: Payment) => {
    setEditingPayment(paymentToEdit);
    setSelectedSupplierId(suppliers.find(s => s.customerId === paymentToEdit.customerId)?.id);
    const relatedEntries = suppliers.filter(s => paymentToEdit.paidFor?.some(pf => pf.srNo === s.srNo));
    setSelectedOutstandingIds(new Set(relatedEntries.map(e => e.id)));
    const supplierInfo = suppliers.find(s => s.customerId === paymentToEdit.customerId);
    
    form.reset({
        name: supplierInfo?.name || '',
        fatherName: supplierInfo?.so || '',
        mobileNo: supplierInfo?.contact || '',
        address: supplierInfo?.address || '',
        acNo: supplierInfo?.acNo || '',
        ifscCode: supplierInfo?.ifscCode || '',
        bank: supplierInfo?.bank || '',
        branch: supplierInfo?.branch || '',
        srNo: paymentToEdit.paymentId,
        date: paymentToEdit.date,
        amount: paymentToEdit.amount,
        checkNo: paymentToEdit.notes.match(/Check: (.*?)(,|$)/)?.[1].trim() || '',
        utrNo: paymentToEdit.notes.match(/UTR: (.*?)(,|$)/)?.[1].trim() || '',
        grNo: relatedEntries[0]?.grNo || '',
        grDate: relatedEntries[0]?.grDate || '',
        parchiNo: relatedEntries[0]?.parchiNo || '',
        parchiDate: relatedEntries[0]?.parchiDate || '',
        rate: relatedEntries[0]?.rate || 0,
        weight: relatedEntries[0]?.weight || 0,
    });
    setPaymentType(paymentToEdit.type);
    setCdEnabled(paymentToEdit.cdApplied);
    setCdPercent(paymentToEdit.cdAmount > 0 ? (paymentToEdit.cdAmount / paymentToEdit.amount) * 100 : 2);
  };

  const handleDelete = async (paymentId: string) => {
     const paymentToDelete = allPayments.find(p => p.id === paymentId);
     if (paymentToDelete) {
       try {
         await runTransaction(db, async (transaction) => {
            const paymentRef = doc(db, "payments", paymentId);
            for (const pf of paymentToDelete.paidFor || []) {
                 const q = query(collection(db, "suppliers"), where("srNo", "==", pf.srNo));
                 const supplierDocs = await getDocs(q);
                 if (!supplierDocs.empty) {
                     const supDoc = supplierDocs.docs[0];
                     const oldAmount = Number(supDoc.data().netAmount);
                     transaction.update(supDoc.ref, { netAmount: oldAmount + pf.amount });
                 }
            }
            transaction.delete(paymentRef);
         });
         toast({ title: "Success", description: "Payment deleted successfully." });
         if(editingPayment?.id === paymentId){
             handleNew();
         }
       } catch (error) {
         console.error("Error deleting payment:", error);
         toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete payment.' });
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
    const totalAmount = totalOutstandingForSelected;
    const firstEntry = selectedEntries[0];
    
    if (paymentType === 'Full') {
      const newTargetAmount = totalAmount - calculatedCdAmount;
      form.setValue('amount', newTargetAmount);
    }
    
    if (firstEntry) {
      form.setValue('grNo', firstEntry.grNo || '');
      form.setValue('grDate', firstEntry.grDate?.split('T')[0] || new Date().toISOString().split("T")[0]);
      form.setValue('parchiNo', firstEntry.parchiNo || '');
      form.setValue('parchiDate', firstEntry.parchiDate?.split('T')[0] || '');
      form.setValue('rate', firstEntry.rate || 0);
      form.setValue('weight', firstEntry.weight || 0);
    }
    
    setIsOutstandingModalOpen(false);
    
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

  const availableCdOptions = useMemo(() => {
    if (paymentType === 'Partial') {
      return cdOptions.filter(opt => opt.value === 'payment_amount');
    }
    return cdOptions.filter(opt => opt.value !== 'payment_amount');
  }, [paymentType]);

  useEffect(() => {
      if (paymentType === 'Partial' && cdAt !== 'payment_amount') {
          setCdAt('payment_amount');
      } else if (paymentType === 'Full' && cdAt === 'payment_amount') {
          setCdAt('unpaid_amount');
      }
  }, [paymentType, cdAt]);

  if (!isClient) {
    return null; 
  }

  return (
    <div className="space-y-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                                    checked={selectedOutstandingIds.size > 0 && selectedOutstandingIds.size === outstandingEntries.length && outstandingEntries.length > 0}
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
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {outstandingEntries.map(entry => {
                                  const isPaid = Number(entry.netAmount) < 1;
                                  return (
                                  <TableRow key={entry.id} className={isPaid ? "opacity-50" : ""}>
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
                                      disabled={isPaid}
                                    /></TableCell>
                                    <TableCell>{entry.srNo}</TableCell>
                                    <TableCell>{entry.date}</TableCell>
                                    <TableCell>{formatCurrency(Number(entry.netAmount))}</TableCell>
                                    <TableCell>{isPaid && <Badge variant="secondary">Paid</Badge>}</TableCell>
                                  </TableRow>
                                )})}
                              </TableBody>
                            </Table>
                          </div>
                           <DialogFooter>
                            <p className="mr-auto text-sm text-muted-foreground">
                              Selected: {selectedOutstandingIds.size} | Total: {formatCurrency(totalOutstandingForSelected)}
                            </p>
                            <Button variant="ghost" onClick={() => setIsOutstandingModalOpen(false)}>Cancel</Button>
                            <Button onClick={handlePaySelectedOutstanding} disabled={selectedOutstandingIds.size === 0}>
                              Load Selected
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

          <Card>
            <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="acNo">A/C No.</Label><Input id="acNo" {...form.register("acNo")}/></div>
              <div className="space-y-2"><Label htmlFor="ifscCode">IFSC Code</Label><Input id="ifscCode" {...form.register("ifscCode")}/></div>
              <div className="space-y-2"><Label htmlFor="bank">Bank</Label><Input id="bank" {...form.register("bank")}/></div>
              <div className="space-y-2"><Label htmlFor="branch">Branch</Label><Input id="branch" {...form.register("branch")}/></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Serial &amp; Date Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="srNo">Payment ID</Label>
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

          <Card>
            <CardHeader><CardTitle>Transaction &amp; Amount Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="checkNo">Check No.</Label><Input id="checkNo" {...form.register("checkNo")} /></div>
              <div className="space-y-2"><Label htmlFor="utrNo">UTR No.</Label><Input id="utrNo" {...form.register("utrNo")} /></div>
              <div className="space-y-2"><Label htmlFor="rate">Rate</Label><Input type="number" id="rate" {...form.register("rate")} /></div>
              <div className="space-y-2"><Label htmlFor="weight">Weight</Label><Input type="number" id="weight" {...form.register("weight")} /></div>
            </CardContent>
          </Card>
        </div>

        {selectedOutstandingIds.size > 0 && (
          <Card>
            <CardHeader><CardTitle>Payment Processing</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg bg-card/30">
                    <p className="text-muted-foreground">Total Outstanding for Selected Entries:</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalOutstandingForSelected)}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                    <div className="space-y-2">
                      <Label>Payment Type</Label>
                      <Select value={paymentType} onValueChange={setPaymentType}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="Full">Full</SelectItem>
                              <SelectItem value="Partial">Partial</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>

                     <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input type="number" id="amount" {...form.register("amount")} readOnly={paymentType === 'Full'}/>
                        {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
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
                                {availableCdOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>Calculated CD Amount</Label>
                          <Input value={formatCurrency(calculatedCdAmount)} readOnly className="font-bold text-primary" />
                      </div>
                    </>}
                </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Payment Calculation</CardTitle>
            <CardDescription>Generate payment options based on a target amount and rate range.</CardDescription>
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
            <Button type="button" onClick={handleGeneratePaymentOptions}>Generate Payment Options</Button>
          </CardContent>
        </Card>

        <div className="flex justify-start space-x-4">
          <Button type="submit">
            {editingPayment !== null ? <><Pen className="h-4 w-4 mr-2"/> Update Record</> : <><Save className="h-4 w-4 mr-2"/> Save Record</>}
          </Button>
          <Button type="button" variant="outline" onClick={handleNew}>
            <PlusCircle className="h-4 w-4 mr-2"/> New / Clear
          </Button>
        </div>
      </form>

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
        <CardHeader><CardTitle>Saved Payments</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.filter(p => p.receiptType === 'RTGS').map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.paymentId || 'N/A'}</TableCell>
                    <TableCell>{toTitleCase(suppliers.find(s => s.customerId === record.customerId)?.name || 'N/A')}</TableCell>
                    <TableCell>{formatCurrency(record.amount)}</TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell className="space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}><Pen className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(record.id)}><Trash className="h-4 w-4" /></Button>
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

    
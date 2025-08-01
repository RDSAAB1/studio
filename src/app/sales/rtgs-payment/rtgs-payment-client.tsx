
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialCustomers } from "@/lib/data"; // Using initialCustomers for farmer data simulation
import type { Customer } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pen, Save, PlusCircle, Trash, Settings, X, Check, ArrowUpDown } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  fatherName: z.string().optional(),
  mobileNo: z.string().optional(),
  address: z.string().optional(),
  parchiName: z.string().optional(),
  parchiAddress: z.string().optional(),
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
  parchiName: "",
  parchiAddress: "",
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
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);

  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [isPaymentOptionsModalOpen, setIsPaymentOptionsModalOpen] = useState(false);
  const [calcTargetAmount, setCalcTargetAmount] = useState(50000);
  const [calcMinRate, setCalcMinRate] = useState(2300);
  const [calcMaxRate, setCalcMaxRate] = useState(2400);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);


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


  useEffect(() => {
    setIsClient(true);
    const savedRecords = localStorage.getItem("rtgs_records");
    let parsedRecords: any[] = [];
    if (savedRecords) {
      try {
        parsedRecords = JSON.parse(savedRecords);
        if (Array.isArray(parsedRecords)) {
          setAllRecords(parsedRecords);
        } else {
          setAllRecords([]);
        }
      } catch (error) {
        setAllRecords([]);
      }
    }
    
    if (editingRecordIndex === null) {
        form.setValue("srNo", generateSrNo(parsedRecords));
    }
  }, [editingRecordIndex, form, generateSrNo]);

  useEffect(() => {
    if (isClient) {
        localStorage.setItem("rtgs_records", JSON.stringify(allRecords));
    }
  }, [allRecords, isClient]);

  const onSubmit = (values: FormValues) => {
    let message = "";
    if (editingRecordIndex !== null) {
      const updatedRecords = [...allRecords];
      updatedRecords[editingRecordIndex] = values;
      setAllRecords(updatedRecords);
      setEditingRecordIndex(null);
      message = "Record updated successfully!";
    } else {
      setAllRecords((prev) => [...prev, values]);
      message = "Record saved successfully!";
    }
    toast({ title: "Success", description: message });
    handleNew(allRecords);
  };
  
  const handleNew = (records: any[]) => {
    form.reset({...initialFormState, srNo: generateSrNo(records) });
    setEditingRecordIndex(null);
  }

  const handleEdit = (index: number) => {
    const record = allRecords[index];
    form.reset(record);
    setEditingRecordIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (index: number) => {
    const updatedRecords = allRecords.filter((_, i) => i !== index);
    setAllRecords(updatedRecords);
    toast({ title: "Success", description: "Record deleted successfully." });
    if(editingRecordIndex === index){
        handleNew(updatedRecords);
    }
  };

  const handleGeneratePaymentOptions = () => {
    if (isNaN(calcTargetAmount) || isNaN(calcMinRate) || isNaN(calcMaxRate) || calcMinRate <= 0 || calcMaxRate <= 0 || calcMinRate > calcMaxRate) {
        toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please enter valid numbers for payment calculation.' });
        return;
    }

    const rawOptions: PaymentOption[] = [];
    const generatedUniqueRemainingAmounts = new Set<number>();
    const maxQuantityToSearch = Math.min(200, Math.ceil(calcTargetAmount / calcMinRate) + 50);
    const rateSteps = [5, 10]; // Refined rate steps as per new request

    for (let q = 0.10; q <= maxQuantityToSearch; q = parseFloat((q + 0.10).toFixed(2))) {
        if (Math.round(q * 100) % 10 !== 0) continue; // Quintal condition (10kg increments)

        for (let step of rateSteps) {
            let startRateForStep = Math.ceil(calcMinRate / step) * step;
            let endRateForStep = Math.floor(calcMaxRate / step) * step;

            for (let currentRate = startRateForStep; currentRate <= endRateForStep; currentRate += step) {
                if (currentRate < calcMinRate || currentRate > calcMaxRate || currentRate <= 0) continue;

                let calculatedAmount = q * currentRate;
                let finalAmount = Math.round(calculatedAmount / 5) * 5; // Round to nearest 5

                if (finalAmount > calcTargetAmount) continue;

                const amountRemaining = parseFloat((calcTargetAmount - finalAmount).toFixed(2));

                if (amountRemaining >= 0) {
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

  const selectPaymentAmount = (option: PaymentOption) => {
    form.setValue('amount', option.calculatedAmount);
    form.setValue('rate', option.rate);
    form.setValue('weight', option.quantity);
    setIsPaymentOptionsModalOpen(false);
    toast({ title: 'Selected', description: `Amount ${option.calculatedAmount} selected.` });
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

  if (!isClient) {
    return null; 
  }

  return (
    <div className="space-y-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Customer Details */}
          <Card>
            <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...form.register("name")} />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2"><Label htmlFor="fatherName">Father Name</Label><Input id="fatherName" {...form.register("fatherName")} /></div>
              <div className="space-y-2"><Label htmlFor="mobileNo">Contact No.</Label><Input id="mobileNo" {...form.register("mobileNo")} /></div>
              <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" {...form.register("address")} /></div>
              <div className="space-y-2"><Label htmlFor="parchiName">Parchi Name</Label><Input id="parchiName" {...form.register("parchiName")} /></div>
              <div className="space-y-2"><Label htmlFor="parchiAddress">Parchi Address</Label><Input id="parchiAddress" {...form.register("parchiAddress")} /></div>
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
                <Button type="button" onClick={() => form.setValue('srNo', generateSrNo(allRecords))} className="mt-2">Generate SR No.</Button>
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
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-start space-x-4">
          <Button type="submit">
            {editingRecordIndex !== null ? <><Pen /> Update Record</> : <><Save /> Save Record</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => handleNew(allRecords)}>
            <PlusCircle /> New / Clear
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
                      <TableCell>{option.calculatedAmount}</TableCell>
                      <TableCell>{option.amountRemaining}</TableCell>
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
                  <TableRow key={index}>
                    <TableCell>{record.srNo}</TableCell>
                    <TableCell>{toTitleCase(record.name)}</TableCell>
                    <TableCell>{record.amount}</TableCell>
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

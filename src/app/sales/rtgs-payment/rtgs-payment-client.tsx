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
import { Pen, Save, PlusCircle, Trash, Settings, X, Check } from "lucide-react";
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormState,
  });

  const generateSrNo = useCallback(() => {
    const lastSrNo = allRecords.reduce((max, record) => {
      const srNumMatch = record.srNo?.match(/^R(\d+)$/);
      if (srNumMatch) {
        const currentNum = parseInt(srNumMatch[1], 10);
        return Math.max(max, currentNum);
      }
      return max;
    }, 0);
    const newSrNo = `R${String(lastSrNo + 1).padStart(5, "0")}`;
    form.setValue("srNo", newSrNo);
  }, [allRecords, form]);

  useEffect(() => {
    setIsClient(true);
    const savedRecords = localStorage.getItem("rtgs_records");
    if (savedRecords) {
      setAllRecords(JSON.parse(savedRecords));
    } else {
        generateSrNo();
    }
  }, [generateSrNo]);

  useEffect(() => {
    if (allRecords.length > 0) {
      localStorage.setItem("rtgs_records", JSON.stringify(allRecords));
    }
     if (editingRecordIndex === null) {
        generateSrNo();
    }
  }, [allRecords, editingRecordIndex, generateSrNo]);

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
    form.reset(initialFormState);
  };
  
  const handleNew = () => {
    form.reset(initialFormState);
    setEditingRecordIndex(null);
    generateSrNo();
  }

  const handleEdit = (index: number) => {
    const record = allRecords[index];
    form.reset(record);
    setEditingRecordIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (index: number) => {
    setAllRecords((prev) => prev.filter((_, i) => i !== index));
    toast({ title: "Success", description: "Record deleted successfully." });
    if(editingRecordIndex === index){
        handleNew();
    }
  };

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
                <Button type="button" onClick={generateSrNo} className="mt-2">Generate SR No.</Button>
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
          <Button type="button" variant="outline" onClick={handleNew}>
            <PlusCircle /> New / Clear
          </Button>
        </div>
      </form>

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


"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { initialCustomers } from "@/lib/data";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase, formatPaymentId } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

export default function CustomerPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [cdAmount, setCdAmount] = useState(0);
  const [paymentIdCounter, setPaymentIdCounter] = useState(0);

  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    customers.forEach(entry => {
      const key = entry.customerId;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name,
          contact: entry.contact,
          totalOutstanding: 0,
          paymentHistory: customerSummary.get(key)?.paymentHistory || [],
          outstandingEntryIds: [],
        });
      }
      const data = newSummary.get(key)!;
      if (entry.netAmount > 0) {
        data.totalOutstanding += entry.netAmount;
        data.outstandingEntryIds.push(entry.id);
      }
    });
    setCustomerSummary(newSummary);
  }, [customers, customerSummary]);

  useEffect(() => {
    updateCustomerSummary();
  }, [customers]);

  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
  };
  
  const handleEntrySelect = (entryId: string) => {
    const newSet = new Set(selectedEntryIds);
    if (newSet.has(entryId)) {
      newSet.delete(entryId);
    } else {
      newSet.add(entryId);
    }
    setSelectedEntryIds(newSet);
  };

  const selectedEntries = useMemo(() => {
    return customers.filter(c => selectedEntryIds.has(c.id));
  }, [customers, selectedEntryIds]);
  
  const totalOutstandingForSelected = useMemo(() => {
    return selectedEntries.reduce((acc, entry) => acc + entry.netAmount, 0);
  }, [selectedEntries]);

  const processPayment = () => {
    if (selectedEntryIds.size === 0 || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries and enter a valid payment amount." });
      return;
    }
    let remainingPayment = paymentAmount + cdAmount;
    const updatedCustomers = [...customers];

    selectedEntries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // FIFO
      .forEach(entry => {
        const entryInArray = updatedCustomers.find(c => c.id === entry.id)!;
        const outstanding = entryInArray.netAmount;
        if (remainingPayment >= outstanding) {
          entryInArray.netAmount = 0;
          remainingPayment -= outstanding;
        } else {
          entryInArray.netAmount = parseFloat((outstanding - remainingPayment).toFixed(2));
          remainingPayment = 0;
        }
      });
    
    const newPayment: Payment = {
        paymentId: formatPaymentId(paymentIdCounter + 1),
        date: new Date().toISOString().split("T")[0],
        amount: paymentAmount,
        cdAmount: cdAmount,
        type: paymentAmount >= totalOutstandingForSelected ? 'Full' : 'Partial',
        receiptType: 'Online',
        notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`
    };

    const summary = customerSummary.get(selectedCustomerKey!)!;
    summary.paymentHistory.push(newPayment);
    setPaymentIdCounter(p => p + 1);

    setCustomers(updatedCustomers);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdAmount(0);
    toast({ title: "Success", description: "Payment processed successfully." });
  };
  
  const outstandingEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && c.netAmount > 0) : [];
  const paidEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && c.netAmount === 0) : [];
  const paymentHistory = selectedCustomerKey ? customerSummary.get(selectedCustomerKey)?.paymentHistory || [] : [];

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-3xl font-bold font-headline text-primary">Customer Payments</h1>
        <p className="text-muted-foreground">Process payments, apply discounts, and track payment history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleCustomerSelect}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a customer to process payments" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(customerSummary.entries()).map(([key, data]) => (
                <SelectItem key={key} value={key}>
                  {toTitleCase(data.name)} ({data.contact}) - Outstanding: {data.totalOutstanding.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCustomerKey && (
        <>
          <Card>
            <CardHeader><CardTitle>Outstanding Entries</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><Checkbox onCheckedChange={(checked) => {
                            const newSet = new Set<string>();
                            if(checked) {
                                outstandingEntries.forEach(e => newSet.add(e.id));
                            }
                            setSelectedEntryIds(newSet);
                        }}
                        checked={selectedEntryIds.size > 0 && selectedEntryIds.size === outstandingEntries.length}
                         /></TableHead>
                        <TableHead>SR No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {outstandingEntries.map(entry => (
                        <TableRow key={entry.id}>
                        <TableCell><Checkbox checked={selectedEntryIds.has(entry.id)} onCheckedChange={() => handleEntrySelect(entry.id)} /></TableCell>
                        <TableCell>{entry.srNo}</TableCell>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.dueDate}</TableCell>
                        <TableCell className="text-right">{entry.netAmount.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Payment Processing</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <div className="p-4 border rounded-lg bg-card/30">
                      <p className="text-muted-foreground">Total Outstanding for Selected Entries:</p>
                      <p className="text-2xl font-bold text-primary">{totalOutstandingForSelected.toFixed(2)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="payment-amount">Payment Amount</Label>
                          <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="cd-amount">Cash Discount (CD) Amount</Label>
                          <Input id="cd-amount" type="number" value={cdAmount} onChange={e => setCdAmount(parseFloat(e.target.value) || 0)} />
                      </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="cd-toggle" onCheckedChange={(checked) => setCdAmount(checked ? (totalOutstandingForSelected * 0.02) : 0)} />
                    <Label htmlFor="cd-toggle">Apply 2% CD</Label>
                  </div>
                  <Button onClick={processPayment} disabled={selectedEntryIds.size === 0}>Process Payment</Button>
              </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Paid Entries</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>SR No</TableHead><TableHead>Date</TableHead><TableHead>Original Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {paidEntries.map(entry => (
                        <TableRow key={entry.id}>
                        <TableCell>{entry.srNo}</TableCell>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.amount.toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>CD Amount</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {paymentHistory.map(p => (
                        <TableRow key={p.paymentId}>
                        <TableCell>{p.paymentId}</TableCell>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>{p.amount.toFixed(2)}</TableCell>
                        <TableCell>{p.cdAmount.toFixed(2)}</TableCell>
                        <TableCell>{p.notes}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

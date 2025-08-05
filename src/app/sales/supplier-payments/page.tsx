

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

export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSummary, setCustomerSummary] = useState<Map<string, CustomerSummary>>(new Map());
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [paymentIdCounter, setPaymentIdCounter] = useState(0);

  const updateCustomerSummary = useCallback(() => {
    const newSummary = new Map<string, CustomerSummary>();
    customers.forEach(entry => {
      if (!entry.name || !entry.contact) return;
      const key = `${entry.name.toLowerCase()}|${entry.contact.toLowerCase()}`;
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
      if (parseFloat(String(entry.netAmount)) > 0) {
        data.totalOutstanding += parseFloat(String(entry.netAmount));
        data.outstandingEntryIds.push(entry.id);
      }
    });
    setCustomerSummary(newSummary);
  }, [customers, customerSummary]);

  useEffect(() => {
    updateCustomerSummary();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setPaymentType('Full');
    setCdEnabled(false);
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
    return selectedEntries.reduce((acc, entry) => acc + parseFloat(String(entry.netAmount)), 0);
  }, [selectedEntries]);
  
  const autoSetCDToggle = useCallback(() => {
    if (selectedEntries.length === 0) {
        setCdEnabled(false);
        return;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const allDueInFuture = selectedEntries.every(e => new Date(e.dueDate) > today);

    setCdEnabled(allDueInFuture);
  }, [selectedEntries]);

  useEffect(() => {
    if(paymentType === 'Full') {
        setPaymentAmount(totalOutstandingForSelected);
    }
  }, [paymentType, totalOutstandingForSelected]);

  useEffect(() => {
    autoSetCDToggle();
  }, [selectedEntryIds, autoSetCDToggle]);
  
  useEffect(() => {
    if(!cdEnabled) {
        setCalculatedCdAmount(0);
        return;
    }
    let base = 0;
    const amount = paymentAmount || 0;
    const outstanding = totalOutstandingForSelected;

    if (cdAt === 'paid_amount' || cdAt === 'payment_amount') {
        base = amount;
    } else if (cdAt === 'unpaid_amount') {
        base = outstanding;
    } else if (cdAt === 'full_amount') {
        base = amount + outstanding;
    }
    setCalculatedCdAmount(parseFloat(((base * cdPercent) / 100).toFixed(2)));
  }, [cdEnabled, paymentAmount, totalOutstandingForSelected, cdPercent, cdAt]);


  const processPayment = () => {
    if (selectedEntryIds.size === 0 || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries and enter a valid payment amount." });
      return;
    }
     if (paymentType === 'Partial' && paymentAmount > totalOutstandingForSelected) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
      return;
    }

    let remainingPayment = paymentAmount + calculatedCdAmount;
    const updatedCustomers = [...customers];

    selectedEntries.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // FIFO
      .forEach(entry => {
        const entryInArray = updatedCustomers.find(c => c.id === entry.id)!;
        const outstanding = parseFloat(String(entryInArray.netAmount));
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
        cdAmount: calculatedCdAmount,
        type: paymentType,
        receiptType: 'Online',
        notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`
    };

    const summary = customerSummary.get(selectedCustomerKey!)!;
    summary.paymentHistory.push(newPayment);
    setPaymentIdCounter(p => p + 1);

    setCustomers(updatedCustomers);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    toast({ title: "Success", description: "Payment processed successfully." });
  };
  
  const outstandingEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && parseFloat(String(c.netAmount)) > 0) : [];
  const paidEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && parseFloat(String(c.netAmount)) === 0) : [];
  const paymentHistory = selectedCustomerKey ? customerSummary.get(selectedCustomerKey)?.paymentHistory || [] : [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Select Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleCustomerSelect}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a supplier to process payments" />
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
                        <TableCell className="text-right">{parseFloat(String(entry.netAmount)).toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Payment Processing</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  <div className="p-4 border rounded-lg bg-card/30">
                      <p className="text-muted-foreground">Total Outstanding for Selected Entries:</p>
                      <p className="text-2xl font-bold text-primary">{totalOutstandingForSelected.toFixed(2)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          <Label htmlFor="payment-amount">Payment Amount</Label>
                          <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} />
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
                                    <SelectItem value="paid_amount">CD on Paid Amount</SelectItem>
                                    <SelectItem value="unpaid_amount">CD on Unpaid Amount (Selected)</SelectItem>
                                    <SelectItem value="payment_amount">CD on Payment Amount (Manual)</SelectItem>
                                    <SelectItem value="full_amount">CD on Full Amount (Selected)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Calculated CD Amount</Label>
                            <Input value={calculatedCdAmount.toFixed(2)} readOnly className="font-bold text-primary" />
                        </div>
                      </>}
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
                        <TableCell>{parseFloat(String(entry.amount)).toFixed(2)}</TableCell>
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

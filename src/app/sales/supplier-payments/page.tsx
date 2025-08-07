

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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash } from "lucide-react";

export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [paymentIdCounter, setPaymentIdCounter] = useState(0);
  const [isClient, setIsClient] = useState(false);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      try {
        const savedCustomers = localStorage.getItem("customers_data");
        setCustomers(savedCustomers ? JSON.parse(savedCustomers) : initialCustomers);

        const savedPayments = localStorage.getItem("payment_history");
        setPaymentHistory(savedPayments ? JSON.parse(savedPayments) : []);

        const savedCounter = localStorage.getItem("payment_id_counter");
        setPaymentIdCounter(savedCounter ? parseInt(savedCounter, 10) : 0);
      } catch (error) {
        console.error("Failed to load data from localStorage", error);
        setCustomers(initialCustomers);
        setPaymentHistory([]);
        setPaymentIdCounter(0);
      }
    }
  }, []);
  
  
 useEffect(() => {
    if(isClient) {
        localStorage.setItem("customers_data", JSON.stringify(customers));
    }
  }, [customers, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("payment_history", JSON.stringify(paymentHistory));
    }
  }, [paymentHistory, isClient]);

  const customerSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();
    
    customers.forEach(c => {
        if (!c.customerId) return;
        if (!summary.has(c.customerId)) {
            summary.set(c.customerId, {
                name: c.name,
                contact: c.contact,
                totalOutstanding: 0,
                paymentHistory: [],
                totalAmount: 0,
                totalPaid: 0,
                outstandingEntryIds: []
            });
        }
    });

    customers.forEach(customer => {
        if (!customer.customerId) return;
        const data = summary.get(customer.customerId)!;
        const netAmount = parseFloat(String(customer.netAmount));
        data.totalOutstanding += netAmount;
    });
    
    return summary;
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
    const currentPaymentAmount = paymentAmount || 0;
    const outstanding = totalOutstandingForSelected;

    if (cdAt === 'payment_amount') {
        base = currentPaymentAmount;
    } else if (cdAt === 'unpaid_amount') {
        base = outstanding;
    } else if (cdAt === 'full_amount') {
        base = outstanding; 
    } else if (cdAt === 'paid_amount') {
        if (selectedCustomerKey) {
            const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
            const paidAmountForSelectedEntries = paymentHistory
                .filter(p => {
                    const noteSrNos = p.notes.match(/S\d{5}/g) || [];
                    return noteSrNos.some(srNo => selectedSrNos.has(srNo));
                })
                .reduce((acc, p) => acc + p.amount, 0);
            base = paidAmountForSelectedEntries;
        }
    }
    setCalculatedCdAmount(parseFloat(((base * cdPercent) / 100).toFixed(2)));
  }, [cdEnabled, paymentAmount, totalOutstandingForSelected, cdPercent, cdAt, selectedEntries, paymentHistory, selectedCustomerKey]);


  const processPayment = () => {
    if (!selectedCustomerKey) {
        toast({ variant: 'destructive', title: "Error", description: "No supplier selected." });
        return;
    }
    if (selectedEntryIds.size === 0 || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries and enter a valid payment amount." });
      return;
    }
     if (paymentType === 'Partial' && paymentAmount > totalOutstandingForSelected) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
      return;
    }

    const newPaymentIdCounter = paymentIdCounter + 1;
    const newPayment: Payment = {
        paymentId: formatPaymentId(newPaymentIdCounter),
        customerId: selectedCustomerKey,
        date: new Date().toISOString().split("T")[0],
        amount: paymentAmount,
        cdAmount: calculatedCdAmount,
        type: paymentType,
        receiptType: 'Online',
        notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`
    };

    let remainingPayment = paymentAmount + calculatedCdAmount;
    const updatedCustomers = customers.map(c => {
        if(selectedEntryIds.has(c.id)){
             const outstanding = parseFloat(String(c.netAmount));
             if (remainingPayment >= outstanding) {
              remainingPayment -= outstanding;
              return {...c, netAmount: 0};
            } else {
              const newNetAmount = parseFloat((outstanding - remainingPayment).toFixed(2));
              remainingPayment = 0;
              return {...c, netAmount: newNetAmount};
            }
        }
        return c;
    });
    
    setCustomers(updatedCustomers);
    setPaymentHistory(prev => [...prev, newPayment]);
    
    setPaymentIdCounter(newPaymentIdCounter);
    if(isClient) {
        localStorage.setItem('payment_id_counter', String(newPaymentIdCounter));
    }

    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    toast({ title: "Success", description: "Payment processed successfully." });
  };
  
  const handleDeletePayment = (paymentIdToDelete: string) => {
    if (!selectedCustomerKey) return;

    const paymentToDelete = paymentHistory.find(p => p.paymentId === paymentIdToDelete);
    if (!paymentToDelete) return;
    
    const updatedPaymentHistory = paymentHistory.filter(p => p.paymentId !== paymentIdToDelete);

    const srNosInPayment = paymentToDelete.notes.match(/S\d{5}/g) || [];
    const amountToRestore = paymentToDelete.amount + paymentToDelete.cdAmount;

    let tempAmountToRestore = amountToRestore;

    const updatedCustomers = customers.map(c => {
        if (srNosInPayment.includes(c.srNo)) {
            const originalEntry = initialCustomers.find(ic => ic.srNo === c.srNo);
            const originalAmount = originalEntry ? Number(originalEntry.netAmount) : Number(c.amount);

            const currentNet = Number(c.netAmount);
            const restoredAmountForThisEntry = Math.min(tempAmountToRestore, originalAmount - currentNet);
            
            const newNet = currentNet + restoredAmountForThisEntry;
            tempAmountToRestore -= restoredAmountForThisEntry;
            
            return { ...c, netAmount: newNet };
        }
        return c;
    });
    
    setCustomers(updatedCustomers);
    setPaymentHistory(updatedPaymentHistory);

    toast({ title: 'Payment Deleted', description: `Payment ${paymentIdToDelete} has been removed and outstanding amounts updated.` });
};

  const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
  const outstandingEntries = useMemo(() => selectedCustomerKey ? customers.filter(c => c.customerId === customerIdKey && parseFloat(String(c.netAmount)) > 0) : [], [customers, selectedCustomerKey, customerIdKey]);
  const paidEntries = useMemo(() => selectedCustomerKey ? customers.filter(c => c.customerId === customerIdKey && parseFloat(String(c.netAmount)) === 0 && c.amount > 0) : [], [customers, selectedCustomerKey, customerIdKey]);
  const currentPaymentHistory = useMemo(() => selectedCustomerKey ? paymentHistory.filter(p => p.customerId === selectedCustomerKey) : [], [paymentHistory, selectedCustomerKey]);
  
  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Select Supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleCustomerSelect} value={selectedCustomerKey || undefined}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="Select a supplier to process payments" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(customerSummaryMap.entries()).map(([key, data]) => (
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
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>CD Amount</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {currentPaymentHistory.map(p => (
                        <TableRow key={p.paymentId}>
                        <TableCell>{p.paymentId}</TableCell>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>{p.amount.toFixed(2)}</TableCell>
                        <TableCell>{p.cdAmount.toFixed(2)}</TableCell>
                        <TableCell>{p.notes}</TableCell>
                        <TableCell>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><Trash className="h-4 w-4 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete payment {p.paymentId} and restore the outstanding amount. This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeletePayment(p.paymentId)}>Continue</AlertDialogAction>
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
      )}
    </div>
  );
}
 

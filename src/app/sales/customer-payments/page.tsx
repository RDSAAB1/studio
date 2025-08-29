

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateCustomerFirestore } from "@/lib/firestore";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  // Note: 'payment_amount' and 'full_amount' options for CD calculation might be less common/intuitive in a real scenario. Review if needed.
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [paymentIdCounter, setPaymentIdCounter] = useState(0);

  const customerSummary = useMemo(() => {
    const newSummary = new Map<string, CustomerSummary>();
    customers.forEach(entry => {
      if (!entry.name || !entry.contact) return;
      const key = `${entry.name.toLowerCase()}|${entry.contact.toLowerCase()}`;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name,
          contact: entry.contact,
          totalOutstanding: 0,
          paymentHistory: [], // This will be populated if you fetch payment history
          outstandingEntryIds: [],
        });
      }
      const data = newSummary.get(key)!;
      if (parseFloat(String(entry.netAmount)) > 0) {
        data.totalOutstanding += parseFloat(String(entry.netAmount));
        data.outstandingEntryIds.push(entry.id);
      }
    });
    return newSummary;
  }, [customers]);

   const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!db) return; // Ensure db is initialized

    const q = query(collection(db, "customers"), orderBy("date", "asc")); // Order by date, or maybe srNo?

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customersData: Customer[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          srNo: data.srNo,
          date: data.date, // Stored as ISO string
          term: data.term,
          dueDate: data.dueDate, // Stored as ISO string
          name: data.name,
          so: data.so,
          address: data.address,
          contact: data.contact,
          vehicleNo: data.vehicleNo,
          variety: data.variety,
          grossWeight: data.grossWeight,
          teirWeight: data.teirWeight,
          weight: data.weight,
          kartaPercentage: data.kartaPercentage,
          kartaWeight: data.kartaWeight,
          kartaAmount: data.kartaAmount,
          netWeight: data.netWeight,
          rate: data.rate,
          labouryRate: data.labouryRate,
          labouryAmount: data.labouryAmount,
          kanta: data.kanta,
          otherCharges: data.otherCharges, // Ensure this field is included if used
          amount: data.amount,
          netAmount: data.netAmount,
          originalNetAmount: data.originalNetAmount || data.amount, // Store original amount
          barcode: data.barcode || '',
          receiptType: data.receiptType || 'Cash',
          paymentType: data.paymentType || 'Full',
          customerId: data.customerId,
          searchValue: data.searchValue || '',
          payments: data.payments || [], // Ensure payments array is included
        } as Customer; // Cast to Customer type
      });

      setCustomers(customersData);
      if (isInitialLoad.current) {
          isInitialLoad.current = false;
      }
    }, (error) => {
      console.error("Error fetching customers:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to load customer data." });
    });

    // Clean up listener on unmount
    return () => unsubscribe();
  }, [toast]); // Empty dependency array means this runs once on mount

    // Preserve selected customer and entries on data update
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
  }, [customers, selectedEntryIds]); // Depend on customers state

  const totalOutstandingForSelected = useMemo(() => {
    return selectedEntries.reduce((acc, entry) => acc + parseFloat(String(entry.netAmount)), 0);
  }, [selectedEntries]); // Depend on selectedEntries
  
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

  // Function to process payment and update Firestore
  const processPayment = () => {
    if (selectedEntryIds.size === 0 || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries and enter a valid payment amount." });
      return;
    }
     if (paymentType === 'Partial' && paymentAmount > totalOutstandingForSelected) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
      return;
    }

    // Calculate total amount paid including CD
    let remainingPayment = paymentAmount + calculatedCdAmount;

    // Create the new payment object
    const newPayment: Payment = {
      paymentId: formatPaymentId(paymentIdCounter + 1), // This counter logic needs persistence, perhaps in Firestore or a cloud function
      date: new Date().toISOString().split("T")[0],
      amount: paymentAmount,
      cdAmount: calculatedCdAmount,
      type: paymentType,
      receiptType: 'Online', // Or add a selection for this
      notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`,
      entryIds: Array.from(selectedEntryIds) // Store which entries this payment is for
    };

    // Prepare updates for selected entries
    const updates = selectedEntries
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // FIFO
      .map(entry => {
        const outstanding = parseFloat(String(entry.netAmount));
        let updatedNetAmount;

        if (remainingPayment >= outstanding) {
          updatedNetAmount = 0;
          remainingPayment -= outstanding;
        } else {
          updatedNetAmount = parseFloat((outstanding - remainingPayment).toFixed(2));
          remainingPayment = 0;
        }

        // Add payment to the entry's payment history
         const updatedPayments = [...(entry.payments || []), newPayment]; // Append new payment

        return {
          ...entry, // Keep existing data
          netAmount: updatedNetAmount, // Update netAmount
          payments: updatedPayments // Update payments array
        };
      });

    // Batch write to update all selected entries in Firestore
    // This requires a batch operation if updating multiple documents
    const batch = db.batch();
    updates.forEach(update => {
        const docRef = db.collection('customers').doc(update.id);
        batch.update(docRef, { netAmount: update.netAmount, payments: update.payments });
    });

    batch.commit().then(() => {
        // No need to update local state directly, listener will handle it
        setSelectedEntryIds(new Set());
        setPaymentAmount(0);
        setCdEnabled(false); // Reset CD state
        toast({ title: "Success", description: "Payment processed successfully." });
    }).catch(error => {
        console.error("Error processing payment:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to process payment." });
    });
  };
  
  const outstandingEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && parseFloat(String(c.netAmount)) > 0) : [];
  const paidEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && parseFloat(String(c.netAmount)) === 0) : [];
  const paymentHistory = selectedCustomerKey ? customerSummary.get(selectedCustomerKey)?.paymentHistory || [] : [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>Select Customer</CardTitle></CardHeader>
        <CardContent>
          {isInitialLoad.current ? (
             <Skeleton className="w-full md:w-1/2 h-10" />
          ) : (
              <Select onValueChange={handleCustomerSelect} value={selectedCustomerKey || ''}>
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
          )}
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
                  </div> {/* End grid */}

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
                {paymentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>CD Amount</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {paymentHistory.map(p => (
                        <TableRow key={p.paymentId + p.date}> {/* Add date to key just in case paymentId repeats (which it shouldn't) */}
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
                ) : (
                    <p className="text-muted-foreground text-sm">No payment history available for this customer.</p>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

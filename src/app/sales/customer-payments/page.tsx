
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase, formatSrNo, formatCurrency } from "@/lib/utils";
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
import { useToast } from "@/hooks/use-toast";
import { Info, Pen, Printer, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { collection, query, onSnapshot, orderBy, writeBatch, doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { getReceiptSettings, updateReceiptSettings } from "@/lib/firestore";
import type { ReceiptSettings } from "@/lib/definitions";
import { Separator } from "@/components/ui/separator";

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className="flex items-start gap-3">
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);


export default function CustomerPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [receiptNo, setReceiptNo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Payment[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Payment | null>(null);

  const customerSummary = useMemo(() => {
    const newSummary = new Map<string, CustomerSummary>();
    customers.forEach(entry => {
      if (!entry.name || !entry.contact) return;
      const key = entry.customerId || `${entry.name.toLowerCase()}|${entry.contact.toLowerCase()}`;
      if (!newSummary.has(key)) {
        newSummary.set(key, {
          name: entry.name,
          contact: entry.contact,
          totalOutstanding: 0,
          paymentHistory: [],
          outstandingEntryIds: [],
        } as CustomerSummary);
      }
      const data = newSummary.get(key)!;
      const receivableAmount = parseFloat(String(entry.netAmount)) || 0;
      if (receivableAmount > 0) {
        data.totalOutstanding += receivableAmount;
        data.outstandingEntryIds.push(entry.id);
      }
    });
    
    paymentHistory.forEach(payment => {
        if(payment.customerId && newSummary.has(payment.customerId)) {
            const summary = newSummary.get(payment.customerId)!;
            summary.paymentHistory.push(payment);
        }
    });

    return newSummary;
  }, [customers, paymentHistory]);

  const getNextReceiptNo = useCallback((payments: Payment[]) => {
      if (!payments || payments.length === 0) {
          return formatSrNo(1, 'CR');
      }
      const lastNum = payments.reduce((max, p) => {
          const numMatch = p.paymentId?.match(/^CR(\d+)$/);
          const num = numMatch ? parseInt(numMatch[1], 10) : 0;
          return num > max ? num : max;
      }, 0);
      return formatSrNo(lastNum + 1, 'CR');
  }, []);

  useEffect(() => {
    setLoading(true);
    const customersQuery = query(collection(db, "customers"), orderBy("date", "desc"));
    const paymentsQuery = query(collection(db, "payments"), orderBy("date", "desc"));

    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to load customer data." });
      setLoading(false);
    });
    
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
        const paymentsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Payment));
        setPaymentHistory(paymentsData);
        if (!editingPayment) {
            setReceiptNo(getNextReceiptNo(paymentsData));
        }
    }, (error) => {
         console.error("Error fetching payments:", error);
         toast({ variant: 'destructive', title: "Error", description: "Failed to load payment history." });
    });

     const fetchSettings = async () => {
        const settings = await getReceiptSettings();
        if (settings) {
            setReceiptSettings(settings);
        }
    };
    fetchSettings();


    return () => {
        unsubscribeCustomers();
        unsubscribePayments();
    };
  }, [toast, getNextReceiptNo, editingPayment]);
  
  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setPaymentType('Full');
    setEditingPayment(null);
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

  const totalReceivableForSelected = useMemo(() => {
    return selectedEntries.reduce((acc, entry) => acc + (parseFloat(String(entry.netAmount)) || 0), 0);
  }, [selectedEntries]);
  
  useEffect(() => {
    if(paymentType === 'Full') {
        setPaymentAmount(totalReceivableForSelected);
    }
  }, [paymentType, totalReceivableForSelected]);

  const processPayment = async () => {
    if (selectedEntryIds.size === 0 || paymentAmount <= 0) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries and enter a valid payment amount." });
      return;
    }
     if (paymentType === 'Partial' && paymentAmount > totalReceivableForSelected) {
      toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total receivable." });
      return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const tempEditingPayment = editingPayment;
            
            // Revert previous payment if editing
            if(tempEditingPayment) {
                for (const detail of tempEditingPayment.paidFor || []) {
                    const customerDocRef = doc(db, "customers", detail.srNo);
                    const customerDoc = await transaction.get(customerDocRef);
                    if(customerDoc.exists()){
                        const currentNetAmount = Number(customerDoc.data().netAmount) || 0;
                        const amountToRestore = detail.amount;
                        transaction.update(customerDocRef, { netAmount: currentNetAmount + amountToRestore });
                    }
                }
            }

            const paymentData = {
                id: tempEditingPayment ? tempEditingPayment.id : receiptNo,
                paymentId: tempEditingPayment ? tempEditingPayment.paymentId : receiptNo,
                customerId: selectedCustomerKey,
                date: new Date().toISOString(),
                amount: paymentAmount,
                type: paymentType,
                receiptType: 'Cash', // Placeholder, could be a form field
                notes: `Received payment for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`,
                paidFor: [],
                cdAmount: 0, 
                cdApplied: false,
            };

            let remainingPayment = paymentAmount;
            const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            for (const entry of sortedEntries) {
                if (remainingPayment <= 0) break;
                
                const customerDocRef = doc(db, "customers", entry.id);
                const customerDoc = await transaction.get(customerDocRef);
                
                if (customerDoc.exists()) {
                    const receivable = parseFloat(String(customerDoc.data().netAmount)) || 0;
                    const paymentForThisEntry = Math.min(receivable, remainingPayment);
                    const newNetAmount = receivable - paymentForThisEntry;

                    transaction.update(customerDocRef, { netAmount: newNetAmount });

                    (paymentData.paidFor as any).push({ srNo: entry.srNo, amount: paymentForThisEntry });
                    remainingPayment -= paymentForThisEntry;
                }
            }
            
            const paymentRef = doc(db, "payments", paymentData.id);
            transaction.set(paymentRef, paymentData);
        });

        toast({ title: "Success", description: `Payment ${editingPayment ? 'updated' : 'recorded'} successfully.` });
        setSelectedEntryIds(new Set());
        setPaymentAmount(0);
        setPaymentType('Full');
        setEditingPayment(null);

    } catch(error) {
        console.error("Error processing payment:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to process payment." });
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setSelectedCustomerKey(payment.customerId);
    const srNos = payment.paidFor?.map(pf => pf.srNo) || [];
    const entryIds = customers.filter(c => srNos.includes(c.srNo)).map(c => c.id);
    setSelectedEntryIds(new Set(entryIds));
    setPaymentAmount(payment.amount);
    setPaymentType(payment.type);
    setReceiptNo(payment.paymentId);
  };
  
  const handleDeletePayment = async (paymentId: string) => {
      const paymentToDelete = paymentHistory.find(p => p.id === paymentId);
      if(!paymentToDelete) return;
      
      try {
          await runTransaction(db, async (transaction) => {
               for (const detail of paymentToDelete.paidFor || []) {
                    const customerDocRef = doc(db, "customers", detail.srNo);
                    const customerDoc = await transaction.get(customerDocRef);
                    if(customerDoc.exists()){
                        const currentNetAmount = Number(customerDoc.data().netAmount) || 0;
                        const amountToRestore = detail.amount;
                        transaction.update(customerDocRef, { netAmount: currentNetAmount + amountToRestore });
                    }
                }
                const paymentRef = doc(db, "payments", paymentToDelete.id);
                transaction.delete(paymentRef);
          });
          toast({title: "Success", description: "Payment deleted successfully."});
      } catch (error) {
          console.error("Error deleting payment:", error);
          toast({variant: "destructive", title: "Error", description: "Failed to delete payment."});
      }
  };

  const handlePrintPayment = (payment: Payment) => {
    // This is a placeholder for printing. We need to create a receipt component.
    const customer = customers.find(c => c.customerId === payment.customerId);
    if(customer) {
        const receiptData = { ...customer, netAmount: payment.amount, originalNetAmount: payment.amount, date: payment.date };
        setReceiptsToPrint([receiptData]);
    } else {
        toast({variant: 'destructive', title: "Error", description: "Customer not found for this payment."})
    }
  };
  
  const receivableEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && (parseFloat(String(c.netAmount)) || 0) > 0) : [];
  const customerPayments = selectedCustomerKey ? paymentHistory.filter(p => p.customerId === selectedCustomerKey) : [];
  
  if (loading) {
    return (
        <div className="space-y-8 p-4">
            <Card><CardHeader><CardTitle><Skeleton className="h-6 w-1/4" /></CardTitle></CardHeader><CardContent><Skeleton className="h-10 w-1/2" /></CardContent></Card>
            <Card><CardHeader><CardTitle><Skeleton className="h-6 w-1/3" /></CardTitle></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
        </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader><CardTitle>Select Customer</CardTitle></CardHeader>
        <CardContent>
            <Select onValueChange={handleCustomerSelect} value={selectedCustomerKey || ''}>
                <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Select a customer to receive payments" />
                </SelectTrigger>
                <SelectContent>
                    {Array.from(customerSummary.entries()).map(([key, data]) => (
                    <SelectItem key={key} value={key}>
                        {toTitleCase(data.name)} ({data.contact}) - Receivable: {formatCurrency(data.totalOutstanding)}
                    </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      {selectedCustomerKey && (
        <>
          <Card>
            <CardHeader><CardTitle>Receivable Entries</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><Checkbox onCheckedChange={(checked) => {
                            const newSet = new Set<string>();
                            if(checked) {
                                receivableEntries.forEach(e => newSet.add(e.id));
                            }
                            setSelectedEntryIds(newSet);
                        }}
                        checked={selectedEntryIds.size > 0 && selectedEntryIds.size === receivableEntries.length}
                         /></TableHead>
                        <TableHead>SR No</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount Receivable</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {receivableEntries.map(entry => (
                        <TableRow key={entry.id} data-state={selectedEntryIds.has(entry.id) ? "selected" : ""}>
                        <TableCell><Checkbox checked={selectedEntryIds.has(entry.id)} onCheckedChange={() => handleEntrySelect(entry.id)} /></TableCell>
                        <TableCell>{entry.srNo}</TableCell>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.dueDate}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                        </TableRow>
                    ))}
                     {receivableEntries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No receivable entries found for this customer.</TableCell>
                        </TableRow>
                     )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>{editingPayment ? `Editing Payment ${editingPayment.paymentId}` : "Receive Payment"}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  <div className="p-4 border rounded-lg bg-card/30">
                      <p className="text-muted-foreground">Total Receivable for Selected Entries:</p>
                      <p className="text-2xl font-bold text-primary">{formatCurrency(totalReceivableForSelected)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="receipt-no">Receipt No.</Label>
                        <Input id="receipt-no" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} readOnly={!!editingPayment} />
                      </div>
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
                  </div>
                  <Button onClick={processPayment} disabled={selectedEntryIds.size === 0}>
                    {editingPayment ? 'Update Payment' : 'Receive Payment'}
                  </Button>
                   {editingPayment && <Button variant="outline" onClick={() => { setEditingPayment(null); setSelectedEntryIds(new Set()); setPaymentAmount(0); }}>Cancel Edit</Button>}
              </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
             <CardContent>
                {customerPayments.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Payment ID</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Notes</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {customerPayments.map(p => (
                        <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.paymentId}</TableCell>
                        <TableCell>{p.date}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes}</TableCell>
                        <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPaymentDetails(p)}><Info className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditPayment(p)}><Pen className="h-4 w-4" /></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete payment {p.paymentId} and restore outstanding amounts.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeletePayment(p.id)}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintPayment(p)}><Printer className="h-4 w-4" /></Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
                ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No payment history available for this customer.</p>
                )}
            </CardContent>
          </Card>
        </>
      )}

    <ReceiptPrintDialog
        receipts={receiptsToPrint}
        settings={receiptSettings}
        onOpenChange={() => setReceiptsToPrint([])}
        isCustomer={true}
      />
      
    <Dialog open={!!paymentDetails} onOpenChange={() => setPaymentDetails(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Payment Details: {paymentDetails?.paymentId}</DialogTitle>
            </DialogHeader>
            {paymentDetails && (
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <DetailItem label="Payment Date" value={new Date(paymentDetails.date).toLocaleDateString()} />
                        <DetailItem label="Total Amount Paid" value={formatCurrency(paymentDetails.amount)} />
                        <DetailItem label="Payment Type" value={paymentDetails.type} />
                        <DetailItem label="Payment Method" value={paymentDetails.receiptType} />
                    </div>
                    <Separator />
                    <h4 className="font-semibold">Entries Paid in this Transaction</h4>
                    <div className="border rounded-lg max-h-64 overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>SR No</TableHead>
                                    <TableHead className="text-right">Amount Paid</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paymentDetails.paidFor?.length ? paymentDetails.paidFor.map(pf => (
                                    <TableRow key={pf.srNo}>
                                        <TableCell>{pf.srNo}</TableCell>
                                        <TableCell className="text-right font-semibold">{formatCurrency(pf.amount)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No entries found for this payment.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </DialogContent>
    </Dialog>

    </div>
  );
}

    
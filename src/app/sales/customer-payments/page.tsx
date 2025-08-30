
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Customer, CustomerSummary, Payment } from "@/lib/definitions";
import { toTitleCase, formatSrNo, formatCurrency, cn } from "@/lib/utils";
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
import { Info, Pen, Printer, Trash2, Loader2, ChevronsUpDown, Check, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { collection, query, onSnapshot, orderBy, writeBatch, doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { getReceiptSettings, updateReceiptSettings } from "@/lib/firestore";
import type { ReceiptSettings } from "@/lib/definitions";
import { Separator } from "@/components/ui/separator";
import { DetailsDialog as CustomerDetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { OutstandingEntriesDialog } from "@/components/sales/supplier-payments/outstanding-entries-dialog";


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
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<Payment | null>(null);
  const [detailsEntry, setDetailsEntry] = useState<Customer | null>(null);
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const customerSummary = useMemo(() => {
    const newSummary = new Map<string, CustomerSummary>();
    customers.forEach(entry => {
      if (!entry.customerId) return;
      if (!newSummary.has(entry.customerId)) {
        newSummary.set(entry.customerId, {
          name: entry.name,
          contact: entry.contact,
          totalOutstanding: 0,
          paymentHistory: [],
          outstandingEntryIds: [],
        } as CustomerSummary);
      }
      const data = newSummary.get(entry.customerId)!;
      const receivableAmount = parseFloat(String(entry.netAmount)) || 0;
      data.totalOutstanding += receivableAmount;
      if (receivableAmount > 0) {
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
    setIsOutstandingModalOpen(true); // Automatically open modal
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
                date: new Date().toISOString().split('T')[0],
                amount: paymentAmount,
                type: paymentType,
                receiptType: 'Cash', // Placeholder, could be a form field
                notes: selectedEntries.map(e => e.srNo).join(', '),
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
        setReceiptNo(getNextReceiptNo(paymentHistory));

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
    const customer = customers.find(c => c.customerId === payment.customerId);
    if(customer) {
        const receiptData = { ...customer, netAmount: payment.amount, originalNetAmount: payment.amount, date: payment.date };
        setReceiptsToPrint([receiptData]);
    } else {
        toast({variant: 'destructive', title: "Error", description: "Customer not found for this payment."})
    }
  };
  
  const handleShowDetails = (payment: Payment) => {
      const paidForSrNos = payment.paidFor?.map(pf => pf.srNo) || [];
      if (paidForSrNos.length === 1) {
          const entry = customers.find(c => c.srNo === paidForSrNos[0]);
          if (entry) {
              setDetailsEntry(entry);
              return;
          }
      }
      setPaymentDetails(payment);
  };
  
  const handleConfirmSelection = () => {
    if (selectedEntryIds.size === 0) {
      toast({ variant: "destructive", title: "No Entries Selected", description: "Please select entries to pay." });
      return;
    }
    setIsOutstandingModalOpen(false);
  }

  const handleCancelSelection = () => {
    setIsOutstandingModalOpen(false);
    setSelectedCustomerKey(null);
    setSelectedEntryIds(new Set());
  }

  const receivableEntries = selectedCustomerKey ? customers.filter(c => c.customerId === selectedCustomerKey && (parseFloat(String(c.netAmount)) || 0) > 0) : [];
  const customerPayments = selectedCustomerKey ? paymentHistory.filter(p => p.customerId === selectedCustomerKey) : [];
  
  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-4 text-muted-foreground">Loading Customer Data...</span>
        </div>
    )
  }

  return (
    <div className="space-y-6">
       <Card>
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Label htmlFor="supplier-select" className="text-sm font-semibold whitespace-nowrap">Select Customer:</Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={openCombobox} className="h-9 text-sm flex-1 justify-between font-normal">
                      {selectedCustomerKey ? `${toTitleCase(customerSummary.get(selectedCustomerKey)?.name || '')} (${customerSummary.get(selectedCustomerKey)?.contact || ''})` : "Search and select customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50">
                    <Command>
                        <CommandInput placeholder="Search by name or contact..." />
                        <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                                {Array.from(customerSummary.entries()).map(([key, data]) => (
                                    <CommandItem key={key} value={`${data.name} ${data.contact}`} onSelect={() => { handleCustomerSelect(key); setOpenCombobox(false); }}>
                                      <Check className={cn("mr-2 h-4 w-4", selectedCustomerKey === key ? "opacity-100" : "opacity-0")}/>{toTitleCase(data.name)} ({data.contact}) - bal: {formatCurrency(data.totalOutstanding)}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {selectedCustomerKey && (
        <>
          <Card>
              <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 border rounded-lg bg-card/30">
                      <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground">Total Receivable for Selected Entries</p>
                          <p className="text-xl font-bold text-primary">{formatCurrency(totalReceivableForSelected)}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)}><RefreshCw className="mr-2 h-3 w-3"/>Change Selection</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="receipt-no" className="text-xs">Receipt No.</Label>
                        <Input id="receipt-no" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} readOnly={!!editingPayment} className="h-9 text-sm"/>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Payment Type</Label>
                        <Select value={paymentType} onValueChange={setPaymentType}><SelectTrigger className="h-9 text-sm"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Full">Full</SelectItem><SelectItem value="Partial">Partial</SelectItem></SelectContent></Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="payment-amount" className="text-xs">Payment Amount</Label>
                          <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-9 text-sm"/>
                      </div>
                      <Button onClick={processPayment} disabled={selectedEntryIds.size === 0} className="self-end h-9">
                        {editingPayment ? 'Update Payment' : 'Receive Payment'}
                      </Button>
                  </div>
                   {editingPayment && <Button variant="outline" onClick={() => { setEditingPayment(null); setSelectedEntryIds(new Set()); setPaymentAmount(0); }}>Cancel Edit</Button>}
              </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle className="text-base">Payment History for {toTitleCase(customerSummary.get(selectedCustomerKey)?.name || '')}</CardTitle></CardHeader>
             <CardContent>
                {customerPayments.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Payment ID</TableHead><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {customerPayments.map(p => (
                        <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.paymentId}</TableCell>
                        <TableCell className="text-xs">{new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShowDetails(p)}><Info className="h-4 w-4" /></Button>
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
                                            <AlertDialogAction onClick={() => p.id && handleDeletePayment(p.id)}>Continue</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintPayment(p)}><Printer className="h-4 w-4" /></Button>
                            </div>
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

    <CustomerDetailsDialog 
        isOpen={!!detailsEntry}
        customer={detailsEntry}
        onOpenChange={() => setDetailsEntry(null)}
        paymentHistory={paymentHistory}
        onPrint={() => { if(detailsEntry) { setReceiptsToPrint([detailsEntry]); setDetailsEntry(null); } }}
    />
      
    <PaymentDetailsDialog
        payment={paymentDetails}
        onOpenChange={() => setPaymentDetails(null)}
        customers={customers}
    />

     <OutstandingEntriesDialog
        isOpen={isOutstandingModalOpen}
        onOpenChange={setIsOutstandingModalOpen}
        customerName={toTitleCase(customerSummary.get(selectedCustomerKey || '')?.name || '')}
        entries={receivableEntries}
        selectedIds={selectedEntryIds}
        onSelect={handleEntrySelect}
        onSelectAll={(checked: boolean) => {
            const newSet = new Set<string>();
            if(checked) receivableEntries.forEach(e => newSet.add(e.id));
            setSelectedEntryIds(newSet);
        }}
        onConfirm={handleConfirmSelection}
        onCancel={handleCancelSelection}
    />
    </div>
  );
}

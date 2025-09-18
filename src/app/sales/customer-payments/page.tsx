
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Customer, CustomerSummary, CustomerPayment, BankAccount, Transaction, FundTransaction, PaidFor, Income, Expense, ReceiptSettings } from "@/lib/definitions";
import { toTitleCase, formatSrNo, formatCurrency, cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Info, Pen, Printer, Trash2, Loader2, ChevronsUpDown, Check, RefreshCw, HandCoins } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { collection, runTransaction, doc, getDocs, where, limit } from "firebase/firestore";
import { db as firestoreDB } from "@/lib/firebase";
import { ReceiptPrintDialog } from "@/components/sales/print-dialogs";
import { getReceiptSettings, addCustomerPayment, deleteCustomerPayment } from "@/lib/firestore";
import { DetailsDialog as CustomerDetailsDialog } from "@/components/sales/details-dialog";
import { PaymentDetailsDialog } from "@/components/sales/supplier-payments/payment-details-dialog";
import { OutstandingEntriesDialog } from "@/components/sales/supplier-payments/outstanding-entries-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/database';


const customersCollection = collection(firestoreDB, "customers");
const incomesCollection = collection(firestoreDB, "incomes");
const expensesCollection = collection(firestoreDB, "expenses");


export default function CustomerPaymentsPage() {
  const { toast } = useToast();
  const customers = useLiveQuery(() => db.mainDataStore.where('collection').equals('customers').toArray()) || [];
  const paymentHistory = useLiveQuery(() => db.mainDataStore.where('collection').equals('customer_payments').toArray()) || [];
  const bankAccounts = useLiveQuery(() => db.mainDataStore.where('collection').equals('bankAccounts').toArray()) || [];
  const incomes = useLiveQuery(() => db.mainDataStore.where('collection').equals('incomes').toArray()) || [];
  const expenses = useLiveQuery(() => db.mainDataStore.where('collection').equals('expenses').toArray()) || [];
  const fundTransactions = useLiveQuery(() => db.mainDataStore.where('collection').equals('fund_transactions').toArray()) || [];
  
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [selectedAccountId, setSelectedAccountId] = useState<string>('CashInHand');

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [receiptNo, setReceiptNo] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [receiptsToPrint, setReceiptsToPrint] = useState<Customer[]>([]);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<CustomerPayment | null>(null);
  const [detailsEntry, setDetailsEntry] = useState<Customer | null>(null);
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('processing');
  
  const allTransactions = useMemo(() => [...incomes, ...expenses], [incomes, expenses]);

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

  const getNextReceiptNo = useCallback((payments: CustomerPayment[]) => {
      if (!payments || payments.length === 0) {
          return formatSrNo(1, 'R');
      }
      const customerReceipts = payments.filter(p => p.paymentId.startsWith('CP'));
      const lastNum = customerReceipts.reduce((max, p) => {
          const numMatch = p.paymentId?.match(/^CP(\d+)$/);
          const num = numMatch ? parseInt(numMatch[1], 10) : 0;
          return num > max ? num : max;
      }, 0);
      return formatSrNo(lastNum + 1, 'R');
  }, []);
  
  useEffect(() => {
      if(customers.length > 0) setLoading(false);
  }, [customers]);

  useEffect(() => {
    getReceiptSettings().then(setReceiptSettings);
    if (paymentHistory && !editingPayment) {
        setReceiptNo(getNextReceiptNo(paymentHistory));
    }
  }, [paymentHistory, getNextReceiptNo, editingPayment]);
  
  const handleCustomerSelect = (key: string | null) => {
    setSelectedCustomerKey(key);
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setPaymentType('Full');
    setEditingPayment(null);
    if(key) {
        setIsOutstandingModalOpen(true);
    }
  };

  const selectedEntries = useMemo(() => customers.filter(c => selectedEntryIds.has(c.id)), [customers, selectedEntryIds]);
  const totalReceivableForSelected = useMemo(() => selectedEntries.reduce((acc, entry) => acc + (parseFloat(String(entry.netAmount)) || 0), 0), [selectedEntries]);
  
  useEffect(() => {
    if(paymentType === 'Full') setPaymentAmount(totalReceivableForSelected);
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
        await runTransaction(firestoreDB, async (transaction) => {
            const paymentData: Omit<CustomerPayment, 'id'> = {
                paymentId: editingPayment ? editingPayment.paymentId : receiptNo,
                customerId: selectedCustomerKey!, 
                date: new Date().toISOString().split('T')[0],
                amount: paymentAmount, 
                type: paymentType as 'Full' | 'Partial', 
                paymentMethod: selectedAccountId === 'CashInHand' ? 'Cash' : 'Online',
                notes: `Payment for SR# ${selectedEntries.map(e => e.srNo).join(', ')}`,
                paidFor: [],
            };

            let remainingPayment = paymentAmount;
            for (const entry of selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
                if (remainingPayment <= 0) break;
                const customerDocRef = doc(firestoreDB, "customers", entry.id);
                const receivable = parseFloat(String(entry.netAmount)) || 0;
                const paymentForThisEntry = Math.min(receivable, remainingPayment);
                transaction.update(customerDocRef, { netAmount: receivable - paymentForThisEntry });
                (paymentData.paidFor as any).push({ srNo: entry.srNo, amount: paymentForThisEntry });
                remainingPayment -= paymentForThisEntry;
            }
            
            const incomeTransaction: Omit<Transaction, 'id'> = {
                date: new Date().toISOString().split('T')[0],
                transactionType: 'Income', category: 'Sales', subCategory: 'Customer Payment',
                amount: paymentAmount, payee: customerSummary.get(selectedCustomerKey!)?.name || 'Customer',
                description: `Payment ${paymentData.paymentId} from ${customerSummary.get(selectedCustomerKey!)?.name || 'customer'}.`,
                paymentMethod: selectedAccountId === 'CashInHand' ? 'Cash' : 'Online',
                bankAccountId: selectedAccountId === 'CashInHand' ? undefined : selectedAccountId,
                status: 'Paid', isRecurring: false
            };
            
            const newTransactionRef = doc(collection(firestoreDB, 'incomes'));
            transaction.set(newTransactionRef, {...incomeTransaction, id: newTransactionRef.id});
            paymentData.incomeTransactionId = newTransactionRef.id;
            paymentData.bankAccountId = selectedAccountId === 'CashInHand' ? undefined : selectedAccountId;
            
            if (editingPayment && editingPayment.id) {
                const paymentRef = doc(firestoreDB, "customer_payments", editingPayment.id);
                transaction.set(paymentRef, paymentData);
            } else {
                const newPaymentRef = doc(collection(firestoreDB, "customer_payments"));
                await addCustomerPayment({...paymentData, id: newPaymentRef.id});
            }
        });

        toast({ title: "Success", description: "Payment recorded successfully." });
        setSelectedEntryIds(new Set()); setPaymentAmount(0); setPaymentType('Full'); setEditingPayment(null);
        setReceiptNo(getNextReceiptNo(paymentHistory));
    } catch(error) {
        console.error("Error processing payment:", error);
        toast({ variant: 'destructive', title: "Error", description: "Failed to process payment." });
    }
  };
  
    const handleEditPayment = async (paymentToEdit: CustomerPayment) => {
        if (!paymentToEdit.id) return;
        
        setActiveTab('processing');
        setSelectedCustomerKey(paymentToEdit.customerId);
        setEditingPayment(paymentToEdit);
        setReceiptNo(paymentToEdit.paymentId);
        setPaymentAmount(paymentToEdit.amount);
        setPaymentType(paymentToEdit.type);
        setSelectedAccountId(paymentToEdit.bankAccountId || 'CashInHand');

        const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
        
        if (srNosInPayment.length > 0) {
          const q = query(customersCollection, where('srNo', 'in', srNosInPayment));
          const customerDocs = await getDocs(q);
          const foundSrNos = new Set(customerDocs.docs.map(d => d.data().srNo));
          
          if (foundSrNos.size !== srNosInPayment.length) {
              toast({ title: "Cannot Edit", description: "One or more original entries for this payment are missing.", variant: "destructive" });
              return;
          }

          const newSelectedEntryIds = new Set<string>();
          customerDocs.forEach(doc => newSelectedEntryIds.add(doc.id));
          setSelectedEntryIds(newSelectedEntryIds);
        } else {
            setSelectedEntryIds(new Set());
        }
        
        toast({ title: `Editing Payment ${paymentToEdit.paymentId}`, description: "Details loaded. Make changes and re-save."});
    };

    const handleDeletePayment = async (paymentIdToDelete: string) => {
        const paymentToDelete = paymentHistory.find(p => p.id === paymentIdToDelete);
        if (!paymentToDelete || !paymentToDelete.id) {
            toast({ title: "Payment not found.", variant: "destructive" });
            return;
        }

        try {
            await runTransaction(firestoreDB, async (transaction) => {
                const paymentRef = doc(firestoreDB, "customer_payments", paymentIdToDelete);
                
                if (paymentToDelete.paidFor) {
                    for (const detail of paymentToDelete.paidFor) {
                        const q = query(customersCollection, where('srNo', '==', detail.srNo), limit(1));
                        const customerDocsSnapshot = await getDocs(q);
                        if (!customerDocsSnapshot.empty) {
                            const customerDoc = customerDocsSnapshot.docs[0];
                            const currentCustomer = customerDoc.data() as Customer;
                            const amountToRestore = detail.amount;
                            const newNetAmount = (currentCustomer.netAmount as number) + amountToRestore;
                            transaction.update(customerDoc.ref, { netAmount: Math.round(newNetAmount) });
                        }
                    }
                }
                
                if (paymentToDelete.incomeTransactionId) {
                    const incomeDocRef = doc(incomesCollection, paymentToDelete.incomeTransactionId);
                    transaction.delete(incomeDocRef);
                }
                
                await deleteCustomerPayment(paymentIdToDelete);
            });

            toast({ title: `Payment ${paymentToDelete.paymentId} deleted successfully.`, variant: 'success' });
            if (editingPayment?.id === paymentIdToDelete) {
              setSelectedEntryIds(new Set());
              setPaymentAmount(0);
              setEditingPayment(null);
            }
        } catch (error) {
            console.error("Error deleting payment:", error);
            toast({ title: "Failed to delete payment.", description: (error as Error).message, variant: "destructive" });
        }
    };
  
  const customerPayments = selectedCustomerKey ? paymentHistory.filter(p => p.customerId === selectedCustomerKey) : [];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
       <Card>
            <CardHeader className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-12">
                        <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                        <TabsTrigger value="history">Full History</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
           <TabsContent value="processing" className="mt-0 space-y-4 p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 border p-2 rounded-lg">
                    <div className="flex flex-1 items-center gap-2">
                        <Label htmlFor="customer-select" className="text-sm font-semibold whitespace-nowrap">Select Customer:</Label>
                        <CustomDropdown
                            options={Array.from(customerSummary.entries()).map(([key, data]) => ({ value: key, label: `${toTitleCase(data.name)} (${data.contact})` }))}
                            value={selectedCustomerKey}
                            onChange={handleCustomerSelect}
                            placeholder="Search and select customer..."
                        />
                    </div>
                </div>

              {selectedCustomerKey && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 border rounded-lg bg-card/30">
                          <div className="flex-1">
                              <p className="text-sm font-medium text-muted-foreground">Total Receivable for Selected Entries</p>
                              <p className="text-xl font-bold text-primary">{formatCurrency(totalReceivableForSelected)}</p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)}><RefreshCw className="mr-2 h-3 w-3"/>Change Selection</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                          <div className="space-y-2"><Label htmlFor="receipt-no" className="text-xs">Receipt No.</Label><Input id="receipt-no" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} className="h-9 text-sm"/></div>
                          <div className="space-y-2"><Label className="text-xs">Payment Type</Label>
                                <CustomDropdown 
                                    options={[{value: "Full", label: "Full"}, {value: "Partial", label: "Partial"}]} 
                                    value={paymentType} 
                                    onChange={(v) => v && setPaymentType(v)} 
                                />
                          </div>
                          <div className="space-y-2"><Label htmlFor="payment-amount" className="text-xs">Payment Amount</Label><Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-9 text-sm"/></div>
                          <div className="space-y-2"><Label className="text-xs">Receive In</Label>
                                <CustomDropdown 
                                    options={[{value: "CashInHand", label: "Cash In Hand"}, ...bankAccounts.map(acc => ({ value: acc.id, label: acc.accountHolderName }))]} 
                                    value={selectedAccountId} 
                                    onChange={(v) => v && setSelectedAccountId(v)} 
                                />
                          </div>
                          <Button onClick={processPayment} disabled={selectedEntryIds.size === 0} className="h-9 w-full">Receive Payment</Button>
                      </div>
                  </CardContent>
              </Card>
              )}
           </TabsContent>
           <TabsContent value="history" className="mt-0">
                 <CardContent>
                    <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Payment ID</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {paymentHistory.map(p => {
                            const customerName = customerSummary.get(p.customerId)?.name;
                            return (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono text-xs">{p.paymentId}</TableCell>
                                <TableCell className="text-xs">{new Date(p.date).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell className="text-xs">{customerName}</TableCell><TableCell className="text-xs text-muted-foreground">{p.notes}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                                <TableCell className="text-center">
                                    <div className="flex justify-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditPayment(p)}><Pen className="h-3 w-3"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-3 w-3 text-destructive"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Delete Payment?</AlertDialogTitle><AlertDialogDescription>This will permanently delete payment {p.paymentId} and restore the outstanding balance. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePayment(p.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                    </Table></div>
                </CardContent>
           </TabsContent>
        </Tabs>
       </Card>

     <OutstandingEntriesDialog
        isOpen={isOutstandingModalOpen}
        onOpenChange={setIsOutstandingModalOpen}
        customerName={toTitleCase(customerSummary.get(selectedCustomerKey || '')?.name || '')}
        entries={customers.filter(c => c.customerId === selectedCustomerKey && (parseFloat(String(c.netAmount)) || 0) > 0)}
        selectedIds={selectedEntryIds}
        onSelect={(id: string) => setSelectedEntryIds(prev => { const newSet = new Set(prev); if (newSet.has(id)) { newSet.delete(id); } else { newSet.add(id); } return newSet; })}
        onSelectAll={(checked: boolean) => setSelectedEntryIds(new Set(checked ? customers.filter(c => c.customerId === selectedCustomerKey && (parseFloat(String(c.netAmount)) || 0) > 0).map(c => c.id) : []))}
        onConfirm={() => setIsOutstandingModalOpen(false)}
        onCancel={() => { setIsOutstandingModalOpen(false); setSelectedCustomerKey(null); setSelectedEntryIds(new Set()); }}
    />
    </div>
  );
}

    




    
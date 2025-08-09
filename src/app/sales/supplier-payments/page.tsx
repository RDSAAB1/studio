
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { initialCustomers } from "@/lib/data";
import type { Customer, CustomerSummary, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, cn } from "@/lib/utils";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Trash, Info, Pen, X, Calendar, Banknote, Percent, Hash } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const cdOptions = [
    { value: 'paid_amount', label: 'CD on Paid Amount' },
    { value: 'unpaid_amount', label: 'CD on Unpaid Amount (Selected)' },
    { value: 'payment_amount', label: 'CD on Payment Amount (Manual)' },
    { value: 'full_amount', label: 'CD on Full Amount (Selected)' },
];

const DetailItem = ({ icon, label, value, className }: { icon?: React.ReactNode, label: string, value: any, className?: string }) => (
    <div className={cn("flex items-start gap-3", className)}>
        {icon && <div className="text-muted-foreground mt-0.5">{icon}</div>}
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold text-sm break-words">{String(value) || '-'}</p>
        </div>
    </div>
);


export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  const [paymentId, setPaymentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [isClient, setIsClient] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [detailsPayment, setDetailsPayment] = useState<Payment | null>(null);
  const [cdAppliedOnSrNos, setCdAppliedOnSrNos] = useState<Set<string>>(new Set());


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
      try {
        const savedCustomers = localStorage.getItem("customers_data");
        setCustomers(savedCustomers ? JSON.parse(savedCustomers) : initialCustomers);

        const savedPayments = localStorage.getItem("payment_history");
        const parsedPayments = savedPayments ? JSON.parse(savedPayments) : [];
        setPaymentHistory(parsedPayments);
        setPaymentId(getNextPaymentId(parsedPayments));

      } catch (error) {
        console.error("Failed to load data from localStorage", error);
        setCustomers(initialCustomers);
        setPaymentHistory([]);
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

  const getNextPaymentId = useCallback((currentPayments: Payment[]) => {
    const lastPaymentNum = currentPayments.reduce((max, p) => {
        const numMatch = p.paymentId.match(/^P(\d+)$/);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        return num > max ? num : max;
    }, 0);
    return formatPaymentId(lastPaymentNum + 1);
  }, []);


  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    clearForm();
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
        setCdAppliedOnSrNos(new Set());
        return;
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    const allDueInFuture = selectedEntries.every(e => new Date(e.dueDate) > today);
    
    const srNosWithCD = new Set<string>();
    paymentHistory.forEach(p => {
        if (p.cdApplied) {
            p.paidFor?.forEach(pf => srNosWithCD.add(pf.srNo));
        }
    });
    const anySelectedHasCD = selectedEntries.some(e => srNosWithCD.has(e.srNo));

    if (anySelectedHasCD) {
        setCdEnabled(false);
    } else {
        setCdEnabled(allDueInFuture);
    }
    setCdAppliedOnSrNos(srNosWithCD);
  }, [selectedEntries, paymentHistory]);

  useEffect(() => {
    if (paymentType === 'Full') {
      if (cdEnabled && cdAt !== 'payment_amount') {
        setPaymentAmount(totalOutstandingForSelected - calculatedCdAmount);
      } else {
        setPaymentAmount(totalOutstandingForSelected);
      }
    } else {
      if(cdEnabled && cdAt !== 'payment_amount'){
          setCdAt('payment_amount');
      }
    }
  }, [paymentType, totalOutstandingForSelected, cdEnabled, cdAt, calculatedCdAmount]);

  useEffect(() => {
    autoSetCDToggle();
  }, [selectedEntryIds, autoSetCDToggle]);
  
  useEffect(() => {
    if(!cdEnabled) {
        setCalculatedCdAmount(0);
        return;
    }

    const srNosOnWhichCdApplied = new Set<string>();
    paymentHistory.forEach(p => {
        if (p.cdApplied) {
            p.paidFor?.forEach(pf => srNosOnWhichCdApplied.add(pf.srNo));
        }
    });
    
    let base = 0;
    const currentPaymentAmount = paymentAmount || 0;
    
    if (cdAt === 'payment_amount') {
        base = currentPaymentAmount;
    } else if (cdAt === 'unpaid_amount') {
        base = totalOutstandingForSelected;
    } else if (cdAt === 'full_amount') {
        const totalOriginalAmountForSelected = selectedEntries.reduce((acc, entry) => {
            if (srNosOnWhichCdApplied.has(entry.srNo)) return acc;
            return acc + (entry.originalNetAmount || 0);
        }, 0);
        base = totalOriginalAmountForSelected;
    } else if (cdAt === 'paid_amount') {
         const paidAmountForSelectedEntriesWithoutCD = selectedEntries.reduce((acc, entry) => {
            if (srNosOnWhichCdApplied.has(entry.srNo)) return acc;
            const originalAmount = entry.originalNetAmount || 0;
            const outstandingAmount = Number(entry.netAmount);
            return acc + (originalAmount - outstandingAmount);
        }, 0);
        base = paidAmountForSelectedEntriesWithoutCD;
    }
    setCalculatedCdAmount(parseFloat(((base * cdPercent) / 100).toFixed(2)));
  }, [cdEnabled, paymentAmount, totalOutstandingForSelected, cdPercent, cdAt, selectedEntries, paymentHistory]);

  const clearForm = () => {
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPaymentId(null);
    setPaymentId(getNextPaymentId(paymentHistory));
  };
  
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

    if (editingPaymentId) {
        handleUpdatePayment();
        return;
    }
    
    let remainingPayment = paymentAmount + calculatedCdAmount;
    const paidForDetails: PaidFor[] = [];

    const updatedCustomers = customers.map(c => {
        if(selectedEntryIds.has(c.id)){
             const outstanding = parseFloat(String(c.netAmount));
             if (remainingPayment > 0) {
                 const amountToPay = Math.min(outstanding, remainingPayment);
                 remainingPayment -= amountToPay;
                 paidForDetails.push({ srNo: c.srNo, amount: amountToPay, cdApplied: cdEnabled });
                 return {...c, netAmount: outstanding - amountToPay};
             }
        }
        return c;
    });

    const newPayment: Payment = {
        paymentId: paymentId || getNextPaymentId(paymentHistory),
        customerId: selectedCustomerKey,
        date: new Date().toISOString().split("T")[0],
        amount: paymentAmount,
        cdAmount: calculatedCdAmount,
        cdApplied: cdEnabled,
        type: paymentType,
        receiptType: 'Online',
        notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`,
        paidFor: paidForDetails,
    };
    
    setCustomers(updatedCustomers);
    setPaymentHistory(prev => [...prev, newPayment]);
    
    clearForm();
    toast({ title: "Success", description: "Payment processed successfully.", duration: 3000 });
  };

  const handleEditPayment = (payment: Payment) => {
    handleDeletePayment(payment.paymentId, true); 

    setEditingPaymentId(payment.paymentId);
    setPaymentId(payment.paymentId);
    setPaymentAmount(payment.amount);
    setPaymentType(payment.type);
    setCdEnabled(payment.cdApplied);
    setCalculatedCdAmount(payment.cdAmount);

    const srNosInPayment = (payment.paidFor || []).map(pf => pf.srNo);
    const entryIdsToSelect = new Set(customers.filter(c => srNosInPayment.includes(c.srNo)).map(c => c.id));
    setSelectedEntryIds(entryIdsToSelect);
    
    toast({ title: "Editing Payment", description: `Editing payment ${payment.paymentId}. Please make your changes and click 'Update Payment'.`});
  };

  const handleUpdatePayment = () => {
    if (!editingPaymentId || !selectedCustomerKey) return;
    
    let remainingPayment = paymentAmount + calculatedCdAmount;
    const paidForDetails: PaidFor[] = [];

    const updatedCustomers = customers.map(c => {
        if(selectedEntryIds.has(c.id)){
             const outstanding = parseFloat(String(c.netAmount));
             if (remainingPayment > 0) {
                 const amountToPay = Math.min(outstanding, remainingPayment);
                 remainingPayment -= amountToPay;
                 paidForDetails.push({ srNo: c.srNo, amount: amountToPay, cdApplied: cdEnabled });
                 return {...c, netAmount: outstanding - amountToPay};
             }
        }
        return c;
    });

    const updatedPayment: Payment = {
        paymentId: paymentId || editingPaymentId,
        customerId: selectedCustomerKey,
        date: new Date().toISOString().split("T")[0],
        amount: paymentAmount,
        cdAmount: calculatedCdAmount,
        cdApplied: cdEnabled,
        type: paymentType,
        receiptType: 'Online',
        notes: `Paid for SR No(s): ${selectedEntries.map(e => e.srNo).join(', ')}`,
        paidFor: paidForDetails
    };

    setCustomers(updatedCustomers);
    setPaymentHistory(prev => [...prev, updatedPayment]);

    clearForm();
    toast({ title: "Success", description: "Payment updated successfully.", duration: 3000 });
  };
  
  const handleDeletePayment = (paymentIdToDelete: string, silent = false) => {
    if (!selectedCustomerKey) return;

    const paymentToDelete = paymentHistory.find(p => p.paymentId === paymentIdToDelete);
    if (!paymentToDelete) return;
    
    const updatedPaymentHistory = paymentHistory.filter(p => p.paymentId !== paymentIdToDelete);

    let tempAmountToRestore = paymentToDelete.amount + paymentToDelete.cdAmount;

    const updatedCustomers = customers.map(c => {
        const paidForEntry = paymentToDelete.paidFor?.find(pf => pf.srNo === c.srNo);
        if (paidForEntry) {
            const amountToRestoreForThisEntry = paidForEntry.amount;
             if (tempAmountToRestore > 0) {
                const currentNet = Number(c.netAmount);
                const restoredAmount = Math.min(tempAmountToRestore, amountToRestoreForThisEntry);
                const newNet = currentNet + restoredAmount;
                tempAmountToRestore -= restoredAmount;
                return { ...c, netAmount: newNet };
             }
        }
        return c;
    });
    
    setCustomers(updatedCustomers);
    setPaymentHistory(updatedPaymentHistory);

    if (!silent) {
        toast({ title: 'Payment Deleted', description: `Payment ${paymentIdToDelete} has been removed and outstanding amounts updated.`, duration: 3000 });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement.tagName === 'BUTTON' || activeElement.closest('[role="listbox"]') || activeElement.closest('[role="dialog"]')) {
        return;
      }
      e.preventDefault();
      
      const formEl = e.currentTarget;
      const focusableElements = Array.from(
        formEl.querySelectorAll('input, button, [role="combobox"], [role="switch"]')
      ).filter(el => !(el as HTMLElement).hasAttribute('disabled') && (el as HTMLElement).offsetParent !== null) as HTMLElement[];

      const currentElementIndex = focusableElements.findIndex(el => el === document.activeElement);
      
      if (currentElementIndex > -1 && currentElementIndex < focusableElements.length - 1) {
        focusableElements[currentElementIndex + 1].focus();
      }
    }
  };

  const handlePaymentIdBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value && !isNaN(Number(value))) {
      setPaymentId(formatPaymentId(Number(value)));
    } else if (value && !value.startsWith('P')) {
       const numericPart = value.replace(/\D/g, '');
       if(numericPart) {
         setPaymentId(formatPaymentId(Number(numericPart)));
       }
    }
  };

  const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
  const outstandingEntries = useMemo(() => selectedCustomerKey ? customers.filter(c => c.customerId === customerIdKey && parseFloat(String(c.netAmount)) > 0) : [], [customers, selectedCustomerKey, customerIdKey]);
  const currentPaymentHistory = useMemo(() => selectedCustomerKey ? paymentHistory.filter(p => p.customerId === selectedCustomerKey).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [], [paymentHistory, selectedCustomerKey]);
  
  const availableCdOptions = useMemo(() => {
    if (paymentType === 'Partial') {
      return cdOptions.filter(opt => opt.value === 'payment_amount');
    }
    return cdOptions.filter(opt => opt.value !== 'payment_amount');
  }, [paymentType]);
  
  const isCdSwitchDisabled = selectedEntries.some(e => cdAppliedOnSrNos.has(e.srNo));

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

          <Card onKeyDown={handleKeyDown}>
              <CardHeader><CardTitle>{editingPaymentId ? `Editing Payment` : 'Payment Processing'}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                  <div className="p-4 border rounded-lg bg-card/30">
                      <p className="text-muted-foreground">Total Outstanding for Selected Entries:</p>
                      <p className="text-2xl font-bold text-primary">{totalOutstandingForSelected.toFixed(2)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="payment-id">Payment ID</Label>
                        <Input id="payment-id" type="text" value={paymentId} onChange={e => setPaymentId(e.target.value)} onBlur={handlePaymentIdBlur} />
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
                          <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full' && cdAt !== 'payment_amount'} />
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center space-x-2 pt-6">
                                    <Switch id="cd-toggle" checked={cdEnabled} onCheckedChange={setCdEnabled} disabled={isCdSwitchDisabled} />
                                    <Label htmlFor="cd-toggle" className={cn(isCdSwitchDisabled && 'text-muted-foreground')}>Apply CD</Label>
                                </div>
                            </TooltipTrigger>
                            {isCdSwitchDisabled && (
                                <TooltipContent>
                                    <p>CD has already been applied to one or more selected entries.</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                      </TooltipProvider>

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
                            <Input value={calculatedCdAmount.toFixed(2)} readOnly className="font-bold text-primary" />
                        </div>
                      </>}
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={processPayment} disabled={selectedEntryIds.size === 0}>
                        {editingPaymentId ? 'Update Payment' : 'Process Payment'}
                    </Button>
                    {editingPaymentId && (
                        <Button variant="outline" onClick={clearForm}>Cancel Edit</Button>
                    )}
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
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {currentPaymentHistory.map(p => (
                        <TableRow key={p.paymentId}>
                        <TableCell>{p.paymentId}</TableCell>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>{p.amount.toFixed(2)}</TableCell>
                        <TableCell>{p.cdAmount.toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">{p.notes}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailsPayment(p)}>
                                    <Info className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditPayment(p)}>
                                    <Pen className="h-4 w-4" />
                                </Button>
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
                            </div>
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

      <Dialog open={!!detailsPayment} onOpenChange={(open) => !open && setDetailsPayment(null)}>
        <DialogContent className="max-w-lg">
          {detailsPayment && (
            <>
            <DialogHeader>
                <DialogTitle>Payment Details: {detailsPayment.paymentId}</DialogTitle>
                <DialogDescription>
                    Detailed information for this payment record.
                </DialogDescription>
            </DialogHeader>
            <Separator />
            <div className="space-y-4 py-4">
                <DetailItem icon={<Calendar size={14} />} label="Payment Date" value={detailsPayment.date} />
                <DetailItem icon={<Banknote size={14} />} label="Payment Amount" value={`₹${detailsPayment.amount.toFixed(2)}`} />
                <DetailItem icon={<Percent size={14} />} label="CD Amount" value={`₹${detailsPayment.cdAmount.toFixed(2)}`} />
                <DetailItem icon={<Hash size={14} />} label="Payment Type" value={detailsPayment.type} />
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Paid For SR No(s)</Label>
                    <p className="font-semibold text-sm break-words">{detailsPayment.notes.replace('Paid for SR No(s): ', '')}</p>
                </div>
            </div>
             <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsPayment(null)}>Close</Button>
            </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

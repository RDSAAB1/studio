
"use client";

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
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Trash, Info, Pen, X, Calendar, Banknote, Percent, Hash, Users, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { addPayment, deletePayment, updateSupplier, updatePayment, getSuppliersRealtime, getPaymentsRealtime } from '@/lib/firestore';

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
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [detailsPayment, setDetailsPayment] = useState<Payment | null>(null);
  
  const stableToast = useCallback(toast, []);

  const getNextPaymentId = useCallback((currentPayments: Payment[]) => {
    if (!currentPayments || currentPayments.length === 0) {
        return formatPaymentId(1);
    }
    const lastPaymentNum = currentPayments.reduce((max, p) => {
        const numMatch = p.paymentId.match(/^P(\d+)$/);
        const num = numMatch ? parseInt(numMatch[1], 10) : 0;
        return num > max ? num : max;
    }, 0);
    return formatPaymentId(lastPaymentNum + 1);
  }, []);

  useEffect(() => {
    setIsClient(true);
    setLoading(true);

    const unsubscribeSuppliers = getSuppliersRealtime((fetchedSuppliers) => {
      setSuppliers(fetchedSuppliers);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching suppliers:", error);
        stableToast({ variant: 'destructive', title: "Error", description: "Failed to load supplier data." });
        setLoading(false);
    });

    const unsubscribePayments = getPaymentsRealtime((fetchedPayments) => {
      setPaymentHistory(fetchedPayments);
      if (!editingPaymentId) {
        setPaymentId(getNextPaymentId(fetchedPayments));
      }
    }, (error) => {
        console.error("Error fetching payments:", error);
        stableToast({ variant: 'destructive', title: "Error", description: "Failed to load payment history." });
    });

    return () => {
      unsubscribeSuppliers();
      unsubscribePayments();
    };
  }, [editingPaymentId, stableToast, getNextPaymentId]);
  

  const customerSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();
    
    suppliers.forEach(s => {
        if (!s.customerId) return;
        if (!summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name,
                contact: s.contact,
                totalOutstanding: 0,
                paymentHistory: [],
                totalAmount: 0,
                totalPaid: 0,
                outstandingEntryIds: []
            });
        }
    });

    suppliers.forEach(supplier => {
        if (!supplier.customerId) return;
        const data = summary.get(supplier.customerId)!;
        const netAmount = parseFloat(String(supplier.netAmount));
        data.totalOutstanding += netAmount;
    });
    
    return summary;
  }, [suppliers]);




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
    return suppliers.filter(s => selectedEntryIds.has(s.id));
  }, [suppliers, selectedEntryIds]);
  
  const totalOutstandingForSelected = useMemo(() => {
    return selectedEntries.reduce((acc, entry) => acc + parseFloat(String(entry.netAmount)), 0);
  }, [selectedEntries]);

  const cdEligibleEntries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedEntries.filter(e => new Date(e.dueDate) >= today);
}, [selectedEntries]);
  
  const autoSetCDToggle = useCallback(() => {
    if (selectedEntries.length === 0) {
        setCdEnabled(false);
        return;
    }
    setCdEnabled(cdEligibleEntries.length > 0);
  }, [selectedEntries.length, cdEligibleEntries.length]);

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
        if (!cdEnabled) {
            setCalculatedCdAmount(0);
            return;
        }

        let base = 0;
        const currentPaymentAmount = paymentAmount || 0;
        
        const amountWithCDAlready = cdEligibleEntries.reduce((acc, entry) => {
            const paymentsForThisEntry = paymentHistory.filter(p => p.paidFor?.some(pf => pf.srNo === entry.srNo && pf.cdApplied));
            return acc + paymentsForThisEntry.reduce((sum, p) => sum + (p.paidFor?.find(pf => pf.srNo === entry.srNo)?.amount || 0), 0);
        }, 0);
        
        if (cdAt === 'payment_amount') {
            base = currentPaymentAmount;
        } else if (cdAt === 'unpaid_amount') {
            base = cdEligibleEntries.reduce((acc, entry) => acc + Number(entry.netAmount), 0);
        } else if (cdAt === 'full_amount') {
            const totalOriginalAmount = cdEligibleEntries.reduce((acc, entry) => acc + (entry.originalNetAmount || Number(entry.netAmount) + (paymentHistory.filter(p=>p.paidFor?.some(pf=>pf.srNo===entry.srNo)).reduce((sum,p)=>sum+(p.paidFor?.find(pf=>pf.srNo===entry.srNo)?.amount||0),0))), 0);
            base = totalOriginalAmount - amountWithCDAlready;
        } else if (cdAt === 'paid_amount') {
             const totalPaidForEligible = cdEligibleEntries.reduce((acc, entry) => {
                const paidAmount = paymentHistory.filter(p=>p.paidFor?.some(pf=>pf.srNo===entry.srNo)).reduce((sum,p)=>sum+(p.paidFor?.find(pf=>pf.srNo===entry.srNo)?.amount||0),0);
                return acc + paidAmount;
            }, 0);
            base = totalPaidForEligible - amountWithCDAlready;
        }
        
        setCalculatedCdAmount(parseFloat(((base * cdPercent) / 100).toFixed(2)));
  }, [cdEnabled, paymentAmount, cdPercent, cdAt, cdEligibleEntries, paymentHistory]);

  const clearForm = () => {
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPaymentId(null);
    setPaymentId(getNextPaymentId(paymentHistory));
  };
  
  const processPayment = async () => {
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
        await handleDeletePayment(editingPaymentId, true); // Silently delete to reverse amounts
    }

    let remainingPayment = paymentAmount + calculatedCdAmount;
    const paidForDetails: PaidFor[] = [];

    const sortedEntries = Array.from(selectedEntryIds)
        .map(id => suppliers.find(s => s.id === id))
        .filter((c): c is Customer => !!c)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const customerUpdatesPromises = sortedEntries.map(async (c) => {
        const outstanding = parseFloat(String(c.netAmount));
        if (remainingPayment > 0) {
            const amountToPay = Math.min(outstanding, remainingPayment);
            remainingPayment -= amountToPay;
            const isEligibleForCD = cdEligibleEntries.some(entry => entry.id === c.id);
            paidForDetails.push({ srNo: c.srNo, amount: amountToPay, cdApplied: cdEnabled && isEligibleForCD });
            await updateSupplier(c.id, { netAmount: outstanding - amountToPay });
        }
    });

    await Promise.all(customerUpdatesPromises);

    const paymentData: Payment = {
        paymentId: editingPaymentId || paymentId || getNextPaymentId(paymentHistory),
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
    
    const savePromise = editingPaymentId 
      ? updatePayment(editingPaymentId, paymentData)
      : addPayment(paymentData);
  
    savePromise.then(() => {
      clearForm();
      toast({ title: "Success", description: `Payment ${editingPaymentId ? 'updated' : 'processed'} successfully.`, duration: 3000 });
    }).catch(error => {
      console.error("Error saving payment:", error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to save payment." });
    });
  };

  const handleEditPayment = async (payment: Payment) => {
    const paymentToEdit = paymentHistory.find(p => p.paymentId === payment.paymentId);
    if (!paymentToEdit) return;

    setEditingPaymentId(payment.paymentId);
    setPaymentId(payment.paymentId);
    setPaymentAmount(payment.amount);
    setPaymentType(payment.type);
    setCdEnabled(payment.cdApplied);
    setCalculatedCdAmount(payment.cdAmount);

    const srNosInPayment = (payment.paidFor || []).map(pf => pf.srNo);
    const entryIdsToSelect = new Set(suppliers.filter(c => srNosInPayment.includes(c.srNo)).map(c => c.id));
    
     if (paymentToEdit.paidFor) {
        paymentToEdit.paidFor.forEach(pf => {
            const supplier = suppliers.find(s => s.srNo === pf.srNo);
            if (supplier && !entryIdsToSelect.has(supplier.id)) {
                entryIdsToSelect.add(supplier.id);
            }
        });
    }

    setSelectedEntryIds(entryIdsToSelect);
    
    toast({ title: "Editing Payment", description: `Editing payment ${payment.paymentId}. Please make your changes and click 'Update Payment'.`});
  };

  const handleDeletePayment = async (paymentIdToDelete: string, silent = false) => {
    const paymentToDelete = paymentHistory.find(p => p.paymentId === paymentIdToDelete);
    if (!paymentToDelete) {
        if (!silent) toast({ variant: "destructive", title: "Error", description: "Payment not found." });
        return;
    }

    try {
        if (paymentToDelete.paidFor && paymentToDelete.paidFor.length > 0) {
            const supplierUpdates = paymentToDelete.paidFor.map(async (paidFor) => {
                const supplierToUpdate = suppliers.find(s => s.srNo === paidFor.srNo);
                if (supplierToUpdate) {
                    const newNetAmount = parseFloat(String(supplierToUpdate.netAmount)) + paidFor.amount;
                    await updateSupplier(supplierToUpdate.id, { netAmount: newNetAmount });
                }
            });
            await Promise.all(supplierUpdates);
        }

        await deletePayment(paymentIdToDelete);
        
        setPaymentHistory(prev => prev.filter(p => p.paymentId !== paymentIdToDelete));
        if (editingPaymentId === paymentIdToDelete) {
          clearForm();
        }

        if (!silent) {
            toast({ title: 'Payment Deleted', description: `Payment ${paymentIdToDelete} has been removed and outstanding amounts updated.`, duration: 3000 });
        }
    } catch (error) {
        console.error("Error deleting payment:", error);
        if (!silent) {
            toast({ variant: "destructive", title: "Error", description: "Failed to delete payment or update supplier balances." });
        }
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
  const outstandingEntries = useMemo(() => selectedCustomerKey ? suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0) : [], [suppliers, selectedCustomerKey, customerIdKey]);
  const paidEntries = useMemo(() => selectedCustomerKey ? suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) === 0 && s.originalNetAmount > 0) : [], [suppliers, selectedCustomerKey, customerIdKey]);
  
  const currentPaymentHistory = useMemo(() => {
    if (!selectedCustomerKey) return [];
    
    const customerPayments = paymentHistory.filter(p => p.customerId === selectedCustomerKey);
    const uniquePayments = Array.from(new Map(customerPayments.map(p => [p.paymentId, p])).values());
    
    return uniquePayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [paymentHistory, selectedCustomerKey]);
  
  const availableCdOptions = useMemo(() => {
    if (paymentType === 'Partial') {
      return cdOptions.filter(opt => opt.value === 'payment_amount');
    }
    return cdOptions.filter(opt => opt.value !== 'payment_amount');
  }, [paymentType]);
  
  const isCdSwitchDisabled = cdEligibleEntries.length === 0;

  if (!isClient) {
    return null;
  }
  
  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
          </div>
      );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">Select Supplier</h3>
          </div>
          <div className="w-full sm:w-auto sm:min-w-64">
            <Select onValueChange={handleCustomerSelect} value={selectedCustomerKey || ""}>
              <SelectTrigger className="w-full h-9 text-sm">
                <SelectValue placeholder="Select a supplier to process payments" />
              </SelectTrigger>
              <SelectContent>
                {Array.from(customerSummaryMap.entries()).map(([key, data]) => (
                   <SelectItem key={key} value={key} className="text-sm">
                      {toTitleCase(data.name)} ({data.contact}) - Outstanding: {data.totalOutstanding.toFixed(2)}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCustomerKey ? (
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
                        checked={selectedEntryIds.size > 0 && selectedEntryIds.size === outstandingEntries.length && outstandingEntries.length > 0}
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
                    {outstandingEntries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No outstanding entries for this supplier.</TableCell>
                        </TableRow>
                    )}
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
                                    <p>No selected entries are eligible for CD.</p>
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
                        <TableCell>{(entry.originalNetAmount || entry.amount).toFixed(2)}</TableCell>
                        </TableRow>
                    ))}
                     {paidEntries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">No paid entries for this supplier.</TableCell>
                        </TableRow>
                    )}
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
                     {currentPaymentHistory.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">No payment history for this supplier.</TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
            <p>Please select a supplier to view their payment details.</p>
        </div>
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

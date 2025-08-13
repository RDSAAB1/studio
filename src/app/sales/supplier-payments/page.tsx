
"use client";

import type { Customer, CustomerSummary, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, cn, formatCurrency } from "@/lib/utils";
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
import { Trash, Info, Pen, X, Calendar as CalendarIcon, Banknote, Percent, Hash, Users, Loader2, UserSquare, Home, Phone, Truck, Wheat, Wallet, Scale, Calculator, Landmark, Server, Milestone, Settings, Rows3, LayoutList, LayoutGrid, StepForward, ArrowRight, FileText, Weight, Receipt, User, Building, ClipboardList } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";


import { collection, runTransaction, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { getSuppliersRealtime, getPaymentsRealtime } from '@/lib/firestore';
import { db } from "@/lib/firebase";


const suppliersCollection = collection(db, "suppliers");
const paymentsCollection = collection(db, "payments");

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';


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
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // New state for payment method
  
  // RTGS specific fields
  const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
  const [grNo, setGrNo] = useState('');
  const [grDate, setGrDate] = useState<Date | undefined>(new Date());
  const [parchiNo, setParchiNo] = useState('');
  const [parchiDate, setParchiDate] = useState<Date | undefined>(new Date());
  const [utrNo, setUtrNo] = useState('');
  const [checkNo, setCheckNo] = useState('');
  const [targetAmount, setTargetAmount] = useState(0);
  const [generatedPayments, setGeneratedPayments] = useState<any[]>([]);
  
  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<Customer | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [activeLayout, setActiveLayout] = useState<LayoutOption>('classic');
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
  
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
      if (!editingPayment) {
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
  }, [editingPayment, stableToast, getNextPaymentId]);
  

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
                outstandingEntryIds: [],
                acNo: s.acNo,
                ifscCode: s.ifscCode,
                bank: s.bank,
                branch: s.branch
            });
        }
    });

    suppliers.forEach(supplier => {
        if (!supplier.customerId) return;
        const data = summary.get(supplier.customerId)!;
        const netAmount = Math.round(parseFloat(String(supplier.netAmount)));
        data.totalOutstanding += netAmount;
    });
    
    return summary;
  }, [suppliers]);




  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    const customerData = customerSummaryMap.get(key);
    if(customerData) {
        setBankDetails({
            acNo: customerData.acNo || '',
            ifscCode: customerData.ifscCode || '',
            bank: customerData.bank || '',
            branch: customerData.branch || '',
        });
    }
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
    return Math.round(selectedEntries.reduce((acc, entry) => acc + parseFloat(String(entry.netAmount)), 0));
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
    if (paymentType === 'Full' && !editingPayment) {
        const finalAmount = totalOutstandingForSelected - (cdEnabled ? calculatedCdAmount : 0);
        setPaymentAmount(Math.round(finalAmount));
    } else if (paymentType === 'Partial') {
        setPaymentAmount(0); // Reset for manual input
    }
  }, [paymentType, totalOutstandingForSelected, editingPayment, calculatedCdAmount, cdEnabled]);


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
      
       if (paymentType === 'Partial') {
          base = currentPaymentAmount;
       } else {
          if (cdAt === 'unpaid_amount') {
              base = cdEligibleEntries.reduce((acc, entry) => acc + Number(entry.netAmount), 0);
          } else if (cdAt === 'full_amount') {
              const totalOriginalAmount = cdEligibleEntries.reduce((acc, entry) => acc + (entry.originalNetAmount || Number(entry.netAmount) + (paymentHistory.filter(p=>p.paidFor?.some(pf=>pf.srNo===entry.srNo)).reduce((sum,p)=>sum+(p.paidFor?.find(pf=>pf.srNo===entry.srNo)?.amount||0),0))), 0);
              base = totalOriginalAmount - amountWithCDAlready;
          }
       }
      
      setCalculatedCdAmount(Math.round((base * cdPercent) / 100));
  }, [cdEnabled, paymentAmount, cdPercent, cdAt, cdEligibleEntries, paymentHistory, paymentType]);

   useEffect(() => {
        setTargetAmount(Math.round(totalOutstandingForSelected - calculatedCdAmount));
   }, [totalOutstandingForSelected, calculatedCdAmount]);
   
   const handleGeneratePayments = () => {
        if(targetAmount <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Target amount must be greater than 0.' });
            return;
        }
        // This is a placeholder logic. In a real scenario, this would involve more complex
        // logic to break down the payment or suggest options.
        setGeneratedPayments([{ id: 1, amount: targetAmount, description: `Full payment for target ${formatCurrency(targetAmount)}` }]);
   }

  const clearForm = () => {
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPayment(null);
    setUtrNo('');
    setCheckNo('');
    setGeneratedPayments([]);
    setPaymentId(getNextPaymentId(paymentHistory));
  };

    const processPayment = async () => {
        if (!selectedCustomerKey) {
            toast({ variant: 'destructive', title: "Error", description: "No supplier selected." });
            return;
        }
        if (selectedEntryIds.size === 0) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries to pay." });
            return;
        }
        if (paymentAmount <= 0 && calculatedCdAmount <= 0) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Payment amount must be greater than zero." });
            return;
        }
        if (paymentType === 'Partial' && !editingPayment && paymentAmount > totalOutstandingForSelected) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const tempEditingPayment = editingPayment;
                
                const involvedSupplierDocs = new Map<string, any>();
                const allInvolvedSrNos = new Set<string>();
                if (tempEditingPayment) {
                    (tempEditingPayment.paidFor || []).forEach(pf => allInvolvedSrNos.add(pf.srNo));
                }
                selectedEntries.forEach(e => allInvolvedSrNos.add(e.srNo));

                for (const srNo of allInvolvedSrNos) {
                    const supplierToUpdate = suppliers.find(s => s.srNo === srNo);
                    if (supplierToUpdate) {
                        const docRef = doc(db, "suppliers", supplierToUpdate.id);
                        const supplierDoc = await transaction.get(docRef);
                         if (!supplierDoc.exists()) throw new Error(`Supplier with SR No ${srNo} not found in DB.`);
                        involvedSupplierDocs.set(srNo, supplierDoc);
                    }
                }

                const outstandingBalances: { [key: string]: number } = {};
                involvedSupplierDocs.forEach((docSnap, srNo) => {
                    outstandingBalances[srNo] = Math.round(Number(docSnap.data().netAmount));
                });

                if (tempEditingPayment) {
                    (tempEditingPayment.paidFor || []).forEach(detail => {
                        if (outstandingBalances[detail.srNo] !== undefined) {
                            outstandingBalances[detail.srNo] += Math.round(detail.amount);
                        }
                    });
                }
                
                let remainingPayment = Math.round(paymentAmount + calculatedCdAmount);
                const paidForDetails: PaidFor[] = [];
                const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                sortedEntries.forEach(entryData => {
                    if (remainingPayment > 0) {
                        let outstanding = outstandingBalances[entryData.srNo];
                        const amountToPay = Math.min(outstanding, remainingPayment);

                        if (amountToPay > 0) {
                            const isEligibleForCD = cdEligibleEntries.some(entry => entry.id === entryData.id);
                            paidForDetails.push({ srNo: entryData.srNo, amount: amountToPay, cdApplied: cdEnabled && isEligibleForCD });
                            
                            outstandingBalances[entryData.srNo] -= amountToPay;
                            remainingPayment -= amountToPay;
                        }
                    }
                });

                if (remainingPayment > 0 && sortedEntries.length > 0) {
                    const lastEntrySrNo = sortedEntries[sortedEntries.length - 1].srNo;
                    if (outstandingBalances[lastEntrySrNo] >= remainingPayment) {
                        outstandingBalances[lastEntrySrNo] -= remainingPayment;
                        const detailToUpdate = paidForDetails.find(d => d.srNo === lastEntrySrNo);
                        if (detailToUpdate) {
                            detailToUpdate.amount += remainingPayment;
                        }
                        remainingPayment = 0;
                    }
                }

                for (const srNo in outstandingBalances) {
                    const newBalance = Math.round(outstandingBalances[srNo]);
                    const supplierDocSnap = involvedSupplierDocs.get(srNo);
                     if (supplierDocSnap) {
                        transaction.update(supplierDocSnap.ref, { netAmount: newBalance });
                    }
                }
                
                const paymentData: Omit<Payment, 'id'> = {
                    paymentId: tempEditingPayment ? tempEditingPayment.paymentId : paymentId,
                    customerId: selectedCustomerKey,
                    date: new Date().toISOString().split("T")[0],
                    amount: Math.round(paymentAmount),
                    cdAmount: Math.round(calculatedCdAmount),
                    cdApplied: cdEnabled,
                    type: paymentType,
                    receiptType: paymentMethod,
                    notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                    paidFor: paidForDetails,
                    grNo,
                    grDate: grDate?.toISOString(),
                    parchiNo,
                    parchiDate: parchiDate?.toISOString(),
                };

                if (tempEditingPayment) {
                    const paymentRef = doc(db, "payments", tempEditingPayment.id);
                    transaction.update(paymentRef, paymentData);
                } else {
                    const newPaymentRef = doc(collection(db, "payments"));
                    transaction.set(newPaymentRef, { ...paymentData, id: newPaymentRef.id });
                }
            });

            clearForm();
            toast({ title: "Success", description: `Payment ${editingPayment ? 'updated' : 'processed'} successfully.` });

        } catch (error) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Transaction Failed", description: "Failed to process payment. Please try again." });
        }
    };


    const handleEditPayment = async (paymentToEdit: Payment) => {
        const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
        
        const q = query(suppliersCollection, where('srNo', 'in', srNosInPayment));
        const supplierDocs = await getDocs(q);
        const foundSrNos = new Set(supplierDocs.docs.map(d => d.data().srNo));
        
        if (foundSrNos.size !== srNosInPayment.length) {
            toast({
                variant: "destructive",
                title: "Cannot Edit Payment",
                description: "Some original supplier entries for this payment could not be found. They may have been deleted.",
            });
            return;
        }

        const newSelectedEntryIds = new Set<string>();
        supplierDocs.forEach(doc => newSelectedEntryIds.add(doc.id));
        
        setSelectedCustomerKey(paymentToEdit.customerId);
        setEditingPayment(paymentToEdit);
        setPaymentId(paymentToEdit.paymentId);
        setPaymentAmount(paymentToEdit.amount);
        setPaymentType(paymentToEdit.type);
        setPaymentMethod(paymentToEdit.receiptType);
        setCdEnabled(paymentToEdit.cdApplied);
        setCalculatedCdAmount(paymentToEdit.cdAmount);
        setSelectedEntryIds(newSelectedEntryIds);
        setUtrNo(paymentToEdit.notes?.match(/UTR: (.*?)(,|$)/)?.[1].trim() || '');
        setCheckNo(paymentToEdit.notes?.match(/Check: (.*?)(,|$)/)?.[1].trim() || '');
        setGrNo(paymentToEdit.grNo || '');
        setGrDate(paymentToEdit.grDate ? new Date(paymentToEdit.grDate) : undefined);
        setParchiNo(paymentToEdit.parchiNo || '');
        setParchiDate(paymentToEdit.parchiDate ? new Date(paymentToEdit.parchiDate) : undefined);
    
        toast({
            title: "Editing Mode",
            description: `Editing payment ${paymentToEdit.paymentId}. Associated entries have been selected.`,
        });
    };

    const handleDeletePayment = async (paymentIdToDelete: string) => {
        const paymentToDelete = paymentHistory.find(p => p.id === paymentIdToDelete);
        if (!paymentToDelete || !paymentToDelete.id) {
            toast({ variant: "destructive", title: "Error", description: "Payment not found or ID is missing." });
            return;
        }
        try {
            await runTransaction(db, async (transaction) => {
                const paymentRef = doc(db, "payments", paymentIdToDelete);
                
                for (const detail of paymentToDelete.paidFor || []) {
                    const q = query(suppliersCollection, where('srNo', '==', detail.srNo));
                    const supplierDocsQuery = await getDocs(q); 
                    if (!supplierDocsQuery.empty) {
                        const supplierDoc = supplierDocsQuery.docs[0];
                        const currentNetAmount = Number(supplierDoc.data().netAmount);
                        const newNetAmount = currentNetAmount + detail.amount;
                        transaction.update(supplierDoc.ref, { netAmount: Math.round(newNetAmount) });
                    }
                }
                
                transaction.delete(paymentRef);
            });

            toast({ title: 'Payment Deleted', description: `Payment ${paymentToDelete.paymentId} has been removed and outstanding amounts updated.`, duration: 3000 });
            if (editingPayment?.id === paymentIdToDelete) {
                clearForm();
            }
        } catch (error) {
            console.error("Error in batch deletion:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete payment or update supplier balances." });
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
  
  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsSupplierEntry) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsSupplierEntry.srNo)
    );
  }, [detailsSupplierEntry, paymentHistory]);

  const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
  
  const currentPaymentHistory = useMemo(() => {
    if (!selectedCustomerKey) return [];
    const customerPayments = paymentHistory.filter(p => p.customerId === selectedCustomerKey);
    return customerPayments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  
  const handlePaySelectedOutstanding = () => {
    if (selectedEntryIds.size === 0) {
        toast({
            variant: "destructive",
            title: "No Entries Selected",
            description: "Please select one or more outstanding entries to pay.",
        });
        return;
    }
    setIsOutstandingModalOpen(false); // Close the modal
    // The rest of the logic will be handled by the form now visible
};

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
                      {toTitleCase(data.name)} ({data.contact}) - Outstanding: {formatCurrency(data.totalOutstanding)}
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedCustomerKey ? (
        <>
            <Dialog open={isOutstandingModalOpen} onOpenChange={setIsOutstandingModalOpen}>
                <DialogTrigger asChild>
                    <Button>View & Select Outstanding</Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Outstanding Entries for {toTitleCase(customerSummaryMap.get(selectedCustomerKey)?.name || '')}</DialogTitle>
                        <DialogDescription>Select the entries you want to pay for.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                       <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead><Checkbox onCheckedChange={(checked) => {
                                const newSet = new Set<string>();
                                const outstandingEntries = suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0);
                                if(checked) {
                                    outstandingEntries.forEach(e => newSet.add(e.id));
                                }
                                setSelectedEntryIds(newSet);
                            }}
                            checked={selectedEntryIds.size > 0 && selectedEntryIds.size === suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0).length}
                             /></TableHead>
                            <TableHead>SR No</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0).map(entry => (
                            <TableRow key={entry.id}>
                            <TableCell><Checkbox checked={selectedEntryIds.has(entry.id)} onCheckedChange={() => handleEntrySelect(entry.id)} /></TableCell>
                            <TableCell>{entry.srNo}</TableCell>
                            <TableCell>{format(new Date(entry.date), "dd-MMM-yy")}</TableCell>
                            <TableCell>{format(new Date(entry.dueDate), "dd-MMM-yy")}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(String(entry.netAmount)))}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOutstandingModalOpen(false)}>Cancel</Button>
                        <Button onClick={handlePaySelectedOutstanding}>Pay Selected</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


          {selectedEntryIds.size > 0 && (
            <div onKeyDown={handleKeyDown}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <ClipboardList className="h-5 w-5 text-primary"/>
                           {editingPayment ? `Editing Payment` : 'Payment Processing'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="p-4 border rounded-lg bg-card/30">
                            <p className="text-muted-foreground">Total Outstanding for Selected Entries:</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(totalOutstandingForSelected)}</p>
                        </div>
                        
                         <div className="space-y-2">
                            <Label>Payment Method</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="w-full md:w-1/3"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Online">Online</SelectItem>
                                    <SelectItem value="RTGS">RTGS</SelectItem>
                                </SelectContent>
                            </Select>
                          </div>

                        {paymentMethod === 'RTGS' && (
                            <Card>
                                <CardHeader><CardTitle className="text-base">RTGS Details</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label htmlFor="grNo">GR No.</Label><Input id="grNo" value={grNo} onChange={e => setGrNo(e.target.value)} /></div>
                                    <div className="space-y-2"><Label htmlFor="grDate">GR Date</Label>
                                         <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">{grDate ? format(grDate, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-[51]"><Calendar mode="single" selected={grDate} onSelect={setGrDate} initialFocus /></PopoverContent></Popover>
                                    </div>
                                    <div className="space-y-2"><Label htmlFor="parchiNo">Parchi No.</Label><Input id="parchiNo" value={parchiNo} onChange={e => setParchiNo(e.target.value)} /></div>
                                    <div className="space-y-2"><Label htmlFor="parchiDate">Parchi Date</Label>
                                         <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">{parchiDate ? format(parchiDate, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4" /></Button></PopoverTrigger><PopoverContent className="w-auto p-0 z-[51]"><Calendar mode="single" selected={parchiDate} onSelect={setParchiDate} initialFocus /></PopoverContent></Popover>
                                    </div>
                                    <div className="space-y-2"><Label htmlFor="acNo">A/C No.</Label><Input id="acNo" value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} /></div>
                                    <div className="space-y-2"><Label htmlFor="ifscCode">IFSC Code</Label><Input id="ifscCode" value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value})} /></div>
                                    <div className="space-y-2"><Label htmlFor="bank">Bank</Label><Input id="bank" value={bankDetails.bank} onChange={e => setBankDetails({...bankDetails, bank: e.target.value})} /></div>
                                    <div className="space-y-2"><Label htmlFor="branch">Branch</Label><Input id="branch" value={bankDetails.branch} onChange={e => setBankDetails({...bankDetails, branch: e.target.value})} /></div>
                                    <div className="space-y-2"><Label htmlFor="utrNo">UTR No.</Label><Input id="utrNo" value={utrNo} onChange={e => setUtrNo(e.target.value)} /></div>
                                    <div className="space-y-2"><Label htmlFor="checkNo">Check No.</Label><Input id="checkNo" value={checkNo} onChange={e => setCheckNo(e.target.value)} /></div>
                                </CardContent>
                            </Card>
                        )}
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
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
                                <Label htmlFor="payment-amount">Amount</Label>
                                <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(Math.round(parseFloat(e.target.value) || 0))} readOnly={paymentType === 'Full' && !editingPayment} />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center space-x-2">
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
                                            {availableCdOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Calculated CD Amount</Label>
                                    <Input value={formatCurrency(calculatedCdAmount)} readOnly className="font-bold text-primary" />
                                </div>
                            </>}
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <Banknote className="h-5 w-5 text-primary"/>
                            Payment Calculation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="p-4 border rounded-lg bg-card/30">
                                <p className="text-muted-foreground">Total Outstanding</p>
                                <p className="text-xl font-bold">{formatCurrency(totalOutstandingForSelected)}</p>
                            </div>
                            <div className="p-4 border rounded-lg bg-card/30">
                                <p className="text-muted-foreground">CD Amount</p>
                                <p className="text-xl font-bold text-green-500">- {formatCurrency(calculatedCdAmount)}</p>
                            </div>
                            <div className="p-4 border-2 border-primary rounded-lg bg-primary/10">
                                <p className="text-primary font-semibold">Target Amount to Pay</p>
                                <p className="text-2xl font-bold text-primary">{formatCurrency(targetAmount)}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-4">
                            <Button onClick={handleGeneratePayments} disabled={targetAmount <= 0}>Generate Payment Options</Button>
                            {generatedPayments.length > 0 && (
                                <div className="w-full">
                                    <h3 className="mb-2 font-semibold">Generated Payments:</h3>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-center">Action</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {generatedPayments.map(p => (
                                                <TableRow key={p.id}>
                                                    <TableCell>{p.description}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button size="sm" onClick={processPayment}>{editingPayment ? 'Update Payment' : 'Finalize Payment'}</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>CD Amount</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {currentPaymentHistory.map(p => (
                        <TableRow key={p.id}>
                        <TableCell>{p.paymentId}</TableCell>
                        <TableCell>{format(new Date(p.date), "dd-MMM-yy")}</TableCell>
                        <TableCell><Badge variant={p.receiptType === 'RTGS' ? 'default' : 'secondary'}>{p.receiptType}</Badge></TableCell>
                        <TableCell>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>{formatCurrency(p.cdAmount)}</TableCell>
                        <TableCell className="max-w-xs truncate">{p.notes}</TableCell>
                        <TableCell className="text-center">
                            <div className="flex justify-center items-center gap-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPaymentForDetails(p)}>
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
                                        <AlertDialogAction onClick={() => handleDeletePayment(p.id)}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                     {currentPaymentHistory.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">No payment history for this supplier.</TableCell>
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

      <Dialog open={!!detailsSupplierEntry} onOpenChange={(open) => !open && setDetailsSupplierEntry(null)}>
        <DialogContent className="max-w-4xl p-0">
          {detailsSupplierEntry && (
            <>
            <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-2 flex flex-row justify-between items-center">
                <div>
                    <DialogTitle className="text-base font-semibold">Details for SR No: {detailsSupplierEntry.srNo}</DialogTitle>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuRadioGroup value={activeLayout} onValueChange={(v) => setActiveLayout(v as LayoutOption)}>
                                <DropdownMenuRadioItem value="classic"><Rows3 className="mr-2 h-4 w-4" />Classic</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="compact"><LayoutList className="mr-2 h-4 w-4" />Compact</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="grid"><LayoutGrid className="mr-2 h-4 w-4" />Grid</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="step-by-step"><StepForward className="mr-2 h-4 w-4" />Step-by-Step</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DialogClose asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8"><X className="h-4 w-4"/></Button>
                    </DialogClose>
                </div>
            </DialogHeader>
            <ScrollArea className="max-h-[85vh]">
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-6">
                {activeLayout === 'classic' && (
                  <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                            <div className="flex flex-col items-center justify-center space-y-2 p-4 bg-muted rounded-lg h-full">
                                <p className="text-xs text-muted-foreground">SR No.</p>
                                <p className="text-2xl font-bold font-mono text-primary">{detailsSupplierEntry.srNo}</p>
                            </div>
                            <Separator orientation="vertical" className="h-auto mx-4 hidden md:block" />
                            <Separator orientation="horizontal" className="w-full md:hidden" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 flex-1 text-sm">
                                <DetailItem icon={<User size={14} />} label="Name" value={toTitleCase(detailsSupplierEntry.name)} />
                                <DetailItem icon={<Phone size={14} />} label="Contact" value={detailsSupplierEntry.contact} />
                                <DetailItem icon={<UserSquare size={14} />} label="S/O" value={toTitleCase(detailsSupplierEntry.so)} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Transaction Date" value={format(new Date(detailsSupplierEntry.date), "PPP")} />
                                <DetailItem icon={<CalendarIcon size={14} />} label="Due Date" value={format(new Date(detailsSupplierEntry.dueDate), "PPP")} />
                                <DetailItem icon={<Home size={14} />} label="Address" value={toTitleCase(detailsSupplierEntry.address)} className="col-span-1 sm:col-span-2" />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="p-4"><CardTitle className="text-base">Transaction &amp; Weight</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                  <DetailItem icon={<Truck size={14} />} label="Vehicle No." value={detailsSupplierEntry.vehicleNo.toUpperCase()} />
                                  <DetailItem icon={<Wheat size={14} />} label="Variety" value={toTitleCase(detailsSupplierEntry.variety)} />
                                  <DetailItem icon={<Wallet size={14} />} label="Payment Type" value={detailsSupplierEntry.paymentType} />
                                </div>
                                <Separator />
                                <Table className="text-xs">
                                    <TableBody>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Gross Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsSupplierEntry.grossWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Weight size={12} />Teir Weight (Less)</TableCell><TableCell className="text-right font-semibold p-1">- {detailsSupplierEntry.teirWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Scale size={12} />Final Weight</TableCell><TableCell className="text-right font-bold p-2">{detailsSupplierEntry.weight.toFixed(2)} kg</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="p-4"><CardTitle className="text-base">Financial Calculation</CardTitle></CardHeader>
                             <CardContent className="p-4 pt-0">
                                <Table className="text-xs">
                                    <TableBody>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={12} />Net Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsSupplierEntry.netWeight.toFixed(2)} kg</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Calculator size={12} />Rate</TableCell><TableCell className="text-right font-semibold p-1">@ {formatCurrency(detailsSupplierEntry.rate)}</TableCell></TableRow>
                                        <TableRow className="bg-muted/50"><TableCell className="font-bold p-2 flex items-center gap-2"><Banknote size={12} />Total Amount</TableCell><TableCell className="text-right font-bold p-2">{formatCurrency(detailsSupplierEntry.amount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Percent size={12} />Karta ({detailsSupplierEntry.kartaPercentage}%)</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsSupplierEntry.kartaAmount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Server size={12} />Laboury Rate</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">@ {detailsSupplierEntry.labouryRate.toFixed(2)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Milestone size={12} />Laboury Amount</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsSupplierEntry.labouryAmount)}</TableCell></TableRow>
                                        <TableRow><TableCell className="text-muted-foreground p-1 text-destructive flex items-center gap-2"><Landmark size={12} />Kanta</TableCell><TableCell className="text-right font-semibold p-1 text-destructive">- {formatCurrency(detailsSupplierEntry.kanta)}</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                             </CardContent>
                        </Card>
                    </div>

                    <Card className="border-primary/50 bg-primary/5 text-center">
                         <CardContent className="p-3">
                            <p className="text-sm text-primary/80 font-medium">Net Payable Amount</p>
                            <p className="text-3xl font-bold text-primary font-mono">
                                {formatCurrency(Number(detailsSupplierEntry.netAmount))}
                            </p>
                         </CardContent>
                    </Card>

                    <Card className="mt-4">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {paymentsForDetailsEntry.length > 0 ? (
                                <Table className="text-sm">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="p-2 text-xs">Payment ID</TableHead>
                                            <TableHead className="p-2 text-xs">Date</TableHead>
                                            <TableHead className="p-2 text-xs">Method</TableHead>
                                            <TableHead className="p-2 text-xs text-right">Amount Paid</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paymentsForDetailsEntry.map((payment, index) => {
                                             const paidForThis = payment.paidFor?.find(pf => pf.srNo === detailsSupplierEntry?.srNo);
                                             return (
                                                <TableRow key={payment.id || index}>
                                                    <TableCell className="p-2">{payment.paymentId || 'N/A'}</TableCell>
                                                    <TableCell className="p-2">{payment.date ? format(new Date(payment.date), "dd-MMM-yy") : 'N/A'}</TableCell>
                                                    <TableCell className="p-2"><Badge variant={payment.receiptType === 'RTGS' ? 'default' : 'secondary'}>{payment.receiptType}</Badge></TableCell>
                                                    <TableCell className="text-right p-2 font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell>
                                                </TableRow>
                                             );
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-center text-muted-foreground text-sm py-4">No payments have been applied to this entry yet.</p>
                            )}
                        </CardContent>
                    </Card>  
                  </div>
                )}
              </div>
            </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!selectedPaymentForDetails} onOpenChange={(open) => !open && setSelectedPaymentForDetails(null)}>
        <DialogContent className="max-w-2xl">
          {selectedPaymentForDetails && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Details: {selectedPaymentForDetails.paymentId}</DialogTitle>
                <DialogDescription>
                  Details of the payment made on {format(new Date(selectedPaymentForDetails.date), "PPP")}.
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <DetailItem icon={<Banknote size={14} />} label="Amount Paid" value={formatCurrency(selectedPaymentForDetails.amount)} />
                <DetailItem icon={<Percent size={14} />} label="CD Amount" value={formatCurrency(selectedPaymentForDetails.cdAmount)} />
                <DetailItem icon={<CalendarIcon size={14} />} label="Payment Type" value={selectedPaymentForDetails.type} />
                <DetailItem icon={<Receipt size={14} />} label="Payment Method" value={selectedPaymentForDetails.receiptType} />
                <DetailItem icon={<Hash size={14} />} label="CD Applied" value={selectedPaymentForDetails.cdApplied ? "Yes" : "No"} />
              </div>
              <h4 className="font-semibold text-sm">Entries Paid in this Transaction</h4>
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>SR No</TableHead>
                            <TableHead>Supplier Name</TableHead>
                            <TableHead className="text-right">Amount Paid</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedPaymentForDetails.paidFor?.map((pf, index) => {
                            const supplier = suppliers.find(s => s.srNo === pf.srNo);
                            return (
                                <TableRow key={index}>
                                    <TableCell>{pf.srNo}</TableCell>
                                    <TableCell>{supplier ? toTitleCase(supplier.name) : 'N/A'}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(pf.amount)}</TableCell>
                                    <TableCell className="text-center">
                                       {supplier && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                           setDetailsSupplierEntry(supplier);
                                           setSelectedPaymentForDetails(null);
                                       }}>
                                            <Info className="h-4 w-4" />
                                        </Button>}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedPaymentForDetails(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

    

"use client";

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Customer, CustomerSummary, Payment, PaidFor } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, cn, formatCurrency, formatSrNo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getSuppliersRealtime, getPaymentsRealtime, addBank, addBankBranch, getBanksRealtime, getBankBranchesRealtime } from '@/lib/firestore';
import { db } from "@/lib/firebase";
import { collection, runTransaction, doc, getDocs, query, where } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

import { PaymentForm } from '@/components/sales/supplier-payments/payment-form';
import { PaymentHistory } from '@/components/sales/supplier-payments/payment-history';
import { TransactionTable } from '@/components/sales/supplier-payments/transaction-table';
import { DetailsDialog } from '@/components/sales/supplier-payments/details-dialog';
import { PaymentDetailsDialog } from '@/components/sales/supplier-payments/payment-details-dialog';
import { OutstandingEntriesDialog } from '@/components/sales/supplier-payments/outstanding-entries-dialog';
import { BankSettingsDialog } from '@/components/sales/supplier-payments/bank-settings-dialog';
import { RTGSReceiptDialog } from '@/components/sales/supplier-payments/rtgs-receipt-dialog';


const suppliersCollection = collection(db, "suppliers");

export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [bankBranches, setBankBranches] = useState<any[]>([]);

  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  const [paymentId, setPaymentId] = useState('');
  const [rtgsSrNo, setRtgsSrNo] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  
  const [supplierDetails, setSupplierDetails] = useState({ name: '', fatherName: '', address: '', contact: ''});
  const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
  const [sixRNo, setSixRNo] = useState('');
  const [sixRDate, setSixRDate] = useState<Date | undefined>(new Date());
  const [parchiNo, setParchiNo] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [checkNo, setCheckNo] = useState('');
  
  const [rtgsQuantity, setRtgsQuantity] = useState(0);
  const [rtgsRate, setRtgsRate] = useState(0);
  const [rtgsAmount, setRtgsAmount] = useState(0);
  const [rtgsFor, setRtgsFor] = useState<'Supplier' | 'Outsider'>('Supplier');


  const [cdEnabled, setCdEnabled] = useState(false);
  const [cdPercent, setCdPercent] = useState(2);
  const [cdAt, setCdAt] = useState('unpaid_amount');
  const [calculatedCdAmount, setCalculatedCdAmount] = useState(0);

  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [detailsSupplierEntry, setDetailsSupplierEntry] = useState<Customer | null>(null);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);
  const [isOutstandingModalOpen, setIsOutstandingModalOpen] = useState(false);
  const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
  const [rtgsReceiptData, setRtgsReceiptData] = useState<Payment | null>(null);
  const [activeTab, setActiveTab] = useState('processing');
  const [openCombobox, setOpenCombobox] = useState(false);


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

  const getNextRtgsSrNo = useCallback((currentPayments: Payment[]) => {
        const rtgsPayments = currentPayments.filter(p => p.rtgsSrNo);
        if (rtgsPayments.length === 0) return formatSrNo(1, 'R');
        const lastRtgsNum = rtgsPayments.reduce((max, p) => {
            const numMatch = p.rtgsSrNo?.match(/^R(\d+)$/);
            const num = numMatch ? parseInt(numMatch[1], 10) : 0;
            return num > max ? num : max;
        }, 0);
        return formatSrNo(lastRtgsNum + 1, 'R');
    }, []);
  
  const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
  
  const customerSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();
    
    suppliers.forEach(s => {
        if (!s.customerId) return;
        if (!summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name, contact: s.contact, so: s.so, address: s.address,
                totalOutstanding: 0, paymentHistory: [], totalAmount: 0,
                totalPaid: 0, outstandingEntryIds: [], acNo: s.acNo,
                ifscCode: s.ifscCode, bank: s.bank, branch: s.branch
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
  
  const selectedEntries = useMemo(() => {
    return suppliers.filter(s => selectedEntryIds.has(s.id));
  }, [suppliers, selectedEntryIds]);
  
  const totalOutstandingForSelected = useMemo(() => {
    return Math.round(selectedEntries.reduce((acc, entry) => acc + (entry.netAmount || 0), 0));
  }, [selectedEntries]);
  
  const autoSetCDToggle = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isAnyDueInFuture = selectedEntries.some(e => new Date(e.dueDate) >= today);
    setCdEnabled(isAnyDueInFuture);
  }, [selectedEntries]);

  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsSupplierEntry) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsSupplierEntry.srNo)
    );
  }, [detailsSupplierEntry, paymentHistory]);

  const isLoadingInitial = loading && suppliers.length === 0;
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if(!isClient) return;
    
    let isSubscribed = true;
    setLoading(true);

    const unsubscribeSuppliers = getSuppliersRealtime((fetchedSuppliers) => {
      if (isSubscribed) {
          setSuppliers(fetchedSuppliers);
          setLoading(false);
      }
    }, (error) => {
        if(isSubscribed) {
            console.error("Error fetching suppliers:", error);
            stableToast({ variant: 'destructive', title: "Error", description: "Failed to load supplier data." });
            setLoading(false);
        }
    });

    const unsubscribePayments = getPaymentsRealtime((fetchedPayments) => {
      if(isSubscribed) {
        setPaymentHistory(fetchedPayments);
        if (!editingPayment) {
          setPaymentId(getNextPaymentId(fetchedPayments));
          setRtgsSrNo(getNextRtgsSrNo(fetchedPayments));
        }
      }
    }, (error) => {
        if(isSubscribed) {
            console.error("Error fetching payments:", error);
            stableToast({ variant: 'destructive', title: "Error", description: "Failed to load payment history." });
        }
    });
    
    const unsubscribeBanks = getBanksRealtime(setBanks, (error) => {
      if(isSubscribed) console.error("Error fetching banks:", error);
    });

    const unsubscribeBankBranches = getBankBranchesRealtime(setBankBranches, (error) => {
      if(isSubscribed) console.error("Error fetching bank branches:", error);
    });

    return () => {
      isSubscribed = false;
      unsubscribeSuppliers();
      unsubscribePayments();
      unsubscribeBanks();
      unsubscribeBankBranches();
    };
  }, [isClient, editingPayment, stableToast, getNextPaymentId, getNextRtgsSrNo]);
  
  useEffect(() => {
    if (paymentType === 'Partial') {
      setCdAt('paid_amount');
    }
  }, [paymentType]);

  useEffect(() => {
    autoSetCDToggle();
  }, [selectedEntryIds, autoSetCDToggle]);
  
  useEffect(() => {
    if (!cdEnabled) {
        setCalculatedCdAmount(0);
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseAmountForCd = 0;
    
    if (cdAt === 'paid_amount') {
        if (paymentType === 'Partial') {
            baseAmountForCd = paymentAmount;
        } else {
            let totalEligiblePaidAmount = 0;
            const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
            const paymentsForSelectedEntries = paymentHistory.filter(p => 
                p.paidFor?.some(pf => selectedSrNos.has(pf.srNo))
            );

            paymentsForSelectedEntries.forEach(p => {
                if (!p.cdApplied) {
                    p.paidFor?.forEach(pf => {
                        const originalEntry = selectedEntries.find(s => s.srNo === pf.srNo);
                        if (originalEntry && new Date(p.date) <= new Date(originalEntry.dueDate)) {
                            totalEligiblePaidAmount += pf.amount;
                        }
                    });
                }
            });
            baseAmountForCd = totalEligiblePaidAmount;
        }
    } else if (cdAt === 'unpaid_amount') {
        const eligibleEntries = selectedEntries.filter(e => new Date(e.dueDate) >= today);
        baseAmountForCd = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
    } else if (cdAt === 'full_amount') {
        const eligibleEntries = selectedEntries.filter(e => new Date(e.dueDate) >= today);
        const eligibleOutstanding = eligibleEntries.reduce((sum, entry) => sum + (entry.netAmount || 0), 0);
        let eligiblePaid = 0;
        const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
        const paymentsForSelectedEntries = paymentHistory.filter(p => 
            p.paidFor?.some(pf => selectedSrNos.has(pf.srNo))
        );

        paymentsForSelectedEntries.forEach(p => {
            if (!p.cdApplied) {
                p.paidFor?.forEach(pf => {
                    const originalEntry = selectedEntries.find(s => s.srNo === pf.srNo);
                    if (originalEntry && new Date(p.date) <= new Date(originalEntry.dueDate)) {
                        eligiblePaid += pf.amount;
                    }
                });
            }
        });
        
        baseAmountForCd = eligibleOutstanding + eligiblePaid;
    }

    setCalculatedCdAmount(Math.round((baseAmountForCd * cdPercent) / 100));
  }, [cdEnabled, cdPercent, cdAt, paymentAmount, selectedEntries, paymentHistory, paymentType]);

  useEffect(() => {
    if (paymentType === 'Full') {
      const newAmount = Math.round(totalOutstandingForSelected - calculatedCdAmount);
      setPaymentAmount(newAmount > 0 ? newAmount : 0);
    }
  }, [totalOutstandingForSelected, calculatedCdAmount, paymentType]);

   useEffect(() => {
    if (selectedEntries.length > 0) {
      const parchiNumbers = selectedEntries.map(e => e.srNo).join(', ');
      setParchiNo(parchiNumbers);
    } else {
      setParchiNo('');
    }
  }, [selectedEntries]);
   
  const resetPaymentForm = useCallback((isOutsider: boolean = false) => {
    if (!isOutsider) {
      setSelectedEntryIds(new Set());
    }
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPayment(null);
    setUtrNo('');
    setCheckNo('');
    setSixRNo('');
    setParchiNo('');
    setRtgsQuantity(0);
    setRtgsRate(0);
    setRtgsAmount(0);
    setPaymentId(getNextPaymentId(paymentHistory));
    setRtgsSrNo(getNextRtgsSrNo(paymentHistory));
    if (isOutsider) {
      setSupplierDetails({ name: '', fatherName: '', address: '', contact: '' });
      setBankDetails({ acNo: '', ifscCode: '', bank: '', branch: '' });
      setPaymentType('Full');
    }
  }, [getNextPaymentId, getNextRtgsSrNo, paymentHistory]);

  const handleFullReset = useCallback(() => {
    setSelectedCustomerKey(null);
    resetPaymentForm();
  }, [resetPaymentForm]);

  const handleCustomerSelect = (key: string) => {
    setSelectedCustomerKey(key);
    const customerData = customerSummaryMap.get(key);
    if(customerData) {
        setSupplierDetails({
            name: customerData.name || '',
            fatherName: customerData.so || '',
            address: customerData.address || '',
            contact: customerData.contact || ''
        });
        setBankDetails({
            acNo: customerData.acNo || '',
            ifscCode: customerData.ifscCode || '',
            bank: customerData.bank || '',
            branch: customerData.branch || '',
        });
    }
    resetPaymentForm();
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

    const processPayment = async () => {
        if (rtgsFor === 'Supplier' && !selectedCustomerKey) {
            toast({ variant: 'destructive', title: "Error", description: "No supplier selected." });
            return;
        }
        if (rtgsFor === 'Supplier' && selectedEntryIds.size === 0 && !editingPayment) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries to pay." });
            return;
        }

        const finalPaymentAmount = rtgsAmount || paymentAmount;
        const totalPaidAmount = finalPaymentAmount + calculatedCdAmount;

        if (totalPaidAmount <= 0) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Payment amount must be greater than zero." });
            return;
        }
        if (rtgsFor === 'Supplier' && paymentType === 'Partial' && !editingPayment && totalPaidAmount > totalOutstandingForSelected) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
            return;
        }

        try {
            let finalPaymentData: Payment | null = null;
            await runTransaction(db, async (transaction) => {
                const tempEditingPayment = editingPayment;
                let paidForDetails: PaidFor[] = [];
                
                const supplierDocRefsToRead = new Set<string>();

                if (rtgsFor === 'Supplier') {
                    if (tempEditingPayment) {
                        for (const detail of tempEditingPayment.paidFor || []) {
                            const supplier = suppliers.find(s => s.srNo === detail.srNo);
                            if(supplier) supplierDocRefsToRead.add(supplier.id);
                        }
                    }
                    for (const entryId of selectedEntryIds) {
                        supplierDocRefsToRead.add(entryId);
                    }
                }
                
                const supplierDocs = new Map<string, any>();
                for (const id of supplierDocRefsToRead) {
                    const docRef = doc(db, "suppliers", id);
                    const supplierDoc = await transaction.get(docRef);
                    if (supplierDoc.exists()) {
                        supplierDocs.set(id, supplierDoc.data());
                    } else {
                         throw new Error(`Supplier with ID ${id} not found.`);
                    }
                }
                
                if (rtgsFor === 'Supplier') {
                    if (tempEditingPayment) {
                        for (const detail of tempEditingPayment.paidFor || []) {
                            const supplier = suppliers.find(s => s.srNo === detail.srNo);
                            if (supplier && supplierDocs.has(supplier.id)) {
                                const currentNetAmount = Number(supplierDocs.get(supplier.id).netAmount) || 0;
                                const amountToRestore = detail.amount + (detail.cdApplied ? (tempEditingPayment.cdAmount || 0) / (tempEditingPayment.paidFor?.length || 1) : 0);
                                const supplierRef = doc(db, "suppliers", supplier.id);
                                transaction.update(supplierRef, { netAmount: Math.round(currentNetAmount + amountToRestore) });
                            }
                        }
                    }

                    let amountToDistribute = Math.round(totalPaidAmount);
                    const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    for (const entryData of sortedEntries) {
                        if (amountToDistribute <= 0) break;
                        const supplierData = supplierDocs.get(entryData.id);
                        let outstanding = Number(supplierData.netAmount);
                        const paymentForThisEntry = Math.min(outstanding, amountToDistribute);

                        if (paymentForThisEntry > 0) {
                             paidForDetails.push({ 
                                srNo: entryData.srNo, amount: paymentForThisEntry, cdApplied: cdEnabled,
                                supplierName: toTitleCase(entryData.name), supplierSo: toTitleCase(entryData.so),
                                supplierContact: entryData.contact,
                            });
                            
                            const supplierRef = doc(db, "suppliers", entryData.id);
                            transaction.update(supplierRef, { netAmount: outstanding - paymentForThisEntry });
                            amountToDistribute -= paymentForThisEntry;
                        }
                    }
                }
                
                const paymentData: Omit<Payment, 'id'> = {
                    paymentId: tempEditingPayment ? tempEditingPayment.paymentId : paymentId,
                    rtgsSrNo: paymentMethod === 'RTGS' ? (tempEditingPayment ? tempEditingPayment.rtgsSrNo : rtgsSrNo) : undefined,
                    customerId: rtgsFor === 'Supplier' ? selectedCustomerKey || '' : 'OUTSIDER',
                    date: new Date().toISOString().split("T")[0], amount: Math.round(finalPaymentAmount),
                    cdAmount: Math.round(calculatedCdAmount), cdApplied: cdEnabled, type: paymentType,
                    receiptType: paymentMethod, notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                    paidFor: rtgsFor === 'Supplier' ? paidForDetails : [],
                    sixRNo: sixRNo, sixRDate: sixRDate ? format(sixRDate, 'yyyy-MM-dd') : '',
                    parchiNo, utrNo, checkNo, quantity: rtgsQuantity, rate: rtgsRate, rtgsAmount,
                    supplierName: toTitleCase(supplierDetails.name), supplierFatherName: toTitleCase(supplierDetails.fatherName),
                    supplierAddress: toTitleCase(supplierDetails.address), bankName: bankDetails.bank,
                    bankBranch: bankDetails.branch, bankAcNo: bankDetails.acNo, bankIfsc: bankDetails.ifscCode,
                    rtgsFor: rtgsFor,
                };

                if (tempEditingPayment) {
                    const paymentRef = doc(db, "payments", tempEditingPayment.id);
                    transaction.update(paymentRef, paymentData);
                    finalPaymentData = { id: tempEditingPayment.id, ...paymentData };
                } else {
                    const newPaymentRef = doc(collection(db, "payments"));
                    transaction.set(newPaymentRef, { ...paymentData, id: newPaymentRef.id });
                    finalPaymentData = { id: newPaymentRef.id, ...paymentData };
                }
            });

            toast({ title: "Success", description: `Payment ${editingPayment ? 'updated' : 'processed'} successfully.` });
            if (paymentMethod === 'RTGS' && finalPaymentData) {
                setRtgsReceiptData(finalPaymentData);
            }
            resetPaymentForm(rtgsFor === 'Outsider');
        } catch (error) {
            console.error("Error processing payment:", error);
            toast({ variant: "destructive", title: "Transaction Failed", description: "Failed to process payment. Please try again." });
        }
    };

    const handleEditPayment = async (paymentToEdit: Payment) => {
        const srNosInPayment = (paymentToEdit.paidFor || []).map(pf => pf.srNo);
        
        if (paymentToEdit.rtgsFor === 'Supplier') {
          const q = query(suppliersCollection, where('srNo', 'in', srNosInPayment));
          const supplierDocs = await getDocs(q);
          const foundSrNos = new Set(supplierDocs.docs.map(d => d.data().srNo));
          
          if (foundSrNos.size !== srNosInPayment.length) {
              toast({ variant: "destructive", title: "Cannot Edit Payment", description: "Some original supplier entries for this payment could not be found." });
              return;
          }

          const newSelectedEntryIds = new Set<string>();
          supplierDocs.forEach(doc => newSelectedEntryIds.add(doc.id));
          setSelectedEntryIds(newSelectedEntryIds);
        } else {
            setSelectedEntryIds(new Set());
        }

        setSelectedCustomerKey(paymentToEdit.customerId);
        setEditingPayment(paymentToEdit);
        setPaymentId(paymentToEdit.paymentId);
        setRtgsSrNo(paymentToEdit.rtgsSrNo || '');
        setPaymentAmount(paymentToEdit.amount);
        setPaymentType(paymentToEdit.type);
        setPaymentMethod(paymentToEdit.receiptType);
        setCdEnabled(paymentToEdit.cdApplied);
        setCalculatedCdAmount(paymentToEdit.cdAmount);
        setRtgsFor(paymentToEdit.rtgsFor || 'Supplier');
        setUtrNo(paymentToEdit.utrNo || '');
        setCheckNo(paymentToEdit.checkNo || '');
        setSixRNo(paymentToEdit.sixRNo || '');
        setSixRDate(paymentToEdit.sixRDate ? new Date(paymentToEdit.sixRDate) : undefined);
        setParchiNo(paymentToEdit.parchiNo || '');
        setRtgsQuantity(paymentToEdit.quantity || 0);
        setRtgsRate(paymentToEdit.rate || 0);
        setRtgsAmount(paymentToEdit.rtgsAmount || 0);
        setSupplierDetails({
            name: paymentToEdit.supplierName || '', fatherName: paymentToEdit.supplierFatherName || '',
            address: paymentToEdit.supplierAddress || '', contact: ''
        });
        setBankDetails({
            acNo: paymentToEdit.bankAcNo || '', ifscCode: paymentToEdit.bankIfsc || '',
            bank: paymentToEdit.bankName || '', branch: paymentToEdit.bankBranch || '',
        });
        setActiveTab('processing');
        toast({ title: "Editing Mode", description: `Editing payment ${paymentToEdit.paymentId}. Associated entries have been selected.` });
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
                const supplierDocRefs = new Map<string, string>();
                const srNos = (paymentToDelete.paidFor || []).map(pf => pf.srNo);
                if (srNos.length > 0) {
                    const q = query(suppliersCollection, where('srNo', 'in', srNos));
                    const supplierQuerySnapshot = await getDocs(q);
                    supplierQuerySnapshot.forEach(doc => {
                        supplierDocRefs.set(doc.data().srNo, doc.id);
                    });
                }
    
                const supplierDocsData = new Map<string, any>();
                for (const [srNo, docId] of supplierDocRefs.entries()) {
                    const docRef = doc(db, "suppliers", docId);
                    const supplierDoc = await transaction.get(docRef);
                    if (supplierDoc.exists()) {
                        supplierDocsData.set(srNo, supplierDoc.data());
                    }
                }
    
                for (const detail of paymentToDelete.paidFor || []) {
                    const supplierData = supplierDocsData.get(detail.srNo);
                    if (supplierData) {
                        const docId = supplierDocRefs.get(detail.srNo)!;
                        const supplierDocRef = doc(db, "suppliers", docId);
                        const currentNetAmount = Number(supplierData.netAmount) || 0;
                        const amountToRestore = detail.amount;
                        transaction.update(supplierDocRef, { netAmount: Math.round(currentNetAmount + amountToRestore) });
                    }
                }
                transaction.delete(paymentRef);
            });
    
            toast({ title: 'Payment Deleted', description: `Payment ${paymentToDelete.paymentId} has been removed.`, duration: 3000 });
            if (editingPayment?.id === paymentIdToDelete) resetPaymentForm();
        } catch (error) {
            console.error("Error deleting payment:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete payment." });
        }
    };
    
    const handlePaySelectedOutstanding = () => {
        if (selectedEntryIds.size === 0) {
            toast({ variant: "destructive", title: "No Entries Selected", description: "Please select entries to pay." });
            return;
        }
        setIsOutstandingModalOpen(false);
    };

    if (!isClient || isLoadingInitial) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
            </div>
        );
    }
  
  return (
    <div className="space-y-3">
        <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-3 h-9"><TabsTrigger value="Cash">Cash</TabsTrigger><TabsTrigger value="Online">Online</TabsTrigger><TabsTrigger value="RTGS">RTGS</TabsTrigger></TabsList>
        </Tabs>
        
        {paymentMethod === 'RTGS' && (
             <div className="flex items-center space-x-2 p-2">
                <button
                    type="button"
                    onClick={() => {
                        const newType = rtgsFor === 'Supplier' ? 'Outsider' : 'Supplier';
                        setRtgsFor(newType);
                        resetPaymentForm(newType === 'Outsider');
                    }}
                    className={cn(
                        "relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        rtgsFor === 'Outsider' ? 'bg-primary/20' : 'bg-secondary/20'
                    )}
                >
                    <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", rtgsFor === 'Supplier' ? 'text-primary' : 'text-muted-foreground')}>Supplier</span>
                    <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", rtgsFor === 'Outsider' ? 'text-primary' : 'text-muted-foreground')}>Outsider</span>
                    <div
                        className={cn(
                            "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                            rtgsFor === 'Supplier' ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'
                        )}
                    >
                        <div className={cn(
                            "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300",
                            rtgsFor === 'Supplier' ? 'bg-secondary' : 'bg-primary'
                        )}>
                            <span className="text-sm font-bold text-primary-foreground">For</span>
                        </div>
                    </div>
                </button>
            </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="processing">Payment Processing</TabsTrigger>
                <TabsTrigger value="history">Full History</TabsTrigger>
            </TabsList>
            <TabsContent value="processing">
              <Card>
                <CardContent className="pt-6">
                    {(paymentMethod !== 'RTGS' || rtgsFor === 'Supplier') && (
                        <Card>
                            <CardContent className="p-3">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                                    <div className="flex flex-1 items-center gap-2">
                                        <Label htmlFor="supplier-select" className="text-sm font-semibold whitespace-nowrap">Select Supplier:</Label>
                                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                            <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={openCombobox} className="h-8 text-xs flex-1 justify-between font-normal">{selectedCustomerKey ? toTitleCase(customerSummaryMap.get(selectedCustomerKey)?.name || '') + ` (${customerSummaryMap.get(selectedCustomerKey)?.contact || ''})` : "Search and select supplier..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Search by name or contact..." /><CommandList><CommandEmpty>No supplier found.</CommandEmpty><CommandGroup>
                                                {Array.from(customerSummaryMap.entries()).map(([key, data]) => (
                                                    <CommandItem key={key} value={`${data.name} ${data.contact}`} onSelect={() => { handleCustomerSelect(key); setOpenCombobox(false); }}>
                                                      <Check className={cn("mr-2 h-4 w-4", selectedCustomerKey === key ? "opacity-100" : "opacity-0")}/>{toTitleCase(data.name)} ({data.contact})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup></CommandList></Command></PopoverContent>
                                        </Popover>
                                    </div>
                                    {selectedCustomerKey && (
                                        <div className="flex items-center gap-2 md:border-l md:pl-2 w-full md:w-auto mt-2 md:mt-0">
                                            <div className="flex items-center gap-1 text-xs">
                                                <Label className="font-medium text-muted-foreground">Total Outstanding:</Label>
                                                <p className="font-bold text-destructive">{formatCurrency(customerSummaryMap.get(selectedCustomerKey)?.totalOutstanding || 0)}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)} className="h-7 text-xs">Change Selection</Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {(selectedCustomerKey || rtgsFor === 'Outsider') && (
                        <PaymentForm
                            paymentMethod={paymentMethod} rtgsFor={rtgsFor} supplierDetails={supplierDetails}
                            setSupplierDetails={setSupplierDetails} bankDetails={bankDetails} setBankDetails={setBankDetails}
                            banks={banks} bankBranches={bankBranches} paymentId={paymentId} setPaymentId={setPaymentId}
                            handlePaymentIdBlur={() => {}} rtgsSrNo={rtgsSrNo} setRtgsSrNo={setRtgsSrNo} paymentType={paymentType} setPaymentType={setPaymentType}
                            paymentAmount={paymentAmount} setPaymentAmount={setPaymentAmount} cdEnabled={cdEnabled}
                            setCdEnabled={setCdEnabled} cdPercent={cdPercent} setCdPercent={setCdPercent}
                            cdAt={cdAt} setCdAt={setCdAt} calculatedCdAmount={calculatedCdAmount} sixRNo={sixRNo}
                            setSixRNo={setSixRNo} sixRDate={sixRDate} setSixRDate={setSixRDate} utrNo={utrNo}
                            setUtrNo={setUtrNo} targetAmountForGenerator={totalOutstandingForSelected - calculatedCdAmount}
                            rtgsQuantity={rtgsQuantity} setRtgsQuantity={setRtgsQuantity} rtgsRate={rtgsRate}
                            setRtgsRate={setRtgsRate} rtgsAmount={rtgsAmount} setRtgsAmount={setRtgsAmount}
                            processPayment={processPayment} resetPaymentForm={() => resetPaymentForm(rtgsFor === 'Outsider')}
                            editingPayment={editingPayment} setIsBankSettingsOpen={setIsBankSettingsOpen} checkNo={checkNo}
                            setCheckNo={setCheckNo}
                        />
                    )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="history">
                 <div className="space-y-3">
                    <PaymentHistory
                        payments={paymentHistory}
                        onEdit={handleEditPayment}
                        onDelete={handleDeletePayment}
                        onShowDetails={setSelectedPaymentForDetails}
                        onPrintRtgs={setRtgsReceiptData}
                    />
                    <TransactionTable
                        suppliers={suppliers}
                        onShowDetails={setDetailsSupplierEntry}
                    />
                 </div>
            </TabsContent>
        </Tabs>
      
        <OutstandingEntriesDialog
            isOpen={isOutstandingModalOpen}
            onOpenChange={setIsOutstandingModalOpen}
            customerName={toTitleCase(customerSummaryMap.get(selectedCustomerKey || '')?.name || '')}
            entries={suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0)}
            selectedIds={selectedEntryIds}
            onSelect={handleEntrySelect}
            onSelectAll={(checked: boolean) => {
                const newSet = new Set<string>();
                const outstandingEntries = suppliers.filter(s => s.customerId === customerIdKey && parseFloat(String(s.netAmount)) > 0);
                if(checked) outstandingEntries.forEach(e => newSet.add(e.id));
                setSelectedEntryIds(newSet);
            }}
            onConfirm={handlePaySelectedOutstanding}
            onCancel={() => { setIsOutstandingModalOpen(false); handleFullReset(); }}
        />

        <DetailsDialog 
            entry={detailsSupplierEntry}
            payments={paymentsForDetailsEntry}
            onOpenChange={() => setDetailsSupplierEntry(null)}
        />
        
        <PaymentDetailsDialog
            payment={selectedPaymentForDetails}
            suppliers={suppliers}
            onOpenChange={() => setSelectedPaymentForDetails(null)}
            onShowEntryDetails={setDetailsSupplierEntry}
        />
        
       <RTGSReceiptDialog
            payment={rtgsReceiptData}
            onOpenChange={() => setRtgsReceiptData(null)}
       />

      <BankSettingsDialog
        isOpen={isBankSettingsOpen}
        onOpenChange={setIsBankSettingsOpen}
        banks={banks}
        onAddBank={async (name: string) => { await addBank(name); toast({title: 'Bank Added'}); }}
        onAddBranch={async (branch: any) => { await addBankBranch(branch); toast({title: 'Branch Added'}); }}
      />
    </div>
  );
}

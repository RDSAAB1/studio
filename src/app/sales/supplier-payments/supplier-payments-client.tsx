
"use client";

import type { Customer, CustomerSummary, Payment, PaidFor, Bank, BankBranch } from "@/lib/definitions";
import { toTitleCase, formatPaymentId, cn, formatCurrency } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Trash, Info, Pen, X, Calendar as CalendarIcon, Banknote, Percent, Hash, Users, Loader2, UserSquare, Home, Phone, Truck, Wheat, Wallet, Scale, Calculator, Landmark, Server, Milestone, Settings, Rows3, LayoutList, LayoutGrid, StepForward, ArrowRight, FileText, Weight, Receipt, User, Building, ClipboardList, ArrowUpDown, Search, ChevronsUpDown, Check, Plus, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { appOptionsData, bankNames, bankBranches as staticBankBranches } from "@/lib/data";
import { RtgsReceipt } from "@/components/receipts/rtgs-receipt";


import { collection, runTransaction, doc, getDocs, query, where, writeBatch, getDoc } from "firebase/firestore";
import { getSuppliersRealtime, getPaymentsRealtime, getBanksRealtime, getBankBranchesRealtime, addBank, addBankBranch } from '@/lib/firestore';
import { db } from "@/lib/firebase";


const suppliersCollection = collection(db, "suppliers");
const paymentsCollection = collection(db, "payments");

type LayoutOption = 'classic' | 'compact' | 'grid' | 'step-by-step';
type PaymentCombination = {
    quantity: number;
    rate: number;
    amount: number;
    remainingAmount: number;
};
type SortKey = keyof PaymentCombination;
type SortDirection = 'asc' | 'desc';


const cdOptions = [
    { value: 'paid_amount', label: 'CD on Paid Amount' },
    { value: 'unpaid_amount', label: 'CD on Unpaid Amount (Selected)' },
    { value: 'payment_amount', label: 'CD on Payment Amount (Manual)' },
    { value: 'full_amount', label: 'CD on Full Amount' },
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
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankBranches, setBankBranches] = useState<BankBranch[]>([]);

  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  const [paymentId, setPaymentId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('Full');
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // New state for payment method
  
  // RTGS specific fields
  const [supplierDetails, setSupplierDetails] = useState({ name: '', fatherName: '', address: '', contact: ''});
  const [bankDetails, setBankDetails] = useState({ acNo: '', ifscCode: '', bank: '', branch: '' });
  const [grNo, setGrNo] = useState('');
  const [parchiNo, setParchiNo] = useState('');
  const [utrNo, setUtrNo] = useState('');
  const [checkNo, setCheckNo] = useState('');
  
  // RTGS Generator State
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [minRate, setMinRate] = useState(0);
  const [maxRate, setMaxRate] = useState(0);
  const [paymentCombinations, setPaymentCombinations] = useState<PaymentCombination[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [rtgsQuantity, setRtgsQuantity] = useState(0);
  const [rtgsRate, setRtgsRate] = useState(0);
  const [rtgsAmount, setRtgsAmount] = useState(0);
  const [isRoundFigureMode, setIsRoundFigureMode] = useState(false);


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
  const [isBankSettingsOpen, setIsBankSettingsOpen] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBranchData, setNewBranchData] = useState({ bankName: '', branchName: '', ifscCode: '' });
  const [rtgsReceiptData, setRtgsReceiptData] = useState<Payment | null>(null);

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
  
  const customerIdKey = selectedCustomerKey ? selectedCustomerKey : '';
  
  const customerSummaryMap = useMemo(() => {
    const summary = new Map<string, CustomerSummary>();
    
    suppliers.forEach(s => {
        if (!s.customerId) return;
        if (!summary.has(s.customerId)) {
            summary.set(s.customerId, {
                name: s.name,
                contact: s.contact,
                so: s.so,
                address: s.address,
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

  const sortedCombinations = useMemo(() => {
    if (!sortConfig) return paymentCombinations;
    return [...paymentCombinations].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
  }, [paymentCombinations, sortConfig]);

  const paymentsForDetailsEntry = useMemo(() => {
    if (!detailsSupplierEntry) return [];
    return paymentHistory.filter(p => 
      p.paidFor?.some(pf => pf.srNo === detailsSupplierEntry.srNo)
    );
  }, [detailsSupplierEntry, paymentHistory]);

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

  const targetAmountForGenerator = useMemo(() => {
    return paymentType === 'Full' 
      ? Math.round(totalOutstandingForSelected - calculatedCdAmount) 
      : paymentAmount;
  }, [paymentType, totalOutstandingForSelected, calculatedCdAmount, paymentAmount]);

  const isLoadingInitial = loading && suppliers.length === 0;
  
  const combinedBankBranches = useMemo(() => {
    const combined = [...staticBankBranches.map(b => ({...b, id: b.ifscCode+b.branchName})), ...bankBranches];
    const uniqueBranches = Array.from(new Map(combined.map(item => [item.ifscCode + item.branchName, item])).values());
    return uniqueBranches;
  }, [bankBranches]);

  const combinedBanks = useMemo(() => {
      const allBankNames = new Set([...bankNames, ...banks.map(b => b.name)]);
      return Array.from(allBankNames).sort();
  }, [banks]);


  const availableBranches = useMemo(() => {
    if (!bankDetails.bank) return [];
    
    const selectedBankName = bankDetails.bank.toLowerCase();
    const parts = selectedBankName.split(' - ');
    const shortName = parts[0]?.trim();
    const longName = parts[1]?.trim();

    return combinedBankBranches.filter(branch => {
        const branchBankNameLower = branch.bankName.toLowerCase();
        // Check if branch's bank name matches either the short or long form of the selected bank
        return branchBankNameLower === shortName || (longName && branchBankNameLower === longName);
    });
}, [bankDetails.bank, combinedBankBranches]);

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
        }
      }
    }, (error) => {
        if(isSubscribed) {
            console.error("Error fetching payments:", error);
            stableToast({ variant: 'destructive', title: "Error", description: "Failed to load payment history." });
        }
    });
    
    const unsubscribeBanks = getBanksRealtime(setBanks, (error) => {
      if(isSubscribed) {
        console.error("Error fetching banks:", error);
        stableToast({ variant: 'destructive', title: "Error", description: "Failed to load bank list." });
      }
    });

    const unsubscribeBankBranches = getBankBranchesRealtime(setBankBranches, (error) => {
      if(isSubscribed) {
        console.error("Error fetching bank branches:", error);
        stableToast({ variant: 'destructive', title: "Error", description: "Failed to load bank branches." });
      }
    });

    // Load persisted rates
    const savedMinRate = localStorage.getItem('minRate');
    const savedMaxRate = localStorage.getItem('maxRate');
    if (savedMinRate) setMinRate(Number(savedMinRate));
    if (savedMaxRate) setMaxRate(Number(savedMaxRate));


    return () => {
      isSubscribed = false;
      unsubscribeSuppliers();
      unsubscribePayments();
      unsubscribeBanks();
      unsubscribeBankBranches();
    };
  }, [isClient, editingPayment, stableToast, getNextPaymentId]);
  
    // Persist Min/Max Rate
  useEffect(() => {
    if (isClient) {
        localStorage.setItem('minRate', String(minRate));
    }
  }, [minRate, isClient]);

  useEffect(() => {
    if (isClient) {
        localStorage.setItem('maxRate', String(maxRate));
    }
  }, [maxRate, isClient]);

  useEffect(() => {
    if (paymentType === 'Partial') {
      setCdAt('payment_amount');
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

    let base = 0;
    const currentPaymentAmount = paymentAmount || 0;
    const outstandingForSelected = totalOutstandingForSelected;

    switch (cdAt) {
      case 'paid_amount': {
        const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
        const pastPaymentsForSelectedEntries = paymentHistory.filter(p =>
          p.paidFor?.some(pf => selectedSrNos.has(pf.srNo))
        );

        const paidAmountWithoutCD = pastPaymentsForSelectedEntries.reduce((sum, p) => {
          if (!p.cdApplied) {
            return sum + p.amount;
          }
          return sum;
        }, 0);
        base = paidAmountWithoutCD;
        break;
      }
      case 'payment_amount':
        base = currentPaymentAmount;
        break;
      case 'unpaid_amount':
        base = outstandingForSelected;
        break;
      case 'full_amount': {
        const selectedSrNos = new Set(selectedEntries.map(e => e.srNo));
        const pastPaymentsForSelectedEntries = paymentHistory.filter(p =>
          p.paidFor?.some(pf => selectedSrNos.has(pf.srNo))
        );

        const paidAmountWithCD = pastPaymentsForSelectedEntries.reduce((sum, p) => {
             if (p.cdApplied) {
                return sum + p.amount + (p.cdAmount || 0);
             }
             return sum;
        }, 0);

        const totalOriginalAmount = selectedEntries.reduce((sum, entry) => sum + (entry.originalNetAmount || entry.amount), 0);
        base = totalOriginalAmount - paidAmountWithCD;
        break;
      }
      default:
        base = 0;
    }

    setCalculatedCdAmount(Math.round((base * cdPercent) / 100));
  }, [cdEnabled, paymentAmount, cdPercent, cdAt, selectedEntries, paymentHistory, totalOutstandingForSelected]);


  useEffect(() => {
    if (paymentType === 'Full') {
      const newAmount = Math.round(totalOutstandingForSelected - calculatedCdAmount);
      setPaymentAmount(newAmount);
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
   
  const resetPaymentForm = useCallback(() => {
    setSelectedEntryIds(new Set());
    setPaymentAmount(0);
    setCdEnabled(false);
    setEditingPayment(null);
    setUtrNo('');
    setCheckNo('');
    setGrNo('');
    setParchiNo('');
    setRtgsQuantity(0);
    setRtgsRate(0);
    setRtgsAmount(0);
    setPaymentCombinations([]);
    setPaymentId(getNextPaymentId(paymentHistory));
  }, [getNextPaymentId, paymentHistory]);

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
        setIsOutstandingModalOpen(true);
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
        if (!selectedCustomerKey) {
            toast({ variant: 'destructive', title: "Error", description: "No supplier selected." });
            return;
        }
        if (selectedEntryIds.size === 0) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Please select entries to pay." });
            return;
        }

        const finalPaymentAmount = rtgsAmount || paymentAmount;

        if (finalPaymentAmount <= 0 && calculatedCdAmount <= 0) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Payment amount must be greater than zero." });
            return;
        }
        if (paymentType === 'Partial' && !editingPayment && finalPaymentAmount > totalOutstandingForSelected) {
            toast({ variant: 'destructive', title: "Invalid Payment", description: "Partial payment cannot exceed total outstanding." });
            return;
        }

        try {
            let finalPaymentData: Payment | null = null;
            await runTransaction(db, async (transaction) => {
                const tempEditingPayment = editingPayment;
                
                const allInvolvedSrNos = new Set<string>();
                if (tempEditingPayment) {
                    (tempEditingPayment.paidFor || []).forEach(pf => allInvolvedSrNos.add(pf.srNo));
                }
                selectedEntries.forEach(e => allInvolvedSrNos.add(e.srNo));

                const involvedSupplierDocs = new Map<string, any>();
                for (const srNo of allInvolvedSrNos) {
                    // Find the supplier doc from the already-fetched `suppliers` state
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
                
                let remainingPayment = Math.round(finalPaymentAmount + calculatedCdAmount);
                const paidForDetails: PaidFor[] = [];
                const sortedEntries = selectedEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                sortedEntries.forEach(entryData => {
                    if (remainingPayment > 0) {
                        let outstanding = outstandingBalances[entryData.srNo];
                        const amountToPay = Math.min(outstanding, remainingPayment);

                        if (amountToPay > 0) {
                            const isEligibleForCD = cdEligibleEntries.some(entry => entry.id === entryData.id);
                            paidForDetails.push({ 
                                srNo: entryData.srNo, 
                                amount: amountToPay, 
                                cdApplied: cdEnabled && isEligibleForCD,
                                supplierName: toTitleCase(entryData.name),
                                supplierSo: toTitleCase(entryData.so),
                                supplierContact: entryData.contact,
                                bankName: entryData.bank || '',
                                bankAcNo: entryData.acNo || '',
                                bankBranch: entryData.branch || '',
                                bankIfsc: entryData.ifscCode || '',
                            });
                            
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

                // Update bank details for the customerId if they have changed in the form
                const currentSupplierSummary = customerSummaryMap.get(selectedCustomerKey);
                if (currentSupplierSummary && (
                    currentSupplierSummary.acNo !== bankDetails.acNo ||
                    currentSupplierSummary.ifscCode !== bankDetails.ifscCode ||
                    currentSupplierSummary.bank !== bankDetails.bank ||
                    currentSupplierSummary.branch !== bankDetails.branch
                )) {
                    const q = query(suppliersCollection, where('customerId', '==', selectedCustomerKey));
                    const supplierDocsToUpdate = await getDocs(q); // Use getDocs inside transaction, though not ideal, needed here
                    supplierDocsToUpdate.forEach(docSnap => {
                        transaction.update(docSnap.ref, { ...bankDetails });
                    });
                }
                
                const paymentData: Omit<Payment, 'id'> = {
                    paymentId: tempEditingPayment ? tempEditingPayment.paymentId : paymentId,
                    customerId: selectedCustomerKey,
                    date: new Date().toISOString().split("T")[0],
                    amount: Math.round(finalPaymentAmount),
                    cdAmount: Math.round(calculatedCdAmount),
                    cdApplied: cdEnabled,
                    type: paymentType,
                    receiptType: paymentMethod,
                    notes: `UTR: ${utrNo || ''}, Check: ${checkNo || ''}`,
                    paidFor: paidForDetails,
                    grNo,
                    parchiNo,
                    utrNo,
                    checkNo,
                    quantity: rtgsQuantity,
                    rate: rtgsRate,
                    rtgsAmount,
                    supplierName: supplierDetails.name,
                    supplierFatherName: supplierDetails.fatherName,
                    supplierAddress: supplierDetails.address,
                    bankName: bankDetails.bank,
                    bankBranch: bankDetails.branch,
                    bankAcNo: bankDetails.acNo,
                    bankIfsc: bankDetails.ifscCode,
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
            resetPaymentForm();
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
        setUtrNo(paymentToEdit.utrNo || '');
        setCheckNo(paymentToEdit.checkNo || '');
        setGrNo(paymentToEdit.grNo || '');
        setParchiNo(paymentToEdit.parchiNo || '');
        setRtgsQuantity(paymentToEdit.quantity || 0);
        setRtgsRate(paymentToEdit.rate || 0);
        setRtgsAmount(paymentToEdit.rtgsAmount || 0);
        setSupplierDetails({
            name: paymentToEdit.supplierName || '',
            fatherName: paymentToEdit.supplierFatherName || '',
            address: paymentToEdit.supplierAddress || '',
            contact: ''
        });
        setBankDetails({
            acNo: paymentToEdit.bankAcNo || '',
            ifscCode: paymentToEdit.bankIfsc || '',
            bank: paymentToEdit.bankName || '',
            branch: paymentToEdit.bankBranch || '',
        });

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
        
        const originalSupplierStates = new Map<string, Customer>();

        try {
            await runTransaction(db, async (transaction) => {
                const paymentRef = doc(db, "payments", paymentIdToDelete);
                
                for (const detail of paymentToDelete.paidFor || []) {
                    const q = query(suppliersCollection, where('srNo', '==', detail.srNo));
                    const supplierDocsQuerySnapshot = await getDocs(q);
                    
                    if (!supplierDocsQuerySnapshot.empty) {
                        const supplierDoc = supplierDocsQuerySnapshot.docs[0];
                        originalSupplierStates.set(supplierDoc.id, supplierDoc.data() as Customer);
                        const currentNetAmount = Number(supplierDoc.data().netAmount);
                        const newNetAmount = currentNetAmount + detail.amount;
                        transaction.update(supplierDoc.ref, { netAmount: Math.round(newNetAmount) });
                    }
                }
                
                transaction.delete(paymentRef);
            });
            
            toast({ title: 'Payment Deleted', description: `Payment ${paymentToDelete.paymentId} has been removed and outstanding amounts updated.`, duration: 3000 });
            if (editingPayment?.id === paymentIdToDelete) {
                resetPaymentForm();
            }
        } catch (error) {
            console.error("Error in batch deletion:", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete payment or update supplier balances." });
        }
    };
    
  const generatePaymentCombinations = () => {
    if (targetAmountForGenerator <= 0 || minRate <= 0 || maxRate < minRate) {
        toast({
            variant: 'destructive',
            title: 'Invalid Input',
            description: 'Please provide a valid target amount and a valid rate range.',
        });
        return;
    }

    const combinations: PaymentCombination[] = [];

    for (let rate = minRate; rate <= maxRate; rate += 1) {
        if (rate === 0 || rate % 5 !== 0) continue;

        for (let i = -50; i <= 50; i += 0.1) {
            if (targetAmountForGenerator < rate * (targetAmountForGenerator/rate + i)) continue;

            const quantity = targetAmountForGenerator / rate + i;
            if (quantity <= 0) continue;

            const roundedQuantity = parseFloat(quantity.toFixed(1));
            if (Math.round(roundedQuantity * 10) % 1 !== 0) continue;
            
            const amount = Math.round(roundedQuantity * rate);
            const remainingAmount = targetAmountForGenerator - amount;

            if (isRoundFigureMode) {
                if (amount % 100 !== 0) continue;
            } else {
                if (remainingAmount < 0 || remainingAmount > 500) continue;
            }
            
            combinations.push({ quantity: roundedQuantity, rate, amount, remainingAmount });
        }
    }
    
    if (combinations.length === 0) {
        toast({ title: 'No Combinations Found', description: 'Try adjusting the rate range or target amount.' });
    }

    const sortedCombinations = combinations
        .sort((a, b) => Math.abs(a.remainingAmount) - Math.abs(b.remainingAmount))
        .slice(0, 20); 

    setPaymentCombinations(sortedCombinations);
    setIsGeneratorOpen(true);
  };
  

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleSelectCombination = (combination: PaymentCombination) => {
    setRtgsQuantity(combination.quantity);
    setRtgsRate(combination.rate);
    setRtgsAmount(combination.amount);
    toast({ title: 'Selection Applied', description: `Quantity ${combination.quantity} and Rate ${combination.rate} have been set.` });
    setIsGeneratorOpen(false);
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
  
  const handlePaySelectedOutstanding = () => {
    if (selectedEntryIds.size === 0) {
        toast({
            variant: "destructive",
            title: "No Entries Selected",
            description: "Please select one or more outstanding entries to pay.",
        });
        return;
    }
    setIsOutstandingModalOpen(false);
  };

  const handleBranchSelect = (branchValue: string) => {
    const selectedBranch = availableBranches.find(b => b.branchName === branchValue);
    if(selectedBranch) {
      setBankDetails(prev => ({...prev, branch: selectedBranch.branchName, ifscCode: selectedBranch.ifscCode}));
    }
  };

  const handleAddNewBank = async () => {
    if(!newBankName.trim()) {
        toast({variant: 'destructive', title: 'Error', description: 'Bank name cannot be empty.'});
        return;
    }
    try {
        await addBank(toTitleCase(newBankName));
        toast({title: 'Success', description: 'New bank added successfully.'});
        setNewBankName('');
    } catch(error) {
        console.error("Error adding new bank:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Failed to add new bank.'});
    }
  };

  const handleAddNewBranch = async () => {
    if(!newBranchData.bankName || !newBranchData.branchName || !newBranchData.ifscCode) {
        toast({variant: 'destructive', title: 'Error', description: 'Please fill all branch details.'});
        return;
    }
    try {
        await addBankBranch({
            bankName: newBranchData.bankName,
            branchName: toTitleCase(newBranchData.branchName),
            ifscCode: newBranchData.ifscCode.toUpperCase(),
        });
        toast({title: 'Success', description: 'New branch added successfully.'});
        setNewBranchData({ bankName: '', branchName: '', ifscCode: '' });
    } catch(error) {
        console.error("Error adding new branch:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Failed to add new branch.'});
    }
  };

  const customFilter = (value: string, search: string) => {
    const searchTerm = search.toLowerCase();
    const valueParts = value.toLowerCase().split(' - ');
    return valueParts.some(part => part.trim().startsWith(searchTerm)) || value.toLowerCase().startsWith(searchTerm) ? 1 : 0;
  };

  const handleActualPrint = () => {
    const receiptNode = document.getElementById('rtgs-receipt-content');
    if (!receiptNode) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        toast({variant: 'destructive', title: 'Error', description: 'Could not open print window. Please disable pop-up blockers.'});
        return;
    }
    
    printWindow.document.write('<html><head><title>Print RTGS Receipt</title>');
    // Copy all stylesheets from the main document to the iframe
    Array.from(document.styleSheets).forEach(styleSheet => {
        try {
            const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
            printWindow.document.write(`<style>${cssText}</style>`);
        } catch (e) {
            console.warn("Could not copy stylesheet:", e);
        }
    });

    printWindow.document.write('</head><body>');
    printWindow.document.write(receiptNode.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
  };


  if (!isClient) {
    return null;
  }
  
  if (isLoadingInitial) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-4 text-muted-foreground">Loading Supplier Data...</span>
          </div>
      );
  }
  
  return (
    <div className="space-y-3">
        <Card>
             <CardContent className="p-3 flex items-center gap-4">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold whitespace-nowrap">Select Supplier</h3>
                </div>
                <div className="w-full">
                    <Select onValueChange={handleCustomerSelect} value={selectedCustomerKey || ''}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Search and select supplier..."/>
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from(customerSummaryMap.entries()).map(([key, data]) => (
                            <SelectItem key={key} value={key} className="text-sm">
                                {toTitleCase(data.name)} ({data.contact})
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedCustomerKey && (
                     <div className="flex items-center gap-2 border-l pl-4 flex-shrink-0">
                        <div className="flex items-center gap-2">
                           <p className="text-muted-foreground text-xs font-medium whitespace-nowrap">Total Outstanding:</p>
                           <p className="text-sm font-bold text-destructive">{formatCurrency(customerSummaryMap.get(selectedCustomerKey)?.totalOutstanding || 0)}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsOutstandingModalOpen(true)} className="h-7 text-xs">
                            Change
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>

      {selectedCustomerKey && (
            <Dialog open={isOutstandingModalOpen} onOpenChange={setIsOutstandingModalOpen}>
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
                            <TableRow key={entry.id} onClick={() => handleEntrySelect(entry.id)} className="cursor-pointer">
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
                        <Button variant="outline" onClick={() => {
                            setIsOutstandingModalOpen(false);
                            handleFullReset();
                        }}>Cancel</Button>
                        <Button onClick={handlePaySelectedOutstanding}>Confirm Selection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
      )}


      {selectedCustomerKey && (
        <div onKeyDown={handleKeyDown}>
          <Card>
            <CardContent className="p-3">
              <Tabs value={paymentMethod} onValueChange={setPaymentMethod} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-9">
                  <TabsTrigger value="Cash">Cash</TabsTrigger>
                  <TabsTrigger value="Online">Online</TabsTrigger>
                  <TabsTrigger value="RTGS">RTGS</TabsTrigger>
                </TabsList>

                <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">Payment Type</Label>
                            <Select value={paymentType} onValueChange={setPaymentType}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Full">Full</SelectItem>
                                    <SelectItem value="Partial">Partial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {paymentType === 'Partial' && (
                             <div className="space-y-1">
                                <Label htmlFor="payment-amount" className="text-xs">Pay Amount</Label>
                                <Input id="payment-amount" type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)} readOnly={paymentType === 'Full'} className="h-8 text-xs" />
                            </div>
                        )}
                        <div className="flex items-center space-x-2 pt-5">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center space-x-2">
                                            <Switch id="cd-toggle" checked={cdEnabled} onCheckedChange={setCdEnabled} disabled={isCdSwitchDisabled} />
                                            <Label htmlFor="cd-toggle" className={cn("text-xs", isCdSwitchDisabled && 'text-muted-foreground')}>Apply CD</Label>
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
                            <div className="space-y-1">
                                <Label htmlFor="cd-percent" className="text-xs">CD %</Label>
                                <Input id="cd-percent" type="number" value={cdPercent} onChange={e => setCdPercent(parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">CD At</Label>
                                <Select value={cdAt} onValueChange={setCdAt} disabled={paymentType === 'Partial'}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {availableCdOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">CD Amount</Label>
                                <Input value={formatCurrency(calculatedCdAmount)} readOnly className="h-8 text-xs font-bold text-primary" />
                            </div>
                        </>}
                    </div>
                </div>

                <TabsContent value="RTGS" className="mt-2 border-t pt-2 space-y-2">
                     <Card className="p-2">
                         <CardHeader className="p-1 pb-1 flex-row items-center justify-between">
                           <CardTitle className="text-xs font-semibold">RTGS Generator</CardTitle>
                            <div className="flex items-center space-x-2">
                               <Switch id="round-figure-toggle" checked={isRoundFigureMode} onCheckedChange={setIsRoundFigureMode} />
                               <Label htmlFor="round-figure-toggle" className="text-xs">Round Figure</Label>
                           </div>
                        </CardHeader>
                        <CardContent className="p-1 pt-0 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                           <div className="space-y-1">
                              <Label htmlFor="minRate" className="text-xs">Min Rate</Label>
                              <Input id="minRate" type="number" value={minRate} onChange={e => setMinRate(Number(e.target.value))} className="h-8 text-xs"/>
                           </div>
                           <div className="space-y-1">
                              <Label htmlFor="maxRate" className="text-xs">Max Rate</Label>
                              <Input id="maxRate" type="number" value={maxRate} onChange={e => setMaxRate(Number(e.target.value))} className="h-8 text-xs"/>
                           </div>
                           <Button onClick={generatePaymentCombinations} size="sm" className="w-full md:w-auto h-8 text-xs">
                              <Calculator className="h-3 w-3 mr-1"/>
                              Generate for {formatCurrency(targetAmountForGenerator)}
                           </Button>
                        </CardContent>
                     </Card>
                     
                     <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
                        <DialogContent className="max-w-3xl">
                           <DialogHeader>
                              <DialogTitle>RTGS Payment Generator</DialogTitle>
                              <DialogDescription>
                                 Target: {formatCurrency(targetAmountForGenerator)} | 
                                 Rate Range: {formatCurrency(minRate)} - {formatCurrency(maxRate)}
                              </DialogDescription>
                           </DialogHeader>
                           <div className="mt-4 space-y-4">
                              <ScrollArea className="h-72">
                                 <Table>
                                    <TableHeader>
                                       <TableRow>
                                          <TableHead className="cursor-pointer" onClick={() => requestSort('quantity')}>Qty <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                                          <TableHead className="cursor-pointer" onClick={() => requestSort('rate')}>Rate <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                                          <TableHead className="cursor-pointer" onClick={() => requestSort('amount')}>Amount <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                                          <TableHead className="cursor-pointer" onClick={() => requestSort('remainingAmount')}>Remaining <ArrowUpDown className="inline h-3 w-3 ml-1"/></TableHead>
                                       </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                       {sortedCombinations.map((combo, index) => (
                                       <TableRow key={index} onClick={() => handleSelectCombination(combo)} className="cursor-pointer">
                                          <TableCell>{combo.quantity.toFixed(1)}</TableCell>
                                          <TableCell>{formatCurrency(combo.rate)}</TableCell>
                                          <TableCell>{formatCurrency(combo.amount)}</TableCell>
                                          <TableCell className="font-semibold text-red-500">{formatCurrency(combo.remainingAmount)}</TableCell>
                                       </TableRow>
                                       ))}
                                    </TableBody>
                                 </Table>
                              </ScrollArea>
                           </div>
                           <DialogFooter>
                              <Button variant="outline" onClick={() => setIsGeneratorOpen(false)}>Close</Button>
                           </DialogFooter>
                        </DialogContent>
                     </Dialog>
                    
                     <Card className="p-2">
                         <div className="flex justify-between items-center mb-1">
                           <p className="text-xs font-semibold">RTGS Payment & Document Details</p>
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsBankSettingsOpen(true)}>
                              <Settings className="h-4 w-4"/>
                           </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2">
                           <div className="p-2 border rounded-lg space-y-2">
                                <p className="text-xs font-semibold text-center">Bank Details</p>
                                <div className="space-y-1">
                                    <Label className="text-xs">Bank</Label>
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-xs">
                                             {bankDetails.bank || "Select bank"}
                                             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                          <Command filter={customFilter}>
                                             <CommandInput placeholder="Search bank..." />
                                             <CommandEmpty>No bank found.</CommandEmpty>
                                             <CommandList>
                                                {combinedBanks.map((bank) => (
                                                <CommandItem
                                                   key={bank}
                                                   value={bank}
                                                   onSelect={(currentValue) => {
                                                      setBankDetails(prev => ({...prev, bank: currentValue === prev.bank ? "" : currentValue, branch: '', ifscCode: ''}));
                                                   }}
                                                   >
                                                   <Check className={cn("mr-2 h-4 w-4", bankDetails.bank === bank ? "opacity-100" : "opacity-0")} />
                                                   {bank}
                                                </CommandItem>
                                                ))}
                                             </CommandList>
                                          </Command>
                                       </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Branch</Label>
                                    <Popover>
                                       <PopoverTrigger asChild disabled={!bankDetails.bank}>
                                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-8 text-xs">
                                             {bankDetails.branch || "Select branch"}
                                             <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                          </Button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                          <Command filter={customFilter}>
                                             <CommandInput placeholder="Search branch..." />
                                             <CommandEmpty>No branch found.</CommandEmpty>
                                             <CommandList>
                                                {availableBranches.map((branch) => (
                                                <CommandItem
                                                   key={branch.id || branch.ifscCode + branch.branchName}
                                                   value={branch.branchName}
                                                   onSelect={(currentValue) => handleBranchSelect(currentValue)}
                                                   >
                                                   <Check className={cn("mr-2 h-4 w-4", bankDetails.branch === branch.branchName ? "opacity-100" : "opacity-0")} />
                                                   {branch.branchName}
                                                </CommandItem>
                                                ))}
                                             </CommandList>
                                          </Command>
                                       </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1"><Label className="text-xs">A/C No.</Label><Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs"/></div>
                                <div className="space-y-1"><Label className="text-xs">IFSC</Label><Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value})} className="h-8 text-xs"/></div>
                           </div>
                           <div className="p-2 border rounded-lg space-y-2">
                                <p className="text-xs font-semibold text-center">Document Details</p>
                                <div className="space-y-1"><Label className="text-xs">Quantity</Label><Input type="number" value={rtgsQuantity} onChange={e => setRtgsQuantity(Number(e.target.value))} className="h-8 text-xs"/></div>
                                <div className="space-y-1"><Label className="text-xs">Rate</Label><Input type="number" value={rtgsRate} onChange={e => setRtgsRate(Number(e.target.value))} className="h-8 text-xs"/></div>
                                <div className="space-y-1"><Label className="text-xs">UTR No.</Label><Input value={utrNo} onChange={e => setUtrNo(e.target.value)} className="h-8 text-xs"/></div>
                                <div className="space-y-1"><Label className="text-xs">Check No.</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} className="h-8 text-xs"/></div>
                           </div>
                        </div>
                    </Card>
                  </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="p-3 pt-0">
                <Card className="bg-muted/30 w-full p-2">
                     <CardContent className="p-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Amount:</span>
                            <span className="text-sm font-semibold">{formatCurrency(rtgsAmount || paymentAmount)}</span>
                        </div>
                        {cdEnabled && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">CD:</span>
                                <span className="text-sm font-semibold">{formatCurrency(calculatedCdAmount)}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                             <Separator orientation="vertical" className="h-5" />
                             <span className="text-sm font-semibold">Total:</span>
                             <span className="text-base font-bold text-primary">{formatCurrency((rtgsAmount || paymentAmount) + calculatedCdAmount)}</span>
                        </div>
                        <div className="flex-grow"></div>
                        <Button onClick={processPayment} size="sm" className="h-8 text-xs">{editingPayment ? 'Update Payment' : 'Finalize Payment'}</Button>
                    </CardContent>
                </Card>
            </CardFooter>
          </Card>
        </div>
      )}

      {selectedCustomerKey && <Card>
        <CardHeader className="p-4 pb-2"><CardTitle className="text-base">Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="p-2 text-xs">ID</TableHead>
                            <TableHead className="p-2 text-xs">Date</TableHead>
                            <TableHead className="p-2 text-xs">Method</TableHead>
                            <TableHead className="p-2 text-xs">Ref (SR#)</TableHead>
                            <TableHead className="p-2 text-xs">UTR No.</TableHead>
                            <TableHead className="p-2 text-xs">Check No.</TableHead>
                            <TableHead className="text-right p-2 text-xs">Amount</TableHead>
                            <TableHead className="text-right p-2 text-xs">CD</TableHead>
                            <TableHead className="text-right p-2 text-xs">Total</TableHead>
                            <TableHead className="text-center p-2 text-xs">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentPaymentHistory.map(p => (
                            <TableRow key={p.id}>
                                <TableCell className="font-mono text-xs p-2">{p.paymentId}</TableCell>
                                <TableCell className="p-2 text-xs">{format(new Date(p.date), "dd-MMM-yy")}</TableCell>
                                <TableCell className="p-2 text-xs"><Badge variant={p.receiptType === 'RTGS' ? 'default' : 'secondary'}>{p.receiptType}</Badge></TableCell>
                                <TableCell className="text-xs max-w-[100px] truncate p-2" title={(p.paidFor || []).map(pf => pf.srNo).join(', ')}>
                                    {(p.paidFor || []).map(pf => pf.srNo).join(', ')}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-blue-400 p-2">{p.utrNo}</TableCell>
                                <TableCell className="font-mono text-xs text-purple-400 p-2">{p.checkNo}</TableCell>
                                <TableCell className="text-right p-2 text-xs">{formatCurrency(p.amount)}</TableCell>
                                <TableCell className="text-right p-2 text-xs">{formatCurrency(p.cdAmount)}</TableCell>
                                <TableCell className="text-right font-semibold p-2 text-xs">{formatCurrency(p.amount + p.cdAmount)}</TableCell>
                                <TableCell className="text-center p-0">
                                    <div className="flex justify-center items-center gap-0">
                                         {p.receiptType === 'RTGS' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRtgsReceiptData(p)}>
                                                <Printer className="h-4 w-4" />
                                            </Button>
                                        )}
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
                                                <AlertDialogAction onClick={() => p.id && handleDeletePayment(p.id)}>Continue</AlertDialogAction>
                                            </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {currentPaymentHistory.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center text-muted-foreground h-24">No payment history for this supplier.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>}

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
              <div className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
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
                            <CardHeader className="p-4"><CardTitle className="text-base">Transaction & Weight</CardTitle></CardHeader>
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
                                    <TableRow><TableCell className="text-muted-foreground p-1 flex items-center gap-2"><Scale size={14} />Net Weight</TableCell><TableCell className="text-right font-semibold p-1">{detailsSupplierEntry.netWeight.toFixed(2)} kg</TableCell></TableRow>
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
                            <CardTitle className="text-base flex items-center gap-2"><Banknote size={16} />Payment History</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {paymentsForDetailsEntry.length > 0 ? (
                                <Table className="text-sm">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="p-2 text-xs">Payment ID</TableHead>
                                            <TableHead className="p-2 text-xs">Date</TableHead>
                                            <TableHead className="p-2 text-xs">Type</TableHead>
                                            <TableHead className="p-2 text-xs">CD Applied</TableHead>
                                            <TableHead className="p-2 text-xs text-right">CD Amount</TableHead>
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
                                                    <TableCell className="p-2">{payment.type}</TableCell>
                                                    <TableCell className="p-2">{payment.cdApplied ? 'Yes' : 'No'}</TableCell>
                                                    <TableCell className="p-2 text-right">{formatCurrency(payment.cdAmount || 0)}</TableCell>
                                                    <TableCell className="p-2 text-right font-semibold">{formatCurrency(paidForThis?.amount || 0)}</TableCell>
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
            </>
          )}
        </DialogContent>
      </Dialog>
       <Dialog open={!!rtgsReceiptData} onOpenChange={(open) => !open && setRtgsReceiptData(null)}>
        <DialogContent className="max-w-4xl p-0">
            {rtgsReceiptData && <RtgsReceipt payment={rtgsReceiptData} onPrint={handleActualPrint}/>}
        </DialogContent>
      </Dialog>

      <Dialog open={isBankSettingsOpen} onOpenChange={setIsBankSettingsOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Bank Management</DialogTitle>
                <DialogDescription>Add new banks and branches to the system.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle className="text-base">Add New Bank</CardTitle></CardHeader>
                    <CardContent className="flex gap-2">
                        <Input placeholder="Enter new bank name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
                        <Button onClick={handleAddNewBank}><Plus className="mr-2 h-4 w-4" /> Add Bank</Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Add New Branch</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label>Select Bank</Label>
                            <Select value={newBranchData.bankName} onValueChange={(value) => setNewBranchData(prev => ({...prev, bankName: value}))}>
                                <SelectTrigger><SelectValue placeholder="Select a bank" /></SelectTrigger>
                                <SelectContent>
                                    {combinedBanks.map(bank => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Branch Name</Label>
                            <Input placeholder="Enter branch name" value={newBranchData.branchName} onChange={(e) => setNewBranchData(prev => ({...prev, branchName: e.target.value}))}/>
                        </div>
                        <div className="space-y-1">
                            <Label>IFSC Code</Label>
                            <Input placeholder="Enter IFSC code" value={newBranchData.ifscCode} onChange={(e) => setNewBranchData(prev => ({...prev, ifscCode: e.target.value}))}/>
                        </div>
                        <Button onClick={handleAddNewBranch}><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
                    </CardContent>
                </Card>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsBankSettingsOpen(false)}>Done</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



"use client";

import { useState, useEffect } from "react";
import type { Customer, ReceiptSettings, DocumentType, BankAccount, Expense } from "@/lib/definitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SegmentedSwitch } from "@/components/ui/segmented-switch";
import { Printer, ChevronsUpDown, Trash2, Plus } from "lucide-react";
import { TaxInvoice } from "@/components/print-formats/tax-invoice";
import { BillOfSupply } from "@/components/print-formats/bill-of-supply";
import { Challan } from "@/components/print-formats/challan";
import { cn, calculateCustomerEntry } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getBankAccountsRealtime } from "@/lib/firestore";
import { CustomDropdown } from "../ui/custom-dropdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SmartDatePicker } from "../ui/smart-date-picker";
import { statesAndCodes, findStateByCode, findStateByName } from "@/lib/data";
import { runTransaction, doc, collection, getDoc, Timestamp } from 'firebase/firestore';
import { firestoreDB } from '@/lib/firebase';
import { getTenantCollectionPath, getTenantDocPath } from '@/lib/tenancy';
import { db } from '@/lib/database';
import { logError } from "@/lib/error-logger";
import { printHtmlContent } from "@/lib/electron-print";

// Helper function to handle errors silently (for non-critical operations)
function handleSilentError(error: unknown, context: string): void {
  logError(error, `[Document Preview] ${context}`, 'low');
}

interface DocumentPreviewDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    customer: Customer | null;
    documentType: DocumentType;
    setDocumentType: (type: DocumentType) => void;
    receiptSettings: ReceiptSettings | null;
}

export const DocumentPreviewDialog = ({ isOpen, setIsOpen, customer, documentType, setDocumentType, receiptSettings }: DocumentPreviewDialogProps) => {
    const { toast } = useToast();
    const [editableInvoiceDetails, setEditableInvoiceDetails] = useState<Partial<Customer>>({});
    const [isSameAsBilling, setIsSameAsBilling] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [showBagWeightColumns, setShowBagWeightColumns] = useState(true);
    
    const [invoiceDetails, setInvoiceDetails] = useState({
        companyGstin: '',
        companyStateName: '',
        companyStateCode: '',
        hsnCode: '1006',
        taxRate: 5,
        isGstIncluded: false,
        nineRNo: '',
        gatePassNo: '',
        grNo: '',
        grDate: '',
        lrNo: '',
        lrDate: '',
        transport: '',
        vehicleNo: '',
        advanceFreight: 0,
        advancePaymentMethod: 'CashInHand',
    });
    
     useEffect(() => {
        if (!isOpen || !customer) return;

        const initialize = async () => {
            // 1. Verify expense ID exists before setting state
            let verifiedExpenseId = customer.advanceExpenseId;
            if (customer.advanceExpenseId) {
                try {
                    const expenseRef = doc(firestoreDB, ...getTenantDocPath("expenses", customer.advanceExpenseId));
                    const expenseSnap = await getDoc(expenseRef);
                    if (!expenseSnap.exists()) {
                        verifiedExpenseId = undefined;
                    }
                } catch (error) {
                    console.error("Error verifying expense:", error);
                    verifiedExpenseId = undefined;
                }
            }

            // 2. Set editable details with verified ID
            setEditableInvoiceDetails({ ...customer, advanceExpenseId: verifiedExpenseId });

            // 3. Update non-editable view state
            setInvoiceDetails(prev => ({
                ...prev,
                advanceFreight: verifiedExpenseId ? customer.advanceFreight || 0 : 0,
                advancePaymentMethod: verifiedExpenseId ? customer.advancePaymentMethod || 'CashInHand' : 'CashInHand',
                nineRNo: customer.nineRNo || '',
                gatePassNo: customer.gatePassNo || '',
                grNo: customer.grNo || '',
                grDate: customer.grDate || '',
                lrNo: customer.lrNo || '',
                lrDate: customer.lrDate || '',
                transport: customer.transport || '',
                vehicleNo: customer.vehicleNo || '',
                companyGstin: receiptSettings?.companyGstin || prev.companyGstin,
                companyStateName: receiptSettings?.companyStateName || prev.companyStateName,
                companyStateCode: receiptSettings?.companyStateCode || prev.companyStateCode,
            }));

            // 4. Determine if shipping matches billing
            setIsSameAsBilling(
                (!customer.shippingName || customer.shippingName === customer.name) &&
                (!customer.shippingAddress || customer.shippingAddress === customer.address) &&
                (!customer.shippingContact || customer.shippingContact === customer.contact) &&
                (!customer.shippingGstin || customer.shippingGstin === customer.gstin)
            );
        };

        initialize();
        const unsub = getBankAccountsRealtime(setBankAccounts, () => {});
        return () => unsub();

    }, [customer, receiptSettings, isOpen]);
    

    const handleEditableDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableInvoiceDetails(prev => ({...prev, [name]: value}));
    };
    
    const handleStateChange = (type: 'billing' | 'shipping', field: 'name' | 'code', value: string | null) => {
        if (!value) {
            // Clear both fields if value is null/empty
            if (type === 'billing') {
                setEditableInvoiceDetails(prev => ({ ...prev, stateName: '', stateCode: '' }));
            } else {
                setEditableInvoiceDetails(prev => ({ ...prev, shippingStateName: '', shippingStateCode: '' }));
            }
            return;
        }

        if (type === 'billing') {
            if (field === 'name') {
                const state = findStateByName(value);
                setEditableInvoiceDetails(prev => ({ ...prev, stateName: value, stateCode: state?.code || '' }));
            } else {
                const state = findStateByCode(value);
                setEditableInvoiceDetails(prev => ({ ...prev, stateCode: value, stateName: state?.name || '' }));
            }
        } else { // shipping
             if (field === 'name') {
                const state = findStateByName(value);
                setEditableInvoiceDetails(prev => ({ ...prev, shippingStateName: value, shippingStateCode: state?.code || '' }));
            } else {
                const state = findStateByCode(value);
                setEditableInvoiceDetails(prev => ({ ...prev, shippingStateCode: value, shippingStateName: state?.name || '' }));
            }
        }
    };


    const handleActualPrint = async (id: string) => {
        if (!customer) return;

        try {
            await runTransaction(firestoreDB, async (transaction) => {
                const customerRef = doc(firestoreDB, ...getTenantDocPath("customers", customer.id));
                
                const newAdvanceAmount = invoiceDetails.advanceFreight;
                let currentExpenseId = editableInvoiceDetails.advanceExpenseId;

                // --- Expense Management ---
                const expenseData: Partial<Expense> = {
                    date: new Date().toISOString(),
                    transactionType: 'Expense',
                    category: 'Logistics',
                    subCategory: 'Advance Freight',
                    amount: newAdvanceAmount,
                    payee: `Driver - ${customer.vehicleNo || 'N/A'}`,
                    description: `Advance for SR #${customer.srNo}`,
                    paymentMethod: invoiceDetails.advancePaymentMethod === 'CashInHand' ? 'Cash' : 'Online',
                    status: 'Paid',
                    isRecurring: false,
                };
                
                if (invoiceDetails.advancePaymentMethod !== 'CashInHand') {
                    expenseData.bankAccountId = invoiceDetails.advancePaymentMethod;
                }

                 if (newAdvanceAmount > 0) {
                    if (currentExpenseId) {
                        const expenseRef = doc(firestoreDB, ...getTenantDocPath("expenses", currentExpenseId));
                        transaction.set(expenseRef, expenseData, { merge: true });
                    } else {
                        const newExpenseRef = doc(collection(firestoreDB, ...getTenantCollectionPath("expenses")));
                        transaction.set(newExpenseRef, { ...expenseData, id: newExpenseRef.id });
                        currentExpenseId = newExpenseRef.id;
                    }
                } else if (newAdvanceAmount === 0 && currentExpenseId) {
                    const expenseRef = doc(firestoreDB, ...getTenantDocPath("expenses", currentExpenseId));
                    transaction.delete(expenseRef);
                    currentExpenseId = undefined; 
                }

                // --- Customer Document Update ---
                const formValuesForCalc: Partial<Customer> = {
                    ...customer,
                    ...editableInvoiceDetails,
                    advanceFreight: newAdvanceAmount,
                };
                
                // Calculate basic fields without payment history (payments are handled separately)
                const calculated = calculateCustomerEntry(formValuesForCalc, []);
                
                const dataToSave: Partial<Customer> = { 
                    ...customer,
                    // Explicitly set all editable fields to ensure they're saved
                    name: editableInvoiceDetails.name || customer.name,
                    companyName: editableInvoiceDetails.companyName || customer.companyName,
                    address: editableInvoiceDetails.address || customer.address,
                    contact: editableInvoiceDetails.contact || customer.contact,
                    gstin: editableInvoiceDetails.gstin || customer.gstin,
                    stateName: editableInvoiceDetails.stateName || customer.stateName,
                    stateCode: editableInvoiceDetails.stateCode || customer.stateCode,
                    shippingName: editableInvoiceDetails.shippingName,
                    shippingCompanyName: editableInvoiceDetails.shippingCompanyName,
                    shippingAddress: editableInvoiceDetails.shippingAddress,
                    shippingContact: editableInvoiceDetails.shippingContact,
                    shippingGstin: editableInvoiceDetails.shippingGstin,
                    shippingStateName: editableInvoiceDetails.shippingStateName,
                    shippingStateCode: editableInvoiceDetails.shippingStateCode,
                    // Update calculated fields (weight, amount, brokerage, cd, bagAmount, originalNetAmount)
                    weight: calculated.weight,
                    netWeight: calculated.netWeight,
                    amount: calculated.amount,
                    brokerage: calculated.brokerage,
                    cd: calculated.cd,
                    bagAmount: calculated.bagAmount,
                    originalNetAmount: calculated.originalNetAmount,
                    // Preserve existing netAmount - don't recalculate it as payments are handled separately
                    netAmount: customer.netAmount,
                    advanceExpenseId: currentExpenseId,
                    advancePaymentMethod: invoiceDetails.advancePaymentMethod,
                    advanceFreight: newAdvanceAmount,
                    nineRNo: invoiceDetails.nineRNo,
                    gatePassNo: invoiceDetails.gatePassNo,
                    grNo: invoiceDetails.grNo,
                    grDate: invoiceDetails.grDate,
                    lrNo: invoiceDetails.lrNo || '',
                    lrDate: invoiceDetails.lrDate || '',
                    transport: invoiceDetails.transport,
                    vehicleNo: invoiceDetails.vehicleNo || '',
                 };

                if (isSameAsBilling) {
                    dataToSave.shippingName = dataToSave.name;
                    dataToSave.shippingCompanyName = dataToSave.companyName;
                    dataToSave.shippingAddress = dataToSave.address;
                    dataToSave.shippingContact = dataToSave.contact;
                    dataToSave.shippingGstin = dataToSave.gstin;
                    dataToSave.shippingStateName = dataToSave.stateName;
                    dataToSave.shippingStateCode = dataToSave.stateCode;
                }
                
                // Firestore does not allow 'undefined' values.
                const cleanData = Object.fromEntries(
                    Object.entries(dataToSave).filter(([_, v]) => v !== undefined)
                );

                // Add updatedAt timestamp for sync detection
                const dataWithTimestamp = {
                    ...cleanData,
                    updatedAt: Timestamp.now(),
                };

                transaction.set(customerRef, dataWithTimestamp, { merge: true });
            });

            // Update local database for immediate sync
            if (db && customer) {
                try {
                    const recalculated = calculateCustomerEntry({ ...customer, ...editableInvoiceDetails, advanceFreight: invoiceDetails.advanceFreight }, []);
                    const customerToUpdate: Customer = {
                        ...customer,
                        ...editableInvoiceDetails,
                        ...recalculated,
                        lrNo: invoiceDetails.lrNo,
                        lrDate: invoiceDetails.lrDate,
                        transport: invoiceDetails.transport,
                        vehicleNo: invoiceDetails.vehicleNo,
                        id: customer.id,
                        updatedAt: new Date().toISOString(),
                    } as Customer;
                    await db.customers.put(customerToUpdate);
                } catch (error) {
                    handleSilentError(error, 'saveAndPrint - customer update');
                }
            }

             // ----- PRINTING LOGIC (Using Native Electron IPC for Preview) -----
            const receiptNode = document.getElementById(id);
            if (!receiptNode) return;

            // Send ONLY the raw invoice HTML - main process adds clean print CSS
            // Do NOT send the app CSS (it has dark Tailwind theme that causes blank PDF)
            const fullContent = receiptNode.outerHTML;
            
            // Use standard helper which handles Electron detection and IPC
            try {
                await printHtmlContent(fullContent);
                toast({ title: "Saved & Printed", description: "Customer details have been updated in database.", variant: "success" });
            } catch (error: any) {
                if (!/cancel/i.test(error.message)) {
                    toast({ title: "Print Error", description: error.message, variant: "destructive" });
                }
            }

        } catch (error) {
            console.error('Error saving document:', error);
            toast({ title: "Save Failed", description: "The changes could not be saved due to an error.", variant: "destructive" });
        }
    };
    
    const stateNameOptions = statesAndCodes.map(s => ({ value: s.name, label: s.name }));
    const stateCodeOptions = statesAndCodes.map(s => ({ value: s.code, label: s.code }));


    const renderDocument = () => {
        if (!customer || !receiptSettings) return null;
        
        const calculatedCustomerData = calculateCustomerEntry({ ...customer, ...editableInvoiceDetails, advanceFreight: invoiceDetails.advanceFreight }, []);
        const finalCustomerData: Customer = {
            ...customer,
            ...editableInvoiceDetails,
            ...calculatedCustomerData
        };

        if (isSameAsBilling) {
            finalCustomerData.shippingName = finalCustomerData.name;
            finalCustomerData.shippingCompanyName = finalCustomerData.companyName;
            finalCustomerData.shippingAddress = finalCustomerData.address;
            finalCustomerData.shippingContact = finalCustomerData.contact;
            finalCustomerData.shippingGstin = finalCustomerData.gstin;
            finalCustomerData.shippingStateName = finalCustomerData.stateName;
            finalCustomerData.shippingStateCode = finalCustomerData.stateCode;
        }
        
        const finalInvoiceDetails = {
            ...invoiceDetails,
            totalAdvance: invoiceDetails.advanceFreight || 0,
            showBagWeightColumns,
        };

        switch(documentType) {
            case 'tax-invoice':
                return <TaxInvoice customer={finalCustomerData} settings={receiptSettings} invoiceDetails={finalInvoiceDetails} />;
            case 'bill-of-supply':
                return <BillOfSupply customer={finalCustomerData} settings={receiptSettings} invoiceDetails={finalInvoiceDetails} />;
            case 'challan':
                return <Challan customer={finalCustomerData} settings={receiptSettings} invoiceDetails={finalInvoiceDetails} />;
            default:
                return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-7xl w-[95vw] grid grid-cols-1 lg:grid-cols-3 gap-0 p-0 bg-background overflow-hidden" style={{ maxHeight: '95vh' }}>
                <div className="lg:col-span-2 order-2 lg:order-1 h-[90vh] bg-white overflow-auto border-r border-border" style={{ backgroundColor: '#ffffff' }}>
                    <ScrollArea className="h-full w-full">
                        <div id="document-content" className="p-4 sm:p-6 bg-white min-h-full" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                            <style>{`
                                #document-content p,
                                #document-content span,
                                #document-content div,
                                #document-content td,
                                #document-content th:not(.table-header-cell),
                                #document-content h1,
                                #document-content h2,
                                #document-content h3,
                                #document-content h4,
                                #document-content li {
                                    color: #000000 !important;
                                }
                                #document-content .table-header,
                                #document-content .table-header *,
                                #document-content .table-header th,
                                #document-content .table-header-cell,
                                #document-content thead,
                                #document-content thead *,
                                #document-content thead th {
                                    color: #000000 !important;
                                    font-weight: 700 !important;
                                }
                                #document-content .bg-gray-800,
                                #document-content .bg-gray-800 *,
                                #document-content .bg-gray-800 span,
                                #document-content .print-bg-gray-800,
                                #document-content .print-bg-gray-800 *,
                                #document-content .print-bg-gray-800 span,
                                #document-content .balance-due-section,
                                #document-content .balance-due-section *,
                                #document-content .balance-due-section span,
                                #document-content .balance-due-text,
                                #document-content span.balance-due-text,
                                #document-content .print-bg-black,
                                #document-content .print-bg-black *,
                                #document-content .print-bg-black span {
                                    color: #ffffff !important;
                                }
                            `}</style>
                           {renderDocument()}
                        </div>
                    </ScrollArea>
                </div>
                <div className="lg:col-span-1 order-1 lg:order-2 bg-card border-l border-border p-4 sm:p-6 flex flex-col h-[90vh]">
                     <DialogHeader className="mb-4 flex-shrink-0">
                         <div className="flex items-center justify-between">
                             <DialogTitle>Edit Invoice Details</DialogTitle>
                             <div className="w-[160px] ml-2">
                                 <CustomDropdown
                                     options={[
                                         { value: 'tax-invoice', label: 'Tax Invoice' },
                                         { value: 'bill-of-supply', label: 'Bill of Supply' },
                                         { value: 'challan', label: 'Challan' },
                                     ]}
                                     value={documentType}
                                     onChange={(value) => value && setDocumentType(value as DocumentType)}
                                     placeholder="Select Type"
                                     showArrow={true}
                                     showClearButton={false}
                                     showSearch={false}
                                     maxRows={3}
                                     inputClassName="h-7 text-[10px] font-bold bg-white text-black border-purple-200"
                                 />
                             </div>
                         </div>
                         <DialogDescription>Make on-the-fly changes before printing.</DialogDescription>
                     </DialogHeader>
                    <ScrollArea className="flex-grow pr-3 -mr-3">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
                                <h3 className="text-base font-semibold">Tax & Invoice Info</h3>
                                    <div className="space-y-1"><Label htmlFor="hsnCode" className="text-xs">HSN/SAC Code</Label><Input id="hsnCode" name="hsnCode" value={invoiceDetails.hsnCode} onChange={(e) => setInvoiceDetails({...invoiceDetails, hsnCode: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label htmlFor="taxRate" className="text-xs">Tax Rate (%)</Label><Input id="taxRate" name="taxRate" type="number" value={invoiceDetails.taxRate} onChange={(e) => setInvoiceDetails({...invoiceDetails, taxRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                    <div className="flex items-center justify-center pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setInvoiceDetails({...invoiceDetails, isGstIncluded: !invoiceDetails.isGstIncluded})}
                                            className={cn(
                                                "relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                invoiceDetails.isGstIncluded ? 'bg-primary/20' : 'bg-secondary/20'
                                            )}
                                        >
                                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", invoiceDetails.isGstIncluded ? 'text-primary' : 'text-muted-foreground')}>Included</span>
                                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !invoiceDetails.isGstIncluded ? 'text-primary' : 'text-muted-foreground')}>Excluded</span>
                                            <div
                                                className={cn(
                                                    "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                                                    invoiceDetails.isGstIncluded ? 'translate-x-[calc(100%-28px)]' : 'translate-x-[-4px]'
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300",
                                                    invoiceDetails.isGstIncluded ? 'bg-primary' : 'bg-secondary'
                                                )}>
                                                    <span className="text-sm font-bold text-primary-foreground">GST</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-card p-3 grid grid-cols-2 gap-3">
                                <h3 className="text-base font-semibold col-span-2">Additional Details</h3>
                                    <div className="space-y-1"><Label htmlFor="nineRNo" className="text-xs">9R No.</Label><Input id="nineRNo" name="nineRNo" value={invoiceDetails.nineRNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, nineRNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label htmlFor="gatePassNo" className="text-xs">Gate Pass No.</Label><Input id="gatePassNo" name="gatePassNo" value={invoiceDetails.gatePassNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, gatePassNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label htmlFor="grNo" className="text-xs">G.R. No.</Label><Input id="grNo" name="grNo" value={invoiceDetails.grNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, grNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1">
                                        <Label htmlFor="grDate" className="text-xs">G.R. Date</Label>
                                        <SmartDatePicker
                                            id="grDate"
                                            value={invoiceDetails.grDate || ""}
                                            onChange={(next) => setInvoiceDetails({...invoiceDetails, grDate: typeof next === 'string' ? next : format(next, 'yyyy-MM-dd') })}
                                            inputClassName="h-8 text-xs"
                                            buttonClassName="h-8 w-8"
                                        />
                                    </div>
                                     <div className="space-y-1 col-span-2"><Label className="text-xs">Transport Name</Label><Input value={invoiceDetails.transport} onChange={(e) => setInvoiceDetails({...invoiceDetails, transport: e.target.value})} className="h-8 text-xs" /></div>
                                     <div className="space-y-1"><Label className="text-xs">Vehicle No.</Label><Input value={invoiceDetails.vehicleNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, vehicleNo: e.target.value})} className="h-8 text-xs" /></div>
                                     <div className="space-y-1"><Label className="text-xs">LR/LLR No.</Label><Input value={invoiceDetails.lrNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, lrNo: e.target.value})} className="h-8 text-xs" /></div>
                                     <div className="space-y-1">
                                         <Label className="text-xs">LR/LLR Date</Label>
                                         <SmartDatePicker
                                             id="lrDate"
                                             value={invoiceDetails.lrDate || ""}
                                             onChange={(next) => setInvoiceDetails({...invoiceDetails, lrDate: typeof next === 'string' ? next : format(next, 'yyyy-MM-dd') })}
                                             inputClassName="h-8 text-xs"
                                             buttonClassName="h-8 w-8"
                                         />
                                     </div>
                                    <div className="space-y-1"><Label className="text-xs">Advance/Freight</Label><Input type="number" value={invoiceDetails.advanceFreight} onChange={(e) => setInvoiceDetails({...invoiceDetails, advanceFreight: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Advance Paid Via</Label>
                                        <Select
                                            value={invoiceDetails.advancePaymentMethod}
                                            onValueChange={(v) => setInvoiceDetails(prev => ({ ...prev, advancePaymentMethod: v }))}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CashInHand">Cash In Hand</SelectItem>
                                                {bankAccounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.accountHolderName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 flex items-center space-x-2 pt-2">
                                        <SegmentedSwitch 
                                            id="show-bag-weight" 
                                            checked={showBagWeightColumns} 
                                            onCheckedChange={setShowBagWeightColumns}
                                            leftLabel="Off"
                                            rightLabel="On"
                                            className="w-32"
                                        />
                                        <Label htmlFor="show-bag-weight" className="text-xs">Show Bag Wt & Final Wt Columns</Label>
                                    </div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
                                <h3 className="text-base font-semibold">Bill To Details</h3>
                                    <div className="space-y-1"><Label className="text-xs">Customer Name</Label><Input name="name" value={editableInvoiceDetails.name || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Company Name</Label><Input name="companyName" value={editableInvoiceDetails.companyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Contact</Label><Input name="contact" value={editableInvoiceDetails.contact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Address</Label><Input name="address" value={editableInvoiceDetails.address || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">GSTIN</Label><Input name="gstin" value={editableInvoiceDetails.gstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">State Name</Label>
                                            <CustomDropdown options={stateNameOptions} value={editableInvoiceDetails.stateName || null} onChange={(value) => handleStateChange('billing', 'name', value)} placeholder="State"/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">State Code</Label>
                                            <CustomDropdown options={stateCodeOptions} value={editableInvoiceDetails.stateCode || null} onChange={(value) => handleStateChange('billing', 'code', value)} placeholder="Code"/>
                                        </div>
                                    </div>
                            </div>
                            <div className="rounded-lg border border-border/50 bg-card p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold">Ship To Details</h3>
                                    <div className="flex items-center space-x-2"><SegmentedSwitch id="same-as-billing" checked={isSameAsBilling} onCheckedChange={setIsSameAsBilling} leftLabel="Off" rightLabel="On" className="w-32" /><Label htmlFor="same-as-billing" className="text-xs">Same as Bill To</Label></div>
                                </div>
                                {!isSameAsBilling && (
                                    <div className="space-y-3">
                                        <div className="space-y-1"><Label className="text-xs">Name</Label><Input name="shippingName" value={editableInvoiceDetails.shippingName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Company Name</Label><Input name="shippingCompanyName" value={editableInvoiceDetails.shippingCompanyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Contact</Label><Input name="shippingContact" value={editableInvoiceDetails.shippingContact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Address</Label><Input name="shippingAddress" value={editableInvoiceDetails.shippingAddress || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">GSTIN</Label><Input name="shippingGstin" value={editableInvoiceDetails.shippingGstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                             <div className="space-y-1">
                                                <Label className="text-xs">State Name</Label>
                                                <CustomDropdown options={stateNameOptions} value={editableInvoiceDetails.shippingStateName || null} onChange={(value) => handleStateChange('shipping', 'name', value)} placeholder="State"/>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">State Code</Label>
                                                <CustomDropdown options={stateCodeOptions} value={editableInvoiceDetails.shippingStateCode || null} onChange={(value) => handleStateChange('shipping', 'code', value)} placeholder="Code"/>
                                            </div>
                                            </div>
                                    </div>
                                    )}
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 flex-row justify-end gap-2 flex-shrink-0">
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                        <Button onClick={() => handleActualPrint('document-content')}><Printer className="mr-2 h-4 w-4" /> Save & Print</Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

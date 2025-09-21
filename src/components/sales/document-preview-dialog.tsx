

"use client";

import { useState, useEffect } from "react";
import type { Customer, ReceiptSettings, DocumentType, BankAccount, Transaction, Expense } from "@/lib/definitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Printer, ChevronsUpDown, Trash2, Plus } from "lucide-react";
import { TaxInvoice } from "@/components/print-formats/tax-invoice";
import { BillOfSupply } from "@/components/print-formats/bill-of-supply";
import { Challan } from "@/components/print-formats/challan";
import { cn, calculateCustomerEntry } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getBankAccountsRealtime, addExpense, updateCustomer, updateExpense, deleteExpense } from "@/lib/firestore";
import { CustomDropdown } from "../ui/custom-dropdown";
import { formatCurrency } from "@/lib/utils";
import { statesAndCodes, findStateByCode, findStateByName } from "@/lib/data";


interface DocumentPreviewDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    customer: Customer | null;
    documentType: DocumentType;
    setDocumentType: (type: DocumentType) => void;
    receiptSettings: ReceiptSettings | null;
}

interface AdvancePayment {
    id: number;
    amount: number;
    accountId: string;
}

export const DocumentPreviewDialog = ({ isOpen, setIsOpen, customer, documentType, setDocumentType, receiptSettings }: DocumentPreviewDialogProps) => {
    const { toast } = useToast();
    const [editableInvoiceDetails, setEditableInvoiceDetails] = useState<Partial<Customer>>({});
    const [isSameAsBilling, setIsSameAsBilling] = useState(true);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    
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
        transport: '',
        advanceFreight: 0,
        advancePaymentMethod: 'CashInHand',
    });
    
     useEffect(() => {
        if (customer) {
            setEditableInvoiceDetails(customer);
             setIsSameAsBilling(
                (!customer.shippingName || customer.shippingName === customer.name) &&
                (!customer.shippingAddress || customer.shippingAddress === customer.address) &&
                (!customer.shippingContact || customer.shippingContact === customer.contact) &&
                (!customer.shippingGstin || customer.shippingGstin === customer.gstin)
            );
             setInvoiceDetails(prev => ({
                ...prev,
                nineRNo: customer.nineRNo || '',
                gatePassNo: customer.gatePassNo || '',
                grNo: customer.grNo || '',
                grDate: customer.grDate || '',
                transport: customer.transport || '',
                advanceFreight: customer.advanceFreight || 0,
                advancePaymentMethod: customer.advancePaymentMethod || 'CashInHand'
            }));
        }
        if (receiptSettings) {
            setInvoiceDetails(prev => ({
                ...prev,
                companyGstin: receiptSettings.companyGstin || prev.companyGstin,
                companyStateName: receiptSettings.companyStateName || prev.companyStateName,
                companyStateCode: receiptSettings.companyStateCode || prev.companyStateCode,
            }));
        }
        
        const unsub = getBankAccountsRealtime(setBankAccounts, console.error);
        return () => unsub();

    }, [customer, receiptSettings, isOpen]);
    

    const handleEditableDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableInvoiceDetails(prev => ({...prev, [name]: value}));
    };
    
    const handleStateChange = (type: 'billing' | 'shipping', field: 'name' | 'code', value: string | null) => {
        if (type === 'billing') {
            if (field === 'name') {
                const state = findStateByName(value || '');
                setEditableInvoiceDetails(prev => ({ ...prev, stateName: value || '', stateCode: state?.code || '' }));
            } else {
                const state = findStateByCode(value || '');
                setEditableInvoiceDetails(prev => ({ ...prev, stateCode: value || '', stateName: state?.name || '' }));
            }
        } else { // shipping
             if (field === 'name') {
                const state = findStateByName(value || '');
                setEditableInvoiceDetails(prev => ({ ...prev, shippingStateName: value || '', shippingStateCode: state?.code || '' }));
            } else {
                const state = findStateByCode(value || '');
                setEditableInvoiceDetails(prev => ({ ...prev, shippingStateCode: value || '', shippingStateName: state?.name || '' }));
            }
        }
    };


     const handleActualPrint = async (id: string) => {
        if (!customer) return;

        let expenseId = customer.advanceExpenseId;
        const newAdvanceAmount = invoiceDetails.advanceFreight;

        // Handle expense creation/update/deletion
        if (newAdvanceAmount > 0) {
            const expenseData: Partial<Expense> = {
                transactionType: 'Expense',
                date: new Date().toISOString(),
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

            if (expenseId) {
                await updateExpense(expenseId, expenseData);
            } else {
                const newExpense = await addExpense(expenseData as Omit<Expense, 'id'>);
                expenseId = newExpense.id;
            }
        } else if (newAdvanceAmount === 0 && expenseId) {
            await deleteExpense(expenseId);
            expenseId = undefined; // Clear the ID after deletion
        }

        const formValuesForCalc: Partial<Customer> = {
            ...customer,
            ...editableInvoiceDetails,
            advanceFreight: newAdvanceAmount,
        };
        
        const calculated = calculateCustomerEntry(formValuesForCalc, []);
        
        const finalDataToSave: Partial<Customer> = { 
            ...customer,
            ...editableInvoiceDetails,
            ...calculated,
            advanceExpenseId: expenseId, // This will be undefined if deleted
            advancePaymentMethod: invoiceDetails.advancePaymentMethod,
            nineRNo: invoiceDetails.nineRNo,
            gatePassNo: invoiceDetails.gatePassNo,
            grNo: invoiceDetails.grNo,
            grDate: invoiceDetails.grDate,
            transport: invoiceDetails.transport,
         };

        if(isSameAsBilling) {
            finalDataToSave.shippingName = finalDataToSave.name;
            finalDataToSave.shippingCompanyName = finalDataToSave.companyName;
            finalDataToSave.shippingAddress = finalDataToSave.address;
            finalDataToSave.shippingContact = finalDataToSave.contact;
            finalDataToSave.shippingGstin = finalDataToSave.gstin;
            finalDataToSave.shippingStateName = finalDataToSave.stateName;
            finalDataToSave.shippingStateCode = finalDataToSave.stateCode;
        }
        
        await updateCustomer(customer.id, finalDataToSave);
        

        // ----- PRINTING LOGIC -----
        const receiptNode = document.getElementById(id);
        if (!receiptNode) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ title: "Print Error", description: "Could not create print window.", variant: "destructive" });
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Document</title>');

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                const style = iframeDoc.createElement('style');
                style.appendChild(iframeDoc.createTextNode(cssText));
                style.appendChild(iframeDoc.createTextNode('body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }'));
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn("Could not copy stylesheet:", e);
            }
        });

        iframeDoc.write('</head><body></body></html>');
        iframeDoc.body.innerHTML = receiptNode.innerHTML;
        iframeDoc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };
    
    const stateNameOptions = statesAndCodes.map(s => ({ value: s.name, label: s.name }));
    const stateCodeOptions = statesAndCodes.map(s => ({ value: s.code, label: s.code }));


    const renderDocument = () => {
        if (!customer || !receiptSettings) return null;
        
        const finalCustomerData: Customer = {
            ...customer,
            ...editableInvoiceDetails,
            ...calculateCustomerEntry(
                {
                    ...customer,
                    ...editableInvoiceDetails,
                    advanceFreight: invoiceDetails.advanceFreight,
                }, 
                [] 
            ),
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
            <DialogContent className="max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-0 p-0">
                <div className="lg:col-span-2 order-2 lg:order-1 h-[90vh]">
                    <ScrollArea className="h-full">
                        <div id="document-content" className="p-4 sm:p-6">
                           {renderDocument()}
                        </div>
                    </ScrollArea>
                </div>
                <div className="lg:col-span-1 order-1 lg:order-2 bg-muted/30 p-4 sm:p-6 border-l flex flex-col h-[90vh]">
                     <DialogHeader className="mb-4 flex-shrink-0">
                         <div className="flex items-center justify-between">
                             <DialogTitle>Edit Invoice Details</DialogTitle>
                             <DropdownMenu>
                                 <DropdownMenuTrigger asChild>
                                     <Button variant="outline" size="sm" className="ml-2">
                                         {documentType === 'tax-invoice' ? 'Tax Invoice' : documentType === 'bill-of-supply' ? 'Bill of Supply' : 'Challan'} <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                     </Button>
                                 </DropdownMenuTrigger>
                                 <DropdownMenuContent>
                                     <DropdownMenuItem onClick={() => setDocumentType('tax-invoice')}>Tax Invoice</DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => setDocumentType('bill-of-supply')}>Bill of Supply</DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => setDocumentType('challan')}>Challan</DropdownMenuItem>
                                 </DropdownMenuContent>
                             </DropdownMenu>
                         </div>
                         <DialogDescription>Make on-the-fly changes before printing.</DialogDescription>
                     </DialogHeader>
                    <ScrollArea className="flex-grow pr-3 -mr-3">
                        <div className="space-y-4">
                            {documentType === 'tax-invoice' && (
                            <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Tax & Invoice Info</CardTitle></CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1"><Label htmlFor="hsnCode" className="text-xs">HSN/SAC Code</Label><Input id="hsnCode" value={invoiceDetails.hsnCode} onChange={(e) => setInvoiceDetails({...invoiceDetails, hsnCode: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label htmlFor="taxRate" className="text-xs">Tax Rate (%)</Label><Input id="taxRate" type="number" value={invoiceDetails.taxRate} onChange={(e) => setInvoiceDetails({...invoiceDetails, taxRate: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                    
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
                                </CardContent>
                            </Card>
                            )}
                             <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Additional Details</CardTitle></CardHeader>
                                <CardContent className="p-3 grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><Label className="text-xs">9R No.</Label><Input value={invoiceDetails.nineRNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, nineRNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Gate Pass No.</Label><Input value={invoiceDetails.gatePassNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, gatePassNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">G.R. No.</Label><Input value={invoiceDetails.grNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, grNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">G.R. Date</Label><Input type="date" value={invoiceDetails.grDate} onChange={(e) => setInvoiceDetails({...invoiceDetails, grDate: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1 col-span-2"><Label className="text-xs">Transport</Label><Input value={invoiceDetails.transport} onChange={(e) => setInvoiceDetails({...invoiceDetails, transport: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Advance/Freight</Label><Input type="number" value={invoiceDetails.advanceFreight} onChange={(e) => setInvoiceDetails({...invoiceDetails, advanceFreight: Number(e.target.value)})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Advance Paid Via</Label>
                                        <CustomDropdown 
                                            options={[{value: "CashInHand", label: "Cash In Hand"}, ...bankAccounts.map(acc => ({ value: acc.id, label: acc.accountHolderName }))]} 
                                            value={invoiceDetails.advancePaymentMethod}
                                            onChange={(v) => v && setInvoiceDetails(prev => ({ ...prev, advancePaymentMethod: v }))} 
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Bill To Details</CardTitle></CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1"><Label className="text-xs">Customer Name</Label><Input name="name" value={editableInvoiceDetails.name || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Company Name</Label><Input name="companyName" value={editableInvoiceDetails.companyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Contact</Label><Input name="contact" value={editableInvoiceDetails.contact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Address</Label><Input name="address" value={editableInvoiceDetails.address || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">GSTIN</Label><Input name="gstin" value={editableInvoiceDetails.gstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">State Name</Label>
                                            <CustomDropdown options={stateNameOptions} value={editableInvoiceDetails.stateName || ''} onChange={(value) => handleStateChange('billing', 'name', value)} placeholder="State"/>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">State Code</Label>
                                            <CustomDropdown options={stateCodeOptions} value={editableInvoiceDetails.stateCode || ''} onChange={(value) => handleStateChange('billing', 'code', value)} placeholder="Code"/>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-3 flex items-center justify-between"><CardTitle className="text-base">Ship To Details</CardTitle><div className="flex items-center space-x-2"><Switch id="same-as-billing" checked={isSameAsBilling} onCheckedChange={setIsSameAsBilling} /><Label htmlFor="same-as-billing" className="text-xs">Same as Bill To</Label></div></CardHeader>
                                {!isSameAsBilling && (
                                    <CardContent className="p-3 space-y-3">
                                        <div className="space-y-1"><Label className="text-xs">Name</Label><Input name="shippingName" value={editableInvoiceDetails.shippingName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Company Name</Label><Input name="shippingCompanyName" value={editableInvoiceDetails.shippingCompanyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Contact</Label><Input name="shippingContact" value={editableInvoiceDetails.shippingContact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Address</Label><Input name="shippingAddress" value={editableInvoiceDetails.shippingAddress || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">GSTIN</Label><Input name="shippingGstin" value={editableInvoiceDetails.shippingGstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                             <div className="space-y-1">
                                                <Label className="text-xs">State Name</Label>
                                                <CustomDropdown options={stateNameOptions} value={editableInvoiceDetails.shippingStateName || ''} onChange={(value) => handleStateChange('shipping', 'name', value)} placeholder="State"/>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">State Code</Label>
                                                <CustomDropdown options={stateCodeOptions} value={editableInvoiceDetails.shippingStateCode || ''} onChange={(value) => handleStateChange('shipping', 'code', value)} placeholder="Code"/>
                                            </div>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
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

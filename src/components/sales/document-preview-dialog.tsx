
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getBankAccountsRealtime, addExpense } from "@/lib/firestore";
import { CustomDropdown } from "../ui/custom-dropdown";
import { formatCurrency } from "@/lib/utils";


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
    const [invoiceDetails, setInvoiceDetails] = useState({
        companyGstin: 'YOUR_GSTIN_HERE',
        companyStateName: 'YOUR_STATE',
        companyStateCode: '00',
        hsnCode: '1006',
        taxRate: 18,
        isGstIncluded: false,
        sixRNo: '',
        gatePassNo: '',
        grNo: '',
        grDate: '',
        transport: '',
    });
    const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

    useEffect(() => {
        if (customer) {
            setEditableInvoiceDetails(customer);
            setIsSameAsBilling(
                !customer.shippingName && !customer.shippingAddress &&
                !customer.shippingContact && !customer.shippingGstin
            );
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
    }, [customer, receiptSettings]);
    
    const handleAddAdvancePayment = () => {
        setAdvancePayments(prev => [...prev, { id: Date.now(), amount: 0, accountId: 'CashInHand' }]);
    };

    const handleAdvancePaymentChange = (id: number, field: 'amount' | 'accountId', value: string | number) => {
        setAdvancePayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleRemoveAdvancePayment = (id: number) => {
        setAdvancePayments(prev => prev.filter(p => p.id !== id));
    };
    
    const handleSaveAdvancePayments = async () => {
        if (!customer) return;
        try {
            for (const payment of advancePayments) {
                if (payment.amount > 0) {
                     const expenseData: Partial<Expense> = {
                        date: new Date().toISOString().split('T')[0],
                        transactionType: 'Expense',
                        category: 'Freight & Advance',
                        subCategory: 'Advance to Customer',
                        amount: payment.amount,
                        payee: customer.name,
                        description: `Advance for SR# ${customer.srNo} via ${bankAccounts.find(b => b.id === payment.accountId)?.accountHolderName || 'Cash'}`,
                        paymentMethod: payment.accountId === 'CashInHand' ? 'Cash' : 'Online',
                        status: 'Paid',
                        isRecurring: false,
                    };
                    if (payment.accountId !== 'CashInHand') {
                        expenseData.bankAccountId = payment.accountId;
                    }
                    await addExpense(expenseData as Omit<Expense, 'id'>);
                }
            }
            toast({ title: "Success", description: "Advance payments recorded as expenses." });
            setAdvancePayments([]);
        } catch (error) {
            console.error("Failed to save advance payments:", error);
            toast({ title: "Error", description: "Could not save advance payments.", variant: "destructive" });
        }
    };


    const handleEditableDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditableInvoiceDetails(prev => ({...prev, [name]: value}));
    };

     const handleActualPrint = (id: string) => {
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

    const totalAdvance = advancePayments.reduce((sum, p) => sum + p.amount, 0);

    const renderDocument = () => {
        if (!customer || !receiptSettings) return null;
        
        const finalCustomerData: Customer = {
            ...customer,
            ...editableInvoiceDetails,
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

        const enrichedInvoiceDetails = { ...invoiceDetails, totalAdvance };

        switch(documentType) {
            case 'tax-invoice':
                return <TaxInvoice customer={finalCustomerData} settings={receiptSettings} invoiceDetails={enrichedInvoiceDetails} />;
            case 'bill-of-supply':
                return <BillOfSupply customer={finalCustomerData} settings={receiptSettings} invoiceDetails={enrichedInvoiceDetails} />;
            case 'challan':
                return <Challan customer={finalCustomerData} settings={receiptSettings} invoiceDetails={enrichedInvoiceDetails} />;
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
                                    <div className="flex items-center space-x-2 pt-2"><Switch id="isGstIncluded" checked={invoiceDetails.isGstIncluded} onCheckedChange={(checked) => setInvoiceDetails({...invoiceDetails, isGstIncluded: checked})}/><Label htmlFor="isGstIncluded" className="text-xs">Is GST Included in Rate?</Label></div>
                                </CardContent>
                            </Card>
                            )}
                             <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Additional Details</CardTitle></CardHeader>
                                <CardContent className="p-3 grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><Label className="text-xs">6R No.</Label><Input value={invoiceDetails.sixRNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, sixRNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">Gate Pass No.</Label><Input value={invoiceDetails.gatePassNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, gatePassNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">G.R. No.</Label><Input value={invoiceDetails.grNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, grNo: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1"><Label className="text-xs">G.R. Date</Label><Input type="date" value={invoiceDetails.grDate} onChange={(e) => setInvoiceDetails({...invoiceDetails, grDate: e.target.value})} className="h-8 text-xs" /></div>
                                    <div className="space-y-1 col-span-2"><Label className="text-xs">Transport</Label><Input value={invoiceDetails.transport} onChange={(e) => setInvoiceDetails({...invoiceDetails, transport: e.target.value})} className="h-8 text-xs" /></div>
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
                                        <div className="space-y-1"><Label className="text-xs">State Name</Label><Input name="stateName" value={editableInvoiceDetails.stateName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">State Code</Label><Input name="stateCode" value={editableInvoiceDetails.stateCode || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
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
                                        <div className="space-y-1"><Label className="text-xs">State Name</Label><Input name="shippingStateName" value={editableInvoiceDetails.shippingStateName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">State Code</Label><Input name="shippingStateCode" value={editableInvoiceDetails.shippingStateCode || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" /></div>
                                    </div>
                                    </CardContent>
                                )}
                            </Card>
                             <Card>
                                <CardHeader className="p-3 flex items-center justify-between"><CardTitle className="text-base">Freight / Advance</CardTitle><Button size="sm" variant="outline" className="h-7" onClick={handleAddAdvancePayment}><Plus className="h-4 w-4 mr-2" />Add</Button></CardHeader>
                                <CardContent className="p-3 space-y-2">
                                    {advancePayments.map((payment, index) => (
                                        <div key={payment.id} className="flex items-center gap-2">
                                            <Input type="number" placeholder="Amount" value={payment.amount} onChange={(e) => handleAdvancePaymentChange(payment.id, 'amount', Number(e.target.value))} className="h-8 text-xs" />
                                            <div className="w-48"><CustomDropdown options={[{value: 'CashInHand', label: 'Cash In Hand'}, ...bankAccounts.map(acc => ({value: acc.id, label: acc.accountHolderName}))]} value={payment.accountId} onChange={(val) => handleAdvancePaymentChange(payment.id, 'accountId', val || '')} /></div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveAdvancePayment(payment.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    ))}
                                    {advancePayments.length > 0 && <Button size="sm" className="w-full mt-2" onClick={handleSaveAdvancePayments}>Save Advance Payments</Button>}
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 flex-row justify-end gap-2 flex-shrink-0">
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                        <Button onClick={() => handleActualPrint('document-content')}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

    
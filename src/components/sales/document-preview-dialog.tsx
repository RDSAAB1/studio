
"use client";

import { useState, useEffect } from "react";
import type { Customer, ReceiptSettings, DocumentType } from "@/lib/definitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Printer, ChevronsUpDown } from "lucide-react";
import { TaxInvoice } from "@/components/receipts/tax-invoice";
import { BillOfSupply } from "@/components/receipts/bill-of-supply";
import { Challan } from "@/components/receipts/challan";
import { cn } from "@/lib/utils";

interface DocumentPreviewDialogProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    customer: Customer | null;
    documentType: DocumentType;
    setDocumentType: (type: DocumentType) => void;
    receiptSettings: ReceiptSettings | null;
}

export const DocumentPreviewDialog = ({ isOpen, setIsOpen, customer, documentType, setDocumentType, receiptSettings }: DocumentPreviewDialogProps) => {
    const [editableInvoiceDetails, setEditableInvoiceDetails] = useState<Partial<Customer>>({});
    const [isSameAsBilling, setIsSameAsBilling] = useState(true);
    const [invoiceDetails, setInvoiceDetails] = useState({
        companyGstin: 'YOUR_GSTIN_HERE',
        hsnCode: '1006',
        taxRate: 18,
        isGstIncluded: false,
    });

    useEffect(() => {
        if (customer) {
            setEditableInvoiceDetails(customer);
            setIsSameAsBilling(
                !customer.shippingName &&
                !customer.shippingAddress &&
                !customer.shippingContact &&
                !customer.shippingGstin
            );
        }
    }, [customer]);

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
        if (!iframeDoc) return;

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

    const renderDocument = () => {
        if (!customer || !receiptSettings) return null;
        
        const finalCustomerData: Customer = {
            ...customer,
            ...editableInvoiceDetails,
            gstin: editableInvoiceDetails.gstin,
        };

        if (isSameAsBilling) {
            finalCustomerData.shippingName = finalCustomerData.name;
            finalCustomerData.shippingCompanyName = finalCustomerData.companyName;
            finalCustomerData.shippingAddress = finalCustomerData.address;
            finalCustomerData.shippingContact = finalCustomerData.contact;
            finalCustomerData.shippingGstin = finalCustomerData.gstin;
        }

        switch(documentType) {
            case 'tax-invoice':
                return <TaxInvoice customer={finalCustomerData} settings={receiptSettings} invoiceDetails={invoiceDetails} />;
            case 'bill-of-supply':
                return <BillOfSupply customer={finalCustomerData} settings={receiptSettings} />;
            case 'challan':
                return <Challan customer={finalCustomerData} settings={receiptSettings} />;
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
                            <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Tax & Invoice Info</CardTitle></CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="companyGstin" className="text-xs">Your GSTIN</Label>
                                        <Input id="companyGstin" value={invoiceDetails.companyGstin} onChange={(e) => setInvoiceDetails({...invoiceDetails, companyGstin: e.target.value.toUpperCase()})} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="hsnCode" className="text-xs">HSN/SAC Code</Label>
                                        <Input id="hsnCode" value={invoiceDetails.hsnCode} onChange={(e) => setInvoiceDetails({...invoiceDetails, hsnCode: e.target.value})} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="taxRate" className="text-xs">Tax Rate (%)</Label>
                                        <Input id="taxRate" type="number" value={invoiceDetails.taxRate} onChange={(e) => setInvoiceDetails({...invoiceDetails, taxRate: Number(e.target.value)})} className="h-8 text-xs" />
                                    </div>
                                    <div className="flex items-center space-x-2 pt-2">
                                       <button
                                            type="button"
                                            onClick={() => setInvoiceDetails({...invoiceDetails, isGstIncluded: !invoiceDetails.isGstIncluded})}
                                            className={cn(
                                                "relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                invoiceDetails.isGstIncluded ? 'bg-primary/20' : 'bg-secondary/20'
                                            )}
                                            >
                                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", invoiceDetails.isGstIncluded ? 'text-primary' : 'text-muted-foreground')}>Included</span>
                                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", !invoiceDetails.isGstIncluded ? 'text-primary' : 'text-muted-foreground')}>Excluded</span>
                                            <div
                                                className={cn(
                                                    "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                                                    invoiceDetails.isGstIncluded ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'
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
                            <Card>
                                <CardHeader className="p-3"><CardTitle className="text-base">Bill To Details</CardTitle></CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-name" className="text-xs">Customer Name</Label>
                                        <Input id="edit-name" name="name" value={editableInvoiceDetails.name || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-companyName" className="text-xs">Company Name</Label>
                                        <Input id="edit-companyName" name="companyName" value={editableInvoiceDetails.companyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-contact" className="text-xs">Contact</Label>
                                        <Input id="edit-contact" name="contact" value={editableInvoiceDetails.contact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-address" className="text-xs">Address</Label>
                                        <Input id="edit-address" name="address" value={editableInvoiceDetails.address || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="edit-gstin" className="text-xs">GSTIN</Label>
                                        <Input id="edit-gstin" name="gstin" value={editableInvoiceDetails.gstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="p-3 flex items-center justify-between">
                                    <CardTitle className="text-base">Ship To Details</CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsSameAsBilling(!isSameAsBilling)}
                                            className={cn(
                                                "relative w-48 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ease-in-out",
                                                !isSameAsBilling ? 'bg-primary/20' : 'bg-secondary/20'
                                            )}
                                            >
                                            <span className={cn("absolute left-4 text-xs font-semibold transition-colors duration-300", !isSameAsBilling ? 'text-primary' : 'text-muted-foreground')}>Different</span>
                                            <span className={cn("absolute right-4 text-xs font-semibold transition-colors duration-300", isSameAsBilling ? 'text-primary' : 'text-muted-foreground')}>Same</span>
                                            <div
                                                className={cn(
                                                    "absolute w-[calc(50%+12px)] h-full top-0 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out bg-card transform",
                                                    !isSameAsBilling ? 'translate-x-[-4px]' : 'translate-x-[calc(100%-28px)]'
                                                )}
                                            >
                                                <div className={cn(
                                                        "h-full w-full rounded-full flex items-center justify-center transition-colors duration-300",
                                                        !isSameAsBilling ? 'bg-primary' : 'bg-secondary'
                                                    )}>
                                                    <span className="text-sm font-bold text-primary-foreground">Shipment</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </CardHeader>
                                {!isSameAsBilling && (
                                    <CardContent className="p-3 space-y-3">
                                        <div className="space-y-1">
                                            <Label htmlFor="shippingName" className="text-xs">Name</Label>
                                            <Input id="shippingName" name="shippingName" value={editableInvoiceDetails.shippingName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="shippingCompanyName" className="text-xs">Company Name</Label>
                                            <Input id="shippingCompanyName" name="shippingCompanyName" value={editableInvoiceDetails.shippingCompanyName || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="shippingContact" className="text-xs">Contact</Label>
                                            <Input id="shippingContact" name="shippingContact" value={editableInvoiceDetails.shippingContact || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="shippingAddress" className="text-xs">Address</Label>
                                            <Input id="shippingAddress" name="shippingAddress" value={editableInvoiceDetails.shippingAddress || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="shippingGstin" className="text-xs">GSTIN</Label>
                                            <Input id="shippingGstin" name="shippingGstin" value={editableInvoiceDetails.shippingGstin || ''} onChange={handleEditableDetailsChange} className="h-8 text-xs" />
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        </div>
                    </ScrollArea>
                    <DialogFooter className="pt-4 flex-row justify-end gap-2 flex-shrink-0">
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                        <Button onClick={() => handleActualPrint('document-content')}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
};

  

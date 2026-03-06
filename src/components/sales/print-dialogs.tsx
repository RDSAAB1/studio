

"use client";

import { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Printer } from 'lucide-react';
import { ReceiptPreview, ConsolidatedReceiptPreview } from './receipt-previews';
import type { Customer, ReceiptSettings, ConsolidatedReceiptData } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

interface ReceiptPrintDialogProps {
    receipts: Customer[];
    settings: ReceiptSettings | null;
    onOpenChange: (open: boolean) => void;
    isCustomer?: boolean;
}

export const ReceiptPrintDialog = ({ receipts, settings, onOpenChange, isCustomer = false }: ReceiptPrintDialogProps) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Receipt</title>');
        iframeDoc.write(`
            <style>
                html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
                body * { background-color: transparent; }
                .printable-area, .printable-area * { color: #000 !important; background-color: #fff !important; }
                @media print {
                    @page { size: A6 landscape; margin: 5mm; }
                    html, body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .receipt-container { page-break-after: always; }
                    .printable-area * { color: #000 !important; background-color: #fff !important; border-color: #333 !important; }
                }
            </style>`);

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch (e) { /* CORS - skip cross-origin styles */ }
        });

        const overrideStyle = iframeDoc.createElement('style');
        overrideStyle.id = 'print-override';
        overrideStyle.textContent = `@media print {
          body, body *, .printable-area, .printable-area *, .receipt-container, .receipt-container *, .consolidated-receipt, .consolidated-receipt * {
            visibility: visible !important;
            opacity: 1 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }`;
        iframeDoc.head.appendChild(overrideStyle);
        
        iframeDoc.write(`</head><body></body></html>`);
        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        let printed = false;
        const doPrint = () => {
            if (printed) return;
            printed = true;
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        };
        iframe.contentWindow?.addEventListener('load', doPrint, { once: true });
        setTimeout(doPrint, 800);
    };

    return (
        <Dialog open={receipts.length > 0} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="sr-only">Print Receipts</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <div ref={contentRef}>
                        {receipts.map((receiptData, index) => (
                            <div key={index} className="receipt-container p-2">
                                {settings && <ReceiptPreview data={receiptData} settings={settings} isCustomer={isCustomer}/>}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 pt-0">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print All
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface ConsolidatedReceiptPrintDialogProps {
    data: ConsolidatedReceiptData | null;
    settings: ReceiptSettings | null;
    onOpenChange: (open: boolean) => void;
    isCustomer?: boolean;
}

export const ConsolidatedReceiptPrintDialog = ({ data, settings, onOpenChange, isCustomer = false }: ConsolidatedReceiptPrintDialogProps) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
         const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Consolidated Receipt</title>');
        iframeDoc.write(`
            <style>
                html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
                body * { background-color: transparent; }
                .printable-area, .printable-area * { color: #000 !important; background-color: #fff !important; }
                @media print {
                    @page { size: A4; margin: 10mm; }
                    html, body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .receipt-container { page-break-after: always; }
                    .printable-area * { color: #000 !important; background-color: #fff !important; border-color: #333 !important; }
                }
            </style>`);

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch (e) { /* CORS - skip cross-origin styles */ }
        });

        const overrideStyle2 = iframeDoc.createElement('style');
        overrideStyle2.id = 'print-override';
        overrideStyle2.textContent = `@media print {
          body, body *, .printable-area, .printable-area *, .receipt-container, .receipt-container *, .consolidated-receipt, .consolidated-receipt * {
            visibility: visible !important;
            opacity: 1 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }`;
        iframeDoc.head.appendChild(overrideStyle2);
        
        iframeDoc.write(`</head><body></body></html>`);
        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        let printed = false;
        const doPrint = () => {
            if (printed) return;
            printed = true;
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        };
        iframe.contentWindow?.addEventListener('load', doPrint, { once: true });
        setTimeout(doPrint, 800);
    }
    
    return (
        <Dialog open={!!data} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="sr-only">Print Consolidated Receipt</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <div ref={contentRef}>
                        {data && settings && (
                            <div className="receipt-container p-2">
                                <ConsolidatedReceiptPreview data={data} settings={settings} isCustomer={isCustomer}/>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 pt-0">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

interface CombinedReceiptPrintDialogProps {
    receipts: Customer[];
    consolidatedData: ConsolidatedReceiptData | null;
    allConsolidatedGroups: ConsolidatedReceiptData[];
    settings: ReceiptSettings | null;
    onOpenChange: (open: boolean) => void;
    isCustomer?: boolean;
}

export const CombinedReceiptPrintDialog = ({ receipts, consolidatedData, allConsolidatedGroups, settings, onOpenChange, isCustomer = false }: CombinedReceiptPrintDialogProps) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '210mm';
        iframe.style.height = '297mm';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            document.body.removeChild(iframe);
            return;
        }

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print All Receipts</title>');
        iframeDoc.write(`
            <style>
                html, body { background: white !important; color: black !important; margin: 0; padding: 0; }
                body * { background-color: transparent; }
                .printable-area, .printable-area * { color: #000 !important; background-color: #fff !important; }
                @media print {
                    @page { size: A6 landscape; margin: 5mm; }
                    html, body { background: white !important; color: black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .receipt-container, .consolidated-receipt { page-break-after: always; }
                    .printable-area * { color: #000 !important; background-color: #fff !important; border-color: #333 !important; }
                }
            </style>`);

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch (e) { /* CORS - skip cross-origin styles */ }
        });

        const overrideStyle3 = iframeDoc.createElement('style');
        overrideStyle3.id = 'print-override';
        overrideStyle3.textContent = `@media print {
          body, body *, .printable-area, .printable-area *, .receipt-container, .receipt-container *, .consolidated-receipt, .consolidated-receipt * {
            visibility: visible !important;
            opacity: 1 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }`;
        iframeDoc.head.appendChild(overrideStyle3);
        
        iframeDoc.write(`</head><body></body></html>`);
        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        let printed = false;
        const doPrint = () => {
            if (printed) return;
            printed = true;
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        };
        iframe.contentWindow?.addEventListener('load', doPrint, { once: true });
        setTimeout(doPrint, 800);
    };

    const hasData = receipts.length > 0 || allConsolidatedGroups.length > 0;

    return (
        <Dialog open={hasData} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="text-lg font-semibold">
                        Print Preview - All Receipts
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                    <div ref={contentRef} className="space-y-4">
                        {/* All Consolidated Receipts */}
                        {allConsolidatedGroups.length > 0 && settings && (
                            <div className="consolidated-receipts">
                                <div className="bg-blue-50 p-2 mb-2 rounded">
                                    <h3 className="font-bold text-blue-800">Consolidated Receipts ({allConsolidatedGroups.length} groups)</h3>
                                </div>
                                {allConsolidatedGroups.map((consolidatedData, groupIndex) => (
                                    <div key={groupIndex} className="consolidated-receipt p-2 border-2 border-blue-500 rounded-lg mb-4">
                                        <div className="bg-blue-50 p-2 mb-2 rounded">
                                            <h4 className="font-bold text-blue-800">Group {groupIndex + 1}: {consolidatedData.customer?.name} ({consolidatedData.receiptCount} entries)</h4>
                                            <p className="text-sm text-blue-600">{consolidatedData.customer?.address}</p>
                                        </div>
                                        <ConsolidatedReceiptPreview data={consolidatedData} settings={settings} isCustomer={isCustomer}/>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {/* Individual Receipts */}
                        {receipts.length > 0 && settings && (
                            <div className="individual-receipts">
                                <div className="bg-green-50 p-2 mb-2 rounded">
                                    <h3 className="font-bold text-green-800">Individual Receipts ({receipts.length} entries)</h3>
                                </div>
                                {receipts.map((receiptData, index) => (
                                    <div key={index} className="receipt-container p-2 border border-gray-300 rounded mb-2">
                                        <div className="bg-gray-50 p-1 mb-2 rounded text-sm">
                                            <span className="font-medium">Receipt {index + 1}:</span> {receiptData.name} - {receiptData.srNo}
                                        </div>
                                        <ReceiptPreview data={receiptData} settings={settings} isCustomer={isCustomer}/>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 pt-0">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print All Receipts
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
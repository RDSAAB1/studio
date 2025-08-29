
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
}

export const ReceiptPrintDialog = ({ receipts, settings, onOpenChange }: ReceiptPrintDialogProps) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Receipt</title>');
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                const style = iframeDoc.createElement('style');
                style.appendChild(iframeDoc.createTextNode(cssText));
                style.appendChild(iframeDoc.createTextNode('body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-container { page-break-after: always; }'));
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn("Could not copy stylesheet:", e);
            }
        });
        iframeDoc.write('</head><body></body></html>');
        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
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
                            <div key={index} className="receipt-container">
                                {settings && <ReceiptPreview data={receiptData} settings={settings}/>}
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
}

export const ConsolidatedReceiptPrintDialog = ({ data, settings, onOpenChange }: ConsolidatedReceiptPrintDialogProps) => {
    const { toast } = useToast();
    const contentRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
         const node = contentRef.current;
        if (!node) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) return;

        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print Consolidated Receipt</title>');
        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const cssText = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                const style = iframeDoc.createElement('style');
                style.appendChild(iframeDoc.createTextNode(cssText));
                style.appendChild(iframeDoc.createTextNode('body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .receipt-container { page-break-after: always; }'));
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.warn("Could not copy stylesheet:", e);
            }
        });
        iframeDoc.write('</head><body></body></html>');
        iframeDoc.body.innerHTML = node.innerHTML;
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
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
                            <div className="receipt-container">
                                <ConsolidatedReceiptPreview data={data} settings={settings} />
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

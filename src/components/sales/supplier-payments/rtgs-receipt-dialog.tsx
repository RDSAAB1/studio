
"use client";

import { useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RtgsReceipt } from "@/components/receipts/rtgs-receipt";
import { useToast } from "@/hooks/use-toast";
import type { Payment, RtgsSettings } from '@/lib/definitions';

interface RTGSReceiptDialogProps {
    payment: Payment | null;
    settings: RtgsSettings | null;
    onOpenChange: (open: boolean) => void;
}

export const RTGSReceiptDialog = ({ payment, settings, onOpenChange }: RTGSReceiptDialogProps) => {
    const { toast } = useToast();

    const handleActualPrint = () => {
        const receiptNode = document.getElementById('rtgs-receipt-content');
        if (!receiptNode) return;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
             toast({ title: 'Could not create print content.', variant: 'destructive'});
            return;
        }
        
        iframeDoc.open();
        iframeDoc.write('<html><head><title>Print RTGS Receipt</title>');

        Array.from(document.styleSheets).forEach(styleSheet => {
            try {
                const style = iframeDoc.createElement('style');
                style.textContent = Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('');
                iframeDoc.head.appendChild(style);
            } catch (e) {

            }
        });

        const printOverride = iframeDoc.createElement('style');
        printOverride.textContent = `@media print {
          body, body *, .printable-area, .printable-area * {
            visibility: visible !important;
            opacity: 1 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }`;
        iframeDoc.head.appendChild(printOverride);
        
        iframeDoc.write(`
            <style>
                @media print {
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            </style>
        </head><body></body></html>`);
        
        iframeDoc.body.innerHTML = receiptNode.innerHTML;
        iframeDoc.close();
        
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 500);
    };

    return (
        <Dialog open={!!payment} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                {payment && settings && <RtgsReceipt payment={payment} settings={settings} onPrint={handleActualPrint}/>}
            </DialogContent>
        </Dialog>
    );
};

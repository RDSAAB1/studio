
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
             toast({ variant: 'destructive', title: 'Error', description: 'Could not create print content.' });
            return;
        }
        
        iframeDoc.open();
        iframeDoc.write(`
            <html>
                <head>
                    <title>Print RTGS Receipt</title>
                    <link rel="stylesheet" href="/_next/static/css/app/layout.css" media="print">
                     <style>
                        @media print {
                            body {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    ${receiptNode.innerHTML}
                </body>
            </html>
        `);
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

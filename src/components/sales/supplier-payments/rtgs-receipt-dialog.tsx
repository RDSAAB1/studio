
"use client";

import { useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RtgsReceiptView } from "@/components/receipts/rtgs-receipt-view";
import { useToast } from "@/hooks/use-toast";
import type { Payment, RtgsSettings } from '@/lib/definitions';

import { printHtmlContent } from '@/lib/electron-print';

interface RTGSReceiptDialogProps {
    payment: Payment | null;
    settings: RtgsSettings | null;
    onOpenChange: (open: boolean) => void;
}

export const RTGSReceiptDialog = ({ payment, settings, onOpenChange }: RTGSReceiptDialogProps) => {
    const { toast } = useToast();

    const handleActualPrint = async () => {
        const receiptNode = document.getElementById('rtgs-receipt-content');
        if (!receiptNode) return;

        const printHtml = `
            <div class="printable-area">
                ${receiptNode.innerHTML}
            </div>
        `;

        const printStyles = `
            @page { size: portrait; margin: 10mm; }
            body { 
                background-color: #ffffff !important;
                color: #000000 !important;
                font-family: sans-serif;
                margin: 0;
                padding: 15px;
            }
            .printable-area {
                color: #000 !important;
            }
            .printable-area * {
                color: #000 !important;
            }
            /* Add any specific receipt styles here if needed */
        `;

        try {
            await printHtmlContent(printHtml, printStyles);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Print Failed', description: error.message });
        }
    };


    return (
        <Dialog open={!!payment} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                {payment && settings && <RtgsReceiptView payment={payment} settings={settings} onPrint={handleActualPrint}/>}
            </DialogContent>
        </Dialog>
    );
};

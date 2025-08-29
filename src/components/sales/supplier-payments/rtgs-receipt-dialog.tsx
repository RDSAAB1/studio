
"use client";

import { useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RtgsReceipt } from "@/components/receipts/rtgs-receipt";
import { useToast } from "@/hooks/use-toast";

export const RTGSReceiptDialog = ({ payment, onOpenChange }: any) => {
    const { toast } = useToast();

    const handleActualPrint = () => {
        const receiptNode = document.getElementById('rtgs-receipt-content');
        if (!receiptNode) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast({variant: 'destructive', title: 'Error', description: 'Could not open print window.'});
            return;
        }
        
        printWindow.document.write('<html><head><title>Print RTGS Receipt</title>');
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

    return (
        <Dialog open={!!payment} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0">
                {payment && <RtgsReceipt payment={payment} onPrint={handleActualPrint}/>}
            </DialogContent>
        </Dialog>
    );
};

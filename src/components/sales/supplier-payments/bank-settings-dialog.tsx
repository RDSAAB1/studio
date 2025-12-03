
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BankManagementPage from '@/app/settings/bank-management/page';

interface BankSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export const BankSettingsDialog = ({ isOpen, onOpenChange }: BankSettingsDialogProps) => {

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                {/* Visually minimal header just to satisfy accessibility requirements */}
                <DialogHeader className="sr-only">
                    <DialogTitle>Bank & Branch Management</DialogTitle>
                </DialogHeader>
                <div className="flex-grow min-h-0 overflow-auto p-4">
                    <BankManagementPage />
                </div>
            </DialogContent>
       </Dialog>
    );
}

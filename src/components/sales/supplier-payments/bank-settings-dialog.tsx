
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BankManagementPage from '@/app/settings/bank-management/page';

interface BankSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export const BankSettingsDialog = ({ isOpen, onOpenChange }: BankSettingsDialogProps) => {

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
                 <DialogHeader className="p-4 border-b">
                    <DialogTitle>Bank & Branch Management</DialogTitle>
                    <DialogDescription>Add, edit, or manage banks and their branches here.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow min-h-0 p-4">
                    <BankManagementPage />
                </div>
            </DialogContent>
       </Dialog>
    );
}

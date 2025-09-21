
"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface UpdateConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onConfirm: (deletePayments: boolean) => void;
}

export const UpdateConfirmDialog = ({ isOpen, onOpenChange, onConfirm }: UpdateConfirmDialogProps) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Update Paid Entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This receipt already has payments associated with it. How would you like to proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <AlertDialogAction onClick={() => {
                        onConfirm(true);
                        onOpenChange(false);
                    }} className="bg-destructive hover:bg-destructive/90">
                        Yes, Delete Payments
                    </AlertDialogAction>
                    <AlertDialogAction onClick={() => {
                        onConfirm(false);
                        onOpenChange(false);
                    }}>
                        Continue Update
                    </AlertDialogAction>
                    <AlertDialogCancel className="sm:col-span-2">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

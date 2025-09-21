
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { getBanksRealtime, getBankBranchesRealtime, addBank, addBankBranch, deleteBankBranch, updateBankBranch } from '@/lib/firestore';
import { Bank, BankBranch } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit, Trash2, Upload, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toTitleCase } from '@/lib/utils';
import BankManagementPage from '@/app/settings/bank-management/page';

interface BankSettingsDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    banks: Bank[];
    onAddBank: (name: string) => Promise<void>;
    onAddBranch: (branchData: Omit<BankBranch, 'id'>) => Promise<void>;
}

export const BankSettingsDialog = ({ isOpen, onOpenChange, banks, onAddBank, onAddBranch }: BankSettingsDialogProps) => {

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

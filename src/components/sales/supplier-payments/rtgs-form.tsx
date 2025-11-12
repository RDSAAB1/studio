
"use client";

import React from 'react';
import { toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { addBank } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

export const RtgsForm = (props: any) => {
    const { toast } = useToast();
    const {
        bankDetails, setBankDetails,
        checkNo, setCheckNo,
        editingPayment, setIsBankSettingsOpen,
        supplierDetails = {},
        setSupplierDetails,
    } = props;
    
    const { banks, bankBranches } = useSupplierData();
    
    const bankOptions = React.useMemo(() => {
        if (!Array.isArray(banks)) return [];
        return banks.map((bank: any) => ({
            value: bank.name,
            label: toTitleCase(bank.name)
        }));
    }, [banks]);

    const availableBranchOptions = React.useMemo(() => {
        if (!bankDetails.bank || !Array.isArray(bankBranches)) return [];
        const uniqueBranches = new Map<string, { value: string; label: string }>();
        bankBranches
            .filter((branch: any) => branch.bankName === bankDetails.bank)
            .forEach((branch: any) => {
                if (!uniqueBranches.has(branch.branchName)) {
                    uniqueBranches.set(branch.branchName, { value: branch.branchName, label: toTitleCase(branch.branchName) });
                }
            });
        return Array.from(uniqueBranches.values());
    }, [bankDetails.bank, bankBranches]);

    const handleBankSelect = (bankName: string | null) => {
        setBankDetails({
            ...bankDetails,
            bank: bankName || '',
            branch: '',
            ifscCode: ''
        });
    };

    const handleBranchSelect = (branchName: string | null) => {
        const selectedBranch = bankBranches.find((b: any) => b.bankName === bankDetails.bank && b.branchName === branchName);
        setBankDetails((prev: any) => ({
            ...prev,
            branch: branchName || '',
            ifscCode: selectedBranch ? selectedBranch.ifscCode : prev.ifscCode
        }));
    };
    
    const handleIfscBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const ifsc = e.target.value.toUpperCase();
        setBankDetails((prev: any) => ({...prev, ifscCode: ifsc}));
        const matchingBranch = bankBranches.find((b: any) => b.ifscCode === ifsc);
        if (matchingBranch) {
            setBankDetails((prev: any) => ({
                ...prev,
                bank: matchingBranch.bankName,
                branch: matchingBranch.branchName,
            }));
        }
    };
    
    const handleAddBranch = async (newBranchName: string) => {
        if (!bankDetails.bank) {
            toast({ title: "Please select a bank first.", variant: 'destructive' });
            return;
        }
        handleBranchSelect(newBranchName);
    };

    const formatCheckNo = (e: React.FocusEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        if (value && !isNaN(parseInt(value))) {
            setCheckNo(String(parseInt(value)).padStart(6, '0'));
        }
    };

    return (
        <div className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Bank Details</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsBankSettingsOpen(true)}>
                    <Settings className="h-4 w-4" />
                </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                 <div className="space-y-1">
                    <Label className="text-xs">A/C Holder</Label>
                    <Input
                        value={supplierDetails.name || ''}
                        onChange={(e) => setSupplierDetails?.({ ...supplierDetails, name: e.target.value })}
                        placeholder="Enter payee name"
                        className="h-8 text-xs"
                    />
                </div>
                 <div className="space-y-1">
                    <Label className="text-xs">Bank</Label>
                    <CustomDropdown options={bankOptions} value={bankDetails.bank} onChange={handleBankSelect} onAdd={(newBank) => { addBank(newBank); handleBankSelect(newBank); }} placeholder="Select or add bank" />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Branch</Label>
                    <CustomDropdown options={availableBranchOptions} value={bankDetails.branch} onChange={handleBranchSelect} onAdd={handleAddBranch} placeholder="Select or add branch"/>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">IFSC</Label>
                    <Input value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase()})} onBlur={handleIfscBlur} className="h-8 text-xs font-mono uppercase"/>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">A/C No.</Label>
                    <Input value={bankDetails.acNo} onChange={e => setBankDetails({...bankDetails, acNo: e.target.value})} className="h-8 text-xs font-mono"/>
                </div>
                 <div className="space-y-1">
                    <Label className="text-xs">Check No.</Label>
                    <Input value={checkNo} onChange={e => setCheckNo(e.target.value)} onBlur={formatCheckNo} className="h-8 text-xs"/>
                </div>
            </div>
        </div>
    );
};

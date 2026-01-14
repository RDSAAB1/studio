
"use client";

import React from 'react';
import { toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { addBank, addSupplierBankAccount } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Bank, BankBranch, BankAccount, Payment } from '@/lib/definitions';

interface RtgsFormProps {
    bankDetails: { bank?: string; branch?: string; ifscCode?: string; acNo?: string };
    setBankDetails: (details: { bank?: string; branch?: string; ifscCode?: string; acNo?: string }) => void;
    editingPayment?: Payment;
    setIsBankSettingsOpen: (open: boolean) => void;
    supplierDetails?: { name?: string; [key: string]: unknown };
    setSupplierDetails?: (details: { name?: string; [key: string]: unknown }) => void;
    bankAccounts?: BankAccount[];
    banks?: Bank[];
    bankBranches?: BankBranch[];
}

export const RtgsForm = (props: RtgsFormProps) => {
    const { toast } = useToast();
    const {
        bankDetails, setBankDetails,
        editingPayment, setIsBankSettingsOpen,
        supplierDetails = {},
        setSupplierDetails,
        bankAccounts = [],
        banks: propsBanks,
        bankBranches: propsBankBranches,
    } = props;
    
    // Use props if provided, otherwise get from useSupplierData hook
    const supplierData = useSupplierData();
    const banks = propsBanks !== undefined ? (Array.isArray(propsBanks) ? propsBanks : []) : supplierData.banks;
    const bankBranches = propsBankBranches !== undefined ? (Array.isArray(propsBankBranches) ? propsBankBranches : []) : supplierData.bankBranches;
    
    const bankOptions = React.useMemo(() => {
        if (!Array.isArray(banks)) {

            return [];
        }
        if (banks.length === 0) {

        }
        const options = banks
            .filter(bank => bank && (bank.name || bank.id)) // Filter out invalid banks
            .map((bank: Bank) => ({
                value: bank.name || bank.id || '',
                label: toTitleCase(bank.name || bank.id || '')
            }))
            .filter(opt => opt.value && opt.label); // Filter out invalid options

        if (options.length === 0 && banks.length > 0) {

        }
        return options;
    }, [banks]);

    const availableBranchOptions = React.useMemo(() => {
        if (!bankDetails.bank || !bankDetails.bank.trim()) return [];
        if (!Array.isArray(bankBranches)) return [];
        const uniqueBranches = new Map<string, { value: string; label: string }>();
        const selectedBankName = (bankDetails.bank || '').trim().toLowerCase();
        const matchingBranches = bankBranches.filter((branch: BankBranch) => {
            const branchBankName = (branch.bankName || '').trim().toLowerCase();
            return branchBankName === selectedBankName;
        });
        matchingBranches.forEach((branch: BankBranch) => {
            const branchName = branch.branchName?.trim();
            if (branchName && !uniqueBranches.has(branchName)) {
                uniqueBranches.set(branchName, { 
                    value: branchName, 
                    label: toTitleCase(branchName) 
                });
            }
        });
        return Array.from(uniqueBranches.values());
    }, [bankDetails.bank, bankBranches]);

    // Filter accounts based on selected Bank and Branch
    const filteredBankAccounts = React.useMemo(() => {
        if (!Array.isArray(bankAccounts)) return [];
        let filtered = bankAccounts;
        
        // Filter by bank if selected (case-insensitive comparison with normalization)
        if (bankDetails.bank) {
            const selectedBank = bankDetails.bank.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: BankAccount) => {
                const accBankName = (acc.bankName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const matches = accBankName === selectedBank;
                return matches;
            });
        }
        
        // Filter by branch if selected (case-insensitive comparison with normalization)
        if (bankDetails.branch) {
            const selectedBranch = bankDetails.branch.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: BankAccount) => {
                const accBranchName = (acc.branchName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const matches = accBranchName === selectedBranch;
                return matches;
            });
        }
        
        // If filtering results in empty list, show all accounts (fallback)
        // This helps debug the issue
        if (filtered.length === 0 && (bankDetails.bank || bankDetails.branch)) {

        }
        
        return filtered;
    }, [bankAccounts, bankDetails.bank, bankDetails.branch]);

    // Options for Name dropdown (showing Name and Account No.)
    // Filter by Bank and Branch if selected, show all accounts otherwise
    const nameOptions = React.useMemo(() => {
        if (!Array.isArray(bankAccounts)) return [];
        
        // Filter accounts based on selected Bank and Branch (same logic as filteredBankAccounts)
        let filtered = bankAccounts;
        
        // Filter by bank if selected (case-insensitive comparison with normalization)
        if (bankDetails.bank) {
            const selectedBank = bankDetails.bank.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: BankAccount) => {
                const accBankName = (acc.bankName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBankName === selectedBank;
            });
        }
        
        // Filter by branch if selected (case-insensitive comparison with normalization)
        if (bankDetails.branch) {
            const selectedBranch = bankDetails.branch.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: BankAccount) => {
                const accBranchName = (acc.branchName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBranchName === selectedBranch;
            });
        }
        
        return filtered.map((acc: BankAccount) => {
            const name = acc.accountHolderName || '';
            return {
                value: `${name}__${acc.accountNumber}`, // Use combined key to handle duplicate names
                label: `${name} - ${acc.accountNumber}`, // Full label for dropdown display
                displayValue: name, // Only name for input field display
                account: acc,
                name: name
            };
        });
    }, [bankAccounts, bankDetails.bank, bankDetails.branch]);

    const handleBankSelect = (bankName: string | null) => {
        setBankDetails({
            ...bankDetails,
            bank: bankName || '',
            branch: '',
            ifscCode: ''
        });
    };

    const handleBranchSelect = (branchName: string | null) => {
        const selectedBranch = bankBranches.find((b: BankBranch) => b.bankName === bankDetails.bank && b.branchName === branchName);
        setBankDetails((prev: { bank?: string; branch?: string; ifscCode?: string; acNo?: string }) => ({
            ...prev,
            branch: branchName || '',
            ifscCode: selectedBranch ? selectedBranch.ifscCode : prev.ifscCode
        }));
    };
    
    const handleIfscBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const ifsc = e.target.value.toUpperCase();
        setBankDetails((prev: { bank?: string; branch?: string; ifscCode?: string; acNo?: string }) => ({...prev, ifscCode: ifsc}));
        const matchingBranch = bankBranches.find((b: BankBranch) => b.ifscCode === ifsc);
        if (matchingBranch) {
            setBankDetails((prev: { bank?: string; branch?: string; ifscCode?: string; acNo?: string }) => ({
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

    return (
        <div className="space-y-2 text-[10px]">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted-foreground">Bank Details</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsBankSettingsOpen(true)}>
                    <Settings className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="space-y-2">
                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-0.5">
                        <Label htmlFor="rtgsAccountHolder" className="text-[10px]">A/C Holder</Label>
                        <CustomDropdown
                            id="rtgsAccountHolder"
                            options={nameOptions.map(opt => ({ 
                                value: opt.value, 
                                label: opt.label,
                                displayValue: opt.displayValue 
                            }))}
                            value={(() => {
                                if (!supplierDetails.name) return '';
                                // Try to find matching option
                                const matchingOption = nameOptions.find(opt => 
                                    opt.name === supplierDetails.name && 
                                    opt.account.accountNumber === bankDetails.acNo
                                );
                                if (matchingOption) {
                                    return matchingOption.value;
                                }
                                // If no match, return just the name (for custom input)
                                return supplierDetails.name;
                            })()}
                            onChange={(value) => {
                                if (value) {
                                    const selectedNameOption = nameOptions.find(opt => opt.value === value);
                                    if (selectedNameOption && selectedNameOption.account) {
                                        const acc = selectedNameOption.account;
                                        // Fill only name in supplierDetails
                                        setSupplierDetails?.({ ...supplierDetails, name: acc.accountHolderName });
                                        // Auto-fill all bank details from selected account
                                        setBankDetails({
                                            ...bankDetails,
                                            acNo: acc.accountNumber,
                                            bank: acc.bankName,
                                            branch: acc.branchName,
                                            ifscCode: acc.ifscCode,
                                        });
                                    } else {
                                        // Custom input - extract just the name part if it contains __
                                        const nameOnly = value.includes('__') ? value.split('__')[0] : value;
                                        setSupplierDetails?.({ ...supplierDetails, name: nameOnly });
                                    }
                                } else {
                                    setSupplierDetails?.({ ...supplierDetails, name: '' });
                                }
                            }}
                            placeholder="Select or enter name"
                            allowCustomInput={true}
                        />
                    </div>
                    <div className="space-y-0.5">
                        <Label htmlFor="rtgsBank" className="text-[10px]">Bank</Label>
                        <CustomDropdown id="rtgsBank" options={bankOptions} value={bankDetails.bank} onChange={handleBankSelect} onAdd={(newBank) => { addBank(newBank); handleBankSelect(newBank); }} placeholder="Select or add bank" />
                    </div>
                </div>
                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-0.5">
                        <Label htmlFor="rtgsBranch" className="text-[10px]">Branch</Label>
                        <CustomDropdown id="rtgsBranch" options={availableBranchOptions} value={bankDetails.branch} onChange={handleBranchSelect} onAdd={handleAddBranch} placeholder="Select or add branch"/>
                    </div>
                    <div className="space-y-0.5">
                        <Label htmlFor="rtgsIfsc" className="text-[10px]">IFSC</Label>
                        <Input id="rtgsIfsc" name="rtgsIfsc" value={bankDetails.ifscCode} onChange={e => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase()})} onBlur={handleIfscBlur} className="h-7 text-[10px] font-mono uppercase"/>
                    </div>
                </div>
                {/* Row 3 */}
                <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-0.5">
                        <Label htmlFor="rtgsAccountNumber" className="text-[10px]">A/C No.</Label>
                        <CustomDropdown
                            id="rtgsAccountNumber"
                            options={React.useMemo(() => {
                                if (!Array.isArray(filteredBankAccounts)) return [];
                                return filteredBankAccounts.map((acc: BankAccount) => ({
                                    value: acc.accountNumber,
                                    label: acc.accountNumber
                                }));
                            }, [filteredBankAccounts])}
                            value={bankDetails.acNo || ''}
                            onChange={async (value) => {
                                if (value) {
                                    const selectedAccount = filteredBankAccounts.find((acc: BankAccount) => acc.accountNumber === value);
                                    if (selectedAccount) {
                                        // Auto-fill all bank details from selected account
                                        setBankDetails({
                                            ...bankDetails,
                                            acNo: selectedAccount.accountNumber,
                                            bank: selectedAccount.bankName,
                                            branch: selectedAccount.branchName,
                                            ifscCode: selectedAccount.ifscCode,
                                        });
                                        // Also update name if not set
                                        if (!supplierDetails.name && selectedAccount.accountHolderName) {
                                            setSupplierDetails?.({ ...supplierDetails, name: selectedAccount.accountHolderName });
                                        }
                                    } else {
                                        // Custom input - check if it's a new account number
                                        // If bank, branch, IFSC are filled, save to supplier bank accounts
                                        if (bankDetails.bank && bankDetails.branch && bankDetails.ifscCode && supplierDetails.name) {
                                            try {
                                                // Check if account already exists
                                                const exists = bankAccounts.some((acc: BankAccount) => acc.accountNumber === value);
                                                if (!exists) {
                                                    await addSupplierBankAccount({
                                                        accountHolderName: supplierDetails.name,
                                                        accountNumber: value,
                                                        bankName: bankDetails.bank,
                                                        ifscCode: bankDetails.ifscCode,
                                                        branchName: bankDetails.branch,
                                                        accountType: 'Other' as const,
                                                    });
                                                    toast({
                                                        title: "Account Saved",
                                                        description: "New supplier bank account has been saved",
                                                    });
                                                }
                                            } catch (error: unknown) {

                                                // Don't show error toast, just continue
                                            }
                                        }
                                        // Set account number
                                        setBankDetails({...bankDetails, acNo: value});
                                    }
                                } else {
                                    setBankDetails({...bankDetails, acNo: ''});
                                }
                            }}
                            placeholder="Select or enter account number"
                            allowCustomInput={true}
                        />
                    </div>
                    {/* Check No. field removed - will be filled from RTGS Report */}
                </div>
            </div>
        </div>
    );
};

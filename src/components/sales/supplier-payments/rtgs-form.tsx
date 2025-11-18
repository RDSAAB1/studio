
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

export const RtgsForm = (props: any) => {
    const { toast } = useToast();
    const {
        bankDetails, setBankDetails,
        checkNo, setCheckNo,
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
            console.log('RtgsForm: banks is not an array', typeof banks, banks);
            return [];
        }
        if (banks.length === 0) {
            console.log('RtgsForm: banks array is empty');
        }
        const options = banks
            .filter(bank => bank && (bank.name || bank.id)) // Filter out invalid banks
            .map((bank: any) => ({
                value: bank.name || bank.id || '',
                label: toTitleCase(bank.name || bank.id || '')
            }))
            .filter(opt => opt.value && opt.label); // Filter out invalid options
        console.log('RtgsForm: bankOptions created', options.length, 'options from', banks.length, 'banks');
        if (options.length === 0 && banks.length > 0) {
            console.warn('RtgsForm: No valid bank options created, sample bank:', banks[0]);
        }
        return options;
    }, [banks]);

    const availableBranchOptions = React.useMemo(() => {
        if (!bankDetails.bank || !bankDetails.bank.trim()) return [];
        if (!Array.isArray(bankBranches)) return [];
        const uniqueBranches = new Map<string, { value: string; label: string }>();
        const selectedBankName = (bankDetails.bank || '').trim().toLowerCase();
        const matchingBranches = bankBranches.filter((branch: any) => {
            const branchBankName = (branch.bankName || '').trim().toLowerCase();
            return branchBankName === selectedBankName;
        });
        matchingBranches.forEach((branch: any) => {
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
            filtered = filtered.filter((acc: any) => {
                const accBankName = (acc.bankName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const matches = accBankName === selectedBank;
                return matches;
            });
        }
        
        // Filter by branch if selected (case-insensitive comparison with normalization)
        if (bankDetails.branch) {
            const selectedBranch = bankDetails.branch.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: any) => {
                const accBranchName = (acc.branchName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                const matches = accBranchName === selectedBranch;
                return matches;
            });
        }
        
        // If filtering results in empty list, show all accounts (fallback)
        // This helps debug the issue
        if (filtered.length === 0 && (bankDetails.bank || bankDetails.branch)) {
            console.log('No accounts match filter:', {
                bank: bankDetails.bank,
                branch: bankDetails.branch,
                totalAccounts: bankAccounts.length,
                sampleAccount: bankAccounts[0]
            });
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
            filtered = filtered.filter((acc: any) => {
                const accBankName = (acc.bankName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBankName === selectedBank;
            });
        }
        
        // Filter by branch if selected (case-insensitive comparison with normalization)
        if (bankDetails.branch) {
            const selectedBranch = bankDetails.branch.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: any) => {
                const accBranchName = (acc.branchName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBranchName === selectedBranch;
            });
        }
        
        return filtered.map((acc: any) => {
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
                    <CustomDropdown
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
                    <CustomDropdown
                        options={React.useMemo(() => {
                            if (!Array.isArray(filteredBankAccounts)) return [];
                            return filteredBankAccounts.map((acc: any) => ({
                                value: acc.accountNumber,
                                label: acc.accountNumber
                            }));
                        }, [filteredBankAccounts])}
                        value={bankDetails.acNo || ''}
                        onChange={async (value) => {
                            if (value) {
                                const selectedAccount = filteredBankAccounts.find((acc: any) => acc.accountNumber === value);
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
                                            const exists = bankAccounts.some((acc: any) => acc.accountNumber === value);
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
                                        } catch (error: any) {
                                            console.error('Error saving supplier bank account:', error);
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
                 <div className="space-y-1">
                    <Label className="text-xs">Check No.</Label>
                    <Input value={checkNo} onChange={e => setCheckNo(e.target.value)} onBlur={formatCheckNo} className="h-8 text-xs"/>
                </div>
            </div>
        </div>
    );
};

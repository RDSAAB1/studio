"use client";

import React from 'react';
import { toTitleCase } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Loader2 } from "lucide-react";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { addBank } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

export const RtgsFormOutsider = (props: any) => {
    const { toast } = useToast();
    const {
        bankDetails, setBankDetails,
        setIsBankSettingsOpen,
        supplierDetails = {}, setSupplierDetails,
        rtgsAmount = 0, setRtgsAmount,
        handleProcessPayment,
        isProcessing = false,
        bankAccounts = [],
        banks: propsBanks,
        bankBranches: propsBankBranches,
    } = props;
    
    const banks = propsBanks !== undefined ? (Array.isArray(propsBanks) ? propsBanks : []) : [];
    const bankBranches = propsBankBranches !== undefined ? (Array.isArray(propsBankBranches) ? propsBankBranches : []) : [];
    
    const bankOptions = React.useMemo(() => {
        if (!Array.isArray(banks)) return [];
        return banks
            .filter(bank => bank && (bank.name || bank.id))
            .map((bank: any) => ({
                value: bank.name || bank.id || '',
                label: toTitleCase(bank.name || bank.id || '')
            }))
            .filter(opt => opt.value && opt.label);
    }, [banks]);

    // Build name options from supplier bank accounts (same style as supplier RTGS)
    const nameOptions = React.useMemo(() => {
        if (!Array.isArray(bankAccounts)) return [];

        // Unique by accountNumber + accountHolderName to avoid duplicates
        const seen = new Set<string>();

        return bankAccounts
            .filter((acc: any) => acc && (acc.accountHolderName || acc.accountNumber))
            .map((acc: any) => {
                const holderName = acc.accountHolderName || '';
                const bankName = acc.bankName || '';
                const branchName = acc.branchName || '';
                const accNo = acc.accountNumber || '';

                const key = `${holderName}__${accNo}`;
                if (seen.has(key)) return null;
                seen.add(key);

                const mainName = holderName || accNo;

                // List में detail दिखे (name | bank - branch | A/C No), लेकिन select के बाद सिर्फ name दिखे
                const parts: string[] = [mainName];
                const bankBranch = [bankName, branchName].filter(Boolean).join(" - ");
                if (bankBranch) parts.push(bankBranch);
                if (accNo) parts.push(accNo);
                const detailedLabel = parts.join(" | ");

                return {
                    name: holderName,
                    value: `${mainName}__${accNo}`,
                    label: detailedLabel,     // dropdown list text
                    displayValue: mainName,   // input में दिखने वाला text (sirf name)
                    account: acc,
                };
            })
            .filter(Boolean) as {
                name: string;
                value: string;
                label: string;
                displayValue: string;
                account: any;
            }[];
    }, [bankAccounts]);

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
        
        if (bankDetails.bank) {
            const selectedBank = bankDetails.bank.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: any) => {
                const accBankName = (acc.bankName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBankName === selectedBank;
            });
        }
        
        if (bankDetails.branch) {
            const selectedBranch = bankDetails.branch.trim().toLowerCase().replace(/\s+/g, ' ');
            filtered = filtered.filter((acc: any) => {
                const accBranchName = (acc.branchName || '').trim().toLowerCase().replace(/\s+/g, ' ');
                return accBranchName === selectedBranch;
            });
        }
        
        return filtered;
    }, [bankAccounts, bankDetails.bank, bankDetails.branch]);

    const handleBankSelect = (bankName: string | null) => {
        setBankDetails({
            ...bankDetails,
            bank: bankName || '',
            branch: '',
            ifscCode: '',
            acNo: ''
        });
    };

    const handleBranchSelect = (branchName: string | null) => {
        const selectedBranch = bankBranches.find((b: any) => b.bankName === bankDetails.bank && b.branchName === branchName);
        setBankDetails((prev: any) => ({
            ...prev,
            branch: branchName || '',
            ifscCode: selectedBranch ? selectedBranch.ifscCode : prev.ifscCode,
            acNo: ''
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

    const handleAccountSelect = (accountNumber: string | null) => {
        if (accountNumber) {
            const selectedAccount = filteredBankAccounts.find((acc: any) => acc.accountNumber === accountNumber);
            if (selectedAccount) {
                setBankDetails({
                    ...bankDetails,
                    acNo: selectedAccount.accountNumber,
                    bank: selectedAccount.bankName,
                    branch: selectedAccount.branchName,
                    ifscCode: selectedAccount.ifscCode,
                });
                // If name is empty, fill from account
                if (!supplierDetails.name && selectedAccount.accountHolderName) {
                    setSupplierDetails?.({ ...supplierDetails, name: selectedAccount.accountHolderName });
                }
            } else {
                setBankDetails({ ...bankDetails, acNo: accountNumber });
            }
        } else {
            setBankDetails({ ...bankDetails, acNo: '' });
        }
    };

    return (
        <div className="space-y-2 text-[10px]">
            <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[11px] font-semibold">Bank Details</CardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsBankSettingsOpen(true)}>
                            <Settings className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                    {/* Row 1: A/C Holder, Bank, Branch */}
                    <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="space-y-0.5">
                            <Label className="text-[10px]">A/C Holder</Label>
                            <CustomDropdown
                                options={nameOptions.map(opt => ({
                                    value: opt.value,
                                    label: opt.label,
                                    displayValue: opt.displayValue,
                                }))}
                                value={(() => {
                                    if (!supplierDetails.name && !bankDetails.acNo) return '';
                                    // Try to find matching option by name + acNo
                                    const match = nameOptions.find(opt =>
                                        opt.name === supplierDetails.name &&
                                        opt.account?.accountNumber === bankDetails.acNo
                                    );
                                    if (match) return match.value;
                                    // Fallback: just show name
                                    return supplierDetails.name || '';
                                })()}
                                onChange={(value) => {
                                    if (value) {
                                        const selected = nameOptions.find(opt => opt.value === value);
                                        if (selected && selected.account) {
                                            const acc = selected.account;
                                            // Fill name
                                            setSupplierDetails?.({
                                                ...supplierDetails,
                                                name: acc.accountHolderName || supplierDetails.name || ''
                                            });
                                            // Auto-fill bank details
                                            setBankDetails({
                                                ...bankDetails,
                                                acNo: acc.accountNumber || '',
                                                bank: acc.bankName || '',
                                                branch: acc.branchName || '',
                                                ifscCode: acc.ifscCode || '',
                                            });
                                        } else {
                                            // Custom text: extract name before "__" if present
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
                            <Label className="text-[10px]">Bank</Label>
                            <CustomDropdown
                                options={bankOptions}
                                value={bankDetails.bank}
                                onChange={handleBankSelect}
                                onAdd={(newBank) => {
                                    addBank(newBank);
                                    handleBankSelect(newBank);
                                }}
                                placeholder="Select or add bank"
                            />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-[10px]">Branch</Label>
                            <CustomDropdown
                                options={availableBranchOptions}
                                value={bankDetails.branch}
                                onChange={handleBranchSelect}
                                onAdd={handleAddBranch}
                                placeholder="Select or add branch"
                            />
                        </div>
                    </div>
                    {/* Row 2: IFSC, A/C No., Amount */}
                    <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="space-y-0.5">
                            <Label className="text-[10px]">IFSC</Label>
                            <Input
                                value={bankDetails.ifscCode || ''}
                                onChange={e => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
                                onBlur={handleIfscBlur}
                                className="h-7 text-[10px] font-mono uppercase"
                                placeholder="Enter IFSC code"
                            />
                        </div>
                    <div className="space-y-0.5">
                        <Label className="text-[10px]">A/C No.</Label>
                        <CustomDropdown
                            options={React.useMemo(() => {
                                if (!Array.isArray(filteredBankAccounts)) return [];
                                return filteredBankAccounts.map((acc: any) => ({
                                    value: acc.accountNumber,
                                    label: acc.accountNumber
                                }));
                            }, [filteredBankAccounts])}
                            value={bankDetails.acNo || ''}
                            onChange={handleAccountSelect}
                            placeholder="Select or enter account number"
                            allowCustomInput={true}
                        />
                    </div>
                    <div className="space-y-0.5">
                        <Label className="text-[10px]">Amount</Label>
                        <Input
                            type="number"
                            value={rtgsAmount || ''}
                            onChange={(e) => setRtgsAmount?.(Number(e.target.value) || 0)}
                            placeholder="Enter amount"
                            className="h-7 text-[10px]"
                            min="0"
                            step="0.01"
                        />
                        </div>
                    </div>
                    {/* Row 5: Finalize Button */}
                    <div className="pt-1">
                        <Button
                            onClick={handleProcessPayment}
                            disabled={isProcessing || !rtgsAmount || rtgsAmount <= 0 || !supplierDetails?.name}
                            className="w-full h-8 text-[11px] font-semibold"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Finalize"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


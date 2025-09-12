
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { bankNames } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomDropdown } from '@/components/ui/custom-dropdown';

export const BankSettingsDialog = ({ isOpen, onOpenChange, banks, onAddBank, onAddBranch }: any) => {
    const [newBankName, setNewBankName] = useState('');
    const [newBranchData, setNewBranchData] = useState({ bankName: '', branchName: '', ifscCode: '' });

    const handleAddNewBank = () => {
        if (!newBankName.trim()) return;
        onAddBank(newBankName);
        setNewBankName('');
    };

    const handleAddNewBranch = () => {
        if (!newBranchData.bankName || !newBranchData.branchName || !newBranchData.ifscCode) return;
        onAddBranch(newBranchData);
        setNewBranchData({ bankName: '', branchName: '', ifscCode: '' });
    };
    
    const allBankOptions = [...bankNames, ...banks.map((b: any) => b.name)].sort().map(name => ({ value: name, label: name }));

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 flex flex-col">
                <DialogHeader className="p-6 pb-4 flex-shrink-0">
                    <DialogTitle>Bank Management</DialogTitle>
                    <DialogDescription>Add new banks and branches.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto px-6 scrollbar-hide">
                    <div className="space-y-6 py-4">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Add New Bank</CardTitle></CardHeader>
                            <CardContent className="flex flex-col sm:flex-row gap-2">
                                <Input placeholder="Enter new bank name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} />
                                <Button onClick={handleAddNewBank} className="w-full sm:w-auto shrink-0"><Plus className="mr-2 h-4 w-4" /> Add Bank</Button>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-base">Add New Branch</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Select Bank</Label>
                                    <CustomDropdown
                                        options={allBankOptions}
                                        value={newBranchData.bankName}
                                        onChange={(value) => setNewBranchData(prev => ({...prev, bankName: value || ''}))}
                                        placeholder="Select a bank"
                                        searchPlaceholder="Search banks..."
                                    />
                                </div>
                                <div className="space-y-1"><Label>Branch Name</Label><Input placeholder="Enter branch name" value={newBranchData.branchName} onChange={(e) => setNewBranchData(prev => ({...prev, branchName: e.target.value}))}/></div>
                                <div className="space-y-1"><Label>IFSC Code</Label><Input placeholder="Enter IFSC code" value={newBranchData.ifscCode} onChange={(e) => setNewBranchData(prev => ({...prev, ifscCode: e.target.value.toUpperCase()}))} className="uppercase"/></div>
                                <Button onClick={handleAddNewBranch} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

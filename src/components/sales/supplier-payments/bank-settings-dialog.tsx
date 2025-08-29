
"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

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

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Bank Management</DialogTitle><DialogDescription>Add new banks and branches.</DialogDescription></DialogHeader>
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Add New Bank</CardTitle></CardHeader>
                        <CardContent className="flex gap-2"><Input placeholder="Enter new bank name" value={newBankName} onChange={(e) => setNewBankName(e.target.value)} /><Button onClick={handleAddNewBank}><Plus className="mr-2 h-4 w-4" /> Add Bank</Button></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-base">Add New Branch</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1"><Label>Select Bank</Label><Select value={newBranchData.bankName} onValueChange={(value) => setNewBranchData(prev => ({...prev, bankName: value}))}><SelectTrigger><SelectValue placeholder="Select a bank" /></SelectTrigger><SelectContent>{banks.map((bank: any) => <SelectItem key={bank.name} value={bank.name}>{bank.name}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1"><Label>Branch Name</Label><Input placeholder="Enter branch name" value={newBranchData.branchName} onChange={(e) => setNewBranchData(prev => ({...prev, branchName: e.target.value}))}/></div>
                            <div className="space-y-1"><Label>IFSC Code</Label><Input placeholder="Enter IFSC code" value={newBranchData.ifscCode} onChange={(e) => setNewBranchData(prev => ({...prev, ifscCode: e.target.value}))}/></div>
                            <Button onClick={handleAddNewBranch}><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

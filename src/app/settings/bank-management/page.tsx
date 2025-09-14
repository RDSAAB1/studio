
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { getBanksRealtime, getBankBranchesRealtime, addBank, addBankBranch, deleteBankBranch, updateBankBranch } from '@/lib/firestore';
import { Bank, BankBranch } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit, Trash2, Upload, Download, Filter } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function BankManagementPage() {
    const { toast } = useToast();
    const [banks, setBanks] = useState<Bank[]>([]);
    const [branches, setBranches] = useState<BankBranch[]>([]);
    const [loading, setLoading] = useState(true);

    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [newBankName, setNewBankName] = useState('');

    const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
    const [currentBranch, setCurrentBranch] = useState<Partial<BankBranch>>({});
    
    const [filterBank, setFilterBank] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubBanks = getBanksRealtime(setBanks, (err) => toast({ title: "Error", description: "Failed to load banks.", variant: "destructive" }));
        const unsubBranches = getBankBranchesRealtime((data) => {
            setBranches(data);
            setLoading(false);
        }, (err) => {
            toast({ title: "Error", description: "Failed to load branches.", variant: "destructive" });
            setLoading(false);
        });
        return () => { unsubBanks(); unsubBranches(); };
    }, [toast]);

    const filteredBranches = useMemo(() => {
        return branches.filter(branch => {
            const bankMatch = !filterBank || filterBank === 'all' || branch.bankName === filterBank;
            const searchMatch = !searchTerm || 
                branch.branchName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                branch.ifscCode.toLowerCase().includes(searchTerm.toLowerCase());
            return bankMatch && searchMatch;
        });
    }, [branches, filterBank, searchTerm]);

    const handleAddBank = async () => {
        if (!newBankName.trim()) return;
        if (banks.some(b => b.name.toLowerCase() === newBankName.trim().toLowerCase())) {
            toast({ title: "Duplicate Bank", description: "This bank name already exists.", variant: "destructive" });
            return;
        }
        await addBank(newBankName.trim());
        toast({ title: "Bank Added", variant: "success" });
        setNewBankName('');
        setIsBankDialogOpen(false);
    };
    
    const handleDeleteBank = async (id: string, name: string) => {
        if(branches.some(b => b.bankName === name)) {
            toast({ title: "Cannot Delete", description: "Delete all branches for this bank first.", variant: "destructive" });
            return;
        }
        //await deleteBank(id);
        toast({ title: "Bank Deleted", variant: "success" });
    }

    const handleSaveBranch = async () => {
        if (!currentBranch.bankName || !currentBranch.branchName || !currentBranch.ifscCode) {
            toast({ title: "All branch fields are required.", variant: "destructive" });
            return;
        }
        
        const branchExists = branches.some(b => b.ifscCode.toLowerCase() === currentBranch.ifscCode?.toLowerCase() && b.id !== currentBranch.id);
        if(branchExists) {
            toast({ title: "Duplicate Branch", description: "A branch with this IFSC code already exists.", variant: "destructive" });
            return;
        }

        if (currentBranch.id) {
            await updateBankBranch(currentBranch.id, currentBranch);
            toast({ title: "Branch Updated", variant: "success" });
        } else {
            await addBankBranch(currentBranch as Omit<BankBranch, 'id'>);
            toast({ title: "Branch Added", variant: "success" });
        }
        setCurrentBranch({});
        setIsBranchDialogOpen(false);
    };
    
    const handleDeleteBranch = async (id: string) => {
        await deleteBankBranch(id);
        toast({ title: "Branch Deleted", variant: "success" });
    };

    const handleExport = () => {
        const dataToExport = branches.map(b => ({
            BankName: b.bankName,
            BranchName: b.branchName,
            IFSCCode: b.ifscCode,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Banks and Branches");
        XLSX.writeFile(workbook, "BankData.xlsx");
        toast({ title: "Data Exported", variant: "success" });
    }
    
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                let addedBanks = 0;
                let addedBranches = 0;

                for (const item of json) {
                    const bankName = item.BankName?.trim();
                    const branchName = item.BranchName?.trim();
                    const ifscCode = item.IFSCCode?.trim().toUpperCase();

                    if(bankName && !banks.some(b => b.name.toLowerCase() === bankName.toLowerCase())) {
                       await addBank(bankName);
                       addedBanks++;
                    }
                    if(bankName && branchName && ifscCode && !branches.some(b => b.ifscCode.toLowerCase() === ifscCode.toLowerCase())) {
                        await addBankBranch({ bankName, branchName, ifscCode });
                        addedBranches++;
                    }
                }
                toast({ title: "Import Complete", description: `${addedBanks} new banks and ${addedBranches} new branches imported.`, variant: "success"});
            } catch (error) {
                toast({ title: "Import Failed", description: "Please check the file format.", variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Bank Management</CardTitle>
                        <CardDescription>Manage all banks and their branches here.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                         <Button asChild variant="outline">
                            <label htmlFor="import-file" className="cursor-pointer"><Upload className="mr-2 h-4 w-4"/> Import</label>
                         </Button>
                         <Input id="import-file" type="file" className="hidden" onChange={handleImport} accept=".xlsx, .xls" />
                        <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4"/> Export All</Button>
                        <Button onClick={() => setIsBankDialogOpen(true)}><Plus className="mr-2 h-4 w-4"/> Add Bank</Button>
                        <Button onClick={() => { setCurrentBranch({}); setIsBranchDialogOpen(true); }}><Plus className="mr-2 h-4 w-4"/> Add Branch</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex-1">
                            <Label>Filter by Bank</Label>
                            <Select value={filterBank} onValueChange={(value) => setFilterBank(value)}>
                                <SelectTrigger><SelectValue placeholder="All Banks" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Banks</SelectItem>
                                    {banks.map(bank => (
                                        <SelectItem key={bank.id} value={bank.name}>{bank.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                             <Label>Search Branch / IFSC</Label>
                             <Input placeholder="Type to search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <ScrollArea className="h-[60vh] border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted">
                                <TableRow>
                                    <TableHead>Bank Name</TableHead>
                                    <TableHead>Branch Name</TableHead>
                                    <TableHead>IFSC Code</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBranches.map(branch => (
                                    <TableRow key={branch.id}>
                                        <TableCell>{branch.bankName}</TableCell>
                                        <TableCell>{branch.branchName}</TableCell>
                                        <TableCell className="font-mono">{branch.ifscCode}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCurrentBranch(branch); setIsBranchDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Delete Branch?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {branch.branchName} branch?</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBranch(branch.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Bank</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>Bank Name</Label>
                        <Input value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="Enter full bank name" />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button><Button onClick={handleAddBank}>Save Bank</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{currentBranch.id ? 'Edit' : 'Add'} Branch</DialogTitle></DialogHeader>
                     <div className="py-4 space-y-4">
                        <div className="space-y-1">
                            <Label>Bank</Label>
                             <Select value={currentBranch.bankName || ''} onValueChange={(value) => setCurrentBranch(prev => ({...prev, bankName: value}))}>
                                <SelectTrigger><SelectValue placeholder="Select a bank" /></SelectTrigger>
                                <SelectContent>
                                    {banks.map(bank => (
                                        <SelectItem key={bank.id} value={bank.name}>{bank.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Branch Name</Label>
                            <Input value={currentBranch.branchName || ''} onChange={(e) => setCurrentBranch(prev => ({...prev, branchName: e.target.value}))} placeholder="Enter branch name"/>
                        </div>
                        <div className="space-y-1">
                            <Label>IFSC Code</Label>
                            <Input value={currentBranch.ifscCode || ''} onChange={(e) => setCurrentBranch(prev => ({...prev, ifscCode: e.target.value.toUpperCase()}))} placeholder="Enter IFSC code" className="uppercase" />
                        </div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsBranchDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveBranch}>Save Branch</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

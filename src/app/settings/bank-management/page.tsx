

"use client";

import { useState, useEffect, useMemo } from 'react';
import { addBank, addBankBranch, deleteBankBranch, updateBankBranch, getBanksRealtime, getBankBranchesRealtime } from '@/lib/firestore';
import { Bank, BankBranch } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Edit, Trash2, Upload, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SupplierBankAccountsPage from '@/app/sales/supplier-bank-accounts/page';
import { toTitleCase } from '@/lib/utils';


export default function BankManagementPage() {
    const { toast } = useToast();
    const [banks, setBanks] = useState<Bank[]>([]);
    const [branches, setBranches] = useState<BankBranch[]>([]);
    const [loading, setLoading] = useState(true);

    const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
    const [newBankName, setNewBankName] = useState('');

    const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
    const [currentBranch, setCurrentBranch] = useState<Partial<BankBranch>>({});
    
    const [filterBank, setFilterBank] = useState<string | null>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubBanks = getBanksRealtime(setBanks, );
        const unsubBranches = getBankBranchesRealtime(setBranches, );

        return () => {
            unsubBanks();
            unsubBranches();
        }
    }, []);

    useEffect(() => {
        if(banks !== undefined && branches !== undefined) {
            setLoading(false);
        }
    }, [banks, branches]);

    const bankOptions = useMemo(() => [
        { value: 'all', label: 'All Banks' },
        ...Array.from(new Set(banks.map(bank => bank.name))).map(name => ({ value: name, label: name }))
    ], [banks]);

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

        try {
            if (currentBranch.id) {
                await updateBankBranch(currentBranch.id, currentBranch);
                toast({ title: "Branch Updated", variant: "success" });
            } else {
                // The duplication check is now in the `addBankBranch` function itself.
                await addBankBranch(currentBranch as Omit<BankBranch, 'id'>);
                toast({ title: "Branch Added", variant: "success" });
            }
            setCurrentBranch({});
            setIsBranchDialogOpen(false);
        } catch (error: any) {

            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        }
    };

    const handleBranchNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentBranch(prev => ({...prev, branchName: toTitleCase(e.target.value)}));
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
        <div className="space-y-3">
            <Tabs defaultValue="branches" className="w-full space-y-3">
                <TabsList className="h-8">
                    <TabsTrigger value="branches" className="h-7 px-3 text-xs">
                        Banks & Branches
                    </TabsTrigger>
                    <TabsTrigger value="accounts" className="h-7 px-3 text-xs">
                        Bank Accounts
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="branches" className="space-y-3">
                    <Card>
                        <CardContent className="pt-2 pb-2">
                            <div className="flex flex-wrap items-end gap-2">
                                {/* Left: action buttons */}
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                    >
                                        <label htmlFor="import-file" className="cursor-pointer flex items-center gap-1">
                                            <Upload className="h-3.5 w-3.5" />
                                            <span>Import</span>
                                        </label>
                                    </Button>
                                    <Input
                                        id="import-file"
                                        type="file"
                                        className="hidden"
                                        onChange={handleImport}
                                        accept=".xlsx, .xls"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExport}
                                        className="h-8 px-3 text-xs"
                                    >
                                        <Download className="mr-1.5 h-3.5 w-3.5" />
                                        Export All
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setIsBankDialogOpen(true)}
                                        className="h-8 px-3 text-xs"
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Add Bank
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            setCurrentBranch({});
                                            setIsBranchDialogOpen(true);
                                        }}
                                        className="h-8 px-3 text-xs"
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                        Add Branch
                                    </Button>
                                </div>

                                {/* Right: filter + search */}
                                <div className="flex flex-1 items-end justify-end gap-2 min-w-[220px]">
                                    <CustomDropdown
                                        options={bankOptions}
                                        value={filterBank}
                                        onChange={(value) => setFilterBank(value || 'all')}
                                        placeholder="All Banks"
                                        inputClassName="h-8 text-xs"
                                    />
                                    <Input
                                        placeholder="Search Branch / IFSC"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 text-xs max-w-[220px]"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[calc(100vh-350px)]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted z-10">
                                        <TableRow>
                                            <TableHead className="w-[40%]">Bank Name</TableHead>
                                            <TableHead className="w-[30%]">Branch Name</TableHead>
                                            <TableHead className="w-[20%]">IFSC Code</TableHead>
                                            <TableHead className="text-right w-[10%]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBranches.map(branch => (
                                            <TableRow key={branch.id}>
                                                <TableCell className="truncate">{branch.bankName}</TableCell>
                                                <TableCell className="truncate">{branch.branchName}</TableCell>
                                                <TableCell className="font-mono truncate">{branch.ifscCode}</TableCell>
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
                </TabsContent>

                <TabsContent value="accounts" className="space-y-3">
                    {/* Embedded supplier bank accounts manager */}
                    <SupplierBankAccountsPage embedded />
                </TabsContent>
            </Tabs>
            
            <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Add New Bank</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>Bank Name</Label>
                        <Input value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="Enter full bank name" />
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setIsBankDialogOpen(false)}>Cancel</Button><Button onClick={handleAddBank}>Save Bank</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{currentBranch.id ? 'Edit' : 'Add'} Branch</DialogTitle></DialogHeader>
                     <div className="py-4 space-y-4">
                        <div className="space-y-1">
                            <Label>Bank</Label>
                             <CustomDropdown
                                options={banks.map(bank => ({ value: bank.name, label: bank.name }))}
                                value={currentBranch.bankName || null}
                                onChange={(value) => setCurrentBranch(prev => ({...prev, bankName: value || ''}))}
                                placeholder="Select a bank"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Branch Name</Label>
                            <Input value={currentBranch.branchName || ''} onChange={handleBranchNameChange} placeholder="Enter branch name"/>
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

    
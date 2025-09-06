"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, orderBy, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Banknote, Calendar, Percent, Landmark } from 'lucide-react';
import type { Loan } from '@/lib/definitions';
import { format } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const formSchema = {
    loanName: "",
    lenderName: "",
    loanType: "BankLoan",
    totalAmount: 0,
    amountPaid: 0,
    interestRate: 0,
    tenureMonths: 0,
    emiAmount: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
};

export default function LoanManagementClient() {
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentLoan, setCurrentLoan] = useState<Partial<Loan> | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const q = query(collection(db, "loans"), orderBy("startDate", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loansData: Loan[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
            setLoans(loansData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching loans: ", error);
            toast({ title: "Failed to load loan data", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (!currentLoan) return;
        const { name, value } = e.target;
        setCurrentLoan(prev => ({ ...prev, [name]: name === 'loanType' ? value : toTitleCase(value) }));
    };
    
    const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentLoan) return;
        const { name, value } = e.target;
        setCurrentLoan(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }

    const handleSubmit = async () => {
        if (!currentLoan || !currentLoan.loanName || !currentLoan.lenderName) {
            toast({ title: "Loan Name and Lender Name are required", variant: "destructive" });
            return;
        }

        const loanData = {
            ...currentLoan,
            remainingAmount: (currentLoan.totalAmount || 0) - (currentLoan.amountPaid || 0)
        };

        try {
            if (currentLoan.id) {
                const loanRef = doc(db, "loans", currentLoan.id);
                await setDoc(loanRef, loanData, { merge: true });
                toast({ title: "Loan updated successfully", variant: "success" });
            } else {
                await addDoc(collection(db, "loans"), loanData);
                toast({ title: "Loan added successfully", variant: "success" });
            }
            closeDialog();
        } catch (error) {
            console.error("Error saving loan: ", error);
            toast({ title: `Failed to ${currentLoan.id ? 'update' : 'add'} loan`, variant: "destructive" });
        }
    };

    const handleDeleteLoan = async (id: string) => {
        if (!id) return;
        try {
            await deleteDoc(doc(db, "loans", id));
            toast({ title: "Loan deleted successfully", variant: "success" });
        } catch (error) {
            console.error("Error deleting loan: ", error);
            toast({ title: "Failed to delete loan", variant: "destructive" });
        }
    };

    const openDialogForAdd = () => {
        setCurrentLoan(formSchema);
        setIsDialogOpen(true);
    };

    const openDialogForEdit = (loan: Loan) => {
        setCurrentLoan(loan);
        setIsDialogOpen(true);
    };
    
    const closeDialog = () => {
        setIsDialogOpen(false);
        setCurrentLoan(null);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl font-semibold">Loan Management</CardTitle>
                        <CardDescription>Track all your bank and external loans here.</CardDescription>
                    </div>
                    <Button onClick={openDialogForAdd}><PlusCircle className="mr-2 h-4 w-4"/>Add New Loan</Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Loan / Lender</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Total Amount</TableHead>
                                        <TableHead>Remaining</TableHead>
                                        <TableHead>Interest Rate</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {loans.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell>
                                            <div className="font-medium">{loan.loanName}</div>
                                            <div className="text-xs text-muted-foreground">{loan.lenderName}</div>
                                        </TableCell>
                                        <TableCell>{toTitleCase(loan.loanType.replace('Loan', ' Loan'))}</TableCell>
                                        <TableCell>{formatCurrency(loan.totalAmount)}</TableCell>
                                        <TableCell className="font-semibold text-destructive">{formatCurrency(loan.remainingAmount || 0)}</TableCell>
                                        <TableCell>{loan.interestRate}%</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 mr-2" onClick={() => openDialogForEdit(loan)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLoan(loan.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No loans found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentLoan?.id ? 'Edit Loan' : 'Add New Loan'}</DialogTitle>
                        <DialogDescription>Fill in the details of the loan below.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="loanName" className="text-right">Loan Name</Label>
                            <Input id="loanName" name="loanName" value={currentLoan?.loanName || ''} onChange={handleInputChange} className="col-span-3" placeholder="e.g., HDFC Car Loan"/>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="lenderName" className="text-right">Lender Name</Label>
                            <Input id="lenderName" name="lenderName" value={currentLoan?.lenderName || ''} onChange={handleInputChange} className="col-span-3" placeholder="e.g., HDFC Bank / John Doe"/>
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Loan Type</Label>
                            <div className="col-span-3">
                               <Select name="loanType" value={currentLoan?.loanType || 'BankLoan'} onValueChange={(value) => setCurrentLoan(prev => ({...prev, loanType: value as 'BankLoan' | 'ExternalLoan'}))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="BankLoan">Bank Loan</SelectItem>
                                    <SelectItem value="ExternalLoan">External Loan</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="totalAmount" className="text-right">Total Amount</Label>
                            <Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleNumberInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amountPaid" className="text-right">Amount Paid</Label>
                            <Input id="amountPaid" name="amountPaid" type="number" value={currentLoan?.amountPaid || 0} onChange={handleNumberInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="interestRate" className="text-right">Interest Rate (%)</Label>
                            <Input id="interestRate" name="interestRate" type="number" value={currentLoan?.interestRate || 0} onChange={handleNumberInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="tenureMonths" className="text-right">Tenure (Months)</Label>
                            <Input id="tenureMonths" name="tenureMonths" type="number" value={currentLoan?.tenureMonths || 0} onChange={handleNumberInputChange} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="emiAmount" className="text-right">EMI Amount</Label>
                            <Input id="emiAmount" name="emiAmount" type="number" value={currentLoan?.emiAmount || 0} onChange={handleNumberInputChange} className="col-span-3" />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="startDate" className="text-right">Start Date</Label>
                            <Input id="startDate" name="startDate" type="date" value={currentLoan?.startDate || ''} onChange={(e) => setCurrentLoan(prev => ({...prev, startDate: e.target.value}))} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                        <Button onClick={handleSubmit}>{currentLoan?.id ? 'Save Changes' : 'Add Loan'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

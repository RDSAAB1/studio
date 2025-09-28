
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FundTransaction, Income, Expense, Loan, BankAccount, Customer, Payment } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CustomDropdown } from "@/components/ui/custom-dropdown";

import { PiggyBank, Landmark, HandCoins, PlusCircle, MinusCircle, DollarSign, Scale, ArrowLeftRight, Save, Banknote, Edit, Trash2, Home, Pen } from "lucide-react";
import { format, addMonths, differenceInMonths, parseISO, isValid } from "date-fns";

import { addFundTransaction, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getPaymentsRealtime, addLoan, updateLoan, deleteLoan, getLoansRealtime, getBankAccountsRealtime, updateFundTransaction, deleteFundTransaction, getSuppliersRealtime } from "@/lib/firestore";
import { cashBankFormSchemas, type TransferValues } from "./formSchemas.ts";
import { ScrollArea } from "@/components/ui/scroll-area";


const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
    <Card className="bg-card/60 backdrop-blur-sm border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
            <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const initialLoanFormState: Partial<Loan> = {
    loanName: "",
    loanType: "Product",
    lenderName: "",
    productName: "",
    totalAmount: 0,
    amountPaid: 0,
    emiAmount: 0,
    tenureMonths: 0,
    interestRate: 0,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    depositTo: "CashInHand",
    bankLoanType: "Fixed",
};

export default function CashBankClient() {
    
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    
    const [isClient, setIsClient] = useState(false);
    const [isLoanDialogOpen, setIsLoanDialogOpen] = useState(false);
    const [currentLoan, setCurrentLoan] = useState<Partial<Loan>>(initialLoanFormState);
    const [isFundTransactionDialogOpen, setIsFundTransactionDialogOpen] = useState(false);
    const [currentFundTransaction, setCurrentFundTransaction] = useState<Partial<FundTransaction> | null>(null);

    useEffect(() => {
        setIsClient(true);
        const unsubFundTransactions = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubIncomes = getIncomeRealtime(setIncomes, console.error);
        const unsubExpenses = getExpensesRealtime(setExpenses, console.error);
        const unsubPayments = getPaymentsRealtime(setPayments, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubBankAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);

        return () => {
            unsubFundTransactions();
            unsubIncomes();
            unsubExpenses();
            unsubPayments();
            unsubLoans();
            unsubBankAccounts();
            unsubSuppliers();
        };
    }, []);

    const allTransactions = useMemo(() => {
        const mappedPayments = payments.map(p => ({
            id: p.id,
            date: p.date,
            transactionType: 'Expense',
            category: 'Supplier Payments',
            subCategory: p.rtgsFor === 'Outsider' ? 'Outsider Payment' : 'Supplier Payment',
            amount: p.amount,
            payee: p.supplierName || 'N/A',
            description: p.notes || `Payment ${p.paymentId}`,
            paymentMethod: p.receiptType,
            status: 'Paid',
            isRecurring: false,
            bankAccountId: p.bankAccountId,
        }));
        return [...incomes, ...expenses, ...mappedPayments] as (Income | Expense)[];
    }, [incomes, expenses, payments]);

    const formSourcesAndDestinations = useMemo(() => {
        const accounts = bankAccounts.map(acc => ({
            value: acc.id,
            label: `${acc.accountHolderName} (...${acc.accountNumber.slice(-4)})`
        }));
        return [
            ...accounts,
            { value: 'CashInHand', label: 'Cash in Hand (Mill)' },
            { value: 'CashAtHome', label: 'Cash at Home' },
        ];
    }, [bankAccounts]);


    const transferForm = useForm<TransferValues>({ 
        resolver: zodResolver(cashBankFormSchemas.transferSchema), 
        defaultValues: { 
            amount: 0, 
            description: "",
            source: null,
            destination: null
        } 
    });
    
    const loansWithCalculatedRemaining = useMemo(() => {
        return loans.map(loan => {
            const paidTransactions = allTransactions.filter(t => t.loanId === loan.id && t.transactionType === 'Expense');
            const totalPaidTowardsPrincipal = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
            
            let accumulatedInterest = 0;
            const startDate = parseISO(loan.startDate);
            if (loan.loanType === 'Outsider' && loan.interestRate > 0 && isValid(startDate)) {
                const monthsPassed = differenceInMonths(new Date(), startDate);
                if (monthsPassed > 0) {
                    accumulatedInterest = (loan.totalAmount * (loan.interestRate / 100) * monthsPassed) / 12;
                }
            }

            const totalPaid = (loan.amountPaid || 0) + totalPaidTowardsPrincipal;
            const remainingAmount = loan.totalAmount + accumulatedInterest - totalPaid;
            return { ...loan, remainingAmount, amountPaid: totalPaid };
        });
    }, [loans, allTransactions]);

    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        bankAccounts.forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
        balances.set('CashAtHome', 0);

        fundTransactions.forEach(t => {
            if (balances.has(t.source)) {
                balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            }
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        allTransactions.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                if (t.transactionType === 'Income') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
                } else if (t.transactionType === 'Expense') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
                }
            }
        });
        
        const totalLoanLiabilities = loansWithCalculatedRemaining.reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount), 0);
        const totalSupplierDues = suppliers.reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0);
        const totalLiabilities = totalLoanLiabilities + totalSupplierDues;
        const totalAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        
        return { balances, totalAssets, totalLiabilities };
    }, [fundTransactions, allTransactions, loansWithCalculatedRemaining, bankAccounts, suppliers]);

    const handleAddFundTransaction = (transaction: Omit<FundTransaction, 'id' | 'date'>) => {
        return addFundTransaction(transaction)
            .then(() => {
                toast({ title: "Transaction recorded successfully", variant: "success" });
            })
            .catch((error) => {
                console.error("Error adding fund transaction:", error);
                toast({ title: "Failed to record transaction", variant: "destructive" });
                throw error; // Re-throw to handle in the caller
            });
    };

    const onTransferSubmit = (values: TransferValues) => {
        if (!values.source || !values.destination) {
            toast({ title: "Source and destination are required", variant: "destructive" });
            return;
        }

        if (values.source === values.destination) {
            toast({ title: "Source and destination cannot be the same", variant: "destructive" });
            return;
        }

        const transactionAmount = parseFloat(String(values.amount));
        if (isNaN(transactionAmount) || transactionAmount <= 0) {
            toast({ title: "Invalid amount", variant: "destructive" });
            return;
        }

        const availableBalance = financialState.balances.get(values.source) || 0;
        if (transactionAmount > availableBalance) {
             toast({ title: "Insufficient funds in the source account", variant: "destructive" });
            return;
        }
        
        handleAddFundTransaction({ 
            type: 'CashTransfer', 
            source: values.source, 
            destination: values.destination, 
            amount: transactionAmount, 
            description: values.description 
        })
          .then(() => transferForm.reset({ amount: 0, description: "", source: null, destination: null }));
    };


    const handleLoanInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!currentLoan) return;
        const { name, value } = e.target;
        setCurrentLoan(prev => ({ ...prev, [name]: value }));
    };
    
    const handleLoanNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!currentLoan) return;
        const { name, value } = e.target;
        setCurrentLoan(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
    
    useEffect(() => {
        if (currentLoan.loanType === 'Product' && currentLoan.totalAmount && currentLoan.amountPaid && currentLoan.emiAmount) {
            if(currentLoan.totalAmount > currentLoan.amountPaid && currentLoan.emiAmount > 0) {
                 const remainingAmount = currentLoan.totalAmount - currentLoan.amountPaid;
                 const tenure = Math.ceil(remainingAmount / currentLoan.emiAmount);
                 setCurrentLoan(prev => ({...prev, tenureMonths: tenure}));
            } else {
                 setCurrentLoan(prev => ({...prev, tenureMonths: 0}));
            }
        }
    }, [currentLoan.totalAmount, currentLoan.amountPaid, currentLoan.emiAmount, currentLoan.loanType]);

    const handleLoanSubmit = async () => {
        if (!currentLoan) return;
    
        const isNewLoan = !currentLoan.id;
    
        if (currentLoan.loanType === 'OwnerCapital') {
            const capitalInflowData: Omit<FundTransaction, 'id' | 'date'> = {
                type: 'CapitalInflow',
                source: 'OwnerCapital',
                destination: currentLoan.depositTo as any,
                amount: currentLoan.totalAmount || 0,
                description: `Owner's capital contribution`
            };
            try {
                await addFundTransaction(capitalInflowData);
                toast({ title: "Capital added successfully", variant: 'success' });
                setIsLoanDialogOpen(false);
            } catch (error) {
                toast({ title: "Failed to add capital", variant: "destructive" });
            }
            return;
        }
    
        let loanNameToSave = '';
        if (currentLoan.loanType === 'Product' && currentLoan.productName) {
            loanNameToSave = currentLoan.productName + ' Loan';
        } else if (currentLoan.loanType === 'Bank' && currentLoan.lenderName && currentLoan.bankLoanType) {
            loanNameToSave = `${currentLoan.lenderName} ${toTitleCase(currentLoan.bankLoanType)} Loan`;
        } else if (currentLoan.loanType === 'Outsider' && currentLoan.lenderName) {
            loanNameToSave = `Loan from ${currentLoan.lenderName}`;
        }
    
        if (currentLoan.loanType !== 'Product' && !loanNameToSave) {
            toast({ title: "Lender Name is required for this loan type", variant: "destructive" });
            return;
        }
    
        const loanData: Partial<Loan> = {
            ...currentLoan,
            loanName: loanNameToSave,
            remainingAmount: (currentLoan.totalAmount || 0) - (currentLoan.amountPaid || 0),
            nextEmiDueDate: currentLoan.startDate ? format(addMonths(new Date(currentLoan.startDate), 1), 'yyyy-MM-dd') : undefined,
        };
    
        try {
            if (loanData.id) {
                await updateLoan(loanData.id, loanData);
                toast({ title: "Loan updated successfully", variant: "success" });
            } else {
                const newLoan = await addLoan(loanData as Omit<Loan, 'id'>);
                toast({ title: "Loan added and funds deposited", variant: "success" });
            }
            setIsLoanDialogOpen(false);
        } catch (error) {
            console.error("Error saving loan: ", error);
            toast({ title: `Failed to ${loanData.id ? 'update' : 'add'} loan`, description: (error as Error).message, variant: "destructive" });
        }
    };
    
    const handleDeleteLoan = async (id: string) => {
        await deleteLoan(id);
        toast({ title: "Loan deleted", variant: "success" });
    }

    const openLoanDialogForAdd = () => {
        setCurrentLoan(initialLoanFormState);
        setIsLoanDialogOpen(true);
    };

    const openLoanDialogForEdit = (loan: Loan) => {
        setCurrentLoan(loan);
        setIsLoanDialogOpen(true);
    };

    const handleEditFundTransaction = (transaction: FundTransaction) => {
        setCurrentFundTransaction(transaction);
        setIsFundTransactionDialogOpen(true);
    };

    const handleUpdateFundTransaction = async () => {
        if (!currentFundTransaction || !currentFundTransaction.id) return;
        try {
            await updateFundTransaction(currentFundTransaction.id, {
                amount: currentFundTransaction.amount,
                description: currentFundTransaction.description,
            });
            toast({ title: 'Transaction updated successfully', variant: 'success' });
            setIsFundTransactionDialogOpen(false);
        } catch (error) {
            toast({ title: 'Failed to update transaction', variant: 'destructive' });
            console.error(error);
        }
    };

    const handleDeleteFundTransaction = async (id: string) => {
        try {
            await deleteFundTransaction(id);
            toast({ title: 'Transaction deleted successfully', variant: 'success' });
        } catch (error) {
            toast({ title: 'Failed to delete transaction', variant: 'destructive' });
            console.error(error);
        }
    };


    if (!isClient) {
        return null;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary"/>Financial Overview</CardTitle>
                    <CardDescription>A real-time overview of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    {Array.from(financialState.balances.entries()).map(([key, balance]) => {
                        const account = bankAccounts.find(acc => acc.id === key);
                        if (account) {
                            return <StatCard key={key} title={account.accountHolderName} value={formatCurrency(balance)} icon={<Landmark />} colorClass="text-blue-500" description={`${account.bankName} - ...${account.accountNumber.slice(-4)}`} />
                        }
                        if (key === 'CashInHand') {
                            return <StatCard key={key} title="Cash in Hand" value={formatCurrency(balance)} icon={<HandCoins />} colorClass="text-yellow-500" description="At Mill/Office"/>
                        }
                        if (key === 'CashAtHome') {
                            return <StatCard key={key} title="Cash at Home" value={formatCurrency(balance)} icon={<Home />} colorClass="text-orange-500" />
                        }
                        return null;
                    })}
                     <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" />
                    <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" />
                </CardContent>
            </Card>

            <Tabs defaultValue="funds" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="funds">Fund Management</TabsTrigger>
                    <TabsTrigger value="loans">Loan & Capital Management</TabsTrigger>
                </TabsList>
                <TabsContent value="funds" className="mt-6">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <ArrowLeftRight className="h-5 w-5 text-primary"/>Fund Transfer
                            </CardTitle>
                            <CardDescription>Move funds between your accounts.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4">
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                   <div className="space-y-1">
                                        <Label>From</Label>
                                        <Controller name="source" control={transferForm.control} render={({ field }) => (
                                           <CustomDropdown options={formSourcesAndDestinations} value={field.value} onChange={field.onChange} placeholder="Select Source" />
                                        )} />
                                   </div>
                                    <div className="space-y-1">
                                        <Label>To</Label>
                                        <Controller name="destination" control={transferForm.control} render={({ field }) => (
                                           <CustomDropdown options={formSourcesAndDestinations} value={field.value} onChange={field.onChange} placeholder="Select Destination" />
                                        )} />
                                   </div>
                                   <div className="space-y-1">
                                        <Label htmlFor="transfer-amount">Amount <span className="text-destructive">*</span></Label>
                                        <Input id="transfer-amount" type="number" {...transferForm.register('amount')} />
                                        {transferForm.formState.errors.amount && <p className="text-xs text-destructive mt-1">{transferForm.formState.errors.amount.message}</p>}
                                    </div>
                               </div>
                                <div className="space-y-1">
                                    <Label htmlFor="transfer-description">Description</Label>
                                    <Textarea id="transfer-description" {...transferForm.register('description')} />
                                </div>
                                <Button type="submit">Transfer Funds</Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="loans" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-semibold">Loan & Capital Management</CardTitle>
                                <CardDescription>Track all your loans and add capital injections here.</CardDescription>
                            </div>
                            <Button onClick={openLoanDialogForAdd}><PlusCircle className="mr-2 h-4 w-4"/>Add New Entry</Button>
                        </CardHeader>
                        <CardContent>
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
                                    {loansWithCalculatedRemaining.map((loan) => (
                                        <TableRow key={loan.id}>
                                            <TableCell>
                                                <div className="font-medium">{loan.loanName}</div>
                                                <div className="text-xs text-muted-foreground">{loan.lenderName || loan.productName}</div>
                                            </TableCell>
                                            <TableCell>{toTitleCase(loan.loanType.replace('Loan', ' Loan'))}</TableCell>
                                            <TableCell>{formatCurrency(loan.totalAmount)}</TableCell>
                                            <TableCell className="font-semibold text-destructive">{formatCurrency(loan.remainingAmount || 0)}</TableCell>
                                            <TableCell>{loan.interestRate}%</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-7 w-7 mr-2" onClick={() => openLoanDialogForEdit(loan)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteLoan(loan.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center h-24">No loans found.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>Fund Transaction History</CardTitle>
                    <CardDescription>A log of all capital and internal fund movements.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto max-h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fundTransactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {t.type === 'CapitalInflow' && <PlusCircle className="h-4 w-4 text-green-500"/>}
                                                {t.type === 'CashTransfer' && <ArrowLeftRight className="h-4 w-4 text-purple-500"/>}
                                                <span className="font-medium">{toTitleCase(t.type.replace(/([A-Z])/g, ' $1').trim())}</span>
                                            </div>
                                             <p className="text-xs text-muted-foreground">{formSourcesAndDestinations.find(s => s.value === t.source)?.label || toTitleCase(t.source.replace(/([A-Z])/g, ' $1').trim())} &rarr; {formSourcesAndDestinations.find(d => d.value === t.destination)?.label || toTitleCase(t.destination.replace(/([A-Z])/g, ' $1').trim())}</p>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 mr-2" onClick={() => handleEditFundTransaction(t)}><Pen className="h-4 w-4" /></Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Delete Transaction?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the transaction of {formatCurrency(t.amount)}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteFundTransaction(t.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {fundTransactions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-24">No fund transactions found.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isLoanDialogOpen} onOpenChange={setIsLoanDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{currentLoan?.id ? 'Edit Entry' : 'Add New Entry'}</DialogTitle>
                        <DialogDescription>Fill in the details of the capital or loan below.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mr-4 pr-4">
                        <div className="grid gap-4 py-4 pr-1">
                             <div className="space-y-1">
                                <Label>Type</Label>
                                <CustomDropdown options={[{value: 'OwnerCapital', label: "Owner's Capital"}, {value: 'Product', label: 'Product Loan'}, {value: 'Bank', label: 'Bank Loan'}, {value: 'Outsider', label: 'Outsider Loan'}]} value={currentLoan?.loanType || 'Product'} onChange={(value) => setCurrentLoan(prev => ({...prev, loanType: value as 'Product' | 'Bank' | 'Outsider' | 'OwnerCapital'}))} />
                            </div>

                            {currentLoan.loanType === 'OwnerCapital' && (<div className="space-y-4">
                                <div className="space-y-1"><Label htmlFor="totalAmount">Capital Amount</Label><Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                            </div>)}
                            
                            {currentLoan.loanType === 'Product' && (<div className="space-y-4">
                                <div className="space-y-1"><Label htmlFor="productName">Product Name</Label><Input id="productName" name="productName" value={currentLoan?.productName || ''} onChange={handleLoanInputChange}/></div>
                                <div className="space-y-1"><Label htmlFor="lenderName">Financed By (Bank/Lender)</Label><Input id="lenderName" name="lenderName" value={currentLoan?.lenderName || ''} onChange={handleLoanInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="totalAmount">Product Cost</Label><Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="amountPaid">Down Payment</Label><Input id="amountPaid" name="amountPaid" type="number" value={currentLoan?.amountPaid || 0} onChange={handleLoanNumberInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="emiAmount">EMI Amount</Label><Input id="emiAmount" name="emiAmount" type="number" value={currentLoan?.emiAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="tenureMonths">Tenure (Months)</Label><Input id="tenureMonths" name="tenureMonths" type="number" value={currentLoan?.tenureMonths || 0} readOnly className="bg-muted" /></div>
                            </div>)}

                            {currentLoan.loanType === 'Outsider' && (<div className="space-y-4">
                                <div className="space-y-1"><Label htmlFor="lenderName">Lender Name</Label><Input id="lenderName" name="lenderName" value={currentLoan?.lenderName || ''} onChange={handleLoanInputChange}/></div>
                                <div className="space-y-1"><Label htmlFor="totalAmount">Loan Amount</Label><Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="interestRate">Interest Rate (%)</Label><Input id="interestRate" name="interestRate" type="number" value={currentLoan?.interestRate || 0} onChange={handleLoanNumberInputChange} /></div>
                                <div className="space-y-1"><Label htmlFor="tenureMonths">Tenure (Months)</Label><Input id="tenureMonths" name="tenureMonths" type="number" value={currentLoan?.tenureMonths || 0} onChange={handleLoanNumberInputChange} /></div>
                            </div>)}
                            
                            {currentLoan.loanType === 'Bank' && (<div className="space-y-4">
                               <div className="space-y-1"><Label>Bank Loan Type</Label>
                                <CustomDropdown options={[{value: 'Fixed', label: 'Fixed Loan'}, {value: 'Limit', label: 'Limit Loan'}, {value: 'Overdraft', label: 'Overdraft Loan'}, {value: 'CashCredit', label: 'Cash Credit'}]} value={currentLoan?.bankLoanType || 'Fixed'} onChange={(value) => setCurrentLoan(prev => ({...prev, bankLoanType: value as 'Fixed' | 'Limit' | 'Overdraft' | 'CashCredit'}))} />
                               </div>
                               <div className="space-y-1"><Label htmlFor="lenderName">Bank Name</Label><Input id="lenderName" name="lenderName" value={currentLoan?.lenderName || ''} onChange={handleLoanInputChange}/></div>
                               <div className="space-y-1"><Label htmlFor="totalAmount">Limit Amount</Label><Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                               <div className="space-y-1"><Label htmlFor="interestRate">Interest Rate (%)</Label><Input id="interestRate" name="interestRate" type="number" value={currentLoan?.interestRate || 0} onChange={handleLoanNumberInputChange} /></div>
                            </div>)}

                             <div className="space-y-1">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input id="startDate" name="startDate" type="date" value={currentLoan?.startDate || ''} onChange={(e) => setCurrentLoan(prev => ({...prev, startDate: e.target.value}))} />
                            </div>
                             <div className="space-y-1">
                                <Label>Deposit To</Label>
                                <CustomDropdown options={formSourcesAndDestinations} value={currentLoan?.depositTo || 'CashInHand'} onChange={(value) => setCurrentLoan(prev => ({...prev, depositTo: value as any}))} />
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                         <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                         </DialogClose>
                        <Button onClick={handleLoanSubmit}>{currentLoan?.id ? 'Save Changes' : 'Add Entry'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isFundTransactionDialogOpen} onOpenChange={setIsFundTransactionDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Fund Transaction</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh]">
                        {currentFundTransaction && (
                            <div className="space-y-4 py-4">
                                <div className="space-y-1">
                                    <Label>Amount</Label>
                                    <Input 
                                        type="number" 
                                        value={currentFundTransaction.amount || 0}
                                        onChange={(e) => setCurrentFundTransaction(prev => prev ? {...prev, amount: Number(e.target.value)} : null)}
                                        readOnly={currentFundTransaction.type === 'CapitalInflow'}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label>Description</Label>
                                    <Textarea 
                                        value={currentFundTransaction.description || ''}
                                        onChange={(e) => setCurrentFundTransaction(prev => prev ? {...prev, description: e.target.value} : null)}
                                    />
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFundTransactionDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateFundTransaction}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

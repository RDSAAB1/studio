
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FundTransaction, Transaction, Loan } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";

import { PiggyBank, Landmark, HandCoins, PlusCircle, MinusCircle, DollarSign, Scale, ArrowDown, ArrowUp, Save, Banknote, Edit, Trash2 } from "lucide-react";
import { format, addMonths } from "date-fns";

import { addFundTransaction, getFundTransactionsRealtime, getTransactionsRealtime, addLoan, updateLoan, deleteLoan, getLoansRealtime } from "@/lib/firestore";
import { cashBankFormSchemas, type CapitalInflowValues, type WithdrawalValues, type DepositValues } from "./formSchemas";
import { ScrollArea } from "@/components/ui/scroll-area";


const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
    <Card className="bg-card/60 backdrop-blur-sm border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
            <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

const TransactionFormCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode}) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
            {children}
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
    paymentMethod: "Bank",
};

export default function CashBankClient() {
    
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLoanDialogOpen, setIsLoanDialogOpen] = useState(false);
    const [currentLoan, setCurrentLoan] = useState<Partial<Loan>>(initialLoanFormState);

    useEffect(() => {
        setIsClient(true);
        const unsubscribeFunds = getFundTransactionsRealtime((data) => {
            setFundTransactions(data);
        }, (error) => {
            console.error("Error fetching fund transactions:", error);
            toast({ title: "Error loading fund transactions", variant: "destructive" });
        });

        const unsubscribeTransactions = getTransactionsRealtime((data) => {
            setTransactions(data);
        }, (error) => {
            console.error("Error fetching income/expense transactions:", error);
            toast({ title: "Error loading income/expense data", variant: "destructive" });
        });

        const unsubscribeLoans = getLoansRealtime((data) => {
            setLoans(data);
        }, (error) => {
            console.error("Error fetching loans:", error);
            toast({ title: "Error loading loan data", variant: "destructive" });
        });
        
        setLoading(false);

        return () => {
            unsubscribeFunds();
            unsubscribeTransactions();
            unsubscribeLoans();
        };
    }, []);

    const capitalInflowForm = useForm<CapitalInflowValues>({ resolver: zodResolver(cashBankFormSchemas.capitalInflowSchema), defaultValues: { source: undefined, destination: undefined, amount: 0, description: "" } });
    const withdrawalForm = useForm<WithdrawalValues>({ resolver: zodResolver(cashBankFormSchemas.withdrawalSchema), defaultValues: { amount: 0, description: "" } });
    const depositForm = useForm<DepositValues>({ resolver: zodResolver(cashBankFormSchemas.depositSchema), defaultValues: { amount: 0, description: "" } });
    
    const loansWithCalculatedRemaining = useMemo(() => {
        return loans.map(loan => {
            const paidTransactions = transactions.filter(t => t.loanId === loan.id && t.transactionType === 'Expense');
            const totalPaidTowardsPrincipal = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalPaid = (loan.amountPaid || 0) + totalPaidTowardsPrincipal;
            const remainingAmount = loan.totalAmount - totalPaid;
            return { ...loan, remainingAmount, amountPaid: totalPaid };
        });
    }, [loans, transactions]);

    const financialState = useMemo(() => {
        let bankBalance = 0;
        let cashInHand = 0;
        
        fundTransactions.forEach(t => {
            if (t.type === 'CapitalInflow') {
                if(t.destination === 'BankAccount') bankBalance += t.amount;
                if(t.destination === 'CashInHand') cashInHand += t.amount;
            } else if (t.type === 'BankWithdrawal') {
                bankBalance -= t.amount;
                cashInHand += t.amount;
            } else if (t.type === 'BankDeposit') {
                cashInHand -= t.amount;
                bankBalance += t.amount;
            }
        });
        
        transactions.forEach(t => {
            if (t.transactionType === 'Income') {
                if (t.paymentMethod === 'Online' || t.paymentMethod === 'Cheque') bankBalance += t.amount;
                if (t.paymentMethod === 'Cash') cashInHand += t.amount;
            } else if (t.transactionType === 'Expense') {
                 if (t.paymentMethod === 'Online' || t.paymentMethod === 'Cheque') bankBalance -= t.amount;
                 if (t.paymentMethod === 'Cash') cashInHand -= t.amount;
            }
        });
        
        const totalLiabilities = loansWithCalculatedRemaining.reduce((sum, loan) => sum + (loan.remainingAmount || 0), 0);
        
        return { bankBalance, cashInHand, totalAssets: bankBalance + cashInHand, totalLiabilities };
    }, [fundTransactions, transactions, loansWithCalculatedRemaining]);

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
    
    const onCapitalInflowSubmit = (values: CapitalInflowValues) => {
        handleAddFundTransaction({ type: 'CapitalInflow', source: values.source, destination: values.destination, amount: values.amount, description: values.description })
          .then(() => capitalInflowForm.reset({ source: undefined, destination: undefined, amount: 0, description: "" }));
    };

    const onWithdrawalSubmit = (values: WithdrawalValues) => {
        handleAddFundTransaction({ type: 'BankWithdrawal', source: 'BankAccount', destination: 'CashInHand', amount: values.amount, description: values.description })
          .then(() => withdrawalForm.reset({ amount: 0, description: "" }));
    };

    const onDepositSubmit = (values: DepositValues) => {
        handleAddFundTransaction({ type: 'BankDeposit', source: 'CashInHand', destination: 'BankAccount', amount: values.amount, description: values.description })
          .then(() => depositForm.reset({ amount: 0, description: "" }));
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

        let loanNameToSave = '';
        if (currentLoan.loanType === 'Product' && currentLoan.productName) {
            loanNameToSave = currentLoan.productName + ' Loan';
        } else if (currentLoan.loanType === 'Bank' && currentLoan.lenderName) {
            loanNameToSave = `${currentLoan.lenderName} Loan`;
        } else if (currentLoan.loanType === 'Outsider' && currentLoan.lenderName) {
             loanNameToSave = `Loan from ${currentLoan.lenderName}`;
        }

        if (!loanNameToSave) {
            toast({ title: "Product Name or Lender Name is required", variant: "destructive" });
            return;
        }

        const loanData = {
            ...currentLoan,
            loanName: loanNameToSave,
            remainingAmount: (currentLoan.totalAmount || 0) - (currentLoan.amountPaid || 0),
            nextEmiDueDate: currentLoan.startDate ? format(addMonths(new Date(currentLoan.startDate), 1), 'yyyy-MM-dd') : undefined,
        };

        try {
            if (currentLoan.id) {
                await updateLoan(currentLoan.id, loanData);
                toast({ title: "Loan updated successfully", variant: "success" });
            } else {
                await addLoan(loanData as Omit<Loan, 'id'>);
                toast({ title: "Loan added successfully", variant: "success" });
                
                // If it's a new Bank or Outsider loan, create a CapitalInflow transaction
                if (currentLoan.loanType === 'Bank' || currentLoan.loanType === 'Outsider') {
                    const capitalInflowData: Omit<FundTransaction, 'id' | 'date'> = {
                        type: 'CapitalInflow',
                        source: currentLoan.loanType === 'Bank' ? 'BankLoan' : 'ExternalLoan',
                        destination: currentLoan.paymentMethod === 'Bank' ? 'BankAccount' : 'CashInHand',
                        amount: currentLoan.totalAmount || 0,
                        description: `Capital inflow from ${loanNameToSave}`
                    };
                    await addFundTransaction(capitalInflowData);
                    toast({ title: "Capital inflow recorded", description: `${formatCurrency(currentLoan.totalAmount || 0)} added to ${currentLoan.paymentMethod === 'Bank' ? 'Bank Account' : 'Cash in Hand'}.`, variant: 'success' });
                }
            }
            setIsLoanDialogOpen(false);
        } catch (error) {
            console.error("Error saving loan: ", error);
            toast({ title: `Failed to ${currentLoan.id ? 'update' : 'add'} loan`, variant: "destructive" });
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


    if (!isClient || loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary"/>Financial Overview</CardTitle>
                    <CardDescription>A real-time overview of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Bank Balance" value={formatCurrency(financialState.bankBalance)} icon={<Landmark />} colorClass="text-blue-500" />
                    <StatCard title="Cash in Hand" value={formatCurrency(financialState.cashInHand)} icon={<HandCoins />} colorClass="text-yellow-500" />
                    <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" />
                    <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" />
                </CardContent>
            </Card>

            <Tabs defaultValue="funds" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="funds">Fund Management</TabsTrigger>
                    <TabsTrigger value="loans">Loan Management</TabsTrigger>
                </TabsList>
                <TabsContent value="funds" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <TransactionFormCard title="Add Capital" description="Add funds from various sources into your business.">
                            <form onSubmit={capitalInflowForm.handleSubmit(onCapitalInflowSubmit)} className="space-y-4">
                                <Controller name="source" control={capitalInflowForm.control} render={({ field }) => (
                                    <div className="space-y-1">
                                        <Label>Source of Capital</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OwnerCapital">Owner's Capital</SelectItem>
                                                <SelectItem value="BankLoan">Bank Loan</SelectItem>
                                                <SelectItem value="ExternalLoan">External Loan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )} />
                                <Controller name="destination" control={capitalInflowForm.control} render={({ field }) => (
                                    <div className="space-y-1">
                                        <Label>Deposit To</Label>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select Destination" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="BankAccount">Bank Account</SelectItem>
                                                <SelectItem value="CashInHand">Cash in Hand</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )} />
                                <div className="space-y-1">
                                    <Label htmlFor="capital-amount">Amount</Label>
                                    <Input id="capital-amount" type="number" {...capitalInflowForm.register('amount')} />
                                    {capitalInflowForm.formState.errors.amount && <p className="text-xs text-destructive mt-1">{capitalInflowForm.formState.errors.amount.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="capital-description">Description</Label>
                                    <Textarea id="capital-description" {...capitalInflowForm.register('description')} />
                                </div>
                                <Button type="submit"><Save className="mr-2"/> Add Capital</Button>
                            </form>
                        </TransactionFormCard>

                        <div className="space-y-6">
                            <TransactionFormCard title="Withdraw from Bank" description="Move funds from your bank to cash in hand.">
                                <form onSubmit={withdrawalForm.handleSubmit(onWithdrawalSubmit)} className="space-y-4">
                                    <div className="space-y-1">
                                    <Label htmlFor="withdrawal-amount">Amount <span className="text-destructive">*</span></Label>
                                        <Input id="withdrawal-amount" type="number" {...withdrawalForm.register('amount')} />
                                        {withdrawalForm.formState.errors.amount && <p className="text-xs text-destructive mt-1">{withdrawalForm.formState.errors.amount.message}</p>}
                                    </div>
                                     <div className="space-y-1">
                                        <Label htmlFor="withdrawal-description">Description</Label>
                                        <Textarea id="withdrawal-description" {...withdrawalForm.register('description')} />
                                    </div>
                                    <Button type="submit"><ArrowDown className="mr-2"/> Withdraw</Button>
                                </form>
                            </TransactionFormCard>

                            <TransactionFormCard title="Deposit to Bank" description="Move cash from hand to your bank account.">
                                <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
                                     <div className="space-y-1">
                                        <Label htmlFor="deposit-amount">Amount <span className="text-destructive">*</span></Label>
                                        <Input id="deposit-amount" type="number" {...depositForm.register('amount')} />
                                        {depositForm.formState.errors.amount && <p className="text-xs text-destructive mt-1">{depositForm.formState.errors.amount.message}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="deposit-description">Description</Label>
                                        <Textarea id="deposit-description" {...depositForm.register('description')} />
                                    </div>
                                    <Button type="submit"><ArrowUp className="mr-2"/> Deposit</Button>
                                </form>
                            </TransactionFormCard>
                        </div>
                    </div>
                </TabsContent>
                 <TabsContent value="loans" className="mt-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-semibold">Loan Management</CardTitle>
                                <CardDescription>Track all your bank and external loans here.</CardDescription>
                            </div>
                            <Button onClick={openLoanDialogForAdd}><PlusCircle className="mr-2 h-4 w-4"/>Add New Loan</Button>
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fundTransactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {t.type === 'CapitalInflow' && <PlusCircle className="h-4 w-4 text-green-500"/>}
                                                {t.type === 'BankWithdrawal' && <MinusCircle className="h-4 w-4 text-red-500"/>}
                                                {t.type === 'BankDeposit' && <PlusCircle className="h-4 w-4 text-blue-500"/>}
                                                <span className="font-medium">{toTitleCase(t.type.replace(/([A-Z])/g, ' $1').trim())}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">{t.source && toTitleCase(t.source.replace(/([A-Z])/g, ' $1').trim())} &rarr; {t.destination && toTitleCase(t.destination.replace(/([A-Z])/g, ' $1').trim())}</p>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Dialog open={isLoanDialogOpen} onOpenChange={setIsLoanDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{currentLoan?.id ? 'Edit Loan' : 'Add New Loan'}</DialogTitle>
                        <DialogDescription>Fill in the details of the loan below.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[70vh] -mr-4 pr-4">
                        <div className="grid gap-4 py-4 pr-1">
                             <div className="space-y-1">
                                <Label>Loan Type</Label>
                                <Select name="loanType" value={currentLoan?.loanType || 'Product'} onValueChange={(value) => setCurrentLoan(prev => ({...prev, loanType: value as 'Product' | 'Bank' | 'Outsider'}))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Product">Product Loan</SelectItem>
                                    <SelectItem value="Bank">Bank Loan</SelectItem>
                                    <SelectItem value="Outsider">Outsider Loan</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>
                            
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
                               <div className="space-y-1"><Label htmlFor="lenderName">Bank Name</Label><Input id="lenderName" name="lenderName" value={currentLoan?.lenderName || ''} onChange={handleLoanInputChange}/></div>
                               <div className="space-y-1"><Label htmlFor="totalAmount">Limit Amount</Label><Input id="totalAmount" name="totalAmount" type="number" value={currentLoan?.totalAmount || 0} onChange={handleLoanNumberInputChange} /></div>
                               <div className="space-y-1"><Label htmlFor="interestRate">Interest Rate (%)</Label><Input id="interestRate" name="interestRate" type="number" value={currentLoan?.interestRate || 0} onChange={handleLoanNumberInputChange} /></div>
                            </div>)}

                             <div className="space-y-1">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input id="startDate" name="startDate" type="date" value={currentLoan?.startDate || ''} onChange={(e) => setCurrentLoan(prev => ({...prev, startDate: e.target.value}))} />
                            </div>
                             <div className="space-y-1">
                                <Label>Payment Method</Label>
                                <Select name="paymentMethod" value={currentLoan?.paymentMethod || 'Bank'} onValueChange={(value) => setCurrentLoan(prev => ({...prev, paymentMethod: value as 'Bank' | 'Cash'}))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bank">Bank</SelectItem>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                  </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                         <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                         </DialogClose>
                        <Button onClick={handleLoanSubmit}>{currentLoan?.id ? 'Save Changes' : 'Add Loan'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

    

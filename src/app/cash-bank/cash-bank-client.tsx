"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FundTransaction, Transaction } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

import { PiggyBank, Landmark, HandCoins, PlusCircle, MinusCircle, DollarSign, Scale, ArrowDown, ArrowUp, Save } from "lucide-react";
import { format } from "date-fns";

import { addFundTransaction, getFundTransactionsRealtime, getTransactionsRealtime } from "@/lib/firestore";
import { cashBankFormSchemas, type CapitalInflowValues, type WithdrawalValues, type DepositValues } from "./formSchemas";


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


export default function CashBankClient() {
    
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setIsClient(true);
        const unsubscribeFunds = getFundTransactionsRealtime((data) => {
            setFundTransactions(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching fund transactions:", error);
            toast({ title: "Error", description: "Failed to load fund transactions.", variant: "destructive" });
            setLoading(false);
        });

        const unsubscribeTransactions = getTransactionsRealtime((data) => {
            setTransactions(data);
        }, (error) => {
            console.error("Error fetching income/expense transactions:", error);
            toast({ title: "Error", description: "Failed to load income/expense data.", variant: "destructive" });
        });

        return () => {
            unsubscribeFunds();
            unsubscribeTransactions();
        };
    }, []);

    const capitalInflowForm = useForm<CapitalInflowValues>({ resolver: zodResolver(cashBankFormSchemas.capitalInflowSchema), defaultValues: { source: undefined, destination: undefined, amount: 0, description: "" } });
    const withdrawalForm = useForm<WithdrawalValues>({ resolver: zodResolver(cashBankFormSchemas.withdrawalSchema), defaultValues: { amount: 0, description: "" } });
    const depositForm = useForm<DepositValues>({ resolver: zodResolver(cashBankFormSchemas.depositSchema), defaultValues: { amount: 0, description: "" } });

    const financialState = useMemo(() => {
        let bankBalance = 0;
        let cashInHand = 0;
        let totalLiabilities = 0;
        
        fundTransactions.forEach(t => {
            if (t.type === 'CapitalInflow') {
                if(t.destination === 'BankAccount') bankBalance += t.amount;
                if(t.destination === 'CashInHand') cashInHand += t.amount;
                if(t.source === 'BankLoan' || t.source === 'ExternalLoan') totalLiabilities += t.amount;
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
        
        return { bankBalance, cashInHand, totalAssets: bankBalance + cashInHand, totalLiabilities };
    }, [fundTransactions, transactions]);

    const handleAddFundTransaction = (transaction: Omit<FundTransaction, 'id' | 'date'>) => {
        return addFundTransaction(transaction)
            .then(() => {
                toast({ title: "Success", description: "Transaction recorded successfully.", variant: "success" });
            })
            .catch((error) => {
                console.error("Error adding fund transaction:", error);
                toast({ title: "Error", description: "Failed to record transaction.", variant: "destructive" });
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

    if (!isClient || loading) return <div>Loading...</div>; // Simple loading state

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
        </div>
    );
}

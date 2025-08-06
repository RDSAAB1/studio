"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { initialTransactions, initialFundTransactions } from "@/lib/data";
import type { FundTransaction, Transaction } from "@/lib/definitions";
import { toTitleCase, cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

import { PiggyBank, Landmark, HandCoins, ArrowLeftRight, PlusCircle, MinusCircle, DollarSign, Wallet, Scale, ArrowDown, ArrowUp } from "lucide-react";
import { format } from "date-fns";

const fundTransactionSchema = z.object({
  type: z.enum(["CapitalInflow", "BankWithdrawal", "BankDeposit"]),
  source: z.string().optional(),
  destination: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  description: z.string().optional(),
});

type FundFormValues = z.infer<typeof fundTransactionSchema>;

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


export default function CashBankClient() {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>(initialFundTransactions);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const form = useForm<FundFormValues>({
        resolver: zodResolver(fundTransactionSchema),
        defaultValues: {
            type: "CapitalInflow",
            amount: 0,
            description: "",
        },
    });

    const transactionType = form.watch('type');

    const financialState = useMemo(() => {
        let bankBalance = 0;
        let cashInHand = 0;
        let totalLiabilities = 0;
        
        // Process fund transactions
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

        // Process income/expense transactions
        transactions.forEach(t => {
            if (t.transactionType === 'Income') {
                if (t.paymentMethod === 'Online' || t.paymentMethod === 'Cheque') bankBalance += t.amount;
                if (t.paymentMethod === 'Cash') cashInHand += t.amount;
            } else if (t.transactionType === 'Expense') {
                 if (t.paymentMethod === 'Online' || t.paymentMethod === 'Cheque') bankBalance -= t.amount;
                 if (t.paymentMethod === 'Cash') cashInHand -= t.amount;
            }
        });

        return {
            bankBalance,
            cashInHand,
            totalAssets: bankBalance + cashInHand,
            totalLiabilities,
        }

    }, [transactions, fundTransactions]);


    const onSubmit = (values: FundFormValues) => {
        let newTransaction: Omit<FundTransaction, 'id' | 'date'>;

        switch(values.type) {
            case 'CapitalInflow':
                if(!values.source || !values.destination) {
                    toast({variant: 'destructive', title: "Error", description: "Source and Destination are required for Capital Inflow."});
                    return;
                }
                newTransaction = { type: 'CapitalInflow', source: values.source, destination: values.destination, amount: values.amount, description: values.description };
                break;
            case 'BankWithdrawal':
                newTransaction = { type: 'BankWithdrawal', source: 'BankAccount', destination: 'CashInHand', amount: values.amount, description: values.description };
                break;
            case 'BankDeposit':
                newTransaction = { type: 'BankDeposit', source: 'CashInHand', destination: 'BankAccount', amount: values.amount, description: values.description };
                break;
            default:
                toast({variant: 'destructive', title: "Error", description: "Invalid transaction type."});
                return;
        }

        const fullTransaction: FundTransaction = {
            ...newTransaction,
            id: String(Date.now()),
            date: new Date().toISOString().split('T')[0],
        };

        setFundTransactions(prev => [fullTransaction, ...prev]);
        toast({title: "Success", description: "Transaction recorded successfully."});
        form.reset({ type: "CapitalInflow", amount: 0, description: "" });
    }

    if (!isClient) {
        return null; // or a loading spinner
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5 text-primary"/>Financial Overview</CardTitle>
                    <CardDescription>A real-time overview of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Bank Balance" value={`₹${financialState.bankBalance.toFixed(2)}`} icon={<Landmark />} colorClass="text-blue-500" />
                    <StatCard title="Cash in Hand" value={`₹${financialState.cashInHand.toFixed(2)}`} icon={<HandCoins />} colorClass="text-yellow-500" />
                    <StatCard title="Total Assets" value={`₹${financialState.totalAssets.toFixed(2)}`} icon={<PiggyBank />} colorClass="text-green-500" />
                    <StatCard title="Total Liabilities" value={`₹${financialState.totalLiabilities.toFixed(2)}`} icon={<DollarSign />} colorClass="text-red-500" />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Add New Fund Transaction</CardTitle>
                        <CardDescription>Record capital inflow or internal fund transfers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <Controller name="type" control={form.control} render={({ field }) => (
                                <div className="space-y-1">
                                    <Label>Transaction Type</Label>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CapitalInflow">Capital Inflow (Add Money)</SelectItem>
                                            <SelectItem value="BankWithdrawal">Withdraw from Bank</SelectItem>
                                            <SelectItem value="BankDeposit">Deposit to Bank</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )} />

                            {transactionType === 'CapitalInflow' && (
                                <>
                                    <Controller name="source" control={form.control} render={({ field }) => (
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
                                     <Controller name="destination" control={form.control} render={({ field }) => (
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
                                </>
                            )}
                            
                            <div className="space-y-1">
                                <Label htmlFor="amount">Amount</Label>
                                <Controller name="amount" control={form.control} render={({ field }) => <Input id="amount" type="number" {...field} />} />
                                {form.formState.errors.amount && <p className="text-xs text-destructive mt-1">{form.formState.errors.amount.message}</p>}
                            </div>

                             <div className="space-y-1">
                                <Label htmlFor="description">Description</Label>
                                <Controller name="description" control={form.control} render={({ field }) => <Textarea id="description" {...field} />} />
                            </div>

                            <Button type="submit">Record Transaction</Button>
                        </form>
                    </CardContent>
                </Card>
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
                                                <p className="text-xs text-muted-foreground">{t.source} &rarr; {t.destination}</p>
                                            </TableCell>
                                            <TableCell className="text-right font-mono">₹{t.amount.toFixed(2)}</TableCell>
                                            <TableCell>{t.description}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


"use client";

import { useState, useEffect, useMemo } from "react";
import { initialCustomers, initialTransactions, initialFundTransactions } from "@/lib/data";
import type { Customer, Transaction, FundTransaction, Payment } from "@/lib/definitions";
import { toTitleCase, cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { TrendingUp, TrendingDown, Scale, Banknote, Landmark, HandCoins, PiggyBank, DollarSign, Users, FileText, ArrowRight, Wallet } from "lucide-react";
import { format } from "date-fns";

const StatCard = ({ title, value, icon, colorClass, description }: { title: string; value: string; icon: React.ReactNode; colorClass?: string; description?: string }) => (
  <Card className="bg-card/60 backdrop-blur-sm border-white/10">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="text-muted-foreground">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function DashboardOverviewClient() {
    const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
    const [transactions] = useState<Transaction[]>(initialTransactions);
    const [fundTransactions] = useState<FundTransaction[]>(initialFundTransactions);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
          setIsClient(true);
          try {
            const savedCustomers = localStorage.getItem("customers_data");
            if(savedCustomers) setCustomers(JSON.parse(savedCustomers));
            
          } catch (error) {
            console.error("Failed to load data from localStorage", error);
          }
        }
      }, []);

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
        
        const totalIncome = transactions.filter(t => t.transactionType === 'Income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.transactionType === 'Expense').reduce((sum, t) => sum + t.amount, 0);

        return { 
            bankBalance, 
            cashInHand, 
            totalAssets: bankBalance + cashInHand, 
            totalLiabilities,
            totalIncome,
            totalExpense,
            netProfitLoss: totalIncome - totalExpense
        };
    }, [transactions, fundTransactions]);

    const salesState = useMemo(() => {
        const totalSalesAmount = customers.reduce((sum, c) => sum + c.amount, 0);
        const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.netAmount), 0);
        const totalPaid = totalSalesAmount - totalOutstanding;
        const uniqueCustomerIds = new Set(customers.map(c => c.customerId));
        return {
            totalSalesAmount,
            totalOutstanding,
            totalPaid,
            totalCustomers: uniqueCustomerIds.size,
        }
    }, [customers]);
    
    const recentTransactions = useMemo(() => {
        return [...transactions]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [transactions]);
    
    const recentCustomers = useMemo(() => {
         return [...customers]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [customers]);

    if (!isClient) return null; // Or a loading skeleton

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-5 w-5 text-primary"/>Financial Overview</CardTitle>
                    <CardDescription>A real-time snapshot of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Income" value={`₹${financialState.totalIncome.toFixed(2)}`} icon={<TrendingUp />} colorClass="text-green-500" />
                    <StatCard title="Total Expense" value={`₹${financialState.totalExpense.toFixed(2)}`} icon={<TrendingDown />} colorClass="text-red-500" />
                    <StatCard title="Net Profit/Loss" value={`₹${financialState.netProfitLoss.toFixed(2)}`} icon={<Scale />} colorClass={financialState.netProfitLoss >= 0 ? "text-green-500" : "text-red-500"} />
                    <StatCard title="Total Bank Balance" value={`₹${financialState.bankBalance.toFixed(2)}`} icon={<Landmark />} colorClass="text-blue-500" />
                    <StatCard title="Cash in Hand" value={`₹${financialState.cashInHand.toFixed(2)}`} icon={<HandCoins />} colorClass="text-yellow-500" />
                    <StatCard title="Total Assets" value={`₹${financialState.totalAssets.toFixed(2)}`} icon={<PiggyBank />} colorClass="text-green-500" />
                    <StatCard title="Total Liabilities" value={`₹${financialState.totalLiabilities.toFixed(2)}`} icon={<DollarSign />} colorClass="text-red-500" />
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Banknote className="h-5 w-5 text-primary"/>Sales & Customer Overview</CardTitle>
                    <CardDescription>Key metrics from your sales and customer activities.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Sales Amount" value={`₹${salesState.totalSalesAmount.toFixed(2)}`} icon={<Banknote />} />
                    <StatCard title="Total Paid" value={`₹${salesState.totalPaid.toFixed(2)}`} icon={<Wallet />} colorClass="text-green-500"/>
                    <StatCard title="Total Outstanding" value={`₹${salesState.totalOutstanding.toFixed(2)}`} icon={<Banknote />} colorClass="text-destructive" />
                    <StatCard title="Total Customers" value={String(salesState.totalCustomers)} icon={<Users />} />
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Recent Transactions
                        </CardTitle>
                         <CardDescription>Your last 5 income and expense entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Payee/Payer</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell><Badge variant={t.transactionType === 'Income' ? 'default' : 'destructive'} className={cn(t.transactionType === 'Income' ? 'bg-green-600' : 'bg-red-600', 'text-white')}>{t.transactionType}</Badge></TableCell>
                                        <TableCell>{toTitleCase(t.payee)}</TableCell>
                                        <TableCell className={cn("text-right font-medium", t.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>₹{t.amount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <Users className="h-5 w-5 text-primary" />
                            Recent Supplier Entries
                        </CardTitle>
                         <CardDescription>Your last 5 supplier entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>SR No.</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Net Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentCustomers.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>{format(new Date(c.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="font-mono">{c.srNo}</TableCell>
                                        <TableCell>{toTitleCase(c.name)}</TableCell>
                                        <TableCell className="text-right font-medium">₹{Number(c.netAmount).toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

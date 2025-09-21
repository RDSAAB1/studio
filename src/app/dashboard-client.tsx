
"use client";

import { useState, useEffect } from 'react';
import type { Customer, Transaction, Loan, FundTransaction } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getIncomeAndExpensesRealtime, getLoansRealtime, getFundTransactionsRealtime } from "@/lib/firestore";
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format, subDays } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

const StatCard = ({ title, value, description, icon, colorClass, isLoading }: { title: string, value: string, description?: string, icon: React.ReactNode, colorClass?: string, isLoading?: boolean }) => (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <>
                    <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
                    {description && <p className="text-xs text-muted-foreground">{description}</p>}
                </>
            )}
        </CardContent>
    </Card>
);

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    
    const [suppliers, setSuppliers] = useState<Customer[] | undefined>(undefined);
    const [customers, setCustomers] = useState<Customer[] | undefined>(undefined);
    const [transactions, setTransactions] = useState<Transaction[] | undefined>(undefined);
    const [loans, setLoans] = useState<Loan[] | undefined>(undefined);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[] | undefined>(undefined);

    useEffect(() => {
        setIsClient(true);
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
        const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
        const unsubTransactions = getIncomeAndExpensesRealtime(setTransactions, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubFundTransactions = getFundTransactionsRealtime(setFundTransactions, console.error);

        return () => {
            unsubSuppliers();
            unsubCustomers();
            unsubTransactions();
            unsubLoans();
            unsubFundTransactions();
        };
    }, []);

    const summaryStats = isClient ? (() => {
        const totalIncome = (transactions as Transaction[] || []).filter(t => t.transactionType === 'Income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = (transactions as Transaction[] || []).filter(t => t.transactionType === 'Expense').reduce((sum, t) => sum + t.amount, 0);
        const netProfit = totalIncome - totalExpense;

        const totalPayable = (suppliers as Customer[] || []).reduce((sum, s) => sum + Number(s.netAmount), 0);
        const totalReceivable = (customers as Customer[] || []).reduce((sum, c) => sum + Number(c.netAmount), 0);
        
        const totalLiabilities = (loans as Loan[] || []).reduce((sum, l) => sum + l.remainingAmount, 0);
        
        const capitalInflow = (fundTransactions || []).filter(t => t.type === 'CapitalInflow').reduce((sum, t) => sum + t.amount, 0);

        return {
            totalIncome,
            totalExpense,
            netProfit,
            totalPayable,
            totalReceivable,
            totalLiabilities,
            capitalInflow,
        };
    })() : null;

    const chartData = isClient ? (() => {
        const data: { [key: string]: { date: string, income: number, expense: number } } = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = format(subDays(today, i), 'MMM dd');
            data[date] = { date, income: 0, expense: 0 };
        }
        (transactions as Transaction[] || []).forEach(t => {
            const date = format(new Date(t.date), 'MMM dd');
            if (data[date]) {
                if (t.transactionType === 'Income') data[date].income += t.amount;
                else data[date].expense += t.amount;
            }
        });
        return Object.values(data);
    })() : [];

    const recentTransactions = isClient ? (transactions as Transaction[] || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5) : [];

    const isLoading = !isClient || !suppliers || !customers || !transactions || !loans || !fundTransactions;

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="Total Income" 
                    value={formatCurrency(summaryStats?.totalIncome ?? 0)} 
                    description="Last 30 days"
                    icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} 
                    colorClass="text-green-500"
                    isLoading={isLoading}
                />
                <StatCard 
                    title="Total Expense" 
                    value={formatCurrency(summaryStats?.totalExpense ?? 0)} 
                    description="Last 30 days"
                    icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} 
                    colorClass="text-red-500"
                    isLoading={isLoading}
                />
                 <StatCard 
                    title="Net Profit" 
                    value={formatCurrency(summaryStats?.netProfit ?? 0)} 
                    description="Total Income - Total Expense"
                    icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} 
                    colorClass={summaryStats && summaryStats.netProfit >= 0 ? "text-green-500" : "text-red-500"}
                    isLoading={isLoading}
                />
                <StatCard 
                    title="Capital Inflow" 
                    value={formatCurrency(summaryStats?.capitalInflow ?? 0)} 
                    description="Owner & Loan Capital"
                    icon={<PiggyBank className="h-4 w-4 text-muted-foreground" />} 
                    isLoading={isLoading}
                />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                 <Card>
                    <CardHeader>
                        <CardTitle>Cash Flow</CardTitle>
                        <CardDescription>Income vs. Expense over the last 7 days.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value))}/>
                                <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), toTitleCase(name)]}/>
                                <Area type="monotone" dataKey="income" stackId="1" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                                <Area type="monotone" dataKey="expense" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <CardHeader><CardTitle>Financial Position</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between"><span>Total Payable (Suppliers)</span><span className="font-bold">{formatCurrency(summaryStats?.totalPayable ?? 0)}</span></div>
                        <div className="flex items-center justify-between"><span>Total Receivable (Customers)</span><span className="font-bold">{formatCurrency(summaryStats?.totalReceivable ?? 0)}</span></div>
                        <div className="flex items-center justify-between"><span>Total Liabilities (Loans)</span><span className="font-bold">{formatCurrency(summaryStats?.totalLiabilities ?? 0)}</span></div>
                    </CardContent>
                 </Card>
                 <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent Transactions</CardTitle>
                            <CardDescription>Your latest income and expense entries.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push('/expense-tracker')}>View All</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Payee/Payer</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), "dd-MMM")}</TableCell>
                                        <TableCell>{t.subCategory}</TableCell>
                                        <TableCell>{t.payee}</TableCell>
                                        <TableCell className={`text-right font-medium ${t.transactionType === 'Income' ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(t.amount)}</TableCell>
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


"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction, FundTransaction, Loan, BankAccount, Customer } from "@/lib/definitions";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth } from 'date-fns';
import { AreaChart, DonutChart, BarChart } from '@tremor/react';
import { PiggyBank, Landmark, HandCoins, DollarSign, Scale, TrendingUp, TrendingDown, AlertTriangle, Home, FileText, CheckCircle, Users, Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const StatCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
    <Card className="bg-card/60 backdrop-blur-sm">
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
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("date", "desc")), (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        });

        const unsubFunds = onSnapshot(query(collection(db, "fund_transactions"), orderBy("date", "desc")), (snapshot) => {
            setFundTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FundTransaction)));
        });

        const unsubLoans = onSnapshot(query(collection(db, "loans"), orderBy("startDate", "desc")), (snapshot) => {
            setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
        });
        
        const unsubBankAccounts = onSnapshot(query(collection(db, "bankAccounts"), orderBy("bankName", "asc")), (snapshot) => {
            setBankAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount)));
        });

        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers"), orderBy("netAmount", "desc")), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });

        const unsubCustomers = onSnapshot(query(collection(db, "customers"), orderBy("netAmount", "desc")), (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });
        
        setLoading(false);

        return () => {
            unsubTransactions();
            unsubFunds();
            unsubLoans();
            unsubBankAccounts();
            unsubSuppliers();
            unsubCustomers();
        };
    }, []);
    
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
        
        transactions.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                const amount = t.amount || 0;
                if (t.transactionType === 'Income') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) + amount);
                } else if (t.transactionType === 'Expense') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) - amount);
                }
            }
        });

        const totalSupplierDues = suppliers.reduce((sum, s) => sum + Number(s.netAmount || 0), 0);
        const totalCustomerDues = customers.reduce((sum, c) => sum + Number(c.netAmount || 0), 0);
        
        const loanLiabilities = loans.reduce((sum, loan) => {
            const paidTransactions = transactions.filter(t => t.loanId === loan.id && t.transactionType === 'Expense');
            const totalPaidTowardsPrincipal = paidTransactions.reduce((subSum, t) => subSum + t.amount, 0);
            const totalPaid = (loan.amountPaid || 0) + totalPaidTowardsPrincipal;
            const remainingAmount = loan.totalAmount - totalPaid;
            return sum + (remainingAmount > 0 ? remainingAmount : 0);
        }, 0);
        const totalLiabilities = loanLiabilities + totalSupplierDues;
        
        const cashAndBankAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        const totalAssets = cashAndBankAssets + totalCustomerDues;
        
        return { balances, totalAssets, totalLiabilities, totalSupplierDues, totalCustomerDues };
    }, [fundTransactions, transactions, loans, bankAccounts, suppliers, customers]);

    const chartData = useMemo(() => {
        const monthlyData: { [key: string]: { Income: number; Expense: number } } = {};
        
        transactions.forEach(t => {
            const month = format(startOfMonth(new Date(t.date)), 'MMM yyyy');
            if (!monthlyData[month]) {
                monthlyData[month] = { Income: 0, Expense: 0 };
            }
            monthlyData[month][t.transactionType] += t.amount;
        });

        return Object.entries(monthlyData).map(([date, values]) => ({ date, ...values }));
    }, [transactions]);

    const expenseByCategory = useMemo(() => {
        const categoryMap: { [key: string]: number } = {};
        transactions.filter(t => t.transactionType === 'Expense').forEach(t => {
            categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
        });
        return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    }, [transactions]);

    const topOutstandingSuppliers = useMemo(() => {
      return suppliers
          .filter(s => (s.netAmount || 0) > 0)
          .sort((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0))
          .slice(0, 5);
    }, [suppliers]);

    const topOutstandingCustomers = useMemo(() => {
        return customers
            .filter(c => (c.netAmount || 0) > 0)
            .sort((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0))
            .slice(0, 5);
    }, [customers]);

    if (loading) {
        return <div>Loading Dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" description="Cash, Bank, and Receivables" />
                <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" description="Loans and Payables" />
                <StatCard title="Supplier Dues" value={formatCurrency(financialState.totalSupplierDues)} icon={<Truck />} colorClass="text-orange-500" description="Accounts Payable"/>
                <StatCard title="Customer Dues" value={formatCurrency(financialState.totalCustomerDues)} icon={<Users />} colorClass="text-blue-500" description="Accounts Receivable" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Income vs Expense</CardTitle>
                        <CardDescription>Monthly financial performance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AreaChart
                            className="h-72"
                            data={chartData}
                            index="date"
                            categories={['Income', 'Expense']}
                            colors={['emerald', 'rose']}
                            valueFormatter={formatCurrency}
                            yAxisWidth={60}
                        />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Expense Breakdown</CardTitle>
                         <CardDescription>Top spending categories.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <DonutChart
                            className="h-72"
                            data={expenseByCategory}
                            category="value"
                            index="name"
                            valueFormatter={formatCurrency}
                            colors={["cyan", "blue", "indigo", "violet", "fuchsia"]}
                        />
                    </CardContent>
                </Card>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                     <CardHeader><CardTitle>Top 5 Outstanding Suppliers</CardTitle></CardHeader>
                     <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {topOutstandingSuppliers.map(s => (
                                    <TableRow key={s.id}>
                                        <TableCell>{toTitleCase(s.name)}</TableCell>
                                        <TableCell className="text-right text-destructive font-semibold">{formatCurrency(s.netAmount as number)}</TableCell>
                                    </TableRow>
                                ))}
                                {topOutstandingSuppliers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center h-24">No outstanding supplier dues.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                     </CardContent>
                 </Card>
                 <Card>
                     <CardHeader><CardTitle>Top 5 Outstanding Customers</CardTitle></CardHeader>
                     <CardContent>
                          <Table>
                            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {topOutstandingCustomers.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>{toTitleCase(c.name)}</TableCell>
                                        <TableCell className="text-right text-green-500 font-semibold">{formatCurrency(c.netAmount as number)}</TableCell>
                                    </TableRow>
                                ))}
                                {topOutstandingCustomers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center h-24">No outstanding customer dues.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                     </CardContent>
                 </Card>
            </div>
        </div>
    );
}

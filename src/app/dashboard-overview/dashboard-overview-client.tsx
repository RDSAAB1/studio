
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction, FundTransaction, Loan, BankAccount, Customer, ExpenseCategory } from "@/lib/definitions";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { DonutChart } from '@tremor/react';
import { PiggyBank, Landmark, HandCoins, DollarSign, Scale, TrendingUp, TrendingDown, Users, Truck, Home, List } from 'lucide-react';
import { getExpenseCategories } from '@/lib/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
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
        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers")), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });
        const unsubCustomers = onSnapshot(query(collection(db, "customers")), (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });
        const unsubExpenseCats = getExpenseCategories(setExpenseCategories, console.error);
        
        setLoading(false);

        return () => {
            unsubTransactions();
            unsubFunds();
            unsubLoans();
            unsubBankAccounts();
            unsubSuppliers();
            unsubCustomers();
            unsubExpenseCats();
        };
    }, []);
    
    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        bankAccounts.forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
        balances.set('CashAtHome', 0);

        fundTransactions.forEach(t => {
            if (balances.has(t.source)) balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
        });
        
        transactions.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                const amount = t.amount || 0;
                if (t.transactionType === 'Income') balances.set(balanceKey, (balances.get(balanceKey) || 0) + amount);
                else if (t.transactionType === 'Expense') balances.set(balanceKey, (balances.get(balanceKey) || 0) - amount);
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
        
        return { balances, totalAssets, totalLiabilities, totalSupplierDues, totalCustomerDues, loanLiabilities };
    }, [fundTransactions, transactions, loans, bankAccounts, suppliers, customers]);

    const chartData = useMemo(() => {
        const expenseBreakdown = transactions.filter(t => t.transactionType === 'Expense').reduce((acc, t) => {
            const category = toTitleCase(t.category || 'Uncategorized');
            if (!acc[category]) acc[category] = 0;
            acc[category] += t.amount;
            return acc;
        }, {} as { [key: string]: number });
        
        const incomeBreakdown = transactions.filter(t => t.transactionType === 'Income').reduce((acc, t) => {
            const category = toTitleCase(t.category || 'Uncategorized');
            if (!acc[category]) acc[category] = 0;
            acc[category] += t.amount;
            return acc;
        }, {} as { [key: string]: number });

        const assetBreakdown = Array.from(financialState.balances.entries()).map(([key, value]) => {
             const account = bankAccounts.find(acc => acc.id === key);
             let name = 'Unknown';
             if (account) name = account.accountHolderName;
             else if (key === 'CashInHand') name = 'Cash in Hand';
             else if (key === 'CashAtHome') name = 'Cash at Home';
             return { name, value };
        });
        assetBreakdown.push({ name: 'Customer Dues', value: financialState.totalCustomerDues });
        
        const liabilitiesBreakdown = [
            { name: 'Loan Liabilities', value: financialState.loanLiabilities },
            { name: 'Supplier Dues', value: financialState.totalSupplierDues }
        ];

        return {
            expenseBreakdownChartData: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })).filter(item => item.value > 0),
            incomeBreakdownChartData: Object.entries(incomeBreakdown).map(([name, value]) => ({ name, value })).filter(item => item.value > 0),
            assetBreakdownChartData: assetBreakdown.filter(item => item.value > 0),
            liabilitiesBreakdownChartData: liabilitiesBreakdown.filter(item => item.value > 0),
        };
    }, [transactions, financialState, bankAccounts]);

    if (loading) return <div>Loading Dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" description="Cash, Bank, and Receivables" />
                <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" description="Loans and Payables" />
                <StatCard title="Supplier Dues" value={formatCurrency(financialState.totalSupplierDues)} icon={<Truck />} colorClass="text-orange-500" description="Accounts Payable"/>
                <StatCard title="Customer Dues" value={formatCurrency(financialState.totalCustomerDues)} icon={<Users />} colorClass="text-blue-500" description="Accounts Receivable" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Asset Breakdown</CardTitle><CardDescription>Where your assets are located.</CardDescription></CardHeader>
                    <CardContent className="flex items-center justify-center">
                         <DonutChart className="h-64" data={chartData.assetBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['blue', 'cyan', 'indigo', 'violet', 'fuchsia']} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Liabilities Breakdown</CardTitle><CardDescription>Your financial obligations.</CardDescription></CardHeader>
                    <CardContent className="flex items-center justify-center">
                       <DonutChart className="h-64" data={chartData.liabilitiesBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['orange', 'rose']} />
                    </CardContent>
                </Card>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Income Sources</CardTitle><CardDescription>Where your revenue is coming from.</CardDescription></CardHeader>
                    <CardContent className="flex items-center justify-center">
                         <DonutChart className="h-64" data={chartData.incomeBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['emerald', 'teal', 'green', 'lime']} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Expense Breakdown</CardTitle><CardDescription>Spending distribution by category.</CardDescription></CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <DonutChart className="h-64" data={chartData.expenseBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['slate', 'stone', 'gray', 'zinc', 'neutral']} />
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Recent Activity</CardTitle><CardDescription>The last 10 transactions recorded.</CardDescription></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Payee/Payer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {transactions.slice(0, 10).map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(new Date(tx.date), 'dd-MMM-yy')}</TableCell>
                                    <TableCell><Badge variant={tx.transactionType === 'Income' ? 'default' : 'destructive'} className={cn(tx.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80', 'text-white')}>{tx.transactionType}</Badge></TableCell>
                                    <TableCell>{tx.category}</TableCell>
                                    <TableCell>{tx.payee}</TableCell>
                                    <TableCell className={cn("text-right font-semibold", tx.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(tx.amount)}</TableCell>
                                </TableRow>
                            ))}
                            {transactions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center h-24">No recent transactions found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );

    
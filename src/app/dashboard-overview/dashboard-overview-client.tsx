
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
import { AreaChart, BarChart, DonutChart } from '@tremor/react';
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
        
        return { balances, totalAssets, totalLiabilities, totalSupplierDues, totalCustomerDues };
    }, [fundTransactions, transactions, loans, bankAccounts, suppliers, customers]);

    const chartData = useMemo(() => {
        const incomeExpense = transactions.reduce((acc, t) => {
            const month = format(new Date(t.date), 'MMM yyyy');
            if (!acc[month]) acc[month] = { Income: 0, Expense: 0 };
            acc[month][t.transactionType] += t.amount;
            return acc;
        }, {} as { [key: string]: { Income: number; Expense: number } });

        const expenseBreakdown = transactions.filter(t => t.transactionType === 'Expense').reduce((acc, t) => {
            const category = toTitleCase(t.category || 'Uncategorized');
            if (!acc[category]) acc[category] = 0;
            acc[category] += t.amount;
            return acc;
        }, {} as { [key: string]: number });

        return {
            incomeExpenseChartData: Object.entries(incomeExpense).map(([date, values]) => ({ date, ...values })).reverse(),
            expenseBreakdownChartData: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })),
            financialHealthChartData: [
                { name: "Assets vs Liabilities", "Total Assets": financialState.totalAssets, "Total Liabilities": financialState.totalLiabilities },
                { name: "Dues", "Customer Dues (Receivable)": financialState.totalCustomerDues, "Supplier Dues (Payable)": financialState.totalSupplierDues }
            ],
        };
    }, [transactions, financialState]);

    const topLists = useMemo(() => {
        const topOutstandingSuppliers = suppliers.filter(s => (s.netAmount || 0) > 0).sort((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0)).slice(0, 5);
        const topOutstandingCustomers = customers.filter(c => (c.netAmount || 0) > 0).sort((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0)).slice(0, 5);
        return { topOutstandingSuppliers, topOutstandingCustomers };
    }, [suppliers, customers]);

    if (loading) return <div>Loading Dashboard...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" description="Cash, Bank, and Receivables" />
                <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" description="Loans and Payables" />
                <StatCard title="Supplier Dues" value={formatCurrency(financialState.totalSupplierDues)} icon={<Truck />} colorClass="text-orange-500" description="Accounts Payable"/>
                <StatCard title="Customer Dues" value={formatCurrency(financialState.totalCustomerDues)} icon={<Users />} colorClass="text-blue-500" description="Accounts Receivable" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Financial Health Comparison</CardTitle>
                    <CardDescription>A visual comparison of your assets, liabilities, and dues.</CardDescription>
                </CardHeader>
                <CardContent>
                    <BarChart className="h-80" data={chartData.financialHealthChartData} index="name" categories={["Total Assets", "Total Liabilities", "Customer Dues (Receivable)", "Supplier Dues (Payable)"]} colors={["emerald", "rose", "blue", "orange"]} valueFormatter={formatCurrency} yAxisWidth={80} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Cash & Bank Balances</CardTitle><CardDescription>Your liquid assets at a glance.</CardDescription></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Array.from(financialState.balances.entries()).map(([key, balance]) => {
                            const account = bankAccounts.find(acc => acc.id === key);
                            if (account) return <StatCard key={key} title={account.accountHolderName} value={formatCurrency(balance)} icon={<Landmark />} colorClass="text-blue-500" description={account.bankName}/>
                            if (key === 'CashInHand') return <StatCard key={key} title="Cash in Hand" value={formatCurrency(balance)} icon={<HandCoins />} colorClass="text-yellow-500" description="At Mill/Office"/>
                            if (key === 'CashAtHome') return <StatCard key={key} title="Cash at Home" value={formatCurrency(balance)} icon={<Home />} colorClass="text-orange-500" />
                            return null;
                        })}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Expense Breakdown</CardTitle><CardDescription>Spending distribution by category.</CardDescription></CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <DonutChart className="h-64" data={chartData.expenseBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['cyan', 'violet', 'amber', 'rose', 'indigo', 'emerald']} />
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader><CardTitle>Monthly Performance</CardTitle><CardDescription>Income vs. Expense over time.</CardDescription></CardHeader>
                <CardContent>
                    <AreaChart className="h-80" data={chartData.incomeExpenseChartData} index="date" categories={['Income', 'Expense']} colors={['emerald', 'rose']} valueFormatter={formatCurrency} yAxisWidth={60} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Top 5 Outstanding Suppliers</CardTitle><CardDescription>Your most significant upcoming payments.</CardDescription></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {topLists.topOutstandingSuppliers.map(s => <TableRow key={s.id}><TableCell>{toTitleCase(s.name)}</TableCell><TableCell className="text-right font-semibold text-destructive">{formatCurrency(s.netAmount || 0)}</TableCell></TableRow>)}
                                {topLists.topOutstandingSuppliers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center h-24">No outstanding supplier dues.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Top 5 Outstanding Customers</CardTitle><CardDescription>Your most significant receivables.</CardDescription></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {topLists.topOutstandingCustomers.map(c => <TableRow key={c.id}><TableCell>{toTitleCase(c.name)}</TableCell><TableCell className="text-right font-semibold text-green-500">{formatCurrency(c.netAmount || 0)}</TableCell></TableRow>)}
                                {topLists.topOutstandingCustomers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center h-24">No outstanding customer dues.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
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
}


"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, Project, Transaction } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getBankAccountsRealtime, getProjectsRealtime } from "@/lib/firestore";
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { format, subDays } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Landmark, Home, Activity, Loader2 } from 'lucide-react';
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

const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader className="p-4 pb-0">
            <CardTitle className="text-sm font-semibold text-center">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-48 p-2">
            {children}
        </CardContent>
    </Card>
);

const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57', '#ffc658', '#ff7300'];

const CustomPieChart = ({ data }: { data: { name: string, value: number }[] }) => (
    <ResponsiveContainer width="100%" height="100%">
        <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" nameKey="name" labelLine={false} label={({ percent }) => (percent > 0.05) ? `${(percent * 100).toFixed(0)}%` : ''}>
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend wrapperStyle={{ fontSize: '10px', lineHeight: '12px' }} iconSize={8} />
        </PieChart>
    </ResponsiveContainer>
);

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsClient(true);
        
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
        const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubProjects = getProjectsRealtime(setProjects, console.error);
        
        const unsubIncomes = getIncomeRealtime((data) => {
            setIncomes(data);
            if (expenses.length > 0) setIsLoading(false);
        }, console.error);
        const unsubExpenses = getExpensesRealtime((data) => {
            setExpenses(data);
            if (incomes.length > 0) setIsLoading(false);
        }, console.error);

        return () => {
            unsubSuppliers(); unsubCustomers(); unsubFunds();
            unsubAccounts(); unsubIncomes(); unsubExpenses();
            unsubLoans(); unsubProjects();
        };
    }, [incomes.length, expenses.length]);

    const allTransactions: Transaction[] = useMemo(() => [...incomes, ...expenses], [incomes, expenses]);

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
        
        const totalAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        
        return { balances, totalAssets };
    }, [fundTransactions, allTransactions, bankAccounts]);

    const pieChartData = useMemo(() => {
        const expenseByCategory = expenses.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {} as Record<string, number>);

        const incomeByCategory = incomes.reduce((acc, i) => {
            acc[i.category] = (acc[i.category] || 0) + i.amount;
            return acc;
        }, {} as Record<string, number>);

        const paymentMethods = allTransactions.reduce((acc, t) => {
            const method = t.bankAccountId ? 'Bank' : t.paymentMethod;
            acc[method] = (acc[method] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const suppliersByVariety = suppliers.reduce((acc, s) => {
            const variety = toTitleCase(s.variety);
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const customersByVariety = customers.reduce((acc, c) => {
            const variety = toTitleCase(c.variety);
            acc[variety] = (acc[variety] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const transactionStatus = allTransactions.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const loansByType = loans.reduce((acc, l) => {
            acc[l.loanType] = (acc[l.loanType] || 0) + l.remainingAmount;
            return acc;
        }, {} as Record<string, number>);

        const projectsByStatus = projects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const toChartData = (data: Record<string, number>) => Object.entries(data).map(([name, value]) => ({ name, value }));

        return {
            expenseByCategory: toChartData(expenseByCategory),
            incomeByCategory: toChartData(incomeByCategory),
            paymentMethods: toChartData(paymentMethods),
            suppliersByVariety: toChartData(suppliersByVariety),
            customersByVariety: toChartData(customersByVariety),
            transactionStatus: toChartData(transactionStatus),
            loansByType: toChartData(loansByType),
            projectsByStatus: toChartData(projectsByStatus)
        };
    }, [expenses, incomes, allTransactions, suppliers, customers, loans, projects]);

    if (isLoading && isClient) {
        return <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">Financial Overview</CardTitle>
                    <CardDescription>Your current financial standing across all accounts.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    {Array.from(financialState.balances.entries()).map(([key, balance]) => {
                        const account = bankAccounts.find(acc => acc.id === key);
                        if (account) {
                            return <StatCard key={key} title={account.accountHolderName} value={formatCurrency(balance)} icon={<Landmark />} colorClass="text-blue-500" description={`${account.bankName} (...${account.accountNumber.slice(-4)})`} />
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
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ChartCard title="Expense by Category"><CustomPieChart data={pieChartData.expenseByCategory} /></ChartCard>
                <ChartCard title="Income by Category"><CustomPieChart data={pieChartData.incomeByCategory} /></ChartCard>
                <ChartCard title="Payment Methods"><CustomPieChart data={pieChartData.paymentMethods} /></ChartCard>
                <ChartCard title="Suppliers by Variety"><CustomPieChart data={pieChartData.suppliersByVariety} /></ChartCard>
                <ChartCard title="Customers by Variety"><CustomPieChart data={pieChartData.customersByVariety} /></ChartCard>
                <ChartCard title="Transaction Status"><CustomPieChart data={pieChartData.transactionStatus} /></ChartCard>
                <ChartCard title="Loans by Type"><CustomPieChart data={pieChartData.loansByType} /></ChartCard>
                <ChartCard title="Projects by Status"><CustomPieChart data={pieChartData.projectsByStatus} /></ChartCard>
            </div>
        </div>
    );
}

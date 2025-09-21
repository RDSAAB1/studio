
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getBankAccountsRealtime } from "@/lib/firestore";
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

const ChartCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="h-60">
            {children}
        </CardContent>
    </Card>
);

const PIE_CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsClient(true);
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
        const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        
        const unsubIncomes = getIncomeRealtime((data) => {
            setIncomes(data);
            if(expenses.length > 0) setIsLoading(false);
        }, console.error);
        const unsubExpenses = getExpensesRealtime((data) => {
            setExpenses(data);
            if(incomes.length > 0) setIsLoading(false);
        }, console.error);

        return () => {
            unsubSuppliers(); unsubCustomers(); unsubLoans(); unsubFunds();
            unsubAccounts(); unsubIncomes(); unsubExpenses();
        };
    }, [incomes.length, expenses.length]);

    const allTransactions = useMemo(() => [...(incomes || []), ...(expenses || [])], [incomes, expenses]);

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

    const chartData = useMemo(() => {
        const data: { [key: string]: { date: string, income: number, expense: number } } = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = format(subDays(today, i), 'MMM dd');
            data[date] = { date, income: 0, expense: 0 };
        }
        allTransactions.forEach(t => {
            const date = format(new Date(t.date), 'MMM dd');
            if (data[date]) {
                if (t.transactionType === 'Income') data[date].income += t.amount;
                else data[date].expense += t.amount;
            }
        });
        return Object.values(data);
    }, [allTransactions]);
    
    // Placeholder data for new charts
    const pieData = [{name: 'Group A', value: 400}, {name: 'Group B', value: 300}, {name: 'Group C', value: 300}, {name: 'Group D', value: 200}];
    const barData = [
      {name: 'Jan', uv: 4000, pv: 2400, amt: 2400},
      {name: 'Feb', uv: 3000, pv: 1398, amt: 2210},
      {name: 'Mar', uv: 2000, pv: 9800, amt: 2290},
      {name: 'Apr', uv: 2780, pv: 3908, amt: 2000},
      {name: 'May', uv: 1890, pv: 4800, amt: 2181},
      {name: 'Jun', uv: 2390, pv: 3800, amt: 2500},
    ];

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
                {[...Array(8)].map((_, i) => (
                    <ChartCard key={`pie-${i}`} title={`Pie Chart ${i + 1}`} description="Category distribution">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                                     {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend iconSize={10} wrapperStyle={{fontSize: '12px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </ChartCard>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 {[...Array(4)].map((_, i) => (
                    <ChartCard key={`bar-${i}`} title={`Bar Chart ${i + 1}`} description="Monthly data comparison">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={barData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value))}/>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="pv" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {[...Array(4)].map((_, i) => (
                     <ChartCard key={`area-${i}`} title={`Area Graph ${i + 1}`} description="Data trend over time">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(Number(value))}/>
                                <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), toTitleCase(name)]}/>
                                <Area type="monotone" dataKey="income" stackId="1" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
                                <Area type="monotone" dataKey="expense" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>
                 ))}
            </div>
        </div>
    );
}

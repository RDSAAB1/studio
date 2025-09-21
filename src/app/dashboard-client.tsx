
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, ExpenseCategory, IncomeCategory } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getBankAccountsRealtime, getProjectsRealtime, getExpenseCategories as getExpenseCategoriesFromDB, getIncomeCategories as getIncomeCategoriesFromDB } from "@/lib/firestore";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Landmark, Home, Activity, Loader2, Calendar, BarChart2, ChevronsRight, ChevronsLeft, PieChart as PieChartIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';

const StatCard = ({ title, value, description, icon, colorClass, isLoading, onClick }: { title: string, value: string, description?: string, icon: React.ReactNode, colorClass?: string, isLoading?: boolean, onClick?: () => void }) => (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", onClick && "cursor-pointer")} onClick={onClick}>
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

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [level1, setLevel1] = useState<string | null>(null);
    const [level2, setLevel2] = useState<string | null>(null);
    const [level3, setLevel3] = useState<string | null>(null);
    
    useEffect(() => {
        setIsClient(true);
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
        const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubProjects = getProjectsRealtime(setProjects, console.error);
        const unsubExpCats = getExpenseCategoriesFromDB(setExpenseCategories, console.error);
        const unsubIncCats = getIncomeCategoriesFromDB(setIncomeCategories, console.error);
        
        const unsubIncomes = getIncomeRealtime((data) => { setIncomes(data); }, console.error);
        const unsubExpenses = getExpensesRealtime((data) => { 
            setExpenses(data);
            setIsLoading(false);
        }, console.error);

        return () => {
            unsubSuppliers(); unsubCustomers(); unsubFunds();
            unsubAccounts(); unsubIncomes(); unsubExpenses();
            unsubLoans(); unsubProjects(); unsubExpCats(); unsubIncCats();
        };
    }, []);

    const allTransactions: (Income | Expense)[] = useMemo(() => [...incomes, ...expenses], [incomes, expenses]);

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
        const totalLiabilities = loans.reduce((sum, loan) => sum + (loan.remainingAmount || 0), 0);
        
        return { balances, totalAssets, totalLiabilities };
    }, [fundTransactions, allTransactions, bankAccounts, loans]);

    // --- Chart Data Calculation ---
    const level1Data = useMemo(() => {
        const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
        return [{ name: 'Income', value: totalIncome }, { name: 'Expenses', value: totalExpense }];
    }, [incomes, expenses]);

    const level2Data = useMemo(() => {
        if (!level1) return [];
        if (level1 === 'Expenses') {
            const permanent = expenses.filter(e => e.expenseNature === 'Permanent').reduce((sum, item) => sum + item.amount, 0);
            const seasonal = expenses.filter(e => e.expenseNature === 'Seasonal').reduce((sum, item) => sum + item.amount, 0);
            return [{ name: 'Permanent', value: permanent }, { name: 'Seasonal', value: seasonal }];
        }
        if (level1 === 'Income') {
            return groupDataByField(incomes, 'category');
        }
        return [];
    }, [level1, expenses, incomes]);

    const level3Data = useMemo(() => {
        if (!level1 || !level2) return [];
        let sourceData: (Income | Expense)[] = [];
        if (level1 === 'Expenses') {
            sourceData = expenses.filter(e => e.expenseNature === level2);
        } else if (level1 === 'Income' && incomeCategories.some(c => c.name === level2)) {
             sourceData = incomes.filter(i => i.category === level2);
             return groupDataByField(sourceData, 'subCategory');
        }
        return groupDataByField(sourceData, 'category');
    }, [level1, level2, expenses, incomes, incomeCategories]);
    
    const level4Data = useMemo(() => {
        if (!level1 || !level2 || !level3) return [];
        let sourceData = expenses.filter(e => e.expenseNature === level2 && e.category === level3);
        return groupDataByField(sourceData, 'subCategory');
    }, [level1, level2, level3, expenses]);


    function groupDataByField(data: (Income | Expense)[], field: 'category' | 'subCategory') {
        const grouped = data.reduce((acc, item) => {
            const key = item[field] || 'Uncategorized';
            acc[key] = (acc[key] || 0) + item.amount;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(grouped).map(([name, value]) => ({ name, value }));
    }

    const breadcrumbs = ['Overview'];
    if (level1) breadcrumbs.push(level1);
    if (level2) breadcrumbs.push(level2);
    if (level3) breadcrumbs.push(level3);

    const handleBreadcrumbClick = (index: number) => {
        if (index < 3) setLevel3(null);
        if (index < 2) setLevel2(null);
        if (index < 1) setLevel1(null);
    };

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
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                    <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" description="Based on loans" />
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5 text-primary"/>
                        Financial Breakdown
                    </CardTitle>
                     <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={crumb}>
                                <Button
                                    variant="link"
                                    onClick={() => handleBreadcrumbClick(index)}
                                    className="p-0 h-auto text-sm text-muted-foreground hover:text-primary disabled:text-foreground disabled:no-underline"
                                    disabled={index === breadcrumbs.length - 1}
                                >
                                    {toTitleCase(crumb)}
                                </Button>
                                {index < breadcrumbs.length - 1 && <ChevronsRight size={14} />}
                            </React.Fragment>
                        ))}
                    </div>
                </CardHeader>
                <CardContent className="h-96">
                   <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}/>

                            {/* Level 1: Innermost - Income vs Expense */}
                            <Pie
                                data={level1Data}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                onClick={(data) => { setLevel1(data.name); setLevel2(null); setLevel3(null); }}
                                stroke="hsl(var(--card))"
                                strokeWidth={4}
                            >
                                {level1Data.map((entry, index) => (
                                    <Cell key={`cell-0-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            
                            {/* Level 2: Permanent vs Seasonal or Income Categories */}
                            {level1 && <Pie
                                data={level2Data}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={90}
                                onClick={(data) => { setLevel2(data.name); setLevel3(null); }}
                                labelLine={false}
                                label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                stroke="hsl(var(--card))"
                                strokeWidth={4}
                            >
                                {level2Data.map((entry, index) => (
                                    <Cell key={`cell-1-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>}
                            
                             {/* Level 3: Expense Categories or Income Sub-categories */}
                            {level2 && <Pie
                                data={level3Data}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={100}
                                outerRadius={120}
                                onClick={(data) => setLevel3(data.name)}
                                labelLine={false}
                                label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                stroke="hsl(var(--card))"
                                strokeWidth={4}
                            >
                                {level3Data.map((entry, index) => (
                                    <Cell key={`cell-2-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>}
                            
                            {/* Level 4: Expense Sub-categories */}
                            {level3 && <Pie
                                data={level4Data}
                                dataKey="value"
                                cx="50%"
                                cy="50%"
                                innerRadius={130}
                                outerRadius={150}
                                labelLine={false}
                                label={({ name, percent }) => percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                stroke="hsl(var(--card))"
                                strokeWidth={4}
                            >
                                {level4Data.map((entry, index) => (
                                    <Cell key={`cell-3-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>}
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

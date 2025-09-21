
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, Project, ExpenseCategory } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getBankAccountsRealtime, getProjectsRealtime, getExpenseCategories } from "@/lib/firestore";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import * as RechartsPrimitive from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Landmark, Home, Activity, Loader2, Calendar, BarChart2, ChevronsRight, ChevronsLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

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

const NestedPieChart = ({ data, onLevel1Click, onLevel2Click, onLevel3Click, breadcrumbs, onBreadcrumbClick }: any) => {
    return (
        <div className="w-full h-[450px] relative">
             <div className="absolute top-0 left-2 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb: any, index: number) => (
                    <span key={index}>
                        <button onClick={() => onBreadcrumbClick(index)} className="hover:underline disabled:no-underline disabled:cursor-default" disabled={index === breadcrumbs.length -1}>
                            {crumb.name}
                        </button>
                        {index < breadcrumbs.length - 1 && <ChevronsRight className="inline h-4 w-4 mx-1" />}
                    </span>
                ))}
            </div>
            <ResponsiveContainer>
                <PieChart>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    
                    <Pie
                        data={data.level1} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius="100%" innerRadius="80%"
                        onClick={(e) => onLevel1Click(e.name)} className="cursor-pointer"
                    >
                        {data.level1.map((entry: any, index: number) => <Cell key={`cell-l1-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>

                    {data.level2.length > 0 && (
                        <Pie
                            data={data.level2} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius="75%" innerRadius="55%"
                            onClick={(e) => onLevel2Click(e.name)} className="cursor-pointer"
                        >
                           {data.level2.map((entry: any, index: number) => <Cell key={`cell-l2-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                    )}

                     {data.level3.length > 0 && (
                        <Pie
                            data={data.level3} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius="50%" innerRadius="30%"
                            onClick={(e) => onLevel3Click(e.name)} className="cursor-pointer"
                        >
                            {data.level3.map((entry: any, index: number) => <Cell key={`cell-l3-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                    )}
                     {data.level4.length > 0 && (
                        <Pie
                            data={data.level4} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius="25%" innerRadius="0%"
                            labelLine={false}
                            label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        >
                           {data.level4.map((entry: any, index: number) => <Cell key={`cell-l4-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                    )}
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedView, setSelectedView] = useState<'Overview' | 'Income' | 'Expense'>('Overview');
    const [selectedNature, setSelectedNature] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
        
        const unsubSuppliers = getSuppliersRealtime(setSuppliers, console.error);
        const unsubCustomers = getCustomersRealtime(setCustomers, console.error);
        const unsubFunds = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);
        const unsubProjects = getProjectsRealtime(setProjects, console.error);
        const unsubExpCats = getExpenseCategories(setExpenseCategories, console.error);
        
        const unsubIncomes = getIncomeRealtime((data) => { setIncomes(data); }, console.error);
        const unsubExpenses = getExpensesRealtime((data) => { 
            setExpenses(data);
            setIsLoading(false);
        }, console.error);

        return () => {
            unsubSuppliers(); unsubCustomers(); unsubFunds();
            unsubAccounts(); unsubIncomes(); unsubExpenses();
            unsubLoans(); unsubProjects(); unsubExpCats();
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

    const nestedPieData = useMemo(() => {
        const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);

        let level1: any[] = [];
        let level2: any[] = [];
        let level3: any[] = [];
        let level4: any[] = [];

        if (selectedView === 'Overview') {
            level1 = [
                { name: 'Income', value: totalIncome },
                { name: 'Expense', value: totalExpense },
            ].filter(d => d.value > 0);
        } else if (selectedView === 'Income') {
             // For income, we just have one level of categories for now.
            const incomeByCategory = incomes.reduce((acc, item) => {
                const category = item.category || 'Uncategorized';
                acc[category] = (acc[category] || 0) + item.amount;
                return acc;
            }, {} as { [key: string]: number });

            level1 = Object.entries(incomeByCategory).map(([name, value]) => ({ name, value }));

        } else if (selectedView === 'Expense') {
            const expenseData = {
                name: 'Expenses',
                children: [
                    { name: 'Permanent', children: [] as any[] },
                    { name: 'Seasonal', children: [] as any[] },
                ],
            };

            const categoryMap = new Map<string, any>();
            expenseCategories.forEach(cat => {
                categoryMap.set(cat.name, { name: cat.name, nature: cat.nature, children: (cat.subCategories || []).map(sub => ({ name: sub, value: 0 })) });
            });

            expenses.forEach(exp => {
                const categoryNode = categoryMap.get(exp.category);
                if (categoryNode) {
                    const subCategoryNode = categoryNode.children.find((sub: any) => sub.name === exp.subCategory);
                    if (subCategoryNode) subCategoryNode.value += exp.amount;
                }
            });

            categoryMap.forEach(catNode => {
                expenseData.children.find(n => n.name === catNode.nature)?.children.push(catNode);
            });
            
            level1 = expenseData.children.map(nature => ({
                name: nature.name,
                value: nature.children.reduce((sum, cat) => sum + cat.children.reduce((s: any, sub: any) => s + sub.value, 0), 0),
            })).filter(d => d.value > 0);

            if (selectedNature) {
                const natureNode = expenseData.children.find(n => n.name === selectedNature);
                if (natureNode) {
                    level2 = natureNode.children.map(cat => ({
                        name: cat.name,
                        value: cat.children.reduce((s: any, sub: any) => s + sub.value, 0),
                    })).filter(d => d.value > 0);
                }
            }
            
            if (selectedNature && selectedCategory) {
                const natureNode = expenseData.children.find(n => n.name === selectedNature);
                const categoryNode = natureNode?.children.find((c: any) => c.name === selectedCategory);
                if (categoryNode) {
                    level3 = categoryNode.children.filter((sub: any) => sub.value > 0);
                }
            }
        }
        
        return { level1, level2, level3, level4 };
    }, [incomes, expenses, expenseCategories, selectedView, selectedNature, selectedCategory]);

    const breadcrumbs = useMemo(() => {
        const crumbs: { name: string; level: number }[] = [{ name: 'Overview', level: 0 }];
        if (selectedView === 'Income' || selectedView === 'Expense') {
            crumbs.push({ name: selectedView, level: 1 });
        }
        if (selectedView === 'Expense' && selectedNature) {
            crumbs.push({ name: selectedNature, level: 2 });
        }
        if (selectedView === 'Expense' && selectedNature && selectedCategory) {
            crumbs.push({ name: selectedCategory, level: 3 });
        }
        return crumbs;
    }, [selectedView, selectedNature, selectedCategory]);

    const handleLevel1Click = (name: string) => {
        if (selectedView === 'Overview') {
            if (name === 'Income' || name === 'Expense') {
                setSelectedView(name);
            }
        } else if (selectedView === 'Expense') {
            setSelectedNature(prev => prev === name ? null : name);
            setSelectedCategory(null);
        }
    };
    
    const handleLevel2Click = (name: string) => {
        if (selectedView === 'Expense' && selectedNature) {
            setSelectedCategory(prev => prev === name ? null : name);
        }
    };

    const handleBreadcrumbClick = (level: number) => {
        if (level === 0) {
            setSelectedView('Overview');
            setSelectedNature(null);
            setSelectedCategory(null);
        } else if (level === 1) {
            setSelectedNature(null);
            setSelectedCategory(null);
        } else if (level === 2) {
            setSelectedCategory(null);
        }
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
                    <CardTitle>Data Breakdown</CardTitle>
                    <CardDescription>Click on a section to drill down into categories and sub-categories.</CardDescription>
                </CardHeader>
                <CardContent>
                    <NestedPieChart 
                        data={nestedPieData}
                        onLevel1Click={handleLevel1Click}
                        onLevel2Click={handleLevel2Click}
                        onLevel3Click={() => {}} // Placeholder for future deeper drilldown
                        breadcrumbs={breadcrumbs}
                        onBreadcrumbClick={handleBreadcrumbClick}
                    />
                </CardContent>
            </Card>
        </div>
    );
}


    

"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, Project, Transaction, ExpenseCategory } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getBankAccountsRealtime, getProjectsRealtime, getExpenseCategories } from "@/lib/firestore";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, BarChart, Bar, Treemap, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Landmark, Home, Activity, Loader2, Calendar, BarChart2, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

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

const ChartCard = ({ title, description, children, footer }: { title: string, description?: string, children: React.ReactNode, footer?: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="pl-0">
            {children}
        </CardContent>
        {footer && <CardContent className="pt-4">{footer}</CardContent>}
    </Card>
);

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F', '#FFBB28'];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background/80 backdrop-blur-sm border border-border p-2 rounded-lg shadow-lg">
                <p className="text-sm font-bold">{data.name}</p>
                <p className="text-xs text-primary">{`${formatCurrency(data.value)}`}</p>
            </div>
        );
    }
    return null;
};

// Custom component for rendering the treemap content with depth-based coloring
const CustomizedContent = (props: any) => {
  const { root, depth, x, y, width, height, index, colors, name } = props;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? colors[index % colors.length] : 'none',
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {depth === 1 ? (
        <text x={x + width / 2} y={y + height / 2 + 7} textAnchor="middle" fill="#fff" fontSize={14}>
          {name}
        </text>
      ) : null}
       {depth > 1 && width > 80 && height > 20 ? (
        <text x={x + 4} y={y + 18} fillOpacity={0.7} fontSize={12} fill="#fff">
            {name}
        </text>
       ) : null}
    </g>
  );
};


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

    const [sunburstHistory, setSunburstHistory] = useState<string[]>([]);
    const currentSunburstLevelName = sunburstHistory[sunburstHistory.length - 1] || 'Expenses';

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
        const totalLiabilities = loans.reduce((sum, loan) => sum + (loan.remainingAmount || 0), 0);

        
        return { balances, totalAssets, totalLiabilities };
    }, [fundTransactions, allTransactions, bankAccounts, loans]);
    
     const expenseTreemapData = useMemo(() => {
        const permanentExpenses = { name: 'Permanent', children: [] as any[] };
        const seasonalExpenses = { name: 'Seasonal', children: [] as any[] };

        expenseCategories.forEach(cat => {
            const categoryNode = { name: cat.name, children: [] as any[] };
            
            const expensesInCategory = expenses.filter(exp => exp.category === cat.name);
            
            if (cat.subCategories && cat.subCategories.length > 0) {
                 cat.subCategories.forEach(subCat => {
                    const expensesInSubCat = expensesInCategory.filter(exp => exp.subCategory === subCat);
                    const total = expensesInSubCat.reduce((sum, exp) => sum + exp.amount, 0);
                    if (total > 0) {
                        categoryNode.children.push({ name: subCat, value: total });
                    }
                });
            } else {
                 const total = expensesInCategory.reduce((sum, exp) => sum + exp.amount, 0);
                 if (total > 0) {
                     // If no sub-categories, use the category itself as a leaf node
                     categoryNode.children.push({ name: cat.name, value: total });
                 }
            }
            
            if (categoryNode.children.length > 0) {
                if (cat.nature === 'Permanent') {
                    permanentExpenses.children.push(categoryNode);
                } else if (cat.nature === 'Seasonal') {
                    seasonalExpenses.children.push(categoryNode);
                }
            }
        });
        
        return [permanentExpenses, seasonalExpenses].filter(nature => nature.children.length > 0);
    }, [expenses, expenseCategories]);
    
    const currentSunburstData = useMemo(() => {
        if (sunburstHistory.length === 0) return expenseTreemapData;
        let data: any[] | undefined = expenseTreemapData;
        for (const level of sunburstHistory) {
            const found = data?.find(item => item.name === level);
            data = found?.children;
        }
        return data;
    }, [sunburstHistory, expenseTreemapData]);
    
    const handleSunburstClick = (data: any) => {
        if (data && data.children) {
            setSunburstHistory(prev => [...prev, data.name]);
        }
    };

    const handleBreadcrumbClick = (index: number) => {
        setSunburstHistory(prev => prev.slice(0, index));
    }


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
            
            <ChartCard 
                title="Expense Breakdown" 
                description={`Showing: ${currentSunburstLevelName}. Click on a section to drill down.`}
                footer={
                     <div className="flex items-center text-sm text-muted-foreground p-2">
                        <button onClick={() => handleBreadcrumbClick(0)} className="hover:text-primary">Expenses</button>
                        {sunburstHistory.map((level, index) => (
                            <React.Fragment key={level}>
                                <ChevronsRight className="h-4 w-4 mx-1" />
                                <button onClick={() => handleBreadcrumbClick(index + 1)} className="hover:text-primary">{level}</button>
                            </React.Fragment>
                        ))}
                    </div>
                }
            >
                <ResponsiveContainer width="100%" height={400}>
                    <Treemap
                        data={currentSunburstData}
                        dataKey="value"
                        ratio={4 / 3}
                        stroke="#fff"
                        fill="#8884d8"
                        content={<CustomizedContent colors={COLORS} />}
                        onClick={handleSunburstClick}
                        aspectRatio={1}
                    >
                         <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </ChartCard>

        </div>
    );
}


"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, ExpenseCategory, IncomeCategory, Project, Payment } from '@/lib/definitions';
import { getSuppliersRealtime, getCustomersRealtime, getLoansRealtime, getFundTransactionsRealtime, getIncomeRealtime, getExpensesRealtime, getPaymentsRealtime, getBankAccountsRealtime, getProjectsRealtime, getExpenseCategories as getExpenseCategoriesFromDB, getIncomeCategories as getIncomeCategoriesFromDB } from "@/lib/firestore";
import { formatCurrency, toTitleCase, cn } from "@/lib/utils";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, PiggyBank, HandCoins, Landmark, Home, Activity, Loader2, Calendar, BarChart2, ChevronsRight, ChevronsLeft, PieChart as PieChartIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';

const StatCard = ({ title, value, icon, colorClass, isLoading }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, isLoading?: boolean }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
                <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
            )}
        </CardContent>
    </Card>
);

const PIE_COLORS = ['#22c55e', '#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [date, setDate] = React.useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

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
        const unsubPayments = getPaymentsRealtime(setPayments, console.error);
        
        const unsubIncomes = getIncomeRealtime((data) => { setIncomes(data); }, console.error);
        const unsubExpenses = getExpensesRealtime((data) => { 
            setExpenses(data);
            setIsLoading(false);
        }, console.error);

        return () => {
            unsubSuppliers(); unsubCustomers(); unsubFunds();
            unsubAccounts(); unsubIncomes(); unsubExpenses();
            unsubLoans(); unsubProjects(); unsubExpCats(); unsubIncCats();
            unsubPayments();
        };
    }, []);
    
    const allExpenses = useMemo(() => {
        const mappedPayments = payments.map(p => ({
            id: p.id,
            date: p.date,
            transactionType: 'Expense',
            category: 'Supplier Payments',
            subCategory: p.rtgsFor === 'Outsider' ? 'Outsider Payment' : 'Supplier Payment',
            amount: p.amount,
            payee: p.supplierName || 'N/A',
            description: p.notes || `Payment ${p.paymentId}`,
            paymentMethod: p.receiptType,
            status: 'Paid',
            isRecurring: false,
            bankAccountId: p.bankAccountId,
        }));
        return [...expenses, ...mappedPayments];
    }, [expenses, payments]);

    const filteredData = useMemo(() => {
        if (!date || !date.from) {
            return { filteredIncomes: incomes, filteredExpenses: allExpenses, filteredSuppliers: suppliers, filteredCustomers: customers };
        }
        
        const interval = { 
            start: startOfDay(date.from), 
            end: endOfDay(date.to || date.from) 
        };
        const filterFn = (item: { date: string }) => isWithinInterval(new Date(item.date), interval);

        return {
            filteredIncomes: incomes.filter(filterFn),
            filteredExpenses: allExpenses.filter(filterFn),
            filteredSuppliers: suppliers.filter(filterFn),
            filteredCustomers: customers.filter(filterFn),
        };
    }, [date, incomes, allExpenses, suppliers, customers]);


    const allTransactions: (Income | Expense)[] = useMemo(() => [...filteredData.filteredIncomes, ...filteredData.filteredExpenses], [filteredData]);
    
    const { totalIncome, totalExpense, netProfit, totalSupplierDues, totalCustomerReceivables } = useMemo(() => {
        return {
            totalIncome: filteredData.filteredIncomes.reduce((sum, item) => sum + item.amount, 0),
            totalExpense: filteredData.filteredExpenses.reduce((sum, item) => sum + item.amount, 0),
            netProfit: filteredData.filteredIncomes.reduce((sum, item) => sum + item.amount, 0) - filteredData.filteredExpenses.reduce((sum, item) => sum + item.amount, 0),
            totalSupplierDues: suppliers.reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0),
            totalCustomerReceivables: customers.reduce((sum, c) => sum + (Number(c.netAmount) || 0), 0)
        }
    }, [filteredData, suppliers, customers]);
    
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
        
        [...incomes, ...allExpenses].forEach(t => {
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
        const totalLoanLiabilities = loans.reduce((sum, loan) => sum + (loan.remainingAmount || 0), 0);
        const totalLiabilities = totalLoanLiabilities + totalSupplierDues;
        const workingCapital = totalAssets - totalLiabilities;
        
        return { balances, totalAssets, totalLiabilities, workingCapital };
    }, [fundTransactions, incomes, allExpenses, bankAccounts, loans, totalSupplierDues]);

    // --- Chart Data Calculation ---
    const level1Data = useMemo(() => {
        const totalIncome = filteredData.filteredIncomes.reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = filteredData.filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
        return [{ name: 'Income', value: totalIncome }, { name: 'Expenses', value: totalExpense }];
    }, [filteredData]);

    const level2Data = useMemo(() => {
        if (!level1) return [];
        if (level1 === 'Expenses') {
            const permanent = filteredData.filteredExpenses.filter(e => e.expenseNature === 'Permanent').reduce((sum, item) => sum + item.amount, 0);
            const seasonal = filteredData.filteredExpenses.filter(e => e.expenseNature === 'Seasonal').reduce((sum, item) => sum + item.amount, 0);
            return [{ name: 'Permanent', value: permanent }, { name: 'Seasonal', value: seasonal }];
        }
        if (level1 === 'Income') {
            return groupDataByField(filteredData.filteredIncomes, 'category');
        }
        return [];
    }, [level1, filteredData, incomeCategories]);

    const level3Data = useMemo(() => {
        if (!level1 || !level2) return [];
        let sourceData: (Income | Expense)[] = [];
        if (level1 === 'Expenses') {
            sourceData = filteredData.filteredExpenses.filter(e => e.expenseNature === level2);
        } else if (level1 === 'Income' && incomeCategories.some(c => c.name === level2)) {
             sourceData = filteredData.filteredIncomes.filter(i => i.category === level2);
             return groupDataByField(sourceData, 'subCategory');
        }
        return groupDataByField(sourceData, 'category');
    }, [level1, level2, filteredData, incomeCategories]);
    
    const level4Data = useMemo(() => {
        if (!level1 || !level2 || !level3) return [];
        let sourceData = filteredData.filteredExpenses.filter(e => e.expenseNature === level2 && e.category === level3);
        return groupDataByField(sourceData, 'subCategory');
    }, [level1, level2, level3, filteredData]);
    
    const incomeExpenseChartData = useMemo(() => {
        const grouped = [...filteredData.filteredIncomes, ...filteredData.filteredExpenses].reduce((acc, t) => {
            const day = format(new Date(t.date), 'MMM dd');
            if (!acc[day]) acc[day] = { date: day, income: 0, expense: 0 };
            if (t.transactionType === 'Income') acc[day].income += t.amount;
            else acc[day].expense += t.amount;
            return acc;
        }, {} as Record<string, { date: string, income: number, expense: number }>);
        return Object.values(grouped).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [filteredData]);
    
    const assetsLiabilitiesData = useMemo(() => {
        return [
            { name: 'Total Assets', value: financialState.totalAssets },
            { name: 'Total Liabilities', value: financialState.totalLiabilities }
        ];
    }, [financialState]);
    
    const fundSourcesData = useMemo(() => {
         return Array.from(financialState.balances.entries()).map(([key, value]) => {
            const account = bankAccounts.find(acc => acc.id === key);
            let name = toTitleCase(key.replace(/([A-Z])/g, ' $1').trim());
            if (account) {
                name = `${account.accountHolderName} (...${account.accountNumber.slice(-4)})`;
            }
            return { name, value };
        }).filter(item => item.value > 0);
    }, [financialState.balances, bankAccounts]);


    const paymentMethodData = useMemo(() => {
        const groupedBySource = allTransactions.reduce((acc, item) => {
            let key = 'Other';
            if(item.bankAccountId) {
                 const bank = bankAccounts.find(b => b.id === item.bankAccountId);
                 key = bank ? bank.accountHolderName : 'Other Bank';
            } else if (item.paymentMethod === 'Cash') {
                key = 'Cash in Hand';
            } else if (item.paymentMethod === 'RTGS') {
                key = 'RTGS';
            }
            acc[key] = (acc[key] || 0) + item.amount;
            return acc;
        }, {} as { [key: string]: number });
    
        return Object.entries(groupedBySource).map(([name, value]) => ({ name: toTitleCase(name), value }));
    }, [allTransactions, bankAccounts]);
    

    function groupDataByField(data: (Income | Expense)[], field: keyof (Income|Expense)) {
        const grouped = data.reduce((acc, item) => {
            const key = (item as any)[field] || 'Uncategorized';
            acc[key] = (acc[key] || 0) + item.amount;
            return acc;
        }, {} as { [key: string]: number });

        return Object.entries(grouped).map(([name, value]) => ({ name: toTitleCase(name), value }));
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
    
    const customTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2 border rounded-lg bg-background/80 backdrop-blur-sm shadow-md text-xs">
                    <p className="label font-bold">{label}</p>
                    {payload.map((p: any) => (
                         <p key={p.dataKey} style={{ color: p.color }}>{`${p.name}: ${formatCurrency(p.value)}`}</p>
                    ))}
                </div>
            );
        }
        return null;
    };
    
     const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
        if (percent < 0.02) return null; // Hide label for very small slices
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold pointer-events-none">
                 {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    const DetailTree = () => {
        const totalL1 = level1Data.reduce((sum, i) => sum + i.value, 0);
        const totalL2 = level2Data.reduce((sum, i) => sum + i.value, 0);
        const totalL3 = level3Data.reduce((sum, i) => sum + i.value, 0);
        const totalL4 = level4Data.reduce((sum, i) => sum + i.value, 0);

        const renderNode = (item: {name: string, value: number}, level: number, total: number, onClick: () => void, isSelected: boolean) => (
            <div 
                key={item.name} 
                onClick={onClick} 
                className={cn(
                    "flex justify-between items-center text-sm p-2 rounded-md cursor-pointer hover:bg-accent/50", 
                    isSelected && "bg-accent font-semibold",
                    `pl-${level * 4}`
                )}
            >
                <span>{toTitleCase(item.name)}</span>
                <div className="text-right">
                    <p>{formatCurrency(item.value)}</p>
                    <p className="text-xs text-muted-foreground">{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</p>
                </div>
            </div>
        );

        return (
            <ScrollArea className="h-[400px]">
                <div className="space-y-1 p-1">
                    {level1Data.map(l1Item => (
                        <div key={l1Item.name}>
                            {renderNode(l1Item, 0, totalL1, () => setLevel1(l1Item.name), level1 === l1Item.name)}
                            {level1 === l1Item.name && level2Data.length > 0 && (
                                <div className="ml-4 border-l border-primary/20">
                                    {level2Data.map(l2Item => (
                                        <div key={l2Item.name}>
                                            {renderNode(l2Item, 1, totalL2, () => setLevel2(l2Item.name), level2 === l2Item.name)}
                                            {level2 === l2Item.name && level3Data.length > 0 && (
                                                <div className="ml-4 border-l border-green-500/20">
                                                    {level3Data.map(l3Item => (
                                                        <div key={l3Item.name}>
                                                            {renderNode(l3Item, 2, totalL3, () => setLevel3(l3Item.name), level3 === l3Item.name)}
                                                            {level3 === l3Item.name && level4Data.length > 0 && (
                                                                <div className="ml-4 border-l border-red-500/20">
                                                                    {level4Data.map(l4Item => renderNode(l4Item, 3, totalL4, () => {}, false))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        )
    }
    
    if (isLoading && isClient) {
        return <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }


    return (
        <div className="space-y-6">
            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2">Dashboard</CardTitle>
                    <CardDescription>Filter and view your business overview.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2">
                    <DateRangePicker date={date} onDateChange={setDate} />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
                        <Button variant="outline" size="sm" onClick={() => setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}>This Week</Button>
                        <Button variant="outline" size="sm" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                        <Button variant="outline" size="sm" onClick={() => setDate({ from: subDays(new Date(), 29), to: new Date() })}>Last 30 Days</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard title="Total Income" value={formatCurrency(totalIncome)} icon={<TrendingUp />} colorClass="text-green-500" isLoading={isLoading}/>
                <StatCard title="Total Expense" value={formatCurrency(totalExpense)} icon={<TrendingDown />} colorClass="text-red-500" isLoading={isLoading}/>
                <StatCard title="Net Profit/Loss" value={formatCurrency(netProfit)} icon={<DollarSign />} colorClass={netProfit >= 0 ? "text-green-500" : "text-red-500"} isLoading={isLoading}/>
                <StatCard title="Supplier Dues" value={formatCurrency(totalSupplierDues)} icon={<Users />} colorClass="text-amber-500" isLoading={isLoading}/>
                <StatCard title="Customer Receivables" value={formatCurrency(totalCustomerReceivables)} icon={<Users />} colorClass="text-blue-500" isLoading={isLoading}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-64">
                    <CardHeader>
                        <CardTitle>Assets vs. Liabilities</CardTitle>
                    </CardHeader>
                    <CardContent className="h-48 grid grid-cols-2 items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip content={customTooltip} />
                                <Pie data={assetsLiabilitiesData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}>
                                    {assetsLiabilitiesData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Total Assets' ? '#22c55e' : '#ef4444'} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                             {assetsLiabilitiesData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: entry.name === 'Total Assets' ? '#22c55e' : '#ef4444'}}></div>
                                    <div className="text-sm">
                                        <p className="text-muted-foreground">{entry.name}</p>
                                        <p className="font-semibold">{formatCurrency(entry.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="h-64">
                    <CardHeader>
                        <CardTitle>Payment Methods</CardTitle>
                    </CardHeader>
                    <CardContent className="h-48 grid grid-cols-2 items-center gap-4">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip content={customTooltip}/>
                                <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}>
                                     {paymentMethodData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 overflow-y-auto max-h-full">
                             {paymentMethodData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: PIE_COLORS[index % PIE_COLORS.length]}}></div>
                                    <div className="text-sm">
                                        <p className="text-muted-foreground truncate">{entry.name}</p>
                                        <p className="font-semibold">{formatCurrency(entry.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="h-auto md:col-span-2">
                    <CardHeader>
                        <CardTitle>Fund Sources</CardTitle>
                    </CardHeader>
                    <CardContent className="h-auto grid grid-cols-2 items-center gap-4">
                         <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Tooltip content={customTooltip}/>
                                <Pie data={fundSourcesData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                                     {fundSourcesData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2">
                             {fundSourcesData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: PIE_COLORS[index % PIE_COLORS.length]}}></div>
                                    <div className="text-sm overflow-hidden">
                                        <p className="text-muted-foreground truncate" title={entry.name}>{entry.name}</p>
                                        <p className="font-semibold">{formatCurrency(entry.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                    <CardTitle>Income vs. Expense</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={incomeExpenseChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip content={customTooltip} />
                            <Legend />
                            <Area type="monotone" dataKey="income" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} />
                            <Area type="monotone" dataKey="expense" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                        </AreaChart>
                    </ResponsiveContainer>
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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Tooltip content={customTooltip} />
                                <Pie data={level1Data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="hsl(var(--card))" strokeWidth={4} onClick={(data) => { setLevel1(data.name); setLevel2(null); setLevel3(null); }}>
                                    {level1Data.map((entry, index) => ( <Cell key={`cell-0-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                                </Pie>
                                {level1 && <Pie data={level2Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={90} outerRadius={120} label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={4} onClick={(data) => { setLevel2(data.name); setLevel3(null); }}>
                                    {level2Data.map((entry, index) => ( <Cell key={`cell-1-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                                </Pie>}
                                {level2 && <Pie data={level3Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={130} outerRadius={160} label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={4} onClick={(data) => setLevel3(data.name)}>
                                    {level3Data.map((entry, index) => ( <Cell key={`cell-2-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                                </Pie>}
                                {level3 && <Pie data={level4Data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={170} outerRadius={200} label={renderCustomizedLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={4}>
                                    {level4Data.map((entry, index) => ( <Cell key={`cell-3-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} /> ))}
                                </Pie>}
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <DetailTree />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    

    

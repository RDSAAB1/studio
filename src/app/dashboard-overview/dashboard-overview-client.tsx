
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Income, Expense, FundTransaction, Loan, BankAccount, Customer, ExpenseCategory, Payment } from "@/lib/definitions";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, subDays, differenceInMonths } from 'date-fns';
import { DonutChart, BarChart, AreaChart } from '@tremor/react';
import { PiggyBank, Landmark, HandCoins, DollarSign, Scale, TrendingUp, TrendingDown, Users, Truck, Home, List, Bank, Percent } from 'lucide-react';
import { getExpenseCategories, getIncomeRealtime, getExpensesRealtime, getFundTransactionsRealtime, getPaymentsRealtime, getLoansRealtime, getBankAccountsRealtime, getSuppliersRealtime, getCustomersRealtime } from "@/lib/firestore";

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

const BalanceCard = ({ title, value, icon, colorClass, description }: { title: string, value: string, icon: React.ReactNode, colorClass?: string, description?: string }) => (
    <Card className="bg-card/60 backdrop-blur-sm border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="text-muted-foreground">{icon}</div>
        </CardHeader>
        <CardContent>
            <div className={`text-xl font-bold ${colorClass}`}>{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export default function DashboardOverviewClient() {
    const incomes = useLiveQuery(getIncomeRealtime) || [];
    const expenses = useLiveQuery(getExpensesRealtime) || [];
    const fundTransactions = useLiveQuery(getFundTransactionsRealtime) || [];
    const payments = useLiveQuery(getPaymentsRealtime) || [];
    const loans = useLiveQuery(getLoansRealtime) || [];
    const bankAccounts = useLiveQuery(getBankAccountsRealtime) || [];
    const suppliers = useLiveQuery(getSuppliersRealtime) || [];
    const customers = useLiveQuery(getCustomersRealtime) || [];
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [isClient, setIsClient] = useState(false);

    const allTransactions = useMemo(() => [...(Array.isArray(incomes) ? incomes : []), ...(Array.isArray(expenses) ? expenses : [])], [incomes, expenses]);

    useEffect(() => {
        setIsClient(true);
        // Expense categories are not part of the offline-first sync yet, so we fetch them directly.
        const unsubExpenseCats = getExpenseCategories(setExpenseCategories, console.error);
        return () => {
            if (typeof unsubExpenseCats === 'function') {
                unsubExpenseCats();
            }
        };
    }, []);
    
    const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        (Array.isArray(bankAccounts) ? bankAccounts : []).forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
        balances.set('CashAtHome', 0);

        (Array.isArray(fundTransactions) ? fundTransactions : []).forEach(t => {
            if (balances.has(t.source)) balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            if (balances.has(t.destination)) balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
        });
        
        allTransactions.forEach(t => {
            const balanceKey = t.bankAccountId || (t.paymentMethod === 'Cash' ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                const amount = t.amount || 0;
                if (t.transactionType === 'Income') balances.set(balanceKey, (balances.get(balanceKey) || 0) + amount);
                else if (t.transactionType === 'Expense') balances.set(balanceKey, (balances.get(balanceKey) || 0) - amount);
            }
        });

        const totalSupplierDues = (Array.isArray(suppliers) ? suppliers : []).reduce((sum, s) => sum + (Number(s.netAmount) || 0), 0);
        const totalCustomerDues = (Array.isArray(customers) ? customers : []).reduce((sum, c) => sum + (Number(c.netAmount) || 0), 0);
        
        const loanLiabilities = (Array.isArray(loans) ? loans : []).reduce((sum, loan) => {
            const paidTransactions = allTransactions.filter(t => t.loanId === loan.id && t.transactionType === 'Expense');
            const totalPaidTowardsPrincipal = paidTransactions.reduce((subSum, t) => subSum + t.amount, 0);

            let accumulatedInterest = 0;
            if (loan.loanType === 'Outsider' && loan.interestRate > 0) {
                const monthsPassed = differenceInMonths(new Date(), new Date(loan.startDate));
                if (monthsPassed > 0) {
                    accumulatedInterest = (loan.totalAmount * (loan.interestRate / 100) * monthsPassed) / 12;
                }
            }

            const totalPaid = (loan.amountPaid || 0) + totalPaidTowardsPrincipal;
            const remainingAmount = loan.totalAmount + accumulatedInterest - totalPaid;
            return sum + (remainingAmount > 0 ? remainingAmount : 0);
        }, 0);

        const totalLiabilities = loanLiabilities + totalSupplierDues;
        
        const totalCdReceived = (Array.isArray(payments) ? payments : []).filter(p => p.paymentId.startsWith('P')).reduce((sum, p) => sum + (p.cdAmount || 0), 0);
        
        const cashAndBankAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        const totalAssets = cashAndBankAssets + totalCustomerDues;
        
        return { balances, totalAssets, totalLiabilities, totalSupplierDues, totalCustomerDues, loanLiabilities, cashAndBankAssets, totalCdReceived };
    }, [fundTransactions, allTransactions, loans, bankAccounts, suppliers, customers, payments]);

    const chartData = useMemo(() => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        const recentTransactions = allTransactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
        
        const dailyData = recentTransactions.reduce((acc, t) => {
            const date = format(new Date(t.date), 'dd-MMM');
            if (!acc[date]) acc[date] = { date, Income: 0, Expense: 0 };
            if (t.transactionType === 'Income') acc[date].Income += t.amount;
            else acc[date].Expense += t.amount;
            return acc;
        }, {} as { [key: string]: { date: string; Income: number; Expense: number } });

        const timeSeriesData = Object.values(dailyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const expenseBreakdown = allTransactions.filter(t => t.transactionType === 'Expense').reduce((acc, t) => {
            const category = toTitleCase(t.category || 'Uncategorized');
            if (!acc[category]) acc[category] = 0;
            acc[category] += t.amount;
            return acc;
        }, {} as { [key: string]: number });

        const incomeBreakdown = allTransactions.filter(t => t.transactionType === 'Income').reduce((acc, t) => {
            const category = toTitleCase(t.category || 'Uncategorized');
            if (!acc[category]) acc[category] = 0;
            acc[category] += t.amount;
            return acc;
        }, {} as { [key: string]: number });

        const assetsBreakdown = [
            { name: 'Cash & Bank', value: financialState.cashAndBankAssets },
            { name: 'Receivables', value: financialState.totalCustomerDues },
        ];
        
        const liabilitiesBreakdown = [
            { name: 'Loans', value: financialState.loanLiabilities },
            { name: 'Payables', value: financialState.totalSupplierDues },
        ];

        const financialHealthData = [
            { name: "Assets", "Amount": financialState.totalAssets },
            { name: "Liabilities", "Amount": financialState.totalLiabilities }
        ];

        const topCustomers = (Array.isArray(customers) ? customers : [])
            .filter(c => (c.netAmount || 0) > 0)
            .sort((a,b) => Number(b.netAmount || 0) - Number(a.netAmount || 0))
            .slice(0, 5)
            .map(c => ({ name: toTitleCase(c.name), "Amount": Number(c.netAmount) }));

        return {
            timeSeriesData,
            expenseBreakdownChartData: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })).filter(item => item.value > 0),
            incomeBreakdownChartData: Object.entries(incomeBreakdown).map(([name, value]) => ({ name, value })).filter(item => item.value > 0),
            assetsBreakdownChartData: assetsBreakdown.filter(item => item.value > 0),
            liabilitiesBreakdownChartData: liabilitiesBreakdown.filter(item => item.value > 0),
            financialHealthData,
            topCustomersChartData: topCustomers
        };
    }, [allTransactions, financialState, customers]);

    if (!isClient) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" description="Cash, Bank, Receivables" />
                <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" description="Loans and Payables" />
                <StatCard title="Supplier Dues" value={formatCurrency(financialState.totalSupplierDues)} icon={<Truck />} colorClass="text-orange-500" description="Accounts Payable"/>
                <StatCard title="Customer Dues" value={formatCurrency(financialState.totalCustomerDues)} icon={<Users />} colorClass="text-blue-500" description="Accounts Receivable" />
                <StatCard title="Total CD Received" value={formatCurrency(financialState.totalCdReceived)} icon={<Percent />} colorClass="text-green-400" description="From Suppliers"/>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-5 w-5 text-primary"/>Bank & Cash Balances</CardTitle>
                    <CardDescription className="text-xs">Real-time balances of your accounts.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {Array.from(financialState.balances.entries()).map(([key, balance]) => {
                        const account = (Array.isArray(bankAccounts) ? bankAccounts : []).find(acc => acc.id === key);
                        if (account) {
                            return <BalanceCard key={key} title={account.accountHolderName} value={formatCurrency(balance)} icon={<Landmark />} colorClass="text-blue-500" description={`${account.bankName} - ...${account.accountNumber.slice(-4)}`} />
                        }
                        if (key === 'CashInHand') {
                            return <BalanceCard key={key} title="Cash in Hand" value={formatCurrency(balance)} icon={<HandCoins />} colorClass="text-yellow-500" description="At Mill/Office"/>
                        }
                        if (key === 'CashAtHome') {
                            return <BalanceCard key={key} title="Cash at Home" value={formatCurrency(balance)} icon={<Home />} colorClass="text-orange-500" />
                        }
                        return null;
                    })}
                </CardContent>
            </Card>

            {/* 4 Pie/Donut Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader><CardTitle className="text-base">Assets Breakdown</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center h-48">
                        <DonutChart data={chartData.assetsBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['sky', 'blue', 'teal']} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Liabilities Breakdown</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center h-48">
                         <DonutChart data={chartData.liabilitiesBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['rose', 'orange']} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-base">Income Sources</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center h-48">
                        <DonutChart data={chartData.incomeBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['emerald', 'teal', 'cyan']} />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-base">Expense Categories</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center h-48">
                        <DonutChart data={chartData.expenseBreakdownChartData} category="value" index="name" valueFormatter={formatCurrency} colors={['slate', 'stone', 'gray', 'zinc', 'neutral']} />
                    </CardContent>
                </Card>
            </div>
            
            {/* 4 Other Graphs/Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><CardTitle>Income vs Expense (Last 30 Days)</CardTitle></CardHeader>
                    <CardContent className="h-72">
                         <AreaChart
                            data={chartData.timeSeriesData}
                            index="date"
                            categories={['Income', 'Expense']}
                            colors={['emerald', 'rose']}
                            valueFormatter={formatCurrency}
                            yAxisWidth={60}
                        />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Financial Health</CardTitle></CardHeader>
                    <CardContent className="h-72">
                        <BarChart
                            data={chartData.financialHealthData}
                            index="name"
                            categories={['Amount']}
                            colors={['blue']}
                            valueFormatter={formatCurrency}
                            yAxisWidth={60}
                        />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Top 5 Outstanding Customers</CardTitle></CardHeader>
                    <CardContent className="h-72">
                       <BarChart
                            data={chartData.topCustomersChartData}
                            index="name"
                            categories={["Amount"]}
                            colors={["sky"]}
                            valueFormatter={formatCurrency}
                            yAxisWidth={60}
                            layout="vertical"
                        />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Payee/Payer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {allTransactions.slice(0, 5).map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(new Date(tx.date), 'dd-MMM-yy')}</TableCell>
                                        <TableCell><Badge variant={tx.transactionType === 'Income' ? 'default' : 'destructive'} className={cn(tx.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80', 'text-white')}>{tx.transactionType}</Badge></TableCell>
                                        <TableCell>{tx.payee}</TableCell>
                                        <TableCell className={cn("text-right font-semibold", tx.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {allTransactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No recent transactions.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Customer, Transaction, FundTransaction, Payment, BankAccount, Loan } from "@/lib/definitions";
import { toTitleCase, cn, formatCurrency } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { TrendingUp, TrendingDown, Scale, Banknote, Landmark, HandCoins, PiggyBank, DollarSign, Users, FileText, ArrowRight, Wallet, Home } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { getSuppliersRealtime, getTransactionsRealtime, getFundTransactionsRealtime, getBankAccountsRealtime, getLoansRealtime } from "@/lib/firestore";

const StatCard = ({ title, value, icon, colorClass, description }: { title: string; value: string; icon: React.ReactNode; colorClass?: string; description?: string }) => (
  <Card className="bg-card/60 backdrop-blur-sm border-white/10">
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
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setIsClient(true);
        setLoading(true);

        const unsubSuppliers = getSuppliersRealtime((data) => {
            setSuppliers(data);
            if(loading) setLoading(false); 
        }, (error) => {
            console.error(error);
            if(loading) setLoading(false);
        });

        const unsubTransactions = getTransactionsRealtime(setTransactions, console.error);
        const unsubFundTransactions = getFundTransactionsRealtime(setFundTransactions, console.error);
        const unsubBankAccounts = getBankAccountsRealtime(setBankAccounts, console.error);
        const unsubLoans = getLoansRealtime(setLoans, console.error);

        return () => {
            unsubSuppliers();
            unsubTransactions();
            unsubFundTransactions();
            unsubBankAccounts();
            unsubLoans();
        };
    }, []);

    const loansWithCalculatedRemaining = useMemo(() => {
        return loans.map(loan => {
            const paidTransactions = transactions.filter(t => t.loanId === loan.id && t.transactionType === 'Expense');
            const totalPaidTowardsPrincipal = paidTransactions.reduce((sum, t) => sum + t.amount, 0);
            const totalPaid = (loan.amountPaid || 0) + totalPaidTowardsPrincipal;
            const remainingAmount = loan.totalAmount - totalPaid;
            return { ...loan, remainingAmount, amountPaid: totalPaid };
        });
    }, [loans, transactions]);

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
                if (t.transactionType === 'Income') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
                } else if (t.transactionType === 'Expense') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
                }
            }
        });
        
        const totalIncome = transactions.filter(t => t.transactionType === 'Income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.transactionType === 'Expense').reduce((sum, t) => sum + t.amount, 0);

        const totalAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        const totalLiabilities = loansWithCalculatedRemaining.reduce((sum, loan) => sum + (loan.remainingAmount > 0 ? loan.remainingAmount : 0), 0);

        return { 
            balances,
            totalAssets, 
            totalLiabilities,
            totalIncome,
            totalExpense,
            netProfitLoss: totalIncome - totalExpense
        };
    }, [transactions, fundTransactions, bankAccounts, loansWithCalculatedRemaining]);

    const salesState = useMemo(() => {
        const totalSalesAmount = suppliers.reduce((sum, c) => sum + c.amount, 0);
        const totalOutstanding = suppliers.reduce((sum, c) => sum + Number(c.netAmount), 0);
        const totalPaid = totalSalesAmount - totalOutstanding;
        const uniqueCustomerIds = new Set(suppliers.map(c => c.customerId));
        return {
            totalSalesAmount,
            totalOutstanding,
            totalPaid,
            totalCustomers: uniqueCustomerIds.size,
        }
    }, [suppliers]);
    
    const recentTransactions = useMemo(() => {
        return [...transactions]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [transactions]);
    
    const recentSuppliers = useMemo(() => {
         return [...suppliers]
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [suppliers]);

    if (!isClient || loading) return <div>Loading Dashboard...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Scale className="h-5 w-5 text-primary"/>Financial Overview</CardTitle>
                    <CardDescription>A real-time snapshot of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                    <StatCard title="Total Income" value={formatCurrency(financialState.totalIncome)} icon={<TrendingUp />} colorClass="text-green-500" />
                    <StatCard title="Total Expense" value={formatCurrency(financialState.totalExpense)} icon={<TrendingDown />} colorClass="text-red-500" />
                    <StatCard title="Net Profit/Loss" value={formatCurrency(financialState.netProfitLoss)} icon={<Scale />} colorClass={financialState.netProfitLoss >= 0 ? "text-green-500" : "text-red-500"} />
                    <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" />
                    <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" />
                </CardContent>
                 <CardHeader className="pt-0">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><Landmark className="h-4 w-4"/>Cash &amp; Bank Balances</CardTitle>
                </CardHeader>
                 <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     {Array.from(financialState.balances.entries()).map(([key, balance]) => {
                        const account = bankAccounts.find(acc => acc.id === key);
                        if (account) {
                            return <StatCard key={key} title={account.accountHolderName} value={formatCurrency(balance)} icon={<Landmark />} colorClass="text-blue-500" description={account.bankName}/>
                        }
                        if (key === 'CashInHand') {
                            return <StatCard key={key} title="Cash in Hand" value={formatCurrency(balance)} icon={<HandCoins />} colorClass="text-yellow-500" description="At Mill/Office"/>
                        }
                        if (key === 'CashAtHome') {
                            return <StatCard key={key} title="Cash at Home" value={formatCurrency(balance)} icon={<Home />} colorClass="text-orange-500" />
                        }
                        return null;
                    })}
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Banknote className="h-5 w-5 text-primary"/>Sales &amp; Supplier Overview</CardTitle>
                    <CardDescription>Key metrics from your sales and supplier activities.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Sales Amount" value={formatCurrency(salesState.totalSalesAmount)} icon={<Banknote />} />
                    <StatCard title="Total Paid" value={formatCurrency(salesState.totalPaid)} icon={<Wallet />} colorClass="text-green-500"/>
                    <StatCard title="Total Outstanding" value={formatCurrency(salesState.totalOutstanding)} icon={<Banknote />} colorClass="text-destructive" />
                    <StatCard title="Total Suppliers" value={String(salesState.totalCustomers)} icon={<Users />} />
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Recent Transactions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Payee/Payer</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransactions.map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell><Badge variant={t.transactionType === 'Income' ? 'default' : 'destructive'} className={cn(t.transactionType === 'Income' ? 'bg-green-600' : 'bg-red-600', 'text-white')}>{t.transactionType}</Badge></TableCell>
                                        <TableCell>{toTitleCase(t.payee)}</TableCell>
                                        <TableCell className={cn("text-right font-medium", t.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {recentTransactions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No recent transactions.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             <Users className="h-5 w-5 text-primary" />
                            Recent Supplier Entries
                        </CardTitle>
                         <CardDescription>Your last 5 supplier entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                             <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>SR No.</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Net Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentSuppliers.map(c => (
                                    <TableRow key={c.id}>
                                        <TableCell>{format(new Date(c.date), "dd-MMM-yy")}</TableCell>
                                        <TableCell className="font-mono">{c.srNo}</TableCell>
                                        <TableCell>{toTitleCase(c.name)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(Number(c.netAmount))}</TableCell>
                                    </TableRow>
                                ))}
                                {recentSuppliers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">No recent supplier entries.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

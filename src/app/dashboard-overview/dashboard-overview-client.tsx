
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction, FundTransaction, Loan, BankAccount, Customer } from "@/lib/definitions";
import { formatCurrency, toTitleCase, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import { PiggyBank, Landmark, HandCoins, DollarSign, Scale, TrendingUp, TrendingDown, AlertTriangle, Home, FileText, CheckCircle, Users, Truck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("date", "desc"), limit(200)), (snapshot) => {
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

        const unsubSuppliers = onSnapshot(query(collection(db, "suppliers"), orderBy("date", "desc")), (snapshot) => {
            setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });

        const unsubCustomers = onSnapshot(query(collection(db, "customers"), orderBy("date", "desc")), (snapshot) => {
            setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        });
        
        setLoading(false);

        return () => {
            unsubTransactions();
            unsubFunds();
            unsubLoans();
            unsubBankAccounts();
            unsubSuppliers();
            unsubCustomers();
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
                const amount = t.amount || 0;
                if (t.transactionType === 'Income') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) + amount);
                } else if (t.transactionType === 'Expense') {
                    balances.set(balanceKey, (balances.get(balanceKey) || 0) - amount);
                }
            }
        });

        const totalSupplierDues = suppliers.reduce((sum, s) => sum + Number(s.netAmount || 0), 0);
        const totalCustomerDues = customers.reduce((sum, c) => sum + Number(c.netAmount || 0), 0);
        
        const loanLiabilities = loansWithCalculatedRemaining.reduce((sum, loan) => sum + (loan.remainingAmount > 0 ? loan.remainingAmount : 0), 0);
        const totalLiabilities = loanLiabilities + totalSupplierDues;
        
        const cashAndBankAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        const totalAssets = cashAndBankAssets + totalCustomerDues;
        
        const totalIncome = transactions.filter(t => t.transactionType === 'Income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.transactionType === 'Expense').reduce((sum, t) => sum + t.amount, 0);
        const netProfitLoss = totalIncome - totalExpense;
        
        return { balances, totalAssets, totalLiabilities, totalIncome, totalExpense, netProfitLoss, totalSupplierDues, totalCustomerDues };
    }, [fundTransactions, transactions, loansWithCalculatedRemaining, bankAccounts, suppliers, customers]);

    const recentTransactions = useMemo(() => {
        return transactions.slice(0, 5);
    }, [transactions]);

    const pendingEMIs = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        return loansWithCalculatedRemaining.filter(l => l.remainingAmount > 0 && l.nextEmiDueDate && new Date(l.nextEmiDueDate) <= today);
    }, [loansWithCalculatedRemaining]);

    if (loading) {
        return <div>Loading Dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2"><Scale /> Financial Overview</CardTitle>
                    <CardDescription>A real-time overview of your business's financial health.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Income" value={formatCurrency(financialState.totalIncome)} icon={<TrendingUp />} colorClass="text-green-500" />
                    <StatCard title="Total Expense" value={formatCurrency(financialState.totalExpense)} icon={<TrendingDown />} colorClass="text-red-500" />
                    <StatCard title="Net Profit/Loss" value={formatCurrency(financialState.netProfitLoss)} icon={<Scale />} colorClass={financialState.netProfitLoss >= 0 ? "text-green-500" : "text-red-500"} />
                    <StatCard title="Total Assets" value={formatCurrency(financialState.totalAssets)} icon={<PiggyBank />} colorClass="text-green-500" />
                     <StatCard title="Total Liabilities" value={formatCurrency(financialState.totalLiabilities)} icon={<DollarSign />} colorClass="text-red-500" />
                    <StatCard title="Total Supplier Dues" value={formatCurrency(financialState.totalSupplierDues)} icon={<Truck />} colorClass="text-orange-500" description="Accounts Payable"/>
                    <StatCard title="Total Customer Dues" value={formatCurrency(financialState.totalCustomerDues)} icon={<Users />} colorClass="text-blue-500" description="Accounts Receivable" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-2"><Landmark /> Cash & Bank Balances</CardTitle>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText /> Loan Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Loan</TableHead>
                                    <TableHead className="text-right">Remaining</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loansWithCalculatedRemaining.filter(l => l.remainingAmount > 0).map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{loan.loanName}</TableCell>
                                        <TableCell className="text-right text-destructive font-semibold">{formatCurrency(loan.remainingAmount)}</TableCell>
                                    </TableRow>
                                ))}
                                {loansWithCalculatedRemaining.filter(l => l.remainingAmount > 0).length === 0 && (
                                     <TableRow><TableCell colSpan={2} className="text-center h-24">No active loans.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-yellow-500" /> Pending Loan EMIs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {pendingEMIs.length > 0 ? (
                             <ul className="space-y-3">
                                {pendingEMIs.map(loan => (
                                    <li key={loan.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                                        <div>
                                            <p className="font-semibold">{loan.loanName}</p>
                                            <p className="text-xs text-muted-foreground">Due: {format(new Date(loan.nextEmiDueDate!), 'dd-MMM-yyyy')} - {formatCurrency(loan.emiAmount || 0)}</p>
                                        </div>
                                        <Button size="sm" asChild>
                                            <Link href={`/expense-tracker?loanId=${loan.id}&amount=${loan.emiAmount || 0}&payee=${loan.lenderName || loan.productName || 'Loan Payment'}&description=EMI for ${loan.loanName}`}>Pay Now</Link>
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <CheckCircle className="h-10 w-10 text-green-500 mb-2"/>
                                <p className="font-semibold">All loan payments are up to date!</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-semibold">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Payee/Payer</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentTransactions.map((tx) => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(new Date(tx.date), 'dd-MMM-yy')}</TableCell>
                                    <TableCell>
                                        <Badge variant={tx.transactionType === 'Income' ? 'default' : 'destructive'} className={tx.transactionType === 'Income' ? 'bg-green-500/80' : 'bg-red-500/80'}>{tx.transactionType}</Badge>
                                    </TableCell>
                                    <TableCell>{tx.category}</TableCell>
                                    <TableCell>{toTitleCase(tx.payee)}</TableCell>
                                    <TableCell className={cn("text-right font-medium", tx.transactionType === 'Income' ? 'text-green-500' : 'text-red-500')}>{formatCurrency(tx.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

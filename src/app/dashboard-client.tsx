
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, ExpenseCategory, IncomeCategory, Project, Payment, CustomerPayment, KantaParchi, PaidFor } from '@/lib/definitions';
import { getLoansRealtime, getProjectsRealtime, getExpenseCategories as getExpenseCategoriesFromDB, getIncomeCategories as getIncomeCategoriesFromDB, getKantaParchiRealtime } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { formatCurrency, toTitleCase, getUserFriendlyErrorMessage } from "@/lib/utils";
import { format, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ManufacturingCosting } from '@/components/dashboard/manufacturing-costing';
import { TrendingUp, TrendingDown, DollarSign, Users, HandCoins, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import type { DateRange } from 'react-day-picker';
import { ErrorBoundary } from '@/components/error-boundary';
import { ensureFirstFullSync, getSyncCounts } from '@/lib/database';
import { logError } from '@/lib/error-logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toStartOfDay, toEndOfDay } from "@/lib/date-utils";
import { groupSumByKey } from "@/lib/calculation-helpers";
import { StatCard } from '@/components/dashboard/stat-card';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { FinancialBreakdown } from '@/components/dashboard/financial-breakdown';
import { SyncCountsTable, SoftwareCountsTable } from '@/components/dashboard/dashboard-tables';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { useToast } from '@/hooks/use-toast';
import { retry } from '@/lib/retry-utils';
import { Button } from '@/components/ui/button';

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();
    
    // ✅ Use global data context - NO duplicate listeners
    const globalData = useGlobalData();
    
    // ✅ FIX: Initialize state from globalData immediately to prevent data loss on remount
    const [suppliers, setSuppliers] = useState<Customer[]>(globalData.suppliers);
    const [customers, setCustomers] = useState<Customer[]>(globalData.customers);
    const [kantaParchi, setKantaParchi] = useState<KantaParchi[]>([]);
    const [incomes, setIncomes] = useState<Income[]>(globalData.incomes);
    const [expenses, setExpenses] = useState<Expense[]>(globalData.expenses);
    const [supplierPayments, setSupplierPayments] = useState<Payment[]>(globalData.paymentHistory);
    const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>(globalData.customerPayments);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [fundTransactions, setFundTransactions] = useState<FundTransaction[]>(globalData.fundTransactions);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(globalData.bankAccounts);
    const [isLoading, setIsLoading] = useState(false);
    const [syncCounts, setSyncCounts] = useState<{ collection: string; indexeddb: number; firestore: number }[]>([]);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncRunId, setSyncRunId] = useState(0);

    const [date, setDate] = React.useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [level1, setLevel1] = useState<string | null>(null);
    const [level2, setLevel2] = useState<string | null>(null);
    const [level3, setLevel3] = useState<string | null>(null);
    
    // ✅ OPTIMIZED: Only sync when data actually changes
    const prevDataRef = React.useRef({
        suppliers: globalData.suppliers,
        customers: globalData.customers,
        paymentHistory: globalData.paymentHistory,
        customerPayments: globalData.customerPayments,
        incomes: globalData.incomes,
        expenses: globalData.expenses,
        fundTransactions: globalData.fundTransactions,
        bankAccounts: globalData.bankAccounts,
    });
    
    useEffect(() => {
        setIsClient(true);
        setSuppliers(globalData.suppliers);
        setCustomers(globalData.customers);
        setSupplierPayments(globalData.paymentHistory);
        setCustomerPayments(globalData.customerPayments);
        setIncomes(globalData.incomes);
        setExpenses(globalData.expenses);
        setFundTransactions(globalData.fundTransactions);
        setBankAccounts(globalData.bankAccounts);
        
        // Update refs
        prevDataRef.current = {
            suppliers: globalData.suppliers,
            customers: globalData.customers,
            paymentHistory: globalData.paymentHistory,
            customerPayments: globalData.customerPayments,
            incomes: globalData.incomes,
            expenses: globalData.expenses,
            fundTransactions: globalData.fundTransactions,
            bankAccounts: globalData.bankAccounts,
        };
    }, [
        globalData.suppliers,
        globalData.customers,
        globalData.paymentHistory,
        globalData.customerPayments,
        globalData.incomes,
        globalData.expenses,
        globalData.fundTransactions,
        globalData.bankAccounts,
    ]);
    
    useEffect(() => {
        // Only fetch data that's not in global context (run once on mount)
        const unsubKantaParchi = getKantaParchiRealtime(setKantaParchi, () => {});
        const unsubLoans = getLoansRealtime(setLoans, () => {});
        const unsubProjects = getProjectsRealtime(setProjects, () => {});
        const unsubExpCats = getExpenseCategoriesFromDB(setExpenseCategories, () => {});
        const unsubIncCats = getIncomeCategoriesFromDB(setIncomeCategories, () => {});

        return () => {
            unsubKantaParchi();
            unsubLoans();
            unsubProjects();
            unsubExpCats();
            unsubIncCats();
        };
    }, []); // Only run once on mount
    
    useEffect(() => {
        let isMounted = true;
        setIsLoading(true);
        setSyncError(null);

        (async () => {
            try {
                const rows = await retry(
                    async () => {
                        await ensureFirstFullSync();
                        return await getSyncCounts();
                    },
                    {
                        maxAttempts: 3,
                        initialDelayMs: 1000,
                        maxDelayMs: 8000,
                        onRetry: (attempt, error) => {
                            logError(error, `dashboard-client: sync retry attempt ${attempt}`, "low");
                        },
                    }
                );

                if (isMounted) {
                    setSyncCounts(rows);
                }
            } catch (error) {
                logError(error, "dashboard-client: ensureFirstFullSync/getSyncCounts", "medium");
                const message = getUserFriendlyErrorMessage(error, "sync");
                if (isMounted) {
                    setSyncError(message);
                    toast({ title: "Sync failed", description: message, variant: "destructive" });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            isMounted = false;
        };
    }, [syncRunId, toast]);
    
    const filteredData = useMemo(() => {
        if (!date || !date.from) {
            return { 
                filteredIncomes: [], 
                filteredExpenses: [], 
                filteredSupplierPayments: [],
                filteredCustomerPayments: [],
                filteredFundTransactions: [],
                filteredLoans: [],
                filteredSuppliers: [],
                filteredCustomers: [],
            };
        }

        const interval = {
            start: toStartOfDay(date.from),
            end: toEndOfDay(date.to || date.from)
        };
        const filterFn = (item: { date: string }) => isWithinInterval(new Date(item.date), interval);
        const loanFilterFn = (item: { startDate: string }) => isWithinInterval(new Date(item.startDate), interval);

        return {
            filteredIncomes: incomes.filter(filterFn),
            filteredExpenses: expenses.filter(filterFn),
            filteredSupplierPayments: supplierPayments.filter(filterFn),
            filteredCustomerPayments: customerPayments.filter(filterFn),
            filteredFundTransactions: fundTransactions.filter(filterFn),
            filteredLoans: loans.filter(loanFilterFn),
            filteredSuppliers: suppliers.filter(filterFn),
            filteredCustomers: customers.filter(filterFn),
        };
    }, [date, incomes, expenses, supplierPayments, customerPayments, fundTransactions, loans, suppliers, customers]);


    const allExpenses = useMemo(() => [...filteredData.filteredExpenses, ...filteredData.filteredSupplierPayments], [filteredData]);
    const allIncomes = useMemo(() => [...filteredData.filteredIncomes, ...filteredData.filteredCustomerPayments], [filteredData]);
    
    const totalCustomerReceivables = useMemo(() => {
        const customerReceivablesMap = new Map<string, number>();

        kantaParchi.forEach(kp => {
            const originalAmount = Number(kp.originalNetAmount) || Number(kp.netAmount) || 0;
            customerReceivablesMap.set(kp.srNo, originalAmount);
        });

        customers.forEach(customer => {
            if (!customerReceivablesMap.has(customer.srNo)) {
                const originalAmount = Number(customer.originalNetAmount) || Number(customer.netAmount) || 0;
                customerReceivablesMap.set(customer.srNo, originalAmount);
            }
        });

        customerPayments.forEach(payment => {
            if (payment.paidFor && payment.paidFor.length > 0) {
                payment.paidFor.forEach((paidFor: PaidFor) => {
                    const currentReceivable = customerReceivablesMap.get(paidFor.srNo) || 0;
                    const paidAmount = (Number(paidFor.amount) || 0) + (Number(paidFor.cdAmount) || 0);
                    const newReceivable = Math.max(0, currentReceivable - paidAmount);
                    customerReceivablesMap.set(paidFor.srNo, newReceivable);
                });
            }
        });

        return Array.from(customerReceivablesMap.values()).reduce((sum, amount) => sum + amount, 0);
    }, [kantaParchi, customers, customerPayments]);

    const totalSupplierDues = useMemo(() => {
        const supplierDuesMap = new Map<string, number>();

        suppliers.forEach(s => {
            const originalAmount = Number(s.originalNetAmount) || Number(s.netAmount) || 0;
            supplierDuesMap.set(s.srNo, originalAmount);
        });

        supplierPayments.forEach(payment => {
            if (payment.paidFor && payment.paidFor.length > 0) {
                payment.paidFor.forEach((pf: PaidFor) => {
                    const currentDue = supplierDuesMap.get(pf.srNo) || 0;
                    const paidAmount = (Number(pf.amount) || 0) + (Number(pf.cdAmount) || 0);
                    const newDue = Math.max(0, currentDue - paidAmount);
                    supplierDuesMap.set(pf.srNo, newDue);
                });
            }
        });

        return Array.from(supplierDuesMap.values()).reduce((sum, amt) => sum + amt, 0);
    }, [suppliers, supplierPayments]);

    const { totalIncome, totalExpense, netProfit, totalCdReceived, expenseBreakdown, incomeBreakdown } = useMemo(() => {
        const incomeFromEntries = filteredData.filteredIncomes.reduce((sum, item) => sum + item.amount, 0);
        const incomeFromCustomers = filteredData.filteredCustomerPayments.reduce((sum, item) => sum + item.amount, 0);
        // Calculate CD received - use SAME logic as CD Granted (unified-payments): paidFor.cdAmount first, else proportional from payment.cdAmount
        const cdReceived = filteredData.filteredSupplierPayments.reduce((sum, payment) => {
            let paymentCd = 0;
            if (payment.paidFor && Array.isArray(payment.paidFor) && payment.paidFor.length > 0) {
                const totalPaidForInPayment = payment.paidFor.reduce((s: number, pf: PaidFor) => s + Number(pf.amount || 0), 0);
                payment.paidFor.forEach((pf: PaidFor) => {
                    if ('cdAmount' in pf && pf.cdAmount !== undefined && pf.cdAmount !== null) {
                        paymentCd += Number(pf.cdAmount || 0);
                    } else if (payment.cdAmount && totalPaidForInPayment > 0) {
                        const proportion = Number(pf.amount || 0) / totalPaidForInPayment;
                        paymentCd += Math.round(Number(payment.cdAmount || 0) * proportion * 100) / 100;
                    }
                });
            } else if (payment.cdAmount) {
                paymentCd = Number(payment.cdAmount || 0);
            }
            return sum + paymentCd;
        }, 0);
        
        const expenseFromEntries = filteredData.filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
        
        // Breakdown supplier payments by type
        const supplierPaymentRegular = filteredData.filteredSupplierPayments.filter(p => p.rtgsFor !== 'Outsider').reduce((sum, item) => sum + item.amount, 0);
        const outsiderRTGS = filteredData.filteredSupplierPayments.filter(p => p.rtgsFor === 'Outsider').reduce((sum, item) => sum + item.amount, 0);
        const expenseForSuppliers = filteredData.filteredSupplierPayments.reduce((sum, item) => sum + item.amount, 0);
        
        const currentTotalIncome = incomeFromEntries + incomeFromCustomers + cdReceived;
        const currentTotalExpense = expenseFromEntries + expenseForSuppliers;

        return {
            totalIncome: currentTotalIncome,
            totalExpense: currentTotalExpense,
            netProfit: currentTotalIncome - currentTotalExpense,
            totalCdReceived: cdReceived,
            expenseBreakdown: {
                supplierPayment: supplierPaymentRegular,
                expenses: expenseFromEntries,
                outsiderRTGS: outsiderRTGS,
            },
            incomeBreakdown: {
                incomeEntries: incomeFromEntries,
                customerPayments: incomeFromCustomers,
                cdReceived,
            }
        }
    }, [filteredData]);
    
    const appCountsMap = useMemo(() => ({
        suppliers: suppliers.length,
        customers: customers.length,
        payments: supplierPayments.length,
        customerPayments: customerPayments.length,
        incomes: incomes.length,
        expenses: expenses.length,
        fundTransactions: fundTransactions.length,
        banks: globalData.banks.length,
        bankBranches: (globalData as any).bankBranches?.length || 0,
        bankAccounts: bankAccounts.length,
        supplierBankAccounts: (globalData as any).supplierBankAccounts?.length || 0,
        projects: projects.length,
        loans: loans.length,
    }), [suppliers, customers, supplierPayments, customerPayments, incomes, expenses, fundTransactions, globalData.banks, (globalData as any).bankBranches, bankAccounts, (globalData as any).supplierBankAccounts, projects, loans]);

    const softwareCounts = useMemo(() => {
        const entries: Array<{ name: string; count: number }> = [];
        const push = (name: string, count: number | undefined | null) => entries.push({ name, count: Number(count || 0) });
        push('suppliers', appCountsMap.suppliers);
        push('customers', appCountsMap.customers);
        push('payments', appCountsMap.payments);
        push('customerPayments', appCountsMap.customerPayments);
        push('incomes', appCountsMap.incomes);
        push('expenses', appCountsMap.expenses);
        push('fundTransactions', appCountsMap.fundTransactions);
        push('banks', appCountsMap.banks);
        push('bankBranches', appCountsMap.bankBranches);
        push('bankAccounts', appCountsMap.bankAccounts);
        push('supplierBankAccounts', appCountsMap.supplierBankAccounts);
        push('projects', appCountsMap.projects);
        push('loans', appCountsMap.loans);
        return entries.filter(row => row.count > 0);
    }, [appCountsMap]);

    const groupDataByField = React.useCallback(
        <T extends { amount: number } & Record<string, unknown>>(
            data: T[],
            field: keyof T & string
        ) => {
            const grouped = groupSumByKey(
                data,
                (item) => {
                    const rawKey = item[field];
                    if (typeof rawKey === "string" && rawKey.trim() !== "") {
                        return rawKey;
                    }
                    return "Uncategorized";
                },
                (item) => item.amount
            );

            return Object.entries(grouped).map(([name, value]) => ({
                name: toTitleCase(name),
                value,
            }));
        },
        []
    );

     const financialState = useMemo(() => {
        const balances = new Map<string, number>();
        bankAccounts.forEach(acc => balances.set(acc.id, 0));
        balances.set('CashInHand', 0);
        balances.set('CashAtHome', 0);

        filteredData.filteredFundTransactions.forEach(t => {
            if (balances.has(t.source)) {
                balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            }
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        allIncomes.forEach(t => {
            const balanceKey = t.bankAccountId || (('paymentMethod' in t && t.paymentMethod === 'Cash') ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                 balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
            }
        });
        
        allExpenses.forEach(t => {
             const balanceKey = t.bankAccountId || (('receiptType' in t && t.receiptType === 'Cash') || ('paymentMethod' in t && t.paymentMethod === 'Cash') ? 'CashInHand' : '');
             if (balanceKey && balances.has(balanceKey)) {
                 balances.set(balanceKey, (balances.get(balanceKey) || 0) - t.amount);
             }
        });

        const totalAssets = Array.from(balances.values()).reduce((sum, bal) => sum + bal, 0);
        const totalLoanLiabilities = filteredData.filteredLoans.reduce((sum, loan) => sum + (loan.remainingAmount || 0), 0);
        const totalLiabilities = totalLoanLiabilities + totalSupplierDues;
        const workingCapital = totalAssets - totalLiabilities;
        
        return { balances, totalAssets, totalLiabilities, workingCapital };
    }, [filteredData, allIncomes, allExpenses, bankAccounts, totalSupplierDues]);

    // --- Chart Data Calculation ---
    const level1Data = useMemo(() => {
        return [{ name: 'Income', value: totalIncome }, { name: 'Expenses', value: totalExpense }];
    }, [totalIncome, totalExpense]);

    const level2Data = useMemo(() => {
        if (!level1) return [];
        if (level1 === 'Expenses') {
            const permanent = filteredData.filteredExpenses.filter(e => e.expenseNature === 'Permanent').reduce((sum, item) => sum + item.amount, 0);
            const seasonal = filteredData.filteredExpenses.filter(e => e.expenseNature === 'Seasonal').reduce((sum, item) => sum + item.amount, 0);
            const supplier = filteredData.filteredSupplierPayments.reduce((sum, item) => sum + item.amount, 0);
            return [{ name: 'Permanent', value: permanent }, { name: 'Seasonal', value: seasonal }, { name: 'Supplier Payments', value: supplier }];
        }
        if (level1 === 'Income') {
             const fromSales = filteredData.filteredCustomerPayments.reduce((sum, item) => sum + item.amount, 0);
             const byCategory = groupDataByField(filteredData.filteredIncomes, 'category');
             const salesData = { name: 'From Sales', value: fromSales };
             return [salesData, ...byCategory];
        }
        return [];
    }, [level1, filteredData, groupDataByField]);

    const level3Data = useMemo(() => {
        if (!level1 || !level2) return [];
        if (level1 === 'Expenses') {
            if (level2 === 'Supplier Payments') return [];
            const sourceData = filteredData.filteredExpenses.filter(e => e.expenseNature === level2);
            return groupDataByField(sourceData, 'category');
        }
        if (level1 === 'Income') {
            if (level2 === 'From Sales') return [];
            const sourceData = filteredData.filteredIncomes.filter(i => i.category === level2);
            return groupDataByField(sourceData, 'subCategory');
        }
        return [];
    }, [level1, level2, filteredData, groupDataByField]);
    
    const level4Data = useMemo(() => {
        if (!level1 || !level2 || !level3) return [];
        let sourceData = filteredData.filteredExpenses.filter(e => e.expenseNature === level2 && e.category === level3);
        return groupDataByField(sourceData, 'subCategory');
    }, [level1, level2, level3, filteredData, groupDataByField]);
    
    const incomeExpenseChartData = useMemo(() => {
        try {
            const grouped = [...allIncomes, ...allExpenses].reduce((acc, t) => {
                const dayDate = toStartOfDay(t.date);
                const dayTs = dayDate.getTime();
                const dayKey = String(dayTs);

                if (!acc[dayKey]) acc[dayKey] = { dayTs, date: format(dayDate, 'MMM dd'), income: 0, expense: 0 };

                const isIncomeEntry = 'transactionType' in t && t.transactionType === 'Income';
                const isCustomerPayment = 'customerId' in t && 'paymentId' in t && t.paymentId.startsWith('CP');
                if (isIncomeEntry || isCustomerPayment) {
                    acc[dayKey].income += t.amount;
                } else {
                    acc[dayKey].expense += t.amount;
                }

                return acc;
            }, {} as Record<string, { dayTs: number; date: string; income: number; expense: number }>);

            return Object.values(grouped)
                .sort((a, b) => a.dayTs - b.dayTs)
                .map(({ date, income, expense }) => ({ date, income, expense }));
        } catch (error) {
            logError(error, "dashboard-client: incomeExpenseChartData", "medium");
            return [];
        }
    }, [allIncomes, allExpenses]);
    
    const assetsLiabilitiesData = useMemo(() => {
        try {
            return [
                { name: 'Total Assets', value: financialState.totalAssets },
                { name: 'Total Liabilities', value: financialState.totalLiabilities }
            ];
        } catch (error) {
            logError(error, "dashboard-client: assetsLiabilitiesData", "medium");
            return [];
        }
    }, [financialState]);

    const bankAccountById = useMemo(() => {
        const map = new Map<string, BankAccount>();
        bankAccounts.forEach(acc => map.set(acc.id, acc));
        return map;
    }, [bankAccounts]);
    
    const fundSourcesData = useMemo(() => {
        try {
            return Array.from(financialState.balances.entries()).map(([key, value]) => {
                const account = bankAccountById.get(key);
                let name = toTitleCase(key.replace(/([A-Z])/g, ' $1').trim());
                if (account) {
                    name = `${account.accountHolderName} (...${account.accountNumber.slice(-4)})`;
                }
                return { name, value };
            }).filter(item => item.value > 0);
        } catch (error) {
            logError(error, "dashboard-client: fundSourcesData", "medium");
            return [];
        }
    }, [financialState.balances, bankAccountById]);


    const paymentMethodData = useMemo(() => {
        try {
            const groupedBySource = [...allIncomes, ...allExpenses].reduce((acc, item) => {
                let key = 'Other';
                if (item.bankAccountId) {
                    const bank = bankAccountById.get(item.bankAccountId);
                    key = bank ? bank.accountHolderName : 'Other Bank';
                } else if (('paymentMethod' in item && item.paymentMethod === 'Cash') || ('receiptType' in item && item.receiptType === 'Cash')) {
                    key = 'Cash in Hand';
                } else if (('paymentMethod' in item && item.paymentMethod === 'RTGS') || ('receiptType' in item && item.receiptType === 'RTGS')) {
                    key = 'RTGS';
                }
                acc[key] = (acc[key] || 0) + item.amount;
                return acc;
            }, {} as { [key: string]: number });
            return Object.entries(groupedBySource).map(([name, value]) => ({ name: toTitleCase(name), value }));
        } catch (error) {
            logError(error, "dashboard-client: paymentMethodData", "medium");
            return [];
        }
    }, [allIncomes, allExpenses, bankAccountById]);

    // ✅ OPTIMIZED: Memoize breadcrumbs to prevent recreation on every render
    const breadcrumbs = useMemo(() => {
        const crumbs = ['Overview'];
        if (level1) crumbs.push(level1);
        if (level2) crumbs.push(level2);
        if (level3) crumbs.push(level3);
        return crumbs;
    }, [level1, level2, level3]);
    
    return (
        <ErrorBoundary>
            <div className="space-y-6">
                <DashboardFilters date={date} setDate={setDate} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard 
                    title="Total Income" 
                    value={formatCurrency(totalIncome)} 
                    icon={<TrendingUp />} 
                    colorClass="text-green-500" 
                    isLoading={isLoading}
                    description={`Income Entries: ${formatCurrency(incomeBreakdown.incomeEntries)} | Customer Payments: ${formatCurrency(incomeBreakdown.customerPayments)} | CD Received: ${formatCurrency(incomeBreakdown.cdReceived)}`}
                />
                <StatCard 
                    title="Total Expense" 
                    value={formatCurrency(totalExpense)} 
                    icon={<TrendingDown />} 
                    colorClass="text-red-500" 
                    isLoading={isLoading}
                    description={`Supplier: ${formatCurrency(expenseBreakdown.supplierPayment)} | Expense: ${formatCurrency(expenseBreakdown.expenses)} | Outsider: ${formatCurrency(expenseBreakdown.outsiderRTGS)}`}
                />
                <StatCard title="Net Profit/Loss" value={formatCurrency(netProfit)} icon={<DollarSign />} colorClass={netProfit >= 0 ? "text-green-500" : "text-red-500"} isLoading={isLoading}/>
                <StatCard title="Total CD Received" value={formatCurrency(totalCdReceived)} icon={<HandCoins />} colorClass="text-blue-500" isLoading={isLoading}/>
                <StatCard title="Supplier Dues" value={formatCurrency(totalSupplierDues)} icon={<Users />} colorClass="text-amber-500" isLoading={isLoading}/>
                <StatCard title="Customer Receivables" value={formatCurrency(totalCustomerReceivables)} icon={<Users />} colorClass="text-blue-500" isLoading={isLoading}/>
            </div>

            <DashboardCharts
                assetsLiabilitiesData={assetsLiabilitiesData}
                paymentMethodData={paymentMethodData}
                fundSourcesData={fundSourcesData}
                incomeExpenseChartData={incomeExpenseChartData}
            />
            
            {syncError && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <div className="text-sm text-destructive">{syncError}</div>
                    <Button variant="outline" size="sm" onClick={() => setSyncRunId(v => v + 1)}>
                        Retry sync
                    </Button>
                </div>
            )}

            <SyncCountsTable syncCounts={syncCounts} appCountsMap={appCountsMap as Record<string, number>} />
            
            <SoftwareCountsTable softwareCounts={softwareCounts} />
            
            <FinancialBreakdown
                level1Data={level1Data}
                level2Data={level2Data}
                level3Data={level3Data}
                level4Data={level4Data}
                level1={level1}
                level2={level2}
                level3={level3}
                setLevel1={setLevel1}
                setLevel2={setLevel2}
                setLevel3={setLevel3}
            />

            {/* Manufacturing Costing */}
            <ManufacturingCosting />
        </div>
        </ErrorBoundary>
    );
}

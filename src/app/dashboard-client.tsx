
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Customer, Loan, FundTransaction, Income, Expense, BankAccount, ExpenseCategory, IncomeCategory, Payment, CustomerPayment, KantaParchi, PaidFor } from '@/lib/definitions';
import { getLoansRealtime, getExpenseCategories as getExpenseCategoriesFromDB, getIncomeCategories as getIncomeCategoriesFromDB, getKantaParchiRealtime } from "@/lib/firestore";
import { useGlobalData } from "@/contexts/global-data-context";
import { formatCurrency, toTitleCase, getUserFriendlyErrorMessage } from "@/lib/utils";
import { format, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, Users, HandCoins, Loader2, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import type { DateRange } from 'react-day-picker';
import { ErrorBoundary } from '@/components/error-boundary';
import { logError } from '@/lib/error-logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toStartOfDay, toEndOfDay } from "@/lib/date-utils";
import { groupSumByKey } from "@/lib/calculation-helpers";
import { StatCard } from '@/components/dashboard/stat-card';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { FinancialBreakdown } from '@/components/dashboard/financial-breakdown';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { ForensicAccountLedger, LedgerEntry } from '@/components/dashboard/forensic-account-ledger';
import { useToast } from '@/hooks/use-toast';

import { retry } from '@/lib/retry-utils';
import { Button } from '@/components/ui/button';
import { useSupplierData } from '@/hooks/use-supplier-data';
import { useCustomerData } from '@/hooks/use-customer-data';

export default function DashboardClient() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();
    
    // ✅ Use global data context - NO duplicate listeners
    const globalData = useGlobalData();
    
    // ✅ OPTIMIZED: Read directly from globalData — no duplicate local state copies
    // Using local aliases for backward compatibility with filteredData useMemo
    const suppliers = globalData.suppliers;
    const customers = globalData.customers;
    const incomes = globalData.incomes;
    const expenses = globalData.expenses;
    const supplierPayments = globalData.paymentHistory;
    const customerPayments = globalData.customerPayments;
    const fundTransactions = globalData.fundTransactions;
    const bankAccounts = globalData.bankAccounts;

    useEffect(() => {
        setIsClient(true);
    }, []);
    
    const [kantaParchi, setKantaParchi] = useState<KantaParchi[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [selectedVariety, setSelectedVariety] = useState<string>('All');

    const [level1, setLevel1] = useState<string | null>(null);
    const [level2, setLevel2] = useState<string | null>(null);
    const [level3, setLevel3] = useState<string | null>(null);
    const [activeForensicView, setActiveForensicView] = useState<string | null>(null);

    const uniqueVarieties = useMemo(() => {
        const vars = new Set<string>();
        suppliers.forEach(s => { if (s.variety) vars.add(s.variety.trim()) });
        customers.forEach(c => { if (c.variety) vars.add(c.variety.trim()) });
        return Array.from(vars).sort();
    }, [suppliers, customers]);

    const customerIdToVariety = useMemo(() => {
        const map = new Map<string, string>();
        customers.forEach(c => {
            if (c.id && c.variety) map.set(c.id, c.variety.trim());
        });
        return map;
    }, [customers]);

    const supplierIdToVariety = useMemo(() => {
        const map = new Map<string, string>();
        suppliers.forEach(s => {
            if (s.id && s.variety) map.set(s.id, s.variety.trim());
        });
        return map;
    }, [suppliers]);

    useEffect(() => {
        // Only fetch data that's not in global context (run once on mount)
        const unsubKantaParchi = getKantaParchiRealtime(setKantaParchi, () => {});
        const unsubLoans = getLoansRealtime(setLoans, () => {});
        const unsubExpCats = getExpenseCategoriesFromDB(setExpenseCategories, () => {});
        const unsubIncCats = getIncomeCategoriesFromDB(setIncomeCategories, () => {});

        return () => {
            unsubKantaParchi();
            unsubLoans();
            unsubExpCats();
            unsubIncCats();
        };
    }, []); // Only run once on mount
    
    // Removed technical sync effect (moved to Data Audit report)
    
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

        // Filter suppliers and customers by variety if not 'All'
        const baseSuppliers = selectedVariety === 'All' 
            ? suppliers.filter(filterFn) 
            : suppliers.filter(s => filterFn(s) && s.variety?.trim() === selectedVariety);

        const baseCustomers = selectedVariety === 'All' 
            ? customers.filter(filterFn) 
            : customers.filter(c => filterFn(c) && c.variety?.trim() === selectedVariety);

        // Filter payments by variety
        const baseSupplierPayments = selectedVariety === 'All'
            ? supplierPayments.filter(filterFn)
            : supplierPayments.filter(p => {
                if (filterFn(p)) {
                    if (p.paidFor && Array.isArray(p.paidFor)) {
                        return p.paidFor.some(pf => supplierIdToVariety.get(pf.id || '') === selectedVariety);
                    }
                }
                return false;
            });

        const baseCustomerPayments = selectedVariety === 'All'
            ? customerPayments.filter(filterFn)
            : customerPayments.filter(p => {
                if (filterFn(p)) {
                    if (p.paidFor && Array.isArray(p.paidFor)) {
                        return p.paidFor.some(pf => customerIdToVariety.get(pf.id || '') === selectedVariety);
                    }
                }
                return false;
            });

        return {
            filteredIncomes: incomes.filter(i => filterFn(i) && !i.isInternal),
            filteredExpenses: expenses.filter(e => filterFn(e) && !e.isInternal),
            filteredSupplierPayments: baseSupplierPayments,
            filteredCustomerPayments: baseCustomerPayments,
            filteredFundTransactions: fundTransactions.filter(filterFn),
            filteredLoans: loans.filter(loanFilterFn),
            filteredSuppliers: baseSuppliers,
            filteredCustomers: baseCustomers,
        };
    }, [date, incomes, expenses, supplierPayments, customerPayments, fundTransactions, loans, suppliers, customers, selectedVariety, customerIdToVariety, supplierIdToVariety]);


    const allExpenses = useMemo(() => {
        const base = [...filteredData.filteredExpenses, ...filteredData.filteredSupplierPayments];
        // Add CD Given as a virtual expense for chart consistency
        const cdGivens = filteredData.filteredCustomerPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({
            ...p,
            amount: Number(p.cdAmount) || 0,
            particulars: 'CD Given'
        }));
        return [...base, ...cdGivens];
    }, [filteredData]);

    const allIncomes = useMemo(() => {
        const base = [...filteredData.filteredIncomes, ...filteredData.filteredCustomerPayments];
        // Add CD Received as a virtual income for chart consistency
        const cdReceiveds = filteredData.filteredSupplierPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({
            ...p,
            amount: Number(p.cdAmount) || 0,
            particulars: 'CD Received'
        }));
        return [...base, ...cdReceiveds];
    }, [filteredData]);
    
    // ✅ PERFORMANCE: Removed useSupplierData/useCustomerData hook calls from dashboard.
    // Those hooks recalculate full customerSummaryMap which is very expensive.
    // Dashboard does not need the full summary map — it uses global data directly.

    const totalCustomerReceivables = useMemo(() => {
        let total = 0;
        customers.forEach(c => {
            if (selectedVariety === 'All' || (c.variety && c.variety.trim() === selectedVariety)) {
                total += Number(c.originalNetAmount || c.netAmount || 0) + (Number(c.advanceFreight) || 0);
            }
        });
        customerPayments.forEach(p => {
            const receiptType = (p.receiptType || p.paymentMethod || '').toString().trim().toLowerCase();
            const isLedger = receiptType === 'ledger';
            const drCr = String((p as any).drCr || '').trim().toLowerCase();
            const isDebit = isLedger && drCr === 'debit';
            const amountAbs = Math.abs(Number(p.amount || 0));
            const cdAbs = Math.abs(Number(p.cdAmount || 0));

            let belongsToVariety = selectedVariety === 'All';
            if (!belongsToVariety && p.paidFor && Array.isArray(p.paidFor)) {
                belongsToVariety = p.paidFor.some(pf => customerIdToVariety.get(pf.id || '') === selectedVariety);
            }
            if (!belongsToVariety && !p.paidFor && p.customerId) {
                belongsToVariety = customerIdToVariety.get(p.customerId) === selectedVariety;
            }

            if (belongsToVariety) {
                if (isLedger && isDebit) {
                    // Ledger Debit increases customer dues (charge)
                    total += amountAbs;
                } else {
                    // Standard payment/credit reduces customer dues
                    total -= (amountAbs + cdAbs);
                }
            }
        });
        return Math.round(total * 100) / 100;
    }, [customers, customerPayments, selectedVariety, customerIdToVariety]);

    const totalSupplierDues = useMemo(() => {
        let total = 0;
        suppliers.forEach(s => {
            if (selectedVariety === 'All' || (s.variety && s.variety.trim() === selectedVariety)) {
                const netBill = Math.round(Number(s.amount || 0) - Number(s.labouryAmount || 0) - Number(s.kanta || 0) - Number(s.kartaAmount || 0)) + (Number((s as any).advanceFreight) || 0);
                total += netBill;
            }
        });
        supplierPayments.forEach(p => {
            const receiptType = (p.receiptType || '').toString().trim().toLowerCase();
            const isLedger = receiptType === 'ledger';
            const drCr = String((p as any).drCr || '').trim().toLowerCase();
            const isCredit = isLedger && drCr === 'credit';
            const amountAbs = Math.abs(Number(p.amount || 0));
            const cdAbs = Math.abs(Number(p.cdAmount || 0));

            let belongsToVariety = selectedVariety === 'All';
            if (!belongsToVariety && p.paidFor && Array.isArray(p.paidFor)) {
                belongsToVariety = p.paidFor.some(pf => supplierIdToVariety.get(pf.id || '') === selectedVariety);
            }
            if (!belongsToVariety && !p.paidFor && p.supplierId) {
                belongsToVariety = supplierIdToVariety.get(p.supplierId) === selectedVariety;
            }

            if (belongsToVariety) {
                if (isLedger && !isCredit) {
                    // Ledger Debit increases supplier dues (charge)
                    total += amountAbs;
                } else {
                    // Standard payment + cd reduces supplier dues
                    total -= (amountAbs + cdAbs);
                }
            }
        });
        return Math.round(total * 100) / 100;
    }, [suppliers, supplierPayments, selectedVariety, supplierIdToVariety]);

    const { totalIncome, totalExpense, netProfit, totalCdReceived, totalCdGiven, expenseBreakdown, incomeBreakdown } = useMemo(() => {
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
        
        // Calculate CD Given to Customers
        const cdGiven = filteredData.filteredCustomerPayments.reduce((sum, payment) => {
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
        
        // Breakdown supplier payments by type
        const supplierPaymentRegular = filteredData.filteredSupplierPayments.filter(p => p.rtgsFor !== 'Outsider').reduce((sum, item) => sum + item.amount, 0);
        const outsiderRTGS = filteredData.filteredSupplierPayments.filter(p => p.rtgsFor === 'Outsider').reduce((sum, item) => sum + item.amount, 0);
        const expenseForSuppliers = filteredData.filteredSupplierPayments.reduce((sum, item) => sum + item.amount, 0);
        
        const currentTotalIncome = incomeFromEntries + incomeFromCustomers + cdReceived;
        const currentTotalExpense = expenseFromEntries + expenseForSuppliers + cdGiven;

        return {
            totalIncome: currentTotalIncome,
            totalExpense: currentTotalExpense,
            netProfit: currentTotalIncome - currentTotalExpense,
            totalCdReceived: cdReceived,
            totalCdGiven: cdGiven,
            expenseBreakdown: {
                supplierPayment: supplierPaymentRegular,
                expenses: expenseFromEntries,
                outsiderRTGS: outsiderRTGS,
                cdGiven: cdGiven,
            },
            incomeBreakdown: {
                incomeEntries: incomeFromEntries,
                customerPayments: incomeFromCustomers,
                cdReceived,
            }
        }
    }, [filteredData]);
    
    // Technical counts removed (moved to Data Audit report)

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

        const intervalEnd = toEndOfDay(date?.to || date?.from || new Date());
        const isUpToDate = (d: string) => new Date(d) <= intervalEnd;

        // Use UNFILTERED data but only up to the selected end date for cumulative balance
        fundTransactions.filter(t => isUpToDate(t.date)).forEach(t => {
            if (balances.has(t.source)) {
                balances.set(t.source, (balances.get(t.source) || 0) - t.amount);
            }
            if (balances.has(t.destination)) {
                balances.set(t.destination, (balances.get(t.destination) || 0) + t.amount);
            }
        });
        
        const allIncomesUnfiltered = [...incomes, ...customerPayments];
        allIncomesUnfiltered.filter(t => isUpToDate(t.date)).forEach(t => {
            const balanceKey = t.bankAccountId || (('paymentMethod' in t && t.paymentMethod === 'Cash') ? 'CashInHand' : '');
            if (balanceKey && balances.has(balanceKey)) {
                 balances.set(balanceKey, (balances.get(balanceKey) || 0) + t.amount);
            }
        });
        
        const allExpensesUnfiltered = [...expenses, ...supplierPayments];
        allExpensesUnfiltered.filter(t => isUpToDate(t.date)).forEach(t => {
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
    }, [date, incomes, expenses, supplierPayments, customerPayments, fundTransactions, bankAccounts, totalSupplierDues, filteredData.filteredLoans]);

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
            return [
                { name: 'Permanent', value: permanent }, 
                { name: 'Seasonal', value: seasonal }, 
                { name: 'Supplier Payments', value: supplier },
                { name: 'CD Given', value: totalCdGiven }
            ];
        }
        if (level1 === 'Income') {
             const fromSales = filteredData.filteredCustomerPayments.reduce((sum, item) => sum + item.amount, 0);
             const byCategory = groupDataByField(filteredData.filteredIncomes, 'category');
             return [
                 { name: 'From Sales', value: fromSales }, 
                 { name: 'CD Received', value: totalCdReceived },
                 ...byCategory
             ];
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
            const grouped: Record<string, { dayTs: number; date: string; income: number; expense: number }> = {};
            
            // Helper to get day key and initialize if needed
            const getGroup = (dateStr: string) => {
                const dayDate = toStartOfDay(dateStr);
                const dayTs = dayDate.getTime();
                const dayKey = String(dayTs);
                if (!grouped[dayKey]) {
                    grouped[dayKey] = { dayTs, date: format(dayDate, 'MMM dd'), income: 0, expense: 0 };
                }
                return grouped[dayKey];
            };

            // Process incomes
            allIncomes.forEach(t => {
                const group = getGroup(t.date);
                group.income += t.amount;
            });

            // Process expenses
            allExpenses.forEach(t => {
                const group = getGroup(t.date);
                group.expense += t.amount;
            });

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
            }); // Removed filter(item => item.value > 0) to show all sources
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
    
    const forensicData = useMemo(() => {
        if (!activeForensicView) return null;

        let title = "";
        let data: LedgerEntry[] = [];
        let icon = <Activity size={24} />;
        let summary = { inLabel: 'Credit', outLabel: 'Debit', netLabel: 'Balance' };

        if (activeForensicView === 'INCOME') {
            title = "Total Income";
            icon = <TrendingUp size={24} />;
            summary = { inLabel: 'Total Income', outLabel: 'Reversals', netLabel: 'Net Income' };
            data = [
                ...filteredData.filteredIncomes.map(t => ({ date: t.date, particulars: t.description || t.category, id: t.id, debit: 0, credit: t.amount, type: 'Income Entry' })),
                ...filteredData.filteredCustomerPayments.map(p => ({ date: p.date, particulars: `Payment from ${(p as any).customerName || (p as any).supplierName || 'Customer'}`, id: p.paymentId || 'CP', debit: 0, credit: p.amount, type: 'Customer Payment' })),
                ...filteredData.filteredSupplierPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD from ${p.supplierName}`, id: p.paymentId || 'CD', debit: 0, credit: Number(p.cdAmount), type: 'CD Received' }))
            ];
        } else if (activeForensicView === 'EXPENSE') {
            title = "Total Expense";
            icon = <TrendingDown size={24} />;
            summary = { inLabel: 'Refunds', outLabel: 'Total Expense', netLabel: 'Net Expense' };
            data = [
                ...filteredData.filteredExpenses.map(t => ({ date: t.date, particulars: t.description || t.category, id: t.id, debit: t.amount, credit: 0, type: 'Expense Entry' })),
                ...filteredData.filteredSupplierPayments.map(p => ({ date: p.date, particulars: `Payment to ${p.supplierName}`, id: p.paymentId || 'SP', debit: p.amount, credit: 0, type: 'Supplier Payment' })),
                ...filteredData.filteredCustomerPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD to ${(p as any).customerName || (p as any).supplierName || 'Customer'}`, id: p.paymentId || 'CD', debit: Number(p.cdAmount), credit: 0, type: 'CD Given' }))
            ];
        } else if (activeForensicView === 'PROFIT') {
            title = "Net Profit/Loss";
            icon = <DollarSign size={24} />;
            summary = { inLabel: 'Total Income', outLabel: 'Total Expense', netLabel: 'Net Profit' };
            const incomeData = [
                ...filteredData.filteredIncomes.map(t => ({ date: t.date, particulars: t.description || t.category, id: t.id, debit: 0, credit: t.amount, type: 'Income' })),
                ...filteredData.filteredCustomerPayments.map(p => ({ date: p.date, particulars: `Payment from ${(p as any).customerName || (p as any).supplierName || 'Customer'}`, id: p.paymentId || 'CP', debit: 0, credit: p.amount, type: 'Customer Payment' })),
                ...filteredData.filteredSupplierPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD Received`, id: p.paymentId || 'CD', debit: 0, credit: Number(p.cdAmount), type: 'CD' }))
            ];
            const expenseData = [
                ...filteredData.filteredExpenses.map(t => ({ date: t.date, particulars: t.description || t.category, id: t.id, debit: t.amount, credit: 0, type: 'Expense' })),
                ...filteredData.filteredSupplierPayments.map(p => ({ date: p.date, particulars: `Payment to ${p.supplierName}`, id: p.paymentId || 'SP', debit: p.amount, credit: 0, type: 'Supplier Payment' })),
                ...filteredData.filteredCustomerPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD Given`, id: p.paymentId || 'CD', debit: Number(p.cdAmount), credit: 0, type: 'CD' }))
            ];
            data = [...incomeData, ...expenseData];
        } else if (activeForensicView === 'CD') {
            title = "Cash Discount (CD)";
            icon = <HandCoins size={24} />;
            summary = { inLabel: 'CD Received', outLabel: 'CD Given', netLabel: 'Net CD' };
            data = [
                ...filteredData.filteredSupplierPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD from ${p.supplierName}`, id: p.paymentId || 'CD', debit: 0, credit: Number(p.cdAmount), type: 'CD Received' })),
                ...filteredData.filteredCustomerPayments.filter(p => (Number(p.cdAmount) || 0) > 0).map(p => ({ date: p.date, particulars: `CD to ${(p as any).customerName || (p as any).supplierName || 'Customer'}`, id: p.paymentId || 'CD', debit: Number(p.cdAmount), credit: 0, type: 'CD Given' }))
            ];
        } else if (activeForensicView === 'DUES') {
            title = "Supplier Dues Ledger";
            icon = <Users size={24} />;
            summary = { inLabel: 'Dues Paid', outLabel: 'Dues Created', netLabel: 'Outstanding' };
            data = [
                ...filteredData.filteredSupplierPayments.map(p => ({ 
                    date: p.date, 
                    particulars: `Payment to ${p.supplierName}`, 
                    id: p.paymentId || 'SP', 
                    debit: 0, 
                    credit: Number(p.amount || 0) + (Number(p.cdAmount) || 0), 
                    type: 'Settlement' 
                })),
                ...filteredData.filteredSuppliers.map(e => ({ 
                    date: e.date, 
                    particulars: `Purchase from ${e.name}`, 
                    id: e.id, 
                    debit: Number(e.originalNetAmount || e.netAmount || 0), 
                    credit: 0, 
                    type: 'Bill Created' 
                }))
            ];
        } else if (activeForensicView === 'RECEIVABLES') {
            title = "Customer Receivables Ledger";
            icon = <Users size={24} />;
            summary = { inLabel: 'Collected', outLabel: 'Sales Created', netLabel: 'Outstanding' };
            data = [
                ...filteredData.filteredCustomerPayments.map(p => ({ 
                    date: p.date, 
                    particulars: `Collection from ${(p as any).customerName || (p as any).supplierName || 'Customer'}`, 
                    id: p.paymentId || 'CP', 
                    debit: 0, 
                    credit: Number(p.amount || 0) + (Number(p.cdAmount) || 0), 
                    type: 'Collection' 
                })),
                ...filteredData.filteredCustomers.map(e => ({ 
                    date: e.date, 
                    particulars: `Sale to ${e.name}`, 
                    id: e.id, 
                    debit: Number(e.originalNetAmount || e.netAmount || 0), 
                    credit: 0, 
                    type: 'Sale Created' 
                }))
            ];
        }

        return { title, data, icon, summary };
    }, [activeForensicView, filteredData, globalData, date]);

    if (activeForensicView && forensicData) {
        return (
            <div className="p-4 sm:p-6">
                <ForensicAccountLedger 
                    title={forensicData.title}
                    icon={forensicData.icon}
                    data={forensicData.data}
                    summary={forensicData.summary}
                    onBack={() => setActiveForensicView(null)}
                />
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="space-y-6">
                <DashboardFilters 
                    date={date} 
                    setDate={setDate} 
                    selectedVariety={selectedVariety}
                    setSelectedVariety={setSelectedVariety}
                    uniqueVarieties={uniqueVarieties}
                />

            <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <div 
                    onClick={() => setActiveForensicView('INCOME')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Total Income" 
                        value={formatCurrency(totalIncome)} 
                        icon={<TrendingUp />} 
                        colorClass="text-green-500" 
                        isLoading={isLoading}
                        description={`Entries: ${formatCurrency(incomeBreakdown.incomeEntries)} | Payments: ${formatCurrency(incomeBreakdown.customerPayments)} | CD: ${formatCurrency(incomeBreakdown.cdReceived)}`}
                    />
                </div>

                <div 
                    onClick={() => setActiveForensicView('EXPENSE')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Total Expense" 
                        value={formatCurrency(totalExpense)} 
                        icon={<TrendingDown />} 
                        colorClass="text-red-500" 
                        isLoading={isLoading}
                        description={`Supplier: ${formatCurrency(expenseBreakdown.supplierPayment)} | Expense: ${formatCurrency(expenseBreakdown.expenses)} | CD: ${formatCurrency(expenseBreakdown.cdGiven)}`}
                    />
                </div>

                <div 
                    onClick={() => setActiveForensicView('PROFIT')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Net Profit/Loss" 
                        value={formatCurrency(netProfit)} 
                        icon={<DollarSign />} 
                        colorClass={netProfit >= 0 ? "text-green-500" : "text-red-500"} 
                        isLoading={isLoading}
                    />
                </div>

                <div 
                    onClick={() => setActiveForensicView('CD')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Net Cash Discount" 
                        value={formatCurrency(totalCdReceived - totalCdGiven)} 
                        icon={<HandCoins />} 
                        colorClass={(totalCdReceived - totalCdGiven) >= 0 ? "text-emerald-500" : "text-red-500"} 
                        isLoading={isLoading}
                        description={`Rec: ${formatCurrency(totalCdReceived)} | Giv: ${formatCurrency(totalCdGiven)}`}
                    />
                </div>

                <div 
                    onClick={() => setActiveForensicView('DUES')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Supplier Dues" 
                        value={formatCurrency(totalSupplierDues)} 
                        icon={<Users />} 
                        colorClass="text-amber-500" 
                        isLoading={isLoading}
                    />
                </div>

                <div 
                    onClick={() => setActiveForensicView('RECEIVABLES')}
                    className="min-w-0 h-full flex items-stretch cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    <StatCard 
                        className="w-full h-full"
                        title="Customer Receivables" 
                        value={formatCurrency(totalCustomerReceivables)} 
                        icon={<Users />} 
                        colorClass="text-blue-500" 
                        isLoading={isLoading}
                    />
                </div>
            </div>

            <DashboardCharts
                assetsLiabilitiesData={assetsLiabilitiesData}
                paymentMethodData={paymentMethodData}
                fundSourcesData={fundSourcesData}
                incomeExpenseChartData={incomeExpenseChartData}
            />
            
            {/* Technical counters moved to Data Audit report */}
            
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
        </div>
        </ErrorBoundary>
    );
}

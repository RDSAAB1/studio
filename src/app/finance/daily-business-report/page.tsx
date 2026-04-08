"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useGlobalData } from "@/contexts/global-data-context";
import { getLoansRealtime } from "@/lib/firestore";
import type { Loan } from "@/lib/definitions";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { format, isSameDay, startOfDay, subDays, differenceInDays, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, TrendingUp, TrendingDown, DollarSign, Wallet, Warehouse, Info, BarChart3, FileSpreadsheet, FileText, ArrowLeftRight } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { printHtmlContent } from "@/lib/electron-print";
import { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    Legend, 
    Cell,
    PieChart,
    Pie
} from 'recharts';
import { 
    ChartConfig, 
    ChartContainer, 
    ChartTooltip, 
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent
} from "@/components/ui/chart";

interface VarietySummary {
    variety: string;
    totalQty: number;
    totalValue: number;
    avgRate: number;
    margin?: number; // Advanced: Sale - Purchase
    marginPct?: number;
}

export default function DailyBusinessReport() {
    const globalData = useGlobalData();
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loans, setLoans] = useState<Loan[]>([]);

    useEffect(() => {
        const unsubscribe = getLoansRealtime(setLoans, () => {});
        return () => unsubscribe();
    }, []);

    const reportData = useMemo(() => {
        const filterDate = startOfDay(startDate);
        const filterEndDate = startOfDay(endDate);
        const rangeInDays = differenceInDays(filterEndDate, filterDate) + 1;
        const offsetDate = (d: string | Date) => startOfDay(new Date(d));

        const getBalancesAtDate = (date: Date) => {
            const bankBalances = new Map<string, number>();
            globalData.bankAccounts.forEach(acc => bankBalances.set(acc.id, 0));
            let cashInHand = 0; let cashAtHome = 0;
            const targetDate = startOfDay(date);
            const isUntil = (d: any) => offsetDate(d) <= targetDate;

            globalData.fundTransactions.filter(t => isUntil(t.date)).forEach(t => {
                const amount = Number(t.amount) || 0;
                if (t.source === 'CashInHand') cashInHand -= amount;
                if (t.destination === 'CashInHand') cashInHand += amount;
                if (t.source === 'CashAtHome') cashAtHome -= amount;
                if (t.destination === 'CashAtHome') cashAtHome += amount;
                if (bankBalances.has(t.source)) bankBalances.set(t.source, (bankBalances.get(t.source) || 0) - amount);
                if (bankBalances.has(t.destination)) bankBalances.set(t.destination, (bankBalances.get(t.destination) || 0) + amount);
            });
            globalData.incomes.filter(i => isUntil(i.date)).forEach(i => {
                if (i.isInternal) return; 
                const amt = Number(i.amount) || 0;
                const id = i.bankAccountId;
                if (id === 'CashAtHome') cashAtHome += amt;
                else if (id === 'CashInHand' || (i.paymentMethod === 'Cash' && !id)) cashInHand += amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) + amt);
            });
            globalData.expenses.filter(e => isUntil(e.date)).forEach(e => {
                if (e.isInternal) return; 
                const amt = Number(e.amount) || 0;
                const id = e.bankAccountId;
                if (id === 'CashAtHome') cashAtHome -= amt;
                else if (id === 'CashInHand' || (e.paymentMethod === 'Cash' && !id)) cashInHand -= amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) - amt);
            });
            globalData.supplierPayments.filter(p => isUntil(p.date)).forEach(p => {
                const amt = Number(p.amount) || 0;
                let id = p.bankAccountId;
                if (!id && (p.receiptType === 'RTGS' || p.receiptType === 'Online')) {
                    const accMatch = globalData.bankAccounts.find(acc => acc.accountNumber === (p as any).bankAcNo);
                    if (accMatch) id = accMatch.id;
                }
                if (id === 'CashAtHome') cashAtHome -= amt;
                else if (id === 'CashInHand' || (p.receiptType === 'Cash' && !id)) cashInHand -= amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) - amt);
            });
            globalData.customerPayments.filter(p => isUntil(p.date)).forEach(p => {
                const amt = Number(p.amount) || 0;
                const id = p.bankAccountId;
                if (id === 'CashAtHome') cashAtHome += amt;
                else if (id === 'CashInHand' || (p.paymentMethod === 'Cash' && !id)) cashInHand += amt;
                else if (id && bankBalances.has(id)) bankBalances.set(id, (bankBalances.get(id) || 0) + amt);
            });

            return { bankBalances, cashInHand, cashAtHome, total: Array.from(bankBalances.values()).reduce((s, b) => s + b, 0) + cashInHand + cashAtHome };
        };

        const dayWiseLiquidity = Array.from({ length: rangeInDays }).map((_, i) => {
            const day = startOfDay(addDays(filterDate, i));
            const opening = getBalancesAtDate(subDays(day, 1));
            const closing = getBalancesAtDate(day);
            const isDay = (d: any) => isSameDay(offsetDate(d), day);

            const accounts = ['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)];
            const metrics: Record<string, any> = {};

            accounts.forEach(id => {
                let op = 0; let cl = 0;
                if (id === 'CashInHand') { op = opening.cashInHand; cl = closing.cashInHand; }
                else if (id === 'CashAtHome') { op = opening.cashAtHome; cl = closing.cashAtHome; }
                else { op = opening.bankBalances.get(id) || 0; cl = closing.bankBalances.get(id) || 0; }

                const dayIncs = globalData.incomes.filter(inc => isDay(inc.date) && !inc.isInternal && (inc.bankAccountId === id || (id === 'CashInHand' && inc.paymentMethod === 'Cash' && !inc.bankAccountId))).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                const dayExps = globalData.expenses.filter(exp => isDay(exp.date) && !exp.isInternal && (exp.bankAccountId === id || (id === 'CashInHand' && exp.paymentMethod === 'Cash' && !exp.bankAccountId))).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                const daySPmts = globalData.supplierPayments.filter(p => isDay(p.date) && ((p.bankAccountId === id) || (id === 'CashInHand' && p.receiptType === 'Cash' && !p.bankAccountId) || (!p.bankAccountId && (p.receiptType === 'RTGS' || p.receiptType === 'Online') && globalData.bankAccounts.find(acc => acc.id === id)?.accountNumber === (p as any).bankAcNo))).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                const dayCPmts = globalData.customerPayments.filter(p => isDay(p.date) && (p.bankAccountId === id || (id === 'CashInHand' && p.paymentMethod === 'Cash' && !p.bankAccountId))).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                
                // Add Fund Transactions to income/expense
                const dayFundIns = globalData.fundTransactions.filter(t => isDay(t.date) && t.destination === id).reduce((s, x) => s + (Number(x.amount) || 0), 0);
                const dayFundOuts = globalData.fundTransactions.filter(t => isDay(t.date) && t.source === id).reduce((s, x) => s + (Number(x.amount) || 0), 0);

                metrics[id] = { 
                    opening: Math.round(op), 
                    closing: Math.round(cl), 
                    income: Math.round(dayIncs + dayCPmts + dayFundIns), 
                    expense: Math.round(dayExps + daySPmts + dayFundOuts) 
                };
            });

            return { date: format(day, 'dd MMM'), metrics, totalOpening: Math.round(opening.total), totalClosing: Math.round(closing.total) };
        });

        const liquidSnapshot = getBalancesAtDate(filterEndDate);

        const periodScope = (d: any) => {
            const ed = offsetDate(d);
            return ed >= filterDate && ed <= filterEndDate;
        };

        const pMap = new Map<string, VarietySummary>();
        globalData.suppliers.filter(s => periodScope(s.date)).forEach(s => {
            const v = (s.variety || 'Unknown').toUpperCase().trim();
            if (!pMap.has(v)) pMap.set(v, { variety: v, totalQty: 0, totalValue: 0, avgRate: 0 });
            const e = pMap.get(v)!;
            const qty   = Number(s.netWeight) || 0;
            const lab   = Number(s.labouryAmount) || 0;
            const kn    = Number(s.kanta) || 0;
            const gross = qty * (Number(s.rate) || 0);
            e.totalQty   += qty;
            e.totalValue += Math.max(0, gross - lab - kn); // net value after deductions
        });
        pMap.forEach(v => v.avgRate = v.totalQty > 0 ? v.totalValue / v.totalQty : 0);

        const sMap = new Map<string, VarietySummary>();
        globalData.customers.filter(c => periodScope(c.date)).forEach(c => {
            const v = (c.variety || 'Unknown').toUpperCase().trim();
            if (!sMap.has(v)) sMap.set(v, { variety: v, totalQty: 0, totalValue: 0, avgRate: 0 });
            const e = sMap.get(v)!;
            e.totalQty += Number(c.netWeight) || 0;
            e.totalValue += Number(c.amount) || 0;
        });
        sMap.forEach(v => v.avgRate = v.totalQty > 0 ? v.totalValue / v.totalQty : 0);

        const dayWiseFlows = Array.from({ length: rangeInDays }).map((_, i) => {
            const day = startOfDay(addDays(filterDate, i));
            const isDay = (d: any) => isSameDay(offsetDate(d), day);
            const sPmts = globalData.supplierPayments.filter(p => isDay(p.date));
            const sCash = sPmts.filter(p => p.receiptType === 'Cash').reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const sRtgs = sPmts.filter(p => p.receiptType === 'RTGS').reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const gDist = sPmts.filter(p => p.receiptType === 'Gov Dist').reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const exps = globalData.expenses.filter(e => isDay(e.date) && !e.isInternal).reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const incs = globalData.incomes.filter(i => isDay(i.date) && !i.isInternal).reduce((s, i) => s + (Number(i.amount) || 0), 0);
            const totalPayments = sCash + sRtgs + gDist;
            const seCash = sCash + exps;
            const netTotal = (totalPayments + exps) - incs;
            return { date: format(day, 'dd MMM'), supplierCash: Math.round(sCash), supplierRtgs: Math.round(sRtgs), govDist: Math.round(gDist), totalPayments: Math.round(totalPayments), expenses: Math.round(exps), incomes: Math.round(incs), seCash: Math.round(seCash), netTotal: Math.round(netTotal) };
        });

        const varietyDayData: Record<string, any[]> = {};
        globalData.suppliers.filter(s => periodScope(s.date)).forEach(s => {
            const v = (s.variety || 'Unknown').toUpperCase().trim();
            if (!varietyDayData[v]) varietyDayData[v] = [];
            const dayStr = format(offsetDate(s.date), 'dd MMM yyyy');
            let dEntry = varietyDayData[v].find(de => de.date === dayStr);
            if (!dEntry) {
                dEntry = { date: dayStr, gross: 0, tier: 0, finalWt: 0, kartaWt: 0, netWt: 0, totalAmt: 0, labAmt: 0, kanAmt: 0, totalOriginal: 0, totalPaid: 0, netPayable: 0, parchi: 0, rates: [] };
                varietyDayData[v].push(dEntry);
            }
            dEntry.gross += Number(s.grossWeight) || 0;
            dEntry.tier += Number(s.teirWeight) || 0;
            dEntry.finalWt += Number(s.weight) || 0;
            dEntry.kartaWt += Number(s.kartaWeight) || 0;
            dEntry.netWt += Number(s.netWeight) || 0;
            dEntry.totalAmt += Number(s.amount) || 0;
            dEntry.labAmt += Number(s.labouryAmount) || 0;
            dEntry.kanAmt += Number(s.kanta) || 0;
            dEntry.totalOriginal += Number(s.originalNetAmount) || 0;
            dEntry.netPayable += Number(s.netAmount) || 0;
            dEntry.totalPaid = dEntry.totalOriginal - dEntry.netPayable;
            dEntry.parchi += 1;
            dEntry.rates.push(Number(s.rate) || 0);
        });

        const stockMap = new Map<string, number>();
        globalData.suppliers.filter(s => offsetDate(s.date) <= filterEndDate).forEach(s => {
            const v = (s.variety || 'Unknown').toUpperCase().trim();
            stockMap.set(v, (stockMap.get(v) || 0) + (Number(s.netWeight) || 0));
        });
        globalData.customers.filter(c => offsetDate(c.date) <= filterEndDate).forEach(c => {
            const v = (c.variety || 'Unknown').toUpperCase().trim();
            stockMap.set(v, (stockMap.get(v) || 0) - (Number(c.netWeight) || 0));
        });

        const consolidatedLedger = [
            ...(() => {
                const resultArr: any[] = [];
                const daysInRange = Array.from({ length: rangeInDays }).map((_, i) => addDays(filterDate, i));
                
                let opCashHand = 0; let opCashHome = 0;
                const opBanks = new Map<string, number>();
                globalData.bankAccounts.forEach(acc => opBanks.set(acc.id, 0));

                const isBefore = (d: any) => offsetDate(d) < filterDate;

                globalData.fundTransactions.filter(t => isBefore(t.date)).forEach(t => {
                    const amt = Number(t.amount) || 0;
                    if (t.source === 'CashInHand') opCashHand -= amt;
                    if (t.destination === 'CashInHand') opCashHand += amt;
                    if (t.source === 'CashAtHome') opCashHome -= amt;
                    if (t.destination === 'CashAtHome') opCashHome += amt;
                    if (opBanks.has(t.source)) opBanks.set(t.source, (opBanks.get(t.source) || 0) - amt);
                    if (opBanks.has(t.destination)) opBanks.set(t.destination, (opBanks.get(t.destination) || 0) + amt);
                });
                globalData.incomes.filter(i => isBefore(i.date) && !i.isInternal).forEach(i => {
                    const amt = Number(i.amount) || 0;
                    if (i.bankAccountId === 'CashAtHome') opCashHome += amt;
                    else if (i.bankAccountId === 'CashInHand' || (i.paymentMethod === 'Cash' && !i.bankAccountId)) opCashHand += amt;
                    else if (i.bankAccountId && opBanks.has(i.bankAccountId)) opBanks.set(i.bankAccountId, (opBanks.get(i.bankAccountId) || 0) + amt);
                });
                globalData.expenses.filter(e => isBefore(e.date) && !e.isInternal).forEach(e => {
                    const amt = Number(e.amount) || 0;
                    if (e.bankAccountId === 'CashAtHome') opCashHome -= amt;
                    else if (e.bankAccountId === 'CashInHand' || (e.paymentMethod === 'Cash' && !e.bankAccountId)) opCashHand -= amt;
                    else if (e.bankAccountId && opBanks.has(e.bankAccountId)) opBanks.set(e.bankAccountId, (opBanks.get(e.bankAccountId) || 0) - amt);
                });
                globalData.supplierPayments.filter(p => isBefore(p.date) && (p as any).status !== 'Pending').forEach(p => {
                    const amt = Number(p.amount) || 0;
                    if (p.bankAccountId === 'CashAtHome') opCashHome -= amt;
                    else if (p.bankAccountId === 'CashInHand' || (p.receiptType === 'Cash' && !p.bankAccountId)) opCashHand -= amt;
                    else if (p.bankAccountId && opBanks.has(p.bankAccountId)) opBanks.set(p.bankAccountId, (opBanks.get(p.bankAccountId) || 0) - amt);
                });
                globalData.customerPayments.filter(p => isBefore(p.date)).forEach(p => {
                    const amt = Number(p.amount) || 0;
                    if (p.bankAccountId === 'CashAtHome') opCashHome += amt;
                    else if (p.bankAccountId === 'CashInHand' || (p.paymentMethod === 'Cash' && !p.bankAccountId)) opCashHand += amt;
                    else if (p.bankAccountId && opBanks.has(p.bankAccountId)) opBanks.set(p.bankAccountId, (opBanks.get(p.bankAccountId) || 0) + amt);
                });

                resultArr.push({ date: filterDate.toISOString(), particulars: "OPENING BALANCE: CASH IN HAND", id: 'OP-CASH', debit: 0, credit: opCashHand, type: 'Liquid' });
                resultArr.push({ date: filterDate.toISOString(), particulars: "OPENING BALANCE: CASH AT HOME", id: 'OP-HOME', debit: 0, credit: opCashHome, type: 'Liquid' });
                globalData.bankAccounts.forEach(acc => {
                    resultArr.push({ date: filterDate.toISOString(), particulars: `OPENING BALANCE: ${acc.bankName} (...${acc.accountNumber.slice(-4)})`, id: 'OP-BANK', debit: 0, credit: opBanks.get(acc.id) || 0, type: 'Liquid' });
                });

                daysInRange.forEach(dDate => {
                    const dStr = format(dDate, 'yyyy-MM-dd');
                    const daySupps = globalData.suppliers.filter(s => isSameDay(new Date(s.date), dDate));
                    if (daySupps.length > 0) {
                        const dLab = daySupps.reduce((sum, p) => sum + (Number(p.labouryAmount) || 0), 0);
                        const dKn  = daySupps.reduce((sum, p) => sum + (Number(p.kanta) || 0), 0);
                        const dNet = daySupps.reduce((sum, p) => sum + ((Number(p.netWeight) || 0) * (Number(p.rate) || 0)), 0);

                        // Each purchase = DEBIT (gross amount, because lab+kanta are separate credit entries)
                        daySupps.forEach(s => {
                            const qty    = Number(s.netWeight)     || 0;
                            const rate   = Number(s.rate)          || 0;
                            const gross  = qty * rate;
                            const lab    = Number(s.labouryAmount) || 0;
                            const kn     = Number(s.kanta)         || 0;
                            const varietyName = (s.variety || '').toUpperCase().trim();
                            const variety = varietyName ? ` [${varietyName}]` : '';
                            const inclusions = [
                                lab > 0 ? `Lab ₹${Math.round(lab).toLocaleString('en-IN')}` : '',
                                kn  > 0 ? `Kanta ₹${Math.round(kn).toLocaleString('en-IN')}` : '',
                            ].filter(Boolean).join(' + ');
                            const breakdown = inclusions
                                ? `Gross ₹${Math.round(gross).toLocaleString('en-IN')} (includes ${inclusions})`
                                : `₹${Math.round(gross).toLocaleString('en-IN')}`;
                            const namePart = [s.name, s.fatherName, s.address].filter((x): x is string => typeof x === 'string').map(x => x.trim()).join(', ');
                            resultArr.push({
                                date: dStr,
                                particulars: `[${s.srNo}]${variety} ${namePart} | ${qty.toFixed(2)} QTL @ ₹${rate} | `,
                                id: s.id.slice(-6).toUpperCase(),
                                debit: Math.round(gross),   // GROSS — lab/kanta offset via separate credit entries
                                credit: 0,
                                type: 'Purchase'
                            });
                        });

                        // Labour = CREDIT (already deducted from farmer payment, comes to us)
                        if (dLab > 0) resultArr.push({
                            date: dStr,
                            particulars: `(${daySupps.length} parchi)`,
                            id: 'LABR', debit: 0, credit: dLab, type: 'Labour'
                        });

                        // Kanta = CREDIT (already deducted from farmer payment, comes to us)
                        if (dKn > 0) resultArr.push({
                            date: dStr,
                            particulars: `(${daySupps.length} parchi)`,
                            id: 'KANT', debit: 0, credit: dKn, type: 'Kanta'
                        });

                        // Net value CREDIT = gross value MINUS labour MINUS kanta (actual stock value credited)
                        const netCredit = dNet - dLab - dKn;
                        if (netCredit > 0) resultArr.push({
                            date: dStr,
                            particulars: `Net Stock Value Credit (${daySupps.length} parchi | Gross ₹${Math.round(dNet).toLocaleString('en-IN')} − Lab ₹${Math.round(dLab).toLocaleString('en-IN')} − Kanta ₹${Math.round(dKn).toLocaleString('en-IN')} = ₹${Math.round(netCredit).toLocaleString('en-IN')})`,
                            id: 'NETV', debit: 0, credit: netCredit, type: 'P ADJUSTMENT'
                        });
                    }
                });
                return resultArr;
            })(),
            ...globalData.customers.filter(c => periodScope(c.date)).map(c => {
                const namePart = [c.name, c.companyName, c.address].filter((x): x is string => typeof x === 'string').map(x => x.trim()).join(', ');
                const variety = (c.variety || '').toUpperCase().trim();
                return {
                    date: c.date,
                    particulars: `${namePart} (${variety}) | Qty: ${Number(c.netWeight || 0).toFixed(2)} QTL`,
                    id: c.id.slice(-6).toUpperCase(), debit: 0, credit: Number(c.amount) || 0, type: 'Sale'
                };
            }),
            ...globalData.supplierPayments.filter(p => periodScope(p.date)).map(p => {
                const method = p.receiptType || p.paymentMethod || 'Cash';
                const ref = p.utrNo || p.checkNo ? ` | Ref: ${p.utrNo || p.checkNo}` : '';
                
                let safePaidFor: any[] = [];
                const pfRaw = p.paidFor as any;
                if (Array.isArray(pfRaw)) safePaidFor = pfRaw;
                else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
                    try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
                }

                const linkedStr = safePaidFor.map((pf: any) => pf.srNo).filter(Boolean).join(', ') || p.parchiNo || '';
                const linked = linkedStr ? `[${linkedStr}] ` : '';
                return {
                    date: p.date,
                    particulars: `${linked}${p.supplierName || 'Supplier'} (${method})${ref}`,
                    id: p.paymentId || 'PAY', debit: Number(p.amount) || 0, credit: 0, type: 'Supplier Payment'
                };
            }),
            ...globalData.customerPayments.filter(p => periodScope(p.date)).map(p => {
                const method = p.receiptType || p.paymentMethod || 'Cash';
                const ref = (p as any).utrNo || (p as any).checkNo ? ` | Ref: ${(p as any).utrNo || (p as any).checkNo}` : '';
                const customer = globalData.customers.find(c => c.id === p.customerId);
                const cName = customer ? (customer.companyName || customer.name || 'Customer') : 'Customer';
                return {
                    date: p.date,
                    particulars: `${cName} (${method})${ref}`,
                    id: p.paymentId || 'REC', debit: 0, credit: Number(p.amount) || 0, type: 'Customer Receipt'
                };
            }),
            ...globalData.incomes.filter(i => periodScope(i.date) && !i.isInternal).map(i => ({
                date: i.date,
                particulars: `${i.payee.trim()} - ${(i.category || '').trim()} (${(i.paymentMethod || 'Cash').trim()})`,
                id: i.transactionId || 'INC', debit: 0, credit: Number(i.amount) || 0, type: 'Income'
            })),
            ...globalData.expenses.filter(e => periodScope(e.date) && !e.isInternal).map(e => ({
                date: e.date,
                particulars: `${e.payee.trim()} - ${(e.category || '').trim()} (${(e.paymentMethod || 'Cash').trim()})`,
                id: e.transactionId || 'EXP', debit: Number(e.amount) || 0, credit: 0, type: 'Expense'
            })),
            // Loans → CREDIT only (money received into business)
            ...((globalData as any).loans || []).filter((l: any) => l.startDate && periodScope(l.startDate) && l.loanType !== 'OwnerCapital').map((l: any) => ({
                date: l.startDate,
                particulars: `${l.loanName || l.lenderName || 'Lender'} (${l.loanType})`,
                id: l.id?.slice(-6).toUpperCase() || 'LOAN',
                debit: 0,
                credit: Number(l.totalAmount) || 0,
                type: 'Loan'
            })),
            // Fund Transfers → 2 separate entries: DEBIT from source, CREDIT to destination
            ...globalData.fundTransactions.filter(t => periodScope(t.date)).flatMap(t => {
                const amt = Number(t.amount) || 0;
                const isLiquidSrc = t.source === 'CashInHand' || t.source === 'CashAtHome' || globalData.bankAccounts.some(b => b.id === t.source);
                const isLiquidDst = t.destination === 'CashInHand' || t.destination === 'CashAtHome' || globalData.bankAccounts.some(b => b.id === t.destination);
                
                const srcLabel = t.source === 'CashInHand' ? 'Cash in Hand' : t.source === 'CashAtHome' ? 'Cash at Home' : (globalData.bankAccounts.find(b=>b.id===t.source)?.bankName || t.source);
                const dstLabel = t.destination === 'CashInHand' ? 'Cash in Hand' : t.destination === 'CashAtHome' ? 'Cash at Home' : (globalData.bankAccounts.find(b=>b.id===t.destination)?.bankName || t.destination);
                
                const results = [];
                if (isLiquidSrc) {
                    results.push({ date: t.date, particulars: `${srcLabel} → ${dstLabel}${t.description ? ' | ' + t.description : ''}`, id: t.id?.slice(-6).toUpperCase() || 'TRF', debit: amt, credit: 0, type: 'Transfer Out' });
                }
                if (isLiquidDst) {
                    results.push({ date: t.date, particulars: `${dstLabel} ← ${srcLabel}${t.description ? ' | ' + t.description : ''}`, id: t.id?.slice(-6).toUpperCase() || 'TRF', debit: 0, credit: amt, type: 'Transfer In' });
                }
                return results;
            }),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const totalInflow = dayWiseFlows.reduce((s,d) => s + d.incomes, 0);
        const totalOutflow = dayWiseFlows.reduce((s,d) => s + d.totalPayments + d.expenses, 0);

        return {
            liquid: liquidSnapshot,
            dayWiseLiquidity,
            purchases: Array.from(pMap.values()),
            sales: Array.from(sMap.values()),
            varietyStock: Array.from(stockMap.entries()).map(([variety, qty]) => ({ variety, qty })).sort((a,b) => b.qty - a.qty),
            distribution: {
                supplierCash: dayWiseFlows.reduce((s,d) => s + d.supplierCash, 0),
                supplierRtgs: dayWiseFlows.reduce((s,d) => s + d.supplierRtgs, 0),
                govDist: dayWiseFlows.reduce((s,d) => s + d.govDist, 0),
                totalPayments: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0),
                expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0),
                incomes: dayWiseFlows.reduce((s,d) => s + d.incomes, 0),
                seCash: dayWiseFlows.reduce((s,d) => s + d.seCash, 0),
                netTotalBalance: dayWiseFlows.reduce((s,d) => s + d.netTotal, 0)
            },
            dayWise: dayWiseFlows,
            varietyDayData,
            consolidatedLedger,
            outflow: { supplier: dayWiseFlows.reduce((s,d) => s + d.totalPayments, 0), expenses: dayWiseFlows.reduce((s,d) => s + d.expenses, 0), cdReceived: 0, totalOutflow },
            inflow: { customer: 0, other: dayWiseFlows.reduce((s,d) => s + d.incomes, 0), cdGiven: 0, totalInflow },
            result: { netFlow: totalInflow - totalOutflow, stockDelta: 0 },
            urgentEMIs: loans?.filter(l => l.nextEmiDueDate && subDays(new Date(l.nextEmiDueDate), 2) <= new Date() && new Date(l.nextEmiDueDate) >= new Date()) || [],
            audit360: (() => {
                const dayGroups = new Map<string, Map<string, {
                    debits: { payee: string, amount: number, description?: string }[],
                    credits: { payee: string, amount: number, description?: string }[]
                }>>();

                const filteredIncomes = globalData.incomes.filter(i => periodScope(i.date) && !i.isInternal);
                const filteredExpenses = globalData.expenses.filter(e => periodScope(e.date) && !e.isInternal);

                [...filteredIncomes, ...filteredExpenses].forEach(t => {
                    const dStr = format(startOfDay(new Date(t.date)), 'yyyy-MM-dd');
                    if (!dayGroups.has(dStr)) dayGroups.set(dStr, new Map());
                    const subGroup = dayGroups.get(dStr)!;

                    const subCat = (t.subCategory || t.category || 'Other').toUpperCase().trim();
                    if (!subGroup.has(subCat)) {
                        subGroup.set(subCat, { debits: [], credits: [] });
                    }
                    const g = subGroup.get(subCat)!;
                    const isIncome = 'transactionType' in t ? t.transactionType === 'Income' : (filteredIncomes.includes(t as any));
                    
                    if (isIncome) {
                        g.credits.push({ payee: t.payee, amount: Number(t.amount) || 0, description: t.description });
                    } else {
                        g.debits.push({ payee: t.payee, amount: Number(t.amount) || 0, description: t.description });
                    }
                });

                const rows: { date: string, particular: string, detail: string, debit: number, credit: number }[] = [];

                dayGroups.forEach((subGroup, dStr) => {
                    subGroup.forEach((data, subCat) => {
                        // Handle Credits (Incomes)
                        if (data.credits.length > 0) {
                            const uniquePayees = Array.from(new Set(data.credits.map(c => c.payee)));
                            const totalCredit = data.credits.reduce((s, c) => s + c.amount, 0);
                            const mergedDetail = data.credits.map(c => c.description).filter(Boolean).join(', ') || '-';
                            if (uniquePayees.length > 1) {
                                rows.push({ date: dStr, particular: subCat.toUpperCase(), detail: mergedDetail, debit: 0, credit: totalCredit });
                            } else {
                                const pName = uniquePayees[0] || subCat;
                                rows.push({ date: dStr, particular: `${pName} (${subCat})`, detail: mergedDetail, debit: 0, credit: totalCredit });
                            }
                        }
                        // Handle Debits (Expenses)
                        if (data.debits.length > 0) {
                            const uniquePayees = Array.from(new Set(data.debits.map(d => d.payee)));
                            const totalDebit = data.debits.reduce((s, d) => s + d.amount, 0);
                            const mergedDetail = data.debits.map(d => d.description).filter(Boolean).join(', ') || '-';
                            if (uniquePayees.length > 1) {
                                rows.push({ date: dStr, particular: subCat.toUpperCase(), detail: mergedDetail, debit: totalDebit, credit: 0 });
                            } else {
                                const pName = uniquePayees[0] || subCat;
                                rows.push({ date: dStr, particular: `${pName} (${subCat})`, detail: mergedDetail, debit: totalDebit, credit: 0 });
                            }
                        }
                    });
                });

                return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            })()
        };
    }, [startDate, endDate, globalData, loans]);

    const handleExcelExport = () => {
        if (!reportData) return;
        const workbook = XLSX.utils.book_new();
        
        // Distribution Sheet
        const distData = [
            ["Item", "Amount"],
            ["Supplier Cash", reportData.distribution.supplierCash],
            ["Supplier RTGS", reportData.distribution.supplierRtgs],
            ["Gov Dist.", reportData.distribution.govDist],
            ["Total Payments", reportData.distribution.totalPayments],
            ["Expenses", reportData.distribution.expenses],
            ["Incomes", reportData.distribution.incomes],
            ["S/E Cash", reportData.distribution.seCash],
            ["Net Total Balance", reportData.distribution.netTotalBalance]
        ];
        const distWs = XLSX.utils.aoa_to_sheet(distData);
        XLSX.utils.book_append_sheet(workbook, distWs, "Per-Day Distribution");

        // Stock Sheet
        const stockData = [
            ["Variety", "Current Stock (QTL)"],
            ...reportData.varietyStock.map(v => [v.variety, v.qty])
        ];
        const stockWs = XLSX.utils.aoa_to_sheet(stockData);
        XLSX.utils.book_append_sheet(workbook, stockWs, "Stock Availability");

        // Day-Wise Distribution Sheet
        const dayWiseData = [
            ["Date", "Supplier Cash", "Supplier RTGS", "Gov Dist", "Total Payments", "Expenses", "Incomes", "S/E Cash", "Net Total"],
            ...reportData.dayWise.map(d => [d.date, d.supplierCash, d.supplierRtgs, d.govDist, d.totalPayments, d.expenses, d.incomes, d.seCash, d.netTotal])
        ];
        const dayWiseWs = XLSX.utils.aoa_to_sheet(dayWiseData);
        XLSX.utils.book_append_sheet(workbook, dayWiseWs, "Day-Wise Distribution");

        // Consolidated Ledger Sheet
        let runningBal = 0;
        const ledgerData = [
            ["Date", "Type", "Particulars", "Ref ID", "Debit (Out)", "Credit (In)", "Running Balance"],
            ...reportData.consolidatedLedger.map(t => {
                runningBal += (t.credit - t.debit);
                return [format(new Date(t.date), 'dd-MMM-yyyy'), t.type, t.particulars, t.id, t.debit || 0, t.credit || 0, runningBal];
            })
        ];
        const ledgerWs = XLSX.utils.aoa_to_sheet(ledgerData);
        XLSX.utils.book_append_sheet(workbook, ledgerWs, "Consolidated Ledger");

        // 360 Audit Ledger Sheet
        const audit360Data = [
            ["Date", "Particular", "Detail", "Debit", "Credit"],
            ...reportData.audit360.map(r => [format(new Date(r.date), 'dd/MM/yyyy'), r.particular, r.detail, r.debit || 0, r.credit || 0]),
            ["TOTAL", "", "", reportData.audit360.reduce((s, r) => s + r.debit, 0), reportData.audit360.reduce((s, r) => s + r.credit, 0)]
        ];
        const audit360Ws = XLSX.utils.aoa_to_sheet(audit360Data);
        XLSX.utils.book_append_sheet(workbook, audit360Ws, "360_Audit_Ledger");

        const dateRangeStr = isSameDay(startDate, endDate) 
            ? format(startDate, 'dd_MMM_yyyy') 
            : `${format(startDate, 'dd_MMM')}_to_${format(endDate, 'dd_MMM_yyyy')}`;
            
        XLSX.writeFile(workbook, `Business_Report_360_${dateRangeStr}.xlsx`);
    };

    const handlePrint = async () => {
        if (!reportData) return;
        try {

        const escapeHtml = (value?: string | null) => {
            if (!value) return "";
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        };

        const dateRangeText = isSameDay(startDate, endDate)
            ? format(startDate, 'dd MMM yyyy')
            : `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`;

        const companyName = globalData.receiptSettings?.companyName || 'Daily Business Report';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${escapeHtml(companyName)} - ${dateRangeText}</title>
                <style>
                    body { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 0; padding: 25px; line-height: 1.4; background: #fff; }
                    .header { text-align: center; border-bottom: 3px solid #a78bca; padding-bottom: 15px; margin-bottom: 25px; }
                    .header h1 { margin: 0; color: #5c3e7b; font-size: 28px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.5px; }
                    .header p { margin: 8px 0 0 0; color: #64748b; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
                    
                    .section { margin-bottom: 30px; page-break-inside: avoid; }
                    .section-title { font-size: 13px; font-weight: 900; color: #ffffff; background: #a78bca; padding: 9px 14px; margin-bottom: 0px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px 4px 0 0; }
                    
                    .v-ledger-table { width: 100%; border-collapse: collapse; margin-top: 0px; margin-bottom: 15px; border: 1px solid #e2e8f0; table-layout: fixed; }
                    .v-ledger-table th { background: #f1f5f9; color: #1e293b; padding: 8px 6px; font-size: 9px; border: 1px solid #e2e8f0; text-transform: uppercase; font-weight: 900; letter-spacing: 0.3px; }
                    .v-ledger-table td { padding: 6px 5px; font-size: 9px; border: 1px solid #e2e8f0; text-align: center; color: #334155; }
                    .v-ledger-table tr:nth-child(even) { background: #ffffff; }
                    
                    .v-header-label { background: #a78bca; color: white; padding: 10px 15px; font-weight: 900; font-size: 12px; display: flex; justify-content: space-between; border: 1px solid #a78bca; border-bottom: none; margin-top: 20px; border-radius: 4px 4px 0 0; }
                    
                    .row-main { font-weight: 800; color: #0f172a; font-size: 10px; }
                    .row-sub { font-size: 8px; color: #64748b; font-weight: 600; }
                    .val-label { color: #2563eb; font-weight: 800; }
                    .cut-label { color: #dc2626; font-weight: 800; }
                    
                    .total-row { background: #a78bca !important; color: white !important; font-weight: 900 !important; }
                    .total-row td { border-color: #b89fd4; color: white !important; font-weight: 900; }
                    .total-row .row-sub { color: #e9d5ff !important; }

                    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
                    .result-box { border: 2px solid #a78bca; padding: 20px; border-radius: 12px; display: flex; justify-content: space-around; margin-top: 25px; background: #f8fafc; }
                    .result-item { text-align: center; }
                    .result-item label { display: block; font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
                    .result-item span { font-size: 20px; font-weight: 900; color: #5c3e7b; }
                    .positive { color: #059669 !important; }
                    .negative { color: #dc2626 !important; }
                    
                    @media print {
                        body { padding: 0px; }
                        .section-title { background: #a78bca !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .v-ledger-table th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .total-row { background: #a78bca !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .v-header-label { background: #a78bca !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${escapeHtml(toTitleCase(companyName))}</h1>
                    <p>AUDITED PROCUREMENT & SALES OPERATIONS | ${dateRangeText}</p>
                </div>

                <div class="section">
                    <div class="section-title">SECTION A: DAILY LIQUIDITY & BANK ASSETS AUDIT LEDGER</div>
                    <table class="v-ledger-table" style="margin-bottom: 10px;">
                        <thead>
                            <tr>
                                <th style="width: 50px;">DATE</th>
                                <th>CASH HAND</th>
                                <th>CASH HOME</th>
                                ${globalData.bankAccounts.map(acc => `
                                    <th>${escapeHtml(acc.bankName)}<br><small>${acc.accountNumber.slice(-4)}</small></th>
                                `).join('')}
                                <th style="background: #a78bca; color: white;">NET POS.</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.dayWiseLiquidity.map((d: any) => `
                                <tr>
                                    <td style="font-weight: 900;">${d.date}</td>
                                    ${['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map((id: string) => {
                                        const m = d.metrics[id];
                                        return `
                                            <td style="padding: 2px;">
                                                <div style="border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; background: #fff;">
                                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 4px; background: #fff; border-bottom: 1px solid #f1f5f9;">
                                                        <span style="font-size: 7.5px; font-weight: 900; color: #94a3b8; text-transform: uppercase;">Opening</span>
                                                        <span style="font-size: 9px; font-weight: 800; color: #334155;">${Math.round(m.opening).toLocaleString('en-IN')}</span>
                                                    </div>
                                                    
                                                    <div style="display: flex; border-bottom: 1px solid #f1f5f9; background: #ffffff;">
                                                        <div style="flex: 1; text-align: center; padding: 3px 1px; border-right: 1px solid #f1f5f9;">
                                                            <span style="font-size: 9px; font-weight: 900; color: #059669;">${m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : '-'}</span>
                                                        </div>
                                                        <div style="flex: 1; text-align: center; padding: 3px 1px;">
                                                            <span style="font-size: 9px; font-weight: 900; color: #dc2626;">${m.expense > 0 ? '-' + Math.round(m.expense).toLocaleString('en-IN') : '-'}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 4px; background: #fff; border-top: 1px solid #f1f5f9;">
                                                        <span style="font-size: 7.5px; font-weight: 900; color: #94a3b8; text-transform: uppercase;">Closing</span>
                                                        <span style="font-size: 10px; font-weight: 900; color: #5c3e7b;">${Math.round(m.closing).toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        `;
                                    }).join('')}
                                    <td style="padding: 3px; text-align: center; vertical-align: middle;">
                                        <div style="background: #a78bca; border-radius: 4px; padding: 6px 4px; height: 100%; display: flex; flex-direction: column; justify-content: center; min-height: 28px;">
                                            <span style="font-size: 7px; color: #e9d5ff; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Net Pos.</span>
                                            <span style="font-size: 11.5px; font-weight: 900; color: white;">${Math.round(d.totalClosing).toLocaleString('en-IN')}</span>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="text-align: right; font-weight: 900; font-size: 14px; color: #5c3e7b; margin-top: 5px;">
                        REPORT PERIOD CLOSING LIQUIDITY: ${formatCurrency(reportData.liquid.total)}
                    </div>
                </div>

                <!-- Section B: Variety-Wise Audited Purchase Ledgers -->
                ${(() => {
                    const varietyGroups: Record<string, any[]> = {};
                    const filtered = globalData.suppliers.filter(s => {
                        const ed = startOfDay(new Date(s.date));
                        return ed >= startOfDay(startDate) && ed <= startOfDay(endDate);
                    });

                    filtered.forEach(s => {
                        const v = s.variety?.trim() || 'OTHERS';
                        if (!varietyGroups[v]) varietyGroups[v] = [];
                        varietyGroups[v].push(s);
                    });

                    return Object.entries(varietyGroups).map(([vName, entries]) => {
                        const dayBuckets: Record<string, any[]> = {};
                        (entries as any[]).forEach(e => {
                            const dStr = format(new Date(e.date), 'yyyy-MM-dd');
                            if (!dayBuckets[dStr]) dayBuckets[dStr] = [];
                            dayBuckets[dStr].push(e);
                        });

                        const rows = Object.entries(dayBuckets).map(([dDate, ents]) => {
                            const m = (ents as any[]).reduce((acc: any, s: any) => ({
                                parchi: acc.parchi + 1,
                                gross: acc.gross + (Number(s.grossWeight) || 0),
                                tier: acc.tier + (Number(s.teirWeight) || 0),
                                baseWt: acc.baseWt + (Number(s.weight) || 0),
                                kartaWt: acc.kartaWt + (Number(s.kartaWeight) || 0),
                                finalWt: acc.finalWt + (Number(s.netWeight) || 0),
                                totalAmt: acc.totalAmt + (Number(s.amount) || 0),
                                kartaAmt: acc.kartaAmt + (Number(s.kartaAmount) || 0),
                                labAmt: acc.labAmt + (Number(s.labouryAmount) || 0),
                                kanAmt: acc.kanAmt + (Number(s.kanta) || 0),
                                original: acc.original + (Number(s.originalNetAmount) || 0),
                                balance: acc.balance + (Number(s.netAmount) || 0),
                                paid: acc.paid + (Number(s.originalNetAmount || 0) - Number(s.netAmount || 0)),
                                sumRate: acc.sumRate + (Number(s.rate) || 0),
                                sumKartaPct: acc.sumKartaPct + (Number(s.kartaPercentage) || 0)
                            }), { parchi:0, gross:0, tier:0, baseWt:0, kartaWt:0, finalWt:0, totalAmt:0, kartaAmt:0, labAmt:0, kanAmt:0, original:0, balance:0, paid:0, sumRate:0, sumKartaPct:0 });
                            
                            return { date: format(new Date(dDate), 'dd MMM yyyy'), ...m, avgRate: m.totalAmt / m.baseWt || 0, avgKartaPct: m.sumKartaPct / (ents as any[]).length };
                        });

                        const vTotal = rows.reduce((a: any, b: any) => ({
                             parchi: a.parchi + b.parchi, gross: a.gross + b.gross, tier: a.tier + b.tier,
                             baseWt: a.baseWt + b.baseWt, kartaWt: a.kartaWt + b.kartaWt, finalWt: a.finalWt + b.finalWt,
                             totalAmt: a.totalAmt + b.totalAmt, kartaAmt: a.kartaAmt + b.kartaAmt,
                             labAmt: a.labAmt + b.labAmt, kanAmt: a.kanAmt + b.kanAmt,
                             original: a.original + b.original, paid: a.paid + b.paid, balance: a.balance + b.balance
                        }), { parchi:0, gross:0, tier:0, baseWt:0, kartaWt:0, finalWt:0, totalAmt:0, kartaAmt:0, labAmt:0, kanAmt:0, original:0, paid:0, balance:0 });

                        return `
                        <div style="page-break-inside: avoid;">
                            <div class="v-header-label">
                                <span>VARIETY: ${vName.toUpperCase()} PROCUREMENT</span>
                                <span>TOTAL QNTL: ${vTotal.finalWt.toFixed(2)}</span>
                            </div>
                            <table class="v-ledger-table">
                                <thead>
                                    <tr>
                                        <th style="width: 12%;">Timeline</th>
                                        <th style="width: 10%;">Gross/Tier</th>
                                        <th style="width: 12%;">Audit Cut</th>
                                        <th style="width: 10%;">Net Wt</th>
                                        <th style="width: 14%;">Rate/Value</th>
                                        <th style="width: 14%;">Krt/Lab/Kan</th>
                                        <th style="width: 14%;">Liab/Paid</th>
                                        <th style="width: 14%; background: #f1f5f9; color: #1e293b;">Payable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows.map(r => `
                                        <tr>
                                            <td><div class="row-main">${r.date}</div><div class="row-sub">Parchi: ${r.parchi}</div></td>
                                            <td><div class="row-main">${r.gross.toFixed(1)}</div><div class="row-sub">${r.tier.toFixed(1)}</div></td>
                                            <td><div class="row-main">${r.baseWt.toFixed(1)}</div><div class="row-sub cut-label">-${r.kartaWt.toFixed(1)}</div></td>
                                            <td><div class="row-main" style="font-size: 11px;">${r.finalWt.toFixed(2)}</div></td>
                                            <td><div class="val-label">₹${Math.round(r.finalWt > 0 ? (r.totalAmt - r.labAmt - r.kanAmt) / r.finalWt : 0)}/QTL</div><div class="row-sub">₹${Math.round(r.totalAmt - r.labAmt - r.kanAmt).toLocaleString()}</div></td>
                                            <td><div class="row-main">${r.avgKartaPct.toFixed(1)}% / ₹${Math.round(r.kartaAmt)}</div><div class="row-sub">L:${Math.round(r.labAmt)} | K:${Math.round(r.kanAmt)}</div></td>
                                            <td><div class="row-main">₹${Math.round(r.original).toLocaleString()}</div><div class="row-sub">PD:₹${Math.round(r.paid).toLocaleString()}</div></td>
                                            <td style="font-weight: 900; background: #f8fafc;">₹${Math.round(r.balance).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                    <tr class="total-row">
                                        <td>TOTAL: ${vTotal.parchi}</td>
                                        <td>${vTotal.gross.toFixed(1)} / ${vTotal.tier.toFixed(1)}</td>
                                        <td>${vTotal.baseWt.toFixed(1)} / -${vTotal.kartaWt.toFixed(1)}</td>
                                        <td style="color: #d8b4fe; font-size: 11px;">${vTotal.finalWt.toFixed(2)}</td>
                                        <td>₹${Math.round(vTotal.finalWt > 0 ? (vTotal.totalAmt - vTotal.labAmt - vTotal.kanAmt) / vTotal.finalWt : 0)}/QTL  ₹${Math.round(vTotal.totalAmt - vTotal.labAmt - vTotal.kanAmt).toLocaleString()}</td>
                                        <td>₹${Math.round(vTotal.kartaAmt).toLocaleString()} | ${Math.round(vTotal.labAmt)}/${Math.round(vTotal.kanAmt)}</td>
                                        <td>₹${Math.round(vTotal.original).toLocaleString()} / ₹${Math.round(vTotal.paid).toLocaleString()}</td>
                                        <td style="background: #a78bca; color: white; font-weight: 900;">₹${Math.round(vTotal.balance).toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>`;
                    }).join('');
                })()}

                <div class="section">
                    <div class="section-title">Section C: Daily Financial Distribution Ledger</div>
                    <table class="v-ledger-table">
                        <thead>
                            <tr>
                                <th style="width: 12%;">Date</th>
                                <th style="text-align: right;">Sup Cash</th>
                                <th style="text-align: right;">Sup RTGS</th>
                                <th style="text-align: right;">Gov Dist</th>
                                <th style="text-align: right;">Tot Pay</th>
                                <th style="text-align: right;">Expenses</th>
                                <th style="text-align: right;">Income</th>
                                <th style="text-align: right;">S/E Cash</th>
                                <th style="text-align: right; background: #f1f5f9; color: #1e293b;">Net Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.dayWise.map(d => `
                                <tr>
                                    <td class="font-bold">${d.date}</td>
                                    <td style="text-align: right;">${d.supplierCash > 0 ? d.supplierCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right;">${d.supplierRtgs > 0 ? d.supplierRtgs.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right;">${d.govDist > 0 ? d.govDist.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right; font-weight: bold;">${d.totalPayments > 0 ? d.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right; color: #dc2626; font-weight: bold;">${d.expenses > 0 ? d.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right; color: #059669; font-weight: bold;">${d.incomes > 0 ? d.incomes.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right; color: #7c3aed; font-weight: bold;">${d.seCash > 0 ? d.seCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}</td>
                                    <td style="text-align: right; font-weight: 900; background: #f8fafc;">${d.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="1">OVERALL TOTAL</td>
                                <td style="text-align: right;">${reportData.distribution.supplierCash.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.supplierRtgs.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.govDist.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.expenses.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.incomes.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right;">${reportData.distribution.seCash.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                                <td style="text-align: right; background: #a78bca; color: white; font-weight: 900;">${reportData.distribution.netTotalBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                    <div class="section">
                        <div class="section-title">Section D: Current Variety Stock</div>
                    <table class="v-ledger-table" style="table-layout: auto;">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Variety Name</th>
                                <th style="text-align: right;">Available Stock (QTL)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.varietyStock.map(v => `
                                <tr style="border-bottom: 1px solid #e8e4f4;">
                                    <td style="text-align: left; font-weight: 700; color: #1e293b;">${v.variety}</td>
                                    <td style="text-align: right; font-weight: 800; color: ${v.qty < 0 ? '#dc2626' : '#1e293b'};">${v.qty.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <div class="section-title">Section E: 360 Consolidated Audit Ledger (Incomes & Expenses)</div>
                    <table class="v-ledger-table">
                        <thead>
                            <tr>
                                <th style="width: 10%;">DATE</th>
                                <th style="text-align: left; padding-left: 10px; width: 30%;">PARTICULAR</th>
                                <th style="text-align: left; padding-left: 10px;">DETAILS / DESCRIPTION</th>
                                <th style="text-align: right; padding-right: 15px; width: 100px;">DEBIT</th>
                                <th style="text-align: right; padding-right: 15px; width: 100px;">CREDIT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.audit360.length === 0 ? `
                                <tr>
                                    <td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No audit entries found.</td>
                                </tr>
                            ` : `
                                ${reportData.audit360.map(r => `
                                    <tr>
                                        <td style="font-weight: 700;">${format(new Date(r.date), 'dd/MM/yy')}</td>
                                        <td style="text-align: left; padding-left: 10px; font-weight: 700; color: #1e293b; text-transform: uppercase;">${escapeHtml(r.particular)}</td>
                                        <td style="text-align: left; padding-left: 10px; color: #64748b; font-size: 8px;">${escapeHtml(r.detail)}</td>
                                        <td style="text-align: right; padding-right: 15px; font-weight: 800; color: #dc2626;">${r.debit > 0 ? r.debit.toLocaleString('en-IN') : '-'}</td>
                                        <td style="text-align: right; padding-right: 15px; font-weight: 800; color: #059669;">${r.credit > 0 ? r.credit.toLocaleString('en-IN') : '-'}</td>
                                    </tr>
                                `).join('')}
                                <tr class="total-row">
                                    <td colspan="3" style="text-align: left; padding-left: 15px;">OVERALL AUDIT TOTAL</td>
                                    <td style="text-align: right; padding-right: 15px;">${reportData.audit360.reduce((s, r) => s + r.debit, 0).toLocaleString('en-IN')}</td>
                                    <td style="text-align: right; padding-right: 15px;">${reportData.audit360.reduce((s, r) => s + r.credit, 0).toLocaleString('en-IN')}</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

                <div class="section">
                    <div class="section-title">Section F: Audited Sales Recap</div>
                    <table class="v-ledger-table" style="table-layout: auto;">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Variety Name</th>
                                <th style="text-align: right;">Qty Sold (QTL)</th>
                                <th style="text-align: right;">Value (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.sales.map(v => `
                                <tr style="border-bottom: 1px solid #e8e4f4;">
                                    <td style="text-align: left; font-weight: 600;">${v.variety}</td>
                                    <td style="text-align: right;">${v.totalQty.toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: 700;">${formatCurrency(v.totalValue)}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td style="text-align: left;">TOTAL SALES SUMMARY</td>
                                <td style="text-align: right;">${reportData.sales.reduce((s, v) => s + v.totalQty, 0).toFixed(2)}</td>
                                <td style="text-align: right;">${formatCurrency(reportData.sales.reduce((s, v) => s + v.totalValue, 0))}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <div class="section-title">Section G: Net Business Result</div>
                    <div class="result-box">
                        <div class="result-item">
                            <label>DAILY NET FLOW</label>
                            <span class="${reportData.result.netFlow >= 0 ? 'positive' : 'negative'}">
                                ${formatCurrency(reportData.result.netFlow)}
                            </span>
                        </div>
                        <div class="result-item">
                            <label>STOCK DELTA (In vs Out)</label>
                            <span class="${reportData.result.stockDelta >= 0 ? 'positive' : 'negative'}">
                                ${reportData.result.stockDelta.toFixed(2)} QTL
                            </span>
                        </div>
                    </div>
                </div>

                <div class="section" style="page-break-before: always;">
                    <div class="section-title">Section H: Consolidated Transaction Trail</div>
                    <table class="v-ledger-table" style="table-layout: auto;">
                        <thead>
                            <tr>
                                <th style="text-align: left; width: 8%;">Date</th>
                                <th style="text-align: left; width: 10%;">Type</th>
                                <th style="text-align: left; width: 38%;">Particulars</th>
                                <th style="text-align: left; width: 10%;">Ref ID</th>
                                <th style="text-align: right; width: 12%;">Debit (−)</th>
                                <th style="text-align: right; width: 12%;">Credit (+)</th>
                                <th style="text-align: right; width: 10%; background: #a78bca; color: white;">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                let runningBal = 0;
                                return reportData.consolidatedLedger.map((t: any) => {
                                    runningBal += (t.credit - t.debit);
                                    const typeColors: Record<string, {bg: string, color: string}> = {
                                        'Purchase':         { bg: '#fee2e2', color: '#dc2626' },
                                        'Labour':           { bg: '#dcfce7', color: '#16a34a' },
                                        'Kanta':            { bg: '#dcfce7', color: '#16a34a' },
                                        'Expense':          { bg: '#fee2e2', color: '#dc2626' },
                                        'Supplier Payment': { bg: '#fce7f3', color: '#be185d' },
                                        'Transfer Out':     { bg: '#ffedd5', color: '#c2410c' },
                                        'Transfer In':      { bg: '#ccfbf1', color: '#0f766e' },
                                        'Loan':             { bg: '#e0e7ff', color: '#4338ca' },
                                        'Sale':             { bg: '#dcfce7', color: '#16a34a' },
                                        'Customer Receipt': { bg: '#dcfce7', color: '#16a34a' },
                                        'Income':           { bg: '#d1fae5', color: '#065f46' },
                                        'P ADJUSTMENT':     { bg: '#e0f2fe', color: '#0369a1' },
                                        'Liquid':           { bg: '#f3f4f6', color: '#374151' },
                                    };
                                    const tc = typeColors[t.type] || { bg: '#f1f5f9', color: '#64748b' };
                                    const debitAmt = t.debit;
                                    const creditAmt = t.credit;
                                    return `
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="text-align: left; font-weight: 700; white-space: nowrap;">${format(new Date(t.date), 'dd MMM')}</td>
                                            <td style="text-align: left;">
                                                <span style="display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 7.5px; font-weight: 900; text-transform: uppercase; background: ${tc.bg}; color: ${tc.color};">
                                                    ${escapeHtml(t.type)}
                                                </span>
                                            </td>
                                            <td style="text-align: left; color: #334155;">${escapeHtml(t.particulars)}</td>
                                            <td style="text-align: left; font-family: monospace; color: #94a3b8; font-size: 8px;">${escapeHtml(t.id)}</td>
                                            <td style="text-align: right; color: #dc2626; font-weight: 700;">${debitAmt > 0 ? debitAmt.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '-'}</td>
                                            <td style="text-align: right; color: #16a34a; font-weight: 700;">${creditAmt > 0 ? creditAmt.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '-'}</td>
                                            <td style="text-align: right; font-weight: 900; color: ${runningBal >= 0 ? '#5c3e7b' : '#dc2626'};">${Math.round(runningBal).toLocaleString('en-IN')}</td>
                                        </tr>
                                    `;
                                }).join('');
                            })()}
                        </tbody>
                    </table>
                </div>

                <div style="font-size: 10px; color: #94a3b8; margin-top: 50px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                    BIZSUITE 360 AUDIT SYSTEM • SYSTEM GENERATED ON ${new Date().toLocaleString('en-IN')}
                </div>
            </body>
            </html>
        `;

            await printHtmlContent(html);
        } catch (err: any) {
            console.error("[Print Failed]:", err);
            alert("Report Printing Failed: " + (err?.message || String(err)));
        }
    };

    if (!reportData) return null;

    const chartConfig = {
        value: { label: "Amount" },
        cashHand: { label: "Cash Hand", color: "hsl(var(--chart-1))" },
        cashHome: { label: "Cash Home", color: "hsl(var(--chart-2))" },
    } satisfies ChartConfig;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-black text-[#5c3e7b] tracking-tight flex items-center gap-2">
                        <BarChart3 className="text-[#5c3e7b]" /> 360° Business Report
                    </h1>
                    <p className="text-xs text-[#5c3e7b] font-black uppercase tracking-widest px-1">Executive Command Center</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">From:</span>
                            <SmartDatePicker value={startDate} onChange={(d) => setStartDate(d as Date)} returnDate className="w-[160px] border-none bg-transparent h-8 text-sm font-bold" />
                        </div>
                        <div className="w-[1px] h-4 bg-slate-300" />
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">To:</span>
                            <SmartDatePicker value={endDate} onChange={(d) => setEndDate(d as Date)} returnDate className="w-[160px] border-none bg-transparent h-8 text-sm font-bold" />
                        </div>
                    </div>
                    
                    <Button onClick={handlePrint} size="sm" variant="outline" className="flex items-center gap-2 h-10 px-4 rounded-xl border-[#5c3e7b] bg-white hover:bg-purple-50 text-[#5c3e7b] font-black shadow-sm">
                        <Printer size={16} /> Print
                    </Button>
                    <Button onClick={handleExcelExport} size="sm" className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5c3e7b] hover:bg-[#4a3162] text-white font-black shadow-sm border-none">
                        <FileSpreadsheet size={16} /> Download Excel
                    </Button>
                </div>
            </div>

            {/* Section A: Liquidity Audit Ledger (Detailed Breakdown) */}
            <Card className="border-none shadow-md bg-white overflow-hidden p-0">
                <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                    <CardTitle className="text-xs font-black uppercase tracking-widest leading-none flex items-center gap-2">
                        <Wallet size={14} className="text-purple-200" /> Section A: Liquidity & Bank Assets Audit Ledger
                    </CardTitle>
                    <CardDescription className="text-[10px] text-purple-200 uppercase tracking-tighter mt-1 font-medium">
                        DAILY AUDIT: OPENING | IN(+) | OUT(-) | CLOSING
                    </CardDescription>
                </CardHeader>
                <div className="overflow-auto max-h-[500px]">
                    <Table className="border-collapse">
                        <TableHeader className="sticky top-0 z-20 shadow-md">
                            <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-3 border-r border-slate-200 min-w-[75px]">Date</TableHead>
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-2 border-r border-slate-200 min-w-[155px]">Cash in Hand</TableHead>
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-2 border-r border-slate-200 min-w-[155px]">Cash at Home</TableHead>
                                {globalData.bankAccounts.map(acc => (
                                    <TableHead key={acc.id} className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-2 border-r border-slate-200 min-w-[155px]">
                                        <div className="truncate w-full">{acc.bankName}</div>
                                        <div className="text-[9px] text-slate-400 font-medium tracking-tight">...{acc.accountNumber.slice(-4)}</div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-[11px] font-black h-11 text-white bg-[#5c3e7b] uppercase text-center px-2 min-w-[120px] border-l border-purple-200">Net Position</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.dayWiseLiquidity.map((d, i) => (
                                <TableRow key={i} className="hover:bg-white transition-colors border-b border-slate-100">
                                    <TableCell className="font-bold text-slate-700 py-2.5 text-[10px] whitespace-nowrap text-center border-r">{d.date}</TableCell>
                                    
                                    {/* Helper to render Audit Cell */}
                                    {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map(id => {
                                        const m = d.metrics[id] || { opening: 0, closing: 0, income: 0, expense: 0 };
                                        return (
                                            <TableCell key={id} className="py-1 px-1.5 align-middle border-r border-slate-200">
                                                <div className="flex flex-col rounded-sm overflow-hidden ring-1 ring-slate-200 bg-white">
                                                    {/* Top bar: Opening */}
                                                    <div className="flex justify-between items-center bg-white py-[3px] px-2 border-b border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opening</span>
                                                        <span className="text-[12px] font-black text-slate-700">{Math.round(m.opening).toLocaleString('en-IN')}</span>
                                                    </div>
                                                    
                                                    {/* Middle: Flow */}
                                                    <div className="grid grid-cols-2">
                                                        <div className="text-center py-1 bg-white border-r border-slate-100 flex flex-col justify-center items-center">
                                                            <span className="text-[12px] font-black text-emerald-600 tracking-tighter">{m.income > 0 ? `+${Math.round(m.income).toLocaleString('en-IN')}` : '-'}</span>
                                                        </div>
                                                        <div className="text-center py-1 bg-white flex flex-col justify-center items-center">
                                                            <span className="text-[12px] font-black text-red-600 tracking-tighter">{m.expense > 0 ? `-${Math.round(m.expense).toLocaleString('en-IN')}` : '-'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Bottom bar: Closing */}
                                                    <div className="flex justify-between items-center bg-white py-[3px] px-2 border-t border-slate-100">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Closing</span>
                                                        <span className="text-[12.5px] font-black text-[#5c3e7b]">{Math.round(m.closing).toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        );
                                    })}

                                    {/* Net Total Cell */}
                                    <TableCell className="align-middle px-1.5 py-1 border-l border-slate-200">
                                        <div className="flex flex-col rounded-sm overflow-hidden bg-[#5c3e7b] text-white shadow-sm h-full w-full mx-auto">
                                            <div className="py-2 px-2 text-center flex flex-col justify-center h-full min-h-[44px]">
                                                <span className="text-[9px] text-purple-200 font-black uppercase tracking-widest mb-[2px]">Net Position</span>
                                                <span className="text-[14px] font-black tracking-tight">{Math.round(d.totalClosing).toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="bg-[#5c3e7b] text-white p-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Final Consolidated Assets</span>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-purple-300 uppercase font-black">Opening Period Sum</span>
                            <span className="text-sm font-bold text-purple-100">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-8 w-[1px] bg-purple-400/30 mx-2" />
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-purple-200 uppercase font-black tracking-widest">Grand Total Value</span>
                            <span className="text-2xl font-black font-mono text-white">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                {/* Daily Financial Distribution Ledger (Detailed breakdown) */}
                <Card className="shadow-md border-none bg-white p-0 overflow-hidden">
                    <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                        <div className="flex justify-between items-center w-full">
                            <div>
                                <CardTitle className="text-xs font-black uppercase tracking-widest leading-none">Daily Financial Distribution Ledger</CardTitle>
                                <CardDescription className="text-[10px] mt-1 text-purple-200 uppercase tracking-tighter">Detailed performance breakdown per day</CardDescription>
                            </div>
                            <div className="text-[10px] bg-white/20 px-2 py-1 rounded font-bold uppercase">{isSameDay(startDate, endDate) ? 'Single Day View' : 'Multi-Day View'}</div>
                        </div>
                    </CardHeader>
                    <div className="overflow-auto max-h-[400px]">
                        <Table>
                            <TableHeader className="sticky top-0 z-20 shadow-md">
                                <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-3 border-r border-slate-200 min-w-[75px]">Date</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier Cash</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier RTGS</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Gov Dist.</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200 bg-slate-200/50">Total Payments</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-red-700 uppercase text-right px-3 border-r border-slate-200">Expenses</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-emerald-700 uppercase text-right px-3 border-r border-slate-200">Income</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-purple-700 uppercase text-right px-3 border-r border-slate-200">S/E Cash</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-white bg-[#5c3e7b] uppercase text-right px-4">Net Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.dayWise.map((d, i) => (
                                    <TableRow key={i} className="hover:bg-white border-b border-slate-100 transition-colors">
                                        <TableCell className="font-bold text-slate-700 py-3 text-[11px] whitespace-nowrap text-center border-r border-slate-100">{d.date}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-100">{d.supplierCash > 0 ? d.supplierCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-100">{d.supplierRtgs > 0 ? d.supplierRtgs.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono text-slate-600 border-r border-slate-100">{d.govDist > 0 ? d.govDist.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-slate-900 border-r border-slate-100">{d.totalPayments > 0 ? d.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-red-600 border-r border-slate-100">{d.expenses > 0 ? d.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-emerald-600 border-r border-slate-100">{d.incomes > 0 ? d.incomes.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-purple-700 border-r border-slate-100">{d.seCash > 0 ? d.seCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[12px] font-mono font-black text-slate-900">{d.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                ))}
                                    <TableRow className="bg-[#5c3e7b] text-white hover:bg-purple-800 font-bold border-t-2 border-white/20">
                                        <TableCell className="font-black uppercase py-4 text-center text-[11px] px-3">Total Period Distribution</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.supplierCash).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.supplierRtgs).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] px-3">{formatCurrency(reportData.distribution.govDist).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono font-black text-[12px] border-x border-white/10 px-3">{formatCurrency(reportData.distribution.totalPayments).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] text-red-200 px-3">{formatCurrency(reportData.distribution.expenses).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] text-emerald-200 px-3">{formatCurrency(reportData.distribution.incomes).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono text-[11px] text-purple-200 px-3">{formatCurrency(reportData.distribution.seCash).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-mono font-black text-[13px] bg-purple-900 border-l border-white/20 px-4">{formatCurrency(reportData.distribution.netTotalBalance)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                    </div>
                </Card>

                {/* Stock Availability Table */}
                <Card className="lg:col-span-3 shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                        <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                             <Warehouse size={14} /> Current Stock Availability
                        </CardTitle>
                        <CardDescription className="text-[10px] text-purple-200">Real-time balance based on total history (Purchased - Sold)</CardDescription>
                    </CardHeader>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-100 border-b-2 border-slate-300">
                                <TableHead className="py-3 px-4 text-[11px] text-slate-800 font-black uppercase">Variety Name</TableHead>
                                <TableHead className="py-3 px-4 text-right text-[11px] text-slate-800 font-black uppercase">Stock Quantity (QTL)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.varietyStock.length === 0 ? (
                                <TableRow><TableCell colSpan={2} className="h-40 text-center text-slate-400 text-xs italic">No stock data available.</TableCell></TableRow>
                            ) : (
                                reportData.varietyStock.map((v, i) => (
                                    <TableRow key={i} className="hover:bg-white group border-b border-slate-100">
                                        <TableCell className="font-bold text-slate-900 py-3 px-4 uppercase text-[11px]">{v.variety}</TableCell>
                                        <TableCell className={`text-right py-3 px-4 font-mono font-bold text-[11px] ${v.qty < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                                            {v.qty.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            </div>

            {/* Consolidated Business Ledger (Transaction Trail) */}
            <Card className="shadow-sm border-none bg-white p-0 overflow-hidden">
                <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                    <CardTitle className="text-xs font-black uppercase tracking-widest leading-none flex items-center gap-2">
                        <FileText size={14} className="text-purple-200" /> Consolidated Transaction Trail
                    </CardTitle>
                    <CardDescription className="text-[10px] mt-1 text-purple-200 uppercase tracking-tighter font-medium">Chronological Business Ledger for the selected period</CardDescription>
                </CardHeader>
                <div className="overflow-auto max-h-[500px]">
                    <Table>
                        <TableHeader className="sticky top-0 z-20 shadow-md">
                            <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200 min-w-[80px]">Date</TableHead>
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200">Particulars</TableHead>
                                <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase px-4 border-r border-slate-200 min-w-[100px]">Ref ID</TableHead>
                                <TableHead className="text-right text-[11px] font-black h-11 text-red-700 uppercase px-4 border-r border-slate-200 min-w-[120px]">Debit (-)</TableHead>
                                <TableHead className="text-right text-[11px] font-black h-11 text-emerald-700 uppercase px-4 border-r border-slate-200 min-w-[120px]">Credit (+)</TableHead>
                                <TableHead className="text-right text-[11px] font-black h-11 text-white uppercase px-4 bg-[#5c3e7b] min-w-[130px]">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(() => {
                                let runningBalance = 0;
                                return reportData.consolidatedLedger.map((t, i) => {
                                    runningBalance = runningBalance + (t.credit - t.debit);
                                    return (
                                        <TableRow key={i} className="hover:bg-white border-b border-slate-100">
                                            <TableCell className="font-bold text-slate-900 py-3 text-[11px] whitespace-nowrap px-4">{format(new Date(t.date), 'dd MMM')}</TableCell>
                                            <TableCell className="py-3 text-[11px] font-medium text-slate-700 px-4">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase mr-2 ${
                                                        t.type === 'Purchase'         ? 'bg-red-50 text-red-600' :
                                                        t.type === 'Labour'           ? 'bg-orange-50 text-orange-700' :
                                                        t.type === 'Kanta'            ? 'bg-yellow-50 text-yellow-700' :
                                                        t.type === 'Expense'          ? 'bg-red-50 text-red-600' :
                                                        t.type === 'Supplier Payment' ? 'bg-pink-50 text-pink-700' :
                                                        t.type === 'Transfer Out'     ? 'bg-orange-100 text-orange-800' :
                                                        t.type === 'Transfer In'      ? 'bg-teal-50 text-teal-700' :
                                                        t.type === 'Loan'             ? 'bg-indigo-50 text-indigo-700' :
                                                        t.type === 'P ADJUSTMENT'     ? 'bg-blue-50 text-blue-600' :
                                                        t.type === 'Liquid'           ? 'bg-slate-100 text-slate-600' :
                                                        'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                        {t.type}
                                                    </span>
                                                    {t.particulars}
                                            </TableCell>
                                            <TableCell className="py-3 text-[10px] font-mono text-slate-400 px-4">{t.id}</TableCell>
                                            <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-red-600 px-4">
                                                {(t.type === 'Transfer' ? (t.note || 0) : t.debit) > 0 ? formatCurrency(t.type === 'Transfer' ? (t.note || 0) : t.debit) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right py-3 text-[11px] font-mono font-bold text-emerald-600 px-4">
                                                {(t.type === 'Transfer' ? (t.note || 0) : t.credit) > 0 ? formatCurrency(t.type === 'Transfer' ? (t.note || 0) : t.credit) : '-'}
                                            </TableCell>
                                            <TableCell className={`text-right py-3 text-[12px] font-black font-mono px-4 ${runningBalance >= 0 ? 'text-[#5c3e7b]' : 'text-red-700'}`}>
                                                {formatCurrency(runningBalance)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                });
                            })()}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-8">
                {/* Section B: Variety-Wise Grouped Tables (Procurement Audit) */}
                {(() => {
                    const varietyGroups: Record<string, any[]> = {};
                    const filtered = globalData.suppliers.filter(s => {
                        const ed = startOfDay(new Date(s.date));
                        return ed >= startOfDay(startDate) && ed <= startOfDay(endDate);
                    });
                    
                    filtered.forEach(s => {
                        const v = (s.variety || 'OTHERS').trim().toUpperCase();
                        if (!varietyGroups[v]) varietyGroups[v] = [];
                        varietyGroups[v].push(s);
                    });

                    return Object.entries(varietyGroups).map(([vName, entries], idx) => {
                        const dayBuckets: Record<string, any[]> = {};
                        (entries as any[]).forEach(e => {
                            const dStr = format(new Date(e.date), 'yyyy-MM-dd');
                            if (!dayBuckets[dStr]) dayBuckets[dStr] = [];
                            dayBuckets[dStr].push(e);
                        });

                        const dayRows = Object.entries(dayBuckets).map(([dDate, ents]) => {
                            const m = (ents as any[]).reduce((acc: any, s: any) => ({
                                parchi: acc.parchi + 1,
                                gross: acc.gross + (Number(s.grossWeight) || 0),
                                tier: acc.tier + (Number(s.teirWeight) || 0),
                                baseWt: acc.baseWt + (Number(s.weight) || 0),
                                kartaWt: acc.kartaWt + (Number(s.kartaWeight) || 0),
                                finalWt: acc.finalWt + (Number(s.netWeight) || 0),
                                totalAmt: acc.totalAmt + (Number(s.amount) || 0),
                                kartaAmt: acc.kartaAmt + (Number(s.kartaAmount) || 0),
                                labAmt: acc.labAmt + (Number(s.labouryAmount) || 0),
                                kanAmt: acc.kanAmt + (Number(s.kanta) || 0),
                                original: acc.original + (Number(s.originalNetAmount) || 0),
                                balance: acc.balance + (Number(s.netAmount) || 0),
                                paid: acc.paid + (Number(s.originalNetAmount || 0) - Number(s.netAmount || 0)),
                                sumRate: acc.sumRate + (Number(s.rate) || 0),
                                sumKartaPct: acc.sumKartaPct + (Number(s.kartaPercentage) || 0)
                            }), { parchi:0, gross:0, tier:0, baseWt:0, kartaWt:0, finalWt:0, totalAmt:0, kartaAmt:0, labAmt:0, kanAmt:0, original:0, balance:0, paid:0, sumRate:0, sumKartaPct:0 });
                            
                            return { date: format(new Date(dDate), 'dd MMM yyyy'), dDate, ...m, avgRate: m.totalAmt / m.baseWt || 0, avgKartaPct: m.sumKartaPct / (ents as any[]).length };
                        }).sort((a, b) => new Date(b.dDate).getTime() - new Date(a.dDate).getTime());

                        const vTotal = dayRows.reduce((a: any, b: any) => ({
                             parchi: a.parchi + b.parchi, gross: a.gross + b.gross, tier: a.tier + b.tier,
                             baseWt: a.baseWt + b.baseWt, kartaWt: a.kartaWt + b.kartaWt, finalWt: a.finalWt + b.finalWt,
                             totalAmt: a.totalAmt + b.totalAmt, kartaAmt: a.kartaAmt + b.kartaAmt,
                             labAmt: a.labAmt + b.labAmt, kanAmt: a.kanAmt + b.kanAmt,
                             original: a.original + b.original, paid: a.paid + b.paid, balance: a.balance + b.balance
                        }), { parchi:0, gross:0, tier:0, baseWt:0, kartaWt:0, finalWt:0, totalAmt:0, kartaAmt:0, labAmt:0, kanAmt:0, original:0, paid:0, balance:0 });

                        return (
                            <Card key={idx} className="shadow-xl border-none bg-white overflow-hidden ring-1 ring-slate-200">
                                <CardHeader className="bg-[#5c3e7b] border-b py-4 text-white shadow-lg flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-purple-300 animate-pulse"></div>
                                        <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] leading-none">
                                            VARIETY: {vName} (Audit Procurement Feed)
                                        </CardTitle>
                                    </div>
                                    <div className="text-[10px] font-bold px-4 py-1.5 rounded-xl bg-white/10 uppercase tracking-widest border border-white/20 backdrop-blur-sm">
                                        Payload Volume: {vTotal.finalWt.toFixed(2)} QTL
                                    </div>
                                </CardHeader>
                                <div className="overflow-auto border-x bg-slate-50/10 scrollbar-thin scrollbar-thumb-slate-200">
                                    <Table className="relative w-full border-collapse">
                                        <TableHeader className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">DATE / PARCHI</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">GROSS / TIER</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">AUDIT (NET/KRTA)</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">FINAL WEIGHT</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-blue-900 text-center uppercase tracking-tighter">RATE / VALUE</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-orange-900 text-center uppercase tracking-tighter">EXPENSES (KRT/LB/KN)</TableHead>
                                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">LIAB / PAID</TableHead>
                                                <TableHead className="text-[11px] font-black h-12 text-center text-white bg-[#5c3e7b]">BALANCE DUE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-white text-[10px]">
                                            {dayRows.map((r, i) => (
                                                <TableRow key={i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 group">
                                                    <TableCell className="border-r border-slate-200 py-1.5 px-3 text-center bg-slate-50/50">
                                                        <div className="font-bold text-slate-700 uppercase leading-tight">{r.date}</div>
                                                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">PARCHI: {r.parchi}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-200 py-1.5 px-2">
                                                        <div className="text-slate-900 font-semibold">{r.gross.toFixed(2)}</div>
                                                        <div className="text-slate-400 text-[9px] mt-0.5">TIER: {r.tier.toFixed(2)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 py-1.5 px-2 bg-slate-50/20">
                                                        <div className="text-slate-600 font-medium">{r.baseWt.toFixed(2)}</div>
                                                        <div className="text-red-500 font-bold text-[9px] mt-0.5">CUT: -{r.kartaWt.toFixed(2)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 py-1.5 px-2">
                                                        <div className="text-slate-950 font-black text-xs">{r.finalWt.toFixed(2)}</div>
                                                        <div className="text-slate-400 text-[8px] uppercase tracking-tighter">NET PAYLOAD</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 py-1.5 px-2 font-mono">
                                                        <div className="text-blue-800 font-bold">{formatCurrency(r.avgRate)}</div>
                                                        <div className="text-blue-900 text-[9px] mt-0.5">{formatCurrency(r.totalAmt)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 py-1.5 px-2">
                                                        <div className="text-orange-600 font-bold">{r.avgKartaPct.toFixed(1)}% / {formatCurrency(r.kartaAmt)}</div>
                                                        <div className="text-slate-500 text-[9px] mt-0.5">L:{Math.round(r.labAmt)} | K:{Math.round(r.kanAmt)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 py-1.5 px-3 bg-blue-900/5">
                                                        <div className="text-slate-900 font-black">{formatCurrency(r.original)}</div>
                                                        <div className="text-emerald-700 font-bold text-[9px] mt-0.5">PAID: {formatCurrency(r.paid)}</div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-1.5 px-4 font-black text-white bg-[#5c3e7b] shadow-lg text-[13px] border-l border-purple-200">
                                                        {formatCurrency(r.balance)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="!bg-purple-900 text-white font-bold hover:!bg-purple-900 border-t-2 border-purple-800">
                                                <TableCell className="py-3 text-center border-b-0">
                                                    <div className="text-[9px] tracking-widest text-purple-200">CONSOLIDATED TOTAL</div>
                                                    <div className="text-[10px] text-white">{vTotal.parchi} PARCHI</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div>{vTotal.gross.toFixed(1)}</div>
                                                    <div className="text-[9px] text-purple-200">T: {vTotal.tier.toFixed(1)}</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div>{vTotal.baseWt.toFixed(1)}</div>
                                                    <div className="text-[9px] text-red-200">-{vTotal.kartaWt.toFixed(1)}</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div className="text-xs text-blue-200">{vTotal.finalWt.toFixed(2)}</div>
                                                    <div className="text-[8px] uppercase text-blue-200/50">TOTAL QNTL</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div className="font-black text-[10px]">₹{Math.round(vTotal.totalAmt / vTotal.baseWt || 0)}</div>
                                                    <div className="text-[9px] text-blue-200 font-bold">{formatCurrency(vTotal.totalAmt).replace('₹','')}</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div className="font-bold text-[10px]">{formatCurrency(vTotal.kartaAmt).replace('₹','')}</div>
                                                    <div className="text-[9px] text-orange-200 font-bold">L:{Math.round(vTotal.labAmt)} | K:{Math.round(vTotal.kanAmt)}</div>
                                                </TableCell>
                                                <TableCell className="text-center border-r border-white/10 border-b-0 text-white">
                                                    <div className="font-bold text-[10px]">{formatCurrency(vTotal.original).replace('₹','')}</div>
                                                    <div className="text-[9px] text-emerald-300 font-bold">{formatCurrency(vTotal.paid).replace('₹','')}</div>
                                                </TableCell>
                                                <TableCell className="text-right px-4 text-[14px] !bg-purple-950 text-white font-black border-l border-white/20 border-b-0">
                                                    {formatCurrency(vTotal.balance)}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        );
                    });
                })()}
                {/* Section D: Sales Summary Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <ReportTable 
                        title="Section D: Sales Summary (Aaj Ki Sales)" 
                        data={reportData.sales} 
                        headers={["Variety", "Qty Sold", "Avg Sale", "Value"]}
                        type="sales"
                    />
                </div>
            </div>

            {/* Inflow / Outflow Split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-red-100 shadow-sm">
                    <CardHeader className="bg-red-50/50 pb-2">
                        <CardTitle className="text-sm font-bold text-red-700 flex items-center gap-2">
                            <TrendingDown size={16} /> SECTION C: OUTFLOW BREAKDOWN
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <FlowItem label="Supplier Payments" amount={reportData.outflow.supplier} />
                        <FlowItem label="Business Expenses" amount={reportData.outflow.expenses} />
                        <FlowItem label="CD Received (Savings)" amount={reportData.outflow.cdReceived} secondary />
                        <div className="pt-2 border-t flex justify-between items-center font-bold text-lg text-red-600">
                             <span>TOTAL OUTFLOW</span>
                             <span>{formatCurrency(reportData.outflow.totalOutflow)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="bg-emerald-50/50 pb-2">
                        <CardTitle className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                            <TrendingUp size={16} /> SECTION D: INFLOW & INCOME
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <FlowItem label="Customer Receipts" amount={reportData.inflow.customer} />
                        <FlowItem label="Other Business Income" amount={reportData.inflow.other} />
                        <FlowItem label="CD Given (Adjustment)" amount={reportData.inflow.cdGiven} secondary />
                        <div className="pt-2 border-t flex justify-between items-center font-bold text-lg text-emerald-600">
                             <span>TOTAL INFLOW</span>
                             <span>{formatCurrency(reportData.inflow.totalInflow)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Section E: 360 Consolidated Audit Ledger */}
            <Card className="shadow-xl border-none bg-white overflow-hidden ring-1 ring-slate-200">
                <CardHeader className="bg-[#5c3e7b] border-b py-4 text-white shadow-lg flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-purple-300 animate-pulse"></div>
                        <CardTitle className="text-[12px] font-black uppercase tracking-[0.2em] leading-none">
                            Section E: 360 Consolidated Audit Ledger (Incomes & Expenses)
                        </CardTitle>
                    </div>
                    <div className="text-[10px] font-bold px-4 py-1.5 rounded-xl bg-white/10 uppercase tracking-widest border border-white/20 backdrop-blur-sm">
                        Calculated from Sub-Categories
                    </div>
                </CardHeader>
                <div className="overflow-auto border-x bg-slate-50/10 scrollbar-thin scrollbar-thumb-slate-200">
                    <Table className="relative w-full border-collapse">
                        <TableHeader className="bg-slate-100 border-b-2 border-slate-300 sticky top-0 z-10">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter w-24">DATE</TableHead>
                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter w-48">PARTICULAR (ACCOUNT / SUB)</TableHead>
                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-slate-800 text-center uppercase tracking-tighter">DETAILS / REMARKS</TableHead>
                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-red-900 text-center uppercase tracking-tighter w-32">DEBIT (OUT)</TableHead>
                                <TableHead className="text-[10px] font-black h-12 border-r border-slate-200 text-emerald-900 text-center uppercase tracking-tighter w-32">CREDIT (IN)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="bg-white text-[10px]">
                            {reportData.audit360.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-slate-400 text-sm italic">
                                        No Income or Expense entries found for this period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {reportData.audit360.map((r, i) => (
                                        <TableRow key={i} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100 group">
                                            <TableCell className="border-r border-slate-200 py-3 px-2 text-center font-bold text-slate-500 whitespace-nowrap">
                                                {format(new Date(r.date), 'dd MMM yy')}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-3 px-4 font-bold text-slate-700 uppercase">
                                                {r.particular}
                                            </TableCell>
                                            <TableCell className="border-r border-slate-200 py-3 px-4 text-slate-500 italic text-[9px]">
                                                {r.detail}
                                            </TableCell>
                                            <TableCell className="text-center border-r border-slate-200 py-3 px-4 font-black text-red-600 text-[11px]">
                                                {r.debit > 0 ? formatCurrency(r.debit) : '-'}
                                            </TableCell>
                                            <TableCell className="text-center border-r border-slate-200 py-3 px-4 font-black text-emerald-600 text-[11px]">
                                                {r.credit > 0 ? formatCurrency(r.credit) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="!bg-purple-900 text-white font-bold hover:!bg-purple-900 border-t-2 border-purple-800">
                                        <TableCell colSpan={3} className="py-3 px-4 text-left border-b-0">
                                            <div className="text-[10px] tracking-widest text-purple-200 uppercase">OVERALL AUDIT RECONCILIATION TOTAL</div>
                                        </TableCell>
                                        <TableCell className="text-center border-r border-white/10 border-b-0 text-white font-black text-[12px]">
                                            {formatCurrency(reportData.audit360.reduce((s, r) => s + r.debit, 0))}
                                        </TableCell>
                                        <TableCell className="text-center border-r border-white/10 border-b-0 text-white font-black text-[12px]">
                                            {formatCurrency(reportData.audit360.reduce((s, r) => s + r.credit, 0))}
                                        </TableCell>
                                    </TableRow>
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Section G: Net Result */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-900 text-white border-none shadow-xl">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Daily Net Cash Flow</p>
                            <h2 className={`text-3xl font-black mt-1 ${reportData.result.netFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {reportData.result.netFlow < 0 ? '-' : ''}{formatCurrency(Math.abs(reportData.result.netFlow))}
                            </h2>
                        </div>
                        <div className={`p-4 rounded-2xl ${reportData.result.netFlow >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                             {reportData.result.netFlow >= 0 ? <TrendingUp size={32} className="text-emerald-400" /> : <TrendingDown size={32} className="text-red-400" />}
                        </div>
                    </CardContent>
                </Card>

                 <Card className="bg-white border-2 border-slate-100 shadow-sm">
                    <CardContent className="pt-6 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Stock Delta (Net Inventory)</p>
                            <h2 className={`text-3xl font-black mt-1 ${reportData.result.stockDelta >= 0 ? 'text-slate-900' : 'text-slate-900'}`}>
                                {reportData.result.stockDelta > 0 ? '+' : ''}{reportData.result.stockDelta.toFixed(2)} QTL
                            </h2>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl">
                             <Warehouse size={32} className="text-slate-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Final Liquidity Breakdown Summary */}
            <Card className="shadow-lg border-2 border-slate-900 bg-slate-50/50 overflow-hidden">
                <CardHeader className="bg-[#5c3e7b] text-white py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <ArrowLeftRight size={18} className="text-purple-200" /> Final Financial Reconciliation Snapshot
                    </CardTitle>
                    <CardDescription className="text-purple-200 text-xs mt-1">Closing balances across all storage points as of {format(endDate, 'dd MMMM yyyy')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-slate-200">
                        <div className="p-6">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Office / Mill Liquidity</Label>
                            <div className="mt-3 space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-sm font-medium text-slate-600">Cash In Hand (Mill)</span>
                                    <span className="text-xl font-black text-slate-900">{formatCurrency(reportData.liquid.cashInHand)}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-sm font-medium text-slate-600">Cash At Home</span>
                                    <span className="text-xl font-black text-slate-900">{formatCurrency(reportData.liquid.cashAtHome)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 lg:col-span-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Bank Account Closings</Label>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4">
                                {Array.from(reportData.liquid.bankBalances.entries()).map(([id, bal]) => {
                                    const acc = globalData.bankAccounts.find(a => a.id === id);
                                    return (
                                        <div key={id} className="flex justify-between items-end border-b border-dashed border-slate-200 pb-2">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-800">{acc?.bankName || 'Bank'}</span>
                                                <span className="text-[10px] text-slate-400">...{acc?.accountNumber.slice(-4)}</span>
                                            </div>
                                            <span className="text-lg font-black text-blue-700">{formatCurrency(bal)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
                <div className="bg-[#5c3e7b] p-6 flex flex-col md:flex-row justify-between items-center border-t border-purple-400/30">
                    <div className="flex flex-col mb-4 md:mb-0">
                        <span className="text-purple-200 text-[10px] uppercase font-black tracking-widest-2">Grand Total Liquidity</span>
                        <span className="text-slate-200 text-xs">Total available business assets across all sources</span>
                    </div>
                    <div className="text-4xl font-black text-white">{formatCurrency(reportData.liquid.total)}</div>
                </div>
            </Card>
        </div>
    );
}

function LiquidCard({ title, amount, icon, color, delta }: { title: string, amount: number, icon: any, color: 'blue' | 'emerald' | 'amber', delta?: number }) {
    const bgMap = { blue: 'bg-blue-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50' };
    const textMap = { blue: 'text-blue-600', emerald: 'text-emerald-600', amber: 'text-amber-600' };
    const borderMap = { blue: 'border-blue-100', emerald: 'border-emerald-100', amber: 'border-amber-100' };

    return (
        <Card className={`overflow-hidden border-none shadow-sm ${borderMap[color]}`}>
            <CardContent className={`p-4 flex flex-col justify-between h-full ${bgMap[color]}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${textMap[color]}`}>{title}</p>
                        <h3 className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(amount)}</h3>
                    </div>
                    <div className={`p-2.5 rounded-xl bg-white shadow-sm ${textMap[color]}`}>
                        {icon}
                    </div>
                </div>
                {delta !== undefined && (
                     <div className="mt-3 flex items-center gap-1.5">
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {delta >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {Math.abs(delta).toFixed(1)}%
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">vs Previous Period</span>
                     </div>
                )}
            </CardContent>
        </Card>
    );
}

function ReportTable({ title, data, headers, type }: { title: string, data: VarietySummary[], headers: string[], type: 'purchase' | 'sales' }) {
    const totalQty = data.reduce((s, v) => s + v.totalQty, 0);
    const totalValue = data.reduce((s, v) => s + v.totalValue, 0);

    return (
        <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-[#5c3e7b] border-b py-3 text-white">
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest">{title}</CardTitle>
            </CardHeader>
            <Table>
                <TableHeader>
                    <TableRow className="bg-slate-100 border-b-2 border-slate-300">
                        <TableHead>{headers[0]}</TableHead>
                        <TableHead className="text-right">{headers[1]}</TableHead>
                        <TableHead className="text-right">{headers[2]}</TableHead>
                        <TableHead className="text-right">{headers[3]}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-slate-400 text-sm italic">
                                No {type} entries found for this period.
                            </TableCell>
                        </TableRow>
                    ) : (
                        <>
                            {data.map((v, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium text-slate-900">{v.variety}</TableCell>
                                    <TableCell className="text-right font-mono">{v.totalQty.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">{v.avgRate.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-600">{formatCurrency(v.totalValue)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-[#5c3e7b] text-white font-bold">
                                <TableCell>TOTAL</TableCell>
                                <TableCell className="text-right">{totalQty.toFixed(2)}</TableCell>
                                <TableCell className="text-right">-</TableCell>
                                <TableCell className="text-right text-lg">{formatCurrency(totalValue)}</TableCell>
                            </TableRow>
                        </>
                    )}
                </TableBody>
            </Table>
        </Card>
    );
}

function LiquidityRow({ label, sub, amount }: { label: string, sub?: string, amount: number }) {
    return (
        <div className="flex justify-between items-end border-b border-dotted pb-1.5 border-slate-200">
             <div>
                <p className="text-xs font-bold text-slate-700 leading-none">{label}</p>
                {sub && <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{sub}</span>}
             </div>
             <span className="font-mono font-bold text-slate-900">{formatCurrency(amount)}</span>
        </div>
    );
}

function FlowItem({ label, amount, secondary, bold }: { label: string, amount: number, secondary?: boolean, bold?: boolean }) {
    return (
        <div className={`flex justify-between items-center ${secondary ? 'text-slate-400 text-xs' : 'text-slate-700 font-medium'} ${bold ? 'font-black text-slate-900' : ''}`}>
            <span>{label}</span>
            <span className="font-mono">{formatCurrency(amount)}</span>
        </div>
    );
}

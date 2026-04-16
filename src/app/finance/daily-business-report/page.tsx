"use client";

import React, { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useGlobalData } from "@/contexts/global-data-context";
import { getLoansRealtime } from "@/lib/firestore";
import type { Loan } from "@/lib/definitions";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { format, isSameDay, startOfDay, subDays, differenceInDays, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, TrendingUp, TrendingDown, DollarSign, Wallet, Warehouse, Info, BarChart3, FileSpreadsheet, FileText, ArrowLeftRight, Activity } from 'lucide-react';
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
        const normalizeVariety = (v: string) => {
            const name = (v || "").toUpperCase().trim();
            if (name.includes("WHEAT") || name.includes("GEHU") || name.includes("KANAK") || name.includes("WHEET")) return "WHEAT";
            if (name.includes("MUSTARD") || name.includes("SARSO") || name.includes("SARSON")) return "MUSTARD";
            if (name.includes("PADDY") || name.includes("DHAN") || name.includes(" धान")) return "PADDY";
            return name || "UNKNOWN";
        };
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
            const v = normalizeVariety(s.variety || '');
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
            const v = normalizeVariety(c.variety || '');
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
            const v = normalizeVariety(s.variety || '');
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
        globalData.suppliers.forEach(s => {
            const v = normalizeVariety(s.variety || '');
            stockMap.set(v, (stockMap.get(v) || 0) + (Number(s.weight) || 0));
        });
        globalData.customers.forEach(c => {
            const v = normalizeVariety(c.variety || '');
            stockMap.set(v, (stockMap.get(v) || 0) - (Number(c.netWeight) || 0));
        });

        const consolidatedLedger = [
            ...(() => {
                const resultArr: any[] = [];
                const daysInRange = Array.from({ length: rangeInDays }).map((_, i) => addDays(filterDate, i));
                
                const opening = getBalancesAtDate(subDays(filterDate, 1));
                let opCashHand = opening.cashInHand;
                let opCashHome = opening.cashAtHome;
                const opBanks = opening.bankBalances;

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
                            const vNameRaw = (s.variety || '').toUpperCase().trim();
                            const vNameNormalized = normalizeVariety(vNameRaw);
                            const variety = vNameRaw ? ` [${vNameRaw}]` : '';
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

                        // PURCHASE & P ADJUSTMENT (Purchase Flow)
                        const dPurchaseAdj = dNet - (daySupps.reduce((s, p) => s + (Number(p.netAmount) || 0), 0));

                        if (dNet > 0) resultArr.push({
                            date: dStr,
                            particulars: `DAILY STOCK PURCHASE (${daySupps.length} parchi | Gross)`,
                            id: 'PURCH', debit: 0, credit: Math.round(dNet), type: 'Purchase'
                        });

                        if (dPurchaseAdj > 1) resultArr.push({
                            date: dStr,
                            particulars: `P ADJUSTMENT (Total Purchase Deductions)`,
                            id: 'PADJ', debit: 0, credit: Math.round(dPurchaseAdj), type: 'Adjustment'
                        });
                    }

                    // S ADJUSTMENT (Stock Debit)
                    const daySales = globalData.customers.filter(c => isSameDay(new Date(c.date), dDate));
                    const dSalesGross = daySales.reduce((sum, s) => sum + ((Number(s.netWeight) || 0) * (Number(s.rate) || 0)), 0);
                    // S ADJUSTMENT (Stock Debit) - Total Base Value after Deductions
                    const dSalesNet = daySales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
                    
                    // Breakdown of all possible differences (Individual Rows with Detail)
                    const vLab   = daySales.reduce((s, p) => s + (Number(p.labouryAmount) || 0), 0);
                    const vKanta = daySales.reduce((s, p) => s + (Number(p.kanta) || 0), 0);
                    const vBagAm = daySales.reduce((s, p) => s + (Number((p as any).bagAmount || 0)), 0);
                    const vTrans = daySales.reduce((s, p) => s + (Number((p as any).transportAmount || 0)), 0);
                    const vBrok  = daySales.reduce((s, p) => s + (Number(p.brokerageAmount || 0)), 0);
                    const vOther = daySales.reduce((s, p) => s + (Number((p as any).otherCharges || 0)), 0);
                    const vBagWt = daySales.reduce((s, p) => s + (Number((p as any).bagWeightDeductionAmount || 0)), 0);

                    // Net Base = Total Receipt Amount - (All the things that were ADDED to the base price as extra revenue)
                    // This naturally keeps "Reductions" (CD, Brokerage Deductions, Karta) and "Brokerage Income" INSIDE the net base.
                    const dSalesNetBase = dSalesNet - (vLab + vKanta + vBagAm + vTrans + vOther);

                    // Metadata for details
                    const tBags = daySales.reduce((s, p) => s + (Number((p as any).bags) || 0), 0);
                    const tBagKgTotal = daySales.reduce((s, p) => s + ((Number((p as any).bags) || 0) * (Number((p as any).bagWeightKg) || 0)), 0);
                    const avgBagWt = tBags > 0 ? (tBagKgTotal / tBags).toFixed(2) : '0';
                    const tBagWtQtl = (tBagKgTotal / 100).toFixed(2);

                    const firstRate = daySales.length > 0 ? (Number(daySales[0].rate) || 1) : 1;

                    if (dSalesNetBase > 0) resultArr.push({
                        date: dStr,
                        particulars: `ADJUSTMENT (S Net Sales Base | ${daySales.length} parchi | Total Bags: ${tBags})`,
                        id: 'SADJ', debit: Math.round(dSalesNetBase), credit: 0, type: 'Adjustment'
                    });

                    // Individual Sales acting as Credits (Net Value)
                    daySales.forEach(c => {
                        const namePart = [c.name, c.companyName, c.address].filter((x): x is string => typeof x === 'string').map(x => x.trim()).join(', ');
                        const vName = (c.variety || '').toUpperCase().trim();
                        resultArr.push({
                            date: c.date,
                            particulars: `${namePart.split(',')[0]} (${vName}) | Sale Net Receipt`,
                            id: c.id.slice(-6).toUpperCase(), debit: 0, credit: Number(c.amount) || 0, type: 'Sale'
                        });
                    });

                    const transMap = new Map<number, number>();
                    daySales.forEach(s => {
                        const tr = Number((s as any).transportationRate) || 0;
                        const wt = Number(s.weight) || 0;
                        if (tr > 0 && wt > 0) transMap.set(tr, (transMap.get(tr) || 0) + wt);
                    });
                    const transDetail = Array.from(transMap.entries()).map(([r, w]) => `${w.toFixed(2)} QTL @ ₹${r}`).join(' + ');

                    // SEPARATE ULTRA-DETAILED ADJUSTMENT ROWS (DEBIT - Surplus/Income)
                    if (Math.round(vLab) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Labour for ${tBags} Bags)`, id: 'SLE-LAB', debit: Math.round(vLab), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vKanta) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Kanta Charges)`, id: 'SLE-KN', debit: Math.round(vKanta), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vBagWt) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Bag Weight Adj | ${tBags} Bags @ ~${avgBagWt}kg | Total ${tBagWtQtl} QTL reduced)`, id: 'SLE-BW', debit: Math.round(vBagWt), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vBagAm) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Bag Charges | ${tBags} Bags)`, id: 'SLE-BG', debit: Math.round(vBagAm), credit: 0, type: 'Adjustment'
                    });
                    if (Math.round(vTrans) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Transport/Freight | ${transDetail})`, id: 'SLE-TR', debit: Math.round(vTrans), credit: 0, type: 'Adjustment'
                    });
                    
                    if (Math.round(vOther) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Misc Income)`, id: 'SLE-OT', debit: Math.round(vOther), credit: 0, type: 'Adjustment'
                    });

                    // Final Check for exact balance against receipts
                    const totalDebitTracked = dSalesNetBase + vLab + vKanta + vBagAm + vTrans + vOther;
                    const diff = dSalesNet - totalDebitTracked;
                    if (Math.round(diff) > 1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Rounding Surplus)`, id: 'SLE-RS', debit: Math.round(diff), credit: 0, type: 'Adjustment'
                    });
                    else if (Math.round(diff) < -1) resultArr.push({
                        date: dStr, particulars: `ADJUSTMENT (Sales Rounding Loss)`, id: 'SLE-RL', debit: 0, credit: Math.round(Math.abs(diff)), type: 'Adjustment'
                    });
                });
                return resultArr;
            })(),
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
                const filteredSales = globalData.customers.filter(c => periodScope(c.date));

                [...filteredIncomes, ...filteredExpenses, ...filteredSales.map(s => ({
                    ...s,
                    payee: s.companyName || s.name || 'Customer',
                    category: 'SALES',
                    amount: s.amount,
                    isIncome: true
                }))].forEach((t: any) => {
                    const dStr = format(startOfDay(new Date(t.date)), 'yyyy-MM-dd');
                    if (!dayGroups.has(dStr)) dayGroups.set(dStr, new Map());
                    const subGroup = dayGroups.get(dStr)!;

                    const subCat = (t.category || 'Other').toUpperCase().trim();
                    if (!subGroup.has(subCat)) {
                        subGroup.set(subCat, { debits: [], credits: [] });
                    }
                    const g = subGroup.get(subCat)!;
                    
                    const isIncome = t.isIncome || ('transactionType' in t ? t.transactionType === 'Income' : (filteredIncomes.includes(t as any)));
                    
                    if (isIncome) {
                        g.credits.push({ payee: t.payee, amount: Number(t.amount) || 0, description: t.variety });
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
            })(),
            audit360Zones: (() => {
                const zones: Record<string, { label: string, rows: any[], total: number, stats: any }> = {
                    PURCHASE: { label: 'Purchase Zone', rows: [], total: 0, stats: { qty: 0, parchi: 0 } },
                    SALE: { label: 'Sale Zone', rows: [], total: 0, stats: { qty: 0, parchi: 0 } },
                    ADJUSTMENT: { label: 'Adjustment Zone', rows: [], total: 0, stats: { margin: 0 } },
                    EXPENSE: { label: 'Expense Zone', rows: [], total: 0, stats: { topCat: '' } },
                    INCOME: { label: 'Income Zone', rows: [], total: 0, stats: { topCat: '' } },
                    INTERNAL: { label: 'Internal Cashflow', rows: [], total: 0, stats: { count: 0 } }
                };

                const filterDate = startOfDay(startDate);
                const filterEndDate = startOfDay(endDate);

                // 1. Purchase Zone (Procurement)
                globalData.suppliers.filter(s => {
                    const d = startOfDay(new Date(s.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach(s => {
                    const amt = Number(s.netAmount) || 0;
                    const wt = Number(s.netWeight) || 0;
                    const lab = Number(s.labouryAmount) || 0;
                    const kan = Number(s.kanta) || 0;
                    const krt = Number(s.kartaAmount) || 0;
                    const brk = Number(s.brokerageAmount) || 0;

                    zones.PURCHASE.rows.push({
                        date: s.date,
                        item: s.name,
                        details: `${wt.toFixed(2)} QTL | ${s.variety}`,
                        amount: amt,
                        laboury: lab, kanta: kan, kartaAmt: krt, brokerage: brk,
                        tag: s.id.slice(-4)
                    });
                    zones.PURCHASE.total += amt;
                    zones.PURCHASE.stats.qty += wt;
                    zones.PURCHASE.stats.parchi++;

                    // Operational Adjustments (These are credits to the company deducted from purchase)
                    if (lab > 0) zones.ADJUSTMENT.rows.push({ date: s.date, item: 'PUR. LABOUR', details: `From ${s.name}`, amount: lab, type: 'IN', tag: 'LAB' });
                    if (kan > 0) zones.ADJUSTMENT.rows.push({ date: s.date, item: 'PUR. KANTA', details: `From ${s.name}`, amount: kan, type: 'IN', tag: 'KAN' });
                    if (krt > 0) zones.ADJUSTMENT.rows.push({ date: s.date, item: 'PUR. KARTA', details: `From ${s.name}`, amount: krt, type: 'IN', tag: 'KRT' });
                });

                // 2. Sale Zone (Revenue)
                globalData.customers.filter(c => {
                    const d = startOfDay(new Date(c.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach(c => {
                    const amt = Number(c.amount) || 0;
                    const wt = Number(c.netWeight) || 0;
                    zones.SALE.rows.push({
                        date: c.date,
                        item: c.companyName || c.name,
                        details: `${wt.toFixed(2)} QTL Sold | ${c.variety}`,
                        amount: amt,
                        tag: 'SALE'
                    });
                    zones.SALE.total += amt;
                    zones.SALE.stats.qty += wt;
                    zones.SALE.stats.parchi++;

                    // Sale-Side Adjustments
                    const vLab = Number(c.labouryAmount) || 0;
                    const vKan = Number(c.kanta) || 0;
                    const vBag = Number((c as any).bagAmount || 0);
                    if (vLab > 0) zones.ADJUSTMENT.rows.push({ date: c.date, item: 'SALE LABOUR', details: `${c.name}`, amount: vLab, type: 'IN', tag: 'SLAB' });
                    if (vKan > 0) zones.ADJUSTMENT.rows.push({ date: c.date, item: 'SALE KANTA', details: `${c.name}`, amount: vKan, type: 'IN', tag: 'SKAN' });
                    if (vBag > 0) zones.ADJUSTMENT.rows.push({ date: c.date, item: 'BAG CHARGES', details: `${c.name}`, amount: vBag, type: 'IN', tag: 'BAG' });
                });

                // 3. Expense Zone
                globalData.expenses.filter(e => {
                    const d = startOfDay(new Date(e.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach(e => {
                    const amt = Number(e.amount) || 0;
                    zones.EXPENSE.rows.push({ date: e.date, item: e.payee, details: e.category, amount: amt, tag: 'EXP' });
                    zones.EXPENSE.total += amt;
                });

                // 4. Income Zone (Other Incomes)
                globalData.incomes.filter(i => {
                    const d = startOfDay(new Date(i.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach(i => {
                    const amt = Number(i.amount) || 0;
                    zones.INCOME.rows.push({ date: i.date, item: i.payee, details: i.category, amount: amt, tag: 'INC' });
                    zones.INCOME.total += amt;
                });

                // 5. Internal Cashflow Zone (Contra)
                globalData.fundTransactions.filter(t => {
                    const d = startOfDay(new Date(t.date));
                    return d >= filterDate && d <= filterEndDate;
                }).forEach(t => {
                    const amt = Number(t.amount) || 0;
                    zones.INTERNAL.rows.push({ date: t.date, item: `${t.source} ➔ ${t.destination}`, details: t.description || 'Internal Transfer', amount: amt, tag: 'CASHFLOW' });
                    zones.INTERNAL.total += amt;
                    zones.INTERNAL.stats.count++;
                });

                return Object.entries(zones).map(([key, zone]) => {
                    const maxAmt = Math.max(...zone.rows.map(r => r.amount), 1);
                    return {
                        key, ...zone,
                        rows: zone.rows.map(r => ({ ...r, intensity: (r.amount / maxAmt) * 100 }))
                                 .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    };
                });
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
                const normV = (v: string | null | undefined) => {
                    const name = (v || "").toUpperCase().replace(/\s+/g, " ").trim();
                    if (!name) return "UNKNOWN";
                    if (name.includes("WHEAT") || name.includes("GEHU") || name.includes("KANAK") || name.includes("WHEET") || name.includes("WEHT")) return "WHEAT";
                    if (name.includes("MUSTARD") || name.includes("SARSO") || name.includes("SARSON") || name.includes("RYA")) return "MUSTARD";
                    if (name.includes("PADDY") || name.includes("DHAN") || name.includes("PR-") || name.includes(" धान")) return "PADDY";
                    return name;
                };

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
                    body { font-family: 'Inter', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.2; background: #fff; letter-spacing: -0.01em; }
                    .header { text-align: left; border-bottom: 3.5px solid #1a365d; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
                    .header-left h1 { margin: 0; color: #1a365d; font-size: 32px; font-weight: 900; letter-spacing: -0.04em; line-height: 0.9; }
                    .header-left p { margin: 8px 0 0 0; color: #64748b; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                    .header-right { text-align: right; color: #94a3b8; font-size: 9px; font-weight: 600; text-transform: uppercase; }

                    .section { margin-bottom: 45px; page-break-inside: auto !important; margin-top: 35px; }
                    .section-title { font-size: 11px; font-weight: 900; color: #ffffff; background: #334155 !important; padding: 8px 12px; margin-bottom: 0px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px 4px 0 0; -webkit-print-color-adjust: exact; }
                    
                    .v-ledger-table { width: 100%; border-collapse: collapse; margin-top: 0px; margin-bottom: 0px; border: 0.5px solid #cbd5e1; table-layout: fixed; }
                    .v-ledger-table th { background: #334155 !important; color: #ffffff !important; padding: 7px 5px; font-size: 8.5px; border: 0.5px solid #ffffff33; text-transform: uppercase; font-weight: 900; letter-spacing: 0.2px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .v-ledger-table td { padding: 5px 4px; font-size: 9px; border: 0.5px solid #cbd5e1; text-align: center; color: #0f172a; font-weight: 500; }
                    .v-ledger-table tr:nth-child(even) { background: #fcfcfc; }
                    
                    .v-header-label { background: #334155 !important; color: white; padding: 8px 12px; font-weight: 900; font-size: 11px; display: flex; justify-content: space-between; border: 1px solid #334155; border-bottom: none; margin-top: 30px; margin-bottom: 0px; border-radius: 4px 4px 0 0; -webkit-print-color-adjust: exact; }
                    
                    .row-main { font-weight: 800; color: #0f172a; font-size: 10px; }
                    .row-sub { font-size: 8px; color: #64748b; font-weight: 600; }
                    .val-label { color: #2563eb; font-weight: 900; }
                    .cut-label { color: #dc2626; font-weight: 900; }
                    
                    .total-row { background: #1e293b !important; color: white !important; font-weight: 900 !important; }
                    .total-row td { border-color: #334155; color: white !important; font-weight: 900; font-size: 10px; }
                    .total-row .row-sub { color: #cbd5e1 !important; }

                    .result-box { border: 2.5px solid #1a365d; padding: 20px; border-radius: 0px; display: flex; justify-content: space-around; margin-top: 20px; background: #fff; }
                    .result-item { text-align: center; }
                    .result-item label { display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
                    .result-item span { font-size: 24px; font-weight: 900; color: #1a365d; }
                    .positive { color: #059669 !important; }
                    .negative { color: #dc2626 !important; }

                    .audit-grid { display: flex; flex-direction: column; width: 100%; }
                    .audit-grid-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 0.5px solid #f1f5f9; padding: 2px 0; }
                    .audit-label { font-size: 7px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
                    .audit-value { font-size: 8.5px; font-weight: 800; color: #1e293b; font-family: monospace; }
                    .net-pos-cell { text-align: right; background: #f8fafc !important; -webkit-print-color-adjust: exact; padding: 4px 8px; border-left: 1px solid #e2e8f0; }
                    .net-pos-label { font-size: 7px; font-weight: 900; color: #5c3e7b; text-transform: uppercase; display: block; margin-bottom: 2px; }
                    .net-pos-value { font-size: 11px; font-weight: 900; color: #0f172a; }
                    
                    @media print {
                        body { padding: 0px; }
                        .section-title { background: #1a365d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .v-ledger-table th { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .total-row { background: #1e293b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .v-header-label { background: #334155 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        @page { size: landscape; margin: 0.5cm; margin-top: 2.0cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        <h1>${escapeHtml(toTitleCase(companyName))}</h1>
                        <p>AUDITED PROCUREMENT & SALES OPERATIONS | ${dateRangeText}</p>
                    </div>
                    <div class="header-right">
                        SYSTEM GENERATED AUDIT<br>
                        ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">SECTION A: DAILY LIQUIDITY & BANK ASSETS AUDIT LEDGER</div>
                    <table class="v-ledger-table" style="margin-bottom: 10px;">
                        <thead>
                            <tr>
                            <tr style="background: #334155 !important; color: white !important;">
                                <th style="width: 75px; border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; font-size: 8.5px; padding: 7px 5px; -webkit-print-color-adjust: exact;" rowspan="2">BUSINESS DAY</th>
                                <th colspan="2" style="border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; font-size: 8.5px; padding: 7px 5px; -webkit-print-color-adjust: exact;">CASH HAND</th>
                                <th colspan="2" style="border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; font-size: 8.5px; padding: 7px 5px; -webkit-print-color-adjust: exact;">CASH HOME</th>
                                ${globalData.bankAccounts.map(acc => `
                                    <th colspan="2" style="border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; font-size: 8.5px; padding: 7px 5px; -webkit-print-color-adjust: exact;">
                                        ${escapeHtml(acc.bankName)}
                                    </th>
                                `).join('')}
                                <th style="background: #334155 !important; border: 0.5px solid #ffffff33; color: white !important; font-size: 8.5px; padding: 7px 5px; -webkit-print-color-adjust: exact;">CONSOLIDATED BALANCE</th>
                            </tr>
                            <tr style="background: #334155 !important; font-size: 6.5px; color: white !important;">
                                ${['CashHand', 'CashHome', ...globalData.bankAccounts].map(() => `
                                    <th style="border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact;">OPENING / IN (+)</th>
                                    <th style="border: 0.5px solid #ffffff33; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact;">CLOSING / OUT (-)</th>
                                `).join('')}
                                <th style="background: #334155 !important; border: 0.5px solid #ffffff33; font-size: 8px; color: white !important; -webkit-print-color-adjust: exact;">FINAL AUDIT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(reportData.dayWiseLiquidity || []).map((d: any) => `
                                <!-- BLOCK: BALANCE -->
                                <tr style="border-top: 1.5px solid #cbd5e1; background: #f8fafc !important;">
                                    <td style="font-weight: 900; font-size: 10px; color: #1e293b; text-align: center; border: 0.5px solid #e2e8f0; background: #f1f5f9 !important;" rowspan="2">${d.date}</td>
                                    ${['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map((id: string) => {
                                        const m = d.metrics[id] || { opening: 0, closing: 0 };
                                        return `
                                            <td style="font-size: 8.5px; font-family: monospace; color: #64748b; border: 0.5px solid #f1f5f9; text-align: right; padding-right: 4px;">${Math.round(m.opening || 0).toLocaleString('en-IN')}</td>
                                            <td style="font-size: 9px; font-family: monospace; color: #0f172a; font-weight: 900; background: #f0f7ff !important; border: 0.5px solid #e2e8f0; text-align: right; padding-right: 4px;">${Math.round(m.closing || 0).toLocaleString('en-IN')}</td>
                                        `;
                                    }).join('')}
                                    <td style="text-align: right; font-weight: 900; font-size: 13px; font-family: monospace; color: #000 !important; padding-right: 6px; border: 0.5px solid #cbd5e1; background: #fff !important;" rowspan="2">
                                        ${Math.round(d.totalClosing || 0).toLocaleString('en-IN')}
                                    </td>
                                </tr>
                                <!-- BLOCK: FLOW -->
                                <tr style="background: #fff !important; border-bottom: 1.5px solid #cbd5e1;">
                                    ${['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map((id: string) => {
                                        const m = d.metrics[id] || { income: 0, expense: 0 };
                                        return `
                                            <td style="font-size: 8.5px; font-family: monospace; color: #059669; font-weight: 900; border: 0.5px solid #f1f5f9; text-align: right; padding-right: 4px; font-style: italic;">+ ${m.income > 0 ? Math.round(m.income).toLocaleString('en-IN') : '–'}</td>
                                            <td style="font-size: 8.5px; font-family: monospace; color: #dc2626; font-weight: 900; border: 0.5px solid #f1f5f9; text-align: right; padding-right: 4px; font-style: italic;">– ${m.expense > 0 ? Math.round(m.expense).toLocaleString('en-IN') : '–'}</td>
                                        `;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="text-align: right; font-weight: 900; font-size: 14px; color: #1a365d; margin-top: 5px;">
                        REPORT PERIOD CLOSING LIQUIDITY: ${formatCurrency(reportData.liquid.total)}
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">SECTION Z: 360° PARALLEL AUDIT LEDGER & OPERATIONAL SUMMARY</div>
                    
                    ${(() => {
                        const pZone = reportData.audit360Zones.find(z => z.key === 'PURCHASE');
                        const pRows = pZone?.rows || [];
                        const sums = pRows.reduce((acc, r) => {
                            acc.l += (Number(r.laboury) || 0);
                            acc.k += (Number(r.kanta) || 0);
                            acc.b += (Number(r.brokerage) || 0);
                            acc.kr += (Number(r.kartaAmt) || 0);
                            return acc;
                        }, { l:0, k:0, b:0, kr:0 });

                        return `
                        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 15px;">
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #fff8f1 !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #9a3412; text-transform: uppercase;">PUR QTY</div>
                                <div style="font-size: 10px; font-weight: 900;">${(pZone?.stats?.qty || 0).toFixed(2)} QTL</div>
                            </div>
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #f0fdf4 !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #166534; text-transform: uppercase;">SALES QTY</div>
                                <div style="font-size: 10px; font-weight: 900;">${(reportData.audit360Zones.find(z=>z.key==='SALE')?.stats?.qty || 0).toFixed(2)} QTL</div>
                            </div>
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #f5f3ff !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #5b21b6; text-transform: uppercase;">TOTAL LABOUR</div>
                                <div style="font-size: 10px; font-weight: 900;">₹${Math.round(sums.l).toLocaleString()}</div>
                            </div>
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #fff1f2 !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #9f1239; text-transform: uppercase;">TOTAL KANTA</div>
                                <div style="font-size: 10px; font-weight: 900;">₹${Math.round(sums.k).toLocaleString()}</div>
                            </div>
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #fff7ed !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #9a3412; text-transform: uppercase;">TOTAL KARTA</div>
                                <div style="font-size: 10px; font-weight: 900;">₹${Math.round(sums.kr).toLocaleString()}</div>
                            </div>
                            <div style="border: 0.5px solid #e2e8f0; padding: 5px; text-align: center; border-radius: 4px; background: #eff6ff !important;">
                                <div style="font-size: 6px; font-weight: 800; color: #1e40af; text-transform: uppercase;">TOTAL BROKERAGE</div>
                                <div style="font-size: 10px; font-weight: 900;">₹${Math.round(sums.b).toLocaleString()}</div>
                            </div>
                        </div>`;
                    })()}

                    <table class="v-ledger-table" style="width: 100%; border-collapse: collapse; -webkit-print-color-adjust: exact; table-layout: fixed;">
                        <thead>
                             <tr style="background: #1e293b !important; color: white !important;">
                                <th colspan="2" style="background: #b45309 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">PURCHASE ZONE</th>
                                <th colspan="2" style="background: #047857 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">SALE ZONE</th>
                                <th colspan="2" style="background: #9f1239 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">ADJUSTMENT ZONE</th>
                                <th colspan="2" style="background: #334155 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">EXPENSE ZONE</th>
                                <th colspan="2" style="background: #3730a3 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">INCOME ZONE</th>
                                <th colspan="2" style="background: #0891b2 !important; border: 0.5px solid #ffffff33; font-size: 7.5px;">INTERNAL</th>
                            </tr>
                            <tr style="background: #475569 !important; color: white !important; font-size: 6px;">
                                <th style="width: 15%;">PARTICULAR</th><th>AMT</th>
                                <th>PARTICULAR</th><th>AMT</th>
                                <th>PARTICULAR</th><th>AMT</th>
                                <th>PARTICULAR</th><th>AMT</th>
                                <th>PARTICULAR</th><th>AMT</th>
                                <th>PARTICULAR</th><th>AMT</th>
                            </tr>
                        </thead>
                        <tbody style="font-size: 7.5px;">
                            ${(() => {
                                const pRows = reportData.audit360Zones.find(z => z.key === 'PURCHASE')?.rows || [];
                                const sRows = reportData.audit360Zones.find(z => z.key === 'SALE')?.rows || [];
                                const aRows = reportData.audit360Zones.find(z => z.key === 'ADJUSTMENT')?.rows || [];
                                const eRows = reportData.audit360Zones.find(z => z.key === 'EXPENSE')?.rows || [];
                                const iRows = reportData.audit360Zones.find(z => z.key === 'INCOME')?.rows || [];
                                const cRows = reportData.audit360Zones.find(z => z.key === 'INTERNAL')?.rows || [];
                                
                                const maxRows = Math.max(pRows.length, sRows.length, aRows.length, eRows.length, iRows.length, cRows.length);
                                return Array.from({ length: maxRows }).map((_, i) => `
                                    <tr>
                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${pRows[i] ? escapeHtml(pRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #b45309;">${pRows[i] ? format(new Date(pRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace; font-weight: 900;">${pRows[i] ? Math.round(pRows[i].amount).toLocaleString() : ''}</td>
                                        
                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${sRows[i] ? escapeHtml(sRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #047857;">${sRows[i] ? format(new Date(sRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace;">${sRows[i] ? Math.round(sRows[i].amount).toLocaleString() : ''}</td>
                                        
                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${aRows[i] ? escapeHtml(aRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #9f1239;">${aRows[i] ? format(new Date(aRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace;">${aRows[i] ? Math.round(aRows[i].amount).toLocaleString() : ''}</td>
                                        
                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${eRows[i] ? escapeHtml(eRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #334155;">${eRows[i] ? format(new Date(eRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace;">${eRows[i] ? Math.round(eRows[i].amount).toLocaleString() : ''}</td>

                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${iRows[i] ? escapeHtml(iRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #3730a3;">${iRows[i] ? format(new Date(iRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace;">${iRows[i] ? Math.round(iRows[i].amount).toLocaleString() : ''}</td>

                                        <td style="border: 0.5px solid #e2e8f0; padding: 2px 5px;">
                                            <div style="display: flex; justify-content: space-between; font-weight: 800; color: #000;">
                                                <span>${cRows[i] ? escapeHtml(cRows[i].item) : '-'}</span>
                                                <span style="font-size: 6px; color: #0891b2;">${cRows[i] ? format(new Date(cRows[i].date), 'dd/MM') : ''}</span>
                                            </div>
                                        </td>
                                        <td style="text-align: right; border: 0.5px solid #e2e8f0; font-family: monospace;">${cRows[i] ? Math.round(cRows[i].amount).toLocaleString() : ''}</td>
                                    </tr>
                                `).join('');
                            })()}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <div class="section-title">Section B: Variety-Wise Procurement Audit</div>
                    ${(() => {
                        const filtered = globalData.suppliers.filter(s => {
                            const ed = startOfDay(new Date(s.date));
                            return ed >= startOfDay(startDate) && ed <= startOfDay(endDate);
                        });
                        const varietyGroups: Record<string, any[]> = {};
                        filtered.forEach(s => {
                            const v = normV(s.variety);
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
                            <div style="page-break-inside: auto;">
                                <div class="v-header-label">
                                    <span>VARIETY: ${vName.toUpperCase()} PROCUREMENT</span>
                                    <span>TOTAL QNTL: ${vTotal.finalWt.toFixed(2)}</span>
                                </div>
                                <table class="v-ledger-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 12%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Timeline</th>
                                            <th style="width: 10%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Gross/Tier</th>
                                            <th style="width: 12%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Audit Cut</th>
                                            <th style="width: 10%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Net Wt</th>
                                            <th style="width: 14%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Rate/Value</th>
                                            <th style="width: 14%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Krt/Lab/Kan</th>
                                            <th style="width: 14%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Liab/Paid</th>
                                            <th style="width: 14%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Payable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${rows.map(r => `
                                            <tr>
                                                <td><div class="row-main">${r.date}</div><div class="row-sub">Parchi: ${r.parchi}</div></td>
                                                <td><div class="row-main">${r.gross.toFixed(1)}</div><div class="row-sub">${r.tier.toFixed(1)}</div></td>
                                                <td><div class="row-main">${r.baseWt.toFixed(1)}</div><div class="row-sub cut-label">-${r.kartaWt.toFixed(1)}</div></td>
                                                <td><div class="row-main" style="font-size: 11px;">${r.finalWt.toFixed(2)}</div></td>
                                                <td><div class="val-label">₹${Math.round(r.finalWt > 0 ? r.original / r.finalWt : 0)}/QTL</div><div class="row-sub">₹${Math.round(r.original).toLocaleString()}</div></td>
                                                <td><div class="row-main">${r.avgKartaPct.toFixed(1)}% / ₹${Math.round(r.kartaAmt)}</div><div class="row-sub">L:${Math.round(r.labAmt)} | K:${Math.round(r.kanAmt)}</div></td>
                                                <td><div class="row-main">₹${Math.round(r.original).toLocaleString()}</div><div class="row-sub">PD:₹${Math.round(r.paid).toLocaleString()}</div></td>
                                                <td style="color: #0f172a; font-weight: 900; font-size: 11px; border-left: 1px solid #e2e8f0; text-align: right; padding-right: 6px;">₹${Math.round(r.balance).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                        <tr class="total-row">
                                            <td>TOTAL: ${vTotal.parchi} P</td>
                                            <td>${vTotal.gross.toFixed(1)} / ${vTotal.tier.toFixed(1)}</td>
                                            <td>${vTotal.baseWt.toFixed(1)} / -${vTotal.kartaWt.toFixed(1)}</td>
                                            <td style="color: #cbd5e1; font-size: 11px;">${vTotal.finalWt.toFixed(2)}</td>
                                            <td>₹${Math.round(vTotal.finalWt > 0 ? vTotal.original / vTotal.finalWt : 0)}/QTL</td>
                                            <td>${Math.round(vTotal.labAmt + vTotal.kanAmt + vTotal.kartaAmt).toLocaleString()}</td>
                                            <td>₹${Math.round(vTotal.original).toLocaleString()}</td>
                                            <td style="background: #0f172a; color: white; font-weight: 900; font-size: 12px;">₹${Math.round(vTotal.balance).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>`;
                        }).join('');
                    })()}
                </div>

                <div class="section">
                    <div class="section-title">Section C: Daily Financial Distribution Ledger</div>
                    <table class="v-ledger-table">
                        <thead>
                            <tr>
                                <th style="width: 12%; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Date</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Sup Cash</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Sup RTGS</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Gov Dist</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; -webkit-print-color-adjust: exact; border: 0.5px solid #ffffff33;">Tot Pay</th>
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
                                </tr>
                            `).join('')}
                            <tr class="total-row" style="background: #334155 !important; color: white !important;">
                                <td style="color: white !important;">PERIOD TOTAL</td>
                                <td style="text-align: right; color: white !important;">${reportData.distribution.supplierCash.toLocaleString('en-IN')}</td>
                                <td style="text-align: right; color: white !important;">${reportData.distribution.supplierRtgs.toLocaleString('en-IN')}</td>
                                <td style="text-align: right; color: white !important;">${reportData.distribution.govDist.toLocaleString('en-IN')}</td>
                                <td style="text-align: right; background: #334155 !important; color: white !important; font-weight: 900; font-size: 11px; border: 1px solid #ffffff33; -webkit-print-color-adjust: exact;">${reportData.distribution.totalPayments.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                    <div class="section">
                        <div class="section-title">Section D: Current Variety Stock</div>
                    <table class="v-ledger-table" style="table-layout: auto;">
                        <thead>
                            <tr>
                                <th style="text-align: left; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Variety Name</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Available Stock (QTL)</th>
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
                                <th style="width: 10%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">DATE</th>
                                <th style="text-align: left; padding-left: 10px; width: 30%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">PARTICULAR</th>
                                <th style="text-align: left; padding-left: 10px; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">DETAILS / DESCRIPTION</th>
                                <th style="text-align: right; padding-right: 15px; width: 100px; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">DEBIT</th>
                                <th style="text-align: right; padding-right: 15px; width: 100px; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">CREDIT</th>
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
                                    <td colspan="3" style="text-align: left; padding-left: 15px;">CONSOLIDATED AUDIT TOTALS</td>
                                    <td style="text-align: right; padding-right: 15px;">${reportData.audit360.reduce((s, r) => s + r.debit, 0).toLocaleString('en-IN')}</td>
                                    <td style="text-align: right; padding-right: 15px;">${reportData.audit360.reduce((s, r) => s + r.credit, 0).toLocaleString('en-IN')}</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>


                <div class="section">
                    <div class="section-title">Section F: Audited Sales Recap</div>
                    <table class="v-ledger-table" style="table-layout: auto;">
                        <thead>
                            <tr>
                                <th style="text-align: left; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Variety Name</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Qty Sold (QTL)</th>
                                <th style="text-align: right; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Value (₹)</th>
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
                                <td style="text-align: left;">NET SALES SUMMARY</td>
                                <td style="text-align: right;">${reportData.sales.reduce((s, v) => s + v.totalQty, 0).toFixed(2)}</td>
                                <td style="text-align: right; background: #334155 !important; color: white !important; font-weight: 900; font-size: 11px; border: 1px solid #ffffff33;">${formatCurrency(reportData.sales.reduce((s, v) => s + v.totalValue, 0))}</td>
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
                                <th style="text-align: left; width: 8%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Date</th>
                                <th style="text-align: left; width: 10%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Type</th>
                                <th style="text-align: left; width: 38%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Particulars</th>
                                <th style="text-align: left; width: 10%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Ref ID</th>
                                <th style="text-align: right; width: 12%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Debit (DR)</th>
                                <th style="text-align: right; width: 12%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Credit (CR)</th>
                                <th style="text-align: right; width: 10%; background: #334155 !important; color: white !important; border: 0.5px solid #ffffff33; -webkit-print-color-adjust: exact;">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(() => {
                                let runningBal = 0;
                                return reportData.consolidatedLedger.map((t: any) => {
                                    runningBal += (t.credit - t.debit);
                                    const typeColors: Record<string, {bg: string, color: string}> = {
                                        'Purchase':         { bg: '#fee2e2', color: '#b91c1c' },
                                        'Labour':           { bg: '#f0fdf4', color: '#15803d' },
                                        'Kanta':            { bg: '#f0fdf4', color: '#15803d' },
                                        'Expense':          { bg: '#fef2f2', color: '#991b1b' },
                                        'Supplier Payment': { bg: '#fff1f2', color: '#be123c' },
                                        'Transfer Out':     { bg: '#fff7ed', color: '#9a3412' },
                                        'Transfer In':      { bg: '#f0fdfa', color: '#0f766e' },
                                        'Loan':             { bg: '#eef2ff', color: '#3730a3' },
                                        'Sale':             { bg: '#f0fdf4', color: '#14532d' },
                                        'Customer Receipt': { bg: '#f0fdf4', color: '#15803d' },
                                        'Income':           { bg: '#ecfdf5', color: '#064e3b' },
                                        'P ADJUSTMENT':     { bg: '#f0f9ff', color: '#075985' },
                                        'Liquid':           { bg: '#f8fafc', color: '#1e293b' },
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
                                            <td style="text-align: right; color: #b91c1c; font-weight: 700;">${debitAmt > 0 ? debitAmt.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '-'}</td>
                                            <td style="text-align: right; color: #15803d; font-weight: 700;">${creditAmt > 0 ? creditAmt.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : '-'}</td>
                                            <td style="text-align: right; font-weight: 900; background: #f8fafc; color: ${runningBal >= 0 ? '#1a365d' : '#b91c1c'}; font-size: 10px;">${Math.round(runningBal).toLocaleString('en-IN')}</td>
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

            <Card 
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as any}
                className="border-none shadow-md bg-white overflow-hidden p-0 print:shadow-none print:border print:border-slate-300"
            >
                <CardHeader className="bg-[#5c3e7b] py-4 print:bg-[#5c3e7b] !important">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.15em] leading-none flex items-center gap-2 text-white print:text-white">
                        <Wallet size={16} className="text-purple-200" /> Section A: Liquidity & Bank Assets Audit Ledger
                    </CardTitle>
                    <CardDescription className="text-[10px] text-purple-200/80 uppercase tracking-widest mt-1.5 font-bold italic print:text-purple-300">
                        DAILY AUDIT: OPENING | IN(+) | OUT(-) | CLOSING
                    </CardDescription>
                </CardHeader>
                <div className="overflow-x-auto border-x border-b border-slate-200 relative no-scrollbar bg-white print:overflow-visible print:border-none">
                    <Table className="border-collapse border-slate-200 print:border-slate-300">
                        <TableHeader className="bg-[#5c3e7b] print:bg-[#5c3e7b] !important">
                            <TableRow className="hover:bg-transparent border-none h-14">
                                <TableHead className="w-[85px] text-center font-bold text-white font-jakarta uppercase tracking-tighter text-[11px] sticky left-0 z-50 bg-[#5c3e7b] border-r border-white/10 shadow-[2px_0_0_0_#5c3e7b] print:relative print:left-0 print:z-0 print:bg-[#5c3e7b] !important print:text-white print:border-r-2 print:border-white/20">
                                    DATE
                                </TableHead>
                                
                                {/* Asset Headings */}
                                {['Cash Hand', 'Cash Home', ...globalData.bankAccounts.map(a => a.bankName)].map((name, idx) => (
                                    <TableHead 
                                        key={idx} 
                                        colSpan={2} 
                                        className="text-center font-extrabold text-white font-jakarta uppercase tracking-[0.1em] text-[11px] p-0 border-r border-white/10 bg-[#5c3e7b] last:border-r-0 print:bg-[#5c3e7b] !important print:text-white print:border-r-2 print:border-white/20"
                                    >
                                        <div className="py-2 border-b border-white/10 opacity-95">{name}</div>
                                        <div className="flex justify-between px-3 py-1.5 text-[8px] font-black text-purple-100 tracking-[0.2em] bg-[#5c3e7b]/50 print:bg-[#5c3e7b]/50">
                                            <span>OP / IN (+)</span>
                                            <span className="text-white/30 text-[10px]">|</span>
                                            <span>CL / OUT (-)</span>
                                        </div>
                                    </TableHead>
                                ))}
                                
                                <TableHead className="text-right px-6 font-black text-white font-jakarta uppercase tracking-[0.15em] text-[11px] sticky right-0 z-50 bg-[#5c3e7b] border-l border-white/20 shadow-[-2px_0_0_0_#5c3e7b] print:relative print:right-0 print:z-0 print:bg-[#5c3e7b] !important print:text-white print:border-l-2 print:border-white/20">
                                    <div className="leading-tight">GRAND TOTAL</div>
                                    <div className="text-[8px] text-purple-300 mt-1 tracking-widest font-bold font-jakarta">DAILY AUDIT</div>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="[&_tr:nth-child(odd)]:bg-transparent">
                            {reportData.dayWiseLiquidity.map((d, i) => {
                                const isAlternateBlock = i % 2 !== 0;
                                const blockBg = isAlternateBlock ? '#f8f9fa' : '#ffffff';
                                const printBg = isAlternateBlock ? 'print:bg-[#f8f9fa] !important' : 'print:bg-white !important';
                                const lightLine = '1px solid #e2e8f0'; // Subtle Slate-200
                                
                                return (
                                    <Fragment key={i}>
                                        {/* BALANCE ROW */}
                                        <TableRow style={{ backgroundColor: blockBg }} className={`h-10 transition-none font-jakarta hover:bg-slate-100/50 ${printBg}`}>
                                            <TableCell 
                                                rowSpan={2} 
                                                style={{ 
                                                    backgroundColor: blockBg,
                                                    borderRight: lightLine
                                                }}
                                                className={`font-bold text-slate-900 py-1 text-[12px] text-center sticky left-0 z-20 ${printBg} print:relative print:left-0 print:z-0 print:text-slate-950 print:font-bold print:border-r-2 print:border-slate-300`}
                                            >
                                                {d.date}
                                            </TableCell>
                                            
                                            {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map((id) => {
                                                const m = d.metrics[id] || { opening: 0, closing: 0 };
                                                return (
                                                    <Fragment key={`${id}-oc`}>
                                                        <TableCell 
                                                            style={{ backgroundColor: 'transparent', borderRight: 'none' }} 
                                                            className={`font-code text-[11px] text-slate-400 px-3 text-right ${printBg} print:text-slate-500`}
                                                        >
                                                            {Math.round(m.opening).toLocaleString('en-IN')}
                                                        </TableCell>
                                                        <TableCell 
                                                            style={{ backgroundColor: 'transparent', borderRight: lightLine }} 
                                                            className={`font-code text-[11px] text-slate-900 font-bold px-3 text-right ${printBg} print:text-slate-950 print:font-black print:border-r-2 print:border-slate-200`}
                                                        >
                                                            {Math.round(m.closing || 0).toLocaleString('en-IN')}
                                                        </TableCell>
                                                    </Fragment>
                                                );
                                            })}

                                            <TableCell 
                                                rowSpan={2} 
                                                style={{ 
                                                    backgroundColor: blockBg,
                                                    borderLeft: lightLine
                                                }}
                                                className={`px-4 py-0 font-black text-slate-900 font-code text-[13px] text-right sticky right-0 z-20 ${printBg} print:relative print:right-0 print:z-0 print:text-slate-950 print:font-black print:border-l-2 print:border-slate-300`}
                                            >
                                                <div className="text-[12px]">{Math.round(d.totalClosing).toLocaleString('en-IN')}</div>
                                                <div className="text-[9px] text-emerald-600 font-bold font-jakarta print:text-emerald-800 print:font-black">Net: {(Math.round((d.totalIn || 0) - (d.totalOut || 0))).toLocaleString('en-IN')}</div>
                                            </TableCell>
                                        </TableRow>

                                        {/* FLOW ROW */}
                                        <TableRow style={{ backgroundColor: blockBg }} className={`h-9 transition-none font-jakarta hover:bg-slate-100/50 ${printBg}`}>
                                            {['CashInHand', 'CashAtHome', ...globalData.bankAccounts.map(a => a.id)].map((id) => {
                                                const m = d.metrics[id] || { income: 0, expense: 0 };
                                                return (
                                                    <Fragment key={`${id}-ie`}>
                                                        <TableCell 
                                                            style={{ backgroundColor: 'transparent', borderRight: 'none' }} 
                                                            className={`font-jakarta text-[11px] text-emerald-700 font-bold px-3 text-right ${printBg} print:text-emerald-800 print:font-black`}
                                                        >
                                                            {m.income > 0 ? '+' + Math.round(m.income).toLocaleString('en-IN') : '–'}
                                                        </TableCell>
                                                        <TableCell 
                                                            style={{ backgroundColor: 'transparent', borderRight: lightLine }} 
                                                            className={`font-jakarta text-[11px] text-red-700 font-bold px-3 text-right ${printBg} print:text-red-800 print:font-black print:border-r-2 print:border-slate-200`}
                                                        >
                                                            {m.expense > 0 ? '–' + Math.round(m.expense).toLocaleString('en-IN') : '–'}
                                                        </TableCell>
                                                    </Fragment>
                                                );
                                            })}
                                        </TableRow>
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                <div className="bg-[#5c3e7b] text-white p-3 flex justify-between items-center font-jakarta">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200">Final Consolidated Assets</span>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-purple-300 uppercase font-black">Opening Period Sum</span>
                            <span className="text-sm font-bold text-purple-100">{Math.round(reportData.dayWiseLiquidity[0]?.totalOpening || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-8 w-[1px] bg-purple-400/30 mx-2" />
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] text-purple-200 uppercase font-black tracking-widest">Grand Total Value</span>
                            <span className="text-2xl font-black text-white">₹{Math.round(reportData.liquid.total).toLocaleString('en-IN')}</span>
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
                        <Table className="font-jakarta">
                            <TableHeader className="sticky top-0 z-20 shadow-md">
                                <TableRow className="hover:bg-transparent border-none bg-slate-100 border-b-2 border-slate-300">
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-center px-3 border-r border-slate-200 min-w-[75px]">Date</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier Cash</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Supplier RTGS</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200">Gov Dist.</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-slate-800 uppercase text-right px-3 border-r border-slate-200 bg-slate-200/50">Total Payments</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-red-700 uppercase text-right px-3 border-r border-slate-200 print:hidden">Expenses</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-emerald-700 uppercase text-right px-3 border-r border-slate-200 print:hidden">Income</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-purple-700 uppercase text-right px-3 border-r border-slate-200 print:hidden">S/E Cash</TableHead>
                                    <TableHead className="text-[11px] font-black h-11 text-white bg-[#5c3e7b] uppercase text-right px-4 print:hidden">Net Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reportData.dayWise.map((d, i) => (
                                    <TableRow key={i} className="hover:bg-white border-b border-slate-100 transition-colors">
                                        <TableCell className="font-bold text-slate-700 py-3 text-[11px] whitespace-nowrap text-center border-r border-slate-100 font-jakarta">{d.date}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-code text-slate-600 border-r border-slate-100">{d.supplierCash > 0 ? d.supplierCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-code text-slate-600 border-r border-slate-100">{d.supplierRtgs > 0 ? d.supplierRtgs.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-code text-slate-600 border-r border-slate-100">{d.govDist > 0 ? d.govDist.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-code font-bold text-slate-900 border-r border-slate-100">{d.totalPayments > 0 ? d.totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-jakarta font-bold text-red-600 border-r border-slate-100 print:hidden">{d.expenses > 0 ? d.expenses.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-jakarta font-bold text-emerald-600 border-r border-slate-100 print:hidden">{d.incomes > 0 ? d.incomes.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[11px] font-jakarta font-bold text-purple-700 border-r border-slate-100 print:hidden">{d.seCash > 0 ? d.seCash.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</TableCell>
                                        <TableCell className="text-right py-3 text-[12px] font-code font-black text-slate-900 print:hidden">{d.netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                ))}
                                    <TableRow className="bg-[#5c3e7b] text-white hover:bg-purple-800 font-bold border-t-2 border-white/20">
                                        <TableCell className="font-black uppercase py-4 text-center text-[11px] px-3">Total Period Distribution</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] px-3">{formatCurrency(reportData.distribution.supplierCash).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] px-3">{formatCurrency(reportData.distribution.supplierRtgs).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] px-3">{formatCurrency(reportData.distribution.govDist).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code font-black text-[12px] border-x border-white/10 px-3">{formatCurrency(reportData.distribution.totalPayments).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] text-red-200 px-3 print:hidden">{formatCurrency(reportData.distribution.expenses).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] text-emerald-200 px-3 print:hidden">{formatCurrency(reportData.distribution.incomes).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code text-[11px] text-purple-200 px-3 print:hidden">{formatCurrency(reportData.distribution.seCash).replace('₹','')}</TableCell>
                                        <TableCell className="text-right py-4 font-code font-black text-[13px] bg-purple-900 border-l border-white/20 px-4 print:hidden">{formatCurrency(reportData.distribution.netTotalBalance)}</TableCell>
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
                    <Table className="font-jakarta">
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
                                        <TableCell className={`text-right py-3 px-4 font-code font-bold text-[11px] ${v.qty < 0 ? 'text-red-500' : 'text-slate-700'}`}>
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
                    <Table className="font-jakarta">
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

            {/* Section Z: Master Forensic Summary Dashboard */}
            {(() => {
                const pZone = reportData.audit360Zones.find(z => z.key === 'PURCHASE');
                const pRows = pZone?.rows || [];
                const sZone = reportData.audit360Zones.find(z => z.key === 'SALE');
                const adjZone = reportData.audit360Zones.find(z => z.key === 'ADJUSTMENT');
                const expZone = reportData.audit360Zones.find(z => z.key === 'EXPENSE');
                const incZone = reportData.audit360Zones.find(z => z.key === 'INCOME');
                
                const totals = {
                    labour: pRows.reduce((s, r) => s + (r.laboury || 0), 0),
                    kanta: pRows.reduce((s, r) => s + (r.kanta || 0), 0),
                    karta: pRows.reduce((s, r) => s + (r.kartaAmt || 0), 0),
                    expenses: expZone?.total || 0,
                    incomes: incZone?.total || 0
                };

                const StatBox = ({ label, val, sub, border, bg }: any) => (
                    <div className={`relative overflow-hidden ${bg} border-2 ${border} p-3 rounded-2xl shadow-sm transition-all hover:shadow-md group`}>
                        <div className="absolute top-0 right-0 p-1 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Activity size={40} />
                        </div>
                        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1">{label}</p>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{val}</p>
                        {sub && <p className="text-[7px] font-bold text-slate-500 mt-1 uppercase leading-none">{sub}</p>}
                    </div>
                );

                return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                        <StatBox label="Purchase Volume" val={`${(pZone?.stats?.qty || 0).toFixed(2)} QTL`} sub={`${pZone?.stats?.parchi} Active Parchis`} border="border-amber-100" bg="bg-amber-50/30" />
                        <StatBox label="Sales Volume" val={`${(sZone?.stats?.qty || 0).toFixed(2)} QTL`} sub="Market Distribution" border="border-emerald-100" bg="bg-emerald-50/30" />
                        <StatBox label="Audit Adjustments" val={formatCurrency(adjZone?.total || 0)} sub="Deduction Margins (IN)" border="border-rose-100" bg="bg-rose-50/30" />
                        <StatBox label="Operating Expense" val={formatCurrency(totals.expenses)} sub="Business Overhead" border="border-slate-200" bg="bg-slate-50" />
                        <StatBox label="Other Income" val={formatCurrency(totals.incomes)} sub="Indirect Revenue" border="border-indigo-100" bg="bg-indigo-50/30" />
                        <StatBox label="Operational Ops" val={`L:${Math.round(totals.labour/1000)}k | K:${Math.round(totals.kanta/1000)}k`} sub={`KARTA: ₹${Math.round(totals.karta).toLocaleString()}`} border="border-cyan-100" bg="bg-cyan-50/30" />
                    </div>
                );
            })()}

            {/* Section Z: Multi-Side-by-Side Parallel Ledger (Consolidated) */}
            <Card className="shadow-none border border-slate-200 bg-white overflow-hidden">
                <CardHeader className="bg-slate-900 border-b py-3 flex flex-row items-center justify-between text-white">
                    <div className="flex flex-col">
                        <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em]">Section Z: 360° Parallel Audit Ledger</CardTitle>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Purchase Consolidated Ledger (Independent Parallel Flows)</p>
                    </div>
                </CardHeader>
                
                <div className="overflow-auto border-x bg-white scrollbar-thin scrollbar-thumb-slate-200" style={{ maxHeight: '800px' }}>
                    <Table className="relative w-full border-collapse" style={{ minWidth: '2200px' }}>
                        <TableHeader className="sticky top-0 z-30">
                            {/* Main Zone Headings */}
                            <TableRow className="bg-slate-900 text-white border-none h-11">
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-amber-600/5 text-amber-500">I. Purchase Ledger</TableHead>
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-emerald-600/5 text-emerald-500">II. Sales Pipeline</TableHead>
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-rose-600/5 text-rose-500">III. Audit Deductions</TableHead>
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-slate-800/10 text-slate-400">IV. Op Expenses</TableHead>
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase border-r border-slate-800 bg-indigo-600/5 text-indigo-400">V. Other Incomes</TableHead>
                                <TableHead colSpan={2} className="text-center text-[10px] font-black uppercase bg-cyan-600/5 text-cyan-500">VI. Liquidity Flow</TableHead>
                            </TableRow>
                            {/* Sub-Headers */}
                            <TableRow className="bg-slate-50 border-b border-slate-200">
                                <TableHead className="w-[18%] text-[9px] font-bold border-r px-3">PARTICULAR</TableHead><TableHead className="w-24 text-right px-4 bg-amber-50/30">AMT</TableHead>
                                <TableHead className="w-[15%] text-[9px] font-bold border-r px-3">PARTICULAR</TableHead><TableHead className="w-24 text-right px-4 bg-emerald-50/30">AMT</TableHead>
                                <TableHead className="w-[15%] text-[9px] font-bold border-r px-3">PARTICULAR</TableHead><TableHead className="w-24 text-right px-4 bg-rose-50/30">AMT</TableHead>
                                <TableHead className="w-[15%] text-[9px] font-bold border-r px-3">PARTICULAR</TableHead><TableHead className="w-24 text-right px-4 bg-slate-100/30">AMT</TableHead>
                                <TableHead className="w-[15%] text-[9px] font-bold border-r px-3">PARTICULAR</TableHead><TableHead className="w-24 text-right px-4 bg-indigo-50/30">AMT</TableHead>
                                <TableHead className="w-[15%] text-[9px] font-bold border-r px-3">TRANSACTION</TableHead><TableHead className="w-24 text-right px-4 bg-cyan-50/30 border-r-0">VAL</TableHead>
                            </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                            {(() => {
                                const pRows = reportData.audit360Zones.find(z => z.key === 'PURCHASE')?.rows || [];
                                const sRows = reportData.audit360Zones.find(z => z.key === 'SALE')?.rows || [];
                                const aRows = reportData.audit360Zones.find(z => z.key === 'ADJUSTMENT')?.rows || [];
                                const eRows = reportData.audit360Zones.find(z => z.key === 'EXPENSE')?.rows || [];
                                const iRows = reportData.audit360Zones.find(z => z.key === 'INCOME')?.rows || [];
                                const cRows = reportData.audit360Zones.find(z => z.key === 'INTERNAL')?.rows || [];

                                const maxRows = Math.max(pRows.length, sRows.length, aRows.length, eRows.length, iRows.length, cRows.length);
                                
                                if (maxRows === 0) {
                                    return <TableRow><TableCell colSpan={12} className="h-40 text-center italic text-slate-400">No parallel data distributed.</TableCell></TableRow>;
                                }

                                return Array.from({ length: maxRows }).map((_, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/60 border-b border-slate-100 group transition-all duration-200">
                                        {/* 1. Purchase */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-amber-500/20">
                                            {pRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tighter">{pRows[idx].item}</span>
                                                        <span className="text-[8px] font-black text-amber-700 bg-amber-100/50 px-1 rounded-sm">{format(new Date(pRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                                                        <span className="text-[7.5px] font-bold text-slate-400">MD:{pRows[idx].details.split('|')[0]}</span>
                                                        <div className="h-1 w-1 rounded-full bg-slate-200" />
                                                        <span className="text-[7.5px] font-bold text-purple-600">L:{pRows[idx].laboury}</span>
                                                        <span className="text-[7.5px] font-bold text-rose-600">K:{pRows[idx].kanta}</span>
                                                        <span className="text-[7.5px] font-bold text-orange-600">KR:{pRows[idx].kartaAmt}</span>
                                                    </div>
                                                </div>
                                            ) : <div className="text-slate-100">-</div>}
                                        </TableCell>
                                        <TableCell className="bg-amber-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter">
                                            {pRows[idx] ? Math.round(pRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* 2. Sale */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-emerald-500/20">
                                            {sRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[120px]">{sRows[idx].item}</span>
                                                        <span className="text-[8px] font-bold text-emerald-600 tabular-nums">{format(new Date(sRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <span className="text-[7.5px] text-slate-400 font-bold uppercase truncate">{sRows[idx].details}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="bg-emerald-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter">
                                            {sRows[idx] ? Math.round(sRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* 3. Adjustment */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-rose-500/20">
                                            {aRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[9px] font-black text-rose-900 uppercase">{aRows[idx].item}</span>
                                                        <span className="text-[7.5px] font-bold text-rose-400 tabular-nums">{format(new Date(aRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <span className="text-[7.5px] text-slate-500 font-medium truncate">{aRows[idx].details}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="bg-rose-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-rose-950">
                                            {aRows[idx] ? Math.round(aRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* 4. Expense */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-slate-400/20">
                                            {eRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[9px] font-black text-slate-700 uppercase">{eRows[idx].item}</span>
                                                        <span className="text-[7.5px] font-bold text-slate-400 tabular-nums">{format(new Date(eRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <span className="text-[7.5px] text-slate-400 uppercase font-black">{eRows[idx].details}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="bg-slate-50 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-slate-600">
                                            {eRows[idx] ? Math.round(eRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* 5. Income */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-indigo-500/20">
                                            {iRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[9px] font-black text-indigo-900 uppercase">{iRows[idx].item}</span>
                                                        <span className="text-[7.5px] font-bold text-indigo-400 tabular-nums">{format(new Date(iRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <span className="text-[7.5px] text-slate-400 uppercase font-black">{iRows[idx].details}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="bg-indigo-50/20 text-right px-4 text-[11px] font-black border-r border-slate-200 font-mono tracking-tighter text-indigo-900">
                                            {iRows[idx] ? Math.round(iRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>

                                        {/* 6. Internal */}
                                        <TableCell className="border-r py-1.5 px-3 border-l-4 border-l-cyan-500/20">
                                            {cRows[idx] ? (
                                                <div className="flex flex-col">
                                                    <div className="flex justify-between items-center mb-0.5">
                                                        <span className="text-[8.5px] font-black text-cyan-900 uppercase">{cRows[idx].item}</span>
                                                        <span className="text-[7.5px] font-black text-cyan-300 tabular-nums">{format(new Date(cRows[idx].date), 'dd/MM')}</span>
                                                    </div>
                                                    <span className="text-[7.5px] text-slate-400 lowercase truncate max-w-[140px]">{cRows[idx].details}</span>
                                                </div>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="bg-cyan-50/10 text-right px-4 text-[11px] font-black font-mono tracking-tighter text-cyan-950">
                                            {cRows[idx] ? Math.round(cRows[idx].amount).toLocaleString() : ''}
                                        </TableCell>
                                    </TableRow>
                                ));
                            })()}
                            <TableRow className="!bg-slate-900 text-white font-bold sticky bottom-0 z-20">
                                <TableCell className="py-2 text-center text-[8px] uppercase tracking-widest border-r border-white/20">TOTAL PURCHASE</TableCell>
                                <TableCell className="text-right text-amber-400 text-[10px] border-r border-white/20 px-4">
                                    ₹{Math.round(reportData.audit360Zones.find(z=>z.key==='PROCUREMENT')?.total || 0).toLocaleString()}
                                </TableCell>

                                <TableCell className="py-2 text-center text-[8px] uppercase tracking-widest border-r border-white/20">TOTAL SETTLEMENTS</TableCell>
                                <TableCell className="text-right text-blue-300 text-[10px] border-r border-white/20 px-4">
                                    ₹{Math.round(reportData.audit360Zones.find(z=>z.key==='SETTLEMENTS')?.total || 0).toLocaleString()}
                                </TableCell>

                                <TableCell className="py-2 text-center text-[8px] uppercase tracking-widest border-r border-white/20">TOTAL REVENUE (REC)</TableCell>
                                <TableCell className="text-right text-emerald-400 text-[10px] border-r border-white/20 px-4">
                                    ₹{Math.round(reportData.audit360Zones.find(z=>z.key==='REVENUE')?.total || 0).toLocaleString()}
                                </TableCell>

                                <TableCell className="py-2 text-center text-[8px] uppercase tracking-widest border-r border-white/20">TOTAL CONTRA</TableCell>
                                <TableCell className="text-right text-slate-400 text-[10px] px-4">
                                    ₹{Math.round(reportData.audit360Zones.find(z=>z.key==='CONTRA')?.total || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
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

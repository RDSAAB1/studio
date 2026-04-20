"use client";

import React, { useState, useEffect } from 'react';
import { useGlobalData } from "@/contexts/global-data-context";
import { getLoansRealtime } from "@/lib/firestore";
import type { Loan } from "@/lib/definitions";
import * as XLSX from 'xlsx';
import { format, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from "@/components/ui/label";
import { printHtmlContent } from "@/lib/electron-print";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeftRight } from 'lucide-react';

// Modules
import { useReportCalculations } from './hooks/use-report-calculations';
import { generateReportHtml } from './utils/print-utils';
import { ReportHeader } from './components/report-header';
import { LiquidityAuditTable } from './components/liquidity-audit-table';
import { FinancialDistributionLedger } from './components/financial-distribution-ledger';
import { StockAvailabilityTable } from './components/stock-availability-table';
import { TransactionTrail } from './components/transaction-trail';
import { ParallelAuditLedger } from './components/parallel-audit-ledger';
import { NetResultSection } from './components/internal-cards';

export default function DailyBusinessReport() {
    const globalData = useGlobalData();
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loans, setLoans] = useState<Loan[]>([]);

    useEffect(() => {
        const unsubscribe = getLoansRealtime(setLoans, () => {});
        return () => unsubscribe();
    }, []);

    const reportData = useReportCalculations(startDate, endDate, globalData, loans);

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

        const dateRangeStr = isSameDay(startDate, endDate) 
            ? format(startDate, 'dd_MMM_yyyy') 
            : `${format(startDate, 'dd_MMM')}_to_${format(endDate, 'dd_MMM_yyyy')}`;
            
        XLSX.writeFile(workbook, `Business_Report_360_${dateRangeStr}.xlsx`);
    };

    const handlePrint = async () => {
        if (!reportData) return;
        try {
            const html = generateReportHtml(reportData, globalData, startDate, endDate);
            await printHtmlContent(html);
        } catch (err: any) {
            console.error("[Print Failed]:", err);
            alert("Report Printing Failed: " + (err?.message || String(err)));
        }
    };

    if (!reportData) return null;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            <ReportHeader 
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                handlePrint={handlePrint} handleExcelExport={handleExcelExport}
            />

            <LiquidityAuditTable reportData={reportData} globalData={globalData} />

            <div className="grid grid-cols-1 gap-6">
                <FinancialDistributionLedger reportData={reportData} startDate={startDate} endDate={endDate} />
                <StockAvailabilityTable reportData={reportData} />
            </div>

            <TransactionTrail reportData={reportData} />

            <ParallelAuditLedger reportData={reportData} />

            <NetResultSection reportData={reportData} />

            <Card className="shadow-lg border-2 border-slate-900 bg-slate-50/50 overflow-hidden">
                <CardHeader className="bg-[#5c3e7b] text-white py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <ArrowLeftRight size={18} className="text-purple-200" /> Final Financial Reconciliation Snapshot
                    </CardTitle>
                    <CardDescription className="text-purple-200 text-xs mt-1">Closing balances across all storage points</CardDescription>
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
                                {Array.from(reportData.liquid.bankBalances.entries()).map(([id, bal]: [string, any]) => {
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

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

import { useReportCalculations } from './hooks/use-report-calculations';
import { generateReportHtml } from './utils/print-utils';
import { ReportHeader } from './components/report-header';
import { LiquidityAuditTable } from './components/liquidity-audit-table';
import { FinancialDistributionLedger } from './components/financial-distribution-ledger';
import { ExecutiveOverviewDashboard } from './components/executive-overview-dashboard';
import { TransactionTrail, ViewMode } from './components/transaction-trail';
import { ParallelAuditLedger } from './components/parallel-audit-ledger';
import { NetResultSection } from './components/internal-cards';
import { VarietyBreakdownTable } from './components/variety-breakdown-table';
import { ProcessingOverlay } from '@/components/ui/processing-overlay';

export default function DailyBusinessReport() {
    const globalData = useGlobalData();
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loans, setLoans] = useState<Loan[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('DATE_WISE');

    useEffect(() => {
        const unsubscribe = getLoansRealtime(setLoans, () => {});
        return () => unsubscribe();
    }, []);

    const [isCalculating, setIsCalculating] = useState(false);
    const reportData = useReportCalculations(startDate, endDate, globalData, loans);

    // Trigger loading effect when dates change
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            setIsCalculating(false);
        }, 1000); // Slightly longer for the better UI to feel intentional
        return () => clearTimeout(timer);
    }, [startDate, endDate]);

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
            const html = generateReportHtml(reportData, globalData, startDate, endDate, viewMode);
            await printHtmlContent(html);
        } catch (err: any) {
            console.error("[Print Failed]:", err);
            alert("Report Printing Failed: " + (err?.message || String(err)));
        }
    };

    if (!reportData) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-bold animate-pulse">Initializing Data Engine...</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
            <ProcessingOverlay 
                show={isCalculating} 
                title="360° Audit Engine"
                description="Crunching forensic data & ledgers..."
            />
            <ReportHeader 
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                handlePrint={handlePrint} handleExcelExport={handleExcelExport}
                setIsCalculating={setIsCalculating}
            />

            <LiquidityAuditTable reportData={reportData} globalData={globalData} />

            <FinancialDistributionLedger reportData={reportData} startDate={startDate} endDate={endDate} />
            
            <VarietyBreakdownTable reportData={reportData} />


            <TransactionTrail reportData={reportData} viewMode={viewMode} setViewMode={setViewMode} />

            <ParallelAuditLedger reportData={reportData} />


        </div>
    );
}

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
import { useSearchParams, useRouter } from 'next/navigation';

import { useReportCalculations } from './hooks/use-report-calculations';
import { generateReportHtml } from './utils/print-utils';
import { ReportHeader } from './components/report-header';
import { LiquidityAuditTable } from './components/liquidity-audit-table';
import { FinancialDistributionLedger } from './components/financial-distribution-ledger';
import { ExecutiveOverviewDashboard } from './components/executive-overview-dashboard';
import { TransactionTrail, ViewMode } from './components/transaction-trail';
import { CashContraTrail } from './components/cash-contra-trail';
import { ParallelAuditLedger } from './components/parallel-audit-ledger';
import { NetResultSection } from './components/internal-cards';
import { VarietyBreakdownTable } from './components/variety-breakdown-table';
import { VarietySalesTable } from './components/variety-sales-table';
import { StockAvailabilityTable } from './components/stock-availability-table';
import { ProcessingOverlay } from '@/components/ui/processing-overlay';
import { AccountLedgerView } from './components/account-ledger-view';

export default function DailyBusinessReport() {
    const globalData = useGlobalData();
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [endDate, setEndDate] = useState<Date>(new Date());
    const [loans, setLoans] = useState<Loan[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('DATE_WISE');
    const [contraViewMode, setContraViewMode] = useState<ViewMode>('DATE_WISE');

    useEffect(() => {
        const unsubscribe = getLoansRealtime(setLoans, () => {});
        return () => unsubscribe();
    }, []);

    const [isCalculating, setIsCalculating] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<{ id: string, name: string, accountNumber?: string } | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const reportData = useReportCalculations(startDate, endDate, globalData, loans);

    // Auto-select account from URL (e.g., from Dashboard CD card)
    useEffect(() => {
        const accountId = searchParams.get('account');
        if (accountId === 'CD' && !selectedAccount) {
            setSelectedAccount({ id: 'CD', name: 'CD (Discounts)' });
            
            // Optional: Clean up URL after picking up the parameter
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('account');
            const newUrl = `${window.location.pathname}?${newParams.toString()}`;
            window.history.replaceState({}, '', newUrl);
        }
    }, [searchParams, selectedAccount]);

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

    if (selectedAccount) {
        return (
            <div className="p-6 w-full max-w-[98%] mx-auto space-y-6 animate-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl text-white shadow-xl">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedAccount(null)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <ArrowLeftRight className="rotate-180" />
                        </button>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                                {selectedAccount.name}
                                {selectedAccount.accountNumber && <span className="ml-3 text-indigo-400 font-mono text-sm opacity-80">[{selectedAccount.accountNumber}]</span>}
                            </h2>
                            <p className="text-slate-400 text-xs mt-1 font-bold">DETAILED TRANSACTION AUDIT LEDGER</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setSelectedAccount(null)}
                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-black transition-all border border-white/5"
                        >
                            RETURN TO DASHBOARD
                        </button>
                    </div>
                </div>

                <AccountLedgerView 
                    accountName={selectedAccount.name} 
                    accountNumber={selectedAccount.accountNumber}
                    ledgerData={reportData.accountLedgers[selectedAccount.id] || []} 
                    onBack={() => setSelectedAccount(null)}
                />
            </div>
        );
    }

    return (
        <div className="p-6 w-full max-w-[98%] mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
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

            <LiquidityAuditTable 
                reportData={reportData} 
                globalData={globalData} 
                onAccountSelect={setSelectedAccount}
            />

            <FinancialDistributionLedger reportData={reportData} startDate={startDate} endDate={endDate} />
            
            <StockAvailabilityTable reportData={reportData} />

            <VarietyBreakdownTable reportData={reportData} />

            <VarietySalesTable reportData={reportData} />


            <TransactionTrail reportData={reportData} viewMode={viewMode} setViewMode={setViewMode} />
            
            <CashContraTrail reportData={reportData} viewMode={contraViewMode} setViewMode={setContraViewMode} />

            <ParallelAuditLedger reportData={reportData} />


        </div>
    );
}

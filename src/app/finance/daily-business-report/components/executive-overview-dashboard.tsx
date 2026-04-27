import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Warehouse, Wallet, Building2, TrendingUp, TrendingDown, Layers, Activity } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ExecutiveOverviewProps {
    reportData: any;
    globalData: any;
}

export const ExecutiveOverviewDashboard: React.FC<ExecutiveOverviewProps> = ({ reportData, globalData }) => {
    // Totals Calculations
    const totalStock = reportData.varietyStock.reduce((sum: number, v: any) => sum + v.qty, 0);
    const bankTotal = Array.from(reportData.liquid.bankBalances.values()).reduce((sum: any, bal: any) => sum + Number(bal || 0), 0) as number;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. LIQUIDITY & FUNDS */}
            <Card className="shadow-lg border-2 border-slate-900 bg-white overflow-hidden lg:col-span-1">
                <CardHeader className="bg-slate-900 py-3 text-white border-b border-slate-800">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Wallet size={14} className="text-emerald-400" /> Fund Deployment Matrix
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        <div className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500 uppercase">Cash In Hand</span>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(reportData.liquid.cashInHand)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500 uppercase">Cash At Home</span>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(reportData.liquid.cashAtHome)}</span>
                        </div>
                        {Array.from(reportData.liquid.bankBalances.entries()).map(([id, bal]: [string, any]) => {
                            const acc = globalData.bankAccounts.find((a: any) => a.id === id);
                            if (!acc) return null;
                            return (
                                <div key={id} className="flex justify-between items-center p-3 hover:bg-slate-50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{acc.bankName}</span>
                                        <span className="text-[9px] font-mono text-slate-400">...{acc.accountNumber.slice(-4)}</span>
                                    </div>
                                    <span className="text-sm font-black text-blue-700">{formatCurrency(bal)}</span>
                                </div>
                            );
                        })}
                        <div className="bg-slate-100 p-3 flex justify-between items-center border-t-2 border-slate-200">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Net Liquidity</span>
                            <span className="text-lg font-black text-indigo-700">{formatCurrency(reportData.liquid.total)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. OPERATIONS & DISTRIBUTION TOTALS */}
            <Card className="shadow-lg border-2 border-slate-900 bg-white overflow-hidden lg:col-span-2">
                <CardHeader className="bg-slate-900 py-3 text-white border-b border-slate-800">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} className="text-blue-400" /> Operational & Ledger Totals (Period)
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
                        <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier Payments</span>
                            <span className="text-base font-black text-slate-900">{formatCurrency(reportData.distribution.totalPayments)}</span>
                            <span className="text-[9px] font-medium text-slate-400 mt-1">Cash: {formatCurrency(reportData.distribution.supplierCash)}</span>
                        </div>
                        <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><TrendingDown size={10} className="text-red-500"/> Expenses</span>
                            <span className="text-base font-black text-red-600">{formatCurrency(reportData.distribution.expenses)}</span>
                        </div>
                        <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><TrendingUp size={10} className="text-emerald-500"/> Incomes</span>
                            <span className="text-base font-black text-emerald-600">{formatCurrency(reportData.distribution.incomes)}</span>
                        </div>
                        <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col justify-between bg-slate-50/50">
                            <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Gov Distribution</span>
                            <span className="text-base font-black text-indigo-700">{formatCurrency(reportData.distribution.govDist)}</span>
                        </div>
                    </div>
                    
                    {/* INVENTORY SUB-SECTION */}
                    <div className="bg-slate-900 p-3 flex items-center justify-between mt-auto">
                         <div className="flex items-center gap-2">
                            <Warehouse size={14} className="text-slate-300" />
                            <span className="text-xs font-black text-white uppercase tracking-widest">Global Inventory Delta</span>
                         </div>
                         <div className="flex gap-4 items-center">
                            {reportData.varietyStock.map((v: any) => (
                                <div key={v.variety} className="flex flex-col text-right">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{v.variety}</span>
                                    <span className={`text-xs font-black font-mono ${v.qty < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{v.qty.toFixed(2)} QTL</span>
                                </div>
                            ))}
                            <div className="w-[1px] h-6 bg-slate-700 mx-2"></div>
                            <div className="flex flex-col text-right">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">Total Net QTL</span>
                                <span className="text-sm font-black font-mono text-white">{totalStock.toFixed(2)} QTL</span>
                            </div>
                         </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

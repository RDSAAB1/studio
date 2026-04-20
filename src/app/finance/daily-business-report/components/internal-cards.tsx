import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Warehouse } from 'lucide-react';
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function LiquidCard({ title, amount, icon, color, delta }: { title: string, amount: number, icon: any, color: 'blue' | 'emerald' | 'amber', delta?: number }) {
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

export function LiquidityRow({ label, sub, amount }: { label: string, sub?: string, amount: number }) {
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

export function FlowItem({ label, amount, secondary, bold }: { label: string, amount: number, secondary?: boolean, bold?: boolean }) {
    return (
        <div className={`flex justify-between items-center ${secondary ? 'text-slate-400 text-xs' : 'text-slate-700 font-medium'} ${bold ? 'font-black text-slate-900' : ''}`}>
            <span>{label}</span>
            <span className="font-mono">{formatCurrency(amount)}</span>
        </div>
    );
}

export function NetResultSection({ reportData }: { reportData: any }) {
    return (
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
                        <h2 className={`text-3xl font-black mt-1 text-slate-900`}>
                            {reportData.result.stockDelta > 0 ? '+' : ''}{reportData.result.stockDelta.toFixed(2)} QTL
                        </h2>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                         <Warehouse size={32} className="text-slate-400" />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

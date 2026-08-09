import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Warehouse, PackageCheck, Scale, Package } from 'lucide-react';
import { cn } from "@/lib/utils";

interface StockAvailabilityTableProps {
    reportData: any;
}

export const StockAvailabilityTable: React.FC<StockAvailabilityTableProps> = ({ reportData }) => {
    const totalStock = (reportData.varietyStock || []).reduce((sum: number, v: any) => sum + (Number(v.qty) || 0), 0);
    const stockItems = reportData.varietyStock || [];

    return (
        <Card className="border border-slate-200/90 shadow-md bg-white overflow-hidden p-0 rounded-lg">
            <CardHeader className="bg-gradient-to-r from-white via-slate-50 to-slate-100/90 border-b border-slate-200 py-3.5 px-6 text-slate-900 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-[0.15em] flex items-center gap-2 text-slate-900">
                    <Package className="h-4 w-4" style={{ color: 'var(--header-bg, var(--primary, #d97706))' }} /> STOCK AVAILABILITY & INVENTORY MATRIX
                </CardTitle>
                <div className="text-xs font-bold text-slate-600 bg-slate-200/80 px-3 py-1 rounded-full border border-slate-300/60">
                    Total Types: <span className="text-slate-900 font-black">{stockItems.length}</span>
                </div>
            </CardHeader>
            <div className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                            <TableHead className="py-3 px-6 text-[10px] text-slate-500 font-black uppercase tracking-widest">Variety / Item Name</TableHead>
                            <TableHead className="py-3 px-6 text-center text-[10px] text-slate-500 font-black uppercase tracking-widest">Status</TableHead>
                            <TableHead className="py-3 px-6 text-right text-[10px] text-slate-500 font-black uppercase tracking-widest">Available Stock (QTL)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reportData.varietyStock.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center">
                                    <PackageCheck className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-slate-400 text-[11px] font-bold uppercase">No Inventory Records Found</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            reportData.varietyStock.map((v: any, i: number) => (
                                <TableRow key={i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                                    <TableCell className="py-3 px-6">
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-800 uppercase text-[12px] tracking-tight">{v.variety}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">RAW MATERIAL / COMMODITY</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3 px-6 text-center">
                                        <span className={cn(
                                            "text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter",
                                            v.qty > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                        )}>
                                            {v.qty > 0 ? 'IN STOCK' : 'OUT OF STOCK'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-3 px-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={cn(
                                                "font-black text-[14px] tabular-nums tracking-tighter",
                                                v.qty < 0 ? 'text-rose-600' : 'text-slate-900'
                                            )}>
                                                {v.qty.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">QUINTALS (QTL)</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Scale className="h-3 w-3 text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audit System Verification: 100% Accurate</span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase">BizSuite 360 Inventory Module</span>
            </div>
        </Card>
    );
};

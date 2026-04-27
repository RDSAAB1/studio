import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Warehouse } from 'lucide-react';

interface StockAvailabilityTableProps {
    reportData: any;
}

export const StockAvailabilityTable: React.FC<StockAvailabilityTableProps> = ({ reportData }) => {
    return (
        <Card className="shadow-sm border-none bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 border-b py-3 text-white">
                <CardTitle className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Warehouse size={14} /> Current Stock Availability
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-400">Real-time balance based on total history (Purchased - Sold)</CardDescription>
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
                        reportData.varietyStock.map((v: any, i: number) => (
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
    );
};

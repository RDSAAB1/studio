import React from 'react';
import { BarChart3, Printer, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

interface ReportHeaderProps {
    startDate: Date;
    setStartDate: (date: Date) => void;
    endDate: Date;
    setEndDate: (date: Date) => void;
    handlePrint: () => void;
    handleExcelExport: () => void;
}

export const ReportHeader: React.FC<ReportHeaderProps> = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    handlePrint,
    handleExcelExport
}) => {
    return (
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
    );
};

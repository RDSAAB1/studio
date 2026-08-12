"use client";
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
    setIsCalculating: (val: boolean) => void;
}


export const ReportHeader: React.FC<ReportHeaderProps> = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    handlePrint,
    handleExcelExport,
    setIsCalculating
}) => {
    const onDateChange = (date: Date, setter: (d: Date) => void) => {
        setIsCalculating(true);
        setTimeout(() => {
            setter(date);
        }, 10);
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <BarChart3 className="text-slate-800" /> 360° Business Report
                </h1>
                <p className="text-xs text-slate-600 font-black uppercase tracking-widest px-1">Executive Command Center</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div 
                    className="flex items-center gap-2 p-1.5 rounded-lg shadow-sm"
                    style={{
                        backgroundColor: "var(--toggle-container-bg, #1e293b)",
                    }}
                >
                    <div className="flex items-center gap-2 px-2">
                        <span 
                            className="text-[10px] font-black uppercase tracking-tighter"
                            style={{ color: "var(--toggle-label-text, #cbd5e1)" }}
                        >
                            From:
                        </span>
                        <SmartDatePicker 
                            value={startDate} 
                            onChange={(d) => onDateChange(d as Date, setStartDate)} 
                            returnDate 
                            className="w-[160px] border-none bg-transparent h-8 text-sm font-bold" 
                            style={{ color: "var(--toggle-label-text, #cbd5e1)" }}
                        />
                    </div>
                    <div className="w-[1px] h-4" style={{ backgroundColor: "var(--toggle-label-text, #cbd5e1)", opacity: 0.3 }} />
                    <div className="flex items-center gap-2 px-2">
                        <span 
                            className="text-[10px] font-black uppercase tracking-tighter"
                            style={{ color: "var(--toggle-label-text, #cbd5e1)" }}
                        >
                            To:
                        </span>
                        <SmartDatePicker 
                            value={endDate} 
                            onChange={(d) => onDateChange(d as Date, setEndDate)} 
                            returnDate 
                            className="w-[160px] border-none bg-transparent h-8 text-sm font-bold" 
                            style={{ color: "var(--toggle-label-text, #cbd5e1)" }}
                        />
                    </div>
                </div>
                
                <Button onClick={handlePrint} size="sm" className="flex items-center gap-2 h-10 px-4 rounded-xl btn-command-print font-black shadow-sm">
                    <Printer size={16} /> Print
                </Button>
                <Button onClick={handleExcelExport} size="sm" className="flex items-center gap-2 h-10 px-4 rounded-xl btn-command-export font-black shadow-sm">
                    <FileSpreadsheet size={16} /> Download Excel
                </Button>
            </div>
        </div>
    );
};


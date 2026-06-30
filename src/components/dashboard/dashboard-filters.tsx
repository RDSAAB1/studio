import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import type { DateRange } from 'react-day-picker';

type DashboardFiltersProps = {
    date: DateRange | undefined;
    setDate: (range: DateRange | undefined) => void;
    selectedVariety: string;
    setSelectedVariety: (variety: string) => void;
    uniqueVarieties: string[];
};

export const DashboardFilters = ({ 
    date, 
    setDate,
    selectedVariety,
    setSelectedVariety,
    uniqueVarieties
}: DashboardFiltersProps) => (
    <Card className="shadow-none border sm:shadow-sm">
        <CardHeader className="p-3 sm:p-6 pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-xl">Dashboard</CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">Filter and view your business overview.</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <DateRangePicker date={date} onDateChange={setDate} />
                <div className="flex items-center space-x-2 bg-white border border-slate-300 rounded-md px-2.5 h-8 shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-600">Variety:</span>
                    <select
                        value={selectedVariety}
                        onChange={(e) => setSelectedVariety(e.target.value)}
                        className="text-xs bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                    >
                        <option value="All">All Varieties</option>
                        {uniqueVarieties.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <Button variant="outline" className="h-8 text-[11px] px-2.5" size="sm" onClick={() => setDate({ from: new Date(), to: new Date() })}>Today</Button>
                <Button variant="outline" className="h-8 text-[11px] px-2.5" size="sm" onClick={() => setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}>This Week</Button>
                <Button variant="outline" className="h-8 text-[11px] px-2.5" size="sm" onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                <Button variant="outline" className="h-8 text-[11px] px-2.5" size="sm" onClick={() => setDate({ from: subDays(new Date(), 30), to: new Date() })}>Last 30 Days</Button>
                <Button variant="outline" className="h-8 text-[11px] px-2.5" size="sm" onClick={() => setDate({ from: startOfYear(new Date()), to: endOfYear(new Date()) })}>This Year</Button>
            </div>
        </CardContent>
    </Card>
);

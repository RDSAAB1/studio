import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { LayoutDashboard, Calendar, Filter, Sparkles } from 'lucide-react';

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
    <Card className="border border-slate-200/90 rounded-2xl bg-white shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Header Title Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div 
                        className="p-2.5 rounded-xl shadow-xs transition-colors shrink-0"
                        style={{
                            backgroundColor: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))',
                            color: 'var(--header-text-color, #ffffff)'
                        }}
                    >
                        <LayoutDashboard className="w-5 h-5 stroke-[2.5]" style={{ color: 'var(--header-text-color, #ffffff)' }} />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>Business Dashboard Overview</span>
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold">Filter transactions, sales & financial analytics across custom time ranges</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold self-start sm:self-center">
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }} />
                    <span>Real-time Analytics</span>
                </div>
            </div>

            {/* Controls Bar: Date Range Picker + Variety Dropdown + Preset Quick Filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
                {/* Left: Date Range & Variety Controls */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }} />
                        <DateRangePicker date={date} onDateChange={setDate} />
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs hover:border-amber-400 transition-colors">
                        <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--header-bg, var(--header-active-bg, var(--primary-bg-custom, hsl(var(--primary)))))' }} />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">Variety:</span>
                        <select
                            value={selectedVariety}
                            onChange={(e) => setSelectedVariety(e.target.value)}
                            className="text-xs bg-transparent font-black text-slate-900 outline-none cursor-pointer pr-6 appearance-none border-none py-0.5"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0 center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.25em 1.25em` }}
                        >
                            <option value="All">All Varieties</option>
                            {uniqueVarieties.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right: Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDate({ from: new Date(), to: new Date() })}
                        className="h-8 text-xs font-extrabold px-3 rounded-xl border-slate-200 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-950 transition-all"
                    >
                        Today
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}
                        className="h-8 text-xs font-extrabold px-3 rounded-xl border-slate-200 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-950 transition-all"
                    >
                        This Week
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}
                        className="h-8 text-xs font-extrabold px-3 rounded-xl border-slate-200 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-950 transition-all"
                    >
                        This Month
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDate({ from: subDays(new Date(), 30), to: new Date() })}
                        className="h-8 text-xs font-extrabold px-3 rounded-xl border-slate-200 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-950 transition-all"
                    >
                        Last 30 Days
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDate({ from: startOfYear(new Date()), to: endOfYear(new Date()) })}
                        className="h-8 text-xs font-extrabold px-3 rounded-xl border-slate-200 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-950 transition-all"
                    >
                        This Year
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>
);

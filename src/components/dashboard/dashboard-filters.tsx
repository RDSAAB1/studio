import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { LayoutDashboard, Calendar, Filter, Sparkles } from 'lucide-react';

type DashboardFiltersProps = {
    date: DateRange | undefined;
    setDate: (range: DateRange | undefined) => void;
    selectedVariety: string;
    setSelectedVariety: (variety: string) => void;
    uniqueVarieties: string[];
    activePreset?: string;
    setActivePreset?: (preset: string) => void;
};

export const DashboardFilters = ({ 
    date, 
    setDate,
    selectedVariety,
    setSelectedVariety,
    uniqueVarieties,
    activePreset,
    setActivePreset
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

                    <div 
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 shadow-sm"
                        style={{
                            backgroundColor: "var(--toggle-container-bg, #1e293b)",
                        }}
                    >
                        <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--toggle-label-text, #cbd5e1)" }} />
                        <span 
                            className="text-xs font-black uppercase tracking-wider shrink-0"
                            style={{ color: "var(--toggle-label-text, #cbd5e1)" }}
                        >
                            Variety:
                        </span>
                        <CustomDropdown
                            options={[
                                { value: "All", label: "All Varieties" },
                                ...uniqueVarieties.map(v => ({ value: v, label: v }))
                            ]}
                            value={selectedVariety}
                            onChange={(val) => setSelectedVariety(val || "All")}
                            className="w-36 text-xs font-black"
                        />
                    </div>
                </div>

                {/* Right: Quick Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <style>{`
                        .preset-btn-themed {
                            transition: all 0.2s ease-in-out;
                        }
                        .preset-btn-themed:hover {
                            background-color: var(--settings-subnav-hover-bg, rgba(251, 152, 14, 0.3)) !important;
                            color: var(--settings-subnav-text, #db8b0a) !important;
                            border-color: var(--settings-subnav-active-bg, #db8b0a) !important;
                        }
                    `}</style>
                    <Button 
                        variant={activePreset === 'today' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: new Date(), to: new Date() });
                            setActivePreset?.('today');
                        }}
                        style={activePreset === 'today' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        Today
                    </Button>
                    <Button 
                        variant={activePreset === 'week' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) });
                            setActivePreset?.('week');
                        }}
                        style={activePreset === 'week' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        This Week
                    </Button>
                    <Button 
                        variant={activePreset === 'month' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
                            setActivePreset?.('month');
                        }}
                        style={activePreset === 'month' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        This Month
                    </Button>
                    <Button 
                        variant={activePreset === '30' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: subDays(new Date(), 30), to: new Date() });
                            setActivePreset?.('30');
                        }}
                        style={activePreset === '30' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        Last 30 Days
                    </Button>
                    <Button 
                        variant={activePreset === 'year' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: startOfYear(new Date()), to: endOfYear(new Date()) });
                            setActivePreset?.('year');
                        }}
                        style={activePreset === 'year' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        This Year
                    </Button>
                    <Button 
                        variant={activePreset === '365' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => {
                            setDate({ from: subDays(new Date(), 365), to: new Date() });
                            setActivePreset?.('365');
                        }}
                        style={activePreset === '365' ? {
                            backgroundColor: "var(--settings-subnav-active-bg, #db8b0a)",
                            color: "var(--settings-subnav-active-text, #ffffff)",
                            borderColor: "transparent"
                        } : undefined}
                        className="preset-btn-themed h-8 text-xs font-extrabold px-3 rounded-lg border-0 transition-all"
                    >
                        Last 365 Days
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>
);

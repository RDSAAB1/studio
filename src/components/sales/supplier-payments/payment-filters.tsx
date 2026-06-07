"use client";

import { Search, Filter, Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { cn, toTitleCase, formatCurrency } from "@/lib/utils";
import type { CustomDropdownOption } from "@/components/ui/custom-dropdown";

interface PaymentFiltersProps {
  // Search
  searchType: 'name' | 'fatherName' | 'address' | 'contact';
  onSearchTypeChange: (value: 'name' | 'fatherName' | 'address' | 'contact') => void;
  supplierOptions: CustomDropdownOption[];
  selectedSupplierKey: string | null;
  onSupplierSelect: (key: string | null) => void;
  serialNoSearch: string;
  onSerialNoSearch: (value: string) => void;
  onSerialNoBlur: () => void;
  
  // Filters
  filterStartDate?: Date;
  filterEndDate?: Date;
  filterVariety: string;
  varietyOptions: string[];
  hasActiveFilters: boolean;
  onFilterStartDateChange: (date: Date | undefined) => void;
  onFilterEndDateChange: (date: Date | undefined) => void;
  onFilterVarietyChange: (value: string) => void;
  onClearFilters: () => void;
  extraActions?: ReactNode;
  type?: 'supplier' | 'customer' | 'outsider';
  summary?: any;
  allTransactions?: any[];
}

export function PaymentFilters({
  searchType,
  onSearchTypeChange,
  supplierOptions,
  selectedSupplierKey,
  onSupplierSelect,
  serialNoSearch,
  onSerialNoSearch,
  onSerialNoBlur,
  filterStartDate,
  filterEndDate,
  filterVariety,
  varietyOptions,
  hasActiveFilters,
  onFilterStartDateChange,
  onFilterEndDateChange,
  onFilterVarietyChange,
  onClearFilters,
  extraActions,
  type = 'supplier',
  summary,
  allTransactions = []
}: PaymentFiltersProps) {
  // Arrow-key navigation helpers
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const currentIndex = selectedSupplierKey
    ? supplierOptions.findIndex((o) => o.value === selectedSupplierKey)
    : -1;
  const totalCount = supplierOptions.length;

  const navigateSupplier = useCallback(
    (direction: 'prev' | 'next') => {
      if (totalCount === 0) return;
      let nextIdx: number;
      if (currentIndex === -1) {
        nextIdx = direction === 'next' ? 0 : totalCount - 1;
      } else {
        nextIdx =
          direction === 'next'
            ? (currentIndex + 1) % totalCount
            : (currentIndex - 1 + totalCount) % totalCount;
      }
      const next = supplierOptions[nextIdx];
      if (next) onSupplierSelect(next.value);
    },
    [currentIndex, totalCount, supplierOptions, onSupplierSelect]
  );

  // Local arrow-key handler (only when no input/textarea is focused)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateSupplier('next'); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); navigateSupplier('prev'); }
    },
    [navigateSupplier]
  );

  return (
    <div className="flex flex-col gap-1.5" ref={supplierDropdownRef} onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Top Row: Date range filters, variety dropdown, and Statement/Summary actions (with increased widths) */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Start Date */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Start:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-6 text-[9px] px-2 py-0 border border-slate-200 bg-white font-bold text-slate-900 rounded-md shadow-none w-[90px] text-left justify-start hover:bg-white hover:text-slate-900">
                  {filterStartDate ? format(filterStartDate, "dd-MM-yy") : <span className="text-slate-400">dd-mm-yy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[60]" align="start">
                <Calendar mode="single" selected={filterStartDate} onSelect={onFilterStartDateChange} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">End:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-6 text-[9px] px-2 py-0 border border-slate-200 bg-white font-bold text-slate-900 rounded-md shadow-none w-[90px] text-left justify-start hover:bg-white hover:text-slate-900">
                  {filterEndDate ? format(filterEndDate, "dd-MM-yy") : <span className="text-slate-400">dd-mm-yy</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[60]" align="start">
                <Calendar mode="single" selected={filterEndDate} onSelect={onFilterEndDateChange} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Variety */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Variety:</span>
            <div className="w-[110px]">
              <Select value={filterVariety} onValueChange={onFilterVarietyChange}>
                <SelectTrigger className="h-6 text-[9.5px] border-slate-200 bg-white font-bold text-slate-900 shadow-none py-0 px-2">
                  <SelectValue placeholder="All varieties" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  <SelectItem value="all">ALL VARIETIES</SelectItem>
                  {varietyOptions.map((v) => (<SelectItem key={v} value={v}>{v.toUpperCase()}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-6 text-[9.5px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2" onClick={onClearFilters}>
              Reset
            </Button>
          )}
        </div>

        {/* Statement / Summary buttons moved here */}
        {extraActions && (
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            {extraActions}
          </div>
        )}
      </div>

      {/* Bottom Row: Supplier Select (Fixed Width) + Name/Search Type Select + SR# Search + Navigation */}
      <div className="min-w-0 flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-md p-1 shadow-sm">
        {/* Supplier Dropdown - Fixed Width */}
        <div className="w-[380px] flex-shrink-0">
          <CustomDropdown
            options={supplierOptions.map(({ value, data, label }) => {
              if (label) {
                return { value, label, data: data || {} };
              }
              return {
                value,
                label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim(),
                data: data || {}
              };
            })}
            value={selectedSupplierKey}
            onChange={onSupplierSelect}
            placeholder="Search supplier..."
            inputClassName="h-6 rounded-md border-none bg-transparent text-[10px] font-black text-slate-900 focus:ring-0 py-0 px-1 transition-all shadow-none"
            searchType={searchType}
            onSearchTypeChange={undefined}
          />
        </div>

        {/* Name / Search Type Select */}
        <div className="w-[82px] flex-shrink-0">
          <Select value={searchType} onValueChange={(value) => onSearchTypeChange(value as typeof searchType)}>
            <SelectTrigger className="h-6 rounded-md text-[9px] border-none bg-white font-bold text-slate-900 focus:ring-1 focus:ring-primary/20 py-0 px-2 shadow-none">
              <SelectValue placeholder="Name" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="fatherName">Father</SelectItem>
              <SelectItem value="address">Address</SelectItem>
              <SelectItem value="contact">Contact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Serial No. Search */}
        <div className="w-[130px] flex-shrink-0">
          <div className="relative group">
            <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-2.5 w-2.5 text-slate-400" />
            <Input
              placeholder="Receipt No."
              value={serialNoSearch}
              onChange={(e) => onSerialNoSearch(e.target.value)}
              onBlur={onSerialNoBlur}
              className="pl-4.5 h-6 rounded-md border-none bg-white text-[9px] font-bold text-slate-900 focus:ring-1 focus:ring-primary/20 py-0 shadow-none"
            />
          </div>
        </div>

        {/* Arrow navigation buttons + position counter */}
        <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => navigateSupplier('prev')}
            disabled={totalCount === 0}
            title={`Previous ${type === 'customer' ? 'customer' : 'supplier'} (←)`}
            className="h-6 w-5 flex items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white/80 text-slate-600 hover:bg-violet-50 hover:text-primary hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => navigateSupplier('next')}
            disabled={totalCount === 0}
            title={`Next ${type === 'customer' ? 'customer' : 'supplier'} (→)`}
            className="h-6 w-5 flex items-center justify-center rounded-r-md border border-slate-200 bg-white/80 text-slate-600 hover:bg-violet-50 hover:text-primary hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
          <span
            className={cn(
              "ml-0.5 h-6 min-w-[36px] flex items-center justify-center rounded-md border text-[9px] font-bold tabular-nums px-1.5 transition-all shadow-sm",
              currentIndex >= 0
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-white/80 border-slate-200 text-slate-500"
            )}
            title={currentIndex >= 0 ? `Supplier ${currentIndex + 1} of ${totalCount}` : `${totalCount} suppliers`}
          >
            {currentIndex >= 0 ? `${currentIndex + 1}/${totalCount}` : `0/${totalCount}`}
          </span>
        </div>
      </div>

      {/* Summary Stats Grid (Comprehensive Overview) */}
      {summary && selectedSupplierKey && (
        <div className="flex flex-col gap-2 px-1 py-1 bg-slate-50/50 rounded-lg border border-slate-200/60 mt-0.5">
          {/* Detailed Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {/* Box 1: PAYMENT STATUS & LEDGER */}
            <div className="bg-white border border-slate-200 rounded-md p-2 shadow-sm flex flex-col gap-1">
              <h4 className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter border-b pb-0.5">PAYMENT STATUS & LEDGER</h4>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-500 font-medium">Total Paid</span>
                <span className="text-emerald-700">{formatCurrency(summary.totalPaid || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-slate-500 font-medium">Outstanding</span>
                <span className={cn("font-black", (summary.totalOutstanding || 0) <= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {formatCurrency(summary.totalOutstanding || 0)}
                </span>
              </div>
            </div>

            {/* Box 2: PAYMENT MODES & CD */}
            <div className="bg-white border border-slate-200 rounded-md p-2 shadow-sm flex flex-col gap-1">
              <h4 className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter border-b pb-0.5">PAYMENT MODES & CD</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-slate-500 font-medium">Cash</span>
                  <span className="text-slate-900">{formatCurrency(summary.totalCashPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-slate-500 font-medium">RTGS</span>
                  <span className="text-slate-900">{formatCurrency(summary.totalRtgsPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-slate-500 font-medium">Gov</span>
                  <span className="text-slate-900">{formatCurrency(summary.govPaid || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-bold">
                  <span className="text-slate-500 font-medium">CD</span>
                  <span className="text-rose-600">{formatCurrency(summary.totalCdAmount || summary.totalCd || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

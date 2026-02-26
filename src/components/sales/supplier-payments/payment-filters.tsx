"use client";

import { Search, Filter, Calendar as CalendarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomDropdown } from "@/components/ui/custom-dropdown";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/utils";
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
}: PaymentFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-6 w-6 border transition-colors flex-shrink-0",
                  hasActiveFilters 
                    ? "border-slate-200/80 bg-white text-slate-900 shadow-[0_4px_20px_rgba(99,102,241,0.06)] ring-1 ring-violet-200/60" 
                    : "border-slate-200/80 bg-white/70 text-slate-700 hover:bg-white hover:border-slate-300"
                )}
                title="Filter suppliers"
              >
                <Filter className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-2.5 text-[10px] z-50 border border-slate-200 bg-white/90 shadow-[0_4px_20px_rgba(99,102,241,0.06)] backdrop-blur-[20px]" align="end">
              <div className="space-y-1.5">
                <Label htmlFor="filterStartDate" className="text-[10px] font-semibold">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="filterStartDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-7 text-[10px] border border-slate-200/80 bg-white/70",
                        !filterStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {filterStartDate ? format(filterStartDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filterStartDate}
                      onSelect={onFilterStartDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filterEndDate" className="text-[10px] font-semibold">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="filterEndDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-7 text-[10px] border border-slate-200/80 bg-white/70",
                        !filterEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {filterEndDate ? format(filterEndDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filterEndDate}
                      onSelect={onFilterEndDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="filterVariety" className="text-[10px] font-semibold">Variety</Label>
                <Select
                  value={filterVariety}
                  onValueChange={onFilterVarietyChange}
                >
                  <SelectTrigger id="filterVariety" className="h-7 text-[10px] border border-slate-200/80 bg-white/70">
                    <SelectValue placeholder="All varieties" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="all">All varieties</SelectItem>
                    {varietyOptions.map((variety) => (
                      <SelectItem key={variety} value={variety}>
                        {variety}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] font-semibold hover:bg-violet-50 hover:text-slate-900"
                  onClick={onClearFilters}
                >
                  Reset
                </Button>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Filters apply instantly
                </span>
              </div>
            </PopoverContent>
          </Popover>

          <div className="w-full lg:w-[120px] flex-shrink-0">
            <Select value={searchType} onValueChange={(value) => onSearchTypeChange(value as typeof searchType)}>
              <SelectTrigger className="h-6 text-[9px] border border-slate-200/80 bg-white/70 backdrop-blur-[20px] font-semibold text-slate-900 focus:border-slate-300 focus:ring-2 focus:ring-violet-500/15">
                <SelectValue placeholder="Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="fatherName">Father Name</SelectItem>
                <SelectItem value="address">Address</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-[180px] flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-slate-500" />
              <Input
                placeholder="Serial No..."
                value={serialNoSearch}
                onChange={(e) => onSerialNoSearch(e.target.value)}
                onBlur={onSerialNoBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSerialNoBlur();
                    e.currentTarget.blur();
                  }
                }}
                className="pl-7 h-6 border border-slate-200/80 bg-white/70 backdrop-blur-[20px] text-[9px] font-semibold text-slate-900 focus:border-slate-300 focus:ring-2 focus:ring-violet-500/15"
              />
            </div>
          </div>

          {extraActions ? (
            <div className="w-full lg:w-auto flex items-center justify-end">
              {extraActions}
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
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
            inputClassName="h-6 border border-slate-200/80 bg-white/70 backdrop-blur-[20px] text-[9px] font-semibold text-slate-900 focus:border-slate-300 focus:ring-2 focus:ring-violet-500/15"
            searchType={searchType}
            onSearchTypeChange={undefined}
          />
        </div>
      </div>
    </div>
  );
}


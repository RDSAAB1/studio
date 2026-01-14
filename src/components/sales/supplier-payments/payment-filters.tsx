"use client";

import { Search, Filter, Calendar as CalendarIcon } from "lucide-react";
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
  
  // Actions
  onClearPaymentForm: () => void;
  onProcessPayment: () => void;
  isProcessing: boolean;
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
  onClearPaymentForm,
  onProcessPayment,
  isProcessing,
}: PaymentFiltersProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Single Row: All elements in one row */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
        {/* Name Dropdown (Search Type) */}
        <div className="w-full lg:w-[120px] flex-shrink-0">
          <Select value={searchType} onValueChange={(value) => onSearchTypeChange(value as typeof searchType)}>
            <SelectTrigger className="h-8 text-[11px] border-2 border-primary/20 focus:border-primary font-semibold">
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
        
        {/* Search Supplier Input */}
        <div className="flex-1 min-w-0">
          <CustomDropdown
            options={supplierOptions.map(({ value, data, label }) => {
              // If label already exists (e.g., for Mill Overview), use it but still pass data
              if (label) {
                return { value, label, data: data || {} };
              }
              // Otherwise, create label from data
              return {
                value,
                label: `${toTitleCase(data.name || '')} | F:${toTitleCase(data.fatherName || data.so || '')} | ${toTitleCase(data.address || '')} | ${data.contact || ''}`.trim(),
                data: data || {}
              };
            })}
            value={selectedSupplierKey}
            onChange={onSupplierSelect}
            placeholder="Search supplier..."
            inputClassName="h-8 border-2 border-primary/20 focus:border-primary text-[11px] font-semibold"
            searchType={searchType}
            onSearchTypeChange={undefined}
          />
        </div>
        
        {/* Serial Number Search */}
        <div className="w-full lg:w-[180px] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary/70" />
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
              className="pl-8 h-8 border-2 border-primary/20 focus:border-primary text-[11px] font-semibold"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-8 w-8 border-2 transition-all",
                  hasActiveFilters 
                    ? "text-primary border-primary bg-primary/10 shadow-md" 
                    : "border-primary/20 hover:border-primary/30 hover:bg-primary/5"
                )}
                title="Filter suppliers"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3 text-[11px] z-50 border-2 border-primary/20 shadow-xl" align="end">
              <div className="space-y-1.5">
                <Label htmlFor="filterStartDate" className="text-[11px] font-semibold">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="filterStartDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-[11px] border-2 border-primary/20 focus:border-primary",
                        !filterStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
                <Label htmlFor="filterEndDate" className="text-[11px] font-semibold">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="filterEndDate"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 text-[11px] border-2 border-primary/20 focus:border-primary",
                        !filterEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
                <Label htmlFor="filterVariety" className="text-[11px] font-semibold">Variety</Label>
                <Select
                  value={filterVariety}
                  onValueChange={onFilterVarietyChange}
                >
                  <SelectTrigger id="filterVariety" className="h-8 text-[11px] border-2 border-primary/20 focus:border-primary">
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
              <div className="flex items-center justify-between pt-1 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] font-semibold hover:bg-primary/10 hover:text-primary"
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
          <Button 
            size="sm" 
            className="h-8 text-[11px] font-semibold border-2 border-primary/20 hover:border-primary/30 hover:bg-primary/5" 
            variant="outline" 
            onClick={onClearPaymentForm} 
            disabled={isProcessing}
          >
            Clear
          </Button>
          <Button 
            size="sm" 
            className="h-8 text-[11px] font-bold bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg" 
            onClick={onProcessPayment} 
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Finalize"}
          </Button>
        </div>
      </div>
    </div>
  );
}


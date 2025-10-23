"use client";

import React from 'react';
import { format, startOfYear, endOfYear, subDays } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Input } from '@/components/ui/input';
import { Users, Calendar as CalendarIcon, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { formatSerialNumber, parseSerialNumber } from '../utils/fuzzy-matching';

interface SupplierProfileHeaderProps {
  startDate?: Date;
  endDate?: Date;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  selectedSupplierKey: string | null;
  setSelectedSupplierKey: (key: string | null) => void;
  filteredSupplierOptions: Array<{ value: string; label: string; data: any }>;
  suppliers: any[];
}

export const SupplierProfileHeader: React.FC<SupplierProfileHeaderProps> = ({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  selectedSupplierKey,
  setSelectedSupplierKey,
  filteredSupplierOptions,
  suppliers,
}) => {
  const { toast } = useToast();
  const [serialSearch, setSerialSearch] = React.useState('');

  // Handle serial number search
  const handleSerialSearch = (srNo: string) => {
    setSerialSearch(srNo);
  };

  const handleSerialSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSerialSearchBlur();
    }
  };

  const handleSerialSearchBlur = () => {
    if (!serialSearch.trim()) return;
    
    const formattedSrNo = formatSerialNumber(serialSearch);
    setSerialSearch(formattedSrNo);
    
    // Find supplier with matching serial number
    const matchingSupplier = suppliers.find(s => {
      // Try both original srNo and formatted srNo for comparison
      const originalSrNo = s.srNo || '';
      const formattedSupplierSrNo = formatSerialNumber(originalSrNo);
      return originalSrNo === formattedSrNo || formattedSupplierSrNo === formattedSrNo;
    });
    
    if (matchingSupplier) {
      // Create the same key format used in supplier filtering
      const supplierKey = `${matchingSupplier.name || ''}_${matchingSupplier.fatherName || ''}_${matchingSupplier.address || ''}`.trim();
      setSelectedSupplierKey(supplierKey);
      toast({
        title: "Supplier Found",
        description: `Selected ${matchingSupplier.name} (SR# ${formattedSrNo})`,
      });
    } else {
      toast({
        title: "Supplier Not Found",
        description: `No supplier found with SR# ${formattedSrNo}`,
        variant: "destructive",
      });
    }
  };
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold">Select Profile</h3>
            </div>
                       
            {/* Quick Date Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const today = new Date();
                  setStartDate(startOfYear(today));
                  setEndDate(endOfYear(today));
                }}
                className="h-8 text-xs"
              >
                This Year
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const today = new Date();
                  setStartDate(subDays(today, 365));
                  setEndDate(today);
                }}
                className="h-8 text-xs"
              >
                Last 365 Days
              </Button>
              {(startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }}
                  className="h-8 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
   
          {/* Date and Serial Number Row */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : <span>Start Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
   
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full sm:w-[200px] justify-start text-left font-normal h-9", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : <span>End Date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>

            {/* Serial Number Search - In same row as dates */}
            <div className="w-full sm:w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="SR# (e.g., 555)"
                  value={serialSearch}
                  onChange={(e) => handleSerialSearch(e.target.value)}
                  onBlur={handleSerialSearchBlur}
                  onKeyPress={handleSerialSearchKeyPress}
                  className="pl-10 h-9 w-full"
                />
              </div>
            </div>
          </div>

          {/* Full Width Name/Supplier Selection */}
          <div className="w-full">
            <CustomDropdown
              options={filteredSupplierOptions.map(({ value, label }) => ({ value, label }))}
              value={selectedSupplierKey}
              onChange={(value: string | null) => setSelectedSupplierKey(value)}
              placeholder="Search and select profile..."
            />
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

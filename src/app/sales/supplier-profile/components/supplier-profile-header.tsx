"use client";

import React from 'react';
import { format, startOfYear, endOfYear, subDays } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { Users, Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierProfileHeaderProps {
  startDate?: Date;
  endDate?: Date;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  selectedSupplierKey: string | null;
  setSelectedSupplierKey: (key: string | null) => void;
  filteredSupplierOptions: Array<{ value: string; label: string; data: any }>;
}

export const SupplierProfileHeader: React.FC<SupplierProfileHeaderProps> = ({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  selectedSupplierKey,
  setSelectedSupplierKey,
  filteredSupplierOptions,
}) => {
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
   
            <div className="w-full sm:flex-1">
              <CustomDropdown
                options={filteredSupplierOptions.map(({ value, label }) => ({ value, label }))}
                value={selectedSupplierKey}
                onChange={(value: string | null) => setSelectedSupplierKey(value)}
                placeholder="Search and select profile..."
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

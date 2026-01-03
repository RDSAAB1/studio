"use client";

import React from 'react';
import { format, startOfYear, endOfYear, subDays } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomDropdown } from '@/components/ui/custom-dropdown';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, X, Search, Filter, Check } from "lucide-react";
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
  const [searchType, setSearchType] = React.useState<'name' | 'fatherName' | 'address' | 'contact'>('name');

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
      // Create the same key format used in supplier filtering (buildProfileKey format)
      // Format: name__fatherName__address (double underscore, lowercase, underscores for spaces)
      const normalizeField = (value: unknown): string => {
        if (value === null || value === undefined) return "";
        return String(value).replace(/\s+/g, " ").trim();
      };
      
      const name = normalizeField(matchingSupplier.name || '');
      const fatherName = normalizeField(matchingSupplier.fatherName || matchingSupplier.so || '');
      const address = normalizeField(matchingSupplier.address || '');
      
      const supplierKey = [name, fatherName, address]
        .map((part) => part.toLowerCase().replace(/\s+/g, "_"))
        .join("__")
        .replace(/^_+|_+$/g, "");
      
      // Find matching key in filteredSupplierOptions
      const matchingOption = filteredSupplierOptions.find(opt => {
        // Check if the option's key matches or if the data matches
        const optData = opt.data;
        const optName = normalizeField(optData?.name || '');
        const optFatherName = normalizeField(optData?.fatherName || optData?.so || '');
        const optAddress = normalizeField(optData?.address || '');
        const optKey = [optName, optFatherName, optAddress]
          .map((part) => part.toLowerCase().replace(/\s+/g, "_"))
          .join("__")
          .replace(/^_+|_+$/g, "");
        
        return optKey === supplierKey || opt.value === supplierKey;
      });
      
      if (matchingOption) {
        setSelectedSupplierKey(matchingOption.value);
        toast({
          title: "Supplier Found",
          description: `Selected ${matchingSupplier.name} (SR# ${formattedSrNo})`,
        });
      } else {
        // Try to find by value directly
        const directMatch = filteredSupplierOptions.find(opt => opt.value === supplierKey);
        if (directMatch) {
          setSelectedSupplierKey(directMatch.value);
          toast({
            title: "Supplier Found",
            description: `Selected ${matchingSupplier.name} (SR# ${formattedSrNo})`,
          });
        } else {
          toast({
            title: "Supplier Found But Not in Filter",
            description: `Supplier ${matchingSupplier.name} (SR# ${formattedSrNo}) found but not in current filter. Try adjusting date range.`,
            variant: "default",
          });
        }
      }
    } else {
      toast({
        title: "Supplier Not Found",
        description: `No supplier found with SR# ${formattedSrNo}`,
        variant: "destructive",
      });
    }
  };
  const handleClear = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedSupplierKey(null);
    setSerialSearch('');
  };

  const handleFinalize = () => {
    // Finalize action - can be customized based on requirements
    toast({
      title: "Filters Applied",
      description: "Supplier profile filters have been finalized.",
    });
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col gap-3">
          {/* Header Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
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
            </div>
          </div>

          {/* Organized Layout: Row 1 (Name + Serial + Buttons), Row 2 (Search supplier) */}
          <div className="flex flex-col gap-2">
            {/* Row 1: Name Dropdown, Serial No, and Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              {/* Name Dropdown (Search Type) */}
              <div className="w-full sm:w-[140px] flex-shrink-0">
                <Select value={searchType} onValueChange={(value) => setSearchType(value as typeof searchType)}>
                  <SelectTrigger className="h-9 text-sm">
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
              
              {/* Serial Number Search */}
              <div className="flex-1 sm:flex-initial sm:w-[220px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Serial No..."
                    value={serialSearch}
                    onChange={(e) => handleSerialSearch(e.target.value)}
                    onBlur={handleSerialSearchBlur}
                    onKeyPress={handleSerialSearchKeyPress}
                    className="pl-10 h-9 w-full"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Filter action - can be customized
                    toast({
                      title: "Filter",
                      description: "Filter options",
                    });
                  }}
                  className="h-9 w-9 p-0"
                  title="Filter"
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="h-9 px-3"
                >
                  Clear
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleFinalize}
                  className="h-9 px-3"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Finalize
                </Button>
              </div>
            </div>
            
            {/* Row 2: Search Supplier Input (below Name dropdown) */}
            <div className="w-full sm:w-[280px]">
              <CustomDropdown
                options={filteredSupplierOptions.map(({ value, label, data }) => ({ value, label, data }))}
                value={selectedSupplierKey}
                onChange={(value: string | null) => setSelectedSupplierKey(value)}
                placeholder="Search supplier..."
                searchType={searchType}
                onSearchTypeChange={undefined}
                inputClassName="h-9"
              />
            </div>
          </div>

          {/* Date Pickers Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <SmartDatePicker
              value={startDate}
              onChange={(val) => setStartDate(val instanceof Date ? val : (val ? new Date(val) : undefined))}
              placeholder="Start Date"
              inputClassName="h-9 w-full sm:w-[200px]"
              returnDate={true}
            />
            <SmartDatePicker
              value={endDate}
              onChange={(val) => setEndDate(val instanceof Date ? val : (val ? new Date(val) : undefined))}
              placeholder="End Date"
              inputClassName="h-9 w-full sm:w-[200px]"
              returnDate={true}
            />
          </div>

        </div>
      </CardContent>
    </Card>
  );
};

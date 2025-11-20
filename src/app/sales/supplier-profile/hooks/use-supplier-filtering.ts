import { useMemo, useEffect } from 'react';
import type { CustomerSummary } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";

export const useSupplierFiltering = (
  supplierSummaryMap: Map<string, CustomerSummary>,
  selectedSupplierKey: string | null,
  setSelectedSupplierKey: (key: string | null) => void,
  startDate?: Date,
  endDate?: Date,
  MILL_OVERVIEW_KEY?: string
) => {
  const filteredSupplierOptions = useMemo(() => {
    // Create unique profiles based on Name, Father Name, and Address combination
    const uniqueProfiles = new Map<string, { key: string; data: any }>();
    
    Array.from(supplierSummaryMap.entries()).forEach(([key, data]) => {
      // Create a unique key based on Name, Father Name (stored in data.so), and Address
      const profileKey = `${data.name || ''}_${data.so || ''}_${data.address || ''}`.trim();
      
      if (!uniqueProfiles.has(profileKey)) {
        uniqueProfiles.set(profileKey, { key, data });
      } else {
        // If profile already exists, merge the data (combine transactions, payments, etc.)
        const existing = uniqueProfiles.get(profileKey)!;
        const existingData = existing.data;
        const mergedData = {
          ...existingData,
          allTransactions: [...(existingData.allTransactions || []), ...(data.allTransactions || [])],
          allPayments: [...(existingData.allPayments || []), ...(data.allPayments || [])],
          totalAmount: (existingData.totalAmount || 0) + (data.totalAmount || 0),
          totalOriginalAmount: (existingData.totalOriginalAmount || 0) + (data.totalOriginalAmount || 0),
          totalPaid: (existingData.totalPaid || 0) + (data.totalPaid || 0),
          totalOutstanding: (existingData.totalOutstanding || 0) + (data.totalOutstanding || 0),
        };
        uniqueProfiles.set(profileKey, { key: existing.key, data: mergedData });
      }
    });

    const allOptions = Array.from(uniqueProfiles.entries()).map(([profileKey, payload]) => {
      const { key: originalKey, data } = payload;
      // Create a detailed label with name, father name, and address
      const name = toTitleCase(data.name || '');
      const fatherName = toTitleCase(data.fatherName || data.so || '');
      const address = toTitleCase(data.address || '');
      const contact = data.contact || '';
      
      
      // Format the label to match supplier payments format
      const label = `${name} | F:${fatherName} | ${address} | ${contact}`.trim();
      
      
      return { 
        value: originalKey, 
        label: label.trim(),
        data 
      };
    });

    // Filter out any existing Mill Overview entries to avoid duplicates
    const filteredOptions = allOptions.filter(option => 
      option.value !== MILL_OVERVIEW_KEY && 
      option.value !== 'Mill (Total Overview)__' &&
      option.label !== 'Mill (Total Overview)'
    );
    
    // Always add Mill Overview if MILL_OVERVIEW_KEY is provided
    const millOverviewData = supplierSummaryMap.get(MILL_OVERVIEW_KEY);
    let optionsWithMillOverview = filteredOptions;
    
    if (MILL_OVERVIEW_KEY && millOverviewData) {
      const millOverviewOption = {
        value: MILL_OVERVIEW_KEY,
        label: 'Mill (Total Overview)',
        data: millOverviewData
      };
      optionsWithMillOverview = [millOverviewOption, ...filteredOptions];
    }

    // If no date range, show all including Mill Overview
    if (!startDate && !endDate) {
      return optionsWithMillOverview;
    }

    // Filter suppliers who have transactions in the date range
    return optionsWithMillOverview.filter(({ value, data }) => {
      // Always include Mill Overview
      if (value === MILL_OVERVIEW_KEY) return true;

      const hasTransactionsInRange = data.allTransactions?.some(t => {
        if (!t.date) return false;
        const transactionDate = new Date(t.date);
        
        if (startDate && endDate) {
          return transactionDate >= startDate && transactionDate <= endDate;
        } else if (startDate) {
          return transactionDate >= startDate;
        } else if (endDate) {
          return transactionDate <= endDate;
        }
        return true;
      });

      return hasTransactionsInRange;
    });
  }, [supplierSummaryMap, startDate, endDate, MILL_OVERVIEW_KEY]);

  // Auto-switch to Mill Overview if selected supplier is not in filtered list
  useEffect(() => {
    if (selectedSupplierKey && !filteredSupplierOptions.some(opt => opt.value === selectedSupplierKey)) {
      setSelectedSupplierKey(MILL_OVERVIEW_KEY || null);
    }
  }, [filteredSupplierOptions, selectedSupplierKey, setSelectedSupplierKey, MILL_OVERVIEW_KEY]);

  return { filteredSupplierOptions };
};

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
    const uniqueProfiles = new Map<string, any>();
    
    Array.from(supplierSummaryMap.entries()).forEach(([key, data]) => {
      // Create a unique key based on Name, Father Name, and Address
      const profileKey = `${data.name || ''}_${data.fatherName || ''}_${data.address || ''}`.trim();
      
      if (!uniqueProfiles.has(profileKey)) {
        uniqueProfiles.set(profileKey, data);
      } else {
        // If profile already exists, merge the data (combine transactions, payments, etc.)
        const existingData = uniqueProfiles.get(profileKey);
        const mergedData = {
          ...existingData,
          allTransactions: [...(existingData.allTransactions || []), ...(data.allTransactions || [])],
          allPayments: [...(existingData.allPayments || []), ...(data.allPayments || [])],
          totalAmount: (existingData.totalAmount || 0) + (data.totalAmount || 0),
          totalOriginalAmount: (existingData.totalOriginalAmount || 0) + (data.totalOriginalAmount || 0),
          totalPaid: (existingData.totalPaid || 0) + (data.totalPaid || 0),
          totalOutstanding: (existingData.totalOutstanding || 0) + (data.totalOutstanding || 0),
        };
        uniqueProfiles.set(profileKey, mergedData);
      }
    });

    const allOptions = Array.from(uniqueProfiles.entries()).map(([profileKey, data]) => {
      // Create a detailed label with name, father name, and address
      const name = toTitleCase(data.name || '');
      const fatherName = toTitleCase(data.fatherName || '');
      const address = toTitleCase(data.address || '');
      const contact = data.contact || '';
      
      // Format the label with all available information
      let label = name;
      if (fatherName) label += ` - ${fatherName}`;
      if (address) label += ` - ${address}`;
      if (contact) label += ` (${contact})`;
      
      // Debug: Log the first few options to see what's being created
      if (profileKey && (profileKey.includes('1') || profileKey.includes('2') || profileKey.includes('3'))) {
        console.log('Supplier Option Created:', {
          profileKey,
          name,
          fatherName,
          address,
          contact,
          label: label.trim()
        });
      }
      
      return { 
        value: profileKey, 
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
    
    // Only add Mill Overview if it has data
    const millOverviewData = supplierSummaryMap.get(MILL_OVERVIEW_KEY);
    let optionsWithMillOverview = filteredOptions;
    
    console.log('Mill Overview Data Check:', millOverviewData);
    console.log('Has Data:', millOverviewData && millOverviewData.totalTransactions > 0);
    
    if (millOverviewData && millOverviewData.totalTransactions > 0) {
      const millOverviewOption = {
        value: MILL_OVERVIEW_KEY,
        label: 'Mill (Total Overview)',
        data: millOverviewData
      };
      optionsWithMillOverview = [millOverviewOption, ...filteredOptions];
      console.log('Added Mill Overview with data');
    } else {
      console.log('Skipped Mill Overview - no data');
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

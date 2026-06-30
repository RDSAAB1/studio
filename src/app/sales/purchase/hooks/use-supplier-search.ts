import { useState, useMemo, useCallback, useDeferredValue, useTransition } from 'react';
import type { Customer } from "@/lib/definitions";

interface UseSupplierSearchProps {
  allSuppliers: Customer[] | undefined;
}

export function useSupplierSearch({ allSuppliers }: UseSupplierSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSteps, setSearchSteps] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSearchSteps = useDeferredValue(searchSteps);

  // Pre-index suppliers for faster search (only when allSuppliers changes)
  const indexedSuppliers = useMemo(() => {
    if (!allSuppliers || allSuppliers.length === 0) return [];
    
    return allSuppliers.map(supplier => ({
      ...supplier,
      searchIndex: [
        supplier.name?.toLowerCase() || '',
        supplier.so?.toLowerCase() || '',
        supplier.address?.toLowerCase() || '',
        supplier.srNo?.toLowerCase() || '',
        supplier.contact?.toLowerCase() || '',
        supplier.vehicleNo?.toLowerCase() || ''
      ].join(' ')
    }));
  }, [allSuppliers]);

  // Multi-step filtering logic with deferred values for smooth typing
  const filteredSuppliers = useMemo(() => {
    if (!indexedSuppliers || indexedSuppliers.length === 0) {
      return [];
    }

    // If no search query or search steps, return all suppliers
    if (!deferredSearchQuery || deferredSearchQuery.trim() === '' || deferredSearchSteps.length === 0) {
      return indexedSuppliers;
    }

    // If only one search step, do optimized search using pre-indexed data
    if (deferredSearchSteps.length === 1) {
      const query = deferredSearchSteps[0].toLowerCase().trim();
      if (!query) return indexedSuppliers;
      
      // Use pre-indexed search string for faster filtering
      return indexedSuppliers.filter(supplier => 
        supplier.searchIndex.includes(query)
      );
    }

    // Multiple search steps - apply progressive filtering with early exit
    let result = indexedSuppliers;
    
    for (const step of deferredSearchSteps) {
      const query = step.toLowerCase().trim();
      if (!query) continue;
      
      // Early exit if no results
      if (result.length === 0) break;
      
      // Use pre-indexed search for faster filtering
      result = result.filter(supplier => 
        supplier.searchIndex.includes(query)
      );
    }

    return result;
  }, [indexedSuppliers, deferredSearchQuery, deferredSearchSteps]);

  // Handle search input with multi-step filtering - optimized for no lag
  const handleSearchChange = useCallback((value: string) => {
    // Update input immediately for responsive UI
    setSearchQuery(value);
    
    // Use startTransition for non-urgent state updates to prevent blocking
    startTransition(() => {
      // If empty, clear search steps
      if (!value || value.trim() === '') {
        setSearchSteps([]);
        return;
      }
      
      // Split by comma and filter out empty strings
      const steps = value.split(',').map(step => step.trim()).filter(step => step.length > 0);
      setSearchSteps(steps);
    });
  }, []);

  return {
    searchQuery,
    searchSteps,
    filteredSuppliers,
    handleSearchChange,
    isPending,
  };
}




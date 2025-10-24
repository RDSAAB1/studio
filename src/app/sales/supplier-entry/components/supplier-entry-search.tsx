"use client";

import { useState, useMemo } from "react";
import type { Customer } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface SupplierEntrySearchProps {
  suppliers: Customer[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSelectSupplier: (supplier: Customer) => void;
}

export const SupplierEntrySearch = ({
  suppliers,
  searchTerm,
  setSearchTerm,
  onSelectSupplier,
}: SupplierEntrySearchProps) => {
  const [showResults, setShowResults] = useState(false);

  // Filter suppliers based on search term
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return suppliers.filter(supplier => 
      supplier.name?.toLowerCase().includes(term) ||
      supplier.srNo?.toLowerCase().includes(term) ||
      supplier.contact?.includes(term) ||
      supplier.address?.toLowerCase().includes(term) ||
      supplier.variety?.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  }, [suppliers, searchTerm]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowResults(value.length > 0);
  };

  const handleSelectSupplier = (supplier: Customer) => {
    onSelectSupplier(supplier);
    setSearchTerm('');
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowResults(false);
  };

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          placeholder="Search suppliers by name, SR#, contact, address, or variety..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results */}
      {showResults && filteredSuppliers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => handleSelectSupplier(supplier)}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">
                    {supplier.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    SR# {supplier.srNo} • {supplier.variety}
                  </div>
                  <div className="text-xs text-gray-500">
                    {supplier.contact} • {supplier.address}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(supplier.netAmount || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Due: {supplier.dueDate}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {showResults && searchTerm && filteredSuppliers.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
          <div className="text-sm text-gray-500 text-center">
            No suppliers found matching "{searchTerm}"
          </div>
        </div>
      )}
    </div>
  );
};

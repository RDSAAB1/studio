import { useMemo } from 'react';
import { groupSuppliersByFuzzyMatch, findSimilarProfiles, type SupplierProfile } from '../utils/fuzzy-matching';
import type { Customer as Supplier } from "@/lib/definitions";

export const useSupplierGrouping = (suppliers: Supplier[]) => {
  const supplierGroups = useMemo(() => {
    // Convert suppliers to SupplierProfile format
    const profiles: SupplierProfile[] = suppliers.map(supplier => ({
      name: supplier.name || '',
      fatherName: supplier.fatherName || '',
      address: supplier.address || '',
      contact: supplier.contact || '',
      srNo: supplier.srNo || '',
    }));

    // Group suppliers using fuzzy matching
    const groups = groupSuppliersByFuzzyMatch(profiles);

    // Convert back to supplier format with group information
    const groupedSuppliers = groups.map((group, groupIndex) => ({
      groupId: `group_${groupIndex}`,
      groupSize: group.length,
      suppliers: group.map(profile => {
        const originalSupplier = suppliers.find(s => 
          s.name === profile.name && 
          s.fatherName === profile.fatherName && 
          s.address === profile.address
        );
        return originalSupplier ? {
          ...originalSupplier,
          groupId: `group_${groupIndex}`,
          groupSize: group.length,
          isGrouped: group.length > 1,
        } : null;
      }).filter(Boolean),
    }));

    return groupedSuppliers;
  }, [suppliers]);

  const findSimilarSuppliers = (targetSupplier: Supplier) => {
    const targetProfile: SupplierProfile = {
      name: targetSupplier.name || '',
      fatherName: targetSupplier.fatherName || '',
      address: targetSupplier.address || '',
      contact: targetSupplier.contact || '',
      srNo: targetSupplier.srNo || '',
    };

    const allProfiles: SupplierProfile[] = suppliers.map(supplier => ({
      name: supplier.name || '',
      fatherName: supplier.fatherName || '',
      address: supplier.address || '',
      contact: supplier.contact || '',
      srNo: supplier.srNo || '',
    }));

    return findSimilarProfiles(targetProfile, allProfiles);
  };

  const getGroupedSupplierStats = () => {
    const totalGroups = supplierGroups.length;
    const groupedCount = supplierGroups.filter(group => group.groupSize > 1).length;
    const singleSuppliers = supplierGroups.filter(group => group.groupSize === 1).length;
    const totalGroupedSuppliers = supplierGroups.reduce((sum, group) => 
      sum + (group.groupSize > 1 ? group.groupSize : 0), 0
    );

    return {
      totalGroups,
      groupedCount,
      singleSuppliers,
      totalGroupedSuppliers,
      groupingEfficiency: suppliers.length > 0 ? (totalGroupedSuppliers / suppliers.length) * 100 : 0,
    };
  };

  return {
    supplierGroups,
    findSimilarSuppliers,
    getGroupedSupplierStats,
  };
};

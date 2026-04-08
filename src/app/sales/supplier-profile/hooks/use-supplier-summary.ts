import { useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, CustomerPayment, Payment, SupplierPayment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";
import { calculateOutstandingForEntry } from "@/lib/outstanding-calculator";
import { fuzzyMatchProfiles, type SupplierProfile as FuzzySupplierProfile } from "../utils/fuzzy-matching";

const MILL_OVERVIEW_KEY = 'mill-overview';

type AnyPayment = SupplierPayment | CustomerPayment;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeProfileField = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).replace(/\s+/g, " ").trim();
};

const toFuzzyProfile = (source: any): FuzzySupplierProfile => ({
  name: normalizeProfileField(source?.name),
  fatherName: normalizeProfileField(source?.fatherName ?? source?.so),
  address: normalizeProfileField(source?.address),
  contact: normalizeProfileField(source?.contact),
  srNo: normalizeProfileField(source?.srNo),
});

const buildProfileKey = (profile: FuzzySupplierProfile, index: number): string => {
  const base = [profile.name, profile.fatherName || "", profile.address || ""]
    .map((part) => part.toLowerCase().replace(/\s+/g, "_"))
    .join("__")
    .replace(/^_+|_+$/g, "");

  if (base) {
    return base;
  }

  return `profile_${index}`;
};

// Helper function to parse payment ID for proper sorting
const parsePaymentIdForSort = (id: string): { prefix: string; numericValue: number; decimalValue: number } => {
  if (!id || typeof id !== 'string') return { prefix: '', numericValue: 0, decimalValue: 0 };
  const cleanId = id.trim().replace(/[^A-Za-z0-9.]/g, '');
  if (!cleanId) return { prefix: '', numericValue: 0, decimalValue: 0 };
  const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
  if (match && match[2]) {
    const prefix = match[1] || '';
    const numberStr = match[2] || '0';
    const decimalStr = match[3] || '0';
    const numericValue = parseInt(numberStr, 10);
    const decimalValue = decimalStr ? parseInt(decimalStr, 10) : 0;
    if (!isNaN(numericValue)) return { prefix, numericValue, decimalValue };
  }
  return { prefix: cleanId || id, numericValue: 0, decimalValue: 0 };
};

const sortPaymentByIdDescending = (a: AnyPayment, b: AnyPayment): number => {
  try {
    const idA = (a.paymentId || a.id || '').toString().trim();
    const idB = (b.paymentId || b.id || '').toString().trim();
    if (!idA && !idB) return 0;
    if (!idA) return 1;
    if (!idB) return -1;
    const parsedA = parsePaymentIdForSort(idA);
    const parsedB = parsePaymentIdForSort(idB);
    const prefixCompare = parsedA.prefix.toUpperCase().localeCompare(parsedB.prefix.toUpperCase());
    if (prefixCompare !== 0) return prefixCompare;
    if (parsedA.numericValue !== parsedB.numericValue) return parsedB.numericValue - parsedA.numericValue;
    return parsedB.decimalValue - parsedA.decimalValue;
  } catch (error) { return 0; }
};

export const useSupplierSummary = (
  suppliers: Supplier[],
  paymentHistory: AnyPayment[],
  startDate?: Date,
  endDate?: Date,
  selectedKey?: string | null
) => {
  const supplierSummaryMap = useMemo(() => {
    if (!suppliers || !paymentHistory) return new Map<string, CustomerSummary>();

    // Build remaining values map for entry calculations
    const srNoToRemainingMap = new Map<string, number>();
    suppliers.forEach(s => {
      const srNo = String(s.srNo || '').trim().toLowerCase();
      srNoToRemainingMap.set(srNo, toNumber(s.originalNetAmount || s.netAmount || 0));
    });

    // Pass 1: Quick grouping
    const quickGroups = new Map<string, { profile: FuzzySupplierProfile, suppliers: Supplier[] }>();
    suppliers.forEach(s => {
      const profile = toFuzzyProfile(s);
      const key = buildProfileKey(profile, 0);
      const existing = quickGroups.get(key);
      if (existing) existing.suppliers.push(s);
      else quickGroups.set(key, { profile, suppliers: [s] });
    });

    const finalMap = new Map<string, CustomerSummary>();
    let groupIndex = 0;

    // Mill overview structure
    const mill: CustomerSummary = {
      name: 'Mill (Total Overview)', so: '', address: '', contact: '',
      totalAmount: 0, totalOriginalAmount: 0, totalPaid: 0, totalCashPaid: 0, totalRtgsPaid: 0,
      totalOutstanding: 0, totalCdAmount: 0, paymentHistory: [], outstandingEntryIds: [],
      allTransactions: [], allPayments: [], transactionsByVariety: {},
      totalGrossWeight: 0, totalFinalWeight: 0, totalNetWeight: 0, totalTransactions: 0, totalOutstandingTransactions: 0,
    } as any;

    const millTransactions: Supplier[] = [];
    quickGroups.forEach((groupData, groupKey) => {
      const isSelected = selectedKey === groupKey || !selectedKey || selectedKey === MILL_OVERVIEW_KEY;
      let summary: CustomerSummary;

      if (!isSelected) {
        // FAST STUB
        const firstS = groupData.suppliers[0];
        summary = {
          ...firstS,
          name: groupData.profile.name || firstS.name || `Supplier ${groupIndex + 1}`,
          so: groupData.profile.fatherName || firstS.so || firstS.fatherName || '',
          address: groupData.profile.address || firstS.address || '',
          totalOutstanding: groupData.suppliers.reduce((sum, s) => sum + toNumber(s.netAmount || 0), 0),
          allTransactions: groupData.suppliers,
          paymentHistory: [],
          isStub: true
        } as any;
        
        // Still add raw suppliers to mill list to ensure we have them all if needed, 
        // but mill overview accuracy prefers processed ones.
        millTransactions.push(...groupData.suppliers);
      } else {
        // DEEP CALC
        const processed = groupData.suppliers.map(s => {
          const res = calculateOutstandingForEntry(s, paymentHistory, srNoToRemainingMap);
          return { 
            ...s, 
            outstandingForEntry: res.outstanding, 
            totalPaidForEntry: res.totalPaid, 
            totalCdForEntry: res.totalCd,
            totalExtraForEntry: res.totalExtra,
            adjustedOriginal: res.adjustedOriginal,
            paymentsForEntry: res.paymentsForEntry 
          };
        });

        const firstS = processed[0];
        const allGroupPayments = Array.from(new Map(processed.flatMap(s => s.paymentsForEntry).map(p => [p.id, p])).values()).sort(sortPaymentByIdDescending);

        summary = {
          ...firstS,
          name: groupData.profile.name || firstS.name,
          so: groupData.profile.fatherName || firstS.so || firstS.fatherName || '',
          address: groupData.profile.address || firstS.address || '',
          totalAmount: processed.reduce((sum, s) => sum + toNumber(s.amount), 0),
          totalOutstanding: processed.reduce((sum, s) => sum + s.outstandingForEntry, 0),
          totalPaid: processed.reduce((sum, s) => sum + s.totalPaidForEntry, 0),
          allTransactions: processed,
          allPayments: allGroupPayments,
          paymentHistory: allGroupPayments,
          outstandingEntryIds: processed.filter(s => s.outstandingForEntry > 0).map(s => s.srNo),
        } as any;
        
        millTransactions.push(...processed);
      }

      finalMap.set(groupKey, summary);
      
      // Update Mill (always sum up for mill overview accuracy)
      mill.totalOutstanding += summary.totalOutstanding;
      if (!summary.isStub) {
          mill.totalAmount += summary.totalAmount || 0;
          mill.totalPaid += summary.totalPaid || 0;
      }
      
      groupIndex++;
    });

    mill.allTransactions = millTransactions;
    finalMap.set(MILL_OVERVIEW_KEY, mill);
    return finalMap;
  }, [suppliers, paymentHistory, startDate, endDate, selectedKey]);

  return { supplierSummaryMap, MILL_OVERVIEW_KEY };
};

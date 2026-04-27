import { useMemo } from 'react';
import type { Customer as Supplier, CustomerSummary, CustomerPayment, Payment, SupplierPayment } from "@/lib/definitions";
import { toTitleCase } from "@/lib/utils";
import { calculateOutstandingForEntry, calculateGlobalSimulation } from "@/lib/outstanding-calculator";
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

    // Pass 1: Quick grouping with fuzzy matching
    const groups: Array<{ profile: FuzzySupplierProfile, suppliers: Supplier[], key: string }> = [];
    suppliers.forEach((s, idx) => {
      const profile = toFuzzyProfile(s);
      
      let matchedGroup = groups.find(g => 
        fuzzyMatchProfiles(g.profile, profile).isMatch
      );

      if (matchedGroup) {
        matchedGroup.suppliers.push(s);
      } else {
        const key = buildProfileKey(profile, idx);
        groups.push({ profile, suppliers: [s], key });
      }
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
    const millPaymentsMap = new Map<string, AnyPayment>();

    groups.forEach((groupData) => {
      const groupKey = groupData.key;
      const isSelected = selectedKey === groupKey || !selectedKey || selectedKey === MILL_OVERVIEW_KEY;
      let summary: CustomerSummary;

      // Group-level totals (common for both stub and deep calc)
      const groupTotalGrossWeight = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.grossWeight || 0), 0);
      const groupTotalNetWeight = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.netWeight || 0), 0);
      const groupTotalWeight = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.weight || 0), 0);
      const groupTotalKartaWeight = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.kartaWeight || 0), 0);
      const groupTotalKartaAmount = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.kartaAmount || 0), 0);
      const groupTotalLabouryAmount = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.labouryAmount || 0), 0);
      const groupTotalKanta = groupData.suppliers.reduce((sum, s) => sum + toNumber(s.kanta || 0), 0);
      const groupTotalOtherCharges = groupData.suppliers.reduce((sum, s) => sum + toNumber((s as any).otherCharges || 0), 0);

      if (!isSelected) {
        // FAST STUB
        const firstS = groupData.suppliers[0];
        summary = {
          ...firstS,
          name: groupData.profile.name || firstS.name || `Supplier ${groupIndex + 1}`,
          so: groupData.profile.fatherName || firstS.so || firstS.fatherName || '',
          address: groupData.profile.address || firstS.address || '',
          totalAmount: groupData.suppliers.reduce((sum, s) => sum + toNumber(s.amount || 0), 0),
          totalOriginalAmount: groupData.suppliers.reduce((sum, s) => sum + toNumber(s.originalNetAmount || s.netAmount || 0), 0),
          totalOutstanding: groupData.suppliers.reduce((sum, s) => sum + toNumber(s.netAmount || 0), 0),
          totalPaid: groupData.suppliers.reduce((sum, s) => sum + (toNumber(s.amount || 0) - toNumber(s.netAmount || 0)), 0),
          totalGrossWeight: groupTotalGrossWeight,
          totalNetWeight: groupTotalNetWeight,
          totalFinalWeight: groupTotalWeight,
          totalKartaWeight: groupTotalKartaWeight,
          totalKartaAmount: groupTotalKartaAmount,
          totalLabouryAmount: groupTotalLabouryAmount,
          totalKanta: groupTotalKanta,
          totalOtherCharges: groupTotalOtherCharges,
          totalDeductions: groupTotalKartaAmount + groupTotalLabouryAmount + groupTotalKanta + groupTotalOtherCharges,
          allTransactions: groupData.suppliers,
          paymentHistory: [],
          isStub: true
        } as any;
        
        millTransactions.push(...groupData.suppliers);
      } else {
        // Filter payment history to only include payments that belong to this group
        const groupSrNos = new Set(groupData.suppliers.map(s => String(s.srNo || "").toLowerCase()));
        const groupIds = new Set(groupData.suppliers.map(s => s.id));
        const groupCustomerIds = new Set(groupData.suppliers.map(s => s.customerId).filter(Boolean));
        
        const filteredGroupPayments = paymentHistory.filter(p => {
          const parchiRaw = String((p as any).parchiNo || "").toLowerCase();
          const parchiMatch = parchiRaw.split(/[,\s]+/g).some(t => groupSrNos.has(t.trim()));
          if (parchiMatch) return true;

          const pAny = p as any;
          const paidFor = Array.isArray(pAny.paidFor) ? pAny.paidFor : [];
          const paidForMatch = paidFor.some((pf: any) => groupSrNos.has(String(pf.srNo || "").toLowerCase()));
          if (paidForMatch) return true;

          if (groupIds.has(p.id) || groupIds.has(pAny.supplierId) || groupIds.has(pAny.customerId)) return true;
          if (pAny.customerId && groupCustomerIds.has(pAny.customerId)) return true;
          if (pAny.supplierId && groupCustomerIds.has(pAny.supplierId)) return true;

          const paymentProfile = toFuzzyProfile(pAny.supplierDetails || p);
          if (fuzzyMatchProfiles(groupData.profile, paymentProfile).isMatch) return true;

          return false;
        });

        const globalRes = calculateGlobalSimulation(groupData.suppliers, filteredGroupPayments, srNoToRemainingMap);
        
        const processed = groupData.suppliers.map(s => {
          const sr = String(s.srNo || "").toLowerCase();
          const res = globalRes.get(sr);
          return { 
            ...s, 
            outstandingForEntry: res?.outstanding ?? 0, 
            totalPaidForEntry: res?.totalPaid ?? 0, 
            totalCdForEntry: res?.totalCd ?? 0,
            totalExtraForEntry: res?.totalExtra ?? 0,
            adjustedOriginal: res?.adjustedOriginal ?? 0,
            paymentsForEntry: res?.paymentsForEntry ?? []
          };
        });

        const firstS = processed[0];
        const allGroupPayments = filteredGroupPayments.sort(sortPaymentByIdDescending);

        summary = {
          ...firstS,
          name: groupData.profile.name || firstS.name,
          so: groupData.profile.fatherName || firstS.so || firstS.fatherName || '',
          address: groupData.profile.address || firstS.address || '',
          totalAmount: processed.reduce((sum, s) => sum + toNumber(s.amount), 0),
          totalOriginalAmount: processed.reduce((sum, s) => sum + (s.adjustedOriginal || toNumber(s.originalNetAmount)), 0),
          totalOutstanding: processed.reduce((sum, s) => sum + s.outstandingForEntry, 0),
          // Total Paid should include all payments received for this group
          totalPaid: filteredGroupPayments.reduce((sum, p) => sum + Math.abs(toNumber(p.amount)), 0),
          totalCdAmount: processed.reduce((sum, s) => sum + s.totalCdForEntry, 0),
          totalGrossWeight: groupTotalGrossWeight,
          totalNetWeight: groupTotalNetWeight,
          totalFinalWeight: groupTotalWeight,
          totalKartaWeight: groupTotalKartaWeight,
          totalKartaAmount: groupTotalKartaAmount,
          totalLabouryAmount: groupTotalLabouryAmount,
          totalKanta: groupTotalKanta,
          totalOtherCharges: groupTotalOtherCharges,
          totalDeductions: groupTotalKartaAmount + groupTotalLabouryAmount + groupTotalKanta + groupTotalOtherCharges + processed.reduce((sum, s) => sum + toNumber(s.brokerageAmount || 0), 0),
          allTransactions: processed,
          allPayments: allGroupPayments,
          paymentHistory: allGroupPayments,
          outstandingEntryIds: processed.filter(s => s.outstandingForEntry > 0).map(s => s.srNo),
        } as any;
        
        millTransactions.push(...processed);
        allGroupPayments.forEach(p => millPaymentsMap.set(p.id || (p as any).paymentId, p));
      }

      finalMap.set(groupKey, summary);
      
      // Update Mill
      mill.totalOutstanding += summary.totalOutstanding || 0;
      mill.totalAmount += summary.totalAmount || 0;
      mill.totalPaid += summary.totalPaid || 0;
      mill.totalOriginalAmount += (summary as any).totalOriginalAmount || 0;
      mill.totalCdAmount += (summary as any).totalCdAmount || 0;
      mill.totalGrossWeight += (summary as any).totalGrossWeight || 0;
      mill.totalNetWeight += (summary as any).totalNetWeight || 0;
      mill.totalFinalWeight += (summary as any).totalFinalWeight || 0;
      mill.totalKartaWeight += (summary as any).totalKartaWeight || 0;
      mill.totalKartaAmount += (summary as any).totalKartaAmount || 0;
      mill.totalLabouryAmount += (summary as any).totalLabouryAmount || 0;
      mill.totalKanta += (summary as any).totalKanta || 0;
      mill.totalOtherCharges += (summary as any).totalOtherCharges || 0;
      mill.totalDeductions = (mill.totalDeductions || 0) + (summary.totalDeductions || 0);
      mill.totalTransactions += (summary.allTransactions || []).length;
      if (summary.outstandingEntryIds && summary.outstandingEntryIds.length > 0) {
        mill.totalOutstandingTransactions += summary.outstandingEntryIds.length;
      }
      
      groupIndex++;
    });

    mill.allTransactions = millTransactions;
    mill.allPayments = Array.from(millPaymentsMap.values()).sort(sortPaymentByIdDescending);
    mill.paymentHistory = mill.allPayments;
    finalMap.set(MILL_OVERVIEW_KEY, mill);
    return finalMap;
  }, [suppliers, paymentHistory, startDate, endDate, selectedKey]);

  return { supplierSummaryMap, MILL_OVERVIEW_KEY };
};

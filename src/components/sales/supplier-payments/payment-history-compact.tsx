"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import type { Payment, Customer } from "@/lib/definitions";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

interface PaymentHistoryCompactProps {
  payments: Payment[];
  onEdit?: (payment: Payment) => void;
  onDelete?: (payment: Payment) => void;
  historyType?: 'cash' | 'rtgs' | 'gov' | 'payment' | 'online' | 'ledger';
  maxRows?: number;
  suppliers?: Customer[];
}

export const PaymentHistoryCompact = ({ payments, onEdit, onDelete, historyType = 'payment', maxRows, suppliers }: PaymentHistoryCompactProps) => {
  const [deselectedCenters, setDeselectedCenters] = React.useState<string[]>([]);

  const uniqueCenters = React.useMemo(() => {
    if (historyType !== 'gov') return [];
    const centers = new Set<string>();
    payments.forEach(p => {
      const c = (p as any).centerName;
      if (c) centers.add(c);
    });
    return Array.from(centers).sort();
  }, [payments, historyType]);

  // Sort payments by ID in descending order - prefix first, then number (highest first)
  const sortedPayments = React.useMemo(() => {
    // Deduplicate payments to prevent key collisions
    const seenKeys = new Set<string>();
    const uniquePayments = payments.filter(p => {
      // Prefer paymentId (e.g. RT001, C001) for deduplication as it's the logical ID
      // p.id is the Firestore document ID, which will be different for duplicates
      const key = p.paymentId || p.id;
      if (!key) return true; // If no ID, keep it (though it might cause issues if multiple have no ID)
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    return [...uniquePayments].sort((a, b) => {
      const idA = String(a?.paymentId || a?.id || '').trim().replace(/\s+/g, '');
      const idB = String(b?.paymentId || b?.id || '').trim().replace(/\s+/g, '');
      
      if (!idA && !idB) return 0;
      if (!idA) return 1;
      if (!idB) return -1;
      
      // Parse ID into prefix and number parts
      // Handles: E832, EX00039, EX00138.1, P00081, RT00393, etc.
      const parseId = (id: string): { prefix: string; number: number; decimal: number } => {
        // Clean the ID - remove any non-alphanumeric characters except dots
        const cleanId = id.replace(/[^A-Za-z0-9.]/g, '');
        
        // Try to match: prefix (letters) + number + optional decimal
        const match = cleanId.match(/^([A-Za-z]*)(\d+)(?:\.(\d+))?$/);
        if (match) {
          const prefix = match[1] || '';
          const numberStr = match[2] || '0';
          const decimalStr = match[3] || '0';
          
          return {
            prefix: prefix,
            number: parseInt(numberStr, 10) || 0,
            decimal: decimalStr ? parseInt(decimalStr, 10) : 0
          };
        }
        // If no match, treat entire ID as prefix
        return { prefix: cleanId || id, number: 0, decimal: 0 };
      };
      
      const parsedA = parseId(idA);
      const parsedB = parseId(idB);
      
      // First compare prefixes alphabetically (case-insensitive)
      const prefixA = parsedA.prefix.toUpperCase();
      const prefixB = parsedB.prefix.toUpperCase();
      const prefixCompare = prefixA.localeCompare(prefixB);
      if (prefixCompare !== 0) return prefixCompare;
      
      // If prefixes are same, compare numbers numerically (descending - highest first)
      if (parsedA.number !== parsedB.number) {
        return parsedB.number - parsedA.number;
      }
      
      // If numbers are same, compare decimal parts (descending)
      return parsedB.decimal - parsedA.decimal;
    });
  }, [payments]);

  // Helper function to get receipt numbers from paidFor array
  const getReceiptNumbers = React.useCallback((payment: Payment) => {
    if (payment.paidFor && payment.paidFor.length > 0) {
      return payment.paidFor.map((pf) => pf.srNo || '').filter(Boolean).join(', ');
    }
    return payment.parchiNo || '';
  }, []);

  // Helper function to get receipt numbers as array for display
  const getReceiptNumbersArray = React.useCallback((payment: Payment) => {
    if (payment.paidFor && payment.paidFor.length > 0) {
      return payment.paidFor.map((pf) => pf.srNo || '').filter(Boolean);
    }
    return payment.parchiNo ? [payment.parchiNo] : [];
  }, []);

  // Get payee account holder name (supplier) – check all possible field locations
  const getAccountHolderName = React.useCallback((payment: Payment) => {
    const p = payment as any;
    return (
      p.supplierName ||
      p.supplierDetails?.name ||
      p.accountHolderName ||
      p.bankDetails?.accountHolderName ||
      '-'
    );
  }, []);

  // Get RTGS bank details – check both flat and nested (bankDetails) fields
  const getBankDetails = React.useCallback((payment: Payment) => {
    const p = payment as any;
    const bd = p.bankDetails || {};
    let bankName = p.bankName || p.bankDetails?.bank || bd.bank || '-';
    
    // Extract full bank name if it's in format "SBI - State Bank of India"
    if (bankName.includes(' - ')) {
      const parts = bankName.split(' - ');
      if (parts.length > 1) {
        bankName = parts[1]; // Take the full name part
      }
    }
    
    return {
      accountNo: p.bankAcNo || bd.acNo || '-',
      bankName: bankName,
      bankBranch: p.bankBranch || bd.branch || '-',
      bankIfsc: p.bankIfsc || bd.ifscCode || '-',
      checkNo: p.checkNo || '-',
    };
  }, []);

  // Get Center Name for Gov payments
  const getCenterName = React.useCallback((payment: Payment) => {
    return (payment as any).centerName || '-';
  }, []);

  // Get Gov. supplier details by checking root, paidFor, or suppliers list lookup
  const getGovSupplierDetails = React.useCallback((payment: Payment) => {
    // 1. Check payment root fields first (these are saved directly on the payment record)
    let name = payment.supplierName || (payment as any).supplierDetails?.name || '';
    let fatherName = payment.supplierFatherName || (payment as any).supplierDetails?.fatherName || '';
    let address = (payment as any).supplierAddress || (payment as any).supplierDetails?.address || '';

    // Parse paidFor - handle both array and JSON string formats
    let safePaidFor: any[] = [];
    const pfRaw = payment.paidFor as any;
    if (Array.isArray(pfRaw)) {
      safePaidFor = pfRaw;
    } else if (typeof pfRaw === 'string' && pfRaw.trim().startsWith('[')) {
      try { safePaidFor = JSON.parse(pfRaw); } catch { safePaidFor = []; }
    }

    // 2. If any field is missing, try supplier DB lookup using paidFor[0].srNo
    if ((!name || !fatherName || !address) && suppliers && suppliers.length > 0) {
      // Collect all candidate srNos: from paidFor array AND from parchiNo field
      const candidateSrNos: string[] = [];
      if (safePaidFor.length > 0 && safePaidFor[0].srNo) {
        candidateSrNos.push(String(safePaidFor[0].srNo).trim().toLowerCase());
      }
      // Also try parchiNo tokens (comma/space separated) as fallback srNo sources
      const parchiStr = String((payment as any).parchiNo || '').trim();
      if (parchiStr) {
        parchiStr.split(/[,\s]+/).forEach(token => {
          const t = token.trim().toLowerCase();
          if (t) candidateSrNos.push(t);
        });
      }

      for (const srNoNorm of candidateSrNos) {
        const foundSupp = suppliers.find(
          (s) => String(s.srNo).trim().toLowerCase() === srNoNorm
        );
        if (foundSupp) {
          if (!name) name = foundSupp.name || '';
          if (!fatherName) fatherName = foundSupp.so || (foundSupp as any).fatherName || '';
          if (!address) address = foundSupp.address || '';
          break;
        }
      }
    }

    // 3. Last fallback: inline fields stored inside paidFor items
    if ((!name || !fatherName || !address) && safePaidFor.length > 0) {
      const firstPaidFor = safePaidFor[0];
      if (!name) name = firstPaidFor.supplierName || '';
      if (!fatherName) fatherName = firstPaidFor.supplierFatherName || '';
      if (!address) address = firstPaidFor.supplierAddress || '';
    }

    return {
      name: name || '-',
      fatherName: fatherName || '-',
      address: address || '-',
    };
  }, [suppliers]);

  // Calculate CD amount from payment
  const getCdAmount = React.useCallback((payment: Payment) => {
    // Check multiple possible fields for CD amount
    const paymentAny = payment as any;
    
    // First check if payment has direct cdAmount field
    if (typeof paymentAny.cdAmount === 'number' && paymentAny.cdAmount > 0) {
      return paymentAny.cdAmount;
    }
    
    // Check if CD amount is stored in paidFor array (sum all CD amounts)
    if (payment.paidFor && Array.isArray(payment.paidFor) && payment.paidFor.length > 0) {
      const totalCdFromPaidFor = payment.paidFor.reduce((sum: number, pf: any) => {
        const cdAmt = typeof pf.cdAmount === 'number' ? pf.cdAmount : 0;
        return sum + cdAmt;
      }, 0);
      if (totalCdFromPaidFor > 0) {
        return totalCdFromPaidFor;
      }
    }
    
    // Check other possible field names
    if (typeof paymentAny.creditCd === 'number' && paymentAny.creditCd > 0) {
      return paymentAny.creditCd;
    }
    if (typeof paymentAny.totalCd === 'number' && paymentAny.totalCd > 0) {
      return paymentAny.totalCd;
    }
    if (typeof paymentAny.cd === 'number' && paymentAny.cd > 0) {
      return paymentAny.cd;
    }
    
    // If not found, return 0
    return 0;
  }, []);

  const filteredByCenter = React.useMemo(() => {
    if (historyType !== 'gov') return sortedPayments;
    return sortedPayments.filter(p => {
      const c = (p as any).centerName;
      if (!c) return true;
      return !deselectedCenters.includes(c);
    });
  }, [sortedPayments, deselectedCenters, historyType]);

  const govTotals = React.useMemo(() => {
    if (historyType !== 'gov') return { qty: 0, extra: 0, paid: 0, cd: 0 };
    let qty = 0;
    let extra = 0;
    let paid = 0;
    let cd = 0;
    filteredByCenter.forEach(p => {
      qty += Number((p as any).govQuantity) || 0;
      extra += Number((p as any).govExtraAmount) || 0;
      paid += Number(p.amount) || 0;
      cd += getCdAmount(p);
    });
    return { qty, extra, paid, cd };
  }, [filteredByCenter, historyType, getCdAmount]);

  const infiniteScrollEnabled = !maxRows && filteredByCenter.length > 30;
  const { visibleItems, hasMore, isLoading, scrollRef } = useInfiniteScroll(filteredByCenter, {
    totalItems: filteredByCenter.length,
    initialLoad: 30,
    loadMore: 30,
    threshold: 5,
    enabled: infiniteScrollEnabled,
  });

  const visiblePayments = React.useMemo(() => {
    if (maxRows) return filteredByCenter.slice(0, maxRows);
    return filteredByCenter.slice(0, visibleItems);
  }, [maxRows, filteredByCenter, visibleItems]);

  return (
    <Card className="text-[9px] flex flex-col h-full overflow-hidden rounded-md">
      {historyType === 'gov' && uniqueCenters.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-border/80 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-600">Centers:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 px-2 text-[10px] font-semibold flex items-center gap-1.5 border-slate-200/80 bg-white hover:bg-slate-100 hover:text-slate-900"
                >
                  <Filter className="h-3 w-3 text-slate-500" />
                  <span>
                    {deselectedCenters.length === 0 
                      ? "All Centers Selected" 
                      : deselectedCenters.length === uniqueCenters.length 
                      ? "No Centers Selected" 
                      : `${uniqueCenters.length - deselectedCenters.length} of ${uniqueCenters.length} Selected`}
                  </span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 z-[99] bg-white border border-slate-200 shadow-lg rounded-md" align="start">
                <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-700">Select Centers</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-5 px-1.5 text-[9px] font-bold text-primary hover:bg-primary/10"
                    onClick={() => {
                      if (deselectedCenters.length === 0) {
                        setDeselectedCenters(uniqueCenters);
                      } else {
                        setDeselectedCenters([]);
                      }
                    }}
                  >
                    {deselectedCenters.length === 0 ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <ScrollArea className="h-40 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1">
                    {uniqueCenters.map(c => {
                      const isChecked = !deselectedCenters.includes(c);
                      return (
                        <label 
                          key={c} 
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer select-none text-[10px] font-medium text-slate-700 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDeselectedCenters(deselectedCenters.filter(item => item !== c));
                              } else {
                                setDeselectedCenters([...deselectedCenters, c]);
                              }
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="uppercase">{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">
            Showing {filteredByCenter.length} of {sortedPayments.length} rows
          </div>
        </div>
      )}
      <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
          <div ref={scrollRef} className={`flex-1 overflow-y-auto overscroll-contain w-full ${maxRows ? "pointer-events-none" : ""}`}>
            <div className="w-full overflow-x-auto">
              <Table className={cn("w-full translate-z-0", historyType === 'gov' ? "min-w-[1450px]" : "min-w-[900px] xl:min-w-0")}>
              <TableHeader className="table-header-compact z-20">
                <TableRow className="border-b-0 overflow-hidden">
                  {historyType === 'cash' && (
                    <>
                      <TableHead className="text-[10px] px-3 py-1 font-extrabold leading-none text-left align-middle overflow-hidden w-[15%]">ID</TableHead>
                      <TableHead className="text-[10px] px-3 py-1 font-extrabold leading-none text-left align-middle overflow-hidden w-[12%]">Date</TableHead>
                      <TableHead className="text-[9px] px-3 py-1 font-extrabold leading-none text-left align-middle overflow-hidden w-[40%]">Paid For</TableHead>
                      <TableHead className="text-[9px] px-3 py-1 font-extrabold leading-none text-right align-middle overflow-hidden w-[15%]">Paid</TableHead>
                      <TableHead className="text-[9px] px-3 py-1 font-extrabold leading-none text-right align-middle overflow-hidden w-[10%]">CD</TableHead>
                      <TableHead className="text-[9px] px-3 py-1 font-extrabold leading-none text-center align-middle overflow-hidden w-[8%]">Actions</TableHead>
                    </>
                  )}
                  {historyType === 'rtgs' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[10%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[10%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Holder</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Bank / IFSC</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Check</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[22%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-center align-middle overflow-hidden" style={{ height: '28px !important' }}>Act.</TableHead>
                    </>
                  )}
                  {historyType === 'gov' && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Name</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Father Name</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Address</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[7%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Center</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[7%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Transfer To</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Reg No.</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Qty</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Rate</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Extra</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[6%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[5%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[5%] text-center align-middle overflow-hidden" style={{ height: '28px !important' }}>Actions</TableHead>
                    </>
                  )}
                  {(historyType === 'payment' || historyType === 'online' || historyType === 'ledger') && (
                    <>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[12%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>ID</TableHead>
                      <TableHead className="text-[10px] px-2 py-0 font-extrabold leading-none w-[14%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Date</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[20%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Account Holder</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[14%] text-left align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid For</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Extra</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[10%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>Paid</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[8%] text-right align-middle overflow-hidden" style={{ height: '28px !important' }}>CD</TableHead>
                      <TableHead className="text-[9px] px-2 py-0 font-extrabold leading-none w-[12%] text-center align-middle overflow-hidden" style={{ height: '28px !important' }}>Actions</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                  {visiblePayments.length === 0 ? (
                      <TableRow>
                      <TableCell colSpan={historyType === 'cash' ? 6 : historyType === 'rtgs' ? 9 : historyType === 'gov' ? 15 : (historyType === 'payment' || historyType === 'online' || historyType === 'ledger') ? 8 : 7} className="text-center text-[9px] text-muted-foreground py-4">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    visiblePayments.map((payment, index) => {
                    const receiptNumbers = getReceiptNumbers(payment);
                    const cdAmount = getCdAmount(payment);
                    const extraAmountFromPaidFor =
                      payment.paidFor?.reduce((sum: number, pf: any) => sum + (Number((pf as any).extraAmount) || 0), 0) || 0;
                    const isCP = (payment as any).isCustomer === true || String(payment.id || payment.paymentId || "").startsWith("CP");
                    const extraAmountSign =
                      (historyType === 'ledger' && String((payment as any).drCr || '').toLowerCase() === 'credit') || isCP ? -1 : 1;
                    const extraAmountFromPaymentFields =
                      (Number((payment as any).extraAmount) || 0) + (Number((payment as any).advanceAmount) || 0);
                    const ledgerAmountFallback =
                      historyType === 'ledger' &&
                      (payment.paidFor?.length || 0) === 0 &&
                      extraAmountFromPaymentFields === 0
                        ? Math.abs(Number((payment as any).amount || 0))
                        : 0;
                    const extraAmountFromPayment = extraAmountFromPaymentFields + ledgerAmountFallback;
                    // When paidFor has extraAmount, payment.extraAmount = sum of paidFor — don't add both (double count)
                    const includePaymentLevelExtra =
                      extraAmountFromPaidFor === 0 && (extraAmountFromPaidFor === 0 || !(historyType === 'ledger' || historyType === 'online'));
                    const extraAmount = extraAmountFromPaidFor + ((includePaymentLevelExtra ? extraAmountFromPayment : 0) * extraAmountSign);
                    const accountHolderName = getAccountHolderName(payment);
                    const bankDetails = getBankDetails(payment);
                    const centerName = getCenterName(payment);
                    const govDetails = getGovSupplierDetails(payment);
                    const paymentDate = payment.date && isValid(new Date(payment.date))
                      ? format(new Date(payment.date), "dd-MMM-yy")
                      : '-';
                    
                    return (
                      <TableRow key={payment.paymentId || payment.id || `${index}`} className="h-5 border-b border-slate-200/70 text-slate-900 odd:bg-card/50 hover:bg-primary/5 transition-colors">
                        {historyType === 'cash' && (
                          <>
                            <TableCell className="text-[11px] px-3 py-1 w-[15%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-3 py-1 w-[12%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-3 py-1 w-[40%] text-left align-middle">
                              <span className="font-medium break-words">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-3 py-1 w-[15%] text-right align-middle">
                              {(() => {
                                const amount = Number(payment.amount || 0);
                                const receiptTypeLower = String((payment as any).receiptType || "").toLowerCase().trim();
                                const drCrLower = String((payment as any).drCr || "").toLowerCase().trim();
                                const isLedger = receiptTypeLower === "ledger";
                                const isLedgerCredit = isLedger && (drCrLower === "credit" || amount < 0);
                                const isLedgerDebit = isLedger && !isLedgerCredit;
                                const displayAmount = Math.abs(amount);
                                const sign = isLedgerCredit ? "+" : isLedgerDebit ? "-" : "";
                                const colorClass = isLedgerCredit
                                  ? "text-emerald-700"
                                  : isLedgerDebit
                                  ? "text-red-600"
                                  : "text-slate-900";
                                return (
                                  <span className={`font-extrabold truncate block ${colorClass}`}>
                                    {sign && `${sign} `}{formatCurrency(displayAmount)}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-[10px] px-3 py-1 w-[10%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-3 py-1 w-[8%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {historyType === 'rtgs' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                             <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                               <div className="flex flex-col">
                                 <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                                 {(payment as any).status === 'Pending' && (
                                   <span className="text-[8px] font-black text-amber-600 uppercase leading-none mt-0.5">Pending</span>
                                 )}
                               </div>
                             </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[14%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="text-muted-foreground truncate block font-medium">{accountHolderName}</span>
                                <span className="truncate block font-mono text-[9px] text-muted-foreground/80">{bankDetails.accountNo}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[16%] text-left align-middle">
                              <div className="flex flex-col">
                                <span className="truncate block font-medium">{bankDetails.bankName}</span>
                                <span className="truncate block text-[9px] text-muted-foreground/80">{bankDetails.bankBranch} / {bankDetails.bankIfsc}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="truncate block font-medium">{bankDetails.checkNo}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[28%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[10%] text-right align-middle">
                              {(() => {
                                const amount = Number(payment.amount || 0);
                                const receiptTypeLower = String((payment as any).receiptType || "").toLowerCase().trim();
                                const drCrLower = String((payment as any).drCr || "").toLowerCase().trim();
                                const isLedger = receiptTypeLower === "ledger";
                                const isLedgerCredit = isLedger && (drCrLower === "credit" || amount < 0);
                                const isLedgerDebit = isLedger && !isLedgerCredit;
                                const displayAmount = Math.abs(amount);
                                const sign = isLedgerCredit ? "+" : isLedgerDebit ? "-" : "";
                                const colorClass = isLedgerCredit
                                  ? "text-emerald-700"
                                  : isLedgerDebit
                                  ? "text-red-600"
                                  : "text-slate-900";
                                return (
                                  <span className={`font-extrabold truncate block ${colorClass}`}>
                                    {sign && `${sign} `}{formatCurrency(displayAmount)}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[6%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {historyType === 'gov' && (
                          <>
                            <TableCell className="text-[11px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="font-mono font-bold truncate block">{payment.paymentId || payment.id}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="text-muted-foreground truncate block font-medium">{paymentDate}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-left align-middle">
                              <span className="truncate block font-medium">{govDetails.name}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-left align-middle">
                              <span className="truncate block font-medium">{govDetails.fatherName}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[10%] text-left align-middle">
                              <span className="truncate block font-medium">{govDetails.address}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[7%] text-left align-middle">
                              <span className="truncate block font-medium">{centerName}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[7%] text-left align-middle">
                              <span className="truncate block font-medium">{payment.notes || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-left align-middle">
                              <span className="truncate block font-medium font-mono">{(payment as any).govRegistrationNo || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[8%] text-left align-middle">
                              <span className="truncate block font-medium">{receiptNumbers || '-'}</span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-right align-middle">
                              <span className="font-medium truncate block">
                                {(payment as any).govQuantity != null && (payment as any).govQuantity > 0 ? `${(payment as any).govQuantity.toFixed(2)} qtl` : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-right align-middle">
                              <span className="font-medium text-slate-800 truncate block">
                                {(payment as any).govRate != null && (payment as any).govRate > 0 ? formatCurrency((payment as any).govRate) : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-right align-middle">
                              <span className="font-medium text-primary truncate block">
                                {(payment as any).govExtraAmount != null && (payment as any).govExtraAmount > 0 ? formatCurrency((payment as any).govExtraAmount) : '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[6%] text-right align-middle">
                              {(() => {
                                const amount = Number(payment.amount || 0);
                                const receiptTypeLower = String((payment as any).receiptType || "").toLowerCase().trim();
                                const drCrLower = String((payment as any).drCr || "").toLowerCase().trim();
                                const isLedger = receiptTypeLower === "ledger";
                                const isLedgerCredit = isLedger && (drCrLower === "credit" || amount < 0);
                                const isLedgerDebit = isLedger && !isLedgerCredit;
                                const displayAmount = Math.abs(amount);
                                const sign = isLedgerCredit ? "+" : isLedgerDebit ? "-" : "";
                                const colorClass = isLedgerCredit
                                  ? "text-emerald-700"
                                  : isLedgerDebit
                                  ? "text-red-600"
                                  : "text-slate-900";
                                return (
                                  <span className={`font-extrabold truncate block ${colorClass}`}>
                                    {sign && `${sign} `}{formatCurrency(displayAmount)}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-[10px] px-2 py-1 w-[5%] text-right align-middle">
                              <span className="font-extrabold text-slate-700 truncate block">{cdAmount > 0 ? formatCurrency(cdAmount) : '-'}</span>
                            </TableCell>
                            <TableCell className="px-2 py-1 w-[5%] text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 hover:bg-red-500/10 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {(historyType === 'payment' || historyType === 'online' || historyType === 'ledger') && (
                          <>
                            <TableCell className="px-2 py-0.5 w-[8%] text-left align-top">
                              <div className="font-mono font-bold text-[10px] leading-none truncate">{payment.paymentId || payment.id}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-left align-top">
                              <div className="text-muted-foreground text-[9px] font-medium leading-none truncate">{paymentDate}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[22%] text-left align-top">
                              <div className="text-[9px] font-semibold leading-none truncate">{accountHolderName || '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[16%] text-left align-top">
                              <div className="text-[9px] text-muted-foreground font-medium leading-none truncate">{receiptNumbers || '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-right align-top">
                              <div className="text-[9px] font-semibold text-slate-700 leading-tight truncate">{extraAmount !== 0 ? formatCurrency(extraAmount) : '-'}</div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[12%] text-right align-top">
                              {(() => {
                                const amount = Number(payment.amount || 0);
                                const receiptTypeLower = String((payment as any).receiptType || "").toLowerCase().trim();
                                const drCrLower = String((payment as any).drCr || "").toLowerCase().trim();
                                const isLedger = receiptTypeLower === "ledger";
                                const isLedgerCredit = isLedger && (drCrLower === "credit" || amount < 0);
                                const isLedgerDebit = isLedger && !isLedgerCredit;
                                const displayAmount = Math.abs(amount);
                                const sign = isLedgerCredit ? "+" : isLedgerDebit ? "-" : "";
                                const colorClass = isLedgerCredit
                                  ? "text-emerald-700"
                                  : isLedgerDebit
                                  ? "text-rose-700"
                                  : "text-slate-900";
                                return (
                                  <div className={`text-[9px] font-semibold leading-tight truncate ${colorClass}`}>
                                    {amount !== 0 ? (
                                      <>
                                        {sign && `${sign} `}
                                        {formatCurrency(displayAmount)}
                                      </>
                                    ) : (
                                      "-"
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[8%] text-right align-top">
                              <div className="text-[9px] font-semibold text-slate-600 leading-tight truncate">
                                {cdAmount > 0 ? formatCurrency(cdAmount) : '-'}
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-0.5 w-[10%] text-center align-top">
                              <div className="flex items-center justify-center gap-1">
                                {onEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-primary/20 hover:text-primary"
                                    onClick={() => onEdit(payment)}
                                    title="Edit Payment"
                                  >
                                    <Pencil className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                                {onDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 hover:bg-red-500/20 hover:text-red-600"
                                    onClick={() => onDelete(payment)}
                                    title="Delete Payment"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })
                )}
                  {historyType === 'gov' && filteredByCenter.length > 0 && (
                    <TableRow className="h-6 bg-slate-100/90 hover:bg-slate-100/90 font-bold border-t-2 border-slate-300 text-slate-950 sticky bottom-0 z-10 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                      <TableCell colSpan={9} className="text-[10px] px-2 py-1.5 font-extrabold text-left align-middle">
                        TOTAL ({filteredByCenter.length} items)
                      </TableCell>
                      <TableCell className="text-[10px] px-2 py-1.5 font-extrabold text-right align-middle">
                        {govTotals.qty > 0 ? `${govTotals.qty.toFixed(2)} qtl` : '-'}
                      </TableCell>
                      <TableCell className="text-[10px] px-2 py-1.5 font-normal text-right align-middle text-muted-foreground">-</TableCell>
                      <TableCell className="text-[10px] px-2 py-1.5 font-extrabold text-right align-middle text-primary">
                        {govTotals.extra > 0 ? formatCurrency(govTotals.extra) : '-'}
                      </TableCell>
                      <TableCell className="text-[10px] px-2 py-1.5 font-extrabold text-right align-middle text-slate-900">
                        {govTotals.paid > 0 ? formatCurrency(govTotals.paid) : '-'}
                      </TableCell>
                      <TableCell className="text-[10px] px-2 py-1.5 font-extrabold text-right align-middle text-slate-700">
                        {govTotals.cd > 0 ? formatCurrency(govTotals.cd) : '-'}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 align-middle"></TableCell>
                    </TableRow>
                  )}
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={historyType === 'cash' ? 6 : historyType === 'rtgs' ? 9 : historyType === 'gov' ? 16 : (historyType === 'payment' || historyType === 'online' || historyType === 'ledger') ? 8 : 7} className="text-center text-[9px] text-muted-foreground py-2">
                        Loading...
                      </TableCell>
                    </TableRow>
                  )}
                  {!hasMore && !maxRows && sortedPayments.length > 30 && (
                    <TableRow>
                      <TableCell colSpan={historyType === 'cash' ? 6 : historyType === 'rtgs' ? 9 : historyType === 'gov' ? 16 : (historyType === 'payment' || historyType === 'online' || historyType === 'ledger') ? 8 : 7} className="text-center text-[9px] text-muted-foreground py-2">
                        Showing all {sortedPayments.length} payments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

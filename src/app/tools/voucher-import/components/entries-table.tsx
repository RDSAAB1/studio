"use client";

import React, { useState, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGlobalData } from "@/contexts/global-data-context";
import * as XLSX from "xlsx";
import { printHtmlContent } from "@/lib/electron-print";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { 
  Edit2, 
  Trash2, 
  Eye, 
  Printer, 
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";
import { displayDate } from "../utils/parser";
import type { CombinedEntry } from "../types";

import { db } from "@/lib/database";
import { useEffect } from "react";

interface EntriesTableProps {
  entries: CombinedEntry[];
  filteredEntries: CombinedEntry[];
  activeId: string | null;
  onSelect: (entry: CombinedEntry) => void;
  onDelete: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  onPreview: () => void;
  onPrint: () => void;
  onExport: () => void;
  filterFrom: Date | undefined;
  setFilterFrom: (date: Date | undefined) => void;
  filterTo: Date | undefined;
  setFilterTo: (date: Date | undefined) => void;
}

export const EntriesTable: React.FC<EntriesTableProps> = ({
  entries,
  filteredEntries,
  activeId,
  onSelect,
  onDelete,
  onBulkDelete,
  onPreview,
  onPrint,
  onExport,
  filterFrom,
  setFilterFrom,
  filterTo,
  setFilterTo,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentTab, setCurrentTab] = useState<string>("verified");
  const [localPayments, setLocalPayments] = useState<any[]>([]);
  // Single delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  // Bulk delete confirm state
  const [bulkDeletePending, setBulkDeletePending] = useState(false);

  const globalData = useGlobalData();

  // Directly fetch payments from IndexedDB (ignores context filters like company/season)
  useEffect(() => {
    const loadPayments = async () => {
      try {
        if (db && db.payments) {
          const allPayments = await db.payments.toArray();
          console.log("[EntriesTable] Loaded payments directly from Dexie:", allPayments.length);
          setLocalPayments(allPayments);
        }
      } catch (err) {
        console.error("[EntriesTable] Direct Dexie load of payments failed:", err);
      }
    };
    
    loadPayments();

    window.addEventListener("sqlite-change:payments", loadPayments);
    window.addEventListener("sqlite-change:all", loadPayments);

    return () => {
      window.removeEventListener("sqlite-change:payments", loadPayments);
      window.removeEventListener("sqlite-change:all", loadPayments);
    };
  }, []);

  const payments = localPayments;

  // Match Mandi Records with RTGS payments
  const officialDataRows = useMemo(() => {
    // Relax the filter: match any payment that has a valid bank account number, rather than strictly checking receiptType === "RTGS"
    const relevantPayments = payments.filter((p: any) => p.bankAcNo || p.bankDetails?.acNo);

    console.log("[Official Data Match] Total payments found in DB:", payments.length);
    console.log("[Official Data Match] Relevant payments with account numbers:", relevantPayments.length);

    const getParts = (dateInput: any) => {
      if (!dateInput) return null;
      try {
        if (typeof dateInput === 'string') {
          const trimmed = dateInput.trim();
          // Check if ISO string (contains 'T' or ends with 'Z')
          if (trimmed.includes("T") || trimmed.endsWith("Z")) {
            const dObj = new Date(trimmed);
            if (!isNaN(dObj.getTime())) {
              return {
                year: dObj.getFullYear(),
                month: dObj.getMonth(),
                day: dObj.getDate()
              };
            }
          }
          // Match YYYY-MM-DD
          const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
          if (ymdMatch) {
            return {
              year: parseInt(ymdMatch[1], 10),
              month: parseInt(ymdMatch[2], 10) - 1, // 0-indexed
              day: parseInt(ymdMatch[3], 10)
            };
          }
          // Match DD-MM-YYYY
          const dmyMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
          if (dmyMatch) {
            return {
              year: parseInt(dmyMatch[3], 10),
              month: parseInt(dmyMatch[2], 10) - 1, // 0-indexed
              day: parseInt(dmyMatch[1], 10)
            };
          }
          // Match DD-MMM-YY or DD-MMM-YYYY (e.g. 01-Jul-26, 01-Jul-2026)
          const dmyMonthNameMatch = trimmed.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
          if (dmyMonthNameMatch) {
            const months: Record<string, number> = {
              jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
              jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
            };
            const monthStr = dmyMonthNameMatch[2].toLowerCase();
            const month = months[monthStr] !== undefined ? months[monthStr] : 0;
            let year = parseInt(dmyMonthNameMatch[3], 10);
            if (year < 100) year += 2000;
            return {
              year,
              month,
              day: parseInt(dmyMonthNameMatch[1], 10)
            };
          }
        }
        
        const dObj = new Date(dateInput);
        if (isNaN(dObj.getTime())) return null;
        let year = dObj.getFullYear();
        // Safety fallback for 2-digit years parsed as 19xx
        if (year < 1970 && year > 1900) year += 100;
        return {
          year,
          month: dObj.getMonth(),
          day: dObj.getDate()
        };
      } catch {
        return null;
      }
    };

    const areDatesSameDay = (d1: any, d2: any) => {
      if (!d1 || !d2) return false;
      const p1 = getParts(d1);
      const p2 = getParts(d2);
      if (!p1 || !p2) return false;

      // 1. Direct Match
      const sameDirect = p1.year === p2.year && p1.month === p2.month && p1.day === p2.day;
      if (sameDirect) return true;

      // 2. Transposed Month/Day Match (e.g. p1 is 2026-07-01 and p2 is 2026-01-07)
      const transposedMatch = 
        p1.year === p2.year && 
        (p1.month + 1 === p2.day) && 
        (p1.day === p2.month + 1);

      return transposedMatch;
    };

    const areDatesCloseOrEmpty = (d1: any, d2: any, maxDays = 5) => {
      if (!d1 || !d2) return true;
      if (d1 === "—" || d2 === "—" || d1 === "-" || d2 === "-") return true;
      const p1 = getParts(d1);
      const p2 = getParts(d2);
      if (!p1 || !p2) return true;

      const date1 = new Date(p1.year, p1.month, p1.day);
      const date2 = new Date(p2.year, p2.month, p2.day);

      const diffTime = Math.abs(date1.getTime() - date2.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= maxDays;
    };

    const getRtgsDate = (p: any, entry: any) => {
      return p.date || p.sixRDate || "";
    };

    const cleanAmount = (val: any) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      try {
        const cleaned = String(val)
          .replace(/[₹,]/g, "") // Remove rupee symbol and commas
          .trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      } catch {
        return 0;
      }
    };

    const suppliersList = globalData?.suppliers || [];

    return filteredEntries.map(entry => {
      const eAc = String(entry.bankAccount || "").trim();
      const eAmt = cleanAmount(entry.grossAmount || entry.paymentAmount);
      
      // Filter payments that have a matching account number
      const sameAcPayments = relevantPayments.filter((p: any) => {
        const pAc = String(p.bankAcNo || p.bankDetails?.acNo || "").trim();
        return pAc && eAc && pAc === eAc;
      });

      // Find exact match (checks both p.date and p.sixRDate against Mandi pay date)
      let matchedRtgs = sameAcPayments.find((p: any) => {
        const pAmt = cleanAmount(p.rtgsAmount || p.amount);
        const isAmtMatch = Math.abs(pAmt - eAmt) <= 2;
        
        let isDateMatch = false;
        const targetDate = entry.paymentDate; // Only Mandi Pay Date
        
        if (targetDate) {
          isDateMatch = 
            areDatesSameDay(p.date, targetDate) || 
            areDatesSameDay(p.sixRDate, targetDate) || 
            areDatesCloseOrEmpty(p.date, targetDate, 5) ||
            areDatesCloseOrEmpty(p.sixRDate, targetDate, 5);
        } else {
          isDateMatch = true; // Fallback if Mandi Pay Date is missing entirely
        }
        
        return isAmtMatch && isDateMatch;
      });

      // Diagnostic fields initialization
      let diag = {
        ac: "❌ (No candidate)",
        amt: "❌ (No candidate)",
        date: "❌ (No candidate)"
      };

      let matchStatus = {
        ac: false,
        amt: false,
        date: false
      };

      if (matchedRtgs) {
        diag = {
          ac: "✅ MATCH",
          amt: "✅ MATCH",
          date: "✅ MATCH"
        };
        matchStatus = {
          ac: true,
          amt: true,
          date: true
        };
      } else {
        // If not exact match, find closest candidate matching by account
        const candidate = sameAcPayments[0];
        if (candidate) {
          const pAmt = cleanAmount(candidate.rtgsAmount || candidate.amount);
          const isAmtMatch = Math.abs(pAmt - eAmt) <= 2;
          let isDateMatch = false;
          if (entry.paymentDate) {
            isDateMatch = 
              areDatesSameDay(candidate.date, entry.paymentDate) || 
              areDatesSameDay(candidate.sixRDate, entry.paymentDate);
          }
          const diagDateDisplay = candidate.sixRDate && entry.paymentDate && (areDatesSameDay(candidate.sixRDate, entry.paymentDate) || areDatesCloseOrEmpty(candidate.sixRDate, entry.paymentDate, 5)) ? candidate.sixRDate : candidate.date;
          diag = {
            ac: "✅ MATCH",
            amt: isAmtMatch ? "✅ MATCH" : `❌ (${pAmt} vs ${eAmt})`,
            date: isDateMatch ? "✅ MATCH" : `❌ (${displayDate(diagDateDisplay)} vs ${displayDate(entry.paymentDate)})`
          };
          matchStatus = {
            ac: true,
            amt: isAmtMatch,
            date: isDateMatch
          };
        } else {
          // No candidate with same account. Check if any candidate has same amount
          const sameAmtPayments = relevantPayments.filter((p: any) => {
            const pAmt = cleanAmount(p.rtgsAmount || p.amount);
            return Math.abs(pAmt - eAmt) <= 2;
          });
          const candidateAmt = sameAmtPayments[0];
          if (candidateAmt) {
            const pAc = String(candidateAmt.bankAcNo || candidateAmt.bankDetails?.acNo || "").trim();
            let isDateMatch = false;
            if (entry.paymentDate) {
              isDateMatch = 
                areDatesSameDay(candidateAmt.date, entry.paymentDate) || 
                areDatesSameDay(candidateAmt.sixRDate, entry.paymentDate);
            }
            const diagDateDisplay = candidateAmt.sixRDate && entry.paymentDate && (areDatesSameDay(candidateAmt.sixRDate, entry.paymentDate) || areDatesCloseOrEmpty(candidateAmt.sixRDate, entry.paymentDate, 5)) ? candidateAmt.sixRDate : candidateAmt.date;
            diag = {
              ac: `❌ (${pAc || "Empty"} vs ${eAc || "Empty"})`,
              amt: "✅ MATCH",
              date: isDateMatch ? "✅ MATCH" : `❌ (${displayDate(diagDateDisplay)} vs ${displayDate(entry.paymentDate)})`
            };
            matchStatus = {
              ac: false,
              amt: true,
              date: isDateMatch
            };
          }
        }
      }

      let payeeName = "";
      let fatherName = "";
      let supplierAddress = "";
      let parchiNo = "";
      let rt = null;

      if (matchedRtgs) {
        let actualSupplierName = "";
        let actualFatherName = "";
        let receiptSrNo = "";
        
        let actualAddress = "";
        
        const matchedParchiNo = matchedRtgs.parchiNo || (matchedRtgs.paidFor?.map((pf: any) => pf.srNo).join(', ') || "");
        if (matchedParchiNo) {
          const firstPart = matchedParchiNo.split(',')[0].trim();
          if (firstPart) receiptSrNo = firstPart;
        }
        if (!receiptSrNo && matchedRtgs.paidFor && matchedRtgs.paidFor.length > 0) {
          receiptSrNo = matchedRtgs.paidFor[0].srNo || '';
        }

        if (receiptSrNo) {
          const matchedReceipt = suppliersList.find((s: any) => 
            String(s.srNo).trim().toLowerCase() === String(receiptSrNo).trim().toLowerCase()
          );
          if (matchedReceipt) {
            actualSupplierName = matchedReceipt.name || '';
            actualFatherName = matchedReceipt.fatherName || matchedReceipt.so || '';
            actualAddress = matchedReceipt.address || '';
          }
        }

        payeeName = actualSupplierName || matchedRtgs.supplierName || "";
        fatherName = actualFatherName || matchedRtgs.supplierFatherName || "";
        supplierAddress = actualAddress || matchedRtgs.supplierAddress || (matchedRtgs.supplierDetails as any)?.address || "";
        parchiNo = matchedParchiNo;

        let rtgsDate = matchedRtgs.date || "";
        if (matchedRtgs.sixRDate && entry.paymentDate) {
          if (areDatesSameDay(matchedRtgs.sixRDate, entry.paymentDate) || areDatesCloseOrEmpty(matchedRtgs.sixRDate, entry.paymentDate, 5)) {
            rtgsDate = matchedRtgs.sixRDate;
          }
        }

        rt = {
          srNo: matchedRtgs.rtgsSrNo || matchedRtgs.paymentId || "",
          date: rtgsDate,
          checkNo: matchedRtgs.checkNo || "",
          utrNo: matchedRtgs.utrNo || "",
          amount: cleanAmount(matchedRtgs.rtgsAmount || matchedRtgs.amount),
          from: matchedRtgs.from || "",
          payeeName,
          fatherName,
          address: supplierAddress,
          parchiNo,
        };
      }

      return {
        ...entry,
        diagnostics: diag,
        matchStatus,
        rt
      };
    });
  }, [filteredEntries, payments, globalData?.suppliers]);

  const allSelected = filteredEntries.length > 0 && filteredEntries.every(e => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmSingleDelete = (entry: CombinedEntry) => {
    const label = [entry.sellerName, entry.voucherNo].filter(Boolean).join(" — ") || entry.id;
    setDeleteTarget({ id: entry.id, label });
  };

  const executeSingleDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const executeBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (onBulkDelete) {
      onBulkDelete(ids);
    } else {
      ids.forEach(id => onDelete(id));
    }
    setSelectedIds(new Set());
    setBulkDeletePending(false);
  };

  // Custom print format for Official Data
  const handlePrintOfficial = async () => {
    const printHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">Official Mandi & RTGS Report</h2>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">Date: ${displayDate(new Date().toISOString())}</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">#</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">Date<br/>(6R / RTGS)</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">Farmer Details<br/>(Mandi)</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">6R No. /<br/>Variety</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">Amount<br/>(Mandi)</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">Bank Account<br/>(A/C / IFSC)</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">Gata /<br/>Check No</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">RTGS<br/>Parchi No</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">RTGS<br/>UTR</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">RTGS<br/>Amount</th>
            <th style="border: 1px solid #d1d5db; padding: 6px; font-size: 10.5px;">RTGS Payee<br/>Details</th>
          </tr>
        </thead>
        <tbody>
          ${officialDataRows.map((row, idx) => {
            const utrValRaw = row.transactionNumber || row.narration || "";
            const cleanedUtr = utrValRaw.replace(/\D/g, "");
            const utrDisplay = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr) ? "TRANSFER" : utrValRaw;
            const mandiFarmer = [row.sellerName, row.fatherName ? `S/O: ${row.fatherName}` : null, row.village].filter(Boolean).join(", ");
            const rtgsPayee = row.rt ? [row.rt.payeeName, row.rt.fatherName ? `S/O: ${row.rt.fatherName}` : null, row.rt.address].filter(Boolean).join(", ") : "—";
            const shortVoucherNo = row.voucherNo ? row.voucherNo.split("/").pop() : "—";
            const cropVariety = (row.variety && row.variety !== "—" && row.variety !== "null") ? row.variety : (row.commodity || "धान");
            return `
              <tr style="background-color: #ffffff;">
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">
                  <span style="color: #1e3a8a; font-weight: bold;">${displayDate(row.purchaseDate)}</span><br/>
                  <span style="color: #ea580c; font-size: 9px; font-weight: bold;">${row.rt ? displayDate(row.rt.date) : "—"}</span>
                </td>
                <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 500;">${mandiFarmer}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">
                  <b style="font-size: 11px; color: #111827;">${shortVoucherNo}</b><br/>
                  <small style="color: #4b5563; font-size: 9px; font-weight: 500;">${cropVariety}</small>
                </td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-weight: bold; color: #1e3a8a;">
                  ${(row.grossAmount || 0).toFixed(0)}
                </td>
                <td style="border: 1px solid #d1d5db; padding: 6px; font-weight: 500;">${row.bankAccount}<br/><small style="font-size: 9px; color: #4b5563;">${row.ifsc}</small></td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: left;">
                  <span style="color: #1e3a8a; font-weight: bold;">${row.khasraNo || "—"}</span><br/>
                  <span style="color: #ea580c; font-size: 9px; font-weight: bold;">${row.rt ? row.rt.checkNo || "—" : "—"}</span>
                </td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: left; font-weight: 500;">${row.rt ? row.rt.parchiNo || "—" : "—"}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: left; color: #1d4ed8; font-weight: bold;">${utrDisplay || "—"}</td>
                <td style="border: 1px solid #d1d5db; padding: 6px; text-align: right; font-weight: bold; color: #ea580c;">
                  ${row.rt ? row.rt.amount.toFixed(0) : "—"}
                </td>
                <td style="border: 1px solid #d1d5db; padding: 6px; color: #111827; font-weight: bold;">
                  ${rtgsPayee}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    const printStyles = `
      @page { size: landscape; margin: 5mm; }
      * {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }
      body { 
        color: #000000;
        background-color: #ffffff;
      }
      h2 {
        font-weight: 700 !important;
      }
      th, b, strong, td[style*="font-weight: bold"], td[style*="font-weight:bold"] {
        font-weight: 600 !important;
      }
    `;
    await printHtmlContent(printHTML, printStyles);
  };

  // Custom Excel Export for Official Data
  const handleExportOfficialExcel = () => {
    const dataToExport = officialDataRows.map((e, idx) => {
      const utrValRaw = e.transactionNumber || e.narration || "";
      const cleanedUtr = utrValRaw.replace(/\D/g, "");
      const utrDisplay = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr) ? "TRANSFER" : utrValRaw;
      return {
        "SR. NO.": idx + 1,
        "6R DATE": displayDate(e.purchaseDate),
        "FARMER NAME": e.sellerName,
        "FATHER NAME": e.fatherName || "",
        ADDRESS: e.village || "",
        MOBILE: e.mobile || "",
        "GAATA NO": e.khasraNo || "",
        "6R NUMBER": e.voucherNo || "",
        QUANTITY: e.quantityQtl || 0,
        RATE: e.ratePerQtl || 0,
        GROSS: e.grossAmount || 0,
        "MANDI FEE": e.mandiFee || 0,
        CESS: e.developmentCess || 0,
        "TOT MANDI FEE": e.totalCharges || 0,
        "PAY DATE": displayDate(e.paymentDate),
        "BANK ACCOUNT": e.bankAccount || "",
        IFSC: e.ifsc || "",
        "RTGS SR NO": e.rt ? e.rt.srNo : "",
        "RTGS DATE": e.rt ? displayDate(e.rt.date) : "",
        "RTGS AMOUNT": e.rt ? e.rt.amount : "",
        "RTGS PAYEE": e.rt ? e.rt.payeeName : "",
        "RTGS FATHER": e.rt ? e.rt.fatherName : "",
        "RTGS ADDRESS": e.rt ? e.rt.address : "",
        "RTGS PARCHI NO": e.rt ? e.rt.parchiNo : "",
        "RTGS CHECK NO": e.rt ? e.rt.checkNo : "",
        "RTGS UTR": utrDisplay || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Official Mandi Report");
    const filename = `Official_Mandi_Report_${displayDate(new Date().toISOString())}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <>
      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base font-black">Record Delete करें?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm leading-relaxed pl-[52px]">
              <span className="font-bold text-foreground block mb-1">{deleteTarget?.label}</span>
              यह record permanently delete हो जाएगा और दूसरे systems से भी हट जाएगा। यह action वापस नहीं होगी।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs font-bold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeSingleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-black"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              हाँ, Delete करें
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeletePending} onOpenChange={setBulkDeletePending}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-destructive/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base font-black">{selectedIds.size} Records Delete करें?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm leading-relaxed pl-[52px]">
              आपने <span className="font-black text-foreground">{selectedIds.size} records</span> select किए हैं।
              ये सभी permanently delete हो जाएंगे और दूसरे systems से भी हट जाएंगे। यह action वापस नहीं होगी।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs font-bold">रद्द करें</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-black"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              हाँ, {selectedIds.size} Delete करें
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full space-y-4">
        <TabsList className="bg-muted p-1 rounded-xl max-w-[420px] grid grid-cols-2">
          <TabsTrigger value="verified" className="text-xs font-black uppercase tracking-wider">
            Verified Mandi Records
          </TabsTrigger>
          <TabsTrigger value="official" className="text-xs font-black uppercase tracking-wider">
            Official Data (RTGS Combined)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="verified">
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                     Verified Mandi Records
                     <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                       {filteredEntries.length} Items
                     </span>
                     {someSelected && (
                       <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-bold animate-pulse">
                         {selectedIds.size} Selected
                       </span>
                     )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Review and manage parsed voucher entries before final sync.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {someSelected && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setBulkDeletePending(true)}
                      className="h-8 text-[10px] font-black uppercase tracking-widest gap-1.5 shadow-red-500/20 shadow-lg animate-in fade-in slide-in-from-left-2 duration-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete {selectedIds.size} Selected
                    </Button>
                  )}
                  <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/30">
                     <SmartDatePicker
                       value={filterFrom}
                       onChange={(val) => setFilterFrom(val instanceof Date ? val : val ? new Date(val) : undefined)}
                       placeholder="From"
                       inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                       returnDate={true}
                     />
                     <div className="w-px h-4 bg-border/50" />
                     <SmartDatePicker
                       value={filterTo}
                       onChange={(val) => setFilterTo(val instanceof Date ? val : val ? new Date(val) : undefined)}
                       placeholder="To"
                       inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                       returnDate={true}
                     />
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={onPreview}
                       disabled={!filteredEntries.length}
                       className="h-8 text-[10px] font-black uppercase tracking-widest"
                     >
                       <Eye className="mr-1.5 h-3.5 w-3.5" />
                       Preview
                     </Button>
                     <Button
                       size="sm"
                       onClick={onPrint}
                       disabled={!filteredEntries.length}
                       className="h-8 text-[10px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 shadow-blue-500/10 shadow-lg"
                     >
                       <Printer className="mr-1.5 h-3.5 w-3.5" />
                       Print
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={onExport}
                       disabled={!entries.length}
                       className="h-8 text-[10px] font-black uppercase tracking-widest"
                     >
                       <Download className="mr-1.5 h-3.5 w-3.5" />
                       Excel
                     </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full max-h-[500px] overflow-auto custom-scrollbar">
                <div className="min-w-[1800px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-20 shadow-sm border-b">
                      <TableRow className="hover:bg-transparent border-0">
                        <TableHead className="w-10 text-center h-11 pl-3">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label="Select all"
                            className="border-muted-foreground/50"
                          />
                        </TableHead>
                        <TableHead className="w-12 text-center text-[10px] font-black uppercase tracking-wider h-11">#</TableHead>
                        <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">6R DATE</TableHead>
                        <TableHead className="min-w-[300px] text-[10px] font-black uppercase tracking-wider h-11">Farmer / Father / Address</TableHead>
                        <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Mobile</TableHead>
                        <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Gata No</TableHead>
                        <TableHead className="w-32 text-center text-[10px] font-black uppercase tracking-wider h-11">6R No</TableHead>
                        <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">QTY</TableHead>
                        <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Rate</TableHead>
                        <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">Amount</TableHead>
                        <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Fee</TableHead>
                        <TableHead className="w-24 text-right text-[10px] font-black uppercase tracking-wider h-11">Cess</TableHead>
                        <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">Total Fee</TableHead>
                        <TableHead className="w-28 text-center text-[10px] font-black uppercase tracking-wider h-11">Pay Date</TableHead>
                        <TableHead className="w-40 text-center text-[10px] font-black uppercase tracking-wider h-11">Account No</TableHead>
                        <TableHead className="w-32 text-center text-[10px] font-black uppercase tracking-wider h-11">IFSC</TableHead>
                        <TableHead className="w-40 text-center text-[10px] font-black uppercase tracking-wider h-11">UTR</TableHead>
                        <TableHead className="w-24 text-center text-[10px] font-black uppercase tracking-wider h-11 sticky right-0 bg-muted/80 backdrop-blur-md">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry, index) => {
                        const isSelected = selectedIds.has(entry.id);
                        const totalFee = entry.totalCharges || Math.round(((entry.mandiFee || 0) + (entry.developmentCess || 0)) * 100) / 100;
                        const farmerLine = [entry.sellerName, entry.fatherName ? `S/O: ${entry.fatherName}` : null, entry.village].filter(Boolean).join(", ");
                        const utrValRaw = entry.transactionNumber || entry.narration || "";
                        const cleanedUtr = utrValRaw.replace(/\D/g, "");
                        const utrDisplay = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr) ? "TRANSFER" : utrValRaw;

                        return (
                          <TableRow 
                            key={entry.id} 
                            className={`hover:bg-primary/5 transition-colors border-border/40 ${
                              isSelected ? "bg-destructive/5 hover:bg-destructive/8" : activeId === entry.id ? "bg-primary/10" : ""
                            }`}
                          >
                            <TableCell className="text-center py-2 pl-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(entry.id)}
                                aria-label={`Select row ${index + 1}`}
                                className="border-muted-foreground/50"
                              />
                            </TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-bold text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-bold whitespace-nowrap">{displayDate(entry.purchaseDate)}</TableCell>
                            <TableCell className="py-2 text-[11px] font-bold tracking-tight">{farmerLine}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-medium">{entry.mobile || "—"}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-medium">{entry.khasraNo || "—"}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 whitespace-nowrap font-black">{entry.voucherNo || "—"}</TableCell>
                            <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-bold text-primary">{(entry.quantityQtl || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-medium">{(entry.ratePerQtl || 0).toFixed(0)}</TableCell>
                            <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-black">{(entry.grossAmount || 0).toFixed(0)}</TableCell>
                            <TableCell className="text-right text-[10px] py-2 whitespace-nowrap font-medium">{(entry.mandiFee || 0).toFixed(0)}</TableCell>
                            <TableCell className="text-right text-[10px] py-2 whitespace-nowrap font-medium">{(entry.developmentCess || 0).toFixed(0)}</TableCell>
                            <TableCell className="text-right text-[11px] py-2 whitespace-nowrap font-black text-blue-600">{totalFee.toFixed(0)}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-bold whitespace-nowrap">{displayDate(entry.paymentDate)}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-medium tracking-tighter">{entry.bankAccount || "—"}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-medium">{entry.ifsc || "—"}</TableCell>
                            <TableCell className="text-center text-[10px] py-2 font-bold text-muted-foreground whitespace-nowrap truncate max-w-[150px]">{utrDisplay || "—"}</TableCell>
                            <TableCell className="text-center py-2 sticky right-0 bg-transparent backdrop-blur-md">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-primary/20 hover:text-primary transition-all" onClick={() => onSelect(entry)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all" 
                                  onClick={() => confirmSingleDelete(entry)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={18} className="text-center py-24 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                            No records found in current view
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="official">
          <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden border-t-4 border-emerald-500">
            <CardHeader className="border-b border-border/50 pb-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight flex items-center gap-2">
                     Official Data View
                     <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                       {officialDataRows.length} Total
                     </span>
                     <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold">
                       {officialDataRows.filter(r => r.rt).length} Matched
                     </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Combined view of Mandi Scraper and Bank RTGS payment data matched by account number, amount, and date.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border border-border/30">
                     <SmartDatePicker
                       value={filterFrom}
                       onChange={(val) => setFilterFrom(val instanceof Date ? val : val ? new Date(val) : undefined)}
                       placeholder="From"
                       inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                       returnDate={true}
                     />
                     <div className="w-px h-4 bg-border/50" />
                     <SmartDatePicker
                       value={filterTo}
                       onChange={(val) => setFilterTo(val instanceof Date ? val : val ? new Date(val) : undefined)}
                       placeholder="To"
                       inputClassName="h-8 w-28 text-[11px] font-bold border-0 bg-transparent"
                       returnDate={true}
                     />
                  </div>
                  <div className="flex items-center gap-2">
                     <Button
                       size="sm"
                       onClick={handlePrintOfficial}
                       disabled={!officialDataRows.length}
                       className="h-8 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10 shadow-lg"
                     >
                       <Printer className="mr-1.5 h-3.5 w-3.5" />
                       Print Official Report
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={handleExportOfficialExcel}
                       disabled={!officialDataRows.length}
                       className="h-8 text-[10px] font-black uppercase tracking-widest border-emerald-600/30 text-emerald-600 hover:bg-emerald-600/5"
                     >
                       <Download className="mr-1.5 h-3.5 w-3.5" />
                       Export Official Excel
                     </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full max-h-[500px] overflow-auto custom-scrollbar">
                <div className="min-w-[1200px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-20 shadow-sm border-b">
                      <TableRow className="hover:bg-transparent border-0">
                        <TableHead className="w-10 text-center text-[10px] font-black uppercase tracking-wider h-11">#</TableHead>
                        <TableHead className="w-24 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>Date</span>
                            <span className="text-[8.5px] text-muted-foreground font-medium normal-case">(6R / RTGS)</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-24 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>Match</span>
                            <span>Status</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[280px] text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>Farmer Details</span>
                            <span className="text-[8.5px] text-muted-foreground font-medium normal-case">(Mandi)</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-32 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>6R No. /</span>
                            <span>Variety</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight items-end">
                            <span>Amount</span>
                            <span className="text-[8.5px] text-muted-foreground font-medium normal-case">(Mandi)</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-32 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>Bank Details</span>
                            <span className="text-[8.5px] text-muted-foreground font-medium normal-case">(A/C / IFSC)</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-24 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>Gata /</span>
                            <span>Check No</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-24 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>RTGS</span>
                            <span>Parchi No</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-32 text-left text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>RTGS</span>
                            <span>UTR</span>
                          </div>
                        </TableHead>
                        <TableHead className="w-28 text-right text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight items-end">
                            <span>RTGS</span>
                            <span>Amount</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[280px] text-[10px] font-black uppercase tracking-wider h-11">
                          <div className="flex flex-col leading-tight">
                            <span>RTGS Payee</span>
                            <span>Details</span>
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:nth-child(odd)]:bg-transparent [&_tr:nth-child(even)]:bg-transparent">
                      {officialDataRows.map((row, index) => {
                        const farmerLine = [row.sellerName, row.fatherName ? `S/O: ${row.fatherName}` : null, row.village].filter(Boolean).join(", ");
                        const utrValRaw = row.transactionNumber || row.narration || "";
                        const cleanedUtr = utrValRaw.replace(/\D/g, "");
                        const utrDisplay = cleanedUtr && (cleanedUtr.length === 5 || cleanedUtr.length === 6) && /^\d+$/.test(cleanedUtr) ? "TRANSFER" : utrValRaw;
                        
                        // Extract only the last portion of 6R Number (e.g. 35040315(190)/6P/00573 -> 00573)
                        const shortVoucherNo = row.voucherNo ? row.voucherNo.split("/").pop() : "—";

                        return (
                          <TableRow 
                            key={`official-${row.id}-${index}`} 
                            className={`hover:bg-slate-50 transition-colors border-b border-border/60 bg-white ${
                              row.rt 
                                ? "border-l-4 border-l-orange-500" 
                                : "border-l-4 border-l-rose-500"
                            }`}
                          >
                            <TableCell className="text-center text-[11px] py-2 font-bold text-slate-800">{index + 1}</TableCell>
                            <TableCell className="text-left text-[11px] py-2 whitespace-nowrap text-slate-900">
                              <div className="flex flex-col font-semibold leading-tight">
                                <span className="text-blue-900 font-bold">{displayDate(row.purchaseDate)}</span>
                                {row.rt ? (
                                  <span className="text-orange-600 text-[10px] font-bold">
                                    {displayDate(row.rt.date)}
                                  </span>
                                ) : (
                                  <span className="text-rose-700 text-[10px]">
                                    —
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-[10px]">
                              <div className="flex flex-col gap-0.5 leading-none font-semibold whitespace-nowrap">
                                <span className={row.matchStatus.date ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                  Dt: {row.matchStatus.date ? "✅" : "❌"}
                                </span>
                                <span className={row.matchStatus.ac ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                  A/C: {row.matchStatus.ac ? "✅" : "❌"}
                                </span>
                                <span className={row.matchStatus.amt ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                  Amt: {row.matchStatus.amt ? "✅" : "❌"}
                                </span>
                              </div>
                              {row.rt ? (
                                <div className="mt-1.5 text-[8.5px] text-emerald-600 font-medium leading-tight max-w-[130px] whitespace-normal border-t border-emerald-100 pt-1 flex flex-col gap-0.5 animate-in fade-in duration-300">
                                  <div>Dt: {displayDate(row.rt.date)}</div>
                                  <div className="truncate" title={row.bankAccount}>A/C: {row.bankAccount}</div>
                                  <div>Amt: {row.rt.amount.toFixed(0)}</div>
                                </div>
                              ) : (
                                (!row.matchStatus.date || !row.matchStatus.ac || !row.matchStatus.amt) && (
                                  <div className="mt-1.5 text-[8.5px] text-rose-500 font-medium leading-tight max-w-[130px] whitespace-normal border-t border-rose-100 pt-1 flex flex-col gap-0.5">
                                    {!row.matchStatus.ac && <div className="truncate" title={row.diagnostics.ac}>A/C: {row.diagnostics.ac.replace("❌", "").trim()}</div>}
                                    {!row.matchStatus.amt && <div>Amt: {row.diagnostics.amt.replace("❌", "").trim()}</div>}
                                    {!row.matchStatus.date && <div className="truncate" title={row.diagnostics.date}>Dt: {row.diagnostics.date.replace("❌", "").trim()}</div>}
                                  </div>
                                )
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-slate-950 font-semibold">
                              {farmerLine}
                            </TableCell>
                            <TableCell className="text-left text-[11px] py-2 text-slate-900">
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold text-slate-950">{shortVoucherNo}</span>
                                <span className="text-[10px] text-slate-600 font-medium">
                                  {(row.variety && row.variety !== "—" && row.variety !== "null") ? row.variety : (row.commodity || "धान")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-2 font-bold text-[11px] text-blue-900">
                              {(row.grossAmount || 0).toFixed(0)}
                            </TableCell>
                            <TableCell className="text-left text-[11px] py-2 text-slate-900">
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold tracking-tighter text-slate-950">{row.bankAccount || "—"}</span>
                                <span className="text-[10px] text-slate-700">{row.ifsc || "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-left text-[11px] py-2 text-slate-900">
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold text-blue-900">{row.khasraNo || "—"}</span>
                                {row.rt ? (
                                  <span className="text-orange-600 text-[10px] font-semibold">
                                    {row.rt.checkNo || "—"}
                                  </span>
                                ) : (
                                  <span className="text-rose-700 text-[10px]">
                                    —
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-left text-[11px] py-2 font-medium text-slate-900 whitespace-nowrap">
                              {row.rt ? row.rt.parchiNo || "—" : "—"}
                            </TableCell>
                            <TableCell className="text-left text-[11px] py-2 font-semibold text-blue-800 whitespace-nowrap">
                              {utrDisplay || "—"}
                            </TableCell>
                            <TableCell className="text-right py-2 font-bold text-[11px] text-orange-600">
                              {row.rt ? row.rt.amount.toFixed(0) : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-slate-950 font-semibold">
                              {row.rt ? [row.rt.payeeName, row.rt.fatherName ? `S/O: ${row.rt.fatherName}` : null, row.rt.address].filter(Boolean).join(", ") : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {officialDataRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-24 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-50">
                            No records found in current view
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
};


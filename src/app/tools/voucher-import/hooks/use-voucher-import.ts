import { useState, useCallback, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  addMandiReport, 
  updateMandiReport, 
  deleteMandiReport, 
  fetchMandiReports,
  bulkAddMandiReports
} from "@/lib/firestore";
import type { CombinedEntry, ParseResult } from "../types";
import { parseBothBlocks, mergeBlocks, normalizeEntryDates, sanitize } from "../utils/parser";
import { displayDate } from "@/lib/formatters";

export const emptyEntry: CombinedEntry = {
  id: "",
  voucherNo: "",
  bookNo: "",
  purchaseDate: "",
  sellerName: "",
  fatherName: "",
  district: "",
  tehsil: "",
  village: "",
  khasraNo: "",
  khasraArea: "",
  mobile: "",
  commodity: "",
  quantityQtl: 0,
  ratePerQtl: 0,
  grossAmount: 0,
  mandiFee: 0,
  developmentCess: 0,
  totalCharges: 0,
  paymentAmount: 0,
  paymentDate: "",
  paymentMode: "",
  bankAccount: "",
  ifsc: "",
  bankName: "",
  bankBranch: "",
  transactionNumber: "",
  traderReceiptNo: "",
  narration: "",
};

export function useVoucherImport() {
  const { toast } = useToast();
  const [voucherInput, setVoucherInput] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CombinedEntry>(emptyEntry);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [filterFrom, setFilterFrom] = useState<Date | undefined>(undefined);
  const [filterTo, setFilterTo] = useState<Date | undefined>(undefined);
  const [importProgress, setImportProgress] = useState<{ active: boolean; done: number; total: number } | null>(null);

  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);

  // Load existing entries from database and listen for real-time changes
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const fetched = await fetchMandiReports();
        if (fetched) {
          setEntries(fetched.map(normalizeEntryDates));
        }
      } catch (error) {
        console.error("Failed to load mandi reports:", error);
      }
    };

    loadEntries();

    // Auto-refresh UI whenever database updates (locally or via sync from another device)
    const handleDatabaseChange = () => {
      console.log("[useVoucherImport] Database updated, reloading records dynamically...");
      loadEntries();
    };

    window.addEventListener("sqlite-change:mandiReports", handleDatabaseChange);
    window.addEventListener("sqlite-change:all", handleDatabaseChange);

    return () => {
      window.removeEventListener("sqlite-change:mandiReports", handleDatabaseChange);
      window.removeEventListener("sqlite-change:all", handleDatabaseChange);
    };
  }, []);

  // Set up listeners for communication with eMandi Chrome extension
  useEffect(() => {
    const handleStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.installed) {
        console.log("eMandi App: Scraper extension detected as active.");
        setIsExtensionInstalled(true);
      }
    };
    window.addEventListener("eMandiExtensionStatus", handleStatus);

    const handleSync = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const records = customEvent.detail?.records || [];
      
      if (records.length === 0) {
        toast({
          title: "Extension Import",
          description: "No new records found in the extension storage database.",
          variant: "destructive"
        });
        return;
      }

      // Parse all records first (fast, no I/O)
      const parsedEntries: CombinedEntry[] = [];
      for (const record of records) {
        if (!record.tableCache) continue;
        const sellerParts = record.tableCache.farmerDetails.split(", S/O: ");
        const sellerName = sellerParts[0] || record.seller || "";
        const fatherAndVillage = sellerParts[1] || "";
        const fatherParts = fatherAndVillage.split(", ");
        const fatherName = fatherParts[0] || "";
        const village = fatherParts.slice(1).join(", ") || "";
        const entry: CombinedEntry = {
          id: record.prapatraNumber,
          voucherNo: record.prapatraNumber,
          bookNo: record.printDetails?.["पुस्तक संख्या"] || "",
          purchaseDate: record.tableCache.date || "",
          sellerName, fatherName, village,
          district: "", tehsil: "",
          khasraNo: record.tableCache.khasra || "",
          khasraArea: "",
          mobile: record.tableCache.mobile || "",
          commodity: record.tableCache.commodity || record.crop || "धान",
          variety: record.tableCache.variety || "",
          quantityQtl: Number(record.tableCache.qty) || 0,
          ratePerQtl: Number(record.tableCache.rate) || 0,
          grossAmount: Number(record.tableCache.amt) || 0,
          mandiFee: Number(record.tableCache.fee) || 0,
          developmentCess: Number(record.tableCache.cess) || 0,
          totalCharges: Number(record.tableCache.total) || 0,
          paymentAmount: Number(record.tableCache.amt) || 0,
          paymentDate: record.tableCache.payDate || "",
          paymentMode: record.paymentDetails?.["भुगतान का मोड"] || "RTGS/NEFT",
          bankAccount: record.tableCache.accNo || "",
          ifsc: record.tableCache.ifsc || "",
          bankName: "", bankBranch: "",
          transactionNumber: record.tableCache.utr || "",
          traderReceiptNo: record.paymentDetails?.["व्यापारी द्वारा किसान को दी गयी रसीद संख्या"] || "",
          narration: record.paymentDetails?.["अन्य विवरण"] || "",
        };
        parsedEntries.push(normalizeEntryDates(entry));
      }

      if (parsedEntries.length === 0) return;

      // Show progress UI
      setImportProgress({ active: true, done: 0, total: parsedEntries.length });

      try {
        // BULK save — one Dexie bulkPut + one Firebase batch = FAST
        const result = await bulkAddMandiReports(parsedEntries, (done, total) => {
          setImportProgress({ active: true, done, total });
        });

        // Merge into local state
        setEntries(prev => {
          const map = new Map(prev.map(e => [e.voucherNo, e]));
          parsedEntries.forEach(e => map.set(e.voucherNo, e));
          return Array.from(map.values());
        });

        window.dispatchEvent(new CustomEvent("eMandiClearRecords"));

        toast({
          title: "Import Successful! ✅",
          description: `${result.saved} records imported and synced to all devices.`,
          variant: "success"
        });
      } catch (err) {
        toast({ title: "Import Failed", description: "Could not save records.", variant: "destructive" });
      } finally {
        setImportProgress(null);
      }
    };

    window.addEventListener("eMandiSyncData", handleSync);

    // Broadcast that the app is ready for status handshake
    window.dispatchEvent(new CustomEvent("eMandiAppReady"));

    return () => {
      window.removeEventListener("eMandiExtensionStatus", handleStatus);
      window.removeEventListener("eMandiSyncData", handleSync);
    };
  }, [entries, toast]);

  const triggerExtensionSync = useCallback(() => {
    console.log("eMandi App: Requesting sync from extension...");
    window.dispatchEvent(new CustomEvent("eMandiRequestSync"));
  }, []);

  const resetForm = useCallback(() => {
    setActiveId(null);
    setFormState(emptyEntry);
  }, []);

  const handleFieldChange = (field: keyof CombinedEntry, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleParse = () => {
    const result: ParseResult = parseBothBlocks(voucherInput, paymentInput);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }

    setErrors([]);
    const newEntry = mergeBlocks(result.voucher, result.payment);
    const normalized = normalizeEntryDates(newEntry);
    
    // Check for duplicate voucher numbers
    const existingIndex = entries.findIndex(
      (e) => e.voucherNo === normalized.voucherNo
    );

    if (existingIndex >= 0) {
      toast({
        title: "Voucher already exists",
        description: `Voucher #${normalized.voucherNo} is already in the list. Overwriting local state.`,
        variant: "destructive",
      });
      const updatedEntries = [...entries];
      updatedEntries[existingIndex] = normalized;
      setEntries(updatedEntries);
    } else {
      setEntries((prev) => [normalized, ...prev]);
    }

    setFormState(normalized);
    setActiveId(normalized.id);
    setVoucherInput("");
    setPaymentInput("");

    toast({
      title: "Parsed successfully",
      description: `Voucher #${normalized.voucherNo} added to the list. Review details below.`,
      variant: "success",
    });
  };

  const handlePaste = async (target: "voucher" | "payment") => {
    try {
      const text = await navigator.clipboard.readText();
      if (target === "voucher") setVoucherInput(text);
      else setPaymentInput(text);
    } catch (err) {
      toast({
        title: "Paste failed",
        description: "Clipboard access denied.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!activeId) return;
    try {
      setIsSaving(true);
      await updateMandiReport(activeId, formState);
      setEntries((prev) =>
        prev.map((e) => (e.id === activeId ? formState : e))
      );
      toast({
        title: "Entry updated",
        description: "Your changes have been saved to Firestore.",
        variant: "success",
      });
      resetForm();
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Could not save changes to Firestore.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteMandiReport(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (activeId === id) resetForm();
      toast({
        title: "Entry deleted",
        description: "Record synced and removed.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Could not remove record.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDeleteEntry = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deleteMandiReport(id)));
      setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
      if (activeId && ids.includes(activeId)) resetForm();
      toast({
        title: `${ids.length} entries deleted`,
        description: "Records synced and removed.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Bulk delete failed",
        description: "Could not remove some records.",
        variant: "destructive",
      });
    }
  };

  const handleSelectEntry = (entry: CombinedEntry) => {
    setActiveId(entry.id);
    setFormState(entry);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entry.purchaseDate) return true;
      const entryDate = new Date(entry.purchaseDate);
      if (filterFrom && entryDate < filterFrom) return false;
      if (filterTo && entryDate > filterTo) return false;
      return true;
    });
  }, [entries, filterFrom, filterTo]);

  const excelRows = useMemo(() => {
    return filteredEntries.map((e, idx) => ({
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
      "PAYMENT DATE": displayDate(e.paymentDate),
      "BANK ACCOUNT": e.bankAccount || "",
      IFSC: e.ifsc || "",
      UTR: e.transactionNumber || e.narration || "",
    }));
  }, [filteredEntries]);

  return {
    voucherInput,
    setVoucherInput,
    paymentInput,
    setPaymentInput,
    entries,
    activeId,
    formState,
    errors,
    setErrors,
    isSaving,
    filterFrom,
    setFilterFrom,
    filterTo,
    setFilterTo,
    handleParse,
    handlePaste,
    handleSaveEdit,
    handleDeleteEntry,
    handleBulkDeleteEntry,
    handleSelectEntry,
    handleFieldChange,
    filteredEntries,
    excelRows,
    resetForm,
    isExtensionInstalled,
    triggerExtensionSync,
    importProgress,
  };
}

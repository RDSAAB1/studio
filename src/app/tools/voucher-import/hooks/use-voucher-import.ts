import { useState, useCallback, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  addMandiReport, 
  updateMandiReport, 
  deleteMandiReport, 
  fetchMandiReports 
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

  // Load existing entries from Firestore on mount
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
    if (confirm("Are you sure you want to delete this entry?")) {
      try {
        await deleteMandiReport(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
        if (activeId === id) resetForm();
        toast({
          title: "Entry deleted",
          description: "Record removed from Firestore.",
          variant: "success",
        });
      } catch (error) {
        toast({
          title: "Delete failed",
          description: "Could not remove record from Firestore.",
          variant: "destructive",
        });
      }
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
    handleSelectEntry,
    handleFieldChange,
    filteredEntries,
    excelRows,
    resetForm,
  };
}

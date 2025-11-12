"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clipboard,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  Download,
  Printer,
  Eye,
  Save as SaveIcon,
} from "lucide-react";
import { bankBranches } from "@/lib/data";
import type { MandiHeaderSettings, MandiReport } from "@/lib/definitions";
import {
  addMandiReport,
  updateMandiReport,
  deleteMandiReport,
  fetchMandiReports,
  getMandiHeaderSettings,
  saveMandiHeaderSettings,
} from "@/lib/firestore";
import { format, parse } from "date-fns";
import * as XLSX from "xlsx";
import { db } from "@/lib/database";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

type VoucherBlock = {
  voucherNo: string;
  bookNo: string;
  purchaseDate: string;
  sellerName: string;
  fatherName: string;
  village: string;
  tehsil: string;
  district: string;
  khasraNo: string;
  khasraArea: string;
  mobile: string;
  commodity: string;
  quantityQtl: number;
  ratePerQtl: number;
  grossAmount: number;
  mandiFee: number;
  developmentCess: number;
  totalMandiFee: number;
};

type PaymentBlock = {
  voucherNo: string;
  traderReceiptNo: string;
  paymentDate: string;
  bankAccount: string;
  paymentMode: string;
  transactionNumber: string;
  ifsc: string;
  paymentAmount: number;
  narration: string;
};

type CombinedEntry = MandiReport;

type ParseResult =
  | { success: true; voucher: VoucherBlock; payment: PaymentBlock }
  | { success: false; errors: string[] };

const bankLookup = new Map(
  bankBranches.map((branch) => [branch.ifscCode.toUpperCase(), branch])
);

const CLEAN_WHITESPACE_REGEX = /\s+/g;

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");

const sanitize = (value?: string | null) =>
  (value || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

const tryDateFormats = (
  value: string,
  formatsToTry: string[]
): Date | null => {
  for (const formatString of formatsToTry) {
    try {
      const parsed = parse(value, formatString, new Date());
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    } catch {
      // Continue trying other formats
    }
  }
  return null;
};

const buildDateFromParts = (
  day: number,
  month: number,
  year: number
): Date | null => {
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }
  if (
    day <= 0 ||
    month <= 0 ||
    month > 12 ||
    day > 31
  ) {
    return null;
  }
  const candidate = new Date(year, month - 1, day);
  if (Number.isNaN(candidate.getTime())) {
    return null;
  }
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
};

const extractShortDateParts = (value: string) =>
  value
    .trim()
    .split(" ")[0]
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

const swapDayMonthFromRaw = (value: string): Date | null => {
  const short = extractShortDateParts(value);
  if (!short) return null;
  const part1 = Number(short[1]);
  const part2 = Number(short[2]);
  const year = Number(short[3]);
  return buildDateFromParts(part2, part1, year);
};

const normalizePaymentDate = (
  rawPaymentDate?: string | null,
  rawPurchaseDate?: string | null
) => {
  const paymentValue = sanitize(rawPaymentDate);
  const purchaseValue = sanitize(rawPurchaseDate);

  if (!paymentValue) return "";

  const purchaseNormalized = normalizeDate(purchaseValue);
  const referenceDate = purchaseNormalized
    ? new Date(purchaseNormalized)
    : null;

  const shortMatch = extractShortDateParts(paymentValue);

  let candidate: Date | null = null;
  let alternate: Date | null = null;
  let dayFirst: Date | null = null;
  let monthFirst: Date | null = null;

  const withinFiveDays = (target: Date | null) => {
    if (!target || !referenceDate) return true;
    const targetUTC = Date.UTC(
      target.getFullYear(),
      target.getMonth(),
      target.getDate()
    );
    const referenceUTC = Date.UTC(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );
    const diff = Math.abs(targetUTC - referenceUTC) / (1000 * 60 * 60 * 24);
    return diff <= 5;
  };

  if (shortMatch) {
    const part1 = Number(shortMatch[1]);
    const part2 = Number(shortMatch[2]);
    const year = Number(shortMatch[3]);

    dayFirst = buildDateFromParts(part1, part2, year);
    monthFirst = buildDateFromParts(part2, part1, year);

    if (dayFirst && withinFiveDays(dayFirst)) {
      candidate = dayFirst;
      alternate = monthFirst;
    } else if (monthFirst && withinFiveDays(monthFirst)) {
      candidate = monthFirst;
      alternate = dayFirst;
    } else if (dayFirst) {
      candidate = dayFirst;
      alternate = monthFirst;
    } else if (monthFirst) {
      candidate = monthFirst;
      alternate = dayFirst;
    }
  }

  if (!candidate) {
    const normalized = normalizeDate(paymentValue);
    if (normalized) {
      const normalizedDate = new Date(normalized);
      if (!Number.isNaN(normalizedDate.getTime())) {
      candidate = normalizedDate;
        alternate =
          dayFirst ||
          monthFirst ||
          swapDayMonthFromRaw(paymentValue);
      } else {
        return normalized;
      }
    }
  }

  if (!candidate) {
    const fallback = tryDateFormats(paymentValue, [
      "dd/MM/yyyy",
      "dd/MM/yyyy HH:mm:ss",
      "dd/MM/yyyy HH:mm",
      "d/M/yyyy",
      "d/M/yyyy HH:mm:ss",
      "d/M/yyyy HH:mm",
      "dd-MM-yyyy",
      "dd-MM-yyyy HH:mm:ss",
      "dd-MM-yyyy HH:mm",
      "d-M-yyyy",
      "d-M-yyyy HH:mm:ss",
      "d-M-yyyy HH:mm",
      "MM/dd/yyyy",
      "MM/dd/yyyy HH:mm:ss",
      "MM/dd/yyyy HH:mm",
      "M/d/yyyy",
      "M/d/yyyy HH:mm:ss",
      "M/d/yyyy HH:mm",
      "MM-dd-yyyy",
      "MM-dd-yyyy HH:mm:ss",
      "MM-dd-yyyy HH:mm",
      "M-d-yyyy",
      "M-d-yyyy HH:mm:ss",
      "M-d-yyyy HH:mm",
      "dd/MM/yy",
      "dd/MM/yy HH:mm:ss",
      "dd/MM/yy HH:mm",
      "d/M/yy",
      "d/M/yy HH:mm:ss",
      "d/M/yy HH:mm",
      "MM/dd/yy",
      "MM/dd/yy HH:mm:ss",
      "MM/dd/yy HH:mm",
      "M/d/yy",
      "M/d/yy HH:mm:ss",
      "M/d/yy HH:mm",
      "dd-MMM-yy",
      "dd-MMM-yy HH:mm:ss",
      "dd-MMM-yy HH:mm",
      "dd-MMM-yyyy",
      "dd-MMM-yyyy HH:mm:ss",
      "dd-MMM-yyyy HH:mm",
    ]);
    if (fallback) {
      candidate = fallback;
      alternate =
        dayFirst ||
        monthFirst ||
        swapDayMonthFromRaw(paymentValue);
    }
  }

  if (!candidate && alternate) {
    candidate = alternate;
  }

  if (referenceDate && candidate) {
    const diff =
      Math.abs(candidate.getTime() - referenceDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (diff > 5) {
      const swappedAlternate =
        swapDayMonthFromRaw(paymentValue) ||
        alternate ||
        (candidate === dayFirst ? monthFirst : dayFirst) ||
        swapDayMonthFromRaw(paymentValue);
      if (swappedAlternate) {
        const swappedUTC = Date.UTC(
          swappedAlternate.getFullYear(),
          swappedAlternate.getMonth(),
          swappedAlternate.getDate()
        );
        const referenceUTC = Date.UTC(
          referenceDate.getFullYear(),
          referenceDate.getMonth(),
          referenceDate.getDate()
        );
        const swappedDiff =
          Math.abs(swappedUTC - referenceUTC) / (1000 * 60 * 60 * 24);
        if (swappedDiff <= 5) {
          candidate = swappedAlternate;
        }
      }
    }
  }

  return candidate ? format(candidate, "yyyy-MM-dd") : paymentValue;
};

const normalizeNumber = (value?: string | null) => {
  const cleaned = sanitize(value).replace(/,/g, "");
  return cleaned ? Number.parseFloat(cleaned) : 0;
};

const normalizeDate = (value?: string | null) => {
  const raw = sanitize(value);
  if (!raw) return "";

  const candidates = [
    { formatStr: "dd/MM/yyyy HH:mm:ss", value: raw },
    { formatStr: "dd-MM-yyyy", value: raw },
    { formatStr: "dd/MM/yyyy", value: raw },
    { formatStr: "dd-MMM-yy", value: raw },
    { formatStr: "dd-MMM-yyyy", value: raw },
  ];

  for (const candidate of candidates) {
    try {
      const parsedDate = parse(candidate.value, candidate.formatStr, new Date());
      if (!Number.isNaN(parsedDate.getTime())) {
        return format(parsedDate, "yyyy-MM-dd");
      }
    } catch {
      // continue trying other formats
    }
  }

  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) {
    return format(new Date(timestamp), "yyyy-MM-dd");
  }

  return "";
};

const displayDate = (value?: string | null) => {
  const raw = sanitize(value);
  if (!raw) return "";

  const candidates = [
    { formatStr: "yyyy-MM-dd", value: raw },
    { formatStr: "dd-MM-yyyy", value: raw },
    { formatStr: "dd/MM/yyyy", value: raw },
    { formatStr: "MM/dd/yyyy", value: raw },
    { formatStr: "MM-dd-yyyy", value: raw },
    { formatStr: "dd-MMM-yy", value: raw },
    { formatStr: "dd-MMM-yyyy", value: raw },
  ];

  for (const candidate of candidates) {
    try {
      const parsed = parse(candidate.value, candidate.formatStr, new Date());
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, "dd-MM-yyyy");
      }
    } catch {
      // try next candidate
    }
  }

  const timestamp = Date.parse(raw);
  if (!Number.isNaN(timestamp)) {
    return format(new Date(timestamp), "dd-MM-yyyy");
  }

  return raw;
};

const extractPatterns = (
  source: string,
  patterns: string[],
  fallbackLabel?: string
) => {
  for (const pattern of patterns) {
    const regex = new RegExp(
      `${pattern}\\s*[:\\-]?\\s*([^\\t\\n]+)`,
      "i"
    );
    const match = source.match(regex);
    if (match && match[1]) {
      return sanitize(match[1]);
    }
  }

  if (fallbackLabel) {
    const regex = new RegExp(
      `${fallbackLabel}\\s*[:\\-]?\\s*([^\\t\\n]+)`,
      "i"
    );
    const match = source.match(regex);
    if (match && match[1]) {
      return sanitize(match[1]);
    }
  }

  return "";
};

const HEADER_STORAGE_KEY = "mandiReportHeaderSettings";

const defaultHeaderSettings: MandiHeaderSettings = {
  firmName: "",
  firmAddress: "",
  mandiName: "",
  licenseNo: "",
  mandiType: "NON AMPC",
  registerNo: "",
  commodity: "",
  financialYear: "",
};

const parseVoucherBlock = (raw: string): VoucherBlock => {
  const section = sanitize(
    raw.split("----------------------------------------------------------------")[0] || raw
  );
  const lines = section
    .split("\n")
    .map((line) => sanitize(line))
    .filter(Boolean);

  const commodityLine = lines.find((line) => {
    const matches = line.match(/[\d]+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 5) {
      return false;
    }
    if (
      /खसरा|क्षेत्रफल|मोबाइल|दिनांक|लाइसेंस|पुस्तक संख्या|क्रम संख्या|भुगतान|IFSC/i.test(
        line
      )
    ) {
      return false;
    }
    return true;
  });

  let commodity = "";
  let quantityQtl = 0;
  let ratePerQtl = 0;
  let grossAmount = 0;
  let netAmountCandidate = 0;
  let mandiFee = 0;
  let developmentCess = 0;
  let totalMandiFee = 0;

  if (commodityLine) {
    const firstDigitIndex = commodityLine.search(/[\d]/);
    if (firstDigitIndex > 0) {
      commodity = sanitize(commodityLine.slice(0, firstDigitIndex));
    }
    const numericMatches = commodityLine
      .slice(Math.max(firstDigitIndex, 0))
      .match(/[\d]+(?:[.,]\d+)?/g);
    if (numericMatches && numericMatches.length) {
      const numericValues = numericMatches.map((value) =>
        normalizeNumber(value)
      );
      quantityQtl = numericValues[0] ?? 0;
      ratePerQtl = numericValues[1] ?? 0;
      grossAmount = numericValues[2] ?? 0;
      netAmountCandidate = numericValues[3] ?? 0;
      mandiFee = numericValues[4] ?? 0;
      developmentCess = numericValues[5] ?? 0;
      totalMandiFee =
        numericValues[6] ??
        Math.round((mandiFee + developmentCess) * 100) / 100;
    }
  }
  if (!totalMandiFee) {
    totalMandiFee = Math.round((mandiFee + developmentCess) * 100) / 100;
  }

  return {
    voucherNo: extractPatterns(section, ["क्रम संख्या"]),
    bookNo: extractPatterns(section, ["पुस्तक संख्या"]),
    purchaseDate: normalizeDate(
      extractPatterns(section, ["क्रय / नीलामी का दिनांक"])
    ),
    sellerName: extractPatterns(section, ["विक्रेता किसान का नाम"]),
    fatherName: extractPatterns(section, ["भू-स्वामी उत्पादक के पिता का नाम"]),
    tehsil: extractPatterns(section, ["तहसील का नाम"]),
    district: extractPatterns(section, ["जनपद का नाम"]),
    village: extractPatterns(section, ["गाँव का नाम"]),
    khasraNo: extractPatterns(section, [
      "भू-स्वामी उत्पादक का खसरा नंबर जिस पर उत्त्पादन किया गया है",
    ]),
    khasraArea: extractPatterns(section, ["खसरे का क्षेत्रफल \\(हेक्टेयर में\\)"]),
    mobile: extractPatterns(section, ["मोबाइल नंबर"]).replace(/[^0-9]/g, ""),
    commodity,
    quantityQtl,
    ratePerQtl,
    grossAmount,
    mandiFee,
    developmentCess,
    totalMandiFee,
  };
};

const parsePaymentBlock = (raw: string): PaymentBlock => {
  const section = sanitize(raw);

  return {
    voucherNo: extractPatterns(section, ["प्रपत्र -6 नंबर"]),
    traderReceiptNo: extractPatterns(section, [
      "व्यापारी द्वारा किसान को दी गयी रसीद संख्या",
    ]),
    paymentDate: extractPatterns(section, ["भुगतान का दिनांक"]),
    bankAccount: extractPatterns(section, ["किसान का बैंक खाता संख्या"]),
    paymentMode: extractPatterns(section, ["भुगतान का मोड"]),
    transactionNumber: extractPatterns(section, ["ट्रांसक्शन नंबर"]),
    ifsc: extractPatterns(section, ["बैंक खाते का IFSC कोड"]).toUpperCase(),
    paymentAmount: normalizeNumber(
      extractPatterns(section, ["किसान को किये गये भुगतान की राशि"])
    ),
    narration: extractPatterns(section, ["अन्य विवरण"]),
  };
};

const mergeBlocks = (
  voucher: VoucherBlock,
  payment: PaymentBlock
): CombinedEntry => {
  const bankInfo = payment.ifsc
    ? bankLookup.get(payment.ifsc.toUpperCase())
    : undefined;

  return {
    id: voucher.voucherNo || payment.voucherNo || crypto.randomUUID(),
    voucherNo: voucher.voucherNo || payment.voucherNo,
    bookNo: voucher.bookNo,
    purchaseDate: voucher.purchaseDate,
    sellerName: voucher.sellerName,
    fatherName: voucher.fatherName,
    district: voucher.district,
    tehsil: voucher.tehsil,
    village: voucher.village,
    khasraNo: voucher.khasraNo,
    khasraArea: voucher.khasraArea,
    mobile: voucher.mobile,
    commodity: voucher.commodity,
    quantityQtl: voucher.quantityQtl,
    ratePerQtl: voucher.ratePerQtl,
    grossAmount: voucher.grossAmount,
    mandiFee: voucher.mandiFee,
    developmentCess: voucher.developmentCess,
    totalCharges: voucher.totalMandiFee,
    paymentAmount: payment.paymentAmount,
    paymentDate: normalizePaymentDate(
      payment.paymentDate,
      voucher.purchaseDate
    ),
    paymentMode: payment.paymentMode,
    bankAccount: payment.bankAccount,
    ifsc: payment.ifsc,
    bankName: bankInfo?.bankName
      ? toTitleCase(bankInfo.bankName)
      : undefined,
    bankBranch: bankInfo?.branchName
      ? toTitleCase(bankInfo.branchName)
      : undefined,
    transactionNumber: payment.transactionNumber,
    traderReceiptNo: payment.traderReceiptNo,
    traderName: voucher.traderName,
    buyerFirm: voucher.buyerFirm,
    buyerLicense: voucher.buyerLicense,
    mandiName: voucher.mandiName,
    mandiSiteType: voucher.mandiSiteType,
    mandiSiteName: voucher.mandiSiteName,
    narration: payment.narration,
  };
};

const parseBothBlocks = (
  voucherText: string,
  paymentText: string
): ParseResult => {
  const errors: string[] = [];

  if (!sanitize(voucherText)) {
    errors.push("Field 1 (voucher data) is empty.");
  }
  if (!sanitize(paymentText)) {
    errors.push("Field 2 (payment data) is empty.");
  }

  if (errors.length) {
    return { success: false, errors };
  }

  const voucher = parseVoucherBlock(voucherText);
  const payment = parsePaymentBlock(paymentText);

  if (!voucher.voucherNo) {
    errors.push("Field 1 is missing the voucher number (क्रम संख्या).");
  }
  if (!payment.voucherNo) {
    errors.push("Field 2 is missing the voucher number (प्रपत्र -6 नंबर).");
  }
  if (
    voucher.voucherNo &&
    payment.voucherNo &&
    voucher.voucherNo !== payment.voucherNo
  ) {
    errors.push(
      `Voucher number (${voucher.voucherNo}) and payment voucher number (${payment.voucherNo}) do not match.`
    );
  }

  if (voucher.netAmount && payment.paymentAmount) {
    const difference = Math.abs(voucher.netAmount - payment.paymentAmount);
    if (difference > 1) {
      errors.push(
        `Voucher net amount (${voucher.netAmount.toFixed(
          2
        )}) and payment amount (${payment.paymentAmount.toFixed(
          2
        )}) do not match.`
      );
    }
  }

  if (!voucher.sellerName) {
    errors.push("Field 1 is missing the farmer name (विक्रेता किसान का नाम).");
  }

  if (errors.length) {
    return { success: false, errors };
  }

  return { success: true, voucher, payment };
};

const normalizeEntryDates = (entry: CombinedEntry): CombinedEntry => ({
  ...entry,
  paymentDate: normalizePaymentDate(entry.paymentDate, entry.purchaseDate),
});

const emptyEntry: CombinedEntry = {
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

const createReportId = (voucherNo?: string | null) => {
  const base = sanitize(voucherNo);
  if (!base) return crypto.randomUUID();
  return base.replace(/[^a-zA-Z0-9_-]/g, "_");
};

export default function VoucherImportTool() {
  const { toast } = useToast();
  const [voucherInput, setVoucherInput] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [entries, setEntries] = useState<CombinedEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formState, setFormState] = useState<CombinedEntry>(emptyEntry);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [headerSettings, setHeaderSettings] = useState<MandiHeaderSettings>(defaultHeaderSettings);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);

  const resetForm = useCallback(() => {
    setActiveId(null);
    setFormState(emptyEntry);
  }, []);

  const handleHeaderInputChange = <K extends keyof MandiHeaderSettings>(
    key: K,
    value: string
  ) => {
    setHeaderSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const persistHeaderSettings = async (settings: MandiHeaderSettings) => {
    if (db) {
      await db.settings.put(
        {
          id: HEADER_STORAGE_KEY,
          ...settings,
        } as any
      );
    }

    try {
      await saveMandiHeaderSettings(settings);
    } catch (error) {
      console.warn("Failed to persist header settings to Firestore:", error);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        HEADER_STORAGE_KEY,
        JSON.stringify(settings)
      );
    }
  };

  const handleSaveHeaderSettings = async () => {
    try {
      setIsHeaderSaving(true);
      await persistHeaderSettings(headerSettings);
      toast({
        title: "Header saved",
        description: "Mandi header details have been updated.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save header settings:", error);
      toast({
        title: "Save failed",
        description: "Could not save mandi header details. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsHeaderSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadHeaderSettings = async () => {
      try {
        const remote = await getMandiHeaderSettings();
        if (mounted && remote) {
          setHeaderSettings({
            ...defaultHeaderSettings,
            ...remote,
          });
          if (db) {
            await db.settings.put(
              {
                id: HEADER_STORAGE_KEY,
                ...remote,
              } as any
            );
          }
          if (typeof window !== "undefined") {
            window.localStorage.setItem(
              HEADER_STORAGE_KEY,
              JSON.stringify(remote)
            );
          }
          return;
        }
      } catch (error) {
        console.warn("Failed to fetch header settings from Firestore:", error);
      }

      try {
        if (db) {
          const record = await db.settings.get(HEADER_STORAGE_KEY as any);
          if (mounted && record) {
            const { id: _ignored, ...rest } = record as any;
            setHeaderSettings({
              ...defaultHeaderSettings,
              ...(rest as Partial<MandiHeaderSettings>),
            });
            return;
          }
        }
      } catch (error) {
        console.warn("Failed to load header settings from IndexedDB:", error);
        }

        if (typeof window !== "undefined") {
          const stored = window.localStorage.getItem(HEADER_STORAGE_KEY);
          if (stored) {
            setHeaderSettings({
              ...defaultHeaderSettings,
              ...(JSON.parse(stored) as Partial<MandiHeaderSettings>),
            });
          }
      }
    };
    loadHeaderSettings();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLocal = async () => {
      if (!db) return;
      try {
        const localReports = await db.mandiReports.toArray();
        if (mounted && localReports.length) {
          setEntries(
            localReports
              .map((report) => {
                const sanitizedId =
                  report.id || createReportId(report.voucherNo);
                return normalizeEntryDates({
                  ...emptyEntry,
                  ...report,
                  id: sanitizedId,
                });
              })
              .sort((a, b) =>
                (b.purchaseDate || "").localeCompare(a.purchaseDate || "")
              )
          );
        }
      } catch (error) {
        console.warn("Failed to load local mandi reports:", error);
      }
    };
    loadLocal();

    const loadReports = async () => {
      try {
        const reports = await fetchMandiReports();
        if (!mounted) return;
        if (reports.length) {
          setEntries(
            reports.map((report) =>
              normalizeEntryDates({
                ...emptyEntry,
                ...report,
                id: report.id || createReportId(report.voucherNo),
              })
            )
          );
        }
      } catch (error) {
        console.error("Failed to load mandi reports:", error);
        if (mounted) {
          toast({
            title: "Load Failed",
            description: "Unable to load mandi report data.",
            variant: "destructive",
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    loadReports();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const handleParse = async () => {
    setErrors([]);
    const parsed = parseBothBlocks(voucherInput, paymentInput);

    if (!parsed.success) {
      setErrors(parsed.errors);
      toast({
        title: "Parsing Failed",
        description: "Could not parse the supplied blocks. Please review the validation errors below.",
        variant: "destructive",
      });
      return;
    }

    const merged = normalizeEntryDates(
      mergeBlocks(parsed.voucher, parsed.payment)
    );
    const withId = {
      ...merged,
      id: merged.id || createReportId(merged.voucherNo),
    };

    setEntries((prev) => {
      const idx = prev.findIndex((entry) => entry.id === withId.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = withId;
        return updated;
      }
      return [withId, ...prev];
    });

    setFormState(withId);
    setActiveId(withId.id);

    toast({
      title: "Parsing Successful",
      description: "Data extracted successfully and added to the list.",
      variant: "success",
    });
  };

  const handleFieldChange = <K extends keyof CombinedEntry>(
    key: K,
    value: CombinedEntry[K]
  ) => {
    setFormState((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "ifsc") {
        const branch = bankLookup.get(String(value).toUpperCase());
        if (branch) {
          updated.bankName = toTitleCase(branch.bankName);
          updated.bankBranch = toTitleCase(branch.branchName);
        }
      } else if (key === "mandiFee" || key === "developmentCess") {
        const mandiFee =
          key === "mandiFee" ? Number(value) || 0 : Number(updated.mandiFee) || 0;
        const devCess =
          key === "developmentCess"
            ? Number(value) || 0
            : Number(updated.developmentCess) || 0;
        updated.totalCharges = Math.round((mandiFee + devCess) * 100) / 100;
      } else if (key === "quantityQtl" || key === "ratePerQtl") {
        const quantity =
          key === "quantityQtl"
            ? Number(value) || 0
            : Number(updated.quantityQtl) || 0;
        const rate =
          key === "ratePerQtl"
            ? Number(value) || 0
            : Number(updated.ratePerQtl) || 0;
        if (quantity && rate) {
          updated.grossAmount = Math.round(quantity * rate * 100) / 100;
        }
      }
      return updated;
    });
  };

  const handleSelectEntry = (entry: CombinedEntry) => {
    setActiveId(entry.id);
    setFormState(entry);
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteMandiReport(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (activeId === id) {
        resetForm();
      }
      toast({
        title: "Entry Deleted",
        description: "The selected entry has been removed from the system.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to delete entry:", error);
      toast({
        title: "Delete Failed",
        description: "Unable to delete the selected entry.",
        variant: "destructive",
      });
    }
  };

  const handleSaveEntry = async () => {
    if (!formState.voucherNo) {
      toast({
        title: "Voucher Missing",
        description: "Voucher number is required before saving.",
        variant: "destructive",
      });
      return;
    }

    const payload: CombinedEntry = normalizeEntryDates({
      ...formState,
      id: formState.id || createReportId(formState.voucherNo),
    });

    try {
      setIsSaving(true);
      const exists = entries.some((entry) => entry.id === payload.id);
      if (exists) {
        await updateMandiReport(payload.id, payload);
      } else {
        await addMandiReport(payload);
      }
      setEntries((prev) => {
        const next = [...prev];
        const idx = next.findIndex((entry) => entry.id === payload.id);
        if (idx >= 0) {
          next[idx] = payload;
        } else {
          next.unshift(payload);
        }
        return next;
      });
      setFormState(payload);
      setActiveId(payload.id);

      toast({
        title: exists ? "Entry Updated" : "Entry Saved",
        description: "Entry stored in the mandi report collection.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save entry:", error);
      toast({
        title: "Save Failed",
        description: "Unable to persist the entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaste = async (target: "voucher" | "payment") => {
    try {
      const text = await navigator.clipboard.readText();
      if (target === "voucher") {
        setVoucherInput(text);
      } else {
        setPaymentInput(text);
      }
      toast({
        title: "Clipboard Captured",
        description: "Successfully pasted content from clipboard.",
        variant: "success",
      });
    } catch (error) {
      console.error("Clipboard read failed:", error);
      toast({
        title: "Clipboard Error",
        description: "Unable to access clipboard contents.",
        variant: "destructive",
      });
    }
  };

  const activeEntry = useMemo(
    () =>
      activeId ? entries.find((entry) => entry.id === activeId) ?? null : null,
    [activeId, entries]
  );

  const formatDisplayDate = (value?: string | null) =>
    value ? displayDate(value) : "";

  const excelRows = useMemo(
    () =>
      entries.map((entry, index) => ({
        "SR. NO.": index + 1,
        "6R Issue Date": formatDisplayDate(entry.purchaseDate),
        "Farmer / Father / Address": [
          entry.sellerName,
          entry.fatherName ? `S/O: ${entry.fatherName}` : undefined,
          entry.village,
        ]
          .filter(Boolean)
          .join(", "),
        "Mobile No.": entry.mobile || "",
        "Gata No.": entry.khasraNo || "",
        "6R Number": entry.voucherNo || "",
        "Quantity (Qtl)": entry.quantityQtl || 0,
        Rate: entry.ratePerQtl || 0,
        Amount: entry.grossAmount || 0,
        "Mandi Fee 1%": entry.mandiFee || 0,
        "Cess 0.5%": entry.developmentCess || 0,
        "Total Mandi Fee":
          entry.totalCharges ||
          Math.round(
            ((entry.mandiFee || 0) + (entry.developmentCess || 0)) * 100
          ) / 100,
        "Payment Date": formatDisplayDate(entry.paymentDate),
        "Account No.": entry.bankAccount || "",
        IFSC: entry.ifsc || "",
        "UTR / Transfer":
          entry.transactionNumber ||
          (entry.narration ? entry.narration.toUpperCase() : ""),
      })),
    [entries]
  );

  const POPUP_FEATURES = "width=1200,height=800,scrollbars=yes";

  const escapeHtml = (value?: string | null) => {
    if (!value) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const formatNumberForPrint = (
    value?: number | null,
    fractionDigits = 0
  ): string =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const buildPrintableReportHtml = (includePreviewControls = false) => {
    if (!entries.length) {
      return "";
    }

    const firstEntry = entries[0];

    const computeFinancialYear = (rawDate?: string) => {
      if (!rawDate) return "";
      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = date.getMonth(); // 0 indexed
      if (month >= 3) {
        return `${year}-${String(year + 1).slice(-2)}`;
      }
      return `${year - 1}-${String(year).slice(-2)}`;
    };

    const computedFinancialYear =
      computeFinancialYear(firstEntry?.purchaseDate) ||
      computeFinancialYear(entries.find((e) => e.purchaseDate)?.purchaseDate) ||
      "";

    const fallbackFirmName =
      firstEntry?.buyerFirm ||
      firstEntry?.traderName ||
      "M/S __________________________________";
    const fallbackMandiName = [
      firstEntry?.mandiName,
      firstEntry?.mandiSiteName,
      firstEntry?.mandiSiteType,
    ]
      .filter(Boolean)
      .join(" ");
    const fallbackLicenseInfo = firstEntry?.buyerLicense
      ? `मंडी लाइसेंस क्रमांक ${firstEntry.buyerLicense}`
      : "";
    const districtInfo = [firstEntry?.district, firstEntry?.tehsil]
      .filter(Boolean)
      .join(" / ");

    const fallbackCommodity = firstEntry?.commodity
      ? `${firstEntry.commodity}`.toUpperCase()
      : "";

    const effectiveFirmName = headerSettings.firmName || fallbackFirmName;
    const firmAddressLine =
      headerSettings.firmAddress ||
      (districtInfo ? districtInfo : fallbackMandiName);
    const effectiveMandiName = headerSettings.mandiName || fallbackMandiName;
    const effectiveLicense =
      headerSettings.licenseNo || fallbackLicenseInfo || "";
    const effectiveFinancialYear =
      headerSettings.financialYear || computedFinancialYear;
    const effectiveRegister =
      headerSettings.registerNo ||
      (firstEntry?.bookNo ? `खसरा/पंजी क्र. ${firstEntry.bookNo}` : "");
    const effectiveCommodity =
      headerSettings.commodity || fallbackCommodity || "";
    const effectiveMandiType = (
      headerSettings.mandiType || firstEntry?.mandiSiteType || "NON AMPC"
    ).toString().toUpperCase();

    const generatedAt = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const rowsHtml = entries
      .map((entry, index) => {
        const mandiFee = Number(entry.mandiFee || 0);
        const developmentCess = Number(entry.developmentCess || 0);
        const totalCharges =
          entry.totalCharges ??
          Math.round((mandiFee + developmentCess) * 100) / 100;

        const farmerLine = [entry.sellerName, entry.fatherName ? `S/O: ${entry.fatherName}` : "", entry.village]
          .filter(Boolean)
          .join(", ");

        const utrValue =
          entry.transactionNumber ||
          (entry.narration ? entry.narration.toUpperCase() : "");

        return `
          <tr>
            <td>${index + 1}</td>
            <td class="nowrap">${escapeHtml(
              formatDisplayDate(entry.purchaseDate) || "—"
            )}</td>
            <td>${escapeHtml(farmerLine || "—")}</td>
            <td>${escapeHtml(entry.mobile || "—")}</td>
            <td>${escapeHtml(entry.khasraNo || "—")}</td>
            <td>${escapeHtml(entry.voucherNo || "—")}</td>
            <td class="numeric">${formatNumberForPrint(entry.quantityQtl, 2)}</td>
            <td class="numeric">${formatNumberForPrint(entry.ratePerQtl, 0)}</td>
            <td class="numeric">${formatNumberForPrint(entry.grossAmount, 0)}</td>
            <td class="numeric">${formatNumberForPrint(mandiFee, 0)}</td>
            <td class="numeric">${formatNumberForPrint(developmentCess, 0)}</td>
            <td class="numeric">${formatNumberForPrint(totalCharges, 0)}</td>
            <td class="nowrap">${escapeHtml(
              formatDisplayDate(entry.paymentDate) || "—"
            )}</td>
            <td>${escapeHtml(entry.bankAccount || "—")}</td>
            <td>${escapeHtml(entry.ifsc || "—")}</td>
            <td>${escapeHtml(utrValue || "—")}</td>
          </tr>
        `;
      })
      .join("");

    const previewToolbar = includePreviewControls
      ? `<div class="preview-toolbar">
            <button type="button" onclick="window.print()">Print</button>
            <button type="button" class="secondary" onclick="window.close()">Close</button>
         </div>`
      : "";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Mandi Report Preview</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 12mm 10mm;
            }
            :root {
              color-scheme: light;
            }
            body {
              font-family: "Noto Sans Devanagari", "Mangal", "Segoe UI", Arial, sans-serif;
              margin: 18px;
              color: #1f2937;
              background: #ffffff;
              font-size: 12px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .preview-toolbar {
              display: flex;
              gap: 8px;
              justify-content: flex-end;
              margin-bottom: 12px;
            }
            .preview-toolbar button {
              background-color: #2563eb;
              color: #fff;
              border: none;
              border-radius: 4px;
              padding: 6px 12px;
              cursor: pointer;
              font-size: 14px;
            }
            .preview-toolbar button.secondary {
              background-color: #e5e7eb;
              color: #1f2937;
            }
            .preview-toolbar button:hover {
              opacity: 0.9;
            }
            .preview-toolbar button.secondary:hover {
              background-color: #d1d5db;
              opacity: 1;
            }
            .report-header {
              margin-bottom: 18px;
              border-bottom: 1px solid #d1d5db;
              padding-bottom: 12px;
            }
            .header-row {
              display: flex;
              gap: 16px;
              flex-wrap: wrap;
              justify-content: space-between;
              align-items: flex-start;
            }
            .header-row + .header-row {
              margin-top: 8px;
            }
            .header-row.primary .title-left {
              font-weight: 600;
              font-size: 15px;
              color: #1f2937;
            }
            .header-row.primary .title-center {
              text-align: center;
              flex: 1;
            }
            .firm-name {
              font-size: 20px;
              font-weight: 700;
              text-transform: uppercase;
              color: #111827;
              margin-bottom: 4px;
            }
            .firm-sub {
              font-size: 12px;
              color: #374151;
              white-space: pre-wrap;
            }
            .header-row.primary .title-right {
              text-align: right;
              font-size: 12px;
              color: #374151;
            }
            .header-chip {
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 11px;
              color: #111827;
            }
            .header-row.secondary {
              font-size: 11px;
              color: #1f2937;
              gap: 12px;
              align-items: center;
            }
            .header-row.secondary > div {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            thead tr {
              background: linear-gradient(90deg, #dbeafe, #e0e7ff);
            }
            th,
            td {
              border: 1px solid #9ca3af;
              padding: 4px 6px;
              text-align: left;
              vertical-align: top;
              line-height: 1.2;
            }
            th {
              font-weight: 600;
              color: #1f2937;
            }
            th .label-hi {
              display: block;
              font-size: 11px;
              font-weight: 700;
              color: #111827;
            }
            th .label-en {
              display: block;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              color: #1f2937;
              margin-top: 2px;
            }
            td.numeric {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            td.nowrap {
              white-space: nowrap;
            }
            tbody tr:nth-child(odd) {
              background-color: #f9fafb;
            }
            tbody tr:nth-child(even) {
              background-color: #ffffff;
            }
            tfoot tr {
              background: linear-gradient(90deg, #fef3c7, #fed7aa);
              font-weight: 600;
            }
            @media print {
              body {
                margin: 0;
              }
              .preview-toolbar {
                display: none !important;
              }
              table {
                page-break-inside: auto;
              }
              tr {
                page-break-inside: avoid;
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${previewToolbar}
          <header class="report-header">
            <div class="header-row primary">
              <div class="title-left">खरीद किसानों द्वारा - ${escapeHtml(
                effectiveMandiType
              )}</div>
              <div class="title-center">
                <div class="firm-name">${escapeHtml(effectiveFirmName)}</div>
                ${
                  firmAddressLine
                    ? `<div class="firm-sub">${escapeHtml(
                        firmAddressLine
                      )}</div>`
                    : ""
                }
              </div>
              <div class="title-right">
                ${
                  effectiveLicense
                    ? `<div class="header-chip">${escapeHtml(
                        effectiveLicense
                      )}</div>`
                    : ""
                }
              </div>
            </div>
            <div class="header-row secondary">
              ${
                effectiveFinancialYear || effectiveRegister
                  ? `<div class="header-chip">${escapeHtml(
                      [
                        effectiveFinancialYear
                          ? `वित्तीय वर्ष ${effectiveFinancialYear}`
                          : "",
                        effectiveRegister || "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    )}</div>`
                  : ""
              }
              ${
                effectiveCommodity
                  ? `<div class="header-chip">${escapeHtml(
                      effectiveCommodity
                    )}</div>`
                  : ""
              }
              ${
                effectiveMandiName
                  ? `<div class="header-chip">${escapeHtml(
                      `मंडी: ${effectiveMandiName}`
                    )}</div>`
                  : ""
              }
              ${
                districtInfo
                  ? `<div class="header-chip">${escapeHtml(
                      `जिला/तहसील: ${districtInfo}`
                    )}</div>`
                  : ""
              }
              <div class="header-chip">कुल अभिलेख: ${entries.length}</div>
              <div class="header-chip">तैयार दिनांक: ${escapeHtml(
                generatedAt
              )}</div>
            </div>
          </header>
          <main>
            <table>
              <thead>
                <tr>
                  <th>
                    <span class="label-hi">एस.आर. क्रमांक</span>
                    <span class="label-en">SR. NO.</span>
                  </th>
                  <th>
                    <span class="label-hi">6R जारी तिथि</span>
                    <span class="label-en">6R DATE</span>
                  </th>
                  <th>
                    <span class="label-hi">किसान / पिता / पता</span>
                    <span class="label-en">FARMER / FATHER / ADDRESS</span>
                  </th>
                  <th>
                    <span class="label-hi">मोबाइल संख्या</span>
                    <span class="label-en">MOBILE NO.</span>
                  </th>
                  <th>
                    <span class="label-hi">गाटा संख्या</span>
                    <span class="label-en">GATA NO.</span>
                  </th>
                  <th>
                    <span class="label-hi">6R नंबर</span>
                    <span class="label-en">6R NUMBER</span>
                  </th>
                  <th>
                    <span class="label-hi">मात्रा (क्विंटल)</span>
                    <span class="label-en">QUANTITY (QTL)</span>
                  </th>
                  <th>
                    <span class="label-hi">दर</span>
                    <span class="label-en">RATE</span>
                  </th>
                  <th>
                    <span class="label-hi">राशि</span>
                    <span class="label-en">AMOUNT</span>
                  </th>
                  <th>
                    <span class="label-hi">मंडी शुल्क 1%</span>
                    <span class="label-en">MANDI FEE 1%</span>
                  </th>
                  <th>
                    <span class="label-hi">सेस 0.5%</span>
                    <span class="label-en">CESS 0.5%</span>
                  </th>
                  <th>
                    <span class="label-hi">कुल मंडी शुल्क</span>
                    <span class="label-en">TOTAL MANDI FEE</span>
                  </th>
                  <th>
                    <span class="label-hi">भुगतान तिथि</span>
                    <span class="label-en">PAYMENT DATE</span>
                  </th>
                  <th>
                    <span class="label-hi">खाता संख्या</span>
                    <span class="label-en">ACCOUNT NO.</span>
                  </th>
                  <th>
                    <span class="label-hi">आईएफएससी</span>
                    <span class="label-en">IFSC</span>
                  </th>
                  <th>
                    <span class="label-hi">यूटीआर / ट्रांसफर</span>
                    <span class="label-en">UTR / TRANSFER</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </main>
        </body>
      </html>
    `;
  };

  const openReportWindow = (htmlContent: string, autoPrint = false) => {
    const printWindow = window.open("", "_blank", POPUP_FEATURES);
    if (!printWindow) {
      toast({
        title: "Pop-up blocked",
        description: "Allow pop-ups to preview or print the report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const printDocument = printWindow.document;
      printDocument.open();
      printDocument.write(htmlContent);
      printDocument.close();
      printWindow.focus();

      if (autoPrint) {
        printWindow.print();
      }
    } catch (error) {
      console.error("Failed to populate print window:", error);
      printWindow.close();
      toast({
        title: "Preview unavailable",
        description:
          "Unable to open the report preview. Check your browser pop-up settings.",
        variant: "destructive",
      });
    }
  };

  const handlePreviewReport = () => {
    const html = buildPrintableReportHtml(true);
    if (!html) {
      toast({
        title: "No data to preview",
        description: "Parse or add entries before generating a preview.",
        variant: "destructive",
      });
      return;
    }
    openReportWindow(html, false);
  };

  const handlePrintReport = () => {
    const html = buildPrintableReportHtml(false);
    if (!html) {
      toast({
        title: "No data to print",
        description: "Parse or add entries before printing.",
        variant: "destructive",
      });
      return;
    }
    openReportWindow(html, true);
  };

  const handleDownloadExcel = () => {
    if (!excelRows.length) {
      toast({
        title: "Nothing to export",
        description: "Parse some data before exporting to Excel.",
        variant: "destructive",
      });
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mandi Report");
    const filename = `Mandi_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast({
      title: "Excel downloaded",
      description: `${filename} saved successfully.`,
      variant: "success",
    });
  };

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SaveIcon className="h-5 w-5" />
            Mandi Report Header
          </CardTitle>
          <CardDescription>
            दर्ज की गई विवरण प्रिंट एवं पीडीएफ शीर्षक में उपयोग होंगे। एक बार सहेजने के बाद ये विवरण तब तक रहेंगे जब तक आप इन्हें अपडेट नहीं करते।
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Firm / Company Name</Label>
            <Input
              value={headerSettings.firmName}
              onChange={(event) =>
                handleHeaderInputChange("firmName", event.target.value)
              }
              placeholder="M/S Jagdambe Rice Mill"
            />
          </div>
          <div className="space-y-2">
            <Label>Firm Address</Label>
            <Input
              value={headerSettings.firmAddress}
              onChange={(event) =>
                handleHeaderInputChange("firmAddress", event.target.value)
              }
              placeholder="Ajay Filling Station, Banda Road, Devkali, Shajahanpur"
            />
          </div>
          <div className="space-y-2">
            <Label>Mandi / Site Name</Label>
            <Input
              value={headerSettings.mandiName}
              onChange={(event) =>
                handleHeaderInputChange("mandiName", event.target.value)
              }
              placeholder="Shahjahanpur Mandi Samiti, Banda Powayan"
            />
          </div>
          <div className="space-y-2">
            <Label>Mandi Type</Label>
            <Input
              value={headerSettings.mandiType}
              onChange={(event) =>
                handleHeaderInputChange("mandiType", event.target.value)
              }
              placeholder="NON AMPC"
            />
          </div>
          <div className="space-y-2">
            <Label>License Number</Label>
            <Input
              value={headerSettings.licenseNo}
              onChange={(event) =>
                handleHeaderInputChange("licenseNo", event.target.value)
              }
              placeholder="उ/2024/190/16324939"
            />
          </div>
          <div className="space-y-2">
            <Label>Register / Khata Number</Label>
            <Input
              value={headerSettings.registerNo}
              onChange={(event) =>
                handleHeaderInputChange("registerNo", event.target.value)
              }
              placeholder="खसरा सं. 90/91"
            />
          </div>
          <div className="space-y-2">
            <Label>Commodity / Report Title</Label>
            <Input
              value={headerSettings.commodity}
              onChange={(event) =>
                handleHeaderInputChange("commodity", event.target.value)
              }
              placeholder="गेहूं खरीद विवरण"
            />
          </div>
          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Input
              value={headerSettings.financialYear}
              onChange={(event) =>
                handleHeaderInputChange("financialYear", event.target.value)
              }
              placeholder="2024-25"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            type="button"
            onClick={handleSaveHeaderSettings}
            disabled={isHeaderSaving}
            className="flex items-center gap-2"
          >
            <SaveIcon className="h-4 w-4" />
            {isHeaderSaving ? "Saving..." : "Save Header"}
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            6R Voucher & RTGS Extraction Tool
          </CardTitle>
          <CardDescription>
            Paste the mandi voucher into Field 1 and the payment details into Field 2. The system will merge them and populate the grid and form below.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center justify-between text-sm font-medium">
              Field 1 - Mandi Voucher
              <Button
                size="xs"
                variant="outline"
                onClick={() => handlePaste("voucher")}
                type="button"
              >
                <Clipboard className="mr-1 h-3 w-3" />
                Paste
              </Button>
            </Label>
            <Textarea
              value={voucherInput}
              onChange={(event) => setVoucherInput(event.target.value)}
              className="min-h-[260px] font-mono text-sm"
              placeholder="Paste voucher block here"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between text-sm font-medium">
              Field 2 - Payment Details
              <Button
                size="xs"
                variant="outline"
                onClick={() => handlePaste("payment")}
                type="button"
              >
                <Clipboard className="mr-1 h-3 w-3" />
                Paste
              </Button>
            </Label>
            <Textarea
              value={paymentInput}
              onChange={(event) => setPaymentInput(event.target.value)}
              className="min-h-[260px] font-mono text-sm"
              placeholder="Paste payment block here"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2 justify-between">
          <div className="flex flex-col gap-1 text-sm text-destructive">
            {errors.map((error, index) => (
              <span key={index}>• {error}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVoucherInput("");
                setPaymentInput("");
                setErrors([]);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Clear Inputs
            </Button>
            <Button type="button" onClick={handleParse}>
              Parse & Merge
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Mandi Report (Parsed)</CardTitle>
              <CardDescription>
                Grid mirrors the Excel column layout for quick verification.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviewReport}
                disabled={!entries.length}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                onClick={handlePrintReport}
                disabled={!entries.length}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadExcel}
                disabled={!entries.length}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-h-[420px] overflow-auto">
            <div className="min-w-[1700px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">SR. NO.</TableHead>
                    <TableHead className="w-[110px] text-center">6R Issue Date</TableHead>
                    <TableHead className="min-w-[200px]">Farmer / Father / Address</TableHead>
                    <TableHead className="w-[110px] text-center">Mobile No.</TableHead>
                    <TableHead className="w-[110px] text-center">Gata No.</TableHead>
                    <TableHead className="min-w-[180px] text-center">6R Number</TableHead>
                    <TableHead className="w-[110px] text-right">Quantity (Qtl)</TableHead>
                    <TableHead className="w-[90px] text-right">Rate</TableHead>
                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                    <TableHead className="w-[120px] text-right">Mandi Fee 1%</TableHead>
                    <TableHead className="w-[110px] text-right">Cess 0.5%</TableHead>
                    <TableHead className="w-[130px] text-right">Total Mandi Fee</TableHead>
                    <TableHead className="w-[120px] text-center">Payment Date</TableHead>
                    <TableHead className="w-[160px] text-center">Account No.</TableHead>
                    <TableHead className="w-[120px] text-center">IFSC</TableHead>
                    <TableHead className="w-[160px] text-center">UTR / Transfer</TableHead>
                    <TableHead className="text-center w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, index) => {
                    const totalMandiFee =
                      entry.totalCharges ||
                      Math.round(
                        ((entry.mandiFee || 0) + (entry.developmentCess || 0)) * 100
                      ) / 100;
                    const farmerLine = [
                      entry.sellerName,
                      entry.fatherName
                        ? `S/O: ${entry.fatherName}`
                        : undefined,
                      entry.village,
                    ]
                      .filter(Boolean)
                      .join(", ");
                    const utrValue =
                      entry.transactionNumber ||
                      (entry.narration ? entry.narration.toUpperCase() : "");
                    return (
                    <TableRow
                      key={entry.id}
                      className={
                        activeId === entry.id ? "bg-muted/50 font-medium" : ""
                      }
                    >
                      <TableCell className="text-center text-xs py-1.5">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {displayDate(entry.purchaseDate)}
                      </TableCell>
                      <TableCell className="text-xs py-1.5">{farmerLine}</TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {entry.mobile || "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {entry.khasraNo || "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {entry.voucherNo || "—"}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {entry.quantityQtl
                          ? entry.quantityQtl.toFixed(2)
                          : "0.00"}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {entry.ratePerQtl ? entry.ratePerQtl.toFixed(0) : "0"}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {entry.grossAmount
                          ? entry.grossAmount.toFixed(0)
                          : "0"}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {(entry.mandiFee || 0).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {(entry.developmentCess || 0).toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right text-xs py-1.5 whitespace-nowrap">
                        {totalMandiFee.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {displayDate(entry.paymentDate)}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {entry.bankAccount || "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {entry.ifsc || "—"}
                      </TableCell>
                      <TableCell className="text-center text-xs py-1.5 whitespace-nowrap">
                        {utrValue || "—"}
                      </TableCell>
                      <TableCell className="text-center py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleSelectEntry(entry)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center py-10">
                        {isLoading
                          ? "Loading data..."
                          : 'No entries yet. Paste inputs above and click "Parse & Merge".'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Entry (Excel Format)</CardTitle>
          <CardDescription>
            Fields mirror the grid above. Any edits saved here update the table and Firestore.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Farmer Name</Label>
              <Input
                value={formState.sellerName}
                onChange={(event) =>
                  handleFieldChange("sellerName", event.target.value)
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Father / Spouse Name</Label>
              <Input
                value={formState.fatherName || ""}
                onChange={(event) =>
                  handleFieldChange("fatherName", event.target.value)
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Village</Label>
              <Input
                value={formState.village || ""}
                onChange={(event) =>
                  handleFieldChange("village", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Mobile Number</Label>
              <Input
                value={formState.mobile || ""}
                onChange={(event) =>
                  handleFieldChange("mobile", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Gata Number</Label>
              <Input
                value={formState.khasraNo || ""}
                onChange={(event) =>
                  handleFieldChange("khasraNo", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label>6R Issue Date</Label>
              <SmartDatePicker
                value={formState.purchaseDate || ""}
                onChange={(next) => handleFieldChange("purchaseDate", next)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>6R Number</Label>
              <Input
                value={formState.voucherNo}
                onChange={(event) =>
                  handleFieldChange("voucherNo", event.target.value)
                }
                placeholder="35040315(190)/6P/00424"
              />
            </div>
            <div className="space-y-1">
              <Label>Quantity (Qtl)</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.quantityQtl || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "quantityQtl",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Rate</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.ratePerQtl || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "ratePerQtl",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Mandi Fee 1%</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.mandiFee || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "mandiFee",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Cess 0.5%</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.developmentCess || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "developmentCess",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Total Mandi Fee</Label>
              <Input
                type="number"
                value={formState.totalCharges || 0}
                disabled
              />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.grossAmount || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "grossAmount",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Payment Date</Label>
              <SmartDatePicker
                value={formState.paymentDate || ""}
                onChange={(next) => handleFieldChange("paymentDate", next)}
              />
            </div>
            <div className="space-y-1">
              <Label>Payment Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formState.paymentAmount || 0}
                onChange={(event) =>
                  handleFieldChange(
                    "paymentAmount",
                    Number.parseFloat(event.target.value || "0")
                  )
                }
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Payment Mode</Label>
              <Input
                value={formState.paymentMode || ""}
                onChange={(event) =>
                  handleFieldChange("paymentMode", event.target.value)
                }
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Account Number</Label>
              <Input
                value={formState.bankAccount || ""}
                onChange={(event) =>
                  handleFieldChange("bankAccount", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <Label>IFSC</Label>
              <Input
                value={formState.ifsc || ""}
                onChange={(event) =>
                  handleFieldChange("ifsc", event.target.value.toUpperCase())
                }
              />
            </div>
            <div className="space-y-1">
              <Label>UTR / Transfer</Label>
              <Input
                value={formState.transactionNumber || ""}
                onChange={(event) =>
                  handleFieldChange("transactionNumber", event.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {activeEntry
              ? `Editing entry: ${activeEntry.voucherNo}`
              : "No entry selected."}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetForm}
              type="button"
              disabled={isSaving}
            >
              Reset Form
            </Button>
            <Button
              onClick={handleSaveEntry}
              type="button"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SaveIcon className="mr-2 h-4 w-4" />
              )}
              Save Entry
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
    </>
  );
}


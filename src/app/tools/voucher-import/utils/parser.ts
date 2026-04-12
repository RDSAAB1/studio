import { format, parse } from "date-fns";
import { bankBranches } from "@/lib/data";
import type { VoucherBlock, PaymentBlock, CombinedEntry, ParseResult } from "../types";
import { toTitleCase, sanitize, normalizeDate, normalizeNumber, displayDate } from "@/lib/formatters";

export { sanitize, displayDate };

const bankLookup = new Map(
  bankBranches.map((branch) => [branch.ifscCode.toUpperCase(), branch])
);

// Removed local redefinitions of toTitleCase and sanitize

export const tryDateFormats = (
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

export const buildDateFromParts = (
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

export const extractShortDateParts = (value: string) =>
  value
    .trim()
    .split(" ")[0]
    .match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

export const swapDayMonthFromRaw = (value: string): Date | null => {
  const short = extractShortDateParts(value);
  if (!short) return null;
  const part1 = Number(short[1]);
  const part2 = Number(short[2]);
  const year = Number(short[3]);
  return buildDateFromParts(part2, part1, year);
};

// Removed local redefinition of normalizeDate

export const normalizePaymentDate = (
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

// Removed local redefinition of normalizeNumber

// Removed local redefinition of displayDate

export const extractPatterns = (
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

export const parseVoucherBlock = (raw: string): VoucherBlock => {
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
    netAmount: netAmountCandidate,
    mandiFee,
    developmentCess,
    totalMandiFee,
  };
};

export const parsePaymentBlock = (raw: string): PaymentBlock => {
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

export const mergeBlocks = (
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

export const parseBothBlocks = (
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

export const normalizeEntryDates = (entry: CombinedEntry): CombinedEntry => {
  return {
    ...entry,
    purchaseDate: normalizeDate(entry.purchaseDate),
    paymentDate: normalizeDate(entry.paymentDate),
  };
};

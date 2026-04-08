import { format, parse, isValid, parseISO } from "date-fns";

/**
 * Converts a string to Title Case.
 */
export const toTitleCase = (value: string | unknown): string => {
  if (typeof value !== "string" || !value) return "";
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
};

/**
 * Sanitizes input strings by removing carriage returns and normalizing whitespace.
 */
export const sanitize = (value?: string | null): string =>
  (value || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .trim();

/**
 * Normalizes various number string formats into a float.
 */
export const normalizeNumber = (value?: string | number | null): number => {
  if (typeof value === "number") return value;
  const cleaned = sanitize(value).replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Normalizes various date string formats into YYYY-MM-DD.
 */
export const normalizeDate = (value?: string | null): string => {
  const raw = sanitize(value);
  if (!raw) return "";

  const formatsToTry = [
    "dd/MM/yyyy HH:mm:ss",
    "dd-MM-yyyy",
    "dd/MM/yyyy",
    "dd-MMM-yy",
    "dd-MMM-yyyy",
    "yyyy-MM-dd",
  ];

  for (const fmt of formatsToTry) {
    try {
      const parsedDate = parse(raw, fmt, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, "yyyy-MM-dd");
      }
    } catch {
      // Continue to next format
    }
  }

  // Fallback to native Date parsing if date-fns formats fail
  const timestamp = Date.parse(raw);
  if (!isNaN(timestamp)) {
    return format(new Date(timestamp), "yyyy-MM-dd");
  }

  return "";
};

/**
 * Formats a date string (ISO or other) into a display-friendly DD-MM-YYYY format.
 */
export const displayDate = (value?: string | null): string => {
  const normalized = normalizeDate(value);
  if (!normalized) return sanitize(value);

  try {
    const date = parseISO(normalized);
    if (isValid(date)) {
      return format(date, "dd-MM-yyyy");
    }
  } catch {}

  return normalized;
};

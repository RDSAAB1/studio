import { format, isValid, startOfDay, endOfDay, parseISO } from "date-fns";

export const formatDate = (value: Date | string | number | null | undefined, pattern = "dd-MMM-yy") => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  if (!isValid(date)) return "";
  return format(date, pattern);
};

export const formatDateTime = (
  value: Date | string | number | null | undefined,
  pattern = "dd-MMM-yy HH:mm"
) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  if (!isValid(date)) return "";
  return format(date, pattern);
};

export const toStartOfDay = (value: Date | string | number) => {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  return startOfDay(date);
};

export const toEndOfDay = (value: Date | string | number) => {
  const date = typeof value === "string" ? new Date(value) : new Date(value);
  return endOfDay(date);
};

export const parseIsoOrNow = (value: string | null | undefined) => {
  if (!value) return new Date();
  const date = parseISO(value);
  if (!isValid(date)) return new Date();
  return date;
};


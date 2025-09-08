import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toTitleCase(str: string) {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function formatSrNo(num: number | string, prefix: 'S' | 'C' | 'R' = 'S') {
  return prefix + String(num).padStart(5, '0');
}

export function formatPaymentId(num: number | string) {
  return 'P' + String(num).padStart(5, '0');
}

export function formatCurrency(amount: number): string {
  const options = {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };
  return new Intl.NumberFormat('en-IN', options).format(Math.round(amount));
}

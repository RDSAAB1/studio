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

export function formatSrNo(num: number | string) {
  return 'S' + String(num).padStart(5, '0');
}

export function formatPaymentId(num: number | string) {
  return 'P' + String(num).padStart(5, '0');
}

export function formatCurrency(amount: number): string {
  // Do not show decimals for zero amount
  const options = {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: amount === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  };
  return new Intl.NumberFormat('en-IN', options).format(amount);
}

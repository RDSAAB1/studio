import CashBankClient from "./cash-bank-client";
import type { PageProps } from '@/app/types';

export default function CashBankPage({ params, searchParams }: PageProps) {
  return (
    <CashBankClient />
  );
}

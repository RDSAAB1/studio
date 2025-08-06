import IncomeExpenseClient from "./expense-tracker-client";
import type { PageProps } from '@/app/types';

export default function IncomeExpensePage({ params, searchParams }: PageProps) {
  return (
    <IncomeExpenseClient />
  );
}

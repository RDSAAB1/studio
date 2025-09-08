import DynamicExpenseTrackerClient from './dynamic-expense-tracker';
import type { PageProps } from '@/app/types';

export default function ExpenseTrackerPage({ searchParams }: PageProps) {
  return (
    <DynamicExpenseTrackerClient searchParams={searchParams}/>
  );
}
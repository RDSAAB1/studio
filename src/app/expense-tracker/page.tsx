
import ExpenseTrackerClient from "./expense-tracker-client";
import type { PageProps } from '@/app/types';

export default function ExpenseTrackerPage({ searchParams }: PageProps) {
  return (
    <ExpenseTrackerClient searchParams={searchParams || {}}/>
  );
}

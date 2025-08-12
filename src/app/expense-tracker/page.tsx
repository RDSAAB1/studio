import ExpenseTrackerClient from "./expense-tracker-client";
import type { PageProps } from '@/app/types';

export default function ExpenseTrackerPage({ params, searchParams }: PageProps) {
  return (
    <ExpenseTrackerClient />
  );
}

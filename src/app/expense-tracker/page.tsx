import dynamic from 'next/dynamic';
import type { PageProps } from '@/app/types';

const ExpenseTrackerClient = dynamic(() => import('./expense-tracker-client'), {
  ssr: false,
});

export default function ExpenseTrackerPage({ searchParams }: PageProps) {
  return (
    <ExpenseTrackerClient searchParams={searchParams || {}}/>
  );
}

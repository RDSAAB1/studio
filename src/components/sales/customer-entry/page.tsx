
import CustomerEntryClient from "./customer-entry-client";
import type { PageProps } from '@/app/types';


export default function CustomerEntryPage({ params, searchParams }: PageProps) {
  return <CustomerEntryClient />;
}

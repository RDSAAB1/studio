

import CustomerEntryClient from "./customer-entry-client";
import type { PageProps } from '@/app/types';


export default async function CustomerEntryPage({ params, searchParams }: PageProps) {
  // Next.js 15: params is now a Promise, but we don't need it here
  await params; // Ensure params is resolved
  return <CustomerEntryClient />;
}

    
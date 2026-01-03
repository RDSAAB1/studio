import SimpleSupplierEntryAllFields from "../supplier-entry/simple-supplier-entry-all-fields";
import type { PageProps } from '@/app/types';

// This page is now a proxy for supplier-entry
export default async function CustomerManagementPage({ params, searchParams }: PageProps) {
  // Next.js 15: params is now a Promise, but we don't need it here
  await params; // Ensure params is resolved
  return (
    <SimpleSupplierEntryAllFields />
  );
}

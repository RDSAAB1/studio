import SupplierEntryClient from "../supplier-entry/supplier-entry-client";
import type { PageProps } from '@/app/types';

// This page is now a proxy for supplier-entry, we will rename files in next step
export default function CustomerManagementPage({ params, searchParams }: PageProps) {
  return (
    <SupplierEntryClient />
  );
}

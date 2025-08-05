import SupplierEntryClient from "./supplier-entry-client";
import type { PageProps } from '@/app/types';

export default function SupplierEntryPage({ params, searchParams }: PageProps) {
  return (
    <SupplierEntryClient />
  );
}


import SupplierPaymentsClient from "./supplier-payments-client";
import type { PageProps } from '@/app/types';

export default function SupplierPaymentsPage({ params, searchParams }: PageProps) {
  return (
    <SupplierPaymentsClient />
  );
}

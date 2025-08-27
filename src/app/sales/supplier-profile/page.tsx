import SupplierProfileClient from "./supplier-profile-client";
import type { PageProps } from '@/app/types';

export default function SupplierProfilePage({ params, searchParams }: PageProps) {
  return (
    <SupplierProfileClient />
  );
}

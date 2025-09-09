
import CustomerProfileClient from "./customer-profile-client";
import type { PageProps } from '@/app/types';

export default function CustomerProfilePage({ params, searchParams }: PageProps) {
  return (
    <CustomerProfileClient />
  );
}

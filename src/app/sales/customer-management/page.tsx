import CustomerManagementClient from "./customer-management-client";
import type { PageProps } from '@/app/types';

export default function CustomerManagementPage({ params, searchParams }: PageProps) {
  return (
    <div>
      <CustomerManagementClient />
    </div>
  );
}

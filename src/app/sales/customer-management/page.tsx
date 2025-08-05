import CustomerManagementClient from "./customer-management-client";
import type { PageProps } from '@/app/types';

export default function CustomerManagementPage({ params, searchParams }: PageProps) {
  return (
    <div>
        <div className="mb-6">
            <h1 className="text-3xl font-bold font-headline text-primary">Supplier Entry</h1>
            <p className="text-muted-foreground">Add, edit, and manage supplier transaction records.</p>
        </div>
        <CustomerManagementClient />
    </div>
  );
}

    
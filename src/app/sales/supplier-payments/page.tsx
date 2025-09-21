
"use client";

import dynamic from 'next/dynamic';

const DynamicSupplierPaymentsClient = dynamic(() => import('./supplier-payments-client'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-64"><p>Loading Payments...</p></div>,
});

export default function SupplierPaymentsPage() {
  return <DynamicSupplierPaymentsClient />;
}

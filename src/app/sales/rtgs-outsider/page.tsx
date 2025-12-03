"use client";

import SupplierPaymentsClient from '../supplier-payments/unified-payments-client';

export default function RtgsOutsiderPage() {
  return (
    <div className="space-y-4 w-full">
      <SupplierPaymentsClient type="outsider" />
    </div>
  );
}


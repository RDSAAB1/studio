"use client";

import SupplierPaymentsClient from '../supplier-payments/unified-payments-client';

export default function OutsiderPaymentsPage() {
  return (
    <div className="space-y-4 w-full">
      <SupplierPaymentsClient type="outsider" />
    </div>
  );
}


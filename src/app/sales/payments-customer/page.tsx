"use client";

import SupplierPaymentsClient from '../supplier-payments/unified-payments-client';

export default function CustomerPaymentsPage() {
  return (
    <div className="space-y-4 w-full">
      <SupplierPaymentsClient type="customer" />
    </div>
  );
}


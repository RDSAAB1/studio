"use client";

import SupplierPaymentsClient from '../payment-payable/unified-payments-client';

export default function SupplierPaymentsPage() {
  return (
    <div className="space-y-4 w-full">
      <SupplierPaymentsClient type="supplier" />
    </div>
  );
}


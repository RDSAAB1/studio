"use client";

import { Suspense } from "react";
import { useSearchParams } from 'next/navigation';
import UnifiedPaymentsPage from "./unified-payments-page";

function PaymentsPageContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'supplier';
  
  return <UnifiedPaymentsPage defaultTab={tab as 'supplier' | 'customer' | 'outsider'} />;
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageContent />
    </Suspense>
  );
}
